// Supabase Edge Function: campanas (2 nov 2026)
// Campañas por correo a prospectos (Administración → Prospectos → 📣 Campañas). Solo administración.
// Acciones (POST { accion, id?, ... }):
//   audiencia { id }       → { destinatarios, pendientes, yaEnviados, omitidos }
//   prueba    { id, para } → envía la campaña a un correo de prueba
//   enviar    { id }       → siguiente lote (≤ 40) a prospectos con correo que NO pidieron baja ni «No le interesó»
//   entregas  { dias? }    → eventos de Brevo: entregados, abiertos, rebotes, bloqueados, spam
//   reporte   { id }       → una fila por destinatario con su envío y lo que Brevo sabe (para descargar en Excel)
// Desde el 2 nov 2026 una campaña tiene «publico»: 'empresas' (prospectos) o 'alumnos' (Prospectos → Alumnos:
// cuentas del aula, kit clínico, CSV…). En alumnos, «filtro» limita a: kit, sin_cuenta, sin_compra, alumno,
// egresado o membresia. Se omite a quien no quiere promociones o marcaste «No le interesó». Admite {nombre}.
// La baja de alumnos es la página sitio-web/baja-kit.html?a=<token> (acción «baja_alumno» de la función «kit»).
// Usa los mismos secretos que «prospectos»: BREVO_API_KEY, CORREO_REMITENTE, NOMBRE_REMITENTE.
// El enlace de baja es el de la función «prospectos» (?baja=<token>), así la baja queda en el mismo lugar.
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const URL_SB = Deno.env.get("SUPABASE_URL") || "";
const LLAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BREVO = Deno.env.get("BREVO_API_KEY") || "";
const REMITENTE = Deno.env.get("CORREO_REMITENTE") || "";
const NOMBRE = Deno.env.get("NOMBRE_REMITENTE") || "Héctor Ezquerra · Instituto Mara";
const FIRMA = "Saludos cordiales,\n\nHéctor Ezquerra\nDirector Académico | Instituto Mara\ninstitutomara.com · WhatsApp 81 2028 2120";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const srv = { apikey: LLAVE, Authorization: `Bearer ${LLAVE}`, "Content-Type": "application/json" };
const e = (t: unknown) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const FIRMA_AL = "Saludos,\n\nHéctor Ezquerra\nDirector Académico | Instituto Mara\ninstitutomara.com · WhatsApp 81 2028 2120";
const FILTROS_AL = ["kit", "sin_cuenta", "sin_compra", "alumno", "egresado", "membresia"];

