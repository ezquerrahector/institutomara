// Supabase Edge Function: prospectos
// ----------------------------------------------------------------------------
// Campañas a empresas (Administración → Prospectos).
// Acciones (POST { accion, ... }):
//   correo    { para, asunto, texto } → envía un correo suelto por Brevo (solo admin)
//   mensajes  { id, toque? }   → { toque, asunto, texto, html, whatsapp }   (vista previa; solo admin)
//   enviar    { ids: [], toque? } → { enviados, fallas }  envía por Brevo y registra el contacto (solo admin)
//   diaria    (llave de servicio, tarea programada) → seguimientos automáticos si están encendidos en ajustes
// GET ?baja=<token> → página «ya no recibirás más correos» (enlace del pie de cada correo)
//
// Al publicarla, apaga «Verify JWT» (el enlace de baja se abre sin sesión);
// la función revisa por su cuenta que quien envía sea administrador.
// Secretos: BREVO_API_KEY, CORREO_REMITENTE (contacto@institutomara.com verificado en Brevo),
//           NOMBRE_REMITENTE (opcional). SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase.

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const URL_SB = Deno.env.get("SUPABASE_URL") || "";
const LLAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BREVO = Deno.env.get("BREVO_API_KEY") || "";
const REMITENTE = Deno.env.get("CORREO_REMITENTE") || "";
const NOMBRE = Deno.env.get("NOMBRE_REMITENTE") || "Héctor Ezquerra · Instituto Mara";
const AULA = "https://institutomara.com/plataforma/index.html";
const FIRMA_TEL = "81 2028 2120";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const srv = { apikey: LLAVE, Authorization: `Bearer ${LLAVE}`, "Content-Type": "application/json" };
const e = (t: unknown) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const pesos = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

async function db(ruta: string, op: { metodo?: string; cuerpo?: unknown; prefer?: string } = {}) {
  const h: Record<string, string> = { ...srv };
  if (op.prefer) h.Prefer = op.prefer;
  const r = await fetch(`${URL_SB}/rest/v1/${ruta}`, { method: op.metodo || "GET", headers: h, body: op.cuerpo ? JSON.stringify(op.cuerpo) : undefined });
  const t = await r.text();
  let d: any = null; try { d = t ? JSON.parse(t) : null; } catch (_x) { d = t; }
  if (!r.ok) throw new Error(`BD ${ruta.split("?")[0]}: ${typeof d === "string" ? d : (d && d.message) || r.status}`);
  return d;
}

