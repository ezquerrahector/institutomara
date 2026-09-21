// Supabase Edge Function: webhook-mercadopago
// ----------------------------------------------------------------------------
// Mercado Pago llama a esta URL automáticamente cuando un pago cambia de
// estado. Aquí se confirma el pago contra la API de Mercado Pago (nunca hay
// que confiar ciegamente en lo que llega en la notificación) y, si fue
// aprobado, se inscribe al alumno y se registra el pago en Supabase. Esto es
// lo que hace posible el acceso automático al pagar, sin WhatsApp de por medio.
//
// Variables de entorno (Supabase → Edge Functions → Secrets):
//   MP_ACCESS_TOKEN            → el mismo access token de crear-preferencia
//   SUPABASE_URL               → se inyecta sola en Supabase
//   SUPABASE_SERVICE_ROLE_KEY  → Project Settings → API → service_role
//                                 (esta llave sí puede saltarse RLS; por eso
//                                 vive solo aquí, nunca en el front).
//
// Despliegue:
//   supabase functions deploy webhook-mercadopago --no-verify-jwt
//   (--no-verify-jwt porque Mercado Pago llama sin token de Supabase)
//
// Configuración en Mercado Pago:
//   Panel de desarrolladores → Tu aplicación → Webhooks → agrega la URL
//   https://TU-PROYECTO.functions.supabase.co/webhook-mercadopago

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") || "";
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Mismos precios de servidor que usa crear-preferencia (secreto PRECIOS).
let PRECIOS: Record<string, number> = {};
try {
  PRECIOS = JSON.parse(Deno.env.get("PRECIOS") || "{}");
} catch (_e) {
  console.error("El secreto PRECIOS no es un JSON válido; se ignora.");
}

// Precio que el servidor espera por ese curso. null = no hay precio configurado.
async function precioEsperado(cursoId: string): Promise<number | null> {
  try {
    const { data } = await supabase
      .from("cursos").select("precio").eq("id", cursoId).maybeSingle();
    if (data && data.precio != null && Number(data.precio) > 0) return Number(data.precio);
  } catch (_e) { /* si la tabla no existe todavía, se usa la lista PRECIOS */ }
  const p = PRECIOS[cursoId];
  return p != null && Number(p) > 0 ? Number(p) : null;
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const topic = url.searchParams.get("topic") || url.searchParams.get("type");
    const id = url.searchParams.get("id") || url.searchParams.get("data.id");

    // Mercado Pago también puede mandar el id en el cuerpo (notificaciones nuevas).
    let paymentId = id;
    if (!paymentId && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      paymentId = body?.data?.id || body?.id;
    }
    if (topic !== "payment" && !paymentId) {
      return new Response("ok", { status: 200 }); // otros eventos: se ignoran sin error
    }

    // 1) Confirmar el pago directo con Mercado Pago (fuente de verdad real).
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const pago = await r.json();
    if (!r.ok) return new Response("no encontrado", { status: 200 });

    if (pago.status !== "approved") {
      return new Response("pago no aprobado todavía", { status: 200 });
    }

    const [usuarioId, cursoId] = String(pago.external_reference || "").split("::");
    if (!usuarioId || !cursoId) return new Response("sin referencia", { status: 200 });

    // 2) Comprobar que lo pagado alcanza el precio que fija el servidor.
    //    (Segundo candado: aunque alguien lograra crear una preferencia barata,
    //     aquí no se le da acceso; el pago queda registrado para revisarlo.)
    //    Si hubo cupón, lo que se espera es el precio ya con descuento, que el
    //    propio servidor calculó al crear el cobro y dejó en los metadatos.
    const meta = (pago.metadata || {}) as Record<string, unknown>;
    const cupon = meta.cupon ? String(meta.cupon) : null;
    const monto = Number(pago.transaction_amount || 0);
    const deCatalogo = await precioEsperado(cursoId);
    const conCupon = Number(meta.monto || 0);
    const esperado = (cupon && conCupon > 0) ? conCupon : deCatalogo;
    const montoSuficiente = esperado == null ? true : monto + 0.5 >= esperado;

    // 3) Registrar el pago una sola vez. Mercado Pago a veces manda dos avisos
    //    del mismo pago casi al mismo tiempo; la referencia es única en la
    //    tabla, así que el segundo aviso simplemente no inserta nada.
    const { data: insertado, error: errPago } = await supabase.from("pagos").upsert({
      usuario_id: usuarioId,
      curso_id: cursoId,
      monto,
      medio: "Mercado Pago",
      referencia_mp: String(pago.id),
      nota: montoSuficiente
        ? "Pago automático vía Checkout Pro"
        : `REVISAR: pagó ${monto} y el curso cuesta ${esperado}. No se dio acceso.`,
    }, { onConflict: "referencia_mp", ignoreDuplicates: true }).select("id");
    if (errPago) console.error("No se pudo registrar el pago", pago.id, errPago.message);
    const primeraVez = !errPago && Array.isArray(insertado) && insertado.length > 0;

    if (!montoSuficiente) {
      console.error("Monto menor al precio", { cursoId, usuarioId, monto, esperado });
      return new Response("monto insuficiente", { status: 200 });
    }

    // 4) Dar acceso automático al curso.
    await supabase.from("inscripciones").upsert(
      { usuario_id: usuarioId, curso_id: cursoId, estatus: "activa" },
      { onConflict: "usuario_id,curso_id" }
    );

    // 5) Si se usó un cupón, contarle el uso (una sola vez por pago).
    if (cupon && primeraVez) {
      const { error } = await supabase.rpc("canjear_cupon", {
        p_codigo: cupon, p_curso_id: cursoId, p_usuario: usuarioId,
      });
      if (error) console.error("No se pudo registrar el uso del cupón", cupon, error.message);
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("error interno", { status: 200 }); // 200 para que MP no reintente en bucle
  }
});
