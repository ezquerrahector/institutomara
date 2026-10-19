-- ============================================================================
-- Instituto Mara — Planes mensuales para empresas y rol de operador (19 oct 2026)
-- Se ejecuta DESPUÉS de cotizaciones-empresa-20261016.sql. Se puede correr más
-- de una vez sin romper nada.
--
-- Lo que se acordó con Héctor (19/10/2026):
--   · Plan por rango de empleados, IVA incluido, todo el catálogo (sin rutas).
--     Mensual (suscripción automática de Mercado Pago) o anual (12 meses al
--     precio de 10).
--   · Constancia de cursos desde el 1.er mes; de diplomados con 2 pagos.
--   · El lugar queda fijo en cuanto la persona ve su primera lección; solo se
--     libera al empezar el siguiente mes pagado.
--   · Operador: ve solo sus prospectos asignados y sus empresas. Puede dar
--     hasta 10 % de descuento por 3 meses en el plan mensual; más que eso, o
--     cualquier descuento en el anual, pasa a aprobación de administración.
--   · Comisión sobre el neto (lo que deposita Mercado Pago menos el IVA de la
--     venta): 35 % del primer pago y 5 % de cada mensualidad siguiente. En el
--     anual, 35 % de cada pago anual. Solo cuando el pago está aprobado.
--
--   1. Rol «operador» y tabla de operadores (los da de alta administración).
--   2. Tabla de rangos con precio y comisión (editable en Ajustes).
--   3. Planes de empresa, lugares, pagos y comisiones.
--   4. Acceso: el plan cubre todo el catálogo como una membresía Total.
--   5. Permisos del operador en el resto de las tablas.
-- ============================================================================

-- 1. Rol operador ---------------------------------------------------------------
do $$
declare r record;
begin
  for r in select conname from pg_constraint
            where conrelid = 'perfiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%rol%'
  loop execute format('alter table perfiles drop constraint %I', r.conname); end loop;
end $$;
alter table perfiles add constraint perfiles_rol_check check (rol in ('alumno','admin','operador'));

create table if not exists operadores (
  id uuid primary key default gen_random_uuid(),
  correo text not null,
  nombre text not null,
  telefono text,                                  -- el que deja en los recados
  usuario_id uuid references perfiles(id) on delete set null,
  activo boolean not null default true,
  descuento_max numeric not null default 10 check (descuento_max between 0 and 100),
  notas text,
  creado_en timestamptz not null default now()
);
create unique index if not exists operadores_correo on operadores (lower(correo));
create index if not exists operadores_usuario on operadores (usuario_id);
alter table operadores enable row level security;

-- ¿Quien consulta es un operador activo? / su id de operador.
create or replace function mi_operador() returns uuid
language sql stable security definer set search_path = public as $$
  select id from operadores where usuario_id = auth.uid() and activo limit 1;
$$;
create or replace function es_operador() returns boolean
language sql stable security definer set search_path = public as $$
  select mi_operador() is not null;
$$;
grant execute on function mi_operador() to authenticated, anon;
grant execute on function es_operador() to authenticated, anon;

-- Candado de perfiles (seguimiento.sql), ahora con el rol de operador: nadie se
-- cambia el rol a sí mismo; solo puede quedar en lo que diga la tabla de operadores
-- (que únicamente administración edita).
create or replace function proteger_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare debido text;
begin
  if es_admin() or auth.uid() is null then
    return new;
  end if;
  debido := case when exists (select 1 from operadores o where o.usuario_id = new.id and o.activo) then 'operador' else 'alumno' end;
  if not (old.rol <> 'admin' and new.rol = debido) then
    new.rol := old.rol;
  end if;
  new.folio := old.folio;
  new.correo := old.correo;
  new.creado_en := old.creado_en;
  return new;
end;
$$;

-- El rol del perfil sigue a la tabla de operadores (nunca toca a un admin).
create or replace function operador_sincronizar_rol() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.usuario_id is not null and old.usuario_id is distinct from new.usuario_id then
    update perfiles set rol = 'alumno' where id = old.usuario_id and rol = 'operador';
  end if;
  if new.usuario_id is not null then
    update perfiles set rol = case when new.activo then 'operador' else 'alumno' end
      where id = new.usuario_id and rol <> 'admin';
  end if;
  return new;
end; $$;
drop trigger if exists operador_rol on operadores;
create trigger operador_rol after insert or update on operadores
  for each row execute function operador_sincronizar_rol();

create or replace function operador_quitado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.usuario_id is not null then update perfiles set rol = 'alumno' where id = old.usuario_id and rol = 'operador'; end if;
  return old;
end; $$;
drop trigger if exists operador_borrado on operadores;
create trigger operador_borrado after delete on operadores
  for each row execute function operador_quitado();

drop policy if exists "operadores lee" on operadores;
create policy "operadores lee" on operadores for select using (es_admin() or usuario_id = auth.uid());
drop policy if exists "operadores admin" on operadores;
create policy "operadores admin" on operadores for all using (es_admin()) with check (es_admin());
grant select, insert, update, delete on operadores to authenticated;

-- Alta de operador por correo (si ya tiene cuenta, queda ligado de inmediato).
create or replace function operador_alta(p_correo text, p_nombre text, p_telefono text default null)
returns operadores
language plpgsql security definer set search_path = public as $$
declare fila operadores; limpio text := lower(btrim(p_correo));
begin
  if not es_admin() then raise exception 'Solo administración puede dar de alta operadores.'; end if;
  if limpio !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisa el correo.'; end if;
  if nullif(btrim(p_nombre), '') is null then raise exception 'Escribe el nombre del operador.'; end if;
  if exists (select 1 from perfiles where lower(correo) = limpio and rol = 'admin') then
    raise exception 'Ese correo es de un administrador.';
  end if;
  insert into operadores (correo, nombre, telefono, usuario_id)
    values (limpio, btrim(p_nombre), nullif(regexp_replace(coalesce(p_telefono,''), '\D', '', 'g'), ''),
            (select id from perfiles where lower(correo) = limpio))
    on conflict (lower(correo)) do update set nombre = excluded.nombre, telefono = excluded.telefono, activo = true,
      usuario_id = coalesce(operadores.usuario_id, excluded.usuario_id)
    returning * into fila;
  return fila;
