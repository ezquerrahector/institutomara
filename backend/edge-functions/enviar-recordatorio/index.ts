// Supabase Edge Function: enviar-recordatorio
// ----------------------------------------------------------------------------
// El administrador manda recordatorios de «continúa donde te quedaste» por
// correo, uno por alumno o a todos los pendientes. El aula arma la lista (nombre,
// curso, avance y siguiente lección) y esta función la envía con Brevo.
// Solo funciona si quien llama es administrador.
// Secretos (Supabase → Edge Functions → Secrets):
//   BREVO_API_KEY      → llave de API de Brevo (SMTP & API → API Keys)
//   CORREO_REMITENTE   → remitente verificado en Brevo (ej. hola@institutomara.com)
//   NOMBRE_REMITENTE   → (opcional) «Instituto Mara»
//   URL_AULA           → (opcional) dirección del aula

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const URL_SB = Deno.env.get("SUPABASE_URL") || "";
const LLAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BREVO = Deno.env.get("BREVO_API_KEY") || "";
const REMITENTE = Deno.env.get("CORREO_REMITENTE") || "";
const NOMBRE = Deno.env.get("NOMBRE_REMITENTE") || "Instituto Mara";
const AULA = Deno.env.get("URL_AULA") || "https://ezquerrahector.github.io/institutomara/plataforma/index.html";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const srv = { apikey: LLAVE, Authorization: `Bearer ${LLAVE}`, "Content-Type": "application/json" };
const e = (t: unknown) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

async function esAdmin(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const r = await fetch(`${URL_SB}/auth/v1/user`, { headers: { apikey: LLAVE, Authorization: `Bearer ${token}` } });
  if (!r.ok) return false;
  const u = await r.json();
  const p = await fetch(`${URL_SB}/rest/v1/perfiles?id=eq.${u.id}&select=rol`, { headers: srv }).then((x) => x.json());
  return Array.isArray(p) && p[0] && p[0].rol === "admin";
}

function html(d: { nombre: string; curso: string; avance: number; siguiente?: string; cursoId: string }) {
  const url = `${AULA}?curso=${encodeURIComponent(d.cursoId)}`;
  const primer = String(d.nombre || "").split(" ")[0];
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#2E1065">
  <div style="background:linear-gradient(135deg,#2E1065,#6D28D9);color:#fff;padding:26px;border-radius:16px 16px 0 0">
    <div style="font-size:13px;letter-spacing:2px;opacity:.85">INSTITUTO MARA</div>
    <h1 style="margin:8px 0 0;font-size:24px">${e(primer)}, tu curso te está esperando</h1></div>
  <div style="border:1px solid #E9E5F5;border-top:0;padding:24px;border-radius:0 0 16px 16px">
    <p style="font-size:16px;line-height:1.6">${d.avance > 0
      ? `Llevas <b>${d.avance}%</b> de <b>${e(d.curso)}</b>. ¡Vas muy bien! Con unos minutos hoy avanzas otra lección y te acercas a tu constancia.`
      : `Ya tienes tu lugar en <b>${e(d.curso)}</b> y tu primera lección te está esperando. Empieza hoy con solo 10 minutos.`}</p>
    <div style="background:#EEF0FF;border-radius:10px;height:12px;overflow:hidden;margin:14px 0">
      <div style="width:${Math.max(4, Math.min(100, d.avance))}%;background:#6D28D9;height:12px"></div></div>
    ${d.siguiente ? `<p style="font-size:15px">Tu siguiente lección: <b>${e(d.siguiente)}</b></p>` : ""}
    <p style="text-align:center;margin:26px 0"><a href="${url}" style="background:#6D28D9;color:#fff;text-decoration:none;padding:14px 26px;border-radius:999px;font-weight:bold;font-size:16px">Continuar donde me quedé</a></p>
    <p style="font-size:13px;color:#6B6880">Tu avance se guarda solo: entra desde el celular o la computadora.
    ¿Tienes dudas? Pregúntale al instructor desde la lección.</p></div></div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!(await esAdmin(req))) return json({ error: "Solo el administrador puede enviar recordatorios." }, 403);
    if (!BREVO || !REMITENTE) {
      return json({ error: "Falta configurar el envío de correos: agrega los secretos BREVO_API_KEY y CORREO_REMITENTE en Supabase." }, 500);
    }
    const { lista } = await req.json();
    if (!Array.isArray(lista) || !lista.length) return json({ error: "No hay alumnos para recordar." }, 400);
    if (lista.length > 200) return json({ error: "Máximo 200 recordatorios por envío." }, 400);

    let enviados = 0;
    const fallas: string[] = [];
    for (const d of lista) {
      if (!d || !d.correo) continue;
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { email: REMITENTE, name: NOMBRE },
          to: [{ email: d.correo, name: d.nombre || "" }],
          subject: `${String(d.nombre || "").split(" ")[0] || "Hola"}, continúa ${d.curso} donde te quedaste`,
          htmlContent: html(d),
        }),
      });
      if (r.ok) {
        enviados++;
        if (d.usuarioId) {
          await fetch(`${URL_SB}/rest/v1/recordatorios`, {
            method: "POST", headers: { ...srv, Prefer: "return=minimal" },
            body: JSON.stringify({ usuario_id: d.usuarioId, curso_id: d.cursoId || null, canal: "correo" }),
          });
        }
      } else fallas.push(`${d.correo}: ${r.status}`);
    }
    return json({ ok: true, enviados, fallas });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
