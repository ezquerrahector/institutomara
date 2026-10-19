-- ============================================================================
-- Instituto Mara — Empresas del operador y extensión de la prueba (19 oct 2026)
-- Se ejecuta DESPUÉS de llamadas-20261019.sql. Se puede correr más de una vez.
--
--   · El operador pide «15 días más» para la prueba de una de sus empresas
--     (escalón 5 de la escalera de descuentos); administración aprueba o rechaza.
--   · Al aprobar, se alargan el acceso de quienes ya activaron su lugar y el plazo
--     de los lugares que aún no se activan.
-- ============================================================================

alter table empresas_compras add column if not exists extension_dias int;
alter table empresas_compras add column if not exists extension_motivo text;
alter table empresas_compras add column if not exists extension_estado text;
alter table empresas_compras add column if not exists extension_por uuid references perfiles(id) on delete set null;
alter table empresas_compras add column if not exists extension_en timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'empresas_compras_extension_check') then
    alter table empresas_compras add constraint empresas_compras_extension_check
      check (extension_estado is null or extension_estado in ('pendiente','aprobada','rechazada'));
  end if;
end $$;

-- El operador (o administración) pide más días para una prueba.
create or replace function piloto_solicitar_extension(p_compra uuid, p_dias int default 15, p_motivo text default null)
returns empresas_compras
language plpgsql security definer set search_path = public as $$
declare k empresas_compras; fila empresas_compras;
begin
  select * into k from empresas_compras where id = p_compra;
  if k.id is null or k.estado <> 'piloto' then raise exception 'Esa prueba ya no está activa.'; end if;
  if k.empresa_id is null or not puede_operar_empresa(k.empresa_id) then raise exception 'No tienes acceso a esta empresa.'; end if;
  if k.extension_estado = 'pendiente' then raise exception 'Ya hay una solicitud esperando respuesta de administración.'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 30 then raise exception 'La extensión va de 1 a 30 días.'; end if;
  if nullif(btrim(coalesce(p_motivo,'')), '') is null then raise exception 'Escribe por qué la empresa necesita más días.'; end if;
  update empresas_compras set extension_dias = p_dias, extension_motivo = btrim(p_motivo), extension_estado = 'pendiente',
         extension_por = auth.uid(), extension_en = now()
   where id = p_compra
  returning * into fila;
  return fila;
end; $$;
revoke all on function piloto_solicitar_extension(uuid, int, text) from public, anon;
grant execute on function piloto_solicitar_extension(uuid, int, text) to authenticated;

-- Administración aprueba (y aplica) o rechaza. También sirve para extender directo.
create or replace function piloto_resolver_extension(p_compra uuid, p_aprobar boolean, p_dias int default null)
returns empresas_compras
language plpgsql security definer set search_path = public as $$
declare k empresas_compras; fila empresas_compras; d int;
begin
  if not es_admin() then raise exception 'Solo administración aprueba extensiones.'; end if;
  select * into k from empresas_compras where id = p_compra;
  if k.id is null or k.estado <> 'piloto' then raise exception 'Esa prueba ya no está activa.'; end if;
  d := coalesce(p_dias, k.extension_dias, 15);
  if p_aprobar then
    if d < 1 or d > 60 then raise exception 'La extensión va de 1 a 60 días.'; end if;
    -- Quienes ya activaron: su acceso se alarga a partir de su fecha actual (o de hoy, si ya venció).
    update inscripciones i set vence = greatest(coalesce(i.vence, current_date), current_date) + d
      from empresas_codigos c
     where c.compra_id = k.id and c.usuario_id is not null
       and i.usuario_id = c.usuario_id and i.curso_id = c.curso_id and i.estatus = 'piloto';
    -- Lugares sin activar: más plazo para activarlos.
    update cupones set vence = greatest(coalesce(vence, current_date), current_date) + d
     where codigo in (select codigo from empresas_codigos where compra_id = k.id) and usos = 0;
  end if;
  update empresas_compras set extension_estado = case when p_aprobar then 'aprobada' else 'rechazada' end,
         extension_dias = case when p_aprobar then d else extension_dias end,
         nota = coalesce(nota, '') || case when p_aprobar then ' · Extendida ' || d || ' días el ' || to_char(current_date, 'DD/MM/YYYY') else '' end
   where id = p_compra
  returning * into fila;
  return fila;
end; $$;
revoke all on function piloto_resolver_extension(uuid, boolean, int) from public, anon;
grant execute on function piloto_resolver_extension(uuid, boolean, int) to authenticated;

select 'ok' as resultado;
