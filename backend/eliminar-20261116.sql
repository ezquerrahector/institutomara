-- Instituto Mara — Botones para eliminar callcenters, operadores y agentes (16 nov 2026).
-- Regla: si la persona (o el callcenter) no tiene comisiones, se borra de verdad.
-- Si ya tiene comisiones, se «archiva»: se desactiva y deja de aparecer en las listas,
-- pero su historial de comisiones y recibos se conserva. Se puede correr más de una vez.

alter table operadores  add column if not exists archivado boolean not null default false;
alter table callcenters add column if not exists archivado boolean not null default false;

/* Saca a un operador de todo lo que tiene abierto y lo borra o lo archiva. Uso interno. */
create or replace function _operador_quitar(p_operador uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare o operadores; hist boolean;
begin
  select * into o from operadores where id = p_operador;
  if not found then raise exception 'Ese operador ya no existe.'; end if;
  -- Lo que tenía asignado: si es de un callcenter, regresa a la bolsa del callcenter; si no, a administración.
  insert into callcenter_movimientos (prospecto_id, callcenter_id, operador_id, accion, nota)
    select id, callcenter_id, p_operador, case when callcenter_id is null then 'regresado' else 'a_bolsa' end, 'Se eliminó a ' || o.nombre
      from prospectos where asignado_a = p_operador;
  update prospectos set asignado_a = null where asignado_a = p_operador;
  update alumnos_prospectos set asignado_a = null where asignado_a = p_operador;
  hist := exists (select 1 from comisiones where operador_id = p_operador)
       or exists (select 1 from comision_cortes where operador_id = p_operador)
       or exists (select 1 from comision_ajustes where operador_id = p_operador);
  if o.usuario_id is not null then
    update perfiles set rol = 'alumno' where id = o.usuario_id and rol = 'operador';
  end if;
  if hist then
    update operadores set activo = false, archivado = true where id = p_operador;
    return 'archivado';
  end if;
  delete from operadores where id = p_operador;
  return 'eliminado';
end; $$;
revoke all on function _operador_quitar(uuid) from public, anon, authenticated;

/* Administración elimina a un operador interno o a un agente; el titular, solo a sus agentes. */
create or replace function operador_eliminar(p_operador uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare o operadores;
begin
  select * into o from operadores where id = p_operador;
  if not found then raise exception 'Ese operador ya no existe.'; end if;
  if es_admin() then
    if o.es_titular and o.callcenter_id is not null and exists (select 1 from callcenters where id = o.callcenter_id and not archivado) then
      raise exception 'Es el titular de un callcenter. Para quitarlo, elimina el callcenter completo.';
    end if;
  elsif es_titular() then
    if o.callcenter_id is distinct from mi_callcenter() or o.es_titular then
      raise exception 'Solo puedes eliminar a los agentes de tu equipo.';
    end if;
  else
    raise exception 'No tienes permiso para eliminar operadores.';
  end if;
  return _operador_quitar(p_operador);
end; $$;
revoke all on function operador_eliminar(uuid) from public, anon;
grant execute on function operador_eliminar(uuid) to authenticated;

/* Administración elimina un callcenter: todo su trabajo regresa a administración y su gente se va. */
create or replace function callcenter_eliminar(p_callcenter uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare k callcenters; n_pros int; n_alu int; r record; arch int := 0; borr int := 0; est text;
begin
  if not es_admin() then raise exception 'Solo administración elimina callcenters.'; end if;
  select * into k from callcenters where id = p_callcenter;
  if not found then raise exception 'Ese callcenter ya no existe.'; end if;
  insert into callcenter_movimientos (prospecto_id, callcenter_id, operador_id, accion, nota)
    select id, callcenter_id, asignado_a, 'recuperado', 'Se eliminó el callcenter' from prospectos where callcenter_id = p_callcenter;
  update prospectos set asignado_a = null, callcenter_id = null where callcenter_id = p_callcenter;
  get diagnostics n_pros = row_count;
  update alumnos_prospectos set asignado_a = null, callcenter_id = null where callcenter_id = p_callcenter;
  get diagnostics n_alu = row_count;
  for r in select id from operadores where callcenter_id = p_callcenter loop
    est := _operador_quitar(r.id);
    if est = 'archivado' then arch := arch + 1; else borr := borr + 1; end if;
  end loop;
  if arch > 0 or exists (select 1 from comision_cortes where callcenter_id = p_callcenter) then
    update callcenters set activo = false, archivado = true where id = p_callcenter;
    est := 'archivado';
  else
    delete from callcenters where id = p_callcenter;
    est := 'eliminado';
  end if;
  return jsonb_build_object('estado', est, 'prospectos', n_pros, 'alumnos', n_alu, 'personas_eliminadas', borr, 'personas_archivadas', arch);
end; $$;
revoke all on function callcenter_eliminar(uuid) from public, anon;
grant execute on function callcenter_eliminar(uuid) to authenticated;
