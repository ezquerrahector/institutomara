-- ============================================================================
-- Instituto Mara — Prueba con todo el catálogo y supervisión de operadores (19 oct 2026)
-- Se ejecuta DESPUÉS de comisiones-20261019.sql. Se puede correr más de una vez.
--
-- Decisiones de Héctor:
--   · La prueba sin costo da TODO el catálogo (como el plan) por 15 días a 5 personas.
--     Ya no se eligen programas. Durante la prueba no hay constancia; si la empresa
--     contrata, cada persona conserva su avance y la constancia sale con las reglas
--     del plan (cursos desde el 1.er pago; diplomados con 2 pagos).
--   · La prueba es un «plan» con estado «prueba»: mismos lugares por nombre y correo.
--     Al primer pago del plan contratado, las personas de la prueba pasan a él.
--   · Las pruebas viejas (por programa, con códigos) siguen funcionando hasta que venzan.
--   · Supervisión: cifras por operador (hoy, atrasadas, llamadas, resultados, pruebas,
--     planes, comisiones) y correo diario a las 7:00 p. m. en días hábiles.
-- ============================================================================

-- 1. Estado «prueba» en los planes ------------------------------------------------
do $$
declare r record;
begin
  for r in select conname from pg_constraint
            where conrelid = 'empresas_planes'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%estado%'
  loop execute format('alter table empresas_planes drop constraint %I', r.conname); end loop;
end $$;
alter table empresas_planes add constraint empresas_planes_estado_check
  check (estado in ('por_aprobar','rechazado','pendiente_pago','activo','cancelado','vencido','prueba'));
alter table empresas_planes add column if not exists prueba_dias int;
alter table empresas_planes add column if not exists convertida_en timestamptz;      -- la prueba pasó a un plan pagado
alter table empresas_planes add column if not exists extension_dias int;
alter table empresas_planes add column if not exists extension_motivo text;
alter table empresas_planes add column if not exists extension_estado text check (extension_estado is null or extension_estado in ('pendiente','aprobada','rechazada'));
alter table empresas_planes add column if not exists extension_por uuid references perfiles(id) on delete set null;
alter table empresas_planes add column if not exists extension_en timestamptz;
alter table empresas_plan_lugares add column if not exists invitado_en timestamptz;

-- Crear la prueba: todo el catálogo, N personas, D días. El operador: hasta 5 y 15, una por empresa.
create or replace function plan_crear_prueba(p_empresa uuid, p_lugares int default 5, p_dias int default 15, p_nota text default null)
returns empresas_planes
language plpgsql security definer set search_path = public as $$
declare e empresas; r planes_rangos; fila empresas_planes; adm text;
begin
  if not puede_operar_empresa(p_empresa) then raise exception 'No tienes acceso a esta empresa.'; end if;
  select * into e from empresas where id = p_empresa;
  if e.id is null then raise exception 'Empresa no encontrada.'; end if;
  if p_lugares is null or p_lugares < 1 or p_lugares > 50 then raise exception 'La prueba va de 1 a 50 personas.'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 60 then raise exception 'La prueba dura de 1 a 60 días.'; end if;
  if not es_admin() then
    if p_lugares > 5 or p_dias > 15 then raise exception 'La prueba del operador es de hasta 5 personas y 15 días.'; end if;
    if exists (select 1 from empresas_planes where empresa_id = p_empresa and estado = 'prueba')
       or exists (select 1 from empresas_compras where empresa_id = p_empresa and estado = 'piloto') then
      raise exception 'Esta empresa ya tuvo su prueba. Si necesitan más días, pídelos con «Pedir más días».';
    end if;
  end if;
  if exists (select 1 from empresas_planes where empresa_id = p_empresa and estado = 'prueba' and vigente_hasta >= now()) then
    raise exception 'Esta empresa ya tiene una prueba activa.';
  end if;
  if exists (select 1 from empresas_planes where empresa_id = p_empresa and estado = 'activo' and vigente_hasta >= now()) then
    raise exception 'Esta empresa ya tiene un plan activo; no necesita prueba.';
  end if;
  select * into r from planes_rangos where activo and desde <= p_lugares and (hasta is null or hasta >= p_lugares) order by desde limit 1;
  select correo into adm from empresas_admins where empresa_id = e.id order by creado_en limit 1;
  insert into empresas_planes (empresa_id, rango_id, rango_texto, lugares, periodo, precio_lista, descuento_pct, descuento_meses,
                               monto_inicial, estado, operador_id, creado_por, admin_correo, nota, prueba_dias, vigente_hasta)
  values (e.id, r.id, 'Prueba sin costo · ' || p_lugares || case when p_lugares = 1 then ' persona' else ' personas' end,
          p_lugares, 'mensual', coalesce(r.precio_mensual, 0), 100, 0, 0, 'prueba', e.operador_id, auth.uid(),
          coalesce(adm, lower(e.contacto_correo)), nullif(btrim(coalesce(p_nota, '')), ''), p_dias,
          ((((now() at time zone 'America/Mexico_City')::date + p_dias + 1)::timestamp) at time zone 'America/Mexico_City'))
  returning * into fila;
  return fila;
