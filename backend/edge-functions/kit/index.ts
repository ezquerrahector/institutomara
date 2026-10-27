// Supabase Edge Function: kit
// ----------------------------------------------------------------------------
// Kit gratis de formatos clínicos (campaña para psicólogos y estudiantes).
//   (pública) POST { accion:'registro', nombre, correo, whatsapp?, perfil?, utm?, web? } → { ok, descarga }
//             Guarda el registro y manda el correo 1 con la liga de descarga.
//   (pública) POST { accion:'baja', t } → { ok }   (la usa sitio-web/baja-kit.html, liga de cada correo)
//   (servicio) POST { accion:'secuencia' }  → manda los correos 2 a 5 que tocan (tarea diaria 10:05 a. m.)
//             Solo si ajustes.kit_secuencia = true. Se detiene si la persona se da de baja o ya compró.
//   (servicio o admin) POST { accion:'vista_previa' } → { correos: [{ asunto, html }] } (no envía nada)
// Secretos: BREVO_API_KEY, CORREO_REMITENTE, NOMBRE_REMITENTE (opcional). SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY los pone Supabase. Verify JWT apagado: el registro es público.

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const URL_SB = Deno.env.get("SUPABASE_URL") || "";
const LLAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BREVO = Deno.env.get("BREVO_API_KEY") || "";
const REMITENTE = Deno.env.get("CORREO_REMITENTE") || "";
const NOMBRE = Deno.env.get("NOMBRE_REMITENTE") || "Instituto Mara";
const AULA = "https://institutomara.com/plataforma/index.html";
const SITIO = "https://institutomara.com/sitio-web/index.html";
const PDF = "https://institutomara.com/sitio-web/recursos/kit-formatos-clinicos-instituto-mara.pdf";
const RECURSO = "kit-clinico";
const DIAS = [0, 0, 1, 3, 5, 7];         // DIAS[n] = días después del registro en que sale el correo n
const PROGRAMAS = ["d-tcc", "d-terapias-contextuales", "d-evaluacion-clinica", "c-pap", "c-ia-psicologos"];
const DESCRIPCION: Record<string, string> = {
  "d-tcc": "Fundamentos y técnicas, con registro de pensamientos y casos",
  "d-terapias-contextuales": "ACT, DBT y activación conductual",
  "d-evaluacion-clinica": "Entrevista, instrumentos y formulación de casos",
  "c-pap": "Cómo intervenir en una crisis y armar un plan de seguridad",
  "c-ia-psicologos": "Notas, materiales y administración, cuidando la confidencialidad",
};
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const srv = { apikey: LLAVE, Authorization: `Bearer ${LLAVE}`, "Content-Type": "application/json" };
const e = (t: unknown) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const dinero = (n: number) => "$" + Math.round(Number(n)).toLocaleString("es-MX");
const fechaLarga = (iso: string) => new Date(iso + "T12:00:00-06:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", timeZone: "America/Mexico_City" });

async function db(ruta: string, op: { metodo?: string; cuerpo?: unknown; prefer?: string } = {}) {
  const h: Record<string, string> = { ...srv };
  if (op.prefer) h.Prefer = op.prefer;
  const r = await fetch(`${URL_SB}/rest/v1/${ruta}`, { method: op.metodo || "GET", headers: h, body: op.cuerpo ? JSON.stringify(op.cuerpo) : undefined });
  const t = await r.text();
  let d: any = null; try { d = t ? JSON.parse(t) : null; } catch (_x) { d = t; }
  if (!r.ok) throw new Error(`BD ${ruta.split("?")[0]}: ${typeof d === "string" ? d : (d && d.message) || r.status}`);
  return d;
}

async function esServicioOAdmin(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  if (token === LLAVE) return true;
  try {
    const pl = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (pl.role === "service_role") {
      const v = await fetch(`${URL_SB}/rest/v1/ajustes?select=id&limit=1`, { headers: { apikey: LLAVE, Authorization: `Bearer ${token}` } });
      if (v.ok) return true;
    }
  } catch (_x) { /* no es JWT */ }
  const r = await fetch(`${URL_SB}/auth/v1/user`, { headers: { apikey: LLAVE, Authorization: `Bearer ${token}` } });
  if (!r.ok) return false;
  const u = await r.json();
  const p = await db(`perfiles?id=eq.${u.id}&select=rol`);
  return !!(p[0] && p[0].rol === "admin");
}

