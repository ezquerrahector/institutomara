-- ============================================================================
-- Instituto Mara — Consola de llamadas para operadores (19 oct 2026)
-- Se ejecuta DESPUÉS de planes-operadores-20261019.sql. Se puede correr más de
-- una vez sin romper nada.
--
--   · Cada prospecto guarda su siguiente llamada, cuántos intentos lleva, en qué
--     llamada va (1.ª, 2.ª o 3.ª conversación) y con quién se habló.
--   · registrar_llamada(): el operador (o administración) registra el resultado
--     y el servidor decide el estado y la siguiente fecha, igual para todos.
--   · asignar_prospectos(): administración reparte prospectos en bloques.
-- ============================================================================

-- Estados válidos (incluye «No le interesó», que ya existe en producción desde el 15 oct).
do $$
declare r record;
begin
  for r in select conname from pg_constraint
            where conrelid = 'prospectos'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%estado%'
  loop execute format('alter table prospectos drop constraint %I', r.conname); end loop;
end $$;
alter table prospectos add constraint prospectos_estado_check
  check (estado in ('nuevo','contactado','respondio','demo','piloto','cliente','no_interesa','descartado','baja'));

alter table prospectos add column if not exists proxima_llamada timestamptz;  -- cuándo toca volver a llamar
alter table prospectos add column if not exists llamadas_intentos int not null default 0;   -- todas las llamadas
alter table prospectos add column if not exists llamada_toque int not null default 0;       -- conversaciones con quien decide
alter table prospectos add column if not exists ultima_llamada timestamptz;
alter table prospectos add column if not exists ultimo_resultado text;
alter table prospectos add column if not exists contacto_nombre text;     -- la persona que decide (RH, dirección…)
alter table prospectos add column if not exists contacto_puesto text;
alter table prospectos add column if not exists contacto_correo text;
create index if not exists prospectos_proxima on prospectos (asignado_a, proxima_llamada);

alter table prospecto_contactos add column if not exists contacto_nombre text;
alter table prospecto_contactos add column if not exists contacto_puesto text;

-- Resultados de una llamada (los mismos del combo de la consola).
create or replace function llamada_resultado_texto(p text) returns text
language sql immutable as $$
  select case p
    when 'no_contesto' then 'No contestó'
    when 'buzon' then 'Buzón / recado'
    when 'equivocado' then 'Número equivocado'
    when 'recepcion' then 'Recepción no transfirió'
    when 'otro_dia' then 'Pidió que llame otro día'
    when 'info_correo' then 'Pidió información por correo'
    when 'piloto' then 'Aceptó la prueba'
    when 'demo' then 'Agendó demostración'
    when 'proveedor' then 'Ya tiene proveedor'
    when 'no_interesa' then 'No le interesa'
    else p end;
$$;

-- Siguiente día hábil (lunes a viernes) a las 10:00 de México, N días después.
create or replace function dia_habil(p_dias int) returns timestamptz
language plpgsql stable as $$
declare d date := (now() at time zone 'America/Mexico_City')::date; n int := 0;
begin
  while n < greatest(p_dias, 1) loop
    d := d + 1;
    if extract(isodow from d) < 6 then n := n + 1; end if;
  end loop;
  return (d + time '10:00') at time zone 'America/Mexico_City';
end; $$;

-- Registrar una llamada. El servidor decide estado, número de llamada y la siguiente fecha.
create or replace function registrar_llamada(p_prospecto uuid, p_resultado text, p_contacto_nombre text default null,
                                             p_contacto_puesto text default null, p_contacto_correo text default null,
                                             p_comentario text default null, p_proxima timestamptz default null)
returns prospectos
language plpgsql security definer set search_path = public as $$
declare
  p prospectos; fila prospectos; efectiva boolean; toque int; prox timestamptz; est text;
  correo_limpio text := nullif(lower(btrim(coalesce(p_contacto_correo,''))), '');
