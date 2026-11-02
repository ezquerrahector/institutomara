// Supabase Edge Function: prospectos
// ----------------------------------------------------------------------------
// Campañas a empresas (Administración → Prospectos).
// Acciones (POST { accion, ... }):
//   correo    { para, asunto, texto } → envía un correo suelto por Brevo (solo admin)
//   mensajes  { id, toque? }   → { toque, asunto, texto, html, whatsapp }   (vista previa; solo admin)
//   enviar    { ids: [], toque? } → { enviados, fallas }  envía por Brevo y registra el contacto (solo admin)
//   info      { id, para? } → plan de capacitación por correo, firmado por el operador (admin o el operador asignado);
//                       «para» guarda el correo del contacto si aún no lo tenía
//   solicitud { empresa, nombre, puesto?, correo, telefono, personas?, mensaje? } → «Quiero mi prueba sin costo» del sitio (sin cuenta)
//   diaria    (llave de servicio, tarea programada) → correos de información pendientes y seguimientos automáticos si están encendidos
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
const FIRMA = `Saludos cordiales,\n\nHéctor Ezquerra\nDirector Académico | Instituto Mara\ninstitutomara.com · WhatsApp ${FIRMA_TEL}`;

// Precios del plan (de la tabla «planes_rangos»): «$1,490 al mes para hasta 5 personas».
type Rango = { desde: number; hasta: number | null; precio_mensual: number };
function planDesde(ctx: any) {
  const r = (ctx.rangos as Rango[])[0];
  return r ? `${pesos(r.precio_mensual)} al mes para hasta ${r.hasta} personas` : "";
}
function mesesGratis(ctx: any) { return Math.max(0, 12 - Number(ctx.mesesAnual || 10)); }
function textoGratis(ctx: any) { const m = mesesGratis(ctx); return m ? `si pagan el año, ${m === 1 ? "1 mes es gratis" : m + " meses son gratis"}` : ""; }

