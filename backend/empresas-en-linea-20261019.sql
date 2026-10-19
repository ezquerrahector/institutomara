-- ============================================================================
-- Instituto Mara — Empresas: contratación en línea, pago por transferencia y
-- solicitudes de prueba desde el sitio (19 oct 2026)
-- Se ejecuta DESPUÉS de prueba-y-supervision-20261019.sql. Se puede correr más de una vez.
--
-- Decisiones de Héctor:
--   · Ya no se venden cursos sueltos a empresas: solo el plan mensual (las compras
--     anteriores siguen vigentes).
--   · Una empresa puede contratar el plan en línea sola (sin descuento). Gana comisión
--     el operador que ya la atendía (por empresa o por prospecto con el mismo correo
--     o teléfono); si nadie la atendía, no hay comisión.
--   · «Quiero mi prueba sin costo» desde el sitio: entra a Prospectos, se asigna al
--     operador activo con menos pendientes (si no hay, queda sin asignar) y le toca hoy.
--   · El plan se puede pagar por transferencia: administración registra el pago a mano
--     y el operador gana su comisión sobre el monto sin IVA (sin comisión de Mercado Pago).
-- ============================================================================

-- 1. ¿Qué operador atendía a esta empresa? -------------------------------------------
create or replace function operador_para_empresa(p_correo text, p_telefono text default null) returns uuid
language sql stable security definer set search_path = public as $$
  with d as (select lower(btrim(coalesce(p_correo, ''))) as c,
                    right(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), 10) as t)
  select o.id from operadores o, d
  where o.activo and (
    exists (select 1 from empresas e where e.operador_id = o.id and d.c <> '' and lower(e.contacto_correo) = d.c)
    or exists (select 1 from empresas_admins a join empresas e on e.id = a.empresa_id where e.operador_id = o.id and d.c <> '' and lower(a.correo) = d.c)
    or exists (select 1 from prospectos p where p.asignado_a = o.id and (
                 (d.c <> '' and (lower(coalesce(p.contacto_correo, '')) = d.c or position(d.c in lower(coalesce(p.correo, ''))) > 0))
                 or (length(d.t) = 10 and (right(regexp_replace(coalesce(p.telefono, ''), '\D', '', 'g'), 10) = d.t
                                          or right(regexp_replace(coalesce(p.whatsapp, ''), '\D', '', 'g'), 10) = d.t))))
  )
  limit 1;
$$;
revoke all on function operador_para_empresa(text, text) from public, anon, authenticated;

-- El operador activo con menos llamadas pendientes (para las solicitudes del sitio).
create or replace function operador_menos_cargado() returns uuid
language sql stable security definer set search_path = public as $$
  select o.id from operadores o
  where o.activo and o.usuario_id is not null
  order by (select count(*) from prospectos p where p.asignado_a = o.id
              and p.estado not in ('no_interesa','descartado','baja','cliente')
              and (p.proxima_llamada is null or p.proxima_llamada < now() + interval '1 day')), random()
  limit 1;
$$;
revoke all on function operador_menos_cargado() from public, anon, authenticated;

-- 2. Contratar el plan en línea (cualquier persona con cuenta) ----------------------
create or replace function plan_contratar_en_linea(p_empresa text, p_personas int, p_periodo text,
                                                   p_rfc text default null, p_telefono text default null)
returns empresas_planes
language plpgsql security definer set search_path = public as $$
declare
  yo perfiles; e empresas; r planes_rangos; a ajustes; fila empresas_planes; lista numeric; op uuid;
  nom text := nullif(btrim(coalesce(p_empresa, '')), ''); tel text := nullif(btrim(coalesce(p_telefono, '')), '');
