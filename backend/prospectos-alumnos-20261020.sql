-- ============================================================================
-- Instituto Mara — Prospectos de alumnos (20 oct 2026). Fase 1 de «Campañas».
-- Se ejecuta DESPUÉS de seguimiento.sql, tienda.sql y planes-operadores-20261019.sql.
-- Se puede correr más de una vez.
--
-- Una sola lista de personas (Administración → Prospectos → Alumnos):
--   · Se llena sola con las cuentas del aula (alumnos; nunca administración ni
--     operadores). Cada cuenta nueva entra sola al registrarse.
--   · Se agregan personas a mano o por CSV (anuncios, DM, WhatsApp, eventos…),
--     sin duplicar por correo. Si después crean su cuenta con ese correo, se ligan.
--   · Etiquetas calculadas al momento: sin cuenta, registrado sin compra, alumno,
--     egresado, con membresía, por su empresa.
--   · Historial de contactos por canal y estado de seguimiento.
--   · Al comprar, pasa sola a «Inscrito».
--   · «No quiere promociones» (sin_promociones): las campañas de la fase 2 lo
--     respetan; los correos de su cuenta (confirmación, recibos, constancias) no
--     cambian. alumno_baja() es para el enlace de baja de esos correos.
-- ============================================================================

create table if not exists alumnos_prospectos (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  correo text,
  telefono text,
  origen text not null default 'otro'
    check (origen in ('registro','sitio','anuncio','instagram','facebook','tiktok','whatsapp','evento','referido','otro')),
  programa_interes text,                      -- id del catálogo (curso o ruta)
  estado text not null default 'nuevo'
    check (estado in ('nuevo','contactado','respondio','inscrito','no_interesa')),
  sin_promociones boolean not null default false,
  baja_en timestamptz,
  usuario_id uuid references perfiles(id) on delete set null,
  notas text,
  lote text,                                  -- tanda de carga
  extra jsonb not null default '{}'::jsonb,
  token uuid not null default gen_random_uuid(),   -- enlace «no recibir promociones»
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint alumnos_prospectos_dato check (correo is not null or telefono is not null or usuario_id is not null)
);
create unique index if not exists alumnos_prospectos_correo on alumnos_prospectos (lower(correo)) where correo is not null;
create unique index if not exists alumnos_prospectos_usuario on alumnos_prospectos (usuario_id) where usuario_id is not null;
create unique index if not exists alumnos_prospectos_token on alumnos_prospectos (token);
alter table alumnos_prospectos enable row level security;

create table if not exists alumnos_contactos (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references alumnos_prospectos(id) on delete cascade,
  fecha timestamptz not null default now(),
  canal text not null check (canal in ('correo','whatsapp','llamada','instagram','facebook','otro')),
  sentido text not null default 'saliente' check (sentido in ('saliente','entrante')),
  asunto text,
  resumen text,
  resultado text,                             -- enviado, respondió, rebotó, sin respuesta, baja…
  campana_id uuid,                            -- fase 2: campaña que lo envió
  automatico boolean not null default false,
  creado_por uuid references perfiles(id) on delete set null
);
create index if not exists alumnos_contactos_p on alumnos_contactos (persona_id, fecha);
alter table alumnos_contactos enable row level security;

drop policy if exists "alumnos prospectos admin" on alumnos_prospectos;
create policy "alumnos prospectos admin" on alumnos_prospectos for all using (es_admin()) with check (es_admin());
drop policy if exists "alumnos contactos admin" on alumnos_contactos;
create policy "alumnos contactos admin" on alumnos_contactos for all using (es_admin()) with check (es_admin());
grant select, insert, update, delete on alumnos_prospectos, alumnos_contactos to authenticated;

-- Correo siempre en minúsculas y sin espacios; fecha de actualización.
create or replace function alumnos_prospectos_normalizar() returns trigger language plpgsql as $$
begin
  new.correo := nullif(lower(btrim(coalesce(new.correo, ''))), '');
  new.telefono := nullif(btrim(coalesce(new.telefono, '')), '');
  new.nombre := nullif(btrim(coalesce(new.nombre, '')), '');
  if tg_op = 'UPDATE' then
    new.actualizado_en := now();
    if new.sin_promociones and not old.sin_promociones and new.baja_en is null then new.baja_en := now(); end if;
    if not new.sin_promociones then new.baja_en := null; end if;
  elsif new.sin_promociones and new.baja_en is null then
    new.baja_en := now();
  end if;
  return new;