end; $$;
revoke all on function operador_alta(text, text, text) from public;
grant execute on function operador_alta(text, text, text) to authenticated;

-- 2. Rangos y ajustes del plan -----------------------------------------------------
create table if not exists planes_rangos (
  id serial primary key,
  desde int not null check (desde >= 1),
  hasta int check (hasta is null or hasta >= desde),      -- null = sin límite
  precio_mensual numeric not null check (precio_mensual > 0),   -- IVA incluido
  comision_inicial_pct numeric not null default 35 check (comision_inicial_pct between 0 and 100),
  comision_recurrente_pct numeric not null default 5 check (comision_recurrente_pct between 0 and 100),
  activo boolean not null default true
);
insert into planes_rangos (desde, hasta, precio_mensual)
select * from (values (1,5,1490),(6,10,2490),(11,25,4990),(26,50,8490),(51,100,13990),
                      (101,250,27990),(251,500,42990),(501,1000,64990),(1001,null::int,89990)) v
where not exists (select 1 from planes_rangos);
alter table planes_rangos enable row level security;
drop policy if exists "rangos lectura" on planes_rangos;
create policy "rangos lectura" on planes_rangos for select using (true);
drop policy if exists "rangos admin" on planes_rangos;
create policy "rangos admin" on planes_rangos for all using (es_admin()) with check (es_admin());
grant select on planes_rangos to anon, authenticated;
grant insert, update, delete on planes_rangos to authenticated;
grant usage on sequence planes_rangos_id_seq to authenticated;

alter table ajustes add column if not exists plan_meses_anual int not null default 10;          -- el anual cuesta N mensualidades
alter table ajustes add column if not exists plan_desc_max_operador numeric not null default 10;  -- % sin autorización
alter table ajustes add column if not exists plan_desc_meses int not null default 3;            -- meses con descuento de bienvenida
alter table ajustes add column if not exists plan_pagos_constancia_dip int not null default 2;   -- pagos para constancia de diplomado

-- 3. Planes, lugares, pagos y comisiones -------------------------------------------
alter table empresas add column if not exists operador_id uuid references operadores(id) on delete set null;

create table if not exists empresas_planes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  rango_id int references planes_rangos(id) on delete set null,
  rango_texto text not null,                     -- «1 a 5 empleados», tal como se vendió
  lugares int,                                   -- máximo de personas (null = sin límite)
  periodo text not null check (periodo in ('mensual','anual')),
  precio_lista numeric not null,                 -- mensualidad o anualidad de lista, IVA incluido
  descuento_pct numeric not null default 0 check (descuento_pct between 0 and 100),
  descuento_meses int not null default 0,        -- mensual: cuántos cobros llevan descuento
  monto_inicial numeric not null,                -- lo que se cobra al empezar
  comision_inicial_pct numeric not null default 35,
  comision_recurrente_pct numeric not null default 5,
  estado text not null default 'pendiente_pago'
    check (estado in ('por_aprobar','rechazado','pendiente_pago','activo','cancelado','vencido')),
  operador_id uuid references operadores(id) on delete set null,
  creado_por uuid references perfiles(id) on delete set null,
  admin_correo text,                             -- quien administrará el panel de la empresa
  nota text,                                     -- lo que se pactó con la empresa
  aprobacion_nota text,
  aprobado_por uuid references perfiles(id) on delete set null,
  aprobado_en timestamptz,
  mp_preapproval_id text unique,
  mp_preferencia_id text,
  liga_pago text,
  liga_vence timestamptz,
  inicio timestamptz,                            -- primer pago aprobado
  periodo_inicio timestamptz,                    -- último pago aprobado
  vigente_hasta timestamptz,
  pagos_aprobados int not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists empresas_planes_empresa on empresas_planes (empresa_id);
create index if not exists empresas_planes_operador on empresas_planes (operador_id);
alter table empresas_planes enable row level security;

