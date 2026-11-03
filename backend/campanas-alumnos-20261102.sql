-- ============================================================================
-- Instituto Mara — Campañas para prospectos de alumnos + kit clínico en la lista (2 nov 2026).
-- Fase 2 de «Campañas». Se ejecuta DESPUÉS de prospectos-alumnos-20261020.sql,
-- campanas-20261102.sql y kit-clinico-20261027.sql. Se puede correr más de una vez.
--
--   · campanas.publico: 'empresas' (como hasta hoy) o 'alumnos'.
--   · campanas.filtro (solo alumnos): null = todos; 'kit', 'sin_cuenta', 'sin_compra',
--     'alumno', 'egresado', 'membresia'.
--   · campana_alumno_envios: un renglón por persona y campaña (no se repite).
--   · Los registros del kit clínico entran solos a Prospectos → Alumnos
--     (origen «anuncio», lote «Kit clínico», extra.kit = true) y su baja del kit
--     se respeta como «No quiere promociones».
-- ============================================================================

alter table campanas add column if not exists publico text not null default 'empresas';
alter table campanas drop constraint if exists campanas_publico_ok;
alter table campanas add constraint campanas_publico_ok check (publico in ('empresas', 'alumnos'));
alter table campanas add column if not exists filtro text;

create table if not exists campana_alumno_envios (
  campana_id uuid not null references campanas(id) on delete cascade,
  persona_id uuid not null references alumnos_prospectos(id) on delete cascade,
  correo text,
  resultado text not null default 'enviado',   -- enviado | falla
  detalle text,
  mensaje_id text,
  fecha timestamptz not null default now(),
  primary key (campana_id, persona_id)
);
alter table campana_alumno_envios enable row level security;
drop policy if exists "campana_alumno_envios admin" on campana_alumno_envios;
create policy "campana_alumno_envios admin" on campana_alumno_envios for all using (es_admin()) with check (es_admin());

-- ---------------------------------------------------------------------------
-- Kit clínico → Prospectos de alumnos (sin duplicar por correo).
-- ---------------------------------------------------------------------------
create or replace function alumnos_desde_kit(k kit_registros) returns void
language plpgsql security definer set search_path = public as $$
declare ex uuid; dato jsonb;
begin
  dato := jsonb_build_object('kit', true, 'kit_perfil', k.perfil, 'kit_fecha', k.creado_en, 'kit_utm', coalesce(k.utm, '{}'::jsonb));
  select id into ex from alumnos_prospectos where lower(correo) = lower(k.correo);
  if ex is null then
    insert into alumnos_prospectos (nombre, correo, telefono, origen, programa_interes, sin_promociones, lote, extra, creado_en)
    values (k.nombre, k.correo, k.whatsapp, 'anuncio', 'd-tcc', coalesce(k.baja, false), 'Kit clínico', dato, k.creado_en);
  else
    update alumnos_prospectos a set
      nombre = coalesce(a.nombre, k.nombre),
      telefono = coalesce(a.telefono, k.whatsapp),
      programa_interes = coalesce(a.programa_interes, 'd-tcc'),
      lote = coalesce(a.lote, 'Kit clínico'),
      extra = a.extra || dato,
      sin_promociones = a.sin_promociones or coalesce(k.baja, false)
     where a.id = ex;
  end if;
end; $$;
revoke all on function alumnos_desde_kit(kit_registros) from public;

create or replace function kit_a_alumnos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if lower(new.correo) <> 'ezquerrahector@gmail.com' then perform alumnos_desde_kit(new); end if;
  exception when others then
    null;   -- nunca rompe un registro del kit
  end;
  return new;
end; $$;
drop trigger if exists kit_a_alumnos on kit_registros;
create trigger kit_a_alumnos after insert or update of baja, whatsapp, nombre on kit_registros
  for each row execute function kit_a_alumnos();

-- Carga inicial de los registros que ya existen.
do $$ declare k kit_registros; begin
  for k in select * from kit_registros where lower(correo) <> 'ezquerrahector@gmail.com' order by creado_en loop
    perform alumnos_desde_kit(k);
  end loop;
end $$;

select 'ok' as resultado,
  (select count(*) from alumnos_prospectos) as personas,
  (select count(*) from alumnos_prospectos where extra ? 'kit') as del_kit;
