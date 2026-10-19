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
//   empresa              { cursoId, lugares (5-50), empresa, rfc?, contactoNombre?, contactoCorreo?, contactoTel?, urlRegreso } → { init_point }
//   empresa_invitar      { codigo, nombre, correo, cursoId? }  (asigna un lugar y le envía la invitación) → { ok }
//   empresa_cotizacion   { empresaId, cursoId, lugares (1-500), total (≥30), dias?, nota?, enviarCorreo? } (solo admin) → { liga, compraId, vence }
//   empresa_cotizacion_cancelar { compraId }  (solo admin; vence la liga en Mercado Pago) → { ok }
//   plan_liga            { planId, correoMP?, enviarCorreo? } (admin u operador de la empresa) → { liga, planId }
//   plan_cancelar        { planId }  (admin, su operador o el administrador de la empresa)    → { ok }
//   diaria               (solo con la llave de servicio: tarea programada)          → { regalos, recordatorios, membresias, planes }
//   (servicio) plan_pagado { planId, pagoId, monto, neto } — lo manda el webhook al aprobarse un cobro del plan
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
  if (String(pre.external_reference || "").startsWith("plan::")) return await aplicarPreapprovalPlan(pre);
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
  // Con lugar en el plan de su empresa, la inscripción queda como «empresa» (aparece en su reporte).
  const porPlan = !cid.startsWith("r-") && (await db("rpc/plan_empresa_cubre", { metodo: "POST", cuerpo: { p_usuario: u.id } })) === true;
  await db("inscripciones?on_conflict=usuario_id,curso_id", { metodo: "POST", prefer: "resolution=ignore-duplicates,return=minimal",
    cuerpo: { usuario_id: u.id, curso_id: cid, estatus: porPlan ? "empresa" : "membresia" } });
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