async function quien(req: Request): Promise<{ id: string; servicio?: boolean } | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  if (token === LLAVE) return { id: "servicio", servicio: true };
  try {
    const pl = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (pl.role === "service_role") {
      const v = await fetch(`${URL_SB}/rest/v1/ajustes?select=id&limit=1`, { headers: { apikey: LLAVE, Authorization: `Bearer ${token}` } });
      if (v.ok) return { id: "servicio", servicio: true };
    }
  } catch (_x) { /* no es JWT */ }
  const r = await fetch(`${URL_SB}/auth/v1/user`, { headers: { apikey: LLAVE, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  const p = await db(`perfiles?id=eq.${u.id}&select=rol`);
  return p[0] && p[0].rol === "admin" ? { id: u.id } : null;
}

// ---------------------------------------------------------------- mensajes
type Prospecto = Record<string, any>;
type Curso = { id: string; nombre: string; precio: number; nivel: string };

function corto(p: Prospecto) {
  return String(p.nombre_corto || p.nombre || "").trim();
}
function programasDe(p: Prospecto, cat: Record<string, Curso>) {
  return (p.cursos_ids || []).map((id: string) => cat[id]).filter(Boolean) as Curso[];
}
function referencia(progs: Curso[]) {
  const dip = progs.filter((c) => c.nivel === "Diplomados" || c.id.startsWith("d-") || c.id.startsWith("diplomado")).map((c) => Number(c.precio));
  const cur = progs.filter((c) => !(c.nivel === "Diplomados" || c.id.startsWith("d-") || c.id.startsWith("diplomado"))).map((c) => Number(c.precio));
  const partes = [];
  if (cur.length) partes.push("cursos desde " + pesos(Math.min(...cur)));
  if (dip.length) partes.push("diplomados desde " + pesos(Math.min(...dip)));
  return partes.length ? "Precio de referencia por colaborador: " + partes.join(" y ") + "." : "";
}
function desdeMin(progs: Curso[]) {
  const v = progs.map((c) => Number(c.precio)).filter((n) => n > 0);
  return v.length ? pesos(Math.min(...v)) : "";
}
const VOL = "15 % de 5 a 9 personas, 25 % de 10 a 24 y 35 % de 25 a 50";
const FIRMA = `Saludos cordiales,\n\nHéctor Ezquerra\nDirector Académico | Instituto Mara\ninstitutomara.com · WhatsApp ${FIRMA_TEL}`;

function armar(p: Prospecto, toque: number, cat: Record<string, Curso>, giro: Record<string, string> | null, urlBaja: string) {
  const n = corto(p);
  const progs = programasDe(p, cat);
  const saludo = `Buen día, equipo de ${n}:`;
  const lista = progs.map((c) => "• " + c.nombre).join("\n");
  const top = progs.slice(0, 3).map((c) => c.nombre);
  const pie = `\n\nSi prefieren no recibir más información, respondan «baja» o usen este enlace: ${urlBaja}`;
  let asunto = "", texto = "", whatsapp = "";

  if (toque <= 1) {
    const tema = giro ? giro.tema : "capacitación";
    asunto = `${n}: capacitación en ${tema} para su equipo, con constancias y reporte de avance`;
    const gancho = p.gancho ? String(p.gancho).replace(/\.\s*$/, "") + "." : `Conocemos el trabajo de ${n} en León.`;
    const problema = giro ? giro.problema + " " : "";
    const muestra = progs[0] ? `${AULA}?muestra=${encodeURIComponent(progs[0].id)}` : AULA;
    const ref = referencia(progs);
    texto = `${saludo}\n\nLes escribo de Instituto Mara, escuela en línea de León. ${gancho} Por eso creemos que les puede interesar lo que ofrecemos a las empresas.\n\n` +
      `${problema}Con nuestra plataforma, cada colaborador estudia desde su celular y a su ritmo, y ustedes conservan el control desde un panel propio, «Mi empresa»:\n\n` +
      `• Asignan los cursos a cada persona.\n• Ven el avance de cada colaborador: lecciones vistas, módulos aprobados y último acceso.\n• Descargan las constancias con folio y código QR de verificación, junto con el reporte en Excel o PDF.\n\n` +
      (lista ? `Programas que recomendamos para su equipo:\n${lista}\n\n` : "") +
      `Prueba piloto sin costo: 5 lugares durante 15 días, para que su equipo conozca el contenido y ustedes prueben el panel. Los 5 lugares pueden tomar cualquiera de los programas recomendados. Las constancias se emiten al formalizar la inscripción.\n\n` +
      (ref ? `${ref} ` : "") + `Con 5 o más lugares aplica un descuento por volumen: ${VOL}.\n\n` +
      `Pueden probar una lección gratis aquí: ${muestra}\nSi prefieren que yo les muestre la plataforma, agendamos 20 minutos por Google Meet o Teams cuando ustedes gusten.\n\n` +
      `Para activar su piloto, basta con responder este correo con el nombre de la persona que lo coordinará.\n\n${FIRMA}${pie}`;
    whatsapp = waPrimero(p, n, progs, giro);
  } else if (toque === 2) {
    asunto = `${n}: ¿les activo la prueba sin costo para su equipo?`;
    const desde = desdeMin(progs);
    texto = `${saludo}\n\nLes escribí hace unos días sobre la capacitación para su equipo. Les resumo la propuesta en tres puntos:\n\n` +
      `• 5 lugares sin costo durante 15 días` + (top.length ? ` en cualquiera de estos programas: ${top.join(", ")}.` : ".") + `\n` +
      `• Un panel donde ustedes ven el avance de cada persona y descargan sus constancias.\n` +
      `• Si deciden continuar, ${desde ? "desde " + desde + " por colaborador, " : ""}con descuento por volumen.\n\n` +
      `Para activarlo solo necesito el nombre de la persona que lo coordinará. También puedo mostrarles la plataforma en 20 minutos por Google Meet o Teams.\n\n${FIRMA}${pie}`;
    const dos = progs.slice(0, 2).map((c) => negritas(cortoPrograma(c.nombre)));
    whatsapp = `Hola, buen día. Soy Héctor Ezquerra, de Instituto Mara. Hace unos días les escribí para regalarles *5 lugares por 15 días*` +
      (dos.length ? ` para que su equipo pruebe nuestros cursos de ${dos.join(" y ")}` : " para que su equipo pruebe nuestros cursos") +
      `.\n\nLa invitación sigue en pie, sin compromiso. ¿Con quién lo podría ver?`;
  } else {
    asunto = `${n}: ¿lo dejamos para más adelante?`;
    texto = `${saludo}\n\nNo quiero llenar su bandeja, así que este es mi último mensaje sobre el tema. Si la capacitación de su equipo no es prioridad en este momento, lo entiendo perfectamente.\n\n` +
      `Si más adelante les interesa, la prueba de 5 lugares sin costo sigue disponible: basta con responder este correo. Y si en la empresa hay otra persona que vea capacitación o Recursos Humanos, les agradeceré mucho que se lo reenvíen.\n\n${FIRMA}${pie}`;
    whatsapp = `Hola, buen día. Soy Héctor Ezquerra, de Instituto Mara. No quiero insistir de más: si la capacitación de su equipo no es prioridad ahorita, lo entiendo perfecto.\n\n` +
      `Los *5 lugares sin costo* quedan apartados para cuando les sirva; nada más me escriben por aquí. ¡Que tengan muy buena semana!`;
  }
  return { toque: Math.min(Math.max(toque, 1), 3), asunto, texto, html: aHtml(texto), whatsapp };
}

// Nombre corto de un programa para WhatsApp: «Diplomado NOM-035: Factores…» → «NOM-035».
// En WhatsApp, *texto* sale en negritas.
function negritas(t: string) { return `*${t}*`; }
function cortoPrograma(nombre: string) {
  return String(nombre).replace(/^Diplomado (en |de )?/i, "").split(":")[0].replace(/\s*\(.*?\)\s*/g, " ").trim();
}
// El gancho del correo, adaptado para seguir a «Le escribo porque…».
function ganchoWa(p: Prospecto, n: string) {
  const g = String(p.gancho || "").trim().replace(/\.\s*$/, "");
  if (!g) return `conozco el trabajo de ${n} aquí en León`;
  const auto = g.match(/^En sus reseñas, sus clientes destacan:\s*(.+)$/i);
  if (auto) return `vi que sus clientes destacan «${auto[1]}»`;
  const primera = g.split(" ")[0];
  const comunes = ["Sus", "Quienes", "Con", "Las", "Los", "En", "El", "La", "Para"];
  return comunes.indexOf(primera) >= 0 ? g.charAt(0).toLowerCase() + g.slice(1) : g;
}
function sinParar(seg: string) {
  const s = String(seg || "").toLowerCase();
  if (/calzado|curtidur|manufactura|industria/.test(s)) return "sin parar la producción";
  if (/hospital|clínica|hotel|seguridad|call center|residencia|funeraria|diagnóstico/.test(s)) return "sin descuidar los turnos";
  return "sin descuidar el trabajo";
}
function waPrimero(p: Prospecto, n: string, progs: Curso[], giro: Record<string, string> | null) {
  const dos = progs.slice(0, 2).map((c) => negritas(cortoPrograma(c.nombre)));
  return `Hola, buen día. Soy Héctor Ezquerra, de aquí de León. Dirijo la parte académica de Instituto Mara, una escuela en línea que capacita equipos de trabajo.\n\n` +
    `Le escribo porque ${ganchoWa(p, n)}, y creo que les podemos ayudar a que su equipo siga creciendo: que su gente se capacite desde el celular, ${sinParar(p.segmento)}.\n\n` +
    (dos.length ? `Para ${giro ? giro.giro_corto : "empresas como la suya"} lo que más nos piden es ${dos.join(" y ")}. ` : "") +
    `Ustedes ven en un panel quién va avanzando y descargan las constancias con QR.\n\n` +
    `¿Me permite regalarles *5 lugares por 15 días* para que su equipo lo pruebe, sin compromiso? ¿Con quién lo podría ver?`;
}

function aHtml(t: string) {
  const ST = "font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1F2937;margin:0 0 12px";
  let h = e(t).replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" style="color:#6D28D9">$1</a>')
    .replace("institutomara.com ·", '<a href="https://institutomara.com" style="color:#6D28D9">institutomara.com</a> ·');
  h = h.split("\n\n").map((p) => `<div style="${ST}">${p.replace(/\n/g, "<br>")}</div>`).join("");
  h = h.replace("Héctor Ezquerra<br>", "<b>Héctor Ezquerra</b><br>");
  // El pie de baja, más pequeño.
  h = h.replace(/<div style="([^"]*)">Si prefieren no recibir/, '<div style="$1;font-size:12px;color:#6B7280">Si prefieren no recibir');
  return `<div style="max-width:640px">${h}</div>`;
}

async function contexto() {
  const cursos: Curso[] = await db("cursos?select=id,nombre,precio,nivel&publicado=eq.true");
  const cat: Record<string, Curso> = {};
  cursos.forEach((c) => (cat[c.id] = c));
  const giros: Record<string, Record<string, string>> = {};
  (await db("prospecto_giros?select=*")).forEach((g: any) => (giros[g.segmento] = g));
  return { cat, giros };
}
async function historial(id: string) {
  return await db(`prospecto_contactos?select=canal,sentido,toque,fecha,resultado&prospecto_id=eq.${id}&order=fecha`);
}
function siguienteToque(h: any[], canal: string) {
  const t = h.filter((c) => c.sentido === "saliente" && c.canal === canal && c.resultado !== "rebotó").map((c) => Number(c.toque || 0));
  return (t.length ? Math.max(...t) : 0) + 1;
}
function urlBaja(req: Request, token: string) {
  return `${URL_SB}/functions/v1/prospectos?baja=${token}`;
}

async function mandar(p: Prospecto, m: { asunto: string; html: string; texto: string }) {
  const destinos = String(p.correo || "").split(/[,;\s]+/).map((x) => x.trim()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  if (!destinos.length) throw new Error("sin correo válido");
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: REMITENTE, name: NOMBRE },
      replyTo: { email: REMITENTE, name: "Héctor Ezquerra" },
      to: destinos.map((d) => ({ email: d })),
      // Copia oculta a nuestro buzón (Zoho) para tener cada correo que sale.
      ...(destinos.some((d) => d.toLowerCase() === REMITENTE.toLowerCase()) ? {} : { bcc: [{ email: REMITENTE }] }),
      subject: m.asunto, htmlContent: m.html, textContent: m.texto,
      tags: ["prospectos"],
    }),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${(await r.text()).slice(0, 160)}`);
}

async function enviarA(req: Request, p: Prospecto, toque: number | null, ctx: any, porQuien: string | null, automatico: boolean) {
  const h = await historial(p.id);
  const t = toque || siguienteToque(h, "correo");
  if (t > 3) throw new Error("ya recibió los 3 correos de la secuencia");
  const m = armar(p, t, ctx.cat, ctx.giros[p.segmento] || null, urlBaja(req, p.token));
  await mandar(p, m);
  await db("prospecto_contactos", {
    metodo: "POST", prefer: "return=minimal",
    cuerpo: { prospecto_id: p.id, canal: "correo", sentido: "saliente", toque: m.toque, asunto: m.asunto,
              resultado: "enviado", automatico, creado_por: porQuien },
  });
  return m.toque;
}

function paginaBaja(nombre: string | null) {
  const msg = nombre
    ? `Listo. <b>${e(nombre)}</b> ya no recibirá más correos de Instituto Mara.`
    : "Ese enlace ya no es válido, pero no te preocupes: no volverás a recibir correos de esta campaña.";
  return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Instituto Mara</title></head>
<body style="font-family:Arial,sans-serif;background:#F8F7FE;color:#1F2937;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px">
<div style="background:#fff;border:1px solid #E9E6F7;border-radius:14px;padding:28px;max-width:460px;text-align:center">
<div style="color:#6D28D9;font-weight:800;letter-spacing:2px;font-size:13px">INSTITUTO MARA</div>
<p style="font-size:17px;line-height:1.5">${msg}</p>
<p style="font-size:14px;color:#6B7280">Si fue un error, escríbenos a contacto@institutomara.com.</p></div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = new URL(req.url);
    const baja = url.searchParams.get("baja");
    if (req.method === "GET") {
      if (!baja || !/^[0-9a-f-]{36}$/i.test(baja)) return paginaBaja(null);
      const nom = await db("rpc/prospecto_baja", { metodo: "POST", cuerpo: { p_token: baja } });
      return paginaBaja(nom || null);
    }

    const u = await quien(req);
    if (!u) return json({ error: "Solo administración puede usar esta función." }, 403);
    const body = await req.json().catch(() => ({}));
    const accion = body.accion;
    const ctx = await contexto();

    if (accion === "mensajes") {
      const p = (await db(`prospectos?id=eq.${body.id}&select=*`))[0];
      if (!p) return json({ error: "No encontré ese prospecto." }, 404);
      const h = await historial(p.id);
      const tc = body.toque || siguienteToque(h, "correo"), tw = body.toqueWa || siguienteToque(h, "whatsapp");
      const mc = armar(p, tc, ctx.cat, ctx.giros[p.segmento] || null, urlBaja(req, p.token));
      const mw = armar(p, tw, ctx.cat, ctx.giros[p.segmento] || null, urlBaja(req, p.token));
      return json({ toque: mc.toque, asunto: mc.asunto, texto: mc.texto, html: mc.html, toqueWa: mw.toque, whatsapp: mw.whatsapp, listo: !!(BREVO && REMITENTE) });
    }

    if (!BREVO || !REMITENTE) {
      return json({ error: "Falta configurar el envío: agrega BREVO_API_KEY y CORREO_REMITENTE en Supabase → Edge Functions → Secrets." }, 500);
    }

    // Correo suelto desde Administración (por ejemplo, el acceso al panel de una empresa).
    if (accion === "correo") {
      if (u.servicio) return json({ error: "Solo administración." }, 403);
      const para = String(body.para || "").trim();
      const asunto = String(body.asunto || "").trim().slice(0, 200);
      const texto = String(body.texto || "").replace(/\*/g, "").trim().slice(0, 8000);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) return json({ error: "Revisa el correo del destinatario." }, 400);
      if (!asunto || !texto) return json({ error: "Falta el asunto o el mensaje." }, 400);
      await mandar({ correo: para }, { asunto, texto, html: aHtml(texto) });
      return json({ ok: true });
    }

    if (accion === "enviar") {
      const ids: string[] = Array.isArray(body.ids) ? body.ids.slice(0, 100) : [];
      if (!ids.length) return json({ error: "Elige al menos un prospecto." }, 400);
      const filas: Prospecto[] = await db(`prospectos?id=in.(${ids.join(",")})&select=*`);
      let enviados = 0; const fallas: string[] = [];
      for (const p of filas) {
        if (p.estado === "baja") { fallas.push(`${corto(p)}: pidió no recibir correos`); continue; }
        try { await enviarA(req, p, body.toque || null, ctx, u.servicio ? null : u.id, false); enviados++; }
        catch (x) { fallas.push(`${corto(p)}: ${(x as Error).message}`); }
        if (body.iniciarSecuencia) await db(`prospectos?id=eq.${p.id}`, { metodo: "PATCH", prefer: "return=minimal", cuerpo: { secuencia: true } });
      }
      return json({ ok: true, enviados, fallas });
    }

    if (accion === "diaria") {
      if (!u.servicio) return json({ error: "Solo la tarea programada." }, 403);
      const aj = (await db("ajustes?id=eq.true&select=prospectos_auto,prospectos_dia_2,prospectos_dia_3"))[0] || {};
      if (!aj.prospectos_auto) return json({ ok: true, apagado: true });
      const d2 = Number(aj.prospectos_dia_2 || 4), d3 = Number(aj.prospectos_dia_3 || 10);
      const filas: Prospecto[] = await db("prospectos?secuencia=eq.true&estado=eq.contactado&select=*&limit=200");
      let enviados = 0; const fallas: string[] = [];
      for (const p of filas) {
        if (!p.correo) continue;
        const h = await historial(p.id);
        const corr = h.filter((c: any) => c.sentido === "saliente" && c.canal === "correo" && c.resultado !== "rebotó");
        if (h.some((c: any) => c.sentido === "entrante")) continue;
        const ult = Math.max(0, ...corr.map((c: any) => Number(c.toque || 0)));
        const primero = corr.filter((c: any) => Number(c.toque) === 1)[0];
        if (!primero || ult >= 3) continue;
        const dias = (Date.now() - new Date(primero.fecha).getTime()) / 864e5;
        const toca = ult === 1 ? d2 : d3;
        if (dias < toca) continue;
        try { await enviarA(req, p, ult + 1, ctx, null, true); enviados++; }
        catch (x) { fallas.push(`${corto(p)}: ${(x as Error).message}`); }
      }
      return json({ ok: true, enviados, fallas });
    }

    return json({ error: "Acción desconocida." }, 400);
  } catch (err) {
    return json({ error: String((err as Error).message || err) }, 500);
  }
});
