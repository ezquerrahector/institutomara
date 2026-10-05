// Supabase Edge Function: tienda
// ----------------------------------------------------------------------------
// Membresías mensuales/anuales, regalos y el descuento de recompra.
// Acciones (POST { accion, ... }):
//   membresia            { plan: 'esencial'|'total'|'anual', correoMP?, urlRegreso }  → { init_point }
//   cancelar_membresia   {}                                                          → { ok }
//   sincronizar          {}  (revisa en Mercado Pago el estado de tu membresía)       → { membresia }
//   inscribir_membresia  { cursoId }  (empieza un programa incluido en tu membresía) → { ok }
//   regalo               { cursoId, paraNombre, paraCorreo?, paraTel?, mensaje?, deNombre?, entregarEn?, urlRegreso } → { init_point }
//   recompra             { cursoId }  (al obtener una constancia)                    → { codigo, pct, vence }
//   diaria               (solo con la llave de servicio: tarea programada)          → { regalos, recordatorios, membresias }
// Secretos: MP_ACCESS_TOKEN, BREVO_API_KEY, CORREO_REMITENTE, NOMBRE_REMITENTE (opcional),
//           MP_WEBHOOK_URL (opcional), URL_AULA (opcional). SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase.

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const URL_SB = Deno.env.get("SUPABASE_URL") || "";
const LLAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const MP = Deno.env.get("MP_ACCESS_TOKEN") || "";
const BREVO = Deno.env.get("BREVO_API_KEY") || "";
const REMITENTE = Deno.env.get("CORREO_REMITENTE") || "";
const NOMBRE = Deno.env.get("NOMBRE_REMITENTE") || "Instituto Mara";
const AULA = Deno.env.get("URL_AULA") || "https://institutomara.com/plataforma/index.html";
const WEBHOOK = Deno.env.get("MP_WEBHOOK_URL") || `${URL_SB}/functions/v1/webhook-mercadopago`;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const srv = { apikey: LLAVE, Authorization: `Bearer ${LLAVE}`, "Content-Type": "application/json" };
const e = (t: unknown) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const PLANES: Record<string, string> = { esencial: "Esencial", total: "Total", anual: "Anual Total" };

