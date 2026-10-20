-- ============================================================================
-- Instituto Mara — Cambiar el número de personas de un plan (19 oct 2026)
-- Se ejecuta DESPUÉS de renovaciones-20261019.sql. Se puede correr más de una vez.
--
-- Decisiones de Héctor:
--   · Subir de rango: los lugares nuevos son de inmediato. Hoy se paga solo la
--     diferencia proporcional por lo que falta del periodo pagado; desde el
--     siguiente cobro, el precio del rango nuevo.
--   · Lo pueden hacer quien administra la empresa (en «Mi empresa», hasta 100
--     personas) y su operador o administración (cualquier rango).
--   · Comisión: 35 % (la «inicial» del plan) de la diferencia, para el operador que
--     atiende la empresa; después, 5 % mensual sobre el precio nuevo.
--   · Bajar de rango: desde el siguiente cobro, sin devolución. Si hay más personas
--     que el nuevo límite, la empresa elige a quiénes conservar. Se avisa al operador.
--   · Un descuento que siga corriendo conserva su porcentaje sobre el precio nuevo
--     hasta que terminen sus meses.
--   · Una diferencia menor a $30 (mínimo de Mercado Pago) no se cobra: el cambio aplica directo.
-- ============================================================================

alter table plan_pagos add column if not exists concepto text not null default 'periodo';
alter table plan_pagos drop constraint if exists plan_pagos_concepto_check;
alter table plan_pagos add constraint plan_pagos_concepto_check check (concepto in ('periodo','cambio'));

create table if not exists plan_cambios (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references empresas_planes(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  tipo text not null check (tipo in ('subir','bajar')),
  estado text not null check (estado in ('pendiente_pago','programado','aplicado','cancelado','vencido')),
  rango_antes text not null,
  lugares_antes int,
  rango_id int references planes_rangos(id) on delete set null,
  rango_texto text not null,
  lugares int,                                   -- null = sin límite
  precio_lista numeric not null,                 -- lista del rango nuevo (mensualidad o anualidad)
  monto_inicial numeric not null,                -- con el descuento vigente, si aplica
  diferencia numeric not null default 0,         -- lo que se cobra hoy (subir)
  monto_siguiente numeric not null,              -- el siguiente cobro del plan con el rango nuevo
  conservar uuid[],                              -- bajar: lugares que se quedan
  liga text, liga_vence timestamptz, mp_preferencia_id text,
  pago_id text,
  solicitado_por uuid references perfiles(id) on delete set null,
  quien text,                                    -- empresa | operador | admin
  creado_en timestamptz not null default now(),
  aplicado_en timestamptz,
  cancelado_en timestamptz
);
alter table plan_cambios add column if not exists avisado_en timestamptz;   -- ya salieron los correos del cambio
create index if not exists plan_cambios_plan on plan_cambios (plan_id, estado);
alter table plan_cambios enable row level security;
drop policy if exists "cambios lee" on plan_cambios;
create policy "cambios lee" on plan_cambios for select using (
  es_admin() or es_admin_empresa(empresa_id) or puede_operar_empresa(empresa_id));
grant select on plan_cambios to authenticated;

create or replace function plan_rango_txt(r planes_rangos) returns text
language sql immutable as $$
  select case when r.hasta is null then 'Más de ' || to_char(r.desde - 1, 'FM9,999,999') || ' personas'
              else r.desde || ' a ' || to_char(r.hasta, 'FM9,999,999') || ' personas' end;
$$;

-- Lo que toca cobrar en el siguiente pago; si hay un cambio a menos personas
-- programado, ya con el precio nuevo.
create or replace function plan_siguiente_monto(p empresas_planes) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select c.monto_siguiente from plan_cambios c where c.plan_id = p.id and c.estado = 'programado' order by c.creado_en desc limit 1),
    case
      when p.periodo = 'anual' then case when coalesce(p.pagos_aprobados, 0) = 0 then p.monto_inicial else p.precio_lista end
      when coalesce(p.pagos_aprobados, 0) + 1 <= coalesce(p.descuento_meses, 0) or coalesce(p.pagos_aprobados, 0) = 0 then p.monto_inicial
      else p.precio_lista end);
$$;