// Enfoque aprobado el 26 oct 2026: «somos su área de capacitación, por fuera». Primero el problema,
// luego nuestro papel, cómo funciona, los dos regalos (plan escrito y prueba) y el precio al final.
function armar(p: Prospecto, toque: number, ctx: any, giro: Record<string, string> | null, urlBaja: string) {
  const cat: Record<string, Curso> = ctx.cat;
  const n = corto(p);
  const progs = programasDe(p, cat);
  const saludo = `Buen día, equipo de ${n}:`;
  const lista = progs.map((c) => "   • " + c.nombre).join("\n");
  const desde = planDesde(ctx);
  const total = totalProgramas(cat).replace(/ programas$/, " cursos y diplomados");
  const pie = `\n\nSi prefieren no recibir más información, respondan «baja» o usen este enlace: ${urlBaja}`;
  let asunto = "", texto = "", whatsapp = "";

  if (toque <= 1) {
    asunto = `${n}: un plan de capacitación para su equipo, armado y con seguimiento`;
    const gancho = p.gancho ? " " + String(p.gancho).replace(/\.\s*$/, "") + "." : "";
    const problema = giro ? giro.problema + " " : "";
    const muestra = progs[0] ? `${AULA}?muestra=${encodeURIComponent(progs[0].id)}` : AULA;
    const extras = transversalesDe(p, progs, cat).slice(0, 2);
    const gratis = textoGratis(ctx);
    texto = `${saludo}\n\nLes escribo de Instituto Mara, escuela de capacitación 100% en línea.${gancho}\n\n` +
      `${problema}En muchas empresas la capacitación se queda pendiente porque no hay quién arme el plan ni quién le dé seguimiento. ` +
      `Ese es el papel que queremos hacer con ustedes: ser su área de capacitación, por fuera.\n\n` +
      `Cómo funciona:\n` +
      `1. Armamos el plan. Con base en su giro definimos qué toma cada grupo de su personal.` +
      (lista ? ` Para ${n} empezaríamos con:\n${lista}` : "") +
      (extras.length ? `\n   También les pueden servir: ${extras.map((c) => cortoPrograma(c.nombre)).join(" y ")}.` : "") + `\n` +
      `2. Su gente estudia desde el celular, a su ritmo, ${sinParar(p.segmento)}. Lecciones cortas con ejercicios y evaluación.\n` +
      `3. Ustedes llevan el control desde su panel «Mi empresa»: quién empezó, cuánto lleva y quién terminó, recordatorios por WhatsApp con un clic y reporte en Excel o PDF.\n` +
      `4. Cada persona recibe su constancia con folio y QR verificable, que puede llevar el logo de ${n}.\n\n` +
      `Un solo plan para todo el equipo: entran a ${total}` + (desde ? `, desde ${desde}, IVA incluido${gratis ? "; " + gratis : ""}` : "") + `.\n\n` +
      `Para empezar les ofrezco dos cosas sin costo:\n` +
      `• El plan de capacitación para ${n}, por escrito, con un calendario sugerido.\n` +
      `• 15 días de prueba para 5 personas con todo el catálogo. Si continúan, cada quien conserva su avance.\n\n` +
      `Basta con responder este correo con el nombre de quien ve la capacitación y se lo envío. Si prefieren, se los muestro en 20 minutos por Google Meet o Teams. ` +
      `Y si quieren verlo por su cuenta, aquí hay una lección gratis: ${muestra}\n\n${FIRMA}${pie}`;
    whatsapp = waPrimero(p, n, progs, ctx);
  } else if (toque === 2) {
    asunto = `${n}: ¿a quién le envío su plan de capacitación?`;
    const tres = nombresCortos(p, progs, cat, 3);
    texto = `${saludo}\n\nLes escribí hace unos días. En corto, esto es lo que les propongo:\n\n` +
      `• Nos encargamos de la capacitación de su equipo: el plan, el contenido, las evaluaciones y las constancias.\n` +
      `• Ustedes solo revisan el avance en su panel y descargan el reporte.\n` +
      `• Empezamos sin costo: el plan por escrito y 15 días para 5 personas` + (tres ? `, con programas como ${tres}.` : ".") + `\n` +
      (desde ? `• Si continúan, desde ${desde}, IVA incluido, con todo el catálogo.\n` : "") +
      `\nSolo necesito el nombre de quien ve la capacitación o Recursos Humanos. También puedo mostrarles la plataforma en 20 minutos por Google Meet o Teams.\n\n${FIRMA}${pie}`;
    whatsapp = `Hola, buen día. Soy Héctor Ezquerra, de Instituto Mara. Hace unos días les ofrecí un *plan de capacitación sin costo* para su equipo` +
      (tres ? `, empezando con ${tres}` : "") + `.\n\n` +
      `Lo que más valoran las empresas: ya no tienen que perseguir a nadie. Ven quién avanza, le mandan un recordatorio con un clic, y las constancias pueden llevar el *logo de ${n}*.\n\n` +
      `El plan y los *15 días sin costo para 5 personas* siguen en pie. ¿Con quién lo podría ver?`;
  } else {
    asunto = `${n}: ¿lo dejamos para más adelante?`;
    texto = `${saludo}\n\nNo quiero llenar su bandeja, así que este es mi último mensaje sobre el tema. Si la capacitación de su equipo no es prioridad en este momento, lo entiendo perfectamente.\n\n` +
      `Cuando quieran ordenarla, el plan de capacitación sin costo y la prueba de 15 días para 5 personas siguen disponibles; basta con responder este correo. ` +
      `Y si en la empresa hay otra persona que vea capacitación o Recursos Humanos, les agradeceré mucho que se lo reenvíen.\n\n${FIRMA}${pie}`;
    whatsapp = `Hola, buen día. Soy Héctor Ezquerra, de Instituto Mara. No quiero insistir de más: si la capacitación no es prioridad ahorita, lo entiendo perfecto.\n\n` +
      `Cuando quieran ordenar la capacitación de su equipo, aquí estamos. El *plan sin costo* y los *15 días para 5 personas* quedan apartados; nada más me escriben por aquí. ¡Que tengan muy buena semana!`;
  }
  return { toque: Math.min(Math.max(toque, 1), 3), asunto, texto, html: aHtml(texto), whatsapp };
}

