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

    // 2) Registrar el pago (evita duplicados si Mercado Pago reintenta el webhook).
    const { data: existente } = await supabase
      .from("pagos").select("id").eq("referencia_mp", String(pago.id)).maybeSingle();

    if (!existente) {
      await supabase.from("pagos").insert({
        usuario_id: usuarioId,
        curso_id: cursoId,
        monto: pago.transaction_amount,
        medio: "Mercado Pago",
        referencia_mp: String(pago.id),
        nota: "Pago automático vía Checkout Pro",
      });
    }

    // 3) Dar acceso automático al curso.
    await supabase.from("inscripciones").upsert(
      { usuario_id: usuarioId, curso_id: cursoId, estatus: "activa" },
      { onConflict: "usuario_id,curso_id" }
    );

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("error interno", { status: 200 }); // 200 para que MP no reintente en bucle
  }
});