begin
  if auth.uid() is null then raise exception 'Inicia sesión para contratar.'; end if;
  select * into yo from perfiles where id = auth.uid();
  if p_periodo not in ('mensual','anual') then raise exception 'Elige pago mensual o anual.'; end if;
  if p_personas is null or p_personas < 1 then raise exception 'Escribe cuántas personas van a estudiar.'; end if;
  -- La empresa: la que ya administra, o una nueva.
  select e2.* into e from empresas e2 join empresas_admins ea on ea.empresa_id = e2.id
   where ea.usuario_id = auth.uid() or lower(ea.correo) = lower(yo.correo)
   order by e2.creado_en limit 1;
  if e.id is null then
    if nom is null or length(nom) < 2 then raise exception 'Escribe el nombre de la empresa.'; end if;
    op := operador_para_empresa(yo.correo, tel);
    insert into empresas (nombre, rfc, contacto_nombre, contacto_correo, contacto_tel, operador_id, notas)
      values (nom, nullif(upper(btrim(coalesce(p_rfc, ''))), ''), yo.nombre, lower(yo.correo), tel, op, 'Contrató en línea')
      returning * into e;
    insert into empresas_admins (empresa_id, correo, nombre, usuario_id) values (e.id, lower(yo.correo), yo.nombre, auth.uid())
      on conflict (empresa_id, lower(correo)) do nothing;
  elsif e.operador_id is null then
    op := operador_para_empresa(yo.correo, coalesce(tel, e.contacto_tel));
    if op is not null then update empresas set operador_id = op where id = e.id returning * into e; end if;
  end if;
  if exists (select 1 from empresas_planes where empresa_id = e.id and estado = 'activo' and vigente_hasta >= now()) then
    raise exception 'Tu empresa ya tiene un plan activo. Lo ves en «Mi empresa».';
  end if;
  select * into r from planes_rangos where activo and desde <= p_personas and (hasta is null or hasta >= p_personas) order by desde limit 1;
  if r.id is null then raise exception 'No hay un precio para % personas. Escríbenos y te cotizamos.', p_personas; end if;
  if r.hasta is null or r.desde > 100 then raise exception 'Para más de 100 personas te hacemos una cotización: escríbenos a contacto@institutomara.com.'; end if;
  select * into a from ajustes limit 1;
  lista := case when p_periodo = 'anual' then r.precio_mensual * a.plan_meses_anual else r.precio_mensual end;
  update empresas_planes set estado = 'cancelado', actualizado_en = now()
    where empresa_id = e.id and estado in ('por_aprobar','pendiente_pago');
  insert into empresas_planes (empresa_id, rango_id, rango_texto, lugares, periodo, precio_lista, descuento_pct, descuento_meses,
                               monto_inicial, comision_inicial_pct, comision_recurrente_pct, estado, operador_id, creado_por,
                               admin_correo, nota)
  values (e.id, r.id, r.desde || ' a ' || r.hasta || ' personas', r.hasta, p_periodo, lista, 0, 0, lista,
          r.comision_inicial_pct, r.comision_recurrente_pct, 'pendiente_pago', e.operador_id, auth.uid(),
          lower(yo.correo), 'Contratado en línea por ' || coalesce(yo.nombre, yo.correo))
  returning * into fila;
  -- Si era un prospecto, queda ligado a su empresa.
  update prospectos set empresa_id = e.id
   where empresa_id is null and (lower(coalesce(contacto_correo, '')) = lower(yo.correo) or position(lower(yo.correo) in lower(coalesce(correo, ''))) > 0);
  return fila;
end; $$;
revoke all on function plan_contratar_en_linea(text, int, text, text, text) from public, anon;
grant execute on function plan_contratar_en_linea(text, int, text, text, text) to authenticated;

