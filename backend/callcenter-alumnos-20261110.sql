-- ============================================================================
-- Instituto Mara — Callcenter, etapa 2: base de alumnos (10 nov 2026)
-- Se ejecuta DESPUÉS de callcenter-20261110.sql y prospectos-alumnos-20261020.sql.
-- Se puede correr más de una vez.
--
--   · Administración asigna personas de «Prospectos → Alumnos» a un operador
--     (interno o de callcenter) o a la bolsa de un callcenter. Nunca se asigna a
--     quien pidió no recibir promociones.
--   · El titular reparte (a mano o parejo); el agente llama desde su consola de
--     alumnos y registra cada llamada (resultado, siguiente fecha, grabación).
--   · «Pide que no le llamen» lo marca sin promociones y se cierra.
--   · Comisión: si la persona compra (curso, diplomado, membresía o regalo pagado)
--     estando asignada a un operador que le llamó en los últimos 30 días, ese
--     operador gana el 20 % de lo pagado sin IVA (Ajustes). Entra al recibo a los
--     15 días (garantía). El recibo de un callcenter sale a nombre de su titular.
--   · Misma caducidad, bitácora, movimientos y evaluación que la base de empresas.
-- ============================================================================

-- 1. Columnas y ajustes ----------------------------------------------------------
alter table alumnos_prospectos add column if not exists asignado_a uuid references operadores(id) on delete set null;
alter table alumnos_prospectos add column if not exists asignado_en timestamptz;
alter table alumnos_prospectos add column if not exists callcenter_id uuid references callcenters(id) on delete set null;
alter table alumnos_prospectos add column if not exists callcenter_en timestamptz;
alter table alumnos_prospectos add column if not exists proxima_llamada timestamptz;
alter table alumnos_prospectos add column if not exists ultima_llamada timestamptz;
alter table alumnos_prospectos add column if not exists llamadas_intentos int not null default 0;
alter table alumnos_prospectos add column if not exists ultimo_resultado text;
create index if not exists alumnos_prospectos_asignado on alumnos_prospectos (asignado_a);
create index if not exists alumnos_prospectos_cc on alumnos_prospectos (callcenter_id);

alter table alumnos_contactos add column if not exists grabacion text;

alter table ajustes add column if not exists alumno_comision_pct numeric not null default 20;
alter table ajustes add column if not exists alumno_ventana_dias int not null default 30;
alter table ajustes add column if not exists alumno_dias_espera int not null default 15;

-- Movimientos, bitácora y evaluaciones también para personas.
alter table callcenter_movimientos alter column prospecto_id drop not null;
alter table callcenter_movimientos add column if not exists persona_id uuid references alumnos_prospectos(id) on delete cascade;
create index if not exists callcenter_mov_persona on callcenter_movimientos (persona_id, fecha desc);
alter table prospecto_consultas alter column prospecto_id drop not null;
alter table prospecto_consultas add column if not exists persona_id uuid references alumnos_prospectos(id) on delete cascade;
alter table llamada_evaluaciones alter column contacto_id drop not null;
alter table llamada_evaluaciones alter column prospecto_id drop not null;
alter table llamada_evaluaciones add column if not exists alumno_contacto_id uuid references alumnos_contactos(id) on delete cascade;
alter table llamada_evaluaciones add column if not exists persona_id uuid references alumnos_prospectos(id) on delete cascade;
create unique index if not exists llamada_eval_unica_alumno on llamada_evaluaciones (alumno_contacto_id, tipo) where alumno_contacto_id is not null;

-- Comisiones por venta a alumnos (en la misma tabla, para que entren a los mismos recibos).
alter table comisiones alter column plan_id drop not null;
alter table comisiones alter column plan_pago_id drop not null;
alter table comisiones add column if not exists pago_id uuid references pagos(id) on delete cascade;
alter table comisiones add column if not exists persona_id uuid references alumnos_prospectos(id) on delete set null;
alter table comisiones add column if not exists cobrado numeric;
alter table comisiones add column if not exists disponible_en timestamptz;
create unique index if not exists comisiones_pago_unico on comisiones (pago_id) where pago_id is not null;
alter table comisiones drop constraint if exists comisiones_tipo_check;
alter table comisiones add constraint comisiones_tipo_check check (tipo in ('inicial','recurrente','alumno'));

-- 2. Permisos -------------------------------------------------------------------
drop policy if exists "alumnos prospectos operador" on alumnos_prospectos;
create policy "alumnos prospectos operador" on alumnos_prospectos for select using (
  (asignado_a is not null and asignado_a = mi_operador()) or (es_titular() and callcenter_id is not null and callcenter_id = mi_callcenter()));
drop policy if exists "alumnos contactos operador" on alumnos_contactos;
create policy "alumnos contactos operador" on alumnos_contactos for select using (
  exists (select 1 from alumnos_prospectos a where a.id = persona_id
           and ((a.asignado_a is not null and a.asignado_a = mi_operador()) or (es_titular() and a.callcenter_id is not null and a.callcenter_id = mi_callcenter()))));