async function correo(para: string, nombrePara: string, asunto: string, html: string, bajaUrl: string) {
  if (!BREVO || !REMITENTE || !para) return false;
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST", headers: { "api-key": BREVO, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: REMITENTE, name: NOMBRE }, to: [{ email: para, name: nombrePara || para }],
      subject: asunto, htmlContent: html, tags: ["kit-clinico"],
      headers: { "List-Unsubscribe": `<${bajaUrl}>` },
    }),
  });
  if (!r.ok) console.error("Brevo", r.status, await r.text());
  return r.ok;
}

// ------------------------------------------------------------------ oferta
type Oferta = { codigo: string; pct: number; vence: string | null; especial: boolean; programas: { id: string; nombre: string; horas: number; precio: number; final: number }[] };
async function oferta(): Promise<Oferta | null> {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const cups = await db(`cupones?codigo=in.(KITCLINICO,BIENVENIDA30)&activo=eq.true&select=codigo,valor,tipo,vence,usos,usos_max`);
  const vale = (c: any) => c && c.tipo === "porcentaje" && (!c.vence || c.vence >= hoy) && (c.usos_max == null || c.usos < c.usos_max);
  const c = cups.find((x: any) => x.codigo === "KITCLINICO" && vale(x)) || cups.find((x: any) => x.codigo === "BIENVENIDA30" && vale(x));
  const cursos = await db(`cursos?id=in.(${PROGRAMAS.join(",")})&publicado=eq.true&select=id,nombre,horas,precio`);
  const orden = (a: any, b: any) => PROGRAMAS.indexOf(a.id) - PROGRAMAS.indexOf(b.id);
  const pct = c ? Number(c.valor) : 0;
  return {
    codigo: c ? c.codigo : "", pct, vence: c ? c.vence : null, especial: !!c && c.codigo === "KITCLINICO",
    programas: cursos.sort(orden).map((x: any) => ({ id: x.id, nombre: x.nombre, horas: Number(x.horas) || 0, precio: Number(x.precio), final: Math.round(Number(x.precio) * (100 - pct)) / 100 })),
  };
}

// ---------------------------------------------------------------- plantillas
const MOR = "#6D28D9", TINTA = "#2E1065", GRIS = "#6B7280";
const ligaAula = (q: string, n: number, o: Oferta | null) => `${AULA}?${q}${o && o.codigo ? `&cupon=${o.codigo}` : ""}&utm_source=correo&utm_medium=email&utm_campaign=kit-clinico&utm_content=c${n}`;
const p = (t: string) => `<p style="font-size:15.5px;line-height:1.65;margin:0 0 14px">${t}</p>`;
const boton = (texto: string, url: string) => `<p style="margin:22px 0"><a href="${url}" style="background:${MOR};color:#fff;padding:13px 24px;border-radius:999px;text-decoration:none;font-weight:bold;display:inline-block">${e(texto)}</a></p>`;
const lista = (items: string[]) => `<ul style="font-size:15.5px;line-height:1.6;padding-left:20px;margin:0 0 14px">${items.map((i) => `<li style="margin-bottom:8px">${i}</li>`).join("")}</ul>`;