end; $$;
drop trigger if exists alumnos_prospectos_normalizar on alumnos_prospectos;
create trigger alumnos_prospectos_normalizar before insert or update on alumnos_prospectos
  for each row execute function alumnos_prospectos_normalizar();

-- Un contacto saliente pasa a «contactado»; una respuesta, a «respondió».
-- Nunca baja a quien ya está inscrito.
create or replace function alumnos_contacto_estado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sentido = 'saliente' and coalesce(new.resultado, '') not in ('rebotó', 'sin respuesta') then
    update alumnos_prospectos set estado = 'contactado' where id = new.persona_id and estado = 'nuevo';
  end if;
  if new.sentido = 'entrante' and coalesce(new.resultado, '') <> 'baja' then
    update alumnos_prospectos set estado = 'respondio' where id = new.persona_id and estado in ('nuevo', 'contactado');
  end if;
  return new;
end; $$;
drop trigger if exists alumnos_contacto_estado on alumnos_contactos;
create trigger alumnos_contacto_estado after insert on alumnos_contactos
  for each row execute function alumnos_contacto_estado();

-- ---------------------------------------------------------------------------
-- Cuentas del aula → lista. Nunca debe romper un registro: cualquier error se
-- ignora (la persona se puede ligar después con la carga inicial de abajo).
-- ---------------------------------------------------------------------------
create or replace function alumnos_prospectos_sincronizar() returns trigger
language plpgsql security definer set search_path = public as $$
declare existente uuid;
begin
  begin
    if coalesce(new.rol, 'alumno') in ('admin', 'operador') then return new; end if;
    select id into existente from alumnos_prospectos where usuario_id = new.id;
    if existente is not null then
      if tg_op = 'UPDATE' and lower(new.correo) is distinct from lower(old.correo) then
        update alumnos_prospectos set correo = new.correo where id = existente
          and not exists (select 1 from alumnos_prospectos x where lower(x.correo) = lower(new.correo) and x.id <> existente);
      end if;
      update alumnos_prospectos set telefono = new.telefono where id = existente and telefono is null and new.telefono is not null;
      return new;
    end if;
    -- ¿Ya estaba en la lista por anuncio, CSV…? Se liga sin perder su origen ni su historial.
    select id into existente from alumnos_prospectos where lower(correo) = lower(new.correo) and usuario_id is null;
    if existente is not null then
      update alumnos_prospectos set usuario_id = new.id,
             nombre = coalesce(nombre, new.nombre),
             telefono = coalesce(telefono, new.telefono)
       where id = existente;
    else
      insert into alumnos_prospectos (nombre, correo, telefono, origen, usuario_id)
      values (new.nombre, new.correo, new.telefono, 'registro', new.id);
    end if;
  exception when others then
    null;
  end;
  return new;
end; $$;
drop trigger if exists alumnos_prospectos_sincronizar on perfiles;
create trigger alumnos_prospectos_sincronizar after insert or update of correo, telefono, rol on perfiles
  for each row execute function alumnos_prospectos_sincronizar();

-- Al comprar (no piloto ni plan de empresa), pasa a «Inscrito».
create or replace function alumnos_prospectos_inscrito() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if coalesce(new.estatus, 'activa') not in ('piloto', 'empresa') then
      update alumnos_prospectos set estado = 'inscrito'
       where usuario_id = new.usuario_id and estado <> 'inscrito';
    end if;
  exception when others then
    null;
  end;
  return new;
end; $$;
drop trigger if exists alumnos_prospectos_inscrito on inscripciones;
create trigger alumnos_prospectos_inscrito after insert or update of estatus on inscripciones
  for each row execute function alumnos_prospectos_inscrito();

-- Carga inicial: todas las cuentas de alumnos que ya existen.
update alumnos_prospectos a set usuario_id = p.id
  from perfiles p
 where a.usuario_id is null and lower(a.correo) = lower(p.correo) and p.rol not in ('admin', 'operador')
   and not exists (select 1 from alumnos_prospectos x where x.usuario_id = p.id);
