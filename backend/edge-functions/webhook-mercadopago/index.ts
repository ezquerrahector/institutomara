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


const URL_SB = Deno.env.get("SUPABASE_URL")!;
const LLAVE_SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
/* Llama a la función «tienda» con la llave de servicio (entregas de regalo y estado de membresías). */
async function tienda(cuerpo: Record<string, unknown>) {
  try {
    await fetch(`${URL_SB}/functions/v1/tienda`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: LLAVE_SRV, Authorization: `Bearer ${LLAVE_SRV}` },
      body: JSON.stringify(cuerpo),
    });
  } catch (e) { console.error("tienda", String(e)); }
}
function codigoRegalo() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = "";
  for (const x of crypto.getRandomValues(new Uint8Array(7))) s += a[x % a.length];
  return `REGALO-${s}`;
}
/* Pago aprobado de un regalo: crea el cupón de un solo uso y lo entrega (o lo deja programado). */
async function pagoDeRegalo(pago: any, regaloId: string) {
  const { data: r } = await supabase.from("regalos").select("*").eq("id", regaloId).maybeSingle();
  if (!r) return "regalo no encontrado";
  if (r.estado !== "pendiente_pago") return "regalo ya procesado";
  const monto = Number(pago.transaction_amount || 0);
  if (monto + 0.5 < Number(r.monto || 0)) {
    await supabase.from("pagos").insert({ usuario_id: r.comprador_id, curso_id: r.curso_id, monto, medio: "Mercado Pago",
      referencia_mp: String(pago.id), nota: `REVISAR regalo: pagó ${monto} de ${r.monto}` });
    return "monto insuficiente";
  }
  const codigo = codigoRegalo();
  const vence = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
  const { error: e1 } = await supabase.from("cupones").insert({ codigo, descripcion: `Regalo para ${r.para_nombre}`,
    tipo: "porcentaje", valor: 100, curso_id: r.curso_id, usos_max: 1, vence });
  if (e1) { console.error("cupón de regalo", e1.message); return "error cupón"; }
  await supabase.from("regalos").update({ estado: "pagado", codigo, mp_pago_id: String(pago.id) }).eq("id", r.id);
  await supabase.from("pagos").upsert({ usuario_id: r.comprador_id, curso_id: r.curso_id, monto, medio: "Mercado Pago",
    referencia_mp: String(pago.id), nota: `Regalo para ${r.para_nombre} (${codigo})` }, { onConflict: "referencia_mp", ignoreDuplicates: true });
  await tienda({ accion: "entregar", regaloId: r.id });
  return "ok";
}
/* Pago aprobado de una membresía (anual en Checkout Pro, o cobro mensual de una suscripción). */
async function pagoDeMembresia(pago: any, uid: string, plan: string) {
  const monto = Number(pago.transaction_amount || 0);
  const { data: aj } = await supabase.from("ajustes").select("*").eq("id", true).maybeSingle();
  const esperado = plan === "anual" ? Number(aj?.precio_anual) : plan === "total" ? Number(aj?.precio_total) : Number(aj?.precio_esencial);
  const { data: ins } = await supabase.from("pagos").upsert({ usuario_id: uid, curso_id: null, monto, medio: "Mercado Pago",
    referencia_mp: String(pago.id), nota: monto + 0.5 >= esperado ? `Membresía ${plan}` : `REVISAR membresía ${plan}: pagó ${monto} de ${esperado}` },
    { onConflict: "referencia_mp", ignoreDuplicates: true }).select("id");
  if (!(Array.isArray(ins) && ins.length)) return "pago ya registrado";
  if (monto + 0.5 < esperado) return "monto insuficiente";
  if (plan === "anual") {
    const { data: prev } = await supabase.from("membresias").select("*").eq("usuario_id", uid).in("estado", ["activa", "cancelada"])
      .order("vigente_hasta", { ascending: false }).limit(1);
    const base = prev && prev[0] && new Date(prev[0].vigente_hasta) > new Date() ? new Date(prev[0].vigente_hasta) : new Date();
    base.setDate(base.getDate() + 365);
    await supabase.from("membresias").insert({ usuario_id: uid, plan: "anual", estado: "activa", monto, inicio: new Date().toISOString(), vigente_hasta: base.toISOString() });
  } else {
    const { data: mems } = await supabase.from("membresias").select("mp_preapproval_id").eq("usuario_id", uid).eq("plan", plan).not("mp_preapproval_id", "is", null);
    for (const m of mems || []) await tienda({ accion: "preapproval", id: m.mp_preapproval_id });
  }
  return "ok";
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const topic = url.searchParams.get("topic") || url.searchParams.get("type") || body?.type || body?.topic || "";
    const id = url.searchParams.get("id") || url.searchParams.get("data.id") || body?.data?.id || body?.id;

    // Suscripciones (membresías mensuales)
    if (topic === "preapproval" || topic === "subscription_preapproval") {
      if (id) await tienda({ accion: "preapproval", id: String(id) });
      return new Response("ok", { status: 200 });
    }
    if (topic === "subscription_authorized_payment" || topic === "authorized_payment") {
      if (id) {
        const ra = await fetch(`https://api.mercadopago.com/authorized_payments/${id}`, { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } });
        const ap = await ra.json().catch(() => ({}));
        if (ra.ok && ap.preapproval_id) await tienda({ accion: "preapproval", id: String(ap.preapproval_id) });
      }
      return new Response("ok", { status: 200 });
    }

    const paymentId = id;
    if (topic && topic !== "payment") return new Response("ok", { status: 200 });
    if (!paymentId) return new Response("ok", { status: 200 });

    const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const pago = await r.json();
    if (!r.ok) return new Response("no encontrado", { status: 200 });

    if (pago.status !== "approved") {
      return new Response("pago no aprobado todavía", { status: 200 });
    }

    const ref = String(pago.external_reference || "");
    if (ref.startsWith("regalo::")) return new Response(await pagoDeRegalo(pago, ref.split("::")[1]), { status: 200 });
    if (ref.startsWith("emp::")) { await tienda({ accion: "empresa_pagada", compraId: ref.split("::")[1], pagoId: String(pago.id), monto: Number(pago.transaction_amount || 0) }); return new Response("ok", { status: 200 }); }
    if (ref.startsWith("mem::")) { const [, uidM, planM] = ref.split("::"); return new Response(await pagoDeMembresia(pago, uidM, planM), { status: 200 }); }
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