// Plan de capacitación que pidió la empresa (antes «correo de información»); lo firma el operador.
// Las etapas salen de los programas del giro en su orden, más los transversales; Liderazgo va a mandos.
function etapasPlan(p: Prospecto, cat: Record<string, Curso>) {
  const progs = programasDe(p, cat);
  const base = progs.concat(transversalesDe(p, progs, cat));
  const lider = base.filter((c) => c.id === "d-liderazgo")[0] || null;
  const resto = base.filter((c) => c.id !== "d-liderazgo");
  return { arranque: resto.slice(0, 2), segunda: resto.slice(2, 4), mandos: lider };
}
function armarInfo(p: Prospecto, ctx: any, op: { nombre: string; telefono: string | null }, urlBaja: string) {
  const cat: Record<string, Curso> = ctx.cat;
  const n = corto(p);
  const nombre = String(p.contacto_nombre || "").trim();
  const et = etapasPlan(p, cat);
  const primero = et.arranque[0] || et.mandos;
  const muestra = primero ? `${AULA}?muestra=${encodeURIComponent(primero.id)}` : AULA;
  const rangos = (ctx.rangos as Rango[]).filter((r) => r.hasta !== null && r.desde <= 100);
  const tabla = rangos.map((r, i) => `• ${i === 0 ? "Hasta " + r.hasta + " personas" : r.desde + " a " + r.hasta + " personas"}: ${pesos(r.precio_mensual)} al mes`).join("\n");
  const gratis = mesesGratis(ctx);
  const nombres = (cs: Curso[]) => cs.map((c) => c.nombre).join("; ");
  let cuando = "";
  if (p.proxima_llamada && new Date(p.proxima_llamada) > new Date()) {
    cuando = new Date(p.proxima_llamada).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Mexico_City" });
  }
  const etapas = (et.arranque.length ? `• Arranque (meses 1 y 2), para todo el personal: ${nombres(et.arranque)}\n` : "") +
    (et.segunda.length ? `• Segunda etapa (meses 3 y 4): ${nombres(et.segunda)}\n` : "") +
    (et.mandos ? `• Para supervisores y mandos: ${et.mandos.nombre}\n` : "");
  const asunto = `Plan de capacitación para ${n} · Instituto Mara`;
  const texto = `Hola${nombre ? ", " + nombre : ""}:\n\nComo quedamos, le comparto el plan de capacitación que proponemos para su equipo.\n\n` +
    `1. Qué proponemos\n${etapas}Además, todo el equipo tiene abierto el resto del catálogo: ${totalProgramas(cat).replace(/ programas$/, " cursos y diplomados")}.\n\n` +
    `2. Cómo lo llevamos nosotros\n` +
    `• Ustedes registran a su gente en su panel «Mi empresa».\n` +
    `• Cada persona estudia desde el celular; ustedes ven quién empezó, cuánto lleva y quién terminó, y le mandan un recordatorio con un clic.\n` +
    `• Cada quien recibe su constancia con folio y QR verificable, que puede llevar el logo de ${n}.\n` +
    `• Descargan el reporte en Excel o PDF cuando lo necesiten.\n\n` +
    `3. Inversión mensual, todo el catálogo, IVA incluido\n${tabla}\n• Más personas: con gusto le cotizo.\n` +
    (gratis ? `Si pagan el año completo, ${gratis === 1 ? "1 mes es gratis" : gratis + " meses son gratis"}.\n\n` : "\n") +
    `4. Siguiente paso\nPrueba sin costo: 5 personas durante 15 días. Respóndame con el nombre y correo de quien coordinará la prueba y la dejo lista hoy mismo.` +
    (cuando ? ` Le llamo el ${cuando} para resolver sus dudas.` : "") + `\n\n` +
    `Puede probar una lección aquí: ${muestra}\n\n` +
    `Saludos,\n\n${op.nombre}\nInstituto Mara${op.telefono ? " · " + op.telefono : ""}` +
    `\n\nSi prefieren no recibir más información, respondan «baja» o usen este enlace: ${urlBaja}`;
  return { asunto, texto, html: aHtml(texto).replace(`${e(op.nombre)}<br>`, `<b>${e(op.nombre)}</b><br>`) };
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
  if (!g) return `conozco el trabajo de ${n}`;
  const auto = g.match(/^En sus reseñas, sus clientes destacan:\s*(.+)$/i);
  if (auto) return `vi que sus clientes destacan «${auto[1]}»`;
  const primera = g.split(" ")[0];
  const comunes = ["Sus", "Quienes", "Con", "Las", "Los", "En", "El", "La", "Para"];
  return comunes.indexOf(primera) >= 0 ? g.charAt(0).toLowerCase() + g.slice(1) : g;
}
function sinParar(seg: string) {
  const s = String(seg || "").toLowerCase();
  if (/calzado|curtidur|manufactura|industria/.test(s)) return "sin parar la producción";
  if (/constructora|instalaciones/.test(s)) return "sin detener la obra";
  if (/hospital|clínica|hotel|seguridad|call center|residencia|funeraria|diagnóstico|restaurante|cafeter|panader|comedor|guarder/.test(s)) return "sin descuidar los turnos";
  return "sin descuidar el trabajo";
}
function waPrimero(p: Prospecto, n: string, progs: Curso[], ctx: any) {
  const cat: Record<string, Curso> = ctx.cat;
  const lista = listaWa(p, progs, cat).map((t) => "• " + t).join("\n");
  const desde = planDesde(ctx);
  return `Hola, buen día. Soy Héctor Ezquerra, director académico de Instituto Mara, escuela de capacitación 100% en línea.\n\n` +
    `Muchas empresas no tienen un plan de capacitación porque no hay quién lo arme ni le dé seguimiento. Nosotros hacemos ese papel: *somos el área de capacitación de su empresa, por fuera*.\n\n` +
    `• Armamos el plan para su equipo\n• Cada persona estudia desde su celular, ${sinParar(p.segmento)}\n• Usted ve el avance en un panel y cada quien recibe su constancia con folio y QR\n\n` +
    (lista ? `Para ${n} empezaríamos con:\n${lista}\n\n` : "") +
    (desde ? `Con un solo plan, desde *${desde}*, su equipo entra a ` : "Con un solo plan, su equipo entra a ") +
    `${totalProgramas(cat).replace(/ programas$/, " cursos y diplomados")}.\n\n` +
    `¿Me permite enviarles *sin costo* el plan de capacitación para ${n} y *15 días de prueba para 5 personas*? ¿A quién se lo mando?`;
}
// «NOM-035, Seguridad e Higiene y Calidad»: los primeros k programas (giro + transversales), sin negritas.
function nombresCortos(p: Prospecto, progs: Curso[], cat: Record<string, Curso>, k: number) {
  const t = progs.concat(transversalesDe(p, progs, cat)).slice(0, k).map((c) => cortoPrograma(c.nombre));
  return t.length > 1 ? t.slice(0, -1).join(", ") + " y " + t[t.length - 1] : t.join("");
}