function marco(cuerpo: string, bajaUrl: string) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#F8F7FE"><div style="font-family:Arial,Helvetica,sans-serif;max-width:580px;margin:auto;padding:18px 10px;color:#1F2937">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${MOR};border-radius:14px 14px 0 0"><tr><td style="padding:20px 26px;color:#fff;font-size:18px;font-weight:bold">Instituto Mara</td></tr></table>
  <div style="background:#fff;border:1px solid #E9E6F7;border-top:0;padding:26px;border-radius:0 0 14px 14px">${cuerpo}
  <p style="font-size:15.5px;line-height:1.6;margin:22px 0 0">Saludos,<br><b>Equipo académico de Instituto Mara</b></p></div>
  <p style="color:${GRIS};font-size:12px;line-height:1.5;text-align:center;margin:16px 10px">Recibes este correo porque descargaste el Kit de formatos clínicos en institutomara.com.<br>
  ¿Ya no quieres recibirlos? <a href="${bajaUrl}" style="color:${GRIS}">Darme de baja</a> · Instituto Mara · Educación en línea</p></div></body></html>`;
}

function tablaProgramas(o: Oferta, n: number) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:6px 0 16px">${o.programas.map((x) => `
    <tr><td style="padding:11px 0;border-bottom:1px solid #E9E6F7"><a href="${ligaAula(`curso=${x.id}`, n, o)}" style="color:${TINTA};font-weight:bold;text-decoration:none;font-size:15px">${e(x.nombre)}</a>
    <div style="color:${GRIS};font-size:13px">${x.horas} h · ${e(DESCRIPCION[x.id] || "")}</div></td>
    <td style="padding:11px 0 11px 10px;border-bottom:1px solid #E9E6F7;text-align:right;white-space:nowrap">${o.pct ? `<s style="color:${GRIS};font-size:13px">${dinero(x.precio)}</s><br>` : ""}<b style="color:${MOR};font-size:18px">${dinero(x.final)}</b></td></tr>`).join("")}</table>`;
}
function cajaOferta(o: Oferta | null) {
  if (!o || !o.codigo) return "";
  const txt = o.especial
    ? `Por descargar el kit tienes <b>${o.pct} % de descuento</b> en los programas clínicos con el cupón <b>${o.codigo}</b>${o.vence ? `, válido hasta el ${fechaLarga(o.vence)}` : ""}. Ya va aplicado en las ligas de este correo.`
    : `Tienes <b>${o.pct} % de descuento</b> en tu primer programa con el cupón <b>${o.codigo}</b>${o.vence ? `, válido hasta el ${fechaLarga(o.vence)}` : ""}. Ya va aplicado en las ligas de este correo.`;
  return `<div style="background:#EDE9FE;border-radius:12px;padding:14px 16px;font-size:15px;line-height:1.55;margin:18px 0">${txt}</div>`;
}