end; $$;
revoke all on function plan_crear_prueba(uuid, int, int, text) from public, anon;
grant execute on function plan_crear_prueba(uuid, int, int, text) to authenticated;

-- 2. Acceso y constancia -----------------------------------------------------------
create or replace function plan_empresa_cubre(p_usuario uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from empresas_plan_lugares l join empresas_planes p on p.id = l.plan_id
                 where l.usuario_id = p_usuario and l.activo and p.estado in ('activo','cancelado','prueba') and p.vigente_hasta >= now());
$$;
grant execute on function plan_empresa_cubre(uuid) to authenticated;

-- ¿Ya pagó la empresa algún plan donde esta persona tiene (o tuvo) lugar? (para la constancia)
create or replace function plan_pagado_usuario(p_usuario uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from empresas_plan_lugares l join empresas_planes p on p.id = l.plan_id
                 where l.usuario_id = p_usuario and p.estado <> 'prueba' and p.pagos_aprobados >= 1);
$$;
grant execute on function plan_pagado_usuario(uuid) to authenticated;

drop policy if exists "constancias propias crea" on constancias;
create policy "constancias propias crea" on constancias for insert with check (
  es_admin()
  or (
    usuario_id = auth.uid()
    and exists (select 1 from inscripciones i where i.usuario_id = auth.uid() and i.curso_id = constancias.curso_id
                and i.estatus <> 'piloto'
                and (i.estatus <> 'membresia' or membresia_permite_constancia(auth.uid(), constancias.curso_id))
                and (i.estatus <> 'empresa'
                     or (plan_pagado_usuario(auth.uid())
                         and (coalesce((select c.nivel from cursos c where c.id = constancias.curso_id), '') <> 'Diplomados'
                              or plan_permite_constancia(auth.uid())))))
  )
);

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
    where l.usuario_id = auth.uid() and l.activo and p.estado in ('activo','cancelado','pendiente_pago','prueba')
    order by (p.estado = 'activo') desc, coalesce(p.vigente_hasta >= now(), false) desc, p.vigente_hasta desc nulls last
    limit 1;
end; $$;
revoke all on function mi_plan_empresa() from public;
grant execute on function mi_plan_empresa() to authenticated;

-- 3. Lugares de la prueba ---------------------------------------------------------
create or replace function plan_asignar_lugar(p_plan uuid, p_nombre text, p_correo text)
returns empresas_plan_lugares
language plpgsql security definer set search_path = public as $$
declare p empresas_planes; fila empresas_plan_lugares; limpio text := lower(btrim(coalesce(p_correo,''))); uid uuid; usados int;
begin
  select * into p from empresas_planes where id = p_plan;
  if p.id is null then raise exception 'Plan no encontrado.'; end if;
  if not (puede_operar_empresa(p.empresa_id) or es_admin_empresa(p.empresa_id)) then raise exception 'No tienes acceso a esta empresa.'; end if;
  if p.estado not in ('pendiente_pago','activo','por_aprobar','prueba') then raise exception 'Este plan ya no está vigente.'; end if;
  if p.estado = 'prueba' and (p.vigente_hasta < now() or p.convertida_en is not null) then raise exception 'La prueba ya terminó.'; end if;
  if nullif(btrim(coalesce(p_nombre,'')), '') is null then raise exception 'Escribe el nombre de la persona.'; end if;
  if limpio !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisa el correo de la persona.'; end if;
  if exists (select 1 from empresas_plan_lugares where plan_id = p_plan and activo and lower(correo) = limpio) then
    raise exception 'Esa persona ya tiene un lugar.';
  end if;
  select count(*) into usados from empresas_plan_lugares where plan_id = p_plan and activo;
  if p.lugares is not null and usados >= p.lugares then
    raise exception 'Ya están ocupados los % lugares. Libera uno o cambia a un rango mayor.', p.lugares;
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