// Supabase entrega como máximo 1,000 filas por consulta aunque se pida más (10 nov 2026):
// las lecturas largas se piden por páginas para no perder envíos ni destinatarios.
async function db(ruta: string, op: { metodo?: string; cuerpo?: unknown; prefer?: string } = {}) {
  const m = /[?&]limit=(\d+)/.exec(ruta);
  if ((!op.metodo || op.metodo === "GET") && m && Number(m[1]) > 1000) {
    const max = Number(m[1]), base = ruta.replace(/([?&])limit=\d+&?/, "$1").replace(/[?&]$/, "");
    const sep = base.includes("?") ? "&" : "?";
    let filas: any[] = [], paso = 0;
    while (filas.length < max) {
      const pag: any[] = await db1(`${base}${sep}limit=${Math.min(1000, max - filas.length)}&offset=${filas.length}`);
      filas = filas.concat(pag);
      if (!paso) paso = pag.length;
      if (!pag.length || pag.length < paso) break;
    }
    return filas;
  }
  return await db1(ruta, op);
}
async function db1(ruta: string, op: { metodo?: string; cuerpo?: unknown; prefer?: string } = {}) {
  const h: Record<string, string> = { ...srv };
  if (op.prefer) h.Prefer = op.prefer;
  const r = await fetch(`${URL_SB}/rest/v1/${ruta}`, { method: op.metodo || "GET", headers: h, body: op.cuerpo ? JSON.stringify(op.cuerpo) : undefined });
  const t = await r.text();
  let d: any = null; try { d = t ? JSON.parse(t) : null; } catch (_x) { d = t; }
  if (!r.ok) throw new Error(`BD ${ruta.split("?")[0]}: ${typeof d === "string" ? d : (d && d.message) || r.status}`);
  return d;
}
let TOKEN_ADMIN = "";
async function admin(req: Request): Promise<string | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const r = await fetch(`${URL_SB}/auth/v1/user`, { headers: { apikey: LLAVE, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  TOKEN_ADMIN = token;
  const u = await r.json();
  const p = await db(`perfiles?id=eq.${u.id}&select=rol`);
  return p[0] && p[0].rol === "admin" ? u.id : null;
}
function aHtml(t: string) {
  const ST = "font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1F2937;margin:0 0 12px";
  let h = e(t).replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" style="color:#6D28D9">$1</a>');
  h = h.split("\n\n").map((p) => `<div style="${ST}">${p.replace(/\n/g, "<br>")}</div>`).join("");
  h = h.replace("Héctor Ezquerra<br>", "<b>Héctor Ezquerra</b><br>");
  h = h.replace(/<div style="([^"]*)">Si prefieren no recibir/, '<div style="$1;font-size:12px;color:#6B7280">Si prefieren no recibir');
  h = h.replace(/<div style="([^"]*)">Si ya no quieres recibir/, '<div style="$1;font-size:12px;color:#6B7280">Si ya no quieres recibir');
  return `<div style="max-width:640px">${h}</div>`;
}
const corto = (p: any) => String(p.nombre_corto || p.nombre || "").trim() || "su empresa";
function mensaje(c: any, p: any) {
  const n = corto(p);
  const asunto = String(c.asunto).replace(/\{empresa\}/g, n);
  const texto = String(c.texto).replace(/\{empresa\}/g, n).replace(/\*/g, "") + `\n\n${FIRMA}` +
    `\n\nSi prefieren no recibir más información, respondan «baja» o usen este enlace: ${URL_SB}/functions/v1/prospectos?baja=${p.token}`;
  return { asunto, texto, html: aHtml(texto) };
}
// ---------------------------------------------------------------- alumnos
const pila = (p: any) => { const n = String(p.nombre || "").trim().split(/\s+/)[0] || ""; return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : ""; };
function mensajeAlumno(c: any, p: any) {
  const n = pila(p);
  const pon = (t: string) => String(t).replace(/\{nombre\}/g, n || "").replace(/\s+([,:;.!?])/g, "$1").replace(/\*/g, "");
  const texto = pon(c.texto) + `\n\n${FIRMA_AL}` +
    `\n\nSi ya no quieres recibir promociones de Instituto Mara, usa este enlace: https://institutomara.com/sitio-web/baja-kit.html?a=${p.token}`;
  return { asunto: pon(c.asunto), texto, html: aHtml(texto) };
}
async function listaAlumnos(): Promise<any[]> {
  // La lista con etiquetas (alumnos_prospectos_lista) exige ser admin: se llama con la sesión de quien envía.
  const r = await fetch(`${URL_SB}/rest/v1/rpc/alumnos_prospectos_lista`, { method: "POST",
    headers: { apikey: LLAVE, Authorization: `Bearer ${TOKEN_ADMIN}`, "Content-Type": "application/json" }, body: "{}" });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Lista de alumnos: ${(d && d.message) || r.status}`);
  return d || [];
}
const pasaFiltro = (p: any, f: string | null) => !f ? true : f === "kit" ? !!(p.extra && p.extra.kit) : (p.etiquetas || []).indexOf(f) >= 0;
async function destinosAlumnos(c: any) {
  const L = (await listaAlumnos()).filter((p) => pasaFiltro(p, c.filtro));
  const todos = L.filter((p) => p.correo && CORREO.test(p.correo) && !p.sin_promociones && p.estado !== "no_interesa");
  const env: any[] = await db(`campana_alumno_envios?campana_id=eq.${c.id}&select=persona_id&order=persona_id&limit=20000`);
  const ya = new Set(env.map((x) => x.persona_id));
  return { universo: L.length, todos, pendientes: todos.filter((p) => !ya.has(p.id)), ya: ya.size };
}
async function tokenDe(id: string) { return ((await db(`alumnos_prospectos?id=eq.${id}&select=token`))[0] || {}).token; }

async function mandar(correos: string, m: { asunto: string; texto: string; html: string }, etiqueta: string, grupo = "prospectos"): Promise<string> {
  const destinos = String(correos || "").split(/[,;\s]+/).map((x) => x.trim()).filter((x) => CORREO.test(x));
  if (!destinos.length) throw new Error("sin correo válido");
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST", headers: { "api-key": BREVO, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { email: REMITENTE, name: NOMBRE }, replyTo: { email: REMITENTE, name: "Héctor Ezquerra" },
      to: destinos.map((d) => ({ email: d })), subject: m.asunto, htmlContent: m.html, textContent: m.texto,
      tags: [grupo, etiqueta], headers: { "List-Unsubscribe": `<mailto:${REMITENTE}?subject=baja>` } }),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const d = await r.json().catch(() => ({}));
  return String(d.messageId || "");
}
async function destinos(c: any) {
  const seg = c.segmento ? `&segmento=eq.${encodeURIComponent(c.segmento)}` : "";
  const todos: any[] = await db(`prospectos?estado=not.in.(baja,no_interesa)&correo=not.is.null&correo=neq.${seg}&select=id,nombre,nombre_corto,correo,token&order=id&limit=5000`);
  const env: any[] = await db(`campana_envios?campana_id=eq.${c.id}&select=prospecto_id&order=prospecto_id&limit=10000`);
  const ya = new Set(env.map((x) => x.prospecto_id));
  return { todos, pendientes: todos.filter((p) => !ya.has(p.id)), ya: ya.size };
}

async function eventosBrevo(etiqueta: string) {
  const ev: Record<string, Record<string, any>> = {};
  let offset = 0;
  for (let i = 0; i < 10; i++) {
    const r = await fetch(`https://api.brevo.com/v3/smtp/statistics/events?limit=2500&offset=${offset}&days=90&tags=${etiqueta}`, { headers: { "api-key": BREVO, accept: "application/json" } });
    if (!r.ok) break;
    const lista = ((await r.json()).events || []) as any[];
    for (const x of lista) { const k = String(x.email || "").toLowerCase(); (ev[k] = ev[k] || {})[x.event] = ev[k][x.event] || { fecha: x.date, motivo: x.reason || "" }; }
    if (lista.length < 2500) break; offset += 2500;
  }
  return ev;
}
const ORDEN_EV = [["spam", "Marcó como spam"], ["hardBounces", "Rebote definitivo (correo no existe)"], ["blocked", "Bloqueado"], ["invalid", "Correo inválido"],
  ["softBounces", "Rebote temporal"], ["unsubscribed", "Se dio de baja"], ["clicks", "Hizo clic"], ["opened", "Abrió"], ["delivered", "Entregado (sin abrir)"], ["deferred", "Retrasado"], ["requests", "Enviado"]];