-- 3. Asignación -----------------------------------------------------------------
-- Mismo candado que en empresas: el callcenter sigue al operador.
create or replace function alumnos_asignacion_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.asignado_a is distinct from old.asignado_a then
    new.asignado_en := case when new.asignado_a is null then null else now() end;
    if new.asignado_a is not null then new.callcenter_id := (select callcenter_id from operadores where id = new.asignado_a); end if;
  end if;
  if new.callcenter_id is distinct from old.callcenter_id then
    new.callcenter_en := case when new.callcenter_id is null then null else now() end;
  end if;
  return new;
end; $$;
drop trigger if exists alumnos_asignacion_sync on alumnos_prospectos;
create trigger alumnos_asignacion_sync before update on alumnos_prospectos for each row execute function alumnos_asignacion_sync();

-- Administración: a un operador (interno o de callcenter) o recuperar (null).
create or replace function alumnos_asignar(p_ids uuid[], p_operador uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int; omitidos int; cc uuid;
begin
  if not es_admin() then raise exception 'Solo administración asigna personas.'; end if;
  if p_operador is null then
    insert into callcenter_movimientos (persona_id, prospecto_id, callcenter_id, accion)
      select id, null, callcenter_id, 'recuperado' from alumnos_prospectos where id = any(p_ids) and callcenter_id is not null;
    update alumnos_prospectos set asignado_a = null, callcenter_id = null where id = any(p_ids);
    get diagnostics n = row_count;
    return jsonb_build_object('asignados', n, 'omitidos', 0);
  end if;
  select o.callcenter_id into cc from operadores o where o.id = p_operador and o.activo;
  if not found then raise exception 'Ese operador no existe o está inactivo.'; end if;
  if cc is not null and not exists (select 1 from callcenters where id = cc and activo) then raise exception 'Ese callcenter está inactivo.'; end if;
  select count(*) into omitidos from alumnos_prospectos where id = any(p_ids) and sin_promociones;
  with movidos as (
    update alumnos_prospectos set asignado_a = p_operador
     where id = any(p_ids) and not sin_promociones and asignado_a is distinct from p_operador
    returning id)
  insert into callcenter_movimientos (persona_id, prospecto_id, callcenter_id, operador_id, accion)
    select id, null, cc, p_operador, case when cc is null then 'a_operador' else 'repartido' end from movidos;
  get diagnostics n = row_count;
  return jsonb_build_object('asignados', n, 'omitidos', omitidos);
end; $$;
revoke all on function alumnos_asignar(uuid[], uuid) from public, anon;
grant execute on function alumnos_asignar(uuid[], uuid) to authenticated;

-- Administración: a la bolsa de un callcenter.
create or replace function alumnos_asignar_a_callcenter(p_ids uuid[], p_callcenter uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int; omitidos int;
begin
  if not es_admin() then raise exception 'Solo administración asigna personas.'; end if;
  if not exists (select 1 from callcenters where id = p_callcenter and activo) then raise exception 'Ese callcenter no existe o está inactivo.'; end if;
  select count(*) into omitidos from alumnos_prospectos where id = any(p_ids) and sin_promociones;
  with movidos as (
    update alumnos_prospectos set asignado_a = null, callcenter_id = p_callcenter
     where id = any(p_ids) and not sin_promociones and callcenter_id is distinct from p_callcenter
    returning id)
  insert into callcenter_movimientos (persona_id, prospecto_id, callcenter_id, accion)
    select id, null, p_callcenter, 'al_callcenter' from movidos;
  get diagnostics n = row_count;
  return jsonb_build_object('asignados', n, 'omitidos', omitidos);
end; $$;
revoke all on function alumnos_asignar_a_callcenter(uuid[], uuid) from public, anon;
grant execute on function alumnos_asignar_a_callcenter(uuid[], uuid) to authenticated;

-- Titular: repartir a un agente (o regresar a la bolsa con null).
create or replace function callcenter_alumnos_repartir(p_ids uuid[], p_operador uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare cc uuid := mi_callcenter(); n int;
begin
  if not es_titular() then raise exception 'Solo el titular del callcenter reparte.'; end if;
  if exists (select 1 from alumnos_prospectos where id = any(p_ids) and callcenter_id is distinct from cc) then
    raise exception 'Algunas personas ya no son de tu callcenter. Actualiza la pantalla.';
  end if;
  if p_operador is not null and not exists (select 1 from operadores where id = p_operador and callcenter_id = cc and activo) then
    raise exception 'Ese agente no es de tu equipo o está inactivo.';
  end if;
  with movidos as (
    update alumnos_prospectos set asignado_a = p_operador where id = any(p_ids) and asignado_a is distinct from p_operador returning id)
  insert into callcenter_movimientos (persona_id, prospecto_id, callcenter_id, operador_id, accion)
    select id, null, cc, p_operador, case when p_operador is null then 'a_bolsa' else 'repartido' end from movidos;
  get diagnostics n = row_count;
  return n;
end; $$;
revoke all on function callcenter_alumnos_repartir(uuid[], uuid) from public, anon;
grant execute on function callcenter_alumnos_repartir(uuid[], uuid) to authenticated;

-- Titular: reparto parejo de la bolsa (primero a quien tiene menos abiertos).
create or replace function callcenter_alumnos_parejo(p_incluir_titular boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cc uuid := mi_callcenter(); ags uuid[]; cargas int[]; i int; k int; menor int; pid uuid; total int := 0; salida jsonb := '{}'::jsonb;
begin
  if not es_titular() then raise exception 'Solo el titular del callcenter reparte.'; end if;
  select array_agg(o.id order by o.nombre),
         array_agg((select count(*)::int from alumnos_prospectos a where a.asignado_a = o.id and a.estado <> 'no_interesa') order by o.nombre)
    into ags, cargas
    from operadores o where o.callcenter_id = cc and o.activo and (p_incluir_titular or not o.es_titular);
  if ags is null then raise exception 'No tienes agentes activos para repartir.'; end if;
  for pid in select a.id from alumnos_prospectos a
              where a.callcenter_id = cc and a.asignado_a is null and a.estado <> 'no_interesa' and not a.sin_promociones
              order by a.creado_en
  loop
    k := 1; menor := cargas[1];
    for i in 2 .. array_length(ags, 1) loop
      if cargas[i] < menor then k := i; menor := cargas[i]; end if;
    end loop;
    update alumnos_prospectos set asignado_a = ags[k] where id = pid;
    insert into callcenter_movimientos (persona_id, prospecto_id, callcenter_id, operador_id, accion, nota) values (pid, null, cc, ags[k], 'repartido', 'Reparto parejo');
    cargas[k] := cargas[k] + 1; total := total + 1;
    salida := jsonb_set(salida, array[ags[k]::text], to_jsonb(coalesce((salida->>(ags[k]::text))::int, 0) + 1));
  end loop;
  return jsonb_build_object('repartidos', total, 'por_agente', salida);
end; $$;
revoke all on function callcenter_alumnos_parejo(boolean) from public, anon;
grant execute on function callcenter_alumnos_parejo(boolean) to authenticated;

-- Al desactivar un agente o un callcenter, sus personas también se liberan.
create or replace function alumnos_liberar_operador() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.activo and not new.activo then
    insert into callcenter_movimientos (persona_id, prospecto_id, callcenter_id, operador_id, accion, nota)
      select id, null, callcenter_id, null, case when callcenter_id is null then 'recuperado' else 'a_bolsa' end, 'Se desactivó a ' || new.nombre
        from alumnos_prospectos where asignado_a = new.id and estado <> 'no_interesa';
    update alumnos_prospectos set asignado_a = null where asignado_a = new.id and estado <> 'no_interesa';
  end if;
  return new;
end; $$;
drop trigger if exists alumnos_liberar_operador on operadores;
create trigger alumnos_liberar_operador after update of activo on operadores for each row execute function alumnos_liberar_operador();

create or replace function alumnos_liberar_callcenter() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.activo and not new.activo then
    insert into callcenter_movimientos (persona_id, prospecto_id, callcenter_id, accion, nota)
      select id, null, callcenter_id, 'recuperado', 'Se desactivó el callcenter' from alumnos_prospectos where callcenter_id = new.id;
    update alumnos_prospectos set asignado_a = null, callcenter_id = null where callcenter_id = new.id;
  end if;
  return new;
end; $$;
drop trigger if exists alumnos_liberar_callcenter on callcenters;
create trigger alumnos_liberar_callcenter after update of activo on callcenters for each row execute function alumnos_liberar_callcenter();

-- 4. Llamadas -------------------------------------------------------------------
create or replace function alumno_resultado_texto(p text) returns text language sql immutable as $$
  select case p
    when 'no_contesto' then 'No contestó' when 'buzon' then 'Buzón' when 'equivocado' then 'Número equivocado'
    when 'otro_dia' then 'Llamar otro día' when 'info_enviada' then 'Le mandé información' when 'interesado' then 'Interesado'
    when 'compro' then 'Dice que ya compró' when 'no_interesa' then 'No le interesa' when 'no_llamar' then 'Pide que no le llamen'
    else p end;
$$;

create or replace function alumnos_registrar_llamada(p_persona uuid, p_resultado text, p_comentario text default null,
                                                     p_proxima timestamptz default null, p_programa text default null, p_grabacion text default null)
returns alumnos_prospectos
language plpgsql security definer set search_path = public as $$
declare a alumnos_prospectos; fila alumnos_prospectos; prox timestamptz; est text;
begin
  select * into a from alumnos_prospectos where id = p_persona for update;
  if a.id is null then raise exception 'Persona no encontrada.'; end if;
  if not (es_admin() or (a.asignado_a is not null and a.asignado_a = mi_operador())) then raise exception 'Esta persona no está asignada a ti.'; end if;
  if a.sin_promociones and not es_admin() then raise exception 'Esta persona pidió que no la contacten.'; end if;
  if p_resultado not in ('no_contesto','buzon','equivocado','otro_dia','info_enviada','interesado','compro','no_interesa','no_llamar') then
    raise exception 'Elige el resultado de la llamada.';
  end if;
  if p_resultado in ('otro_dia','interesado') and p_proxima is null then raise exception 'Escribe la fecha y hora en que hay que volver a llamar.'; end if;
  prox := coalesce(p_proxima, case p_resultado
    when 'no_contesto' then dia_habil(1) when 'buzon' then dia_habil(2) when 'info_enviada' then dia_habil(3)
    when 'compro' then dia_habil(5) else null end);
  if p_resultado in ('equivocado','no_interesa','no_llamar') then prox := null; end if;
  est := case
    when p_resultado in ('no_interesa','no_llamar','equivocado') then 'no_interesa'
    when p_resultado in ('otro_dia','info_enviada','interesado') and a.estado in ('nuevo','contactado') then 'respondio'
    when a.estado = 'nuevo' then 'contactado'
    else a.estado end;
  insert into alumnos_contactos (persona_id, canal, sentido, resumen, resultado, creado_por, grabacion)
    values (a.id, 'llamada', 'saliente', nullif(btrim(coalesce(p_comentario, '')), ''), alumno_resultado_texto(p_resultado), auth.uid(),
            nullif(left(btrim(coalesce(p_grabacion, '')), 500), ''));
  update alumnos_prospectos set
    estado = case when estado = 'inscrito' and est <> 'no_interesa' then 'inscrito' else est end,
    llamadas_intentos = llamadas_intentos + 1, ultima_llamada = now(), ultimo_resultado = p_resultado, proxima_llamada = prox,
    programa_interes = coalesce(nullif(btrim(coalesce(p_programa, '')), ''), programa_interes),
    sin_promociones = case when p_resultado = 'no_llamar' then true else sin_promociones end,
    baja_en = case when p_resultado = 'no_llamar' then now() else baja_en end,
    actualizado_en = now()
   where id = a.id returning * into fila;
  return fila;
end; $$;
revoke all on function alumnos_registrar_llamada(uuid, text, text, timestamptz, text, text) from public, anon;
grant execute on function alumnos_registrar_llamada(uuid, text, text, timestamptz, text, text) to authenticated;

create or replace function alumnos_reprogramar(p_persona uuid, p_cuando timestamptz) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from alumnos_prospectos where id = p_persona and (es_admin() or asignado_a = mi_operador())) then
    raise exception 'Esta persona no está asignada a ti.';
  end if;
  update alumnos_prospectos set proxima_llamada = p_cuando, actualizado_en = now() where id = p_persona;
end; $$;
revoke all on function alumnos_reprogramar(uuid, timestamptz) from public, anon;
grant execute on function alumnos_reprogramar(uuid, timestamptz) to authenticated;

create or replace function alumno_consulta(p_persona uuid) returns void
language plpgsql security definer set search_path = public as $$
declare op uuid := mi_operador();
begin
  if es_admin() or op is null then return; end if;
  if not exists (select 1 from alumnos_prospectos a where a.id = p_persona and (a.asignado_a = op or (es_titular() and a.callcenter_id = mi_callcenter()))) then return; end if;
  if exists (select 1 from prospecto_consultas where persona_id = p_persona and usuario_id = auth.uid() and fecha > now() - interval '10 minutes') then return; end if;
  insert into prospecto_consultas (persona_id, usuario_id, operador_id) values (p_persona, auth.uid(), op);
end; $$;
revoke all on function alumno_consulta(uuid) from public, anon;
grant execute on function alumno_consulta(uuid) to authenticated;

-- 5. Lista con etiquetas: administración ve todo; el operador, lo suyo; el titular, su callcenter.
drop function if exists alumnos_prospectos_lista();
create or replace function alumnos_prospectos_lista()
returns table (id uuid, nombre text, correo text, telefono text, origen text, programa_interes text,
               estado text, sin_promociones boolean, baja_en timestamptz, usuario_id uuid, notas text,
               lote text, extra jsonb, creado_en timestamptz, actualizado_en timestamptz,
               etiquetas text[], cursos text[], ultimo_curso text, registrado_en timestamptz,
               ultimo_acceso timestamptz, constancias int, membresia_hasta timestamptz,
               asignado_a uuid, callcenter_id uuid, callcenter_en timestamptz, proxima_llamada timestamptz,
               ultima_llamada timestamptz, llamadas_intentos int, ultimo_resultado text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare adm boolean := es_admin(); yo uuid := mi_operador(); tit boolean := es_titular(); cc uuid := mi_callcenter();
begin
  if not adm and yo is null then raise exception 'Solo administración puede ver esta lista.'; end if;
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
         case when mem.hasta = 'infinity'::timestamptz then null else mem.hasta end,
         a.asignado_a, a.callcenter_id, a.callcenter_en, a.proxima_llamada, a.ultima_llamada, a.llamadas_intentos, a.ultimo_resultado
    from alumnos_prospectos a
    left join perfiles p on p.id = a.usuario_id
    left join ins on ins.usuario_id = a.usuario_id
    left join av on av.usuario_id = a.usuario_id
    left join mem on mem.usuario_id = a.usuario_id
    left join con on con.usuario_id = a.usuario_id
   where (p.id is null or p.rol not in ('admin', 'operador'))
     and (adm or a.asignado_a = yo or (tit and a.callcenter_id = cc))
   order by a.creado_en desc;
end; $$;
revoke all on function alumnos_prospectos_lista() from public;
grant execute on function alumnos_prospectos_lista() to authenticated;

-- 6. Comisión por venta a una persona asignada ------------------------------------
create or replace function comision_alumno_por_pago() returns trigger
language plpgsql security definer set search_path = public as $$
declare a alumnos_prospectos; aj ajustes; op operadores; base numeric; concepto text;
begin
  begin
    if coalesce(new.monto, 0) <= 0 or new.usuario_id is null then return new; end if;
    if coalesce(new.nota, '') ~* '^(REVISAR|Empresa:)' then return new; end if;
    select * into a from alumnos_prospectos where usuario_id = new.usuario_id and asignado_a is not null limit 1;
    if a.id is null then return new; end if;
    select * into op from operadores where id = a.asignado_a;
    if op.id is null or op.usuario_id is null then return new; end if;
    select * into aj from ajustes where id;
    -- Solo si su operador le llamó en la ventana (30 días).
    if not exists (select 1 from alumnos_contactos c where c.persona_id = a.id and c.canal = 'llamada' and c.creado_por = op.usuario_id
                    and c.fecha >= now() - make_interval(days => coalesce(aj.alumno_ventana_dias, 30))) then return new; end if;
    base := round(new.monto / 1.16, 2);
    concepto := coalesce(nullif(a.nombre, ''), a.correo, 'Alumno') || ' · ' ||
      coalesce((select c.nombre from cursos c where c.id = new.curso_id), case when coalesce(new.nota,'') ~* 'membres' then 'Membresía'
               when coalesce(new.nota,'') ~* 'regalo' then 'Regalo' else 'Compra' end);
    insert into comisiones (operador_id, plan_id, plan_pago_id, pago_id, persona_id, tipo, pct, base, monto, cobrado, nota, disponible_en)
      values (op.id, null, null, new.id, a.id, 'alumno', coalesce(aj.alumno_comision_pct, 20), base,
              round(base * coalesce(aj.alumno_comision_pct, 20) / 100, 2), new.monto, concepto,
              now() + make_interval(days => coalesce(aj.alumno_dias_espera, 15)))
      on conflict do nothing;
  exception when others then
    null;   -- nunca debe frenar el registro de un pago
  end;
  return new;
end; $$;
drop trigger if exists comision_alumno_por_pago on pagos;
create trigger comision_alumno_por_pago after insert on pagos for each row execute function comision_alumno_por_pago();

-- Administración cancela una comisión de alumno (reembolso dentro de la garantía).
create or replace function comision_alumno_cancelar(p_comision uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo administración.'; end if;
  update comisiones set cancelada_en = now(), monto_original = coalesce(monto_original, monto), monto = 0,
         nota = coalesce(nota, '') || ' · Cancelada' || coalesce(': ' || nullif(btrim(coalesce(p_motivo, '')), ''), '')
   where id = p_comision and tipo = 'alumno' and corte_id is null and cancelada_en is null;
  if not found then raise exception 'Esa comisión ya está en un recibo o ya estaba cancelada.'; end if;
end; $$;
revoke all on function comision_alumno_cancelar(uuid, text) from public, anon;
grant execute on function comision_alumno_cancelar(uuid, text) to authenticated;

-- Recibos: una comisión de alumno entra cuando termina su espera.
create or replace function comisiones_generar_cortes(p_hasta date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  hasta date := coalesce(p_hasta, corte_ultimo_cierre());
  limite timestamptz := ((hasta + 1)::timestamp at time zone 'America/Mexico_City');
  o operadores; k comision_cortes; previo date; s numeric; a numeric; desde date; salida jsonb := '[]'::jsonb; ids uuid[];
begin
  if auth.uid() is not null and not es_admin() then raise exception 'Solo administración.'; end if;
  for o in select * from operadores where callcenter_id is null or es_titular order by nombre loop
    ids := case when o.callcenter_id is null then array[o.id] else array(select id from operadores where callcenter_id = o.callcenter_id) end;
    select coalesce(sum(monto), 0) into s from comisiones
      where operador_id = any(ids) and corte_id is null and cancelada_en is null and coalesce(disponible_en, creado_en) < limite and monto <> 0;
    select coalesce(sum(monto), 0) into a from comision_ajustes
      where operador_id = any(ids) and corte_id is null and creado_en < limite;
    if s = 0 and a = 0 then continue; end if;
    if s + a <= 0 then continue; end if;
    if exists (select 1 from comision_cortes where operador_id = o.id and fecha_corte = hasta) then continue; end if;
    select max(periodo_hasta) into previo from comision_cortes where operador_id = o.id;
    desde := case when extract(day from hasta) = 15 then date_trunc('month', hasta)::date else date_trunc('month', hasta)::date + 15 end;
    if previo is not null and previo + 1 < desde then desde := previo + 1; end if;
    if previo is null then
      select least(desde, min((creado_en at time zone 'America/Mexico_City')::date)) into desde
        from (select creado_en from comisiones where operador_id = any(ids) and corte_id is null and cancelada_en is null and coalesce(disponible_en, creado_en) < limite
              union all select creado_en from comision_ajustes where operador_id = any(ids) and corte_id is null and creado_en < limite) t;
    end if;
    insert into comision_cortes (operador_id, callcenter_id, fecha_corte, periodo_desde, periodo_hasta, estado, titular, banco, clabe)
      values (o.id, o.callcenter_id, hasta, desde, hasta, 'enviado', o.titular, o.banco, o.clabe)
      returning * into k;
    update comisiones set corte_id = k.id
      where operador_id = any(ids) and corte_id is null and cancelada_en is null and coalesce(disponible_en, creado_en) < limite and monto <> 0;
    update comision_ajustes set corte_id = k.id where operador_id = any(ids) and corte_id is null and creado_en < limite;
    k := corte_recalcular(k.id);
    salida := salida || jsonb_build_object('id', k.id, 'operador_id', o.id, 'callcenter_id', o.callcenter_id, 'total', k.total, 'folio', k.folio);
  end loop;
  return jsonb_build_object('hasta', hasta, 'cortes', salida);
end; $$;

-- 7. Cifras de la base de alumnos por operador ----------------------------------------
create or replace function alumnos_metricas()
returns table (operador_id uuid, nombre text, activo boolean, asignados int, toca_hoy int, atrasadas int, sin_llamar int,
               llamadas_hoy int, llamadas_semana int, interesados int, ventas_mes int, vendido_mes numeric, comision_mes numeric)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  hoy date := (now() at time zone 'America/Mexico_City')::date;
  ini_hoy timestamptz := (hoy::timestamp at time zone 'America/Mexico_City');
  fin_hoy timestamptz := ((hoy + 1)::timestamp at time zone 'America/Mexico_City');
  ini_sem timestamptz := ((hoy - (extract(isodow from hoy)::int - 1))::timestamp at time zone 'America/Mexico_City');
  ini_mes timestamptz := (date_trunc('month', hoy)::timestamp at time zone 'America/Mexico_City');
  yo uuid := mi_operador(); adm boolean := es_admin(); tit boolean := es_titular(); cc uuid := mi_callcenter();
  ver_com boolean := adm or not es_agente_callcenter();
begin
  if not adm and yo is null then raise exception 'Solo administración y operadores.'; end if;
  return query
  with ops as (select o.* from operadores o where adm or o.id = yo or (tit and o.callcenter_id = cc)),
  pers as (select a.* from alumnos_prospectos a where a.asignado_a in (select id from ops)),
  ll as (select o.id as op, c.fecha from alumnos_contactos c join ops o on o.usuario_id = c.creado_por where c.canal = 'llamada' and c.fecha >= least(ini_sem, ini_mes)),
  cm as (select c.operador_id, c.monto, c.cobrado from comisiones c where c.tipo = 'alumno' and c.cancelada_en is null and c.creado_en >= ini_mes and c.operador_id in (select id from ops))
  select o.id, o.nombre, o.activo,
    (select count(*)::int from pers where asignado_a = o.id),
    (select count(*)::int from pers where asignado_a = o.id and estado <> 'no_interesa' and proxima_llamada >= ini_hoy and proxima_llamada < fin_hoy),
    (select count(*)::int from pers where asignado_a = o.id and estado <> 'no_interesa' and proxima_llamada < ini_hoy),
    (select count(*)::int from pers where asignado_a = o.id and estado <> 'no_interesa' and llamadas_intentos = 0),
    (select count(*)::int from ll where op = o.id and fecha >= ini_hoy),
    (select count(*)::int from ll where op = o.id and fecha >= ini_sem),
    (select count(*)::int from pers where asignado_a = o.id and ultimo_resultado in ('interesado','otro_dia','info_enviada') and estado <> 'inscrito'),
    (select count(*)::int from cm where cm.operador_id = o.id),
    coalesce((select sum(cobrado) from cm where cm.operador_id = o.id), 0),
    case when ver_com then coalesce((select sum(monto) from cm where cm.operador_id = o.id), 0) else 0 end
  from ops o
  order by o.activo desc, o.nombre;
end; $$;
revoke all on function alumnos_metricas() from public, anon;
grant execute on function alumnos_metricas() to authenticated;

-- 8. Evaluación: también llamadas a alumnos ---------------------------------------------
create or replace function evaluar_llamada(p_contacto uuid, p_apertura int, p_guion int, p_objeciones int, p_cierre int, p_registro int,
                                           p_comentario text default null)
returns llamada_evaluaciones
language plpgsql security definer set search_path = public as $$
declare c prospecto_contactos; ca alumnos_contactos; uid uuid; op uuid; t text; fila llamada_evaluaciones;
begin
  select * into c from prospecto_contactos where id = p_contacto and canal = 'llamada';
  if c.id is null then
    select * into ca from alumnos_contactos where id = p_contacto and canal = 'llamada';
    if ca.id is null then raise exception 'Llamada no encontrada.'; end if;
    uid := ca.creado_por;
  else uid := c.creado_por; end if;
  select id into op from operadores where usuario_id = uid limit 1;
  if op is null then raise exception 'Esa llamada no la registró un operador.'; end if;
  if es_admin() then t := 'auditoria';
  elsif es_de_mi_equipo(op) and op <> mi_operador() then t := 'titular';
  else raise exception 'No puedes evaluar esta llamada.'; end if;
  if c.id is not null then
    insert into llamada_evaluaciones (contacto_id, prospecto_id, operador_id, evaluador_id, tipo, apertura, guion, objeciones, cierre, registro, comentario)
      values (c.id, c.prospecto_id, op, auth.uid(), t, p_apertura, p_guion, p_objeciones, p_cierre, p_registro, nullif(btrim(coalesce(p_comentario, '')), ''))
      on conflict (contacto_id, tipo) do update set apertura = excluded.apertura, guion = excluded.guion, objeciones = excluded.objeciones,
        cierre = excluded.cierre, registro = excluded.registro, comentario = excluded.comentario, evaluador_id = auth.uid(), actualizado_en = now()
      returning * into fila;
  else
    select * into fila from llamada_evaluaciones where alumno_contacto_id = ca.id and tipo = t;
    if fila.id is null then
      insert into llamada_evaluaciones (alumno_contacto_id, persona_id, operador_id, evaluador_id, tipo, apertura, guion, objeciones, cierre, registro, comentario)
        values (ca.id, ca.persona_id, op, auth.uid(), t, p_apertura, p_guion, p_objeciones, p_cierre, p_registro, nullif(btrim(coalesce(p_comentario, '')), ''))
        returning * into fila;
    else
      update llamada_evaluaciones set apertura = p_apertura, guion = p_guion, objeciones = p_objeciones, cierre = p_cierre, registro = p_registro,
             comentario = nullif(btrim(coalesce(p_comentario, '')), ''), evaluador_id = auth.uid(), actualizado_en = now()
       where id = fila.id returning * into fila;
    end if;
  end if;
  return fila;
end; $$;
revoke all on function evaluar_llamada(uuid, int, int, int, int, int, text) from public, anon;
grant execute on function evaluar_llamada(uuid, int, int, int, int, int, text) to authenticated;

-- 9. Caducidad: también personas ----------------------------------------------------------
create or replace function callcenter_caducar() returns int
language plpgsql security definer set search_path = public as $$
declare dias int := coalesce((select callcenter_dias_caducidad from ajustes limit 1), 15); n int; m int; limite timestamptz;
begin
  if auth.uid() is not null and not es_admin() then raise exception 'Solo administración.'; end if;
  limite := now() - make_interval(days => dias);
  create temp table if not exists _caducan (id uuid, callcenter_id uuid, operador_id uuid) on commit drop;
  delete from _caducan;
  insert into _caducan
    select p.id, p.callcenter_id, p.asignado_a from prospectos p
     where p.callcenter_id is not null
       and p.estado not in ('no_interesa','descartado','baja','cliente')
       and greatest(p.callcenter_en, coalesce(p.ultima_llamada, p.callcenter_en)) < limite
       and (p.proxima_llamada is null or p.proxima_llamada < limite);
  insert into callcenter_movimientos (prospecto_id, callcenter_id, operador_id, accion, nota, por)
    select id, callcenter_id, operador_id, 'regresado', dias || ' días sin gestión', null from _caducan;
  update prospectos set asignado_a = null, callcenter_id = null where id in (select id from _caducan);
  get diagnostics n = row_count;
  with c as (
    select a.id, a.callcenter_id, a.asignado_a from alumnos_prospectos a
     where a.callcenter_id is not null and a.estado <> 'no_interesa'
       and greatest(a.callcenter_en, coalesce(a.ultima_llamada, a.callcenter_en)) < limite
       and (a.proxima_llamada is null or a.proxima_llamada < limite)),
  mv as (
    insert into callcenter_movimientos (persona_id, prospecto_id, callcenter_id, operador_id, accion, nota, por)
    select id, null, callcenter_id, asignado_a, 'regresado', dias || ' días sin gestión', null from c returning 1)
  update alumnos_prospectos set asignado_a = null, callcenter_id = null where id in (select id from c);
  get diagnostics m = row_count;
  return n + m;
end; $$;

-- 10. Resumen por callcenter con la base de alumnos ------------------------------------------
drop function if exists callcenter_resumen();
create or replace function callcenter_resumen()
returns table (callcenter_id uuid, nombre text, activo boolean, titular text, titular_correo text, agentes_activos int, agentes_total int,
               en_bolsa int, repartidos int, abiertos int, sin_llamar int, atrasadas int,
               llamadas_hoy int, llamadas_semana int, llamadas_mes int, conversaciones_mes int,
               pruebas_mes int, planes_activos int, regresados_30d int, evaluadas_mes int, calificacion_mes numeric,
               fichas_hoy int, comision_por_pagar numeric,
               alumnos_bolsa int, alumnos_abiertos int, alumnos_llamadas_hoy int, alumnos_ventas_mes int, alumnos_vendido_mes numeric)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  hoy date := (now() at time zone 'America/Mexico_City')::date;
  ini_hoy timestamptz := (hoy::timestamp at time zone 'America/Mexico_City');
  ini_sem timestamptz := ((hoy - (extract(isodow from hoy)::int - 1))::timestamp at time zone 'America/Mexico_City');
  ini_mes timestamptz := (date_trunc('month', hoy)::timestamp at time zone 'America/Mexico_City');
begin
  if auth.uid() is not null and not es_admin() then raise exception 'Solo administración.'; end if;
  return query
  select k.id, k.nombre, k.activo,
    (select o.nombre from operadores o where o.callcenter_id = k.id and o.es_titular limit 1),
    (select o.correo from operadores o where o.callcenter_id = k.id and o.es_titular limit 1),
    (select count(*)::int from operadores o where o.callcenter_id = k.id and o.activo),
    (select count(*)::int from operadores o where o.callcenter_id = k.id),
    (select count(*)::int from prospectos p where p.callcenter_id = k.id and p.asignado_a is null),
    (select count(*)::int from prospectos p where p.callcenter_id = k.id and p.asignado_a is not null),
    (select count(*)::int from prospectos p where p.callcenter_id = k.id and p.estado not in ('no_interesa','descartado','baja','cliente')),
    (select count(*)::int from prospectos p where p.callcenter_id = k.id and coalesce(p.llamadas_intentos, 0) = 0 and p.estado not in ('no_interesa','descartado','baja','cliente')),
    (select count(*)::int from prospectos p where p.callcenter_id = k.id and p.proxima_llamada < ini_hoy and p.estado not in ('no_interesa','descartado','baja','cliente')),
    (select count(*)::int from prospecto_contactos c join operadores o on o.usuario_id = c.creado_por where o.callcenter_id = k.id and c.canal = 'llamada' and c.fecha >= ini_hoy),
    (select count(*)::int from prospecto_contactos c join operadores o on o.usuario_id = c.creado_por where o.callcenter_id = k.id and c.canal = 'llamada' and c.fecha >= ini_sem),
    (select count(*)::int from prospecto_contactos c join operadores o on o.usuario_id = c.creado_por where o.callcenter_id = k.id and c.canal = 'llamada' and c.fecha >= ini_mes),
    (select count(*)::int from prospecto_contactos c join operadores o on o.usuario_id = c.creado_por where o.callcenter_id = k.id and c.canal = 'llamada' and c.fecha >= ini_mes and c.toque is not null),
    (select count(*)::int from empresas_planes pl join operadores o on o.id = pl.operador_id where o.callcenter_id = k.id and pl.estado = 'prueba' and pl.creado_en >= ini_mes),
    (select count(*)::int from empresas_planes pl join operadores o on o.id = pl.operador_id where o.callcenter_id = k.id and pl.estado = 'activo' and pl.vigente_hasta >= now()),
    (select count(*)::int from callcenter_movimientos m where m.callcenter_id = k.id and m.accion = 'regresado' and m.fecha >= now() - interval '30 days'),
    (select count(*)::int from llamada_evaluaciones e join operadores o on o.id = e.operador_id where o.callcenter_id = k.id and e.creado_en >= ini_mes),
    (select round(avg(e.total), 1) from llamada_evaluaciones e join operadores o on o.id = e.operador_id where o.callcenter_id = k.id and e.creado_en >= ini_mes),
    (select count(*)::int from prospecto_consultas q join operadores o on o.id = q.operador_id where o.callcenter_id = k.id and q.fecha >= ini_hoy),
    coalesce((select sum(c.monto) from comisiones c join operadores o on o.id = c.operador_id
               where o.callcenter_id = k.id and c.cancelada_en is null and (c.corte_id is null
                 or exists (select 1 from comision_cortes x where x.id = c.corte_id and x.estado <> 'pagado'))), 0),
    (select count(*)::int from alumnos_prospectos a where a.callcenter_id = k.id and a.asignado_a is null),
    (select count(*)::int from alumnos_prospectos a where a.callcenter_id = k.id and a.estado <> 'no_interesa'),
    (select count(*)::int from alumnos_contactos c join operadores o on o.usuario_id = c.creado_por where o.callcenter_id = k.id and c.canal = 'llamada' and c.fecha >= ini_hoy),
    (select count(*)::int from comisiones c join operadores o on o.id = c.operador_id where o.callcenter_id = k.id and c.tipo = 'alumno' and c.cancelada_en is null and c.creado_en >= ini_mes),
    coalesce((select sum(c.cobrado) from comisiones c join operadores o on o.id = c.operador_id where o.callcenter_id = k.id and c.tipo = 'alumno' and c.cancelada_en is null and c.creado_en >= ini_mes), 0)
  from callcenters k
  order by k.activo desc, k.nombre;
end; $$;
revoke all on function callcenter_resumen() from public, anon;
grant execute on function callcenter_resumen() to authenticated;

notify pgrst, 'reload schema';
select 'ok' as resultado;
