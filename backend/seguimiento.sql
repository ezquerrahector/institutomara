-- ============================================================================
-- Instituto Mara — seguimiento de alumnos, datos editables y candado de perfiles
-- ----------------------------------------------------------------------------
-- Ejecutar en Supabase → SQL Editor. Se puede repetir sin problema.
--   1. Candado: un alumno ya no puede cambiarse el rol, el folio ni el correo
--      editando su perfil (antes podía darse permisos de administrador).
--   2. Último acceso y número de accesos de cada alumno.
--   3. Nombre para la constancia (lo edita el alumno o el administrador) y lo
--      aplica también a las constancias ya emitidas.
--   4. Registro de recordatorios enviados.
-- ============================================================================

-- 1. Candado de perfiles --------------------------------------------------------
create or replace function proteger_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- El administrador (y el servidor con llave de servicio) sí pueden cambiarlo todo.
  if es_admin() or auth.uid() is null then
    return new;
  end if;
  new.rol := old.rol;
  new.folio := old.folio;
  new.correo := old.correo;       -- el correo se cambia desde la cuenta (con confirmación)
  new.creado_en := old.creado_en;
  return new;
end;
$$;
drop trigger if exists perfil_protegido on perfiles;
create trigger perfil_protegido before update on perfiles
  for each row execute function proteger_perfil();

-- 2. Seguimiento ----------------------------------------------------------------
alter table perfiles add column if not exists ultimo_acceso timestamptz;
alter table perfiles add column if not exists accesos int not null default 0;
alter table perfiles add column if not exists nombre_constancia text;

-- Llenar el último acceso con lo que ya sabe Supabase de cada cuenta
update perfiles p set ultimo_acceso = u.last_sign_in_at
from auth.users u where u.id = p.id and p.ultimo_acceso is null;

create or replace function marcar_acceso()
returns void
language sql
security definer
set search_path = public
as $$
  update perfiles set ultimo_acceso = now(), accesos = coalesce(accesos, 0) + 1
  where id = auth.uid();
$$;
revoke all on function marcar_acceso() from public;
grant execute on function marcar_acceso() to authenticated;

-- 3. Nombre en la constancia ---------------------------------------------------
-- El alumno (para sí mismo) o el administrador (para cualquiera). Actualiza el
-- perfil y las constancias ya emitidas, que es lo que muestra el QR de verificación.
create or replace function cambiar_nombre_constancia(p_nombre text, p_usuario uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  destino uuid := coalesce(p_usuario, auth.uid());
  limpio text := nullif(btrim(p_nombre), '');
begin
  if destino is null then raise exception 'Sin sesión'; end if;
  if destino <> auth.uid() and not es_admin() then raise exception 'No autorizado'; end if;
  if limpio is not null and length(limpio) > 120 then raise exception 'Nombre demasiado largo'; end if;
  update perfiles set nombre_constancia = limpio where id = destino;
  update constancias set nombre_alumno = coalesce(limpio, (select nombre from perfiles where id = destino))
  where usuario_id = destino;
end;
$$;
revoke all on function cambiar_nombre_constancia(text, uuid) from public;
grant execute on function cambiar_nombre_constancia(text, uuid) to authenticated;

-- 3b. Cuentas creadas con Google: tomar su nombre completo ------------------
create or replace function crear_perfil_al_registrarse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfiles (id, nombre, correo, telefono, rol, folio)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nombre',''), nullif(new.raw_user_meta_data->>'full_name',''),
             nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)),
    new.email,
    nullif(new.raw_user_meta_data->>'telefono',''),
    'alumno',
    'IM-' || to_char(now(),'YY') || '-' || lpad((floor(random()*100000))::text, 5, '0')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 4. Recordatorios ---------------------------------------------------------------
create table if not exists recordatorios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references perfiles(id) on delete cascade,
  curso_id text references cursos(id) on delete set null,
  canal text not null default 'correo',        -- correo | whatsapp
  enviado_en timestamptz not null default now()
);
alter table recordatorios enable row level security;
drop policy if exists "recordatorios admin" on recordatorios;
create policy "recordatorios admin" on recordatorios for all using (es_admin()) with check (es_admin());