function resumenEventos(ev: Record<string, Record<string, any>>, correo: string) {
  const e2: Record<string, any> = {};
  for (const m of String(correo || "").split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean)) Object.assign(e2, ev[m] || {});
  const top = ORDEN_EV.find(([k]) => e2[k]);
  return { top: top ? top[1] : "Sin datos de Brevo aún", motivo: (top && e2[top[0]].motivo) || "", entregado: !!(e2.delivered || e2.opened || e2.clicks), abrio: !!(e2.opened || e2.clicks), clic: !!e2.clicks };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const uid = await admin(req);
    if (!uid) return json({ error: "Solo administración puede usar las campañas." }, 403);
    if (!BREVO || !REMITENTE) return json({ error: "Falta BREVO_API_KEY o CORREO_REMITENTE en los secretos de Supabase." }, 500);
    const body = await req.json().catch(() => ({}));
    const accion = body.accion;

    if (accion === "entregas") {
      const dias = Math.min(90, Math.max(1, Number(body.dias) || 30));
      const grupo = body.publico === "alumnos" ? "alumnos" : "prospectos";
      const tipos: Record<string, number> = {}; const problemas: any[] = [];
      let offset = 0;
      for (let i = 0; i < 10; i++) {
        const r = await fetch(`https://api.brevo.com/v3/smtp/statistics/events?limit=2500&offset=${offset}&days=${dias}&tags=${grupo}`, { headers: { "api-key": BREVO, accept: "application/json" } });
        if (!r.ok) return json({ error: `Brevo ${r.status}: ${(await r.text()).slice(0, 160)}` }, 502);
        const ev = ((await r.json()).events || []) as any[];
        for (const x of ev) {
          tipos[x.event] = (tipos[x.event] || 0) + 1;
          if (["hardBounces", "softBounces", "blocked", "spam", "invalid", "error", "deferred", "unsubscribed"].includes(x.event) && problemas.length < 300)
            problemas.push({ correo: x.email, evento: x.event, fecha: x.date, motivo: String(x.reason || "").slice(0, 160), asunto: String(x.subject || "").slice(0, 120) });
        }
        if (ev.length < 2500) break; offset += 2500;
      }
      return json({ ok: true, dias, tipos, problemas });
    }

    const c = (await db(`campanas?id=eq.${encodeURIComponent(String(body.id || ""))}&select=*`))[0];
    if (!c) return json({ error: "No encontré esa campaña." }, 404);
    const etiqueta = "campana-" + String(c.id).slice(0, 8);

    if (c.publico === "alumnos") {
      if (c.filtro && FILTROS_AL.indexOf(c.filtro) < 0) return json({ error: "Filtro de público no válido." }, 400);
      if (accion === "audiencia") {
        const d = await destinosAlumnos(c);
        return json({ destinatarios: d.todos.length, pendientes: d.pendientes.length, yaEnviados: d.ya, omitidos: d.universo - d.todos.length });
      }
      if (accion === "prueba") {
        const para = String(body.para || "").trim();
        if (!CORREO.test(para)) return json({ error: "Escribe un correo de prueba válido." }, 400);
        const m = mensajeAlumno(c, { nombre: "Ana", token: "00000000-0000-0000-0000-000000000000" });
        await mandar(para, { ...m, asunto: "[PRUEBA] " + m.asunto }, etiqueta, "alumnos");
        return json({ ok: true });
      }
      if (accion === "enviar") {
        const d = await destinosAlumnos(c);
        const lote = d.pendientes.slice(0, 40);
        let enviados = 0; const fallas: string[] = [];
        if (c.estado === "borrador") await db(`campanas?id=eq.${c.id}`, { metodo: "PATCH", prefer: "return=minimal", cuerpo: { estado: "enviando" } });
        for (const p of lote) {
          try {
            const m = mensajeAlumno(c, { ...p, token: await tokenDe(p.id) });
            const mid = await mandar(p.correo, m, etiqueta, "alumnos");
            await db("campana_alumno_envios", { metodo: "POST", prefer: "return=minimal,resolution=ignore-duplicates",
              cuerpo: { campana_id: c.id, persona_id: p.id, correo: p.correo, resultado: "enviado", mensaje_id: mid } });
            await db("alumnos_contactos", { metodo: "POST", prefer: "return=minimal",
              cuerpo: { persona_id: p.id, canal: "correo", sentido: "saliente", asunto: m.asunto, resultado: "enviado", campana_id: c.id, automatico: false, creado_por: uid, resumen: "Campaña: " + c.nombre } }).catch(() => {});
            enviados++;
          } catch (x) {
            fallas.push(`${p.nombre || p.correo}: ${(x as Error).message}`);
            await db("campana_alumno_envios", { metodo: "POST", prefer: "return=minimal,resolution=ignore-duplicates",
              cuerpo: { campana_id: c.id, persona_id: p.id, correo: p.correo, resultado: "falla", detalle: (x as Error).message.slice(0, 200) } }).catch(() => {});
          }
        }
        const restantes = d.pendientes.length - lote.length;
        await db(`campanas?id=eq.${c.id}`, { metodo: "PATCH", prefer: "return=minimal",
          cuerpo: { enviados: Number(c.enviados || 0) + enviados, ...(restantes <= 0 ? { estado: "enviada", enviada_en: new Date().toISOString() } : {}) } });
        return json({ ok: true, enviados, fallas, restantes });
      }
      if (accion === "reporte") {
        const env: any[] = await db(`campana_alumno_envios?campana_id=eq.${c.id}&select=persona_id,correo,resultado,detalle,fecha&order=fecha,persona_id&limit=20000`);
        const porId = new Map((await listaAlumnos()).map((p: any) => [p.id, p]));
        const ev = await eventosBrevo(etiqueta);
        const filas = env.map((x) => {
          const p: any = porId.get(x.persona_id) || {};
          const r = resumenEventos(ev, x.correo);
          return { empresa: p.nombre || "", giro: (p.extra && p.extra.kit ? "Kit clínico · " : "") + (p.etiquetas || []).join(", "), correo: x.correo, telefono: p.telefono || "",
            envio: x.resultado, fecha: x.fecha, entrega: x.resultado === "falla" ? "No salió" : r.top, entregado: r.entregado, abrio: r.abrio, clic: r.clic,
            motivo: x.detalle || r.motivo, estadoProspecto: p.estado || "" };
        });
        return json({ ok: true, campana: { nombre: c.nombre, asunto: c.asunto, enviada_en: c.enviada_en, estado: c.estado, publico: "alumnos" }, filas });
      }
      return json({ error: "Acción desconocida." }, 400);
    }

    if (accion === "reporte") {
      const env: any[] = await db(`campana_envios?campana_id=eq.${c.id}&select=prospecto_id,correo,resultado,detalle,fecha&order=fecha,prospecto_id&limit=10000`);
      const ids = env.map((x) => x.prospecto_id);
      const pros: any[] = [];
      for (let i = 0; i < ids.length; i += 150) pros.push(...await db(`prospectos?id=in.(${ids.slice(i, i + 150).join(",")})&select=id,nombre,nombre_corto,segmento,telefono,estado`));
      const porId = new Map(pros.map((p) => [p.id, p]));
      // Eventos de Brevo de esta campaña (por su etiqueta), por correo.
      const ev: Record<string, Record<string, any>> = {};
      let offset = 0;
      for (let i = 0; i < 10; i++) {
        const r = await fetch(`https://api.brevo.com/v3/smtp/statistics/events?limit=2500&offset=${offset}&days=90&tags=${etiqueta}`, { headers: { "api-key": BREVO, accept: "application/json" } });
        if (!r.ok) break;
        const lista = ((await r.json()).events || []) as any[];
        for (const x of lista) {
          const k = String(x.email || "").toLowerCase();
          (ev[k] = ev[k] || {})[x.event] = ev[k][x.event] || { fecha: x.date, motivo: x.reason || "" };
        }
        if (lista.length < 2500) break; offset += 2500;
      }
      const ORDEN = [["spam", "Marcó como spam"], ["hardBounces", "Rebote definitivo (correo no existe)"], ["blocked", "Bloqueado"], ["invalid", "Correo inválido"],
        ["softBounces", "Rebote temporal"], ["unsubscribed", "Se dio de baja"], ["clicks", "Hizo clic"], ["opened", "Abrió"], ["delivered", "Entregado (sin abrir)"], ["deferred", "Retrasado"], ["requests", "Enviado"]];
      const filas = env.map((x) => {
        const p = porId.get(x.prospecto_id) || {};
        const correos = String(x.correo || "").split(/[,;\s]+/).map((m) => m.trim().toLowerCase()).filter(Boolean);
        const e2: Record<string, any> = {};
        for (const m of correos) Object.assign(e2, ev[m] || {});
        const top = ORDEN.find(([k]) => e2[k]);
        return { empresa: p.nombre || "", giro: p.segmento || "", correo: x.correo, telefono: p.telefono || "", envio: x.resultado, fecha: x.fecha,
          entrega: x.resultado === "falla" ? "No salió" : top ? top[1] : "Sin datos de Brevo aún", entregado: !!(e2.delivered || e2.opened || e2.clicks),
          abrio: !!(e2.opened || e2.clicks), clic: !!e2.clicks, motivo: x.detalle || (top && e2[top[0]].motivo) || "", estadoProspecto: p.estado || "" };
      });
      return json({ ok: true, campana: { nombre: c.nombre, asunto: c.asunto, enviada_en: c.enviada_en, estado: c.estado }, filas });
    }
    if (accion === "audiencia") {
      const d = await destinos(c);
      const total: any[] = await db(`prospectos?select=id${c.segmento ? "&segmento=eq." + encodeURIComponent(c.segmento) : ""}&order=id&limit=5000`);
      return json({ destinatarios: d.todos.length, pendientes: d.pendientes.length, yaEnviados: d.ya, omitidos: total.length - d.todos.length });
    }
    if (accion === "prueba") {
      const para = String(body.para || "").trim();
      if (!CORREO.test(para)) return json({ error: "Escribe un correo de prueba válido." }, 400);
      const m = mensaje(c, { nombre_corto: "Empresa de ejemplo", token: "00000000-0000-0000-0000-000000000000" });
      await mandar(para, { ...m, asunto: "[PRUEBA] " + m.asunto }, etiqueta);
      return json({ ok: true });
    }
    if (accion === "enviar") {
      const d = await destinos(c);
      const lote = d.pendientes.slice(0, 40);
      let enviados = 0; const fallas: string[] = [];
      if (c.estado === "borrador") await db(`campanas?id=eq.${c.id}`, { metodo: "PATCH", prefer: "return=minimal", cuerpo: { estado: "enviando" } });
      for (const p of lote) {
        try {
          const m = mensaje(c, p);
          const mid = await mandar(p.correo, m, etiqueta);
          await db("campana_envios", { metodo: "POST", prefer: "return=minimal,resolution=ignore-duplicates",
            cuerpo: { campana_id: c.id, prospecto_id: p.id, correo: p.correo, resultado: "enviado", mensaje_id: mid } });
          await db("prospecto_contactos", { metodo: "POST", prefer: "return=minimal",
            cuerpo: { prospecto_id: p.id, canal: "correo", sentido: "saliente", asunto: m.asunto, resultado: "enviado", automatico: false, creado_por: uid, resumen: "Campaña: " + c.nombre } }).catch(() => {});
          enviados++;
        } catch (x) {
          fallas.push(`${corto(p)}: ${(x as Error).message}`);
          await db("campana_envios", { metodo: "POST", prefer: "return=minimal,resolution=ignore-duplicates",
            cuerpo: { campana_id: c.id, prospecto_id: p.id, correo: p.correo, resultado: "falla", detalle: (x as Error).message.slice(0, 200) } }).catch(() => {});
        }
      }
      const restantes = d.pendientes.length - lote.length;
      await db(`campanas?id=eq.${c.id}`, { metodo: "PATCH", prefer: "return=minimal",
        cuerpo: { enviados: Number(c.enviados || 0) + enviados, ...(restantes <= 0 ? { estado: "enviada", enviada_en: new Date().toISOString() } : {}) } });
      return json({ ok: true, enviados, fallas, restantes });
    }
    return json({ error: "Acción desconocida." }, 400);
  } catch (err) {
    return json({ error: String((err as Error).message || err) }, 500);
  }
});