// ---------------------------------------------------------------- empresas
function pctVolumen(a: any, n: number) {
  if (n >= 25) return Number(a.emp_pct_25 ?? 35);
  if (n >= 10) return Number(a.emp_pct_10 ?? 25);
  return Number(a.emp_pct_5 ?? 15);
}
async function crearCompraEmpresa(u: any, b: any) {
  const cid = String(b.cursoId || "");
  const lugares = Math.floor(Number(b.lugares));
  const empresa = String(b.empresa || "").trim().slice(0, 160);
  if (!empresa) return json({ error: "Escribe el nombre de la empresa." }, 400);
  if (!(lugares >= 5 && lugares <= 50)) return json({ error: "Los paquetes son de 5 a 50 lugares. Para más, escríbenos." }, 400);
  const c = (await db(`cursos?id=eq.${encodeURIComponent(cid)}&select=id,nombre,precio,publicado`))[0];
  if (!c || c.publicado === false || !(Number(c.precio) > 0) || cid.startsWith("r-")) return json({ error: "Ese programa no está disponible para empresas." }, 409);
  const a = await ajustes();
  const pct = Math.min(90, Math.max(0, pctVolumen(a, lugares)));
  const unit = Math.round(Number(c.precio) * (100 - pct)) / 100;
  const total = Math.round(unit * lugares * 100) / 100;
  const compra = (await db("empresas_compras", { metodo: "POST", prefer: "return=representation", cuerpo: {
    comprador_id: u.id, empresa, rfc: String(b.rfc || "").trim().toUpperCase().slice(0, 13) || null,
    contacto_nombre: String(b.contactoNombre || u.nombre || "").slice(0, 120), contacto_correo: String(b.contactoCorreo || u.correo || "").slice(0, 160),
    contacto_tel: String(b.contactoTel || "").replace(/[^\d+]/g, "").slice(0, 20) || null,
    curso_id: cid, lugares, precio_unit: unit, pct, total } }))[0];
  const base = String(b.urlRegreso || AULA).replace(/[?#].*$/, "");
  const pref = await mp("/checkout/preferences", "POST", {
    items: [{ id: cid, title: `${lugares} lugares: ${c.nombre}`, quantity: 1, currency_id: "MXN", unit_price: total }],
    payer: { email: u.correo }, statement_descriptor: "INSTITUTO MARA",
    metadata: { tipo: "empresa", compra_id: compra.id, monto: total }, external_reference: `emp::${compra.id}`,
    back_urls: { success: `${base}?empresa=exito&id=${compra.id}`, pending: `${base}?empresa=pendiente&id=${compra.id}`, failure: `${base}?empresa=fallo&id=${compra.id}` },
    auto_return: "approved", notification_url: WEBHOOK,
  });
  return json({ init_point: pref.init_point, compraId: compra.id });
}
/* Cotización con monto negociado (solo administración): crea la compra «Esperando pago»
   y una liga de Mercado Pago con ese total. Al pagarse, el webhook la activa con
   activarCompraEmpresa, igual que una compra en línea. */
async function crearCotizacionEmpresa(u: any, b: any) {
  if (u.rol !== "admin") return json({ error: "Solo administración puede crear cotizaciones." }, 403);
  const emp = (await db(`empresas?id=eq.${encodeURIComponent(String(b.empresaId || ""))}&select=*`))[0];
  if (!emp) return json({ error: "Empresa no encontrada." }, 404);
  const cid = String(b.cursoId || "");
  const c = (await db(`cursos?id=eq.${encodeURIComponent(cid)}&select=id,nombre,precio`))[0];
  if (!c || cid.startsWith("r-")) return json({ error: "Ese programa no está disponible para cotizar." }, 404);
  const lugares = Math.floor(Number(b.lugares));
  if (!(lugares >= 1 && lugares <= 500)) return json({ error: "Los lugares van de 1 a 500." }, 400);
  const total = Math.round(Number(b.total) * 100) / 100;
  if (!(total >= 30)) return json({ error: "El total mínimo para cobrar con Mercado Pago es de $30." }, 400);
  const dias = Math.min(60, Math.max(1, Math.floor(Number(b.dias) || 15)));
  const vence = new Date(Date.now() + dias * 864e5);
  const lista = Number(c.precio) || 0;
  const unit = Math.round((total / lugares) * 100) / 100;
  const pct = lista > 0 ? Math.max(0, Math.round((100 - (unit * 100) / lista) * 10) / 10) : 0;
  const nota = String(b.nota || "").trim().slice(0, 200) || null;
  const compra = (await db("empresas_compras", { metodo: "POST", prefer: "return=representation", cuerpo: {
    comprador_id: u.id, empresa: emp.nombre, rfc: emp.rfc, contacto_nombre: emp.contacto_nombre, contacto_correo: emp.contacto_correo,
    contacto_tel: emp.contacto_tel, curso_id: cid, lugares, precio_unit: unit, pct, total, empresa_id: emp.id, medio: "cotizacion",
    nota, liga_vence: vence.toISOString() } }))[0];
  const pref = await mp("/checkout/preferences", "POST", {
    items: [{ id: cid, title: `${lugares} lugares: ${c.nombre}`, quantity: 1, currency_id: "MXN", unit_price: total }],
    statement_descriptor: "INSTITUTO MARA",
    metadata: { tipo: "empresa", compra_id: compra.id, monto: total }, external_reference: `emp::${compra.id}`,
    back_urls: { success: `${AULA}?empresa=exito&id=${compra.id}`, pending: `${AULA}?empresa=pendiente&id=${compra.id}`, failure: `${AULA}?empresa=fallo&id=${compra.id}` },
    auto_return: "approved", notification_url: WEBHOOK,
    expires: true, expiration_date_from: new Date(Date.now() - 60e3).toISOString(), expiration_date_to: vence.toISOString(),
  }).catch(async (x) => {
    await db(`empresas_compras?id=eq.${compra.id}`, { metodo: "DELETE", prefer: "return=minimal" }).catch(() => null);
    throw x;
  });
  await db(`empresas_compras?id=eq.${compra.id}`, { metodo: "PATCH", prefer: "return=minimal",
    cuerpo: { liga_pago: pref.init_point, mp_preferencia_id: pref.id } });
  let enviado = false;
  if (b.enviarCorreo && emp.contacto_correo) {
    enviado = await correo(emp.contacto_correo, emp.contacto_nombre || emp.nombre, `Cotización Instituto Mara: ${lugares} lugares de ${c.nombre}`,
      plantilla(`Hola${emp.contacto_nombre ? ", " + e(String(emp.contacto_nombre).split(" ")[0]) : ""}`,
        `<p style="font-size:16px;line-height:1.6">Como lo platicamos, esta es la cotización para <b>${e(emp.nombre)}</b>:</p>` +
        `<ul style="font-size:15px;line-height:1.7"><li>Programa: <b>${e(c.nombre)}</b></li><li>Lugares: <b>${lugares}</b> (${dinero(unit)} por persona)</li><li>Total: <b>${dinero(total)}</b></li></ul>` +
        `<p style="font-size:15px;line-height:1.6">Pueden pagar con tarjeta, transferencia u OXXO en Mercado Pago. Al confirmarse el pago les llega el acceso a su panel «Mi empresa» para asignar los lugares.</p>` +
        `<p style="font-size:13px;color:#6b6585">La liga vale hasta el ${fechaLarga(fecha(vence))}. ¿Necesitan factura? Envíen su constancia de situación fiscal y uso de CFDI a contacto@institutomara.com.</p>`,
        { texto: `Pagar ${dinero(total)}`, url: pref.init_point }));
  }
  return json({ ok: true, compraId: compra.id, liga: pref.init_point, vence: vence.toISOString(), total, unit, pct, enviado });
}
async function cancelarCotizacionEmpresa(u: any, b: any) {
  if (u.rol !== "admin") return json({ error: "Solo administración puede cancelar cotizaciones." }, 403);
  const c0 = (await db(`empresas_compras?id=eq.${encodeURIComponent(String(b.compraId || ""))}&select=*`))[0];
  if (!c0 || c0.medio !== "cotizacion") return json({ error: "Cotización no encontrada." }, 404);
  if (c0.estado !== "pendiente_pago") return json({ error: "Esa cotización ya no está esperando pago." }, 409);
  if (c0.mp_preferencia_id) {
    await mp(`/checkout/preferences/${c0.mp_preferencia_id}`, "PUT", { expires: true, expiration_date_to: new Date().toISOString() })
      .catch((x) => console.error("No se pudo vencer la liga", x));
  }
  await db(`empresas_compras?id=eq.${c0.id}&estado=eq.pendiente_pago`, { metodo: "PATCH", prefer: "return=minimal",
    cuerpo: { estado: "cancelado", liga_vence: new Date().toISOString() } });
  return json({ ok: true });
}

/* La llama el webhook (llave de servicio) cuando Mercado Pago aprueba el pago. */
async function activarCompraEmpresa(compraId: string, pagoId: string, monto: number) {
  const e0 = (await db(`empresas_compras?id=eq.${compraId}&select=*`))[0];
  if (!e0) return "compra no encontrada";
  if (e0.estado === "cancelado" && e0.mp_pago_id !== pagoId) {
    // Alguien pagó una cotización que ya se había cancelado: se registra para revisarlo a mano.
    await db("pagos", { metodo: "POST", prefer: "return=minimal", cuerpo: { usuario_id: e0.comprador_id, curso_id: e0.curso_id, monto,
      referencia_mp: pagoId, nota: `REVISAR empresa ${e0.empresa}: pagó ${monto} de una cotización cancelada. No se generaron lugares.` } }).catch(() => null);
    await db(`empresas_compras?id=eq.${e0.id}`, { metodo: "PATCH", prefer: "return=minimal", cuerpo: { mp_pago_id: pagoId } }).catch(() => null);
    return "cotización cancelada";
  }
  if (e0.estado !== "pendiente_pago") return "compra ya procesada";
  if (Math.abs(Number(monto) - Number(e0.total)) > 1) {
    await db("pagos", { metodo: "POST", prefer: "return=minimal", cuerpo: { usuario_id: e0.comprador_id, curso_id: e0.curso_id, monto,
      referencia_mp: pagoId, nota: `REVISAR empresa ${e0.empresa}: pagó ${monto} de ${e0.total}` } }).catch(() => null);
    return "monto distinto";
  }
  // Se «aparta» la compra primero para que un aviso repetido de Mercado Pago no genere códigos dos veces.
  const tomada = await db(`empresas_compras?id=eq.${e0.id}&estado=eq.pendiente_pago`, { metodo: "PATCH", prefer: "return=representation",
    cuerpo: { estado: "pagado", mp_pago_id: pagoId, pagado_en: new Date().toISOString() } });
  if (!tomada.length) return "compra ya procesada";
  const vence = fecha(new Date(Date.now() + 365 * 864e5));
  const filas: any[] = [], cups: any[] = [];
  for (let i = 0; i < e0.lugares; i++) {
    const cod = codigo("EMP");
    cups.push({ codigo: cod, descripcion: `Lugar de ${e0.empresa}`, tipo: "porcentaje", valor: 100, curso_id: e0.curso_id, usos_max: 1, vence });
    filas.push({ codigo: cod, compra_id: e0.id });
  }
  await db("cupones", { metodo: "POST", prefer: "return=minimal", cuerpo: cups });
  await db("empresas_codigos", { metodo: "POST", prefer: "return=minimal", cuerpo: filas });
  await db("pagos", { metodo: "POST", prefer: "return=minimal", cuerpo: { usuario_id: e0.comprador_id, curso_id: e0.curso_id, monto: Number(e0.total),
    referencia_mp: pagoId, nota: `Empresa: ${e0.empresa} · ${e0.lugares} lugares (${e0.pct}% de descuento)` } }).catch((x) => console.error(x));
  const c = (await db(`cursos?id=eq.${encodeURIComponent(e0.curso_id)}&select=nombre`))[0] || { nombre: e0.curso_id };
  const p = (await db(`perfiles?id=eq.${e0.comprador_id}&select=nombre,correo`))[0] || {};
  await correo(e0.contacto_correo || p.correo, e0.contacto_nombre || p.nombre, `✅ Tus ${e0.lugares} lugares de ${c.nombre} están listos`,
    plantilla("¡Gracias por confiar en Instituto Mara!",
      `<p style="font-size:16px;line-height:1.6">Confirmamos el pago de <b>${e0.lugares} lugares</b> de <b>${e(c.nombre)}</b> para <b>${e(e0.empresa)}</b> (${dinero(e0.total)}).</p>` +
      `<p style="font-size:15px;line-height:1.6">Desde tu panel puedes asignar cada lugar con el nombre y correo de la persona: le llega una invitación con su código. También puedes copiar el enlace o mandarlo por WhatsApp, y ver el avance de cada quien.</p>` +
      `<p style="font-size:13px;color:#6b6585">Los códigos valen 12 meses. ¿Necesitas factura? Envía tus datos fiscales (constancia de situación fiscal y uso de CFDI) a contacto@institutomara.com y te la enviamos.</p>`,
      { texto: "Abrir mi panel de empresa", url: `${AULA}?ir=empresas` }));
  return "ok";
}
async function invitarEmpresa(u: any, b: any) {
  const cod = String(b.codigo || "").trim().toUpperCase();
  const nombre = String(b.nombre || "").trim().slice(0, 120);
  const correoP = String(b.correo || "").trim().slice(0, 160);
  if (!nombre) return json({ error: "Escribe el nombre de la persona." }, 400);
  if (correoP && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correoP)) return json({ error: "Revisa el correo." }, 400);
  const k = (await db(`empresas_codigos?codigo=eq.${encodeURIComponent(cod)}&select=*,empresas_compras(*)`))[0];
  const comp = k && k.empresas_compras;
  let adminEmpresa = false;
  if (k && comp && comp.empresa_id && comp.comprador_id !== u.id && u.rol !== "admin") {
    // El administrador de la empresa o el operador que la atiende también reparten lugares.
    adminEmpresa = (await db(`empresas_admins?empresa_id=eq.${comp.empresa_id}&usuario_id=eq.${u.id}&select=id`)).length > 0
      || (await permisoPlan(u, comp.empresa_id)) === "operador";
  }
  if (!k || !comp || (comp.comprador_id !== u.id && u.rol !== "admin" && !adminEmpresa)) return json({ error: "Ese código no es de tu empresa." }, 404);
  if (k.usuario_id) return json({ error: "Ese lugar ya lo activó otra persona." }, 409);
  // Piloto con varios programas: la empresa puede fijar el curso de esta persona (o dejar que elija).
  const lista: string[] = Array.isArray(comp.cursos) && comp.cursos.length ? comp.cursos : [];
  const cup = (await db(`cupones?codigo=eq.${encodeURIComponent(cod)}&select=piloto,vence,dias_acceso`))[0] || {};
  let fijo: string | null = lista.length ? (k.curso_id || null) : comp.curso_id;
  if (lista.length && b.cursoId !== undefined) {
    const cid = b.cursoId ? String(b.cursoId) : null;
    if (cid && lista.indexOf(cid) < 0) return json({ error: "Ese programa no es parte del piloto." }, 400);
    fijo = cid;
    await db(`cupones?codigo=eq.${encodeURIComponent(cod)}`, { metodo: "PATCH", prefer: "return=minimal", cuerpo: { cursos: cid ? [cid] : lista } });
  }
  let enviado = false;
  if (correoP) {
    const ids = fijo ? [fijo] : lista;
    const cs = await db(`cursos?id=in.(${ids.map((x) => encodeURIComponent(x)).join(",")})&select=id,nombre`);
    const nom = (id: string) => (cs.find((x: any) => x.id === id) || { nombre: id }).nombre;
    const enlace = `${AULA}?cupon=${encodeURIComponent(cod)}` + (fijo ? `&curso=${encodeURIComponent(fijo)}` : "");
    const plazo = cup.piloto
      ? `<p style="font-size:15px;line-height:1.6">Es un lugar de prueba: actívalo antes del <b>${e(String(cup.vence || "").split("-").reverse().join("/"))}</b> y tendrás <b>${Number(cup.dias_acceso) || 15} días</b> de acceso desde que lo actives.</p>`
      : "";
    const cuerpoCursos = fijo
      ? `<p style="font-size:16px;line-height:1.6"><b>${e(comp.empresa)}</b> te dio un lugar en <b>${e(nom(fijo))}</b> de Instituto Mara: 100 % en línea y a tu ritmo.</p>`
      : `<p style="font-size:16px;line-height:1.6"><b>${e(comp.empresa)}</b> te dio un lugar en Instituto Mara, 100 % en línea y a tu ritmo. Elige uno de estos programas:</p><ul style="font-size:15px;line-height:1.6">${ids.map((x) => `<li>${e(nom(x))}</li>`).join("")}</ul>`;
    enviado = await correo(correoP, nombre, fijo ? `${comp.empresa} te inscribió en ${nom(fijo)}` : `${comp.empresa} te dio un lugar en Instituto Mara`,
      plantilla(`¡Hola, ${e(nombre.split(" ")[0])}!`,
        cuerpoCursos + plazo +
        `<p style="font-size:15px">Tu código personal: <b style="font-size:18px;letter-spacing:1px">${e(cod)}</b><br><small>Al abrir el enlace, crea tu cuenta o entra con la tuya y el lugar se activa solo.</small></p>`,
        { texto: "Empezar mi programa", url: enlace }));
  }
  await db(`empresas_codigos?codigo=eq.${encodeURIComponent(cod)}`, { metodo: "PATCH", prefer: "return=minimal",
    cuerpo: { asignado_nombre: nombre, asignado_correo: correoP || null, enviado_en: enviado ? new Date().toISOString() : k.enviado_en,
              ...(lista.length ? { curso_id: fijo } : {}) } });
  return json({ ok: true, enviado });
}

// ---------------------------------------------------------------- planes mensuales para empresas
/* ¿Puede esta persona manejar los planes de la empresa? admin, el operador que la atiende o (si se pide) su administrador. */
async function permisoPlan(u: any, empresaId: string, tambienEmpresa = false) {
  if (u.rol === "admin") return "admin";
  const e = (await db(`empresas?id=eq.${empresaId}&select=operador_id`))[0];
  if (e && e.operador_id) {
    const op = (await db(`operadores?id=eq.${e.operador_id}&usuario_id=eq.${u.id}&activo=eq.true&select=id`))[0];
    if (op) return "operador";
  }
  if (tambienEmpresa && (await db(`empresas_admins?empresa_id=eq.${empresaId}&usuario_id=eq.${u.id}&select=id`)).length) return "empresa";
  return null;
}
function textoPlan(p: any) {
  const desc = Number(p.descuento_pct) > 0
    ? (p.periodo === "mensual"
        ? `${dinero(p.monto_inicial)} al mes los primeros ${p.descuento_meses} meses (${Number(p.descuento_pct)} % de descuento) y después ${dinero(p.precio_lista)} al mes`
        : `${dinero(p.monto_inicial)} por 12 meses (${Number(p.descuento_pct)} % de descuento)`)
    : (p.periodo === "mensual" ? `${dinero(p.precio_lista)} al mes` : `${dinero(p.precio_lista)} por 12 meses`);
  return `Plan ${p.periodo} · ${p.rango_texto} · ${desc}, IVA incluido`;
}
async function crearLigaPlan(u: any, b: any) {
  const p = (await db(`empresas_planes?id=eq.${encodeURIComponent(String(b.planId || ""))}&select=*`))[0];
  if (!p) return json({ error: "Plan no encontrado." }, 404);
  if (!(await permisoPlan(u, p.empresa_id))) return json({ error: "No tienes acceso a esta empresa." }, 403);
  if (p.estado === "por_aprobar") return json({ error: "Este plan tiene un descuento que espera la aprobación de administración." }, 409);
  if (p.estado !== "pendiente_pago") return json({ error: "Este plan ya no está esperando pago." }, 409);
  const emp = (await db(`empresas?id=eq.${p.empresa_id}&select=*`))[0] || {};
  const correoMP = String(b.correoMP || p.admin_correo || emp.contacto_correo || "").trim().toLowerCase();
  const titulo = `Plan ${p.periodo} Instituto Mara — ${emp.nombre} (${p.rango_texto})`;
  let liga = "", cambios: any = {};
  if (p.periodo === "mensual") {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correoMP)) return json({ error: "Escribe el correo de la cuenta de Mercado Pago con la que pagará la empresa." }, 400);
    // Si ya había una suscripción sin pagar, se cancela para no dejar dos ligas vivas.
    if (p.mp_preapproval_id) await mp(`/preapproval/${p.mp_preapproval_id}`, "PUT", { status: "cancelled" }).catch(() => null);
    const pre = await mp("/preapproval", "POST", {
      reason: titulo, external_reference: `plan::${p.id}`, payer_email: correoMP,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: Number(p.monto_inicial), currency_id: "MXN" },
      back_url: `${AULA}?plan=exito`, status: "pending",
    });
    liga = pre.init_point;
    cambios = { mp_preapproval_id: pre.id, liga_pago: liga, liga_vence: null };
  } else {
    const vence = new Date(Date.now() + 15 * 864e5);
    const pref = await mp("/checkout/preferences", "POST", {
      items: [{ id: `plan-${p.id}`, title: titulo, quantity: 1, currency_id: "MXN", unit_price: Number(p.monto_inicial) }],
      statement_descriptor: "INSTITUTO MARA", external_reference: `plan::${p.id}`,
      metadata: { tipo: "plan", plan_id: p.id, monto: Number(p.monto_inicial) },
      back_urls: { success: `${AULA}?plan=exito`, pending: `${AULA}?plan=pendiente`, failure: `${AULA}?plan=fallo` },
      auto_return: "approved", notification_url: WEBHOOK,
      expires: true, expiration_date_from: new Date(Date.now() - 60e3).toISOString(), expiration_date_to: vence.toISOString(),
    });
    liga = pref.init_point;
    cambios = { mp_preferencia_id: pref.id, liga_pago: liga, liga_vence: vence.toISOString() };
  }
  await db(`empresas_planes?id=eq.${p.id}`, { metodo: "PATCH", prefer: "return=minimal", cuerpo: { ...cambios, actualizado_en: new Date().toISOString() } });
  let enviado = false;
  const para = String(b.enviarA || p.admin_correo || emp.contacto_correo || "").trim();
  if (b.enviarCorreo && para) {
    enviado = await correo(para, emp.contacto_nombre || emp.nombre, `Plan de capacitación para ${emp.nombre} · Instituto Mara`,
      plantilla(`Hola${emp.contacto_nombre ? ", " + e(String(emp.contacto_nombre).split(" ")[0]) : ""}`,
        `<p style="font-size:16px;line-height:1.6">Como lo platicamos, este es el plan para <b>${e(emp.nombre)}</b>: su equipo entra a <b>todo el catálogo</b> de cursos y diplomados por una cuota fija.</p>` +
        `<ul style="font-size:15px;line-height:1.7"><li>${e(p.rango_texto)}</li><li>${e(textoPlan(p).replace(/^Plan [a-z]+ · [^·]+ · /, ""))}</li>` +
        `<li>Constancia con folio y QR verificable al terminar cada programa</li><li>Panel «Mi empresa» con el avance de cada persona</li></ul>` +
        (p.periodo === "mensual"
          ? `<p style="font-size:15px;line-height:1.6">El cobro es automático cada mes con tarjeta en Mercado Pago, y pueden cancelarlo cuando quieran. Entren con la cuenta de Mercado Pago de <b>${e(correoMP)}</b>.</p>`
          : `<p style="font-size:15px;line-height:1.6">Es un solo pago por 12 meses. La liga vale hasta el ${fechaLarga(fecha(new Date(cambios.liga_vence)))}.</p>`) +
        `<p style="font-size:13px;color:#6b6585">¿Necesitan factura? Envíen su constancia de situación fiscal y uso de CFDI a contacto@institutomara.com.</p>`,
        { texto: p.periodo === "mensual" ? "Activar el plan" : "Pagar el plan", url: liga }));
  }
  return json({ ok: true, planId: p.id, liga, enviado, texto: textoPlan(p) });
}
async function cancelarPlan(u: any, b: any) {
  const p = (await db(`empresas_planes?id=eq.${encodeURIComponent(String(b.planId || ""))}&select=*`))[0];
  if (!p) return json({ error: "Plan no encontrado." }, 404);
  if (!(await permisoPlan(u, p.empresa_id, true))) return json({ error: "No tienes acceso a esta empresa." }, 403);
  if (p.mp_preapproval_id && ["activo", "pendiente_pago"].includes(p.estado)) {
    await mp(`/preapproval/${p.mp_preapproval_id}`, "PUT", { status: "cancelled" });
  }
  if (p.mp_preferencia_id && p.estado === "pendiente_pago") {
    await mp(`/checkout/preferences/${p.mp_preferencia_id}`, "PUT", { expires: true, expiration_date_to: new Date().toISOString() }).catch(() => null);
  }
  // Ya pagado: conserva el acceso hasta el fin del periodo. Sin pagar: se cierra.
  await db(`empresas_planes?id=eq.${p.id}&estado=in.(activo,pendiente_pago,por_aprobar)`, { metodo: "PATCH", prefer: "return=minimal",
    cuerpo: { estado: "cancelado", actualizado_en: new Date().toISOString(), ...(p.estado === "activo" ? {} : { liga_vence: new Date().toISOString() }) } });
  return json({ ok: true, vigenteHasta: p.estado === "activo" ? p.vigente_hasta : null });
}
async function aplicarPreapprovalPlan(pre: any) {
  const id = String(pre.external_reference).split("::")[1];
  const p = (await db(`empresas_planes?id=eq.${encodeURIComponent(id)}&select=*`))[0];
  if (!p) return null;
  if ((pre.status === "cancelled" || pre.status === "paused") && ["activo", "pendiente_pago"].includes(p.estado) && p.mp_preapproval_id === pre.id) {
    await db(`empresas_planes?id=eq.${p.id}`, { metodo: "PATCH", prefer: "return=minimal", cuerpo: { estado: "cancelado", actualizado_en: new Date().toISOString() } });
  }
  return true;
}
/* Cobro aprobado (lo manda el webhook). Registra el pago y la comisión en la base;
   al terminar los meses con descuento, sube la suscripción al precio de lista. */