async function db(ruta: string, op: { metodo?: string; cuerpo?: unknown; prefer?: string } = {}) {
  const h: Record<string, string> = { ...srv };
  if (op.prefer) h.Prefer = op.prefer;
  const r = await fetch(`${URL_SB}/rest/v1/${ruta}`, { method: op.metodo || "GET", headers: h, body: op.cuerpo ? JSON.stringify(op.cuerpo) : undefined });
  const t = await r.text();
  let d: any = null; try { d = t ? JSON.parse(t) : null; } catch (_x) { d = t; }
  if (!r.ok) throw new Error(`BD ${ruta.split("?")[0]}: ${typeof d === "string" ? d : (d && d.message) || r.status}`);
  return d;
}
async function usuarioDe(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  if (token === LLAVE) return { id: "servicio", servicio: true };
  try { const pl = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); if (pl.role === "service_role") {
    const v = await fetch(`${URL_SB}/rest/v1/ajustes?select=id&limit=1`, { headers: { apikey: LLAVE, Authorization: `Bearer ${token}` } });
    if (v.ok) return { id: "servicio", servicio: true }; } } catch (_x) { /* no es JWT */ }
  const r = await fetch(`${URL_SB}/auth/v1/user`, { headers: { apikey: LLAVE, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  const p = await db(`perfiles?id=eq.${u.id}&select=id,nombre,correo,rol`);
  return { id: u.id, correo: u.email, nombre: (p[0] && p[0].nombre) || "", rol: p[0] && p[0].rol };
}
async function ajustes() { const a = await db("ajustes?id=eq.true&select=*"); return a[0]; }
async function mp(ruta: string, metodo = "GET", cuerpo?: unknown) {
  const r = await fetch(`https://api.mercadopago.com${ruta}`, {
    method: metodo, headers: { Authorization: `Bearer ${MP}`, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Mercado Pago: ${d.message || r.status}`);
  return d;
}
function codigo(prefijo: string) {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = "";
  const b = crypto.getRandomValues(new Uint8Array(7)); for (const x of b) s += a[x % a.length];
  return `${prefijo}-${s}`;
}
const fecha = (d: Date) => d.toISOString().slice(0, 10);
const fechaLarga = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
const dinero = (n: number) => "$" + Number(n).toLocaleString("es-MX", { maximumFractionDigits: 2 });

async function correo(para: string, nombrePara: string, asunto: string, html: string) {
  if (!BREVO || !REMITENTE || !para) return false;
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST", headers: { "api-key": BREVO, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { email: REMITENTE, name: NOMBRE }, to: [{ email: para, name: nombrePara || para }], subject: asunto, htmlContent: html }),
  });
  if (!r.ok) console.error("Brevo", r.status, await r.text());
  return r.ok;
}
function plantilla(titulo: string, cuerpo: string, boton?: { texto: string; url: string }) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f1640">
  <div style="background:#6D28D9;color:#fff;padding:22px 26px;border-radius:14px 14px 0 0"><b style="font-size:18px">Instituto Mara</b></div>
  <div style="border:1px solid #e6e1f5;border-top:0;padding:26px;border-radius:0 0 14px 14px">
  <h2 style="margin:0 0 14px;font-size:22px">${titulo}</h2>${cuerpo}
  ${boton ? `<p style="margin:26px 0"><a href="${boton.url}" style="background:#6D28D9;color:#fff;padding:13px 22px;border-radius:999px;text-decoration:none;font-weight:bold">${e(boton.texto)}</a></p>` : ""}
  <p style="color:#6b6585;font-size:12px;margin-top:26px">Instituto Mara · Cursos y diplomados 100 % en línea · Constancia con folio verificable.</p></div></div>`;
}

// ---------------------------------------------------------------- membresías
async function crearMembresia(u: any, b: any) {
  const plan = String(b.plan || "");
  if (!PLANES[plan]) return json({ error: "Plan no válido." }, 400);
  const a = await ajustes();
  const precio = Number(plan === "esencial" ? a.precio_esencial : plan === "total" ? a.precio_total : a.precio_anual);
  if (!(precio > 0)) return json({ error: "La membresía no tiene precio configurado." }, 409);
  const base = String(b.urlRegreso || AULA).replace(/[?#].*$/, "");
  const ref = `mem::${u.id}::${plan}`;
  if (plan === "anual") {
    const pref = await mp("/checkout/preferences", "POST", {
      items: [{ id: "mem-anual", title: "Membresía Anual Total — Instituto Mara", quantity: 1, currency_id: "MXN", unit_price: precio }],
      payer: { email: u.correo }, statement_descriptor: "INSTITUTO MARA",
      metadata: { tipo: "membresia", plan, usuario_id: u.id, monto: precio }, external_reference: ref,
      back_urls: { success: `${base}?membresia=exito`, pending: `${base}?membresia=pendiente`, failure: `${base}?membresia=fallo` },
      auto_return: "approved", notification_url: WEBHOOK,
    });
    return json({ init_point: pref.init_point });
  }
  const correoMP = String(b.correoMP || u.correo || "").trim();
  const pre = await mp("/preapproval", "POST", {
    reason: `Membresía ${PLANES[plan]} — Instituto Mara`, external_reference: ref, payer_email: correoMP,
    auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: precio, currency_id: "MXN" },
    back_url: `${base}?membresia=exito`, status: "pending",
  });
  await db("membresias", { metodo: "POST", prefer: "return=minimal", cuerpo: { usuario_id: u.id, plan, estado: "pendiente", mp_preapproval_id: pre.id, monto: precio } });
  return json({ init_point: pre.init_point });
}
async function aplicarPreapproval(pre: any) {
  const [, uid, plan] = String(pre.external_reference || "").split("::");
  if (!uid || !PLANES[plan]) return null;
  const hay = await db(`membresias?mp_preapproval_id=eq.${pre.id}&select=*`);
  const actual = hay[0];
  const cambios: any = { actualizado_en: new Date().toISOString(), monto: pre.auto_recurring && pre.auto_recurring.transaction_amount };
  if (pre.status === "authorized") {
    cambios.estado = "activa";
    if (!actual || !actual.inicio) cambios.inicio = new Date().toISOString();
    const prox = pre.next_payment_date ? new Date(pre.next_payment_date) : new Date(Date.now() + 31 * 864e5);
    prox.setDate(prox.getDate() + 3); // días de gracia por si el cobro tarda
    const previo = actual && actual.vigente_hasta ? new Date(actual.vigente_hasta) : new Date(0);
    cambios.vigente_hasta = (prox > previo ? prox : previo).toISOString();
  } else if (pre.status === "cancelled" || pre.status === "paused") {
    cambios.estado = "cancelada";
  }
  if (actual) await db(`membresias?id=eq.${actual.id}`, { metodo: "PATCH", cuerpo: cambios, prefer: "return=minimal" });
  else await db("membresias", { metodo: "POST", prefer: "return=minimal", cuerpo: { usuario_id: uid, plan, mp_preapproval_id: pre.id, estado: cambios.estado || "pendiente", ...cambios } });
  return true;
}
async function cancelarMembresia(u: any) {
  const filas = await db(`membresias?usuario_id=eq.${u.id}&estado=eq.activa&mp_preapproval_id=not.is.null&select=*`);
  if (!filas.length) return json({ error: "No encontramos una membresía mensual activa." }, 404);
  for (const m of filas) {
    await mp(`/preapproval/${m.mp_preapproval_id}`, "PUT", { status: "cancelled" });
    await db(`membresias?id=eq.${m.id}`, { metodo: "PATCH", prefer: "return=minimal", cuerpo: { estado: "cancelada", actualizado_en: new Date().toISOString() } });
  }
  return json({ ok: true });
}
async function sincronizar(u: any) {
  const filas = await db(`membresias?usuario_id=eq.${u.id}&mp_preapproval_id=not.is.null&estado=in.(pendiente,activa)&select=*`);
  for (const m of filas) { try { await aplicarPreapproval(await mp(`/preapproval/${m.mp_preapproval_id}`)); } catch (x) { console.error(x); } }
  const r = await db(`membresias?usuario_id=eq.${u.id}&select=*&order=creado_en.desc&limit=5`);
  return json({ membresias: r });
}
async function inscribirMembresia(u: any, b: any) {
  const cid = String(b.cursoId || "");
  const ok = await db("rpc/membresia_cubre", { metodo: "POST", cuerpo: { p_usuario: u.id, p_curso: cid } });
  if (ok !== true) return json({ error: "Tu membresía no incluye este programa o ya no está vigente." }, 403);
  await db("inscripciones?on_conflict=usuario_id,curso_id", { metodo: "POST", prefer: "resolution=ignore-duplicates,return=minimal",
    cuerpo: { usuario_id: u.id, curso_id: cid, estatus: "membresia" } });
  return json({ ok: true });
}

// ---------------------------------------------------------------- regalos
async function crearRegalo(u: any, b: any) {
  const cid = String(b.cursoId || "");
  const paraNombre = String(b.paraNombre || "").trim().slice(0, 120);
  const paraCorreo = String(b.paraCorreo || "").trim().slice(0, 160);
  const paraTel = String(b.paraTel || "").replace(/[^\d+]/g, "").slice(0, 20);
  if (!paraNombre) return json({ error: "Escribe el nombre de quien recibe el regalo." }, 400);
  if (!paraCorreo && !paraTel) return json({ error: "Escribe el correo o el WhatsApp de quien recibe el regalo." }, 400);
  if (paraCorreo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(paraCorreo)) return json({ error: "Revisa el correo de quien recibe." }, 400);
  const hoy = fecha(new Date());
  let entregar = String(b.entregarEn || hoy).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entregar) || entregar < hoy) entregar = hoy;
  const c = (await db(`cursos?id=eq.${encodeURIComponent(cid)}&select=id,nombre,precio,publicado`))[0];
  if (!c || c.publicado === false || !(Number(c.precio) > 0)) return json({ error: "Ese programa no está disponible para regalo." }, 409);
  const reg = (await db("regalos", { metodo: "POST", prefer: "return=representation", cuerpo: {
    comprador_id: u.id, curso_id: cid, para_nombre: paraNombre, para_correo: paraCorreo || null, para_tel: paraTel || null,
    mensaje: String(b.mensaje || "").slice(0, 600), de_nombre: String(b.deNombre || u.nombre || "").slice(0, 120),
    entregar_en: entregar, monto: Number(c.precio) } }))[0];
  const base = String(b.urlRegreso || AULA).replace(/[?#].*$/, "");
  const pref = await mp("/checkout/preferences", "POST", {
    items: [{ id: cid, title: `Regalo: ${c.nombre}`, quantity: 1, currency_id: "MXN", unit_price: Number(c.precio) }],
    payer: { email: u.correo }, statement_descriptor: "INSTITUTO MARA",
    metadata: { tipo: "regalo", regalo_id: reg.id, monto: Number(c.precio) }, external_reference: `regalo::${reg.id}`,
    back_urls: { success: `${base}?regalo=exito&id=${reg.id}`, pending: `${base}?regalo=pendiente&id=${reg.id}`, failure: `${base}?regalo=fallo&id=${reg.id}` },
    auto_return: "approved", notification_url: WEBHOOK,
  });
  return json({ init_point: pref.init_point, regaloId: reg.id });
}
async function entregarRegalo(r: any) {
  const c = (await db(`cursos?id=eq.${encodeURIComponent(r.curso_id)}&select=nombre,nivel`))[0] || { nombre: r.curso_id };
  const enlace = `${AULA}?cupon=${encodeURIComponent(r.codigo)}&curso=${encodeURIComponent(r.curso_id)}`;
  let ok = true;
  if (r.para_correo) {
    ok = await correo(r.para_correo, r.para_nombre, `🎁 ${r.de_nombre || "Alguien especial"} te regaló un programa en Instituto Mara`,
      plantilla(`¡${e(r.para_nombre)}, tienes un regalo!`,
        `<p style="font-size:16px;line-height:1.6"><b>${e(r.de_nombre || "Alguien que te aprecia")}</b> te regaló <b>${e(c.nombre)}</b>, 100 % en línea, a tu ritmo y con constancia al terminar.</p>` +
        (r.mensaje ? `<blockquote style="border-left:4px solid #C4B5FD;margin:18px 0;padding:6px 14px;color:#4b4366;font-style:italic">${e(r.mensaje)}</blockquote>` : "") +
        `<p style="font-size:15px">Tu código de regalo: <b style="font-size:18px;letter-spacing:1px">${e(r.codigo)}</b><br><small>Válido por 12 meses. Al abrir el enlace, crea tu cuenta o entra y el regalo se aplica solo.</small></p>`,
        { texto: "Activar mi regalo", url: enlace }));
  }
  await db(`regalos?id=eq.${r.id}`, { metodo: "PATCH", prefer: "return=minimal", cuerpo: { estado: "enviado", enviado_en: new Date().toISOString() } });
  return ok;
}

// ---------------------------------------------------------------- recompra
async function recompra(u: any, b: any) {
  const cid = String(b.cursoId || "");
  const con = await db(`constancias?usuario_id=eq.${u.id}&curso_id=eq.${encodeURIComponent(cid)}&select=id`);
  if (!con.length) return json({ error: "Aún no hay constancia de ese programa." }, 409);
  const ya = await db(`recompras?usuario_id=eq.${u.id}&curso_id=eq.${encodeURIComponent(cid)}&select=*`);
  const a = await ajustes();
  if (ya.length) {
    const cup = (await db(`cupones?codigo=eq.${ya[0].codigo}&select=vence,usos,valor`))[0];
    return json({ codigo: ya[0].codigo, pct: cup ? cup.valor : a.recompra_pct, vence: cup && cup.vence, usado: cup && cup.usos > 0 });
  }
  const pct = Number(a.recompra_pct) || 40, dias = Number(a.recompra_dias) || 15;
  const vence = fecha(new Date(Date.now() + dias * 864e5));
  const cod = codigo("VUELVE");
  await db("cupones", { metodo: "POST", prefer: "return=minimal", cuerpo: { codigo: cod, descripcion: `${pct}% por haber terminado un programa`, tipo: "porcentaje", valor: pct, usos_max: 1, vence } });
  await db("recompras", { metodo: "POST", prefer: "return=minimal", cuerpo: { usuario_id: u.id, curso_id: cid, codigo: cod, enviado_en: new Date().toISOString() } });
  const c = (await db(`cursos?id=eq.${encodeURIComponent(cid)}&select=nombre`))[0] || { nombre: "tu programa" };
  await correo(u.correo, u.nombre, `🎓 ¡Felicidades! Tu siguiente programa con ${pct}% de descuento`,
    plantilla(`¡Felicidades, ${e(String(u.nombre || "").split(" ")[0])}!`,
      `<p style="font-size:16px;line-height:1.6">Terminaste <b>${e(c.nombre)}</b>. Para que sigas creciendo, te regalamos <b>${pct}% de descuento</b> en el curso o diplomado que elijas.</p>` +
      `<p style="font-size:15px">Tu código personal: <b style="font-size:18px;letter-spacing:1px">${cod}</b><br><small>Un solo uso · válido hasta el ${fechaLarga(vence)}.</small></p>`,
      { texto: "Elegir mi siguiente programa", url: `${AULA}?cupon=${cod}` }));
  return json({ codigo: cod, pct, vence });
}

// ---------------------------------------------------------------- tarea diaria
async function diaria() {
  const hoy = fecha(new Date());
  const pend = await db(`regalos?estado=eq.pagado&entregar_en=lte.${hoy}&select=*`);
  let regalos = 0; for (const r of pend) { try { await entregarRegalo(r); regalos++; } catch (x) { console.error(x); } }
  const a = await ajustes();
  const limite = new Date(Date.now() - (Number(a.recompra_recordatorio_dia) || 10) * 864e5).toISOString();
  const rec = await db(`recompras?recordado_en=is.null&enviado_en=lte.${limite}&select=*`);
  let recordatorios = 0;
  for (const r of rec) {
    try {
      const cup = (await db(`cupones?codigo=eq.${r.codigo}&select=*`))[0];
      if (cup && cup.usos === 0 && cup.activo && (!cup.vence || cup.vence >= hoy)) {
        const p = (await db(`perfiles?id=eq.${r.usuario_id}&select=nombre,correo`))[0];
        if (p && p.correo) {
          await correo(p.correo, p.nombre, `⏰ Tu ${cup.valor}% de descuento vence pronto`,
            plantilla(`Tu descuento sigue esperándote`,
              `<p style="font-size:16px;line-height:1.6">Te quedan pocos días para usar tu <b>${cup.valor}% de descuento</b> en tu siguiente curso o diplomado.</p><p>Código: <b style="font-size:18px">${cup.codigo}</b> · vence el ${fechaLarga(cup.vence)}.</p>`,
              { texto: "Ver programas", url: `${AULA}?cupon=${cup.codigo}` }));
          recordatorios++;
        }
      }
      await db(`recompras?id=eq.${r.id}`, { metodo: "PATCH", prefer: "return=minimal", cuerpo: { recordado_en: new Date().toISOString() } });
    } catch (x) { console.error(x); }
  }
  // Membresías mensuales: revisar en Mercado Pago las que vencen en los próximos días.
  const pronto = new Date(Date.now() + 2 * 864e5).toISOString();
  const mems = await db(`membresias?mp_preapproval_id=not.is.null&estado=in.(activa,pendiente)&or=(vigente_hasta.is.null,vigente_hasta.lte.${pronto})&select=*`);
  let membresias = 0; for (const m of mems) { try { await aplicarPreapproval(await mp(`/preapproval/${m.mp_preapproval_id}`)); membresias++; } catch (x) { console.error(x); } }
  await db(`membresias?estado=in.(activa,cancelada)&vigente_hasta=lt.${new Date().toISOString()}`, { metodo: "PATCH", prefer: "return=minimal", cuerpo: { estado: "vencida" } });
  return json({ regalos, recordatorios, membresias });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    const u = await usuarioDe(req);
    if (!u) return json({ error: "Inicia sesión para continuar." }, 401);
    if (u.servicio) {
      if (b.accion === "diaria") return await diaria();
      if (b.accion === "entregar") { const r = (await db(`regalos?id=eq.${b.regaloId}&select=*`))[0]; if (r && r.estado === "pagado" && r.entregar_en <= fecha(new Date())) await entregarRegalo(r); return json({ ok: true }); }
      if (b.accion === "preapproval") { await aplicarPreapproval(await mp(`/preapproval/${b.id}`)); return json({ ok: true }); }
      return json({ error: "Acción no válida." }, 400);
    }
    switch (b.accion) {
      case "membresia": return await crearMembresia(u, b);
      case "cancelar_membresia": return await cancelarMembresia(u);
      case "sincronizar": return await sincronizar(u);
      case "inscribir_membresia": return await inscribirMembresia(u, b);
      case "regalo": return await crearRegalo(u, b);
      case "recompra": return await recompra(u, b);
      default: return json({ error: "Acción no válida." }, 400);
    }
  } catch (x) {
    console.error(x);
    return json({ error: String((x as Error).message || x) }, 500);
  }
});
