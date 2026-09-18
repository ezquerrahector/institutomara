// Supabase Edge Function: crear-preferencia
// ----------------------------------------------------------------------------
// Recibe del front (botón "Pagar con Mercado Pago") los datos del curso y del
// alumno, crea una preferencia de pago en Mercado Pago (Checkout Pro) y
// regresa la URL a la que hay que redirigir al alumno para pagar.
//
// Variables de entorno que debes configurar en Supabase
// (Project Settings → Edge Functions → Secrets):
//   MP_ACCESS_TOKEN   → tu Access Token PRIVADO de Mercado Pago (nunca lo
//                        pongas en el front, solo aquí).
//
// Despliegue (una sola vez, con la CLI de Supabase ya instalada):
//   supabase functions deploy crear-preferencia
//   supabase secrets set MP_ACCESS_TOKEN=TU_ACCESS_TOKEN
//
// La URL resultante (algo como
// https://TU-PROYECTO.functions.supabase.co/crear-preferencia) es la que se
// pega en la app, en Administración → Ajustes → "URL de la función crear
// preferencia".

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") || "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();
    const { cursoId, cursoNombre, precio, usuarioId, usuarioCorreo, urlRegreso } = body;

    if (!cursoId || !precio || !usuarioId) {
      return new Response(JSON.stringify({ error: "Faltan datos del curso o del alumno." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const base = (urlRegreso || "").replace(/\/$/, "");
    const preferencia = {
      items: [{
        title: cursoNombre || "Curso Instituto Mara",
        quantity: 1,
        currency_id: "MXN",
        unit_price: Number(precio),
      }],
      payer: { email: usuarioCorreo || undefined },
      // Instituto Mara identifica el pago con estos metadatos para que el
      // webhook sepa a quién inscribir en cuanto Mercado Pago confirme el pago.
      metadata: { curso_id: cursoId, usuario_id: usuarioId },
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
      return new Response(JSON.stringify({ error: "Mercado Pago rechazó la solicitud.", detalle: data }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ init_point: data.init_point, preference_id: data.id }),
      { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
