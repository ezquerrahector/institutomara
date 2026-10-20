-- ============================================================================
-- Instituto Mara — Cobro con tarjeta rechazado (19 oct 2026)
-- Se ejecuta DESPUÉS de cambio-rango-20261019.sql. Se puede correr más de una vez.
--
-- Decisiones de Héctor:
--   · Si Mercado Pago no puede cobrar la mensualidad de un plan con tarjeta, la
--     empresa recibe un correo con «Actualizar forma de pago»: una liga para
--     registrar otra tarjeta (nueva suscripción; la anterior se cancela al
--     autorizarla). Se cobra la mensualidad pendiente y el plan sigue igual.
--   · Dos avisos: al detectarlo (empresa + copia al operador y a administración)
--     y el día que pierden el acceso (solo la empresa).
--   · Quien administra la empresa ve una etiqueta arriba de la plataforma.
--   · Se detecta con el aviso de rechazo de Mercado Pago y, por si no llega, con la
--     revisión diaria: plan con tarjeta que ya pasó un día de su fecha de cobro sin pago.
-- ============================================================================

alter table empresas_planes add column if not exists cobro_fallido_en timestamptz;     -- último rechazo detectado
alter table empresas_planes add column if not exists aviso_fallo_para timestamptz;     -- vigencia a la que se refería el 1.er aviso
alter table empresas_planes add column if not exists aviso_corte_para timestamptz;     -- … y el de «ya no tienen acceso»
alter table empresas_planes add column if not exists tarjeta_pre text;                 -- suscripción nueva por autorizar
alter table empresas_planes add column if not exists tarjeta_liga text;
alter table empresas_planes add column if not exists tarjeta_monto numeric;

-- ¿El plan con tarjeta tiene un cobro pendiente que no entró? tarjeta | tarjeta_vencido | null
create or replace function plan_fase_cobro(p empresas_planes) returns text
language sql stable security definer set search_path = public as $$
  select case
    when p.periodo <> 'mensual' or p.mp_preapproval_id is null or p.estado not in ('activo','vencido')
         or p.cancelado_en is not null or p.convertida_en is not null or coalesce(p.pagos_aprobados, 0) < 1 or p.vigente_hasta is null then null
    when exists (select 1 from empresas_planes q where q.empresa_id = p.empresa_id and q.id <> p.id
                   and q.estado = 'activo' and q.vigente_hasta > p.vigente_hasta) then null
    when p.vigente_hasta < now() - interval '30 days' then null
    when not ((p.cobro_fallido_en is not null and p.cobro_fallido_en > coalesce(p.periodo_inicio, p.inicio, '-infinity'))
              or now() >= p.vigente_hasta - interval '2 days') then null
    when p.vigente_hasta < now() then 'tarjeta_vencido'
    else 'tarjeta' end;
$$;

-- Etiqueta para quien administra la empresa: renovaciones y cobros con tarjeta pendientes.
drop function if exists mis_renovaciones();
create or replace function mis_renovaciones()
returns table (plan_id uuid, empresa_id uuid, empresa text, rango_texto text, periodo text, situacion text,
               fin timestamptz, acceso_hasta timestamptz, monto numeric, liga text)
language sql stable security definer set search_path = public as $$
  select p.id, e.id, e.nombre, p.rango_texto, p.periodo, coalesce(plan_fase_renovacion(p), plan_fase_cobro(p)),
         p.vigente_hasta - interval '3 days', p.vigente_hasta, plan_siguiente_monto(p),
         case
           when plan_fase_cobro(p) is not null then
             case when p.tarjeta_liga is not null and p.tarjeta_monto = plan_siguiente_monto(p) then p.tarjeta_liga end
           when p.renovar_liga is not null and p.renovar_vence > now() + interval '1 hour'
                and p.renovar_para = p.vigente_hasta and p.renovar_monto = plan_siguiente_monto(p) then p.renovar_liga end
  from empresas_planes p join empresas e on e.id = p.empresa_id
  where es_admin_empresa(p.empresa_id) and coalesce(plan_fase_renovacion(p), plan_fase_cobro(p)) is not null
  order by p.vigente_hasta;
$$;
revoke all on function mis_renovaciones() from public, anon;
grant execute on function mis_renovaciones() to authenticated;

notify pgrst, 'reload schema';
select 'ok' as resultado;