-- En la prueba, el lugar se puede cambiar mientras la persona no empiece; si ya empezó, queda fijo.
create or replace function plan_lugar_liberable_desde(l empresas_plan_lugares) returns timestamptz
language sql stable security definer set search_path = public as $$
  select case
    when l.iniciado_en is null then null
    when (select estado from empresas_planes where id = l.plan_id) = 'prueba' then (select vigente_hasta from empresas_planes where id = l.plan_id)
    when (select plan_periodo_inicio(p) from empresas_planes p where p.id = l.plan_id) > l.iniciado_en then null
    else (select case when p.periodo = 'mensual' then coalesce(p.vigente_hasta - interval '3 days', p.periodo_inicio + interval '1 month')
                      else plan_periodo_inicio(p) + interval '1 month' end
          from empresas_planes p where p.id = l.plan_id)
  end;
$$;

-- Al primer pago del plan contratado, las personas de la prueba pasan a él (conservan su avance).
create or replace function plan_heredar_prueba() returns trigger
language plpgsql security definer set search_path = public as $$
declare q empresas_planes; l empresas_plan_lugares; usados int;
begin
  if new.estado = 'activo' and coalesce(new.pagos_aprobados, 0) >= 1 and coalesce(old.pagos_aprobados, 0) = 0 then
    for q in select * from empresas_planes where empresa_id = new.empresa_id and estado = 'prueba' and convertida_en is null loop
      for l in select * from empresas_plan_lugares where plan_id = q.id and activo order by asignado_en loop
        select count(*) into usados from empresas_plan_lugares where plan_id = new.id and activo;
        if exists (select 1 from empresas_plan_lugares where plan_id = new.id and activo and lower(correo) = lower(l.correo))
           or (new.lugares is not null and usados >= new.lugares) then
          update empresas_plan_lugares set activo = false, liberado_en = now() where id = l.id;
        else
          update empresas_plan_lugares set plan_id = new.id where id = l.id;
        end if;
      end loop;
      update empresas_planes set convertida_en = now(), vigente_hasta = least(vigente_hasta, now()), actualizado_en = now() where id = q.id;
    end loop;
  end if;
  return new;
end; $$;
drop trigger if exists plan_hereda_prueba on empresas_planes;
create trigger plan_hereda_prueba after update of pagos_aprobados on empresas_planes
  for each row execute function plan_heredar_prueba();

-- 4. Más días de prueba -------------------------------------------------------------
create or replace function prueba_solicitar_extension(p_plan uuid, p_dias int default 15, p_motivo text default null)
returns empresas_planes
language plpgsql security definer set search_path = public as $$
declare p empresas_planes; fila empresas_planes;
begin
  select * into p from empresas_planes where id = p_plan;
  if p.id is null or p.estado <> 'prueba' or p.convertida_en is not null then raise exception 'Esa prueba ya no está activa.'; end if;
  if not puede_operar_empresa(p.empresa_id) then raise exception 'No tienes acceso a esta empresa.'; end if;
  if p.extension_estado = 'pendiente' then raise exception 'Ya hay una solicitud esperando respuesta de administración.'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 30 then raise exception 'La extensión va de 1 a 30 días.'; end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then raise exception 'Escribe por qué la empresa necesita más días.'; end if;
  update empresas_planes set extension_dias = p_dias, extension_motivo = btrim(p_motivo), extension_estado = 'pendiente',
         extension_por = auth.uid(), extension_en = now(), actualizado_en = now()
   where id = p_plan returning * into fila;
  return fila;