-- 3. Pago por transferencia (administración) -----------------------------------------
create or replace function plan_registrar_pago_manual(p_plan uuid, p_monto numeric, p_referencia text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare p empresas_planes; r jsonb;
begin
  if not es_admin() then raise exception 'Solo administración registra pagos.'; end if;
  select * into p from empresas_planes where id = p_plan;
  if p.id is null then raise exception 'Plan no encontrado.'; end if;
  if p.estado not in ('pendiente_pago','activo','cancelado','vencido') then raise exception 'Este plan no espera pagos (está «%»).', p.estado; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'Escribe el monto que se recibió.'; end if;
  if length(btrim(coalesce(p_referencia, ''))) < 3 then raise exception 'Escribe la referencia o clave de rastreo de la transferencia.'; end if;
  r := plan_registrar_pago(p.id, 'transferencia:' || left(btrim(p_referencia), 60) || ':' || left(gen_random_uuid()::text, 8),
                           round(p_monto, 2), round(p_monto, 2), 'Transferencia');
  if not coalesce((r->>'ok')::boolean, false) then
    raise exception 'No se registró: %.', case r->>'motivo' when 'monto insuficiente' then 'el monto es menor a lo que toca cobrar' else r->>'motivo' end;
  end if;
  return r;
end; $$;
revoke all on function plan_registrar_pago_manual(uuid, numeric, text) from public, anon;
grant execute on function plan_registrar_pago_manual(uuid, numeric, text) to authenticated;

-- 4. «Quiero mi prueba sin costo» desde el sitio (lo llama el servidor) ---------------
create or replace function prospecto_solicitud(p_empresa text, p_nombre text, p_puesto text, p_correo text,
                                               p_telefono text, p_personas int default null, p_mensaje text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p prospectos; c text := lower(btrim(coalesce(p_correo, ''))); t text := right(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), 10);
  op uuid; nuevo boolean := false; resumen text;
begin
  if length(btrim(coalesce(p_empresa, ''))) < 2 then raise exception 'Escribe el nombre de la empresa.'; end if;
  if length(btrim(coalesce(p_nombre, ''))) < 2 then raise exception 'Escribe tu nombre.'; end if;
  if c !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisa tu correo.'; end if;
  if length(t) <> 10 then raise exception 'Escribe un teléfono de 10 dígitos.'; end if;
  select * into p from prospectos
   where lower(coalesce(contacto_correo, '')) = c or position(c in lower(coalesce(correo, ''))) > 0
      or right(regexp_replace(coalesce(telefono, ''), '\D', '', 'g'), 10) = t
      or right(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g'), 10) = t
   order by (asignado_a is not null) desc, creado_en limit 1;
  -- La misma solicitud dos veces en 10 minutos no se duplica.
  if p.id is not null and (p.extra->>'solicitud_en') is not null and (p.extra->>'solicitud_en')::timestamptz > now() - interval '10 minutes' then
    return jsonb_build_object('ok', true, 'id', p.id, 'repetida', true);
  end if;
  if p.id is null then
    insert into prospectos (nombre, nombre_corto, telefono, correo, estado, lote)
      values (btrim(p_empresa), btrim(p_empresa), t, c, 'respondio', 'Sitio web')
      returning * into p;
    nuevo := true;
  end if;
  op := case when p.asignado_a is not null and exists (select 1 from operadores where id = p.asignado_a and activo) then p.asignado_a
             else operador_menos_cargado() end;
  resumen := 'Pidió la prueba sin costo desde el sitio' || coalesce(' · ' || p_personas || ' personas', '') ||
             coalesce(' · «' || nullif(btrim(coalesce(p_mensaje, '')), '') || '»', '');
  update prospectos set
    estado = case when estado in ('nuevo','contactado','no_interesa','descartado') then 'respondio' else estado end,
    asignado_a = op,
    proxima_llamada = now(),
    contacto_nombre = btrim(p_nombre), contacto_puesto = nullif(btrim(coalesce(p_puesto, '')), ''), contacto_correo = c,
    telefono = coalesce(nullif(telefono, ''), t),
    extra = extra || jsonb_build_object('origen', 'sitio', 'solicitud_en', now(), 'personas', p_personas, 'mensaje', nullif(btrim(coalesce(p_mensaje, '')), '')),
    actualizado_en = now()
   where id = p.id returning * into p;
  insert into prospecto_contactos (prospecto_id, canal, sentido, resumen, resultado, contacto_nombre, contacto_puesto)
    values (p.id, 'otro', 'entrante', resumen, 'Pidió prueba desde el sitio', btrim(p_nombre), nullif(btrim(coalesce(p_puesto, '')), ''));
  return jsonb_build_object('ok', true, 'id', p.id, 'nuevo', nuevo, 'operador_id', op);
end; $$;
revoke all on function prospecto_solicitud(text, text, text, text, text, int, text) from public, anon, authenticated;
grant execute on function prospecto_solicitud(text, text, text, text, text, int, text) to service_role;

notify pgrst, 'reload schema';
select 'ok' as resultado;
