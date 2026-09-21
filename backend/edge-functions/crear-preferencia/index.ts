// Supabase Edge Function: crear-preferencia
// ----------------------------------------------------------------------------
// Recibe del front (botón "Pagar con Mercado Pago") el curso y el alumno, crea
// una preferencia de pago en Mercado Pago (Checkout Pro) y regresa la URL a la
// que hay que redirigir al alumno para pagar.
//
// Si el alumno escribe un cupón, el descuento también se calcula aquí: el
// navegador solo muestra el resultado. Si el cupón cubre el curso completo, no
// se crea cobro: se inscribe al alumno de una vez y se registra en pagos.
//
// IMPORTANTE (seguridad): el precio NUNCA se toma de lo que manda el navegador.
// Si se tomara de ahí, cualquiera podría abrir las herramientas del navegador,
// cambiar el precio a $1 y pagar eso. Aquí el precio se resuelve en el servidor,
// en este orden:
//   1. La tabla `cursos` de Supabase (columna `precio`), si está configurada.
//   2. El secreto PRECIOS: un JSON con { "id-del-curso": precio }.
// Si el curso no aparece en ninguno de los dos, no se crea el cobro.
//
// Variables de entorno (Supabase → Project Settings → Edge Functions → Secrets):
//   MP_ACCESS_TOKEN   → Access Token PRIVADO de Mercado Pago (nunca en el front).
//   MP_WEBHOOK_URL    → (opcional) URL de la función webhook-mercadopago.
//   PRECIOS           → (opcional si usas la tabla `cursos`) JSON con los precios,
//                       por ejemplo: {"c-ingles":890,"c-ia":990,"c-office":990}
//                       Puedes generarlo con backend/precios.json de este repo.
//   SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las pone Supabase solas.
//
// Despliegue (con la CLI de Supabase instalada):
//   supabase functions deploy crear-preferencia
//   supabase secrets set MP_ACCESS_TOKEN=TU_ACCESS_TOKEN
//   supabase secrets set PRECIOS="$(cat backend/precios.json)"
//
// La URL resultante (algo como
// https://TU-PROYECTO.functions.supabase.co/crear-preferencia) es la que se
// pega en la app, en Administración → Ajustes → "URL de la función crear
// preferencia".

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

/* Llama una función de la base de datos con la llave de servicio. */
async function rpc(nombre: string, cuerpo: Record<string, unknown>) {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombre}`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cuerpo),
    });
    if (!r.ok) {
      console.error("Error en", nombre, await r.text());
      return null;
    }
    return await r.json();
  } catch (e) {
    console.error("Error en", nombre, String(e));
    return null;
  }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Lista de precios de respaldo, tomada del secreto PRECIOS.
let PRECIOS: Record<string, number> = {};
try {
  PRECIOS = JSON.parse(Deno.env.get("PRECIOS") || "{}");
} catch (_e) {
  console.error("El secreto PRECIOS no es un JSON válido; se ignora.");
}

// Busca el curso en la tabla `cursos`. Regresa null si no hay Supabase
// configurado, si el curso no existe o si la consulta falla.
async function cursoEnBaseDeDatos(cursoId: string) {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/cursos?id=eq.${encodeURIComponent(cursoId)}` +
      `&select=id,nombre,precio,publicado&limit=1`;
    const r = await fetch(url, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!r.ok) return null;
    const filas = await r.json();
    return Array.isArray(filas) && filas.length ? filas[0] : null;
  } catch (_e) {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();
    // Ojo: `precio` y `cursoNombre` que manda el navegador se ignoran a propósito.
    const { cursoId, usuarioId, usuarioCorreo, urlRegreso, cupon } = body;

    if (!cursoId || !usuarioId) {
      return json({ error: "Faltan datos del curso o del alumno." }, 400);
    }
    if (!MP_ACCESS_TOKEN) {
      return json({ error: "Falta configurar MP_ACCESS_TOKEN en el servidor." }, 500);
    }

    // ---------- El precio se decide aquí, en el servidor ----------
    const enBD = await cursoEnBaseDeDatos(String(cursoId));
    let precio: number | null = null;
    let nombre = "Curso Instituto Mara";

    if (enBD) {
      if (enBD.publicado === false) {
        return json({ error: "Ese curso no está disponible para compra." }, 409);
      }
      if (enBD.precio != null && Number(enBD.precio) > 0) precio = Number(enBD.precio);
      if (enBD.nombre) nombre = String(enBD.nombre);
    }
    if (precio == null && PRECIOS[String(cursoId)] != null) {
      precio = Number(PRECIOS[String(cursoId)]);
    }
    if (precio == null || !isFinite(precio) || precio <= 0) {
      console.error("Sin precio de servidor para el curso", cursoId);
      return json({
        error: "Ese curso no tiene precio configurado en el servidor. " +
               "Escríbenos por WhatsApp y te ayudamos a inscribirte.",
      }, 409);
    }
    precio = Math.round(precio * 100) / 100;

    // ---------- Cupón de descuento (opcional) ----------
    let codigoCupon: string | null = null;
    if (cupon && String(cupon).trim()) {
      codigoCupon = String(cupon).trim().toUpperCase();
      const filas = await rpc("aplicar_cupon", { p_codigo: codigoCupon, p_curso_id: cursoId });
      const v = Array.isArray(filas) ? filas[0] : filas;
      if (!v || !v.valido) {
        return json({ error: (v && v.motivo) || "Ese cupón no se pudo aplicar." }, 409);
      }
      precio = Math.round(Number(v.precio_final) * 100) / 100;

      // Cupón que cubre todo el curso: no hay nada que cobrar.
      if (precio <= 0) {
        const r = await rpc("canjear_cupon", {
          p_codigo: codigoCupon, p_curso_id: cursoId, p_usuario: usuarioId,
        });
        if (!r || r.ok !== true) {
          return json({ error: (r && r.motivo) || "No se pudo aplicar el cupón." }, 409);
        }
        return json({ gratis: true, precio: 0, cupon: codigoCupon });
      }
    }

    const base = String(urlRegreso || "").replace(/\/$/, "");
    const preferencia = {
      items: [{
        id: String(cursoId),
        title: nombre,
        quantity: 1,
        currency_id: "MXN",
        unit_price: precio,
      }],
      payer: { email: usuarioCorreo || undefined },
      // Lo que ve el alumno en su estado de cuenta de la tarjeta.
      statement_descriptor: "INSTITUTO MARA",
      // Instituto Mara identifica el pago con estos metadatos para que el
      // webhook sepa a quién inscribir en cuanto Mercado Pago confirme el pago.
      metadata: { curso_id: cursoId, usuario_id: usuarioId, monto: precio, cupon: codigoCupon },
      external_reference: `${usuarioId}::${cursoId}`,
      back_urls: {
        success: `${base}?pago=exito&curso=${encodeURIComponent(cursoId)}`,
        pending: `${base}?pago=pendiente&curso=${encodeURIComponent(cursoId)}`,
        failure: `${base}?pago=fallo&curso=${encodeURIComponent(cursoId)}`,
      },
      auto_return: "approved",
      notification_url: Deno.env.get("MP_WEBHOOK_URL") || undefined,
    };

    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferencia),
    });
    const data = await r.json();

    if (!r.ok) {
      return json({ error: "Mercado Pago rechazó la solicitud.", detalle: data }, 502);
    }

    // Se regresa también el precio real para que el front lo muestre si quiere.
    return json({ init_point: data.init_point, preference_id: data.id, precio, cupon: codigoCupon });

  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