end; $$;
revoke all on function prueba_solicitar_extension(uuid, int, text) from public, anon;
grant execute on function prueba_solicitar_extension(uuid, int, text) to authenticated;

create or replace function prueba_resolver_extension(p_plan uuid, p_aprobar boolean, p_dias int default null)
returns empresas_planes
language plpgsql security definer set search_path = public as $$
declare p empresas_planes; fila empresas_planes; d int;
begin
  if not es_admin() then raise exception 'Solo administración aprueba extensiones.'; end if;
  select * into p from empresas_planes where id = p_plan;
  if p.id is null or p.estado <> 'prueba' or p.convertida_en is not null then raise exception 'Esa prueba ya no está activa.'; end if;
  d := coalesce(p_dias, p.extension_dias, 15);
  if p_aprobar and (d < 1 or d > 60) then raise exception 'La extensión va de 1 a 60 días.'; end if;
  update empresas_planes set
         extension_estado = case when p_aprobar then 'aprobada' else 'rechazada' end,
         extension_dias = case when p_aprobar then d else extension_dias end,
         vigente_hasta = case when p_aprobar then greatest(vigente_hasta, now()) + make_interval(days => d) else vigente_hasta end,
         nota = case when p_aprobar then coalesce(nota || ' · ', '') || 'Extendida ' || d || ' días el ' || to_char(now() at time zone 'America/Mexico_City', 'DD/MM/YYYY') else nota end,
         actualizado_en = now()
   where id = p_plan returning * into fila;
  return fila;
end; $$;
revoke all on function prueba_resolver_extension(uuid, boolean, int) from public, anon;
grant execute on function prueba_resolver_extension(uuid, boolean, int) to authenticated;

-- 5. Supervisión de operadores -------------------------------------------------------
-- Cifras por operador. Administración ve a todos; el operador, solo las suyas.
create or replace function operador_metricas(p_operador uuid default null)
returns table (operador_id uuid, nombre text, activo boolean,
               toca_hoy int, sin_llamar int, atrasadas int, asignadas int,
               llamadas_hoy int, llamadas_semana int, llamadas_mes int,
               conversaciones_mes int, resultados_hoy jsonb, resultados_mes jsonb,
               pruebas_mes int, pruebas_activas int, planes_mes int, planes_activos int,
               comision_mes numeric, comision_por_cobrar numeric, ultima_actividad timestamptz,
               atrasadas_lista jsonb)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  hoy date := (now() at time zone 'America/Mexico_City')::date;
  ini_hoy timestamptz := (hoy::timestamp at time zone 'America/Mexico_City');
  fin_hoy timestamptz := ((hoy + 1)::timestamp at time zone 'America/Mexico_City');
  ini_sem timestamptz := ((hoy - (extract(isodow from hoy)::int - 1))::timestamp at time zone 'America/Mexico_City');
  ini_mes timestamptz := (date_trunc('month', hoy)::timestamp at time zone 'America/Mexico_City');
  yo uuid := mi_operador();