-- ¿Quién pide el cambio? admin | operador | empresa | null
create or replace function plan_cambio_quien(p_empresa uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when es_admin() then 'admin'
              when puede_operar_empresa(p_empresa) then 'operador'
              when es_admin_empresa(p_empresa) then 'empresa' end;
$$;

-- Calcula el cambio sin guardarlo (para mostrarlo antes de confirmar).
create or replace function plan_cambio_cotizar(p_plan uuid, p_personas int)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p empresas_planes; r planes_rangos; a ajustes; quien text; tipo text;
  lista numeric; inicial numeric; pct numeric; desc_ahora boolean; cobro_antes numeric; cobro_nuevo numeric;
  fin timestamptz; ini timestamptz; fraccion numeric := 0; dif numeric := 0; siguiente numeric; ocupados int;
begin
  select * into p from empresas_planes where id = p_plan;
  if p.id is null then raise exception 'Plan no encontrado.'; end if;
  quien := plan_cambio_quien(p.empresa_id);
  if quien is null then raise exception 'No tienes acceso a esta empresa.'; end if;
  if p.estado <> 'activo' or p.cancelado_en is not null or coalesce(p.pagos_aprobados, 0) < 1 or p.vigente_hasta is null or p.vigente_hasta < now() then
    raise exception 'Solo se puede cambiar el número de personas de un plan activo y pagado.';
  end if;
  if p_personas is null or p_personas < 1 then raise exception 'Escribe cuántas personas van a estudiar.'; end if;
  select * into r from planes_rangos where activo and desde <= p_personas and (hasta is null or hasta >= p_personas) order by desde limit 1;
  if r.id is null then raise exception 'No hay un precio para % personas.', p_personas; end if;
  if r.id = p.rango_id or (coalesce(r.hasta, -1) = coalesce(p.lugares, -1)) then
    raise exception 'Ya están en el plan de %.', p.rango_texto;
  end if;
  tipo := case when coalesce(r.hasta, 2147483647) > coalesce(p.lugares, 2147483647) then 'subir' else 'bajar' end;
  if quien = 'empresa' and tipo = 'subir' and (r.hasta is null or r.desde > 100) then
    raise exception 'Para más de 100 personas te hacemos una cotización: escríbenos a contacto@institutomara.com.';
  end if;
  select * into a from ajustes limit 1;
  lista := case when p.periodo = 'anual' then r.precio_mensual * a.plan_meses_anual else r.precio_mensual end;
  pct := coalesce(p.descuento_pct, 0);
  inicial := case when pct > 0 then round(lista * (100 - pct) / 100, 2) else lista end;
  -- ¿El periodo que corre se pagó con descuento?
  desc_ahora := pct > 0 and ((p.periodo = 'mensual' and p.pagos_aprobados <= p.descuento_meses) or (p.periodo = 'anual' and p.pagos_aprobados = 1));
  cobro_antes := case when desc_ahora then p.monto_inicial else p.precio_lista end;
  cobro_nuevo := case when desc_ahora then inicial else lista end;
  fin := p.vigente_hasta - interval '3 days';
  ini := fin - case when p.periodo = 'anual' then interval '12 months' else interval '1 month' end;
  if tipo = 'subir' then
    fraccion := greatest(0, least(1, extract(epoch from fin - now()) / nullif(extract(epoch from fin - ini), 0)));
    dif := greatest(0, round((cobro_nuevo - cobro_antes) * fraccion));
  end if;
  -- El siguiente cobro: con descuento si aún le quedan meses (mensual); el anual se renueva a precio de lista.
  siguiente := case when p.periodo = 'mensual' and p.pagos_aprobados + 1 <= p.descuento_meses then inicial else lista end;
  select count(*) into ocupados from empresas_plan_lugares where plan_id = p.id and activo;
  return jsonb_build_object(
    'tipo', tipo, 'quien', quien, 'plan_id', p.id, 'periodo', p.periodo,
    'rango_antes', p.rango_texto, 'lugares_antes', p.lugares,
    'rango_id', r.id, 'rango_texto', plan_rango_txt(r), 'lugares', r.hasta,
    'precio_lista', lista, 'monto_inicial', inicial, 'descuento_pct', pct,
    'diferencia', case when dif < 30 then 0 else dif end, 'sin_cobro', tipo = 'subir' and dif < 30,
    'dias_restantes', greatest(0, ceil(extract(epoch from fin - now()) / 86400))::int,
    'fin_periodo', fin, 'monto_siguiente', siguiente, 'precio_siguiente_actual', plan_siguiente_monto(p),
    'ocupados', ocupados, 'sobran', case when r.hasta is not null and ocupados > r.hasta then ocupados - r.hasta else 0 end,
    'suscripcion', p.periodo = 'mensual' and p.mp_preapproval_id is not null);
end; $$;
revoke all on function plan_cambio_cotizar(uuid, int) from public, anon;
grant execute on function plan_cambio_cotizar(uuid, int) to authenticated;

-- Aplica un cambio al plan (interno).
create or replace function plan_cambio_aplicar(p_cambio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c plan_cambios; quedan int;
begin
  select * into c from plan_cambios where id = p_cambio for update;
  if c.id is null or c.estado not in ('pendiente_pago','programado') then return; end if;
  update empresas_planes set rango_id = c.rango_id, rango_texto = c.rango_texto, lugares = c.lugares,
         precio_lista = c.precio_lista, monto_inicial = c.monto_inicial, actualizado_en = now()
   where id = c.plan_id;
  if c.tipo = 'bajar' and c.lugares is not null then
    -- Se quedan los elegidos; si aun así sobran (personas agregadas después), salen los más recientes.
    update empresas_plan_lugares set activo = false, liberado_en = now()
     where plan_id = c.plan_id and activo and c.conservar is not null and not (id = any(c.conservar));
    select count(*) into quedan from empresas_plan_lugares where plan_id = c.plan_id and activo;
    if quedan > c.lugares then
      update empresas_plan_lugares set activo = false, liberado_en = now()
       where id in (select id from empresas_plan_lugares where plan_id = c.plan_id and activo
                    order by (c.conservar is not null and id = any(c.conservar)) asc, asignado_en desc limit quedan - c.lugares);
    end if;
  end if;
  update plan_cambios set estado = 'aplicado', aplicado_en = now() where id = c.id;
end; $$;
revoke all on function plan_cambio_aplicar(uuid) from public, anon, authenticated;

-- Pide el cambio. Subir: queda esperando el pago de la diferencia (o aplica directo si
-- no hay nada que cobrar). Bajar: queda programado para el siguiente cobro.
create or replace function plan_cambio_solicitar(p_plan uuid, p_personas int, p_conservar uuid[] default null)
returns plan_cambios
language plpgsql security definer set search_path = public as $$
declare q jsonb; p empresas_planes; c plan_cambios; sobran int; validos int;
begin
  q := plan_cambio_cotizar(p_plan, p_personas);
  select * into p from empresas_planes where id = p_plan for update;
  sobran := (q->>'sobran')::int;
  if q->>'tipo' = 'bajar' and sobran > 0 then
    select count(*) into validos from empresas_plan_lugares
     where plan_id = p.id and activo and p_conservar is not null and id = any(p_conservar);
    if validos <> (q->>'lugares')::int then
      raise exception 'Elige a las % personas que conservan su lugar.', q->>'lugares';
    end if;
  end if;
  -- Solo un cambio pendiente a la vez: el nuevo reemplaza al anterior.
  update plan_cambios set estado = 'cancelado', cancelado_en = now()
   where plan_id = p.id and estado in ('pendiente_pago','programado');
  insert into plan_cambios (plan_id, empresa_id, tipo, estado, rango_antes, lugares_antes, rango_id, rango_texto, lugares,
                            precio_lista, monto_inicial, diferencia, monto_siguiente, conservar, solicitado_por, quien)
  values (p.id, p.empresa_id, q->>'tipo',
          case when q->>'tipo' = 'bajar' then 'programado' else 'pendiente_pago' end,
          p.rango_texto, p.lugares, (q->>'rango_id')::int, q->>'rango_texto', (q->>'lugares')::int,
          (q->>'precio_lista')::numeric, (q->>'monto_inicial')::numeric, (q->>'diferencia')::numeric, (q->>'monto_siguiente')::numeric,
          case when q->>'tipo' = 'bajar' and sobran > 0 then p_conservar end, auth.uid(), q->>'quien')
  returning * into c;
  if c.tipo = 'subir' and (q->>'sin_cobro')::boolean then
    perform plan_cambio_aplicar(c.id);
    select * into c from plan_cambios where id = c.id;
  end if;
  return c;
end; $$;
revoke all on function plan_cambio_solicitar(uuid, int, uuid[]) from public, anon;
grant execute on function plan_cambio_solicitar(uuid, int, uuid[]) to authenticated;

-- Cancela un cambio que aún no se aplica.
create or replace function plan_cambio_cancelar(p_cambio uuid) returns plan_cambios
language plpgsql security definer set search_path = public as $$
declare c plan_cambios;
begin
  select * into c from plan_cambios where id = p_cambio for update;
  if c.id is null then raise exception 'Cambio no encontrado.'; end if;
  if plan_cambio_quien(c.empresa_id) is null then raise exception 'No tienes acceso a esta empresa.'; end if;
  if c.estado not in ('pendiente_pago','programado') then raise exception 'Este cambio ya no se puede cancelar.'; end if;
  update plan_cambios set estado = 'cancelado', cancelado_en = now() where id = c.id returning * into c;
  return c;
end; $$;
revoke all on function plan_cambio_cancelar(uuid) from public, anon;
grant execute on function plan_cambio_cancelar(uuid) to authenticated;

-- Pago aprobado de la diferencia (lo llama el servidor). Registra el pago, la comisión
-- del 35 % para el operador y aplica el cambio.
create or replace function plan_cambio_pagado(p_cambio uuid, p_pago text, p_monto numeric, p_neto numeric, p_medio text default 'Mercado Pago')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare c plan_cambios; p empresas_planes; e empresas; pp plan_pagos; iva numeric; base numeric;
begin
  select * into c from plan_cambios where id = p_cambio for update;
  if c.id is null then return jsonb_build_object('ok', false, 'motivo', 'cambio no encontrado'); end if;
  if exists (select 1 from plan_pagos where mp_pago_id = p_pago) then return jsonb_build_object('ok', false, 'motivo', 'pago ya registrado'); end if;
  select * into p from empresas_planes where id = c.plan_id for update;
  select * into e from empresas where id = p.empresa_id;
  if c.tipo <> 'subir' or c.estado not in ('pendiente_pago','vencido','cancelado') or p_monto + 0.5 < c.diferencia then
    insert into pagos (usuario_id, curso_id, monto, medio, referencia_mp, nota)
      values (null, null, p_monto, p_medio, p_pago, 'REVISAR cambio de rango de ' || coalesce(e.nombre, '—') || ': pagó ' || p_monto ||
              ' de ' || c.diferencia || ' (cambio ' || c.estado || '). No se aplicó.')
      on conflict (referencia_mp) do nothing;
    return jsonb_build_object('ok', false, 'motivo', case when p_monto + 0.5 < c.diferencia then 'monto insuficiente' else 'cambio ' || c.estado end);
  end if;
  iva := round(p_monto * 0.16 / 1.16, 2);
  base := greatest(0, round(coalesce(p_neto, p_monto) - iva, 2));
  insert into plan_pagos (plan_id, mp_pago_id, numero, monto, neto_mp, iva, base_comision, medio, concepto)
    values (p.id, p_pago, p.pagos_aprobados, p_monto, coalesce(p_neto, p_monto), iva, base, p_medio, 'cambio')
    returning * into pp;
  insert into pagos (usuario_id, curso_id, monto, medio, referencia_mp, nota)
    values (null, null, p_monto, p_medio, p_pago, 'Cambio de plan de ' || e.nombre || ': ' || c.rango_antes || ' → ' || c.rango_texto)
    on conflict (referencia_mp) do nothing;
  if p.operador_id is not null then
    insert into comisiones (operador_id, plan_id, plan_pago_id, tipo, pct, base, monto, nota)
      values (p.operador_id, p.id, pp.id, 'inicial', p.comision_inicial_pct, base, round(base * p.comision_inicial_pct / 100, 2),
              'Cambio a ' || c.rango_texto);
  end if;
  -- Si el cambio se había cancelado o vencido pero sí pagaron, se aplica igual.
  update plan_cambios set estado = 'pendiente_pago', pago_id = p_pago where id = c.id;
  update plan_cambios set estado = 'cancelado', cancelado_en = now() where plan_id = p.id and id <> c.id and estado in ('pendiente_pago','programado');
  perform plan_cambio_aplicar(c.id);
  select * into p from empresas_planes where id = p.id;
  return jsonb_build_object('ok', true, 'cambio', c.id, 'empresa', e.nombre, 'plan', p.id,
    'preapproval', case when p.periodo = 'mensual' then p.mp_preapproval_id end, 'monto_siguiente', plan_siguiente_monto(p),
    'comision', case when p.operador_id is not null then round(base * p.comision_inicial_pct / 100, 2) end);
end; $$;
revoke all on function plan_cambio_pagado(uuid, text, numeric, numeric, text) from public, anon, authenticated;
grant execute on function plan_cambio_pagado(uuid, text, numeric, numeric, text) to service_role;

-- La diferencia pagada por transferencia (administración).
create or replace function plan_cambio_pago_manual(p_cambio uuid, p_monto numeric, p_referencia text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not es_admin() then raise exception 'Solo administración registra pagos.'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'Escribe el monto que se recibió.'; end if;
  if length(btrim(coalesce(p_referencia, ''))) < 3 then raise exception 'Escribe la referencia o clave de rastreo de la transferencia.'; end if;
  r := plan_cambio_pagado(p_cambio, 'transferencia:' || left(btrim(p_referencia), 60) || ':' || left(gen_random_uuid()::text, 8),
                          round(p_monto, 2), round(p_monto, 2), 'Transferencia');
  if not coalesce((r->>'ok')::boolean, false) then
    raise exception 'No se registró: %.', case r->>'motivo' when 'monto insuficiente' then 'el monto es menor a la diferencia' else r->>'motivo' end;
  end if;
  return r;
end; $$;
revoke all on function plan_cambio_pago_manual(uuid, numeric, text) from public, anon;
grant execute on function plan_cambio_pago_manual(uuid, numeric, text) to authenticated;

-- Pago de un periodo: antes de cobrarlo, se aplica el cambio a menos personas que
-- estuviera programado (así el monto esperado ya es el del rango nuevo).
create or replace function plan_registrar_pago(p_plan uuid, p_pago text, p_monto numeric, p_neto numeric, p_medio text default 'Mercado Pago')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p empresas_planes; pp plan_pagos; n int; iva numeric; base numeric; pct numeric; tipo text;
  desde timestamptz; dur interval; e empresas; esperado numeric; cb uuid;
begin
  select * into p from empresas_planes where id = p_plan for update;
  if p.id is null then return jsonb_build_object('ok', false, 'motivo', 'plan no encontrado'); end if;
  if exists (select 1 from plan_pagos where mp_pago_id = p_pago) then return jsonb_build_object('ok', false, 'motivo', 'pago ya registrado'); end if;
  if p.pagos_aprobados >= 1 then
    select id into cb from plan_cambios where plan_id = p.id and estado = 'programado' order by creado_en desc limit 1;
    if cb is not null then
      perform plan_cambio_aplicar(cb);
      select * into p from empresas_planes where id = p_plan;
    end if;
  end if;
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
    'precio_lista', p.precio_lista, 'preapproval', p.mp_preapproval_id, 'cambio_aplicado', cb);
end; $$;
revoke all on function plan_registrar_pago(uuid, text, numeric, numeric, text) from public, anon, authenticated;
grant execute on function plan_registrar_pago(uuid, text, numeric, numeric, text) to service_role;

-- Al cancelar el plan, los cambios pendientes se cancelan.
create or replace function plan_cancelar_cambios() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado in ('cancelado','vencido') and old.estado is distinct from new.estado then
    update plan_cambios set estado = 'cancelado', cancelado_en = now() where plan_id = new.id and estado = 'programado';
  end if;
  return new;
end; $$;
drop trigger if exists plan_cambios_al_cancelar on empresas_planes;
create trigger plan_cambios_al_cancelar after update of estado on empresas_planes
  for each row execute function plan_cancelar_cambios();

notify pgrst, 'reload schema';
select 'ok' as resultado;