begin
  select * into p from prospectos where id = p_prospecto for update;
  if p.id is null then raise exception 'Prospecto no encontrado.'; end if;
  if not (es_admin() or (p.asignado_a is not null and p.asignado_a = mi_operador())) then
    raise exception 'Este prospecto no está asignado a ti.';
  end if;
  if p_resultado not in ('no_contesto','buzon','equivocado','recepcion','otro_dia','info_correo','piloto','demo','proveedor','no_interesa') then
    raise exception 'Elige el resultado de la llamada.';
  end if;
  if correo_limpio is not null and correo_limpio !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisa el correo.'; end if;
  if p_resultado = 'info_correo' and coalesce(correo_limpio, p.contacto_correo) is null then
    raise exception 'Escribe el correo al que pidió la información.';
  end if;
  if p_resultado in ('otro_dia','demo') and p_proxima is null then
    raise exception 'Escribe la fecha y hora en que hay que volver a llamar.';
  end if;

  -- Cuenta como «conversación» cuando se habló con quien decide.
  efectiva := p_resultado in ('otro_dia','info_correo','piloto','demo','proveedor','no_interesa');
  toque := p.llamada_toque + case when efectiva then 1 else 0 end;

  prox := coalesce(p_proxima, case p_resultado
    when 'no_contesto' then dia_habil(1)
    when 'buzon' then dia_habil(2)
    when 'recepcion' then dia_habil(2)
    when 'info_correo' then dia_habil(3)
    when 'piloto' then dia_habil(7)       -- revisar cómo va la prueba
    when 'proveedor' then dia_habil(40)   -- volver a ofrecer en unos dos meses
    else null end);
  if p_resultado in ('equivocado','no_interesa') then prox := null; end if;
  -- Tres conversaciones sin decisión: se deja descansar tres meses.
  if efectiva and toque >= 3 and p_resultado in ('info_correo','otro_dia','proveedor') and p_proxima is null then prox := dia_habil(60); end if;

  est := case p_resultado
    when 'equivocado' then 'descartado'
    when 'no_interesa' then 'no_interesa'
    when 'piloto' then 'piloto'
    when 'demo' then 'demo'
    when 'info_correo' then case when p.estado in ('nuevo','contactado') then 'respondio' else p.estado end
    when 'otro_dia' then case when p.estado in ('nuevo','contactado') then 'respondio' else p.estado end
    else case when p.estado = 'nuevo' then 'contactado' else p.estado end end;

  insert into prospecto_contactos (prospecto_id, canal, sentido, toque, resumen, resultado, creado_por, contacto_nombre, contacto_puesto)
    values (p.id, 'llamada', 'saliente', case when efectiva then toque else null end,
            nullif(btrim(coalesce(p_comentario,'')), ''), llamada_resultado_texto(p_resultado), auth.uid(),
            nullif(btrim(coalesce(p_contacto_nombre,'')), ''), nullif(btrim(coalesce(p_contacto_puesto,'')), ''));

  -- Permiso de esta transacción para los campos que protege prospecto_proteger().
  perform set_config('mara.llamada', '1', true);
  update prospectos set
    estado = est,
    secuencia = case when est in ('respondio','demo','piloto','no_interesa','descartado') then false else secuencia end,
    llamadas_intentos = llamadas_intentos + 1,
    llamada_toque = toque,
    ultima_llamada = now(),
    ultimo_resultado = p_resultado,
    proxima_llamada = prox,
    contacto_nombre = coalesce(nullif(btrim(coalesce(p_contacto_nombre,'')), ''), contacto_nombre),
    contacto_puesto = coalesce(nullif(btrim(coalesce(p_contacto_puesto,'')), ''), contacto_puesto),
    contacto_correo = coalesce(correo_limpio, contacto_correo),
    -- Quien pidió información por correo queda marcado hasta que se le envíe.
    extra = case when p_resultado = 'info_correo' then coalesce(extra, '{}'::jsonb) || jsonb_build_object('info_pendiente', true) else extra end
  where id = p.id
  returning * into fila;
  perform set_config('mara.llamada', '', true);
  return fila;
end; $$;
revoke all on function registrar_llamada(uuid, text, text, text, text, text, timestamptz) from public, anon;
grant execute on function registrar_llamada(uuid, text, text, text, text, text, timestamptz) to authenticated;

-- Cambiar solo la fecha de la siguiente llamada.
create or replace function reprogramar_llamada(p_prospecto uuid, p_cuando timestamptz)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (es_admin() or exists (select 1 from prospectos where id = p_prospecto and asignado_a is not null and asignado_a = mi_operador())) then
    raise exception 'Este prospecto no está asignado a ti.';
  end if;
  update prospectos set proxima_llamada = p_cuando where id = p_prospecto;
end; $$;
revoke all on function reprogramar_llamada(uuid, timestamptz) from public, anon;
grant execute on function reprogramar_llamada(uuid, timestamptz) to authenticated;

-- Administración reparte prospectos (null = quitar la asignación).
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
  return n;
end; $$;
revoke all on function asignar_prospectos(uuid[], uuid) from public, anon;
grant execute on function asignar_prospectos(uuid[], uuid) to authenticated;

-- El operador no cambia por su cuenta los datos que solo calcula el servidor.
create or replace function prospecto_proteger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if es_admin() or auth.uid() is null or current_setting('mara.llamada', true) = '1' then
    if new.asignado_a is distinct from old.asignado_a then new.asignado_en := case when new.asignado_a is null then null else now() end; end if;
    return new;
  end if;
  new.asignado_a := old.asignado_a; new.asignado_en := old.asignado_en; new.token := old.token;
  new.llamadas_intentos := old.llamadas_intentos; new.llamada_toque := old.llamada_toque;
  new.ultima_llamada := old.ultima_llamada; new.ultimo_resultado := old.ultimo_resultado;
  return new;
end; $$;

select 'ok' as resultado;