create table if not exists empresas_plan_lugares (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references empresas_planes(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  correo text not null,
  usuario_id uuid references perfiles(id) on delete set null,
  asignado_por uuid references perfiles(id) on delete set null,
  asignado_en timestamptz not null default now(),
  iniciado_en timestamptz,                       -- vio su primera lección con el plan
  activo boolean not null default true,
  liberado_en timestamptz
);
create unique index if not exists plan_lugar_unico on empresas_plan_lugares (plan_id, lower(correo)) where activo;
create index if not exists plan_lugares_usuario on empresas_plan_lugares (usuario_id) where activo;
alter table empresas_plan_lugares enable row level security;

create table if not exists plan_pagos (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references empresas_planes(id) on delete cascade,
  mp_pago_id text not null unique,
  numero int not null,                           -- 1 = primer pago del plan
  monto numeric not null,                        -- cobrado, IVA incluido
  neto_mp numeric not null,                      -- lo que depositó Mercado Pago
  iva numeric not null,                          -- IVA de la venta
  base_comision numeric not null,                -- neto_mp − iva
  medio text not null default 'Mercado Pago',
  creado_en timestamptz not null default now()
);
create index if not exists plan_pagos_plan on plan_pagos (plan_id);
alter table plan_pagos enable row level security;

create table if not exists comision_cortes (
  id uuid primary key default gen_random_uuid(),
  operador_id uuid not null references operadores(id) on delete cascade,
  fecha_corte date not null,
  total numeric not null default 0,
  estado text not null default 'por_pagar' check (estado in ('por_pagar','pagado')),
  pagado_en timestamptz,
  referencia text,                               -- de la transferencia
  aceptado_en timestamptz,                       -- el operador aceptó el recibo
  creado_en timestamptz not null default now()
);
alter table comision_cortes enable row level security;

create table if not exists comisiones (
  id uuid primary key default gen_random_uuid(),
  operador_id uuid not null references operadores(id) on delete cascade,
  plan_id uuid not null references empresas_planes(id) on delete cascade,
  plan_pago_id uuid not null unique references plan_pagos(id) on delete cascade,
  tipo text not null check (tipo in ('inicial','recurrente')),
  pct numeric not null,
  base numeric not null,
  monto numeric not null,
  corte_id uuid references comision_cortes(id) on delete set null,
  creado_en timestamptz not null default now()
);
create index if not exists comisiones_operador on comisiones (operador_id, corte_id);
alter table comisiones enable row level security;

-- Permisos: administración todo; el operador lo suyo; la empresa su plan.
drop policy if exists "planes lee" on empresas_planes;
create policy "planes lee" on empresas_planes for select using (
  es_admin() or (operador_id is not null and operador_id = mi_operador()) or es_admin_empresa(empresa_id));
drop policy if exists "planes admin" on empresas_planes;
create policy "planes admin" on empresas_planes for all using (es_admin()) with check (es_admin());
grant select, insert, update, delete on empresas_planes to authenticated;

drop policy if exists "lugares lee" on empresas_plan_lugares;
create policy "lugares lee" on empresas_plan_lugares for select using (
  es_admin() or usuario_id = auth.uid() or es_admin_empresa(empresa_id)
  or exists (select 1 from empresas_planes p where p.id = plan_id and p.operador_id is not null and p.operador_id = mi_operador()));
grant select on empresas_plan_lugares to authenticated;

drop policy if exists "plan pagos lee" on plan_pagos;
create policy "plan pagos lee" on plan_pagos for select using (
  es_admin() or exists (select 1 from empresas_planes p where p.id = plan_id
    and ((p.operador_id is not null and p.operador_id = mi_operador()) or es_admin_empresa(p.empresa_id))));
grant select on plan_pagos to authenticated;

drop policy if exists "comisiones lee" on comisiones;
create policy "comisiones lee" on comisiones for select using (es_admin() or operador_id = mi_operador());
drop policy if exists "comisiones admin" on comisiones;
create policy "comisiones admin" on comisiones for update using (es_admin()) with check (es_admin());
grant select, update on comisiones to authenticated;

drop policy if exists "cortes lee" on comision_cortes;
create policy "cortes lee" on comision_cortes for select using (es_admin() or operador_id = mi_operador());
drop policy if exists "cortes admin" on comision_cortes;
create policy "cortes admin" on comision_cortes for all using (es_admin()) with check (es_admin());
grant select, insert, update, delete on comision_cortes to authenticated;

-- ¿Puede quien consulta manejar los planes de esta empresa? (admin, su operador o su administrador)
create or replace function puede_operar_empresa(p_empresa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select es_admin() or exists (select 1 from empresas e where e.id = p_empresa and e.operador_id is not null and e.operador_id = mi_operador());
$$;
grant execute on function puede_operar_empresa(uuid) to authenticated;

-- Crear un plan (queda esperando pago, o en aprobación si el descuento rebasa el límite).
create or replace function plan_crear(p_empresa uuid, p_empleados int, p_periodo text, p_descuento numeric default 0,
                                      p_admin_correo text default null, p_nota text default null)
returns empresas_planes
language plpgsql security definer set search_path = public as $$
declare
  e empresas; r planes_rangos; a ajustes; fila empresas_planes; op uuid := mi_operador();
  d numeric := round(coalesce(p_descuento, 0), 1); lista numeric; inicial numeric; limite numeric;
  necesita boolean; correo_adm text := nullif(lower(btrim(coalesce(p_admin_correo,''))), '');
begin
  if not (es_admin() or op is not null) then raise exception 'No tienes permiso para crear planes.'; end if;
  select * into e from empresas where id = p_empresa;
  if e.id is null then raise exception 'Empresa no encontrada.'; end if;
  if not es_admin() and e.operador_id is distinct from op then raise exception 'Esta empresa la atiende otro operador.'; end if;
  if p_periodo not in ('mensual','anual') then raise exception 'Elige mensual o anual.'; end if;
  if p_empleados is null or p_empleados < 1 then raise exception 'Escribe cuántas personas van a estudiar.'; end if;
  if d < 0 or d > 100 then raise exception 'Revisa el descuento.'; end if;
  if correo_adm is not null and correo_adm !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisa el correo del administrador.'; end if;
  if exists (select 1 from empresas_planes where empresa_id = p_empresa and estado = 'activo' and vigente_hasta >= now()) then
    raise exception 'Esta empresa ya tiene un plan activo.';
  end if;
  select * into r from planes_rangos where activo and desde <= p_empleados and (hasta is null or hasta >= p_empleados)
    order by desde limit 1;
  if r.id is null then raise exception 'No hay un rango de precio para % personas.', p_empleados; end if;
  select * into a from ajustes limit 1;

  lista := case when p_periodo = 'anual' then r.precio_mensual * a.plan_meses_anual else r.precio_mensual end;
  inicial := round(lista * (100 - d) / 100, 2);
  limite := least(coalesce((select descuento_max from operadores where id = op), a.plan_desc_max_operador), a.plan_desc_max_operador);
  -- El operador puede dar hasta su límite solo en el mensual; el resto lo aprueba administración.
  necesita := not es_admin() and d > 0 and (p_periodo = 'anual' or d > limite);
  if inicial < 30 then raise exception 'Mercado Pago no acepta cobros menores a $30.'; end if;

  -- Una propuesta nueva reemplaza a las anteriores que no se pagaron.
  update empresas_planes set estado = 'cancelado', actualizado_en = now()
    where empresa_id = p_empresa and estado in ('por_aprobar','pendiente_pago');

  insert into empresas_planes (empresa_id, rango_id, rango_texto, lugares, periodo, precio_lista, descuento_pct, descuento_meses,
                               monto_inicial, comision_inicial_pct, comision_recurrente_pct, estado, operador_id, creado_por,
                               admin_correo, nota)
  values (e.id, r.id, case when r.hasta is null then 'Más de ' || (r.desde - 1) || ' personas' else r.desde || ' a ' || r.hasta || ' personas' end,
          r.hasta, p_periodo, lista, d, case when d > 0 and p_periodo = 'mensual' then a.plan_desc_meses else 0 end,
          inicial, r.comision_inicial_pct, r.comision_recurrente_pct,
          case when necesita then 'por_aprobar' else 'pendiente_pago' end,
          coalesce(op, e.operador_id), auth.uid(), correo_adm, nullif(btrim(coalesce(p_nota,'')), ''))
  returning * into fila;

  if correo_adm is not null then
    insert into empresas_admins (empresa_id, correo, usuario_id)
      values (e.id, correo_adm, (select id from perfiles where lower(correo) = correo_adm))
      on conflict (empresa_id, lower(correo)) do nothing;
  end if;
  return fila;
end; $$;
revoke all on function plan_crear(uuid, int, text, numeric, text, text) from public;
grant execute on function plan_crear(uuid, int, text, numeric, text, text) to authenticated;

-- Administración aprueba o rechaza un descuento fuera de límite.
create or replace function plan_aprobar(p_plan uuid, p_aprobar boolean, p_nota text default null)
returns empresas_planes
language plpgsql security definer set search_path = public as $$
declare fila empresas_planes;
begin
  if not es_admin() then raise exception 'Solo administración aprueba descuentos.'; end if;
  update empresas_planes set estado = case when p_aprobar then 'pendiente_pago' else 'rechazado' end,
         aprobado_por = auth.uid(), aprobado_en = now(), aprobacion_nota = nullif(btrim(coalesce(p_nota,'')), ''), actualizado_en = now()
   where id = p_plan and estado = 'por_aprobar'
  returning * into fila;
  if fila.id is null then raise exception 'Ese plan ya no está esperando aprobación.'; end if;
  return fila;
end; $$;
revoke all on function plan_aprobar(uuid, boolean, text) from public;
grant execute on function plan_aprobar(uuid, boolean, text) to authenticated;

-- Periodo en curso: en el mensual, desde el último cobro; en el anual, desde el último «mes cumplido».
create or replace function plan_periodo_inicio(p empresas_planes) returns timestamptz
language sql stable as $$
  select case
    when p.inicio is null then null
    when p.periodo = 'mensual' then p.periodo_inicio
    else p.inicio + make_interval(months => (extract(year from age(now(), p.inicio)) * 12 + extract(month from age(now(), p.inicio)))::int)
  end;
$$;

-- Asignar un lugar del plan a una persona (nombre y correo).
create or replace function plan_asignar_lugar(p_plan uuid, p_nombre text, p_correo text)
returns empresas_plan_lugares
language plpgsql security definer set search_path = public as $$
declare p empresas_planes; fila empresas_plan_lugares; limpio text := lower(btrim(coalesce(p_correo,''))); uid uuid; usados int;
begin
  select * into p from empresas_planes where id = p_plan;
  if p.id is null then raise exception 'Plan no encontrado.'; end if;
  if not (puede_operar_empresa(p.empresa_id) or es_admin_empresa(p.empresa_id)) then raise exception 'No tienes acceso a esta empresa.'; end if;
  if p.estado not in ('pendiente_pago','activo','por_aprobar') then raise exception 'Este plan ya no está vigente.'; end if;
  if nullif(btrim(coalesce(p_nombre,'')), '') is null then raise exception 'Escribe el nombre de la persona.'; end if;
  if limpio !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisa el correo de la persona.'; end if;
  if exists (select 1 from empresas_plan_lugares where plan_id = p_plan and activo and lower(correo) = limpio) then
    raise exception 'Esa persona ya tiene un lugar en el plan.';
  end if;
  select count(*) into usados from empresas_plan_lugares where plan_id = p_plan and activo;
  if p.lugares is not null and usados >= p.lugares then
    raise exception 'Ya están ocupados los % lugares del plan. Libera uno o cambia a un rango mayor.', p.lugares;
  end if;
  select id into uid from perfiles where lower(correo) = limpio;
  insert into empresas_plan_lugares (plan_id, empresa_id, nombre, correo, usuario_id, asignado_por)
    values (p.id, p.empresa_id, btrim(p_nombre), limpio, uid, auth.uid())
    returning * into fila;
  if uid is not null then
    insert into empresas_miembros (empresa_id, usuario_id, origen) values (p.empresa_id, uid, 'plan')
      on conflict (empresa_id, usuario_id) do nothing;
  end if;
  return fila;
end; $$;
revoke all on function plan_asignar_lugar(uuid, text, text) from public;
grant execute on function plan_asignar_lugar(uuid, text, text) to authenticated;

-- Liberar un lugar: libre mientras la persona no empiece; si ya empezó, hasta el siguiente periodo pagado.
create or replace function plan_lugar_liberable_desde(l empresas_plan_lugares) returns timestamptz
language sql stable security definer set search_path = public as $$
  select case
    when l.iniciado_en is null then null
    when (select plan_periodo_inicio(p) from empresas_planes p where p.id = l.plan_id) > l.iniciado_en then null
    else (select case when p.periodo = 'mensual' then coalesce(p.vigente_hasta - interval '3 days', p.periodo_inicio + interval '1 month')
                      else plan_periodo_inicio(p) + interval '1 month' end
          from empresas_planes p where p.id = l.plan_id)
  end;
$$;

create or replace function plan_liberar_lugar(p_lugar uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare l empresas_plan_lugares; desde timestamptz;
begin
  select * into l from empresas_plan_lugares where id = p_lugar and activo;
  if l.id is null then raise exception 'Ese lugar ya está libre.'; end if;
  if not (puede_operar_empresa(l.empresa_id) or es_admin_empresa(l.empresa_id)) then raise exception 'No tienes acceso a esta empresa.'; end if;
  desde := plan_lugar_liberable_desde(l);
  if desde is not null and not es_admin() then
    raise exception 'Esta persona ya empezó a estudiar. Su lugar se puede liberar a partir del %, cuando empiece el siguiente mes pagado.',
      to_char(desde at time zone 'America/Mexico_City', 'DD/MM/YYYY');
  end if;
  update empresas_plan_lugares set activo = false, liberado_en = now() where id = l.id;
end; $$;
revoke all on function plan_liberar_lugar(uuid) from public;
grant execute on function plan_liberar_lugar(uuid) to authenticated;

-- Lugares del plan con la fecha a partir de la cual se pueden liberar.
create or replace function plan_lugares(p_plan uuid)
returns table (id uuid, nombre text, correo text, usuario_id uuid, alumno text, asignado_en timestamptz,
               iniciado_en timestamptz, liberable_desde timestamptz, ultimo_acceso timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare p empresas_planes;
begin
  select * into p from empresas_planes where empresas_planes.id = p_plan;
  if p.id is null then return; end if;
  if not (puede_operar_empresa(p.empresa_id) or es_admin_empresa(p.empresa_id)) then raise exception 'No tienes acceso a esta empresa.'; end if;
  return query
    select l.id, l.nombre, l.correo, l.usuario_id, pf.nombre, l.asignado_en, l.iniciado_en, plan_lugar_liberable_desde(l), pf.ultimo_acceso
    from empresas_plan_lugares l left join perfiles pf on pf.id = l.usuario_id
    where l.plan_id = p_plan and l.activo
    order by l.asignado_en;
end; $$;
revoke all on function plan_lugares(uuid) from public;
grant execute on function plan_lugares(uuid) to authenticated;

-- El lugar queda fijo cuando la persona ve su primera lección de un programa del plan.
create or replace function plan_marcar_inicio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(array_length(new.lecciones_vistas, 1), 0) > 0
     and exists (select 1 from inscripciones i where i.usuario_id = new.usuario_id and i.curso_id = new.curso_id and i.estatus = 'empresa') then
    update empresas_plan_lugares set iniciado_en = now()
      where usuario_id = new.usuario_id and activo and iniciado_en is null;
  end if;
  return new;
end; $$;
drop trigger if exists plan_inicio on avances;
create trigger plan_inicio after insert or update of lecciones_vistas on avances
  for each row execute function plan_marcar_inicio();

-- Registrar un pago aprobado (solo el servidor, con la llave de servicio).
-- Calcula la comisión: 35 % del primer pago, 5 % de los siguientes; en el anual, 35 % de cada pago.
create or replace function plan_registrar_pago(p_plan uuid, p_pago text, p_monto numeric, p_neto numeric, p_medio text default 'Mercado Pago')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p empresas_planes; pp plan_pagos; n int; iva numeric; base numeric; pct numeric; tipo text;
  desde timestamptz; dur interval; e empresas; esperado numeric;
begin
  select * into p from empresas_planes where id = p_plan for update;
  if p.id is null then return jsonb_build_object('ok', false, 'motivo', 'plan no encontrado'); end if;
  if exists (select 1 from plan_pagos where mp_pago_id = p_pago) then return jsonb_build_object('ok', false, 'motivo', 'pago ya registrado'); end if;
  select * into e from empresas where id = p.empresa_id;
  n := p.pagos_aprobados + 1;
  -- Monto esperado: con descuento en los primeros meses, de lista después.
  esperado := case when p.periodo = 'mensual' and n <= p.descuento_meses then p.monto_inicial
                   when p.periodo = 'anual' and n = 1 then p.monto_inicial else p.precio_lista end;
  if p_monto + 0.5 < esperado then
    insert into pagos (usuario_id, curso_id, monto, medio, referencia_mp, nota)
      values (null, null, p_monto, p_medio, p_pago, 'REVISAR plan de ' || e.nombre || ': pagó ' || p_monto || ' de ' || esperado || '. No se activó.')
      on conflict (referencia_mp) do nothing;
    return jsonb_build_object('ok', false, 'motivo', 'monto insuficiente');
  end if;
  iva := round(p_monto * 0.16 / 1.16, 2);
  base := greatest(0, round(coalesce(p_neto, p_monto) - iva, 2));
  insert into plan_pagos (plan_id, mp_pago_id, numero, monto, neto_mp, iva, base_comision, medio)
    values (p.id, p_pago, n, p_monto, coalesce(p_neto, p_monto), iva, base, p_medio)
    returning * into pp;

  dur := case when p.periodo = 'anual' then interval '12 months' else interval '1 month' end;
  desde := greatest(now(), coalesce(p.vigente_hasta - interval '3 days', now()));
  update empresas_planes set estado = 'activo', pagos_aprobados = n, inicio = coalesce(inicio, now()), periodo_inicio = now(),
         vigente_hasta = desde + dur + interval '3 days', actualizado_en = now()
   where id = p.id;

  insert into pagos (usuario_id, curso_id, monto, medio, referencia_mp, nota)
    values (null, null, p_monto, p_medio, p_pago,
            'Plan ' || p.periodo || ' de ' || e.nombre || ' (' || p.rango_texto || ') · pago ' || n)
    on conflict (referencia_mp) do nothing;

  if p.operador_id is not null then
    if n = 1 or p.periodo = 'anual' then tipo := 'inicial'; pct := p.comision_inicial_pct;
    else tipo := 'recurrente'; pct := p.comision_recurrente_pct; end if;
    insert into comisiones (operador_id, plan_id, plan_pago_id, tipo, pct, base, monto)
      values (p.operador_id, p.id, pp.id, tipo, pct, base, round(base * pct / 100, 2));
  end if;

  return jsonb_build_object('ok', true, 'numero', n, 'empresa', e.nombre,
    -- Al terminar los meses con descuento, la suscripción debe subir al precio de lista.
    'subir_precio', p.periodo = 'mensual' and p.descuento_meses > 0 and n = p.descuento_meses and p.monto_inicial < p.precio_lista,
    'precio_lista', p.precio_lista, 'preapproval', p.mp_preapproval_id);
end; $$;
revoke all on function plan_registrar_pago(uuid, text, numeric, numeric, text) from public, anon, authenticated;
grant execute on function plan_registrar_pago(uuid, text, numeric, numeric, text) to service_role;

-- 4. Acceso -------------------------------------------------------------------------
-- Liga los lugares (y el rol de operador) a la cuenta cuando la persona se registra.
create or replace function ligar_por_correo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update operadores set usuario_id = new.id where usuario_id is null and lower(correo) = lower(new.correo);
  update empresas_plan_lugares set usuario_id = new.id where usuario_id is null and activo and lower(correo) = lower(new.correo);
  insert into empresas_miembros (empresa_id, usuario_id, origen)
    select distinct l.empresa_id, new.id, 'plan' from empresas_plan_lugares l where l.usuario_id = new.id and l.activo
    on conflict (empresa_id, usuario_id) do nothing;
  return new;
end; $$;
drop trigger if exists perfil_ligar_correo on perfiles;
create trigger perfil_ligar_correo after insert on perfiles
  for each row execute function ligar_por_correo();

create or replace function plan_empresa_cubre(p_usuario uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from empresas_plan_lugares l join empresas_planes p on p.id = l.plan_id
                 where l.usuario_id = p_usuario and l.activo and p.estado in ('activo','cancelado') and p.vigente_hasta >= now());
$$;
grant execute on function plan_empresa_cubre(uuid) to authenticated;

-- La membresía Total y el plan de empresa cubren todo menos las rutas.
create or replace function membresia_cubre(p_usuario uuid, p_curso text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membresias m
    where m.usuario_id = p_usuario and m.estado in ('activa','cancelada')
      and m.vigente_hasta >= now()
      and (m.plan in ('total','anual')
           or (m.plan = 'esencial' and p_curso not like 'r-%'
               and coalesce((select c.nivel from cursos c where c.id = p_curso), '') <> 'Diplomados'))
  ) or (p_curso not like 'r-%' and plan_empresa_cubre(p_usuario));
$$;
grant execute on function membresia_cubre(uuid, text) to authenticated;

-- Constancia de diplomado con plan de empresa: a partir de N pagos (el anual cuenta como 12).
create or replace function plan_permite_constancia(p_usuario uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from empresas_plan_lugares l join empresas_planes p on p.id = l.plan_id
                 where l.usuario_id = p_usuario
                   and (p.periodo = 'anual' and p.pagos_aprobados >= 1
                        or p.pagos_aprobados >= (select plan_pagos_constancia_dip from ajustes limit 1)));
$$;
grant execute on function plan_permite_constancia(uuid) to authenticated;

drop policy if exists "constancias propias crea" on constancias;
create policy "constancias propias crea" on constancias for insert with check (
  es_admin()
  or (
    usuario_id = auth.uid()
    and exists (select 1 from inscripciones i where i.usuario_id = auth.uid() and i.curso_id = constancias.curso_id
                and i.estatus <> 'piloto'
                and (i.estatus <> 'membresia' or membresia_permite_constancia(auth.uid(), constancias.curso_id))
                and (i.estatus <> 'empresa'
                     or coalesce((select c.nivel from cursos c where c.id = constancias.curso_id), '') <> 'Diplomados'
                     or plan_permite_constancia(auth.uid())))
  )
);

-- El plan de la empresa de quien consulta (para el aula). De paso liga su lugar por correo.
create or replace function mi_plan_empresa()
returns table (plan_id uuid, empresa_id uuid, empresa text, periodo text, estado text, vigente_hasta timestamptz,
               pagos_aprobados int, pagos_constancia int, lugar_id uuid, iniciado_en timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare mi_correo text;
begin
  if auth.uid() is null then return; end if;
  select lower(correo) into mi_correo from perfiles where id = auth.uid();
  if mi_correo is not null then
    update empresas_plan_lugares set usuario_id = auth.uid() where usuario_id is null and activo and lower(correo) = mi_correo;
    insert into empresas_miembros (empresa_id, usuario_id, origen)
      select distinct l.empresa_id, auth.uid(), 'plan' from empresas_plan_lugares l where l.usuario_id = auth.uid() and l.activo
      on conflict (empresa_id, usuario_id) do nothing;
    update operadores set usuario_id = auth.uid() where usuario_id is null and lower(correo) = mi_correo;
  end if;
  return query
    select p.id, e.id, e.nombre, p.periodo, p.estado, p.vigente_hasta, p.pagos_aprobados,
           (select plan_pagos_constancia_dip from ajustes limit 1), l.id, l.iniciado_en
    from empresas_plan_lugares l join empresas_planes p on p.id = l.plan_id join empresas e on e.id = p.empresa_id
    where l.usuario_id = auth.uid() and l.activo and p.estado in ('activo','cancelado','pendiente_pago')
    order by (p.estado = 'activo') desc, p.vigente_hasta desc nulls last
    limit 1;
end; $$;
revoke all on function mi_plan_empresa() from public;
grant execute on function mi_plan_empresa() to authenticated;

-- Reporte de la empresa: también los programas que su gente toma con el plan.
create or replace function empresa_reporte(p_empresa uuid)
returns table (usuario_id uuid, nombre text, correo text, telefono text, area text, num_empleado text,
               ultimo_acceso timestamptz, curso_id text, inscrito date, lecciones text[], calificaciones jsonb,
               avance_actualizado timestamptz, constancia_folio text, constancia_fecha date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (es_admin() or es_admin_empresa(p_empresa) or puede_operar_empresa(p_empresa)) then
    raise exception 'No tienes acceso a esta empresa.';
  end if;
  return query
    with programas as (
      select distinct unnest(coalesce(ec.cursos, array[ec.curso_id])) as curso_id from empresas_compras ec
      where ec.empresa_id = p_empresa and ec.estado in ('pagado','piloto')
    )
    select m.usuario_id, coalesce(nullif(p.nombre_constancia,''), p.nombre), p.correo, p.telefono, m.area, m.num_empleado,
           p.ultimo_acceso, i.curso_id, i.fecha, coalesce(a.lecciones_vistas, '{}'), coalesce(a.calificaciones_modulo, '{}'::jsonb),
           a.actualizado_en, c.folio, c.fecha
    from empresas_miembros m
    join perfiles p on p.id = m.usuario_id
    left join inscripciones i on i.usuario_id = m.usuario_id
      and (i.curso_id in (select pr.curso_id from programas pr)
           or (i.estatus = 'empresa' and exists (select 1 from empresas_plan_lugares l where l.usuario_id = m.usuario_id and l.empresa_id = p_empresa)))
    left join avances a on a.usuario_id = m.usuario_id and a.curso_id = i.curso_id
    left join constancias c on c.usuario_id = m.usuario_id and c.curso_id = i.curso_id
    where m.empresa_id = p_empresa
    order by p.nombre, i.curso_id;
end; $$;
revoke all on function empresa_reporte(uuid) from public;
grant execute on function empresa_reporte(uuid) to authenticated;

-- 5. Permisos del operador en el resto de las tablas -------------------------------
-- Empresas: crea las suyas y ve solo las que atiende.
drop policy if exists "empresas lee" on empresas;
create policy "empresas lee" on empresas for select using (
  es_admin() or es_admin_empresa(id) or (operador_id is not null and operador_id = mi_operador()));
drop policy if exists "empresas operador crea" on empresas;
create policy "empresas operador crea" on empresas for insert with check (es_operador() and operador_id = mi_operador());
drop policy if exists "empresas operador edita" on empresas;
create policy "empresas operador edita" on empresas for update using (operador_id is not null and operador_id = mi_operador())
  with check (operador_id = mi_operador());

-- El operador no cambia el descuento pactado ni se reasigna la empresa (eso lo hace administración).
create or replace function empresa_proteger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if es_admin() or auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then new.descuento_pct := 0; new.cursos_permitidos := null; return new; end if;
  new.descuento_pct := old.descuento_pct; new.operador_id := old.operador_id; new.cursos_permitidos := old.cursos_permitidos;
  return new;
end; $$;
drop trigger if exists empresa_protegida on empresas;
create trigger empresa_protegida before insert or update on empresas
  for each row execute function empresa_proteger();

drop policy if exists "empresas admins lee" on empresas_admins;
create policy "empresas admins lee" on empresas_admins for select using (
  es_admin() or usuario_id = auth.uid() or es_admin_empresa(empresa_id) or puede_operar_empresa(empresa_id));
drop policy if exists "empresas miembros lee" on empresas_miembros;
create policy "empresas miembros lee" on empresas_miembros for select using (
  es_admin() or usuario_id = auth.uid() or es_admin_empresa(empresa_id) or puede_operar_empresa(empresa_id));
drop policy if exists "empresa compra propia" on empresas_compras;
create policy "empresa compra propia" on empresas_compras for select using (
  comprador_id = auth.uid() or es_admin() or (empresa_id is not null and (es_admin_empresa(empresa_id) or puede_operar_empresa(empresa_id))));

-- Administrador de la empresa: también lo registra su operador.
create or replace function empresa_agregar_admin(p_empresa uuid, p_correo text, p_nombre text default null)
returns empresas_admins
language plpgsql security definer set search_path = public as $$
declare fila empresas_admins; limpio text := lower(trim(p_correo));
begin
  if not puede_operar_empresa(p_empresa) then raise exception 'No tienes acceso a esta empresa.'; end if;
  if limpio !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisa el correo.'; end if;
  insert into empresas_admins (empresa_id, correo, nombre, usuario_id)
    values (p_empresa, limpio, nullif(trim(p_nombre),''), (select id from perfiles where lower(correo) = limpio))
    on conflict (empresa_id, lower(correo)) do update set nombre = coalesce(excluded.nombre, empresas_admins.nombre),
      usuario_id = coalesce(empresas_admins.usuario_id, excluded.usuario_id)
    returning * into fila;
  return fila;
end; $$;
revoke all on function empresa_agregar_admin(uuid, text, text) from public;
grant execute on function empresa_agregar_admin(uuid, text, text) to authenticated;

-- Piloto: también lo crea el operador de la empresa (máximo 5 lugares y 15 días).
create or replace function empresa_crear_piloto(p_empresa uuid, p_cursos text[], p_lugares int default 5,
                                                p_dias int default 15, p_nota text default null, p_plazo int default 30)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  e empresas; compra uuid; cod text; i int; j int; validos text[];
  letras text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  limite date := current_date + coalesce(p_plazo, 30);
begin
  if not puede_operar_empresa(p_empresa) then raise exception 'No tienes acceso a esta empresa.'; end if;
  if not es_admin() then
    if p_lugares > 5 or p_dias > 15 or p_plazo > 30 then raise exception 'El piloto del operador es de hasta 5 lugares y 15 días.'; end if;
    if exists (select 1 from empresas_compras where empresa_id = p_empresa and estado = 'piloto') then
      raise exception 'Esta empresa ya tiene un piloto. Para otro, pídelo a administración.';
    end if;
  end if;
  select * into e from empresas where id = p_empresa;
  if e.id is null then raise exception 'Empresa no encontrada.'; end if;
  select array_agg(id order by array_position(p_cursos, id)) into validos from cursos where id = any(p_cursos) and publicado;
  if validos is null or array_length(validos, 1) = 0 then raise exception 'Elige al menos un programa.'; end if;
  if p_lugares is null or p_lugares < 1 or p_lugares > 50 then raise exception 'Un piloto va de 1 a 50 lugares.'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 60 then raise exception 'El acceso dura de 1 a 60 días.'; end if;
  if p_plazo is null or p_plazo < 1 or p_plazo > 120 then raise exception 'El plazo para activar va de 1 a 120 días.'; end if;

  insert into empresas_compras (comprador_id, empresa, rfc, contacto_nombre, contacto_correo, contacto_tel, curso_id, cursos,
                                lugares, precio_unit, pct, total, estado, empresa_id, medio, nota)
  values (auth.uid(), e.nombre, e.rfc, e.contacto_nombre, e.contacto_correo, e.contacto_tel, validos[1], validos,
          p_lugares, 0, 100, 0, 'piloto', e.id, 'piloto',
          'Piloto: ' || p_dias || ' días de acceso por persona; activar antes del ' || to_char(limite, 'DD/MM/YYYY') ||
          coalesce(' · ' || nullif(trim(p_nota),''), ''))
  returning id into compra;

  for i in 1..p_lugares loop
    loop
      cod := 'EMP-';
      for j in 1..7 loop cod := cod || substr(letras, 1 + floor(random() * 32)::int, 1); end loop;
      exit when not exists (select 1 from cupones where codigo = cod);
    end loop;
    insert into cupones (codigo, descripcion, tipo, valor, curso_id, cursos, piloto, dias_acceso, usos_max, vence)
      values (cod, 'Piloto de ' || e.nombre, 'porcentaje', 100, null, validos, true, p_dias, 1, limite);
    insert into empresas_codigos (codigo, compra_id) values (cod, compra);
  end loop;
  return compra;
end; $$;
revoke all on function empresa_crear_piloto(uuid, text[], int, int, text, int) from public;
grant execute on function empresa_crear_piloto(uuid, text[], int, int, text, int) to authenticated;

-- Lugares (códigos) de la empresa: también los ve su operador.
create or replace function empresa_lugares(p_empresa uuid)
returns table (codigo text, compra_id uuid, curso_id text, asignado_nombre text, asignado_correo text,
               enviado_en timestamptz, usuario_id uuid, alumno text, canjeado_en timestamptz, vence date,
               piloto boolean, cursos text[], dias_acceso int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (es_admin_empresa(p_empresa) or puede_operar_empresa(p_empresa)) then
    raise exception 'No tienes acceso a esta empresa.';
  end if;
  return query
    select k.codigo, k.compra_id,
           case when e.estado = 'piloto' or e.cursos is not null then k.curso_id else coalesce(k.curso_id, e.curso_id) end,
           k.asignado_nombre, k.asignado_correo, k.enviado_en,
           k.usuario_id, p.nombre, k.canjeado_en, cu.vence,
           coalesce(cu.piloto, false), e.cursos, cu.dias_acceso
    from empresas_codigos k
    join empresas_compras e on e.id = k.compra_id
    left join perfiles p on p.id = k.usuario_id
    left join cupones cu on cu.codigo = k.codigo
    where e.empresa_id = p_empresa and e.estado in ('pagado','piloto')
    order by e.creado_en desc, (k.usuario_id is null), k.codigo;
end; $$;
revoke all on function empresa_lugares(uuid) from public;
grant execute on function empresa_lugares(uuid) to authenticated;

-- Cupones: el operador ve los que creó y solo crea descuentos de hasta su límite.
alter table cupones add column if not exists creado_por uuid references perfiles(id) on delete set null default auth.uid();
drop policy if exists "cupones admin lee" on cupones;
create policy "cupones admin lee" on cupones for select using (es_admin() or (es_operador() and creado_por = auth.uid()));
drop policy if exists "cupones admin crea" on cupones;
create policy "cupones admin crea" on cupones for insert with check (
  es_admin() or (es_operador() and creado_por = auth.uid() and tipo = 'porcentaje' and not piloto
                 and valor <= coalesce((select descuento_max from operadores where id = mi_operador()), 10)));
drop policy if exists "cupones admin actualiza" on cupones;
create policy "cupones admin actualiza" on cupones for update using (es_admin() or (es_operador() and creado_por = auth.uid()))
  with check (es_admin() or (es_operador() and creado_por = auth.uid() and tipo = 'porcentaje' and not piloto
                 and valor <= coalesce((select descuento_max from operadores where id = mi_operador()), 10)));

-- Membresías y regalos: el operador solo consulta.
drop policy if exists "membresia propia" on membresias;
create policy "membresia propia" on membresias for select using (usuario_id = auth.uid() or es_admin() or es_operador());
drop policy if exists "regalo propio" on regalos;
create policy "regalo propio" on regalos for select using (comprador_id = auth.uid() or es_admin() or es_operador());

-- Prospectos: cada operador trabaja solo los que administración le asigna.
alter table prospectos add column if not exists asignado_a uuid references operadores(id) on delete set null;
alter table prospectos add column if not exists asignado_en timestamptz;
create index if not exists prospectos_asignado on prospectos (asignado_a);
drop policy if exists "prospectos operador" on prospectos;
create policy "prospectos operador" on prospectos for select using (asignado_a is not null and asignado_a = mi_operador());
drop policy if exists "prospectos operador edita" on prospectos;
create policy "prospectos operador edita" on prospectos for update using (asignado_a is not null and asignado_a = mi_operador())
  with check (asignado_a = mi_operador());
drop policy if exists "prospecto contactos operador" on prospecto_contactos;
create policy "prospecto contactos operador" on prospecto_contactos for select using (
  exists (select 1 from prospectos p where p.id = prospecto_id and p.asignado_a is not null and p.asignado_a = mi_operador()));
drop policy if exists "prospecto contactos operador crea" on prospecto_contactos;
create policy "prospecto contactos operador crea" on prospecto_contactos for insert with check (
  creado_por = auth.uid() and exists (select 1 from prospectos p where p.id = prospecto_id and p.asignado_a = mi_operador()));
drop policy if exists "prospecto giros operador" on prospecto_giros;
create policy "prospecto giros operador" on prospecto_giros for select using (es_operador());

-- El operador no se reasigna prospectos ni los saca de su bandeja.
create or replace function prospecto_proteger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if es_admin() or auth.uid() is null then
    if new.asignado_a is distinct from old.asignado_a then new.asignado_en := case when new.asignado_a is null then null else now() end; end if;
    return new;
  end if;
  new.asignado_a := old.asignado_a; new.asignado_en := old.asignado_en; new.token := old.token;
  return new;
end; $$;
drop trigger if exists prospecto_protegido on prospectos;
create trigger prospecto_protegido before update on prospectos
  for each row execute function prospecto_proteger();

select 'ok' as resultado;
