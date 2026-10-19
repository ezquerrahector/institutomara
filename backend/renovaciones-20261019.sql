-- ============================================================================
-- Instituto Mara — Avisos de renovación de planes (19 oct 2026)
-- Se ejecuta DESPUÉS de empresas-en-linea-20261019.sql. Se puede correr más de una vez.
--
-- Decisiones de Héctor:
--   · Los planes que no se cobran solos (anuales y los mensuales pagados por
--     transferencia) avisan a la empresa 7 días antes de vencer (con copia a Héctor)
--     y el día que vence. Cada aviso lleva el monto y una liga de Mercado Pago para
--     pagar el siguiente periodo; si prefieren transferir, responden el correo.
--   · Quien administra la empresa ve una etiqueta arriba de la plataforma: por vencer,
--     en los 3 días de gracia, o vencido (ya sin acceso).
--   · Las suscripciones mensuales con tarjeta no avisan (se cobran solas), ni los
--     planes que la empresa canceló.
--   · Los correos los manda la tarea diaria de «tienda» (avisosRenovacion).
-- ============================================================================

alter table empresas_planes add column if not exists cancelado_en timestamptz;
alter table empresas_planes add column if not exists aviso7_para timestamptz;      -- vigencia a la que se refería el aviso de 7 días
alter table empresas_planes add column if not exists aviso0_para timestamptz;      -- … y el del día que vence
alter table empresas_planes add column if not exists renovar_liga text;
alter table empresas_planes add column if not exists renovar_vence timestamptz;
alter table empresas_planes add column if not exists renovar_monto numeric;
alter table empresas_planes add column if not exists renovar_para timestamptz;     -- vigencia que renueva esa liga

update empresas_planes set cancelado_en = coalesce(actualizado_en, now()) where estado = 'cancelado' and cancelado_en is null;
create or replace function plan_marcar_cancelado() returns trigger
language plpgsql as $$
begin
  if new.estado = 'cancelado' and old.estado is distinct from 'cancelado' then new.cancelado_en := now(); end if;
  return new;
end; $$;
drop trigger if exists plan_cancelado on empresas_planes;
create trigger plan_cancelado before update of estado on empresas_planes
  for each row execute function plan_marcar_cancelado();

-- Lo que toca cobrar en el siguiente pago.
create or replace function plan_siguiente_monto(p empresas_planes) returns numeric
language sql immutable as $$
  select case
    when p.periodo = 'anual' then case when coalesce(p.pagos_aprobados, 0) = 0 then p.monto_inicial else p.precio_lista end
    when coalesce(p.pagos_aprobados, 0) + 1 <= coalesce(p.descuento_meses, 0) or coalesce(p.pagos_aprobados, 0) = 0 then p.monto_inicial
    else p.precio_lista end;
$$;

-- ¿Este plan se renueva a mano (no lo cobra sola una suscripción)?
create or replace function plan_renueva_a_mano(p empresas_planes) returns boolean
language sql immutable as $$
  select p.periodo = 'anual' or p.mp_preapproval_id is null;
$$;

-- Fase del plan frente a su vencimiento. El periodo pagado termina 3 días antes de
-- «vigente_hasta» (esos 3 días son de gracia).
create or replace function plan_fase_renovacion(p empresas_planes) returns text
language sql stable as $$
  select case
    when p.estado not in ('activo','vencido') or p.cancelado_en is not null or p.convertida_en is not null
         or coalesce(p.pagos_aprobados, 0) < 1 or p.vigente_hasta is null or not plan_renueva_a_mano(p) then null
    when exists (select 1 from empresas_planes q where q.empresa_id = p.empresa_id and q.id <> p.id
                   and q.estado = 'activo' and q.vigente_hasta > p.vigente_hasta) then null
    when p.vigente_hasta < now() - interval '60 days' then null
    when p.vigente_hasta < now() then 'vencido'
    when p.vigente_hasta - interval '3 days' <= now() then 'gracia'
    when p.vigente_hasta - interval '3 days' <= now() + interval '7 days' then 'por_vencer'
    else null end;
$$;

-- Para la etiqueta: los planes por renovar de las empresas que administro.
drop function if exists mis_renovaciones();
create or replace function mis_renovaciones()
returns table (plan_id uuid, empresa_id uuid, empresa text, rango_texto text, periodo text, situacion text,
               fin timestamptz, acceso_hasta timestamptz, monto numeric, liga text)
language sql stable security definer set search_path = public as $$
  select p.id, e.id, e.nombre, p.rango_texto, p.periodo, plan_fase_renovacion(p),
         p.vigente_hasta - interval '3 days', p.vigente_hasta, plan_siguiente_monto(p),
         case when p.renovar_liga is not null and p.renovar_vence > now() + interval '1 hour'
                   and p.renovar_para = p.vigente_hasta and p.renovar_monto = plan_siguiente_monto(p) then p.renovar_liga end
  from empresas_planes p join empresas e on e.id = p.empresa_id
  where es_admin_empresa(p.empresa_id) and plan_fase_renovacion(p) is not null
  order by p.vigente_hasta;
$$;
revoke all on function mis_renovaciones() from public, anon;
grant execute on function mis_renovaciones() to authenticated;

notify pgrst, 'reload schema';
select 'ok' as resultado;