insert into alumnos_prospectos (nombre, correo, telefono, origen, usuario_id, creado_en)
select p.nombre, p.correo, p.telefono, 'registro', p.id, p.creado_en
  from perfiles p
 where p.rol not in ('admin', 'operador')
   and not exists (select 1 from alumnos_prospectos a where a.usuario_id = p.id)
on conflict do nothing;
update alumnos_prospectos a set estado = 'inscrito'
 where a.usuario_id is not null and a.estado <> 'inscrito'
   and exists (select 1 from inscripciones i where i.usuario_id = a.usuario_id and coalesce(i.estatus, 'activa') not in ('piloto', 'empresa'));

-- ---------------------------------------------------------------------------
-- Lista con etiquetas calculadas (solo administración).
--   sin_cuenta · sin_compra · alumno · egresado · membresia · empresa
-- ---------------------------------------------------------------------------
drop function if exists alumnos_prospectos_lista();
create or replace function alumnos_prospectos_lista()
returns table (id uuid, nombre text, correo text, telefono text, origen text, programa_interes text,
               estado text, sin_promociones boolean, baja_en timestamptz, usuario_id uuid, notas text,
               lote text, extra jsonb, creado_en timestamptz, actualizado_en timestamptz,
               etiquetas text[], cursos text[], ultimo_curso text, registrado_en timestamptz,
               ultimo_acceso timestamptz, constancias int, membresia_hasta timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not es_admin() then raise exception 'Solo administración puede ver esta lista.'; end if;
  return query
  with ins as (
    select i.usuario_id,
           array_agg(i.curso_id order by i.fecha desc) filter (where coalesce(i.estatus,'activa') not in ('piloto','empresa')) as comprados,
           bool_or(coalesce(i.estatus,'activa') not in ('piloto','empresa')) as compro,
           bool_or(i.estatus in ('piloto','empresa')) as por_empresa
      from inscripciones i group by i.usuario_id
  ), av as (
    select distinct on (v.usuario_id) v.usuario_id, v.curso_id
      from avances v order by v.usuario_id, v.actualizado_en desc
  ), mem as (
    select m.usuario_id, max(coalesce(m.vigente_hasta, 'infinity'::timestamptz)) as hasta
      from membresias m
     where m.estado = 'activa' and (m.vigente_hasta is null or m.vigente_hasta > now())
     group by m.usuario_id
  ), con as (
    select c.usuario_id, count(*)::int as n from constancias c where c.usuario_id is not null group by c.usuario_id
  )
  select a.id, a.nombre, a.correo, a.telefono, a.origen, a.programa_interes, a.estado, a.sin_promociones,
         a.baja_en, a.usuario_id, a.notas, a.lote, a.extra, a.creado_en, a.actualizado_en,
         array_remove(array[
           case when p.id is null then 'sin_cuenta' end,
           case when p.id is not null and not coalesce(ins.compro, false) and mem.usuario_id is null
                     and not coalesce(ins.por_empresa, false) then 'sin_compra' end,
           case when coalesce(ins.compro, false) then 'alumno' end,
           case when coalesce(con.n, 0) > 0 then 'egresado' end,
           case when mem.usuario_id is not null then 'membresia' end,
           case when coalesce(ins.por_empresa, false) then 'empresa' end
         ], null)::text[],
         coalesce(ins.comprados, '{}'::text[]),
         av.curso_id,
         p.creado_en,
         p.ultimo_acceso,
         coalesce(con.n, 0),
         case when mem.hasta = 'infinity'::timestamptz then null else mem.hasta end
    from alumnos_prospectos a
    left join perfiles p on p.id = a.usuario_id
    left join ins on ins.usuario_id = a.usuario_id
    left join av on av.usuario_id = a.usuario_id
    left join mem on mem.usuario_id = a.usuario_id
    left join con on con.usuario_id = a.usuario_id
   where p.id is null or p.rol not in ('admin', 'operador')
   order by a.creado_en desc;
end; $$;
revoke all on function alumnos_prospectos_lista() from public;
grant execute on function alumnos_prospectos_lista() to authenticated;

-- ---------------------------------------------------------------------------
-- Importar (CSV o alta a mano). Sin duplicar: por correo, o por teléfono si no
-- trae correo. A quien ya existe solo se le completan datos vacíos; su origen,
-- estado e historial no cambian.
-- p_filas: [{ "nombre", "correo", "telefono", "origen", "programa_interes", "notas" }]
-- ---------------------------------------------------------------------------
create or replace function alumnos_prospectos_importar(p_filas jsonb, p_lote text default null, p_origen text default 'otro')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  f jsonb; nom text; cor text; tel text; tel10 text; ori text; prog text; nota text;
  ex uuid; nuevos int := 0; existian int := 0; invalidos int := 0; ids uuid[] := '{}';
  origenes text[] := array['registro','sitio','anuncio','instagram','facebook','tiktok','whatsapp','evento','referido','otro'];
begin
  if not es_admin() then raise exception 'Solo administración puede agregar personas.'; end if;
  if jsonb_typeof(p_filas) <> 'array' then raise exception 'Formato no válido.'; end if;
  if not (coalesce(p_origen, 'otro') = any(origenes)) then p_origen := 'otro'; end if;
  for f in select * from jsonb_array_elements(p_filas) loop
    nom := nullif(btrim(coalesce(f->>'nombre', '')), '');
    cor := nullif(lower(btrim(coalesce(f->>'correo', ''))), '');
    tel := nullif(btrim(coalesce(f->>'telefono', '')), '');
    tel10 := right(regexp_replace(coalesce(tel, ''), '\D', '', 'g'), 10);
    ori := lower(btrim(coalesce(f->>'origen', '')));
    if not (ori = any(origenes)) or ori = 'registro' then ori := p_origen; end if;
    prog := nullif(btrim(coalesce(f->>'programa_interes', '')), '');
    if prog is not null and not exists (select 1 from cursos c where c.id = prog) then prog := null; end if;
    nota := nullif(btrim(coalesce(f->>'notas', '')), '');
    if cor is not null and cor !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then cor := null; end if;
    if length(tel10) < 10 then tel10 := null; end if;
    if cor is null and tel10 is null then invalidos := invalidos + 1; continue; end if;

    ex := null;
    if cor is not null then select a.id into ex from alumnos_prospectos a where lower(a.correo) = cor; end if;
    if ex is null and tel10 is not null then
      select a.id into ex from alumnos_prospectos a
       where right(regexp_replace(coalesce(a.telefono, ''), '\D', '', 'g'), 10) = tel10 and (cor is null or a.correo is null)
       limit 1;
    end if;
    if ex is not null then
      update alumnos_prospectos a set
        nombre = coalesce(a.nombre, nom),
        correo = coalesce(a.correo, cor),
        telefono = coalesce(a.telefono, tel),
        programa_interes = coalesce(a.programa_interes, prog),
        notas = case when nota is null then a.notas when a.notas is null then nota else a.notas || E'\n' || nota end
       where a.id = ex;
      existian := existian + 1;
    else
      insert into alumnos_prospectos (nombre, correo, telefono, origen, programa_interes, notas, lote)
      values (nom, cor, tel, ori, prog, nota, nullif(btrim(coalesce(p_lote, '')), ''))
      returning alumnos_prospectos.id into ex;
      nuevos := nuevos + 1;
    end if;
    ids := ids || ex;
  end loop;
  return jsonb_build_object('nuevos', nuevos, 'existian', existian, 'invalidos', invalidos, 'ids', to_jsonb(ids));
end; $$;
revoke all on function alumnos_prospectos_importar(jsonb, text, text) from public;
grant execute on function alumnos_prospectos_importar(jsonb, text, text) to authenticated;

-- Enlace «no recibir promociones» (lo usará la función de campañas; no requiere sesión).
create or replace function alumno_baja(p_token uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare a alumnos_prospectos;
begin
  select * into a from alumnos_prospectos where token = p_token;
  if a.id is null then return null; end if;
  if not a.sin_promociones then
    update alumnos_prospectos set sin_promociones = true where id = a.id;
    insert into alumnos_contactos (persona_id, canal, sentido, resumen, resultado)
      values (a.id, 'correo', 'entrante', 'Pidió no recibir promociones (enlace de baja).', 'baja');
  end if;
  return coalesce(split_part(a.nombre, ' ', 1), 'Listo');
end; $$;
revoke all on function alumno_baja(uuid) from public;

select 'ok' as resultado,
       (select count(*) from alumnos_prospectos) as personas,
       (select count(*) from alumnos_prospectos where usuario_id is not null) as con_cuenta;