begin
  if not es_admin() and yo is null and auth.uid() is not null then raise exception 'Solo administración y operadores.'; end if;
  return query
  with ops as (
    select o.* from operadores o
    where (es_admin() or auth.uid() is null or o.id = yo)
      and (p_operador is null or o.id = p_operador)
  ),
  pros as (
    select pr.*, (pr.estado in ('no_interesa','descartado','baja','cliente')) as cerrado from prospectos pr where pr.asignado_a in (select id from ops)
  ),
  ll as (
    select o.id as op, c.* from prospecto_contactos c join ops o on o.usuario_id = c.creado_por
    where c.canal = 'llamada' and c.fecha >= least(ini_mes, ini_sem)
  )
  select o.id, o.nombre, o.activo,
    (select count(*)::int from pros where asignado_a = o.id and not cerrado and proxima_llamada >= ini_hoy and proxima_llamada < fin_hoy),
    (select count(*)::int from pros where asignado_a = o.id and not cerrado and coalesce(llamadas_intentos, 0) = 0 and proxima_llamada is null),
    (select count(*)::int from pros where asignado_a = o.id and not cerrado and proxima_llamada < ini_hoy),
    (select count(*)::int from pros where asignado_a = o.id),
    (select count(*)::int from ll where op = o.id and fecha >= ini_hoy),
    (select count(*)::int from ll where op = o.id and fecha >= ini_sem),
    (select count(*)::int from ll where op = o.id and fecha >= ini_mes),
    (select count(*)::int from ll where op = o.id and fecha >= ini_mes and toque is not null),
    coalesce((select jsonb_object_agg(r, n) from (select coalesce(resultado, '—') r, count(*) n from ll where op = o.id and fecha >= ini_hoy group by 1) x), '{}'::jsonb),
    coalesce((select jsonb_object_agg(r, n) from (select coalesce(resultado, '—') r, count(*) n from ll where op = o.id and fecha >= ini_mes group by 1) x), '{}'::jsonb),
    ((select count(*)::int from empresas_planes p where p.operador_id = o.id and p.estado = 'prueba' and p.creado_en >= ini_mes)
      + (select count(*)::int from empresas_compras k join empresas e on e.id = k.empresa_id where e.operador_id = o.id and k.medio = 'piloto' and k.creado_en >= ini_mes)),
    (select count(*)::int from empresas_planes p where p.operador_id = o.id and p.estado = 'prueba' and p.convertida_en is null and p.vigente_hasta >= now()),
    (select count(*)::int from empresas_planes p where p.operador_id = o.id and p.estado <> 'prueba' and p.inicio >= ini_mes),
    (select count(*)::int from empresas_planes p where p.operador_id = o.id and p.estado = 'activo' and p.vigente_hasta >= now()),
    coalesce((select sum(c.monto) from comisiones c where c.operador_id = o.id and c.creado_en >= ini_mes and c.cancelada_en is null), 0),
    coalesce((select sum(c.monto) from comisiones c where c.operador_id = o.id and c.cancelada_en is null and (c.corte_id is null
               or exists (select 1 from comision_cortes k where k.id = c.corte_id and k.estado <> 'pagado'))), 0)
      + coalesce((select sum(a.monto) from comision_ajustes a where a.operador_id = o.id and (a.corte_id is null
               or exists (select 1 from comision_cortes k where k.id = a.corte_id and k.estado <> 'pagado'))), 0),
    greatest((select max(fecha) from prospecto_contactos c where c.creado_por = o.usuario_id),
             (select ultimo_acceso from perfiles where id = o.usuario_id)),
    coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'nombre', coalesce(a.nombre_corto, a.nombre), 'proxima', a.proxima_llamada,
                     'estado', a.estado, 'resultado', a.ultimo_resultado, 'toque', a.llamada_toque, 'telefono', a.telefono,
                     'comentario', (select c.resumen from prospecto_contactos c where c.prospecto_id = a.id and c.canal = 'llamada' order by c.fecha desc limit 1))
                     order by a.proxima_llamada)
              from (select * from pros where asignado_a = o.id and not cerrado and proxima_llamada < ini_hoy order by proxima_llamada limit 50) a), '[]'::jsonb)
  from ops o
  order by o.activo desc, o.nombre;
end; $$;
revoke all on function operador_metricas(uuid) from public, anon;
grant execute on function operador_metricas(uuid) to authenticated, service_role;

-- Correo diario de supervisión: días hábiles a las 7:00 p. m. (hora del centro de México = 01:00 UTC del día siguiente).
select cron.unschedule('mara-supervision') where exists (select 1 from cron.job where jobname = 'mara-supervision');
select cron.schedule('mara-supervision', '0 1 * * 2-6', $$
  select net.http_post(
    url := 'https://xvihjhfvwjgpesxpdtnl.supabase.co/functions/v1/tienda',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name='mara_service_role')),
    body := '{"accion":"supervision"}'::jsonb)
$$);

notify pgrst, 'reload schema';
select 'ok' as resultado;
