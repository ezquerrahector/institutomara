// Supabase Edge Function: admin-usuarios
// ----------------------------------------------------------------------------
// Acciones que solo puede hacer el administrador y que necesitan la llave de
// servicio (por eso no se hacen desde el navegador):
//   { accion: "borrar",  usuarioId }                 → elimina la cuenta por completo
//   { accion: "correo",  usuarioId, correo }         → cambia el correo de acceso
// Antes de actuar, confirma que quien llama es administrador (rol en `perfiles`).
// Variables: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las pone Supabase solas.

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const URL_SB = Deno.env.get("SUPABASE_URL") || "";
const LLAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const srv = { apikey: LLAVE, Authorization: `Bearer ${LLAVE}`, "Content-Type": "application/json" };

async function esAdmin(req: Request): Promise<string | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const r = await fetch(`${URL_SB}/auth/v1/user`, { headers: { apikey: LLAVE, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  const p = await fetch(`${URL_SB}/rest/v1/perfiles?id=eq.${u.id}&select=rol`, { headers: srv }).then((x) => x.json());
  return Array.isArray(p) && p[0] && p[0].rol === "admin" ? u.id : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const admin = await esAdmin(req);
    if (!admin) return json({ error: "Solo el administrador puede hacer esto." }, 403);
    const { accion, usuarioId, correo } = await req.json();
    if (!usuarioId || !/^[0-9a-f-]{36}$/i.test(String(usuarioId))) return json({ error: "Alumno no válido." }, 400);
    if (usuarioId === admin) return json({ error: "No puedes hacer esto con tu propia cuenta de administrador." }, 400);

    if (accion === "borrar") {
      // Al borrar la cuenta se borran en cascada su perfil, inscripciones, avance,
      // constancias y dudas. Los pagos se conservan (sin alumno) para la contabilidad.
      const r = await fetch(`${URL_SB}/auth/v1/admin/users/${usuarioId}`, { method: "DELETE", headers: srv });
      if (!r.ok && r.status !== 404) return json({ error: "No se pudo borrar la cuenta.", detalle: await r.text() }, 502);
      await fetch(`${URL_SB}/rest/v1/perfiles?id=eq.${usuarioId}`, { method: "DELETE", headers: srv });
      return json({ ok: true });
    }

    if (accion === "correo") {
      const c = String(correo || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) return json({ error: "Ese correo no parece válido." }, 400);
      const r = await fetch(`${URL_SB}/auth/v1/admin/users/${usuarioId}`, {
        method: "PUT", headers: srv, body: JSON.stringify({ email: c, email_confirm: true }),
      });
      if (!r.ok) {
        const t = await r.text();
        return json({ error: /already|exists|registered/i.test(t) ? "Ese correo ya lo usa otra cuenta." : "No se pudo cambiar el correo.", detalle: t }, 409);
      }
      await fetch(`${URL_SB}/rest/v1/perfiles?id=eq.${usuarioId}`, {
        method: "PATCH", headers: { ...srv, Prefer: "return=minimal" }, body: JSON.stringify({ correo: c }),
      });
      return json({ ok: true, correo: c });
    }
    return json({ error: "Acción no reconocida." }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