export function armarCorreo(n: number, nombre: string, o: Oferta | null, bajaUrl: string): { asunto: string; html: string } {
  const hola = p(`Hola, ${e(nombre.split(" ")[0] || nombre)}:`);
  const prog = (id: string) => (o && o.programas.find((x) => x.id === id)) || null;
  const precioDe = (id: string) => { const x = prog(id); return x ? (o && o.pct ? `<b>${dinero(x.final)}</b> en lugar de ${dinero(x.precio)}` : `<b>${dinero(x.precio)}</b>`) : ""; };
  let asunto = "", cuerpo = "";
  if (n === 1) {
    asunto = "Aquí está tu kit de formatos clínicos";
    cuerpo = hola + p("Gracias por descargar el <b>Kit de formatos clínicos</b> de Instituto Mara. Son 4 formatos editables que puedes usar desde hoy en tu consulta o en tus prácticas.") +
      boton("Descargar el kit (PDF)", PDF) +
      p("<b>Cuándo usar cada uno:</b>") +
      lista([
        "<b>Entrevista clínica inicial:</b> en la primera sesión. No te saltes la evaluación de riesgo, aunque el motivo de consulta parezca leve.",
        "<b>Consentimiento informado:</b> antes de iniciar el tratamiento. Léelo con tu paciente; no basta con pedirle que lo firme.",
        "<b>Registro de pensamientos:</b> como tarea entre sesiones, después de practicarlo juntos en consulta.",
        "<b>Plan de tratamiento:</b> al cerrar la evaluación. Revísalo con tu paciente cada 4 a 6 sesiones.",
      ]) +
      p("Los formatos son una base: adáptalos a tu enfoque, a tu institución y a la normativa que te aplique. En los próximos días te enviaremos algunas ideas prácticas para sacarles más provecho.") +
      cajaOferta(o);
  } else if (n === 2) {
    asunto = "3 errores comunes con el registro de pensamientos";
    cuerpo = hola + p("El registro de pensamientos es una de las herramientas más útiles de la terapia cognitivo-conductual, pero también una de las que más se abandonan. Casi siempre es por uno de estos tres errores:") +
      lista([
        "<b>Dejarlo de tarea sin practicarlo en sesión.</b> Llénenlo juntos con una situación reciente antes de pedirle que lo haga en casa. Si no sabe cómo, no lo hará.",
        "<b>Confundir emociones con pensamientos.</b> «Siento que nadie me valora» es un pensamiento; la emoción es tristeza, enojo o vergüenza. Separarlos es la mitad del trabajo.",
        "<b>Buscar un pensamiento positivo en vez de uno equilibrado.</b> La meta no es convencerse de que todo está bien, sino mirar la situación completa con la evidencia a favor y en contra.",
      ]) +
      p(`Si quieres dominar estas y otras técnicas, prueba gratis una lección del <b>Diplomado en Terapia Cognitivo-Conductual</b>. Es en línea, con casos y ejercicios interactivos.${prog("d-tcc") ? ` El diplomado completo (${prog("d-tcc")!.horas} h) te queda en ${precioDe("d-tcc")}.` : ""}`) +
      boton("Probar una lección gratis", ligaAula("muestra=d-tcc", n, o)) + cajaOferta(o);
  } else if (n === 3) {
    asunto = "¿Tu paciente sabe cuándo puedes romper la confidencialidad?";
    cuerpo = hola + p("Explicar los límites de la confidencialidad desde la primera sesión no debilita la alianza terapéutica: la fortalece. El paciente sabe a qué atenerse y confía más.") +
      p("Una forma sencilla de decirlo:") +
      `<div style="border-left:4px solid ${MOR};padding:6px 14px;margin:0 0 14px;font-size:15.5px;line-height:1.6;color:${TINTA}">«Todo lo que hablemos aquí se queda entre nosotros. Solo hay tres excepciones: si tu vida o la de alguien más corre un riesgo grave, si me entero de que un niño o una persona vulnerable está sufriendo maltrato, o si una autoridad me lo ordena. Si llegara a pasar, lo hablaría contigo primero siempre que sea posible.»</div>` +
      p("Y cuando la evaluación de riesgo sale positiva, lo que hagas en los siguientes minutos importa: un plan de seguridad por escrito, la red de apoyo enterada y los números de emergencia a la mano (911 y Línea de la Vida, 800 911 2000).") +
      p(`Para eso existe nuestro curso de <b>Primeros Auxilios Psicológicos</b>${prog("c-pap") ? ` (${prog("c-pap")!.horas} h, ${precioDe("c-pap")})` : ""}. Y si quieres profundizar en la entrevista y la formulación de casos, el <b>Diplomado en Evaluación Psicológica</b>${prog("d-evaluacion-clinica") ? ` te queda en ${precioDe("d-evaluacion-clinica")}` : ""}.`) +
      boton("Ver Primeros Auxilios Psicológicos", ligaAula("muestra=c-pap", n, o)) + cajaOferta(o);
  } else if (n === 4) {
    asunto = "Así se estudia en Instituto Mara";
    cuerpo = hola + p("Quizá te preguntas cómo son nuestros programas antes de inscribirte. Te lo contamos en corto:") +
      lista([
        "<b>100 % en línea y a tu ritmo.</b> Estudias desde el celular o la computadora, cuando tengas tiempo.",
        "<b>Práctico.</b> Cada lección tiene casos, ejercicios interactivos y plantillas listas para tu consulta.",
        "<b>Evaluación en cada módulo</b> para que compruebes lo que aprendiste.",
        "<b>Constancia con folio y código QR verificable</b> al terminar. Es una constancia de capacitación de Instituto Mara; no sustituye un título ni una cédula.",
        "<b>Pago único</b> con Mercado Pago y acceso inmediato.",
      ]) +
      (o ? p("<b>Los programas clínicos y su precio con tu descuento:</b>") + tablaProgramas(o, n) : "") +
      boton("Ver los programas", ligaAula("muestra=d-evaluacion-clinica", n, o)) + cajaOferta(o);
  } else {
    const vence = o && o.vence ? fechaLarga(o.vence) : "";
    asunto = o && o.codigo ? `Tu ${o.pct} % de descuento${vence ? ` vence el ${vence}` : " sigue disponible"}` : "¿Te sirvió el kit?";
    cuerpo = hola + p("Esperamos que los formatos del kit ya te estén sirviendo en consulta.") +
      (o && o.codigo
        ? p(`Te escribimos por última vez para recordarte tu descuento: <b>${o.pct} %</b> con el cupón <b>${o.codigo}</b>${vence ? `, válido hasta el ${vence}` : ""}. Con él, cualquier diplomado clínico te queda por menos de lo que cuesta un taller presencial de fin de semana.`) + tablaProgramas(o, n) +
          boton("Inscribirme con descuento", ligaAula("muestra=d-tcc", n, o))
        : boton("Ver los programas clínicos", `${SITIO}?utm_source=correo&utm_medium=email&utm_campaign=kit-clinico&utm_content=c5`)) +
      p("¿Tienes dudas sobre algún programa? Responde este correo y con gusto te ayudamos.");
  }
  return { asunto, html: marco(cuerpo, bajaUrl) };
}