async function planPagado(b: any) {
  const r = await db("rpc/plan_registrar_pago", { metodo: "POST", cuerpo: {
    p_plan: String(b.planId), p_pago: String(b.pagoId), p_monto: Number(b.monto), p_neto: b.neto == null ? null : Number(b.neto) } });
  if (!r || !r.ok) return r;
  if (r.subir_precio && r.preapproval) {
    await mp(`/preapproval/${r.preapproval}`, "PUT", { auto_recurring: { transaction_amount: Number(r.precio_lista), currency_id: "MXN" } })
      .catch((x) => console.error("No se pudo subir el precio de la suscripción", r.preapproval, x));
  }
  if (r.numero === 1) {
    const p = (await db(`empresas_planes?id=eq.${String(b.planId)}&select=*`))[0];
    const emp = p ? (await db(`empresas?id=eq.${p.empresa_id}&select=*`))[0] : null;
    const para = (p && p.admin_correo) || (emp && emp.contacto_correo);
    if (p && emp && para) {
      await correo(para, emp.contacto_nombre || emp.nombre, `✅ El plan de capacitación de ${emp.nombre} ya está activo`,
        plantilla("¡Bienvenidos a Instituto Mara!",
          `<p style="font-size:16px;line-height:1.6">Confirmamos el pago del plan de <b>${e(emp.nombre)}</b> (${e(p.rango_texto)}). Su equipo ya puede entrar a todo el catálogo.</p>` +
          `<p style="font-size:15px;line-height:1.6">Entra al aula con este correo (<b>${e(para)}</b>); si aún no tienes cuenta, créala con él. En el menú «Mi empresa» registras a cada persona con su nombre y correo, y ves su avance y sus constancias.</p>` +
          `<p style="font-size:13px;color:#6b6585">¿Necesitas factura? Envía tus datos fiscales a contacto@institutomara.com.</p>`,
          { texto: "Abrir «Mi empresa»", url: `${AULA}?ir=mi-empresa` }));
    }
  }
  return r;
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
  // Planes de empresa: revisar en Mercado Pago las suscripciones por vencer y cerrar las vencidas.
  let planes = 0;
  const pls = await db(`empresas_planes?mp_preapproval_id=not.is.null&estado=eq.activo&vigente_hasta=lte.${pronto}&select=mp_preapproval_id`).catch(() => []);
  for (const p of pls) { try { await aplicarPreapprovalPlan(await mp(`/preapproval/${p.mp_preapproval_id}`)); planes++; } catch (x) { console.error(x); } }
  await db(`empresas_planes?estado=in.(activo,cancelado)&vigente_hasta=lt.${new Date().toISOString()}`, { metodo: "PATCH", prefer: "return=minimal", cuerpo: { estado: "vencido" } }).catch(() => null);
  return json({ regalos, recordatorios, membresias, planes });
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
      if (b.accion === "empresa_pagada") return json({ resultado: await activarCompraEmpresa(String(b.compraId), String(b.pagoId), Number(b.monto)) });
      if (b.accion === "preapproval") { await aplicarPreapproval(await mp(`/preapproval/${b.id}`)); return json({ ok: true }); }
      if (b.accion === "plan_pagado") return json({ resultado: await planPagado(b) });
      return json({ error: "Acción no válida." }, 400);
    }
    switch (b.accion) {
      case "membresia": return await crearMembresia(u, b);
      case "cancelar_membresia": return await cancelarMembresia(u);
      case "sincronizar": return await sincronizar(u);
      case "inscribir_membresia": return await inscribirMembresia(u, b);
      case "regalo": return await crearRegalo(u, b);
      case "recompra": return await recompra(u, b);
      case "empresa": return await crearCompraEmpresa(u, b);
      case "empresa_invitar": return await invitarEmpresa(u, b);
      case "empresa_cotizacion": return await crearCotizacionEmpresa(u, b);
      case "empresa_cotizacion_cancelar": return await cancelarCotizacionEmpresa(u, b);
      case "plan_liga": return await crearLigaPlan(u, b);
      case "plan_cancelar": return await cancelarPlan(u, b);
      default: return json({ error: "Acción no válida." }, 400);
    }
  } catch (x) {
    console.error(x);
    return json({ error: String((x as Error).message || x) }, 500);
  }
});