// Programas que le sirven a cualquier empresa, en el orden que conviene según el giro.
const TRANSVERSALES: Record<string, string[]> = {
  planta: ["d-nom035", "d-seguridad-higiene", "d-calidad-lean", "c-excel-avanzado", "d-liderazgo"],
  clientes: ["c-atencion-ventas", "d-nom035", "c-excel-avanzado", "d-liderazgo"],
  oficina: ["c-excel-avanzado", "d-nom035", "c-atencion-ventas", "d-liderazgo"],
};
function transversalesDe(p: Prospecto, progs: Curso[], cat: Record<string, Curso>) {
  const s = String(p.segmento || "").toLowerCase();
  const tipo = /calzado|curtidur|manufactura|industria|seguridad privada|constructora|instalaciones|comedor/.test(s) ? "planta"
    : /concesionaria|hotel|asegura|seguros|boutique|call center|inmobiliaria|hospital|clínica|diagnóstico|funeraria|residencia|restaurante|cafeter|panader|gimnasio|viajes|veterinari|estética canina|guarder/.test(s) ? "clientes"
    : "oficina";
  const ya = new Set(progs.map((c) => c.id));
  return TRANSVERSALES[tipo].filter((id) => !ya.has(id) && cat[id]).map((id) => cat[id]);
}
// Lista para WhatsApp: hasta 4 programas del giro y al menos uno transversal; siempre 4 o 5 renglones.
function listaWa(p: Prospecto, progs: Curso[], cat: Record<string, Curso>) {
  const giro = progs.slice(0, 4);
  const extra = transversalesDe(p, giro, cat);
  const todos = giro.concat(extra.slice(0, Math.max(1, 5 - giro.length)));
  return todos.slice(0, 5).map((c) => negritas(cortoPrograma(c.nombre)));
}
// «más de 110 programas», calculado con lo publicado (sin contar rutas).
function totalProgramas(cat: Record<string, Curso>) {
  const n = Object.keys(cat).filter((id) => !id.startsWith("r-")).length;
  return n > 20 ? `más de ${Math.floor((n - 1) / 10) * 10} programas` : "más programas";
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
  const rangos = await db("planes_rangos?select=desde,hasta,precio_mensual&activo=eq.true&order=desde").catch(() => []);
  const aj = (await db("ajustes?id=eq.true&select=plan_meses_anual").catch(() => []))[0] || {};
  return { cat, giros, rangos, mesesAnual: aj.plan_meses_anual || 10 };
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

async function mandar(p: Prospecto, m: { asunto: string; html: string; texto: string }, como?: { nombre: string; responder: { email: string; name: string } }) {
  const destinos = String(p.correo || "").split(/[,;\s]+/).map((x) => x.trim()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  if (!destinos.length) throw new Error("sin correo válido");
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: REMITENTE, name: como ? como.nombre : NOMBRE },
      replyTo: como ? como.responder : { email: REMITENTE, name: "Héctor Ezquerra" },
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
  const m = armar(p, t, ctx, ctx.giros[p.segmento] || null, urlBaja(req, p.token));
  await mandar(p, m);
  await db("prospecto_contactos", {
    metodo: "POST", prefer: "return=minimal",
    cuerpo: { prospecto_id: p.id, canal: "correo", sentido: "saliente", toque: m.toque, asunto: m.asunto,
              resultado: "enviado", automatico, creado_por: porQuien },
  });
  return m.toque;
}


// ¿Quién llama? (administración, operador o nadie). Para «info».
async function usuario(req: Request): Promise<{ id: string; servicio?: boolean; rol?: string } | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  if (token === LLAVE) return { id: "servicio", servicio: true };
  const r = await fetch(`${URL_SB}/auth/v1/user`, { headers: { apikey: LLAVE, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  const p = await db(`perfiles?id=eq.${u.id}&select=rol`);
  return { id: u.id, rol: p[0] && p[0].rol };
}
async function admins() { return await db("perfiles?rol=eq.admin&select=correo,nombre"); }

// Correo de información a un prospecto (lo firma su operador). Marca que ya se envió.
async function enviarInfo(req: Request, p: Prospecto, ctx: any, porQuien: string | null) {
  const para = String(p.contacto_correo || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) throw new Error("no tiene el correo del contacto");
  let op: any = p.asignado_a ? (await db(`operadores?id=eq.${p.asignado_a}&select=nombre,telefono,correo`))[0] : null;
  if (!op) op = { nombre: "Héctor Ezquerra", telefono: FIRMA_TEL, correo: REMITENTE };
  const m = armarInfo(p, ctx, op, urlBaja(req, p.token));
  await mandar({ correo: para }, m, { nombre: `${op.nombre} · Instituto Mara`, responder: { email: op.correo || REMITENTE, name: op.nombre } });
  await db("prospecto_contactos", { metodo: "POST", prefer: "return=minimal",
    cuerpo: { prospecto_id: p.id, canal: "correo", sentido: "saliente", asunto: m.asunto, resultado: "enviado", automatico: !porQuien, creado_por: porQuien } });
  const ex = { ...(p.extra || {}) }; delete ex.info_pendiente; ex.info_enviada = new Date().toISOString();
  await db(`prospectos?id=eq.${p.id}`, { metodo: "PATCH", prefer: "return=minimal", cuerpo: { extra: ex } });
  return m.asunto;
}

// «Quiero mi prueba sin costo» desde el sitio (sin cuenta).
async function solicitud(b: any) {
  if (String(b.web || "")) return json({ ok: true });            // campo trampa para robots
  const r = await db("rpc/prospecto_solicitud", { metodo: "POST", cuerpo: {
    p_empresa: String(b.empresa || "").slice(0, 160), p_nombre: String(b.nombre || "").slice(0, 120), p_puesto: String(b.puesto || "").slice(0, 80) || null,
    p_correo: String(b.correo || "").slice(0, 160), p_telefono: String(b.telefono || "").slice(0, 30),
    p_personas: Number(b.personas) > 0 ? Math.min(100000, Math.floor(Number(b.personas))) : null, p_mensaje: String(b.mensaje || "").slice(0, 600) || null } });
  if (!r || !r.ok || r.repetida) return json({ ok: true });
  const p = (await db(`prospectos?id=eq.${r.id}&select=*`))[0];
  const op = r.operador_id ? (await db(`operadores?id=eq.${r.operador_id}&select=nombre,correo`))[0] : null;
  const datos = `<p style="font-size:15px;line-height:1.7"><b>${e(p.nombre)}</b><br>${e(p.contacto_nombre)}${p.contacto_puesto ? " · " + e(p.contacto_puesto) : ""}<br>` +
    `${e(p.contacto_correo)} · ${e(p.telefono)}${p.extra && p.extra.personas ? "<br>" + e(p.extra.personas) + " personas" : ""}</p>` +
    (p.extra && p.extra.mensaje ? `<blockquote style="border-left:4px solid #6D28D9;margin:0;padding:8px 14px;background:#f6f3ff">${e(p.extra.mensaje)}</blockquote>` : "");
  const caja = (t: string, cuerpo: string) => `<div style="font-family:Arial,sans-serif;max-width:560px;color:#1f1640"><h2 style="margin:0 0 12px">${t}</h2>${cuerpo}` +
    `<p style="margin:22px 0"><a href="${AULA}?ir=llamadas" style="background:#6D28D9;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Abrir la consola</a></p></div>`;
  const correo = async (para: string, nom: string, asunto: string, html: string) => {
    if (!BREVO || !REMITENTE || !para) return;
    await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": BREVO, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { email: REMITENTE, name: "Instituto Mara" }, to: [{ email: para, name: nom || para }], subject: asunto, htmlContent: html }) }).catch(() => null);
  };
  if (op && op.correo) await correo(op.correo, op.nombre, `🔥 ${p.nombre} pidió su prueba sin costo: llámale hoy`,
    caja("Pidió la prueba desde el sitio", `<p style="font-size:15px">Está hasta arriba de tu consola, en «Toca hoy». Entre más rápido llames, mejor.</p>` + datos));
  for (const a of await admins()) await correo(a.correo, a.nombre, `🔥 Solicitud de prueba: ${p.nombre}${op ? " (para " + op.nombre + ")" : " (sin asignar)"}`,
    caja("Nueva solicitud de prueba", `<p style="font-size:15px">${op ? `Se asignó a <b>${e(op.nombre)}</b> y ya le avisamos.` : "No hay operadores activos: quedó sin asignar en Prospectos."}</p>` + datos));
  return json({ ok: true });
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

    const body = await req.json().catch(() => ({}));
    const accion = body.accion;
    if (accion === "solicitud") return await solicitud(body);

    // Correo de información que pidió la empresa en la llamada (administración o su operador).
    if (accion === "info") {
      const yo = await usuario(req);
      if (!yo) return json({ error: "Inicia sesión." }, 401);
      const p = (await db(`prospectos?id=eq.${encodeURIComponent(String(body.id || ""))}&select=*`))[0];
      if (!p) return json({ error: "No encontré ese prospecto." }, 404);
      if (!yo.servicio && yo.rol !== "admin") {
        const op = (await db(`operadores?usuario_id=eq.${yo.id}&activo=eq.true&select=id`))[0];
        if (!op || op.id !== p.asignado_a) return json({ error: "Ese prospecto no está asignado a ti." }, 403);
      }
      if (["baja", "no_interesa"].indexOf(p.estado) >= 0) return json({ error: "Ese prospecto pidió no recibir correos." }, 409);
      if (!BREVO || !REMITENTE) return json({ error: "Falta configurar el envío de correos." }, 500);
      // Desde la ficha se puede mandar el plan aunque la llamada no lo haya pedido; si traen correo nuevo, se guarda.
      const para = String(body.para || "").trim();
      if (para) {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) return json({ error: "Ese correo no parece válido." }, 400);
        if (para !== p.contacto_correo) {
          await db(`prospectos?id=eq.${p.id}`, { metodo: "PATCH", prefer: "return=minimal", cuerpo: { contacto_correo: para } });
          p.contacto_correo = para;
        }
      }
      if (!p.contacto_correo) return json({ error: "Falta el correo de la persona a quien va el plan." }, 400);
      const asunto = await enviarInfo(req, p, await contexto(), yo.servicio ? null : yo.id);
      return json({ ok: true, asunto });
    }

    const u = await quien(req);
    if (!u) return json({ error: "Solo administración puede usar esta función." }, 403);
    const ctx = await contexto();

    if (accion === "mensajes") {
      const p = (await db(`prospectos?id=eq.${body.id}&select=*`))[0];
      if (!p) return json({ error: "No encontré ese prospecto." }, 404);
      const h = await historial(p.id);
      const tc = body.toque || siguienteToque(h, "correo"), tw = body.toqueWa || siguienteToque(h, "whatsapp");
      const mc = armar(p, tc, ctx, ctx.giros[p.segmento] || null, urlBaja(req, p.token));
      const mw = armar(p, tw, ctx, ctx.giros[p.segmento] || null, urlBaja(req, p.token));
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
        if (p.estado === "no_interesa") { fallas.push(`${corto(p)}: marcado «No le interesó»`); continue; }
        try { await enviarA(req, p, body.toque || null, ctx, u.servicio ? null : u.id, false); enviados++; }
        catch (x) { fallas.push(`${corto(p)}: ${(x as Error).message}`); }
        if (body.iniciarSecuencia) await db(`prospectos?id=eq.${p.id}`, { metodo: "PATCH", prefer: "return=minimal", cuerpo: { secuencia: true } });
      }
      return json({ ok: true, enviados, fallas });
    }

    if (accion === "diaria") {
      if (!u.servicio) return json({ error: "Solo la tarea programada." }, 403);
      let info = 0;
      const pend: Prospecto[] = await db("prospectos?extra->>info_pendiente=eq.true&estado=not.in.(baja,no_interesa)&select=*&limit=100").catch(() => []);
      for (const p of pend) { try { await enviarInfo(req, p, ctx, null); info++; } catch (x) { console.error("info", p.id, (x as Error).message); } }
      const aj = (await db("ajustes?id=eq.true&select=prospectos_auto,prospectos_dia_2,prospectos_dia_3"))[0] || {};
      if (!aj.prospectos_auto) return json({ ok: true, apagado: true, info });
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
      return json({ ok: true, enviados, fallas, info });
    }

    return json({ error: "Acción desconocida." }, 400);
  } catch (err) {
    return json({ error: String((err as Error).message || err) }, 500);
  }
});
