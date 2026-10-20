-- Instituto Mara — Reasignar operador con sus comisiones futuras (20 oct 2026)
-- Decisión de Héctor: al cambiar el operador de un prospecto que ya es empresa,
-- las comisiones que se generen DESDE AHORA son del operador nuevo.
--   · Las comisiones ya generadas (pagadas o no) se quedan con quien las ganó.
--   · Se mueve la empresa ligada (empresas.operador_id) y sus planes vigentes o en
--     trámite (empresas_planes.operador_id), que es de donde sale la comisión de
--     cada cobro, de «Agregar más lugares» y las copias de avisos al operador.
--   · «Quitar asignación» solo quita el prospecto de la consola; no deja a la
--     empresa sin operador ni toca comisiones.
-- Solo administración puede hacerlo (lo valida el servidor). Se puede volver a correr.

create or replace function asignar_prospectos(p_ids uuid[], p_operador uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not es_admin() then raise exception 'Solo administración asigna prospectos.'; end if;
  if p_operador is not null and not exists (select 1 from operadores where id = p_operador and activo) then
    raise exception 'Ese operador no existe o está inactivo.';
  end if;
  update prospectos set asignado_a = p_operador where id = any(p_ids);
  get diagnostics n = row_count;

  if p_operador is not null then
    update empresas e set operador_id = p_operador
     where e.id in (select empresa_id from prospectos where id = any(p_ids) and empresa_id is not null)
       and e.operador_id is distinct from p_operador;
    update empresas_planes pl set operador_id = p_operador
     where pl.empresa_id in (select empresa_id from prospectos where id = any(p_ids) and empresa_id is not null)
       and pl.estado not in ('cancelado','vencido','rechazado')
       and pl.operador_id is distinct from p_operador;
  end if;
  return n;
end; $$;
revoke all on function asignar_prospectos(uuid[], uuid) from public, anon;
grant execute on function asignar_prospectos(uuid[], uuid) to authenticated;

-- Para la ficha: qué empresa y planes se moverían (solo administración).
create or replace function prospecto_empresa_operador(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare e record; n int;
begin
  if not es_admin() then raise exception 'Solo administración.'; end if;
  select em.id, em.nombre, em.operador_id into e
    from prospectos p join empresas em on em.id = p.empresa_id where p.id = p_id;
  if e.id is null then return jsonb_build_object('empresa', null); end if;
  select count(*) into n from empresas_planes where empresa_id = e.id and estado not in ('cancelado','vencido','rechazado');
  return jsonb_build_object('empresa', e.nombre, 'operador_id', e.operador_id, 'planes', n);
end; $$;
revoke all on function prospecto_empresa_operador(uuid) from public, anon;
grant execute on function prospecto_empresa_operador(uuid) to authenticated;

select 'ok' as resultado;