// ------------------------------------------------------------------ acciones
const MX = (d: Date) => new Date(d.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
function siguienteFecha(creado: string, n: number) {
  // Día del registro (hora de México) + DIAS[n], a las 9:00 a. m. de México (15:00 UTC); la tarea corre a las 10:05.
  const base = MX(new Date(creado));
  const d = new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate() + DIAS[n], 15, 0, 0));
  return d.toISOString();
}
const bajaDe = (token: string) => `https://institutomara.com/sitio-web/baja-kit.html?t=${token}`;

async function registro(b: any) {
  if (b.web) return json({ ok: true, descarga: PDF });      // trampa para robots
  const nombre = String(b.nombre || "").trim().replace(/\s+/g, " ").slice(0, 80);
  const correoP = String(b.correo || "").trim().toLowerCase().slice(0, 120);
  const whatsapp = String(b.whatsapp || "").replace(/[^\d+]/g, "").slice(0, 16) || null;
  const perfil = ["psicologo", "estudiante", "otro"].includes(b.perfil) ? b.perfil : null;
  if (nombre.length < 2) return json({ error: "Escribe tu nombre." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correoP)) return json({ error: "Revisa tu correo electrónico." }, 400);
  if (whatsapp && whatsapp.replace(/\D/g, "").length < 10) return json({ error: "Revisa tu número de WhatsApp (10 dígitos)." }, 400);
  const utm: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"]) if (b.utm && b.utm[k]) utm[k] = String(b.utm[k]).slice(0, 120);

  const prev = (await db(`kit_registros?recurso=eq.${RECURSO}&correo=eq.${encodeURIComponent(correoP)}&select=*`))[0];
  let fila: any;
  if (prev) {
    // Ya se había registrado: actualiza datos y vuelve a mandar la liga (máximo una vez cada 10 minutos).
    const reciente = Date.now() - new Date(prev.actualizado_en).getTime() < 10 * 60e3;
    fila = (await db(`kit_registros?id=eq.${prev.id}`, { metodo: "PATCH", prefer: "return=representation", cuerpo: {
      nombre, whatsapp: whatsapp || prev.whatsapp, perfil: perfil || prev.perfil, baja: false, baja_en: null, actualizado_en: new Date().toISOString() } }))[0];
    if (!reciente) { const o = await oferta(); const c = armarCorreo(1, nombre, o, bajaDe(fila.token)); await correo(correoP, nombre, c.asunto, c.html, bajaDe(fila.token)); }
    return json({ ok: true, descarga: PDF, repetido: true });
  }
  fila = (await db("kit_registros", { metodo: "POST", prefer: "return=representation", cuerpo: { recurso: RECURSO, nombre, correo: correoP, whatsapp, perfil, utm } }))[0];
  const o = await oferta();
  const c = armarCorreo(1, nombre, o, bajaDe(fila.token));
  const ok = await correo(correoP, nombre, c.asunto, c.html, bajaDe(fila.token));
  await db(`kit_registros?id=eq.${fila.id}`, { metodo: "PATCH", prefer: "return=minimal", cuerpo: {
    paso: ok ? 1 : 0, siguiente_en: ok ? siguienteFecha(fila.creado_en, 2) : null, actualizado_en: new Date().toISOString() } });
  return json({ ok: true, descarga: PDF, enviado: ok });
}

async function yaCompro(correoP: string) {
  const p = await db(`perfiles?correo=eq.${encodeURIComponent(correoP)}&select=id`);
  if (!p[0]) return false;
  const i = await db(`inscripciones?usuario_id=eq.${p[0].id}&curso_id=in.(${PROGRAMAS.join(",")})&select=id&limit=1`);
  return i.length > 0;
}

async function secuencia() {
  const a = (await db("ajustes?id=eq.true&select=kit_secuencia"))[0];
  if (!a || !a.kit_secuencia) return json({ pausada: true });
  const pend = await db(`kit_registros?baja=eq.false&paso=gte.1&paso=lte.4&siguiente_en=lte.${new Date().toISOString()}&select=*&limit=200`);
  if (!pend.length) return json({ enviados: 0 });
  const o = await oferta();
  let enviados = 0, terminados = 0;
  for (const r of pend) {
    try {
      if (await yaCompro(r.correo)) {
        await db(`kit_registros?id=eq.${r.id}`, { metodo: "PATCH", prefer: "return=minimal", cuerpo: { paso: 5, siguiente_en: null, actualizado_en: new Date().toISOString() } });
        terminados++; continue;
      }
      const n = r.paso + 1;
      const c = armarCorreo(n, r.nombre, o, bajaDe(r.token));
      if (!(await correo(r.correo, r.nombre, c.asunto, c.html, bajaDe(r.token)))) continue;
      await db(`kit_registros?id=eq.${r.id}`, { metodo: "PATCH", prefer: "return=minimal", cuerpo: {
        paso: n, siguiente_en: n < 5 ? siguienteFecha(r.creado_en, n + 1) : null, actualizado_en: new Date().toISOString() } });
      enviados++;
    } catch (x) { console.error("secuencia", r.id, x); }
  }
  return json({ enviados, terminados });
}

function paginaBaja(ok: boolean) {
  const t = ok ? "Listo, ya no te enviaremos estos correos." : "No encontramos tu registro.";
  const s = ok ? "Si algún día quieres volver a recibirlos, solo descarga de nuevo el kit en institutomara.com." : "Es posible que la liga esté incompleta. Si quieres darte de baja, escríbenos a contacto@institutomara.com.";
  return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Instituto Mara</title></head>
  <body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#F8F7FE;color:#1F2937"><div style="max-width:520px;margin:60px auto;padding:30px 24px;background:#fff;border:1px solid #E9E6F7;border-radius:18px;text-align:center">
  <p style="color:#6D28D9;font-weight:bold;margin:0 0 10px">Instituto Mara</p><h1 style="font-size:22px;color:#2E1065">${t}</h1><p style="line-height:1.6;color:#6B7280">${s}</p>
  <p><a href="${SITIO}" style="color:#6D28D9;font-weight:bold">Ir a institutomara.com</a></p></div></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const u = new URL(req.url);
    if (req.method === "GET" || u.searchParams.get("baja")) {
      const t = (u.searchParams.get("baja") || "").replace(/[^a-f0-9]/g, "");
      if (!t) return paginaBaja(false);
      const r = await db(`kit_registros?token=eq.${t}`, { metodo: "PATCH", prefer: "return=representation", cuerpo: { baja: true, baja_en: new Date().toISOString(), siguiente_en: null } });
      return paginaBaja(r.length > 0);
    }
    const b = await req.json().catch(() => ({}));
    if (b.accion === "registro") return await registro(b);
    if (b.accion === "baja") {
      const t = String(b.t || "").replace(/[^a-f0-9]/g, "");
      if (!t) return json({ ok: false });
      const r = await db(`kit_registros?token=eq.${t}`, { metodo: "PATCH", prefer: "return=representation", cuerpo: { baja: true, baja_en: new Date().toISOString(), siguiente_en: null } });
      return json({ ok: r.length > 0 });
    }
    if (b.accion === "secuencia" || b.accion === "vista_previa") {
      if (!(await esServicioOAdmin(req))) return json({ error: "No autorizado." }, 403);
      if (b.accion === "secuencia") return await secuencia();
      const o = await oferta();
      return json({ correos: [1, 2, 3, 4, 5].map((n) => armarCorreo(n, String(b.nombre || "Ana Martínez"), o, bajaDe("vista-previa"))) });
    }
    return json({ error: "Acción no válida." }, 400);
  } catch (x) {
    console.error(x);
    return json({ error: "No pudimos completar el registro. Intenta de nuevo en un momento." }, 500);
  }
});
