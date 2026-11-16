-- Instituto Mara — 16 nov 2026. Se puede correr más de una vez.
-- 1) Empresas: resultado «Quiere contratar ya» (sin prueba) en la consola de Llamadas.
-- 2) Alumnos: liga personal para inscribirse. La persona entra al aula, ve su programa
--    con la primera lección gratis y paga para continuar. La liga une su cuenta con su
--    ficha para que la venta cuente para su agente y se vea como pagada.
-- 3) Reparto de comisiones: el titular decide cuánto de su comisión le toca a cada
--    agente y si el agente puede verlo.

-- 1) ------------------------------------------------------------------------------
create or replace function public.llamada_resultado_texto(p text)
 returns text language sql immutable as $$
  select case p
    when 'no_contesto' then 'No contestó'
    when 'buzon' then 'Buzón / recado'
    when 'equivocado' then 'Número equivocado'
    when 'recepcion' then 'Recepción no transfirió'
    when 'otro_dia' then 'Pidió que llame otro día'
    when 'info_correo' then 'Pidió información por correo'
    when 'piloto' then 'Aceptó la prueba'
    when 'contratar' then 'Quiere contratar ya (sin prueba)'
    when 'demo' then 'Agendó demostración'
    when 'proveedor' then 'Ya tiene proveedor'
    when 'no_interesa' then 'No le interesa'
    else p end;
$$;

create or replace function public.registrar_llamada(p_prospecto uuid, p_resultado text, p_contacto_nombre text default null,
  p_contacto_puesto text default null, p_contacto_correo text default null, p_comentario text default null,
  p_proxima timestamptz default null, p_grabacion text default null)
 returns prospectos language plpgsql security definer set search_path to 'public' as $function$
declare
  p prospectos; fila prospectos; efectiva boolean; toque int; prox timestamptz; est text;
  correo_limpio text := nullif(lower(btrim(coalesce(p_contacto_correo,''))), '');
begin
  select * into p from prospectos where id = p_prospecto for update;
  if p.id is null then raise exception 'Prospecto no encontrado.'; end if;
  if not (es_admin() or (p.asignado_a is not null and p.asignado_a = mi_operador())) then
    raise exception 'Este prospecto no está asignado a ti.';
  end if;
  if p_resultado not in ('no_contesto','buzon','equivocado','recepcion','otro_dia','info_correo','piloto','contratar','demo','proveedor','no_interesa') then
    raise exception 'Elige el resultado de la llamada.';
  end if;
  if correo_limpio is not null and correo_limpio !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisa el correo.'; end if;
  if p_resultado = 'info_correo' and coalesce(correo_limpio, p.contacto_correo) is null then
    raise exception 'Escribe el correo al que pidió la información.';
  end if;
  if p_resultado = 'contratar' and coalesce(correo_limpio, p.contacto_correo) is null then
    raise exception 'Escribe el correo de quien administrará la plataforma: ahí le llega su acceso.';
  end if;
  if p_resultado in ('otro_dia','demo') and p_proxima is null then
    raise exception 'Escribe la fecha y hora en que hay que volver a llamar.';
  end if;

  efectiva := p_resultado in ('otro_dia','info_correo','piloto','contratar','demo','proveedor','no_interesa');
  toque := p.llamada_toque + case when efectiva then 1 else 0 end;

  prox := coalesce(p_proxima, case p_resultado
    when 'no_contesto' then dia_habil(1)
    when 'buzon' then dia_habil(2)
    when 'recepcion' then dia_habil(2)
    when 'info_correo' then dia_habil(3)
    when 'piloto' then dia_habil(7)
    when 'contratar' then dia_habil(2)        -- confirmar que pagó
    when 'proveedor' then dia_habil(40)
    else null end);
  if p_resultado in ('equivocado','no_interesa') then prox := null; end if;
  if efectiva and toque >= 3 and p_resultado in ('info_correo','otro_dia','proveedor') and p_proxima is null then prox := dia_habil(60); end if;

  est := case p_resultado
    when 'equivocado' then 'descartado'
    when 'no_interesa' then 'no_interesa'
    when 'piloto' then 'piloto'
    when 'contratar' then case when p.estado = 'cliente' then p.estado else 'respondio' end
    when 'demo' then 'demo'
    when 'info_correo' then case when p.estado in ('nuevo','contactado') then 'respondio' else p.estado end
    when 'otro_dia' then case when p.estado in ('nuevo','contactado') then 'respondio' else p.estado end
    else case when p.estado = 'nuevo' then 'contactado' else p.estado end end;

  insert into prospecto_contactos (prospecto_id, canal, sentido, toque, resumen, resultado, creado_por, contacto_nombre, contacto_puesto, grabacion)
    values (p.id, 'llamada', 'saliente', case when efectiva then toque else null end,
            nullif(btrim(coalesce(p_comentario,'')), ''), llamada_resultado_texto(p_resultado), auth.uid(),
            nullif(btrim(coalesce(p_contacto_nombre,'')), ''), nullif(btrim(coalesce(p_contacto_puesto,'')), ''),
            nullif(left(btrim(coalesce(p_grabacion,'')), 500), ''));

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
    extra = case when p_resultado = 'info_correo' then coalesce(extra, '{}'::jsonb) || jsonb_build_object('info_pendiente', true) else extra end
  where id = p.id
  returning * into fila;
  perform set_config('mara.llamada', '', true);
  return fila;
end; $function$;

-- 2) ------------------------------------------------------------------------------
update alumnos_prospectos set token = gen_random_uuid() where token is null;

/* El agente (o su titular, o administración) pide la liga personal de una persona. */
create or replace function alumno_liga(p_persona uuid, p_programa text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare a alumnos_prospectos;
begin
  select * into a from alumnos_prospectos where id = p_persona;
  if not found then raise exception 'No encontré a esa persona.'; end if;
  if not (es_admin() or (a.asignado_a is not null and a.asignado_a = mi_operador())
          or (es_titular() and a.callcenter_id = mi_callcenter())) then
    raise exception 'Esta persona no está asignada a ti.';
  end if;
  if p_programa is not null and not exists (select 1 from cursos where id = p_programa and publicado) then
    raise exception 'Ese programa no está disponible.';
  end if;
  update alumnos_prospectos set token = coalesce(token, gen_random_uuid()),
         programa_interes = coalesce(p_programa, programa_interes)
   where id = p_persona returning * into a;
  return a.token;
end; $$;
revoke all on function alumno_liga(uuid, text) from public, anon;
grant execute on function alumno_liga(uuid, text) to authenticated;

/* Al entrar con la liga, la cuenta queda unida a su ficha. Si al registrarse se le creó
   otra ficha, esa se une a la de la liga (se borra si nadie la trabajaba). */
create or replace function alumno_ligar_cuenta(p_token uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare a alumnos_prospectos; b alumnos_prospectos; yo uuid := auth.uid();
begin
  if yo is null then return null; end if;
  select * into a from alumnos_prospectos where token = p_token;
  if not found then return null; end if;
  if a.usuario_id = yo then return a.programa_interes; end if;
  if a.usuario_id is not null then return null; end if;
  select * into b from alumnos_prospectos where usuario_id = yo and id <> a.id;
  if found then
    if b.asignado_a is null and b.callcenter_id is null
       and not exists (select 1 from alumnos_contactos c where c.persona_id = b.id) then
      delete from alumnos_prospectos where id = b.id;
    else
      update alumnos_prospectos set usuario_id = null,
             notas = concat_ws(E'\n', nullif(notas, ''), 'Su cuenta quedó unida a otra ficha (liga de inscripción).')
       where id = b.id;
    end if;
    update alumnos_prospectos set
      correo = coalesce(alumnos_prospectos.correo, b.correo),
      telefono = coalesce(alumnos_prospectos.telefono, b.telefono)
     where id = a.id;
  end if;
  update alumnos_prospectos set usuario_id = yo where id = a.id;
  return a.programa_interes;
end; $$;
revoke all on function alumno_ligar_cuenta(uuid) from public, anon;
grant execute on function alumno_ligar_cuenta(uuid) to authenticated;

/* Programas que le recomendaron a la persona y todavía no paga (para mostrarlos en su inicio). */
create or replace function mis_programas_pendientes()
returns setof text
language sql stable security definer set search_path = public as $$
  select distinct a.programa_interes
    from alumnos_prospectos a
    join cursos c on c.id = a.programa_interes and c.publicado
   where a.usuario_id = auth.uid() and a.programa_interes is not null
     and not exists (select 1 from inscripciones i where i.usuario_id = auth.uid() and i.curso_id = a.programa_interes);
$$;
revoke all on function mis_programas_pendientes() from public, anon;
grant execute on function mis_programas_pendientes() to authenticated;

-- 3) ------------------------------------------------------------------------------
alter table callcenters add column if not exists reparto_activo boolean not null default false;
alter table callcenters add column if not exists reparto_pct numeric not null default 0 check (reparto_pct between 0 and 100);
alter table callcenters add column if not exists agentes_ven_comision boolean not null default false;
alter table operadores  add column if not exists reparto_pct numeric check (reparto_pct is null or reparto_pct between 0 and 100);

/* El titular guarda cómo reparte su comisión. */
create or replace function callcenter_reparto_guardar(p_activo boolean, p_pct numeric, p_agentes_ven boolean)
returns callcenters
language plpgsql security definer set search_path = public as $$
declare k callcenters;
begin
  if not es_titular() then raise exception 'Solo el titular del callcenter.'; end if;
  if p_pct is null or p_pct < 0 or p_pct > 100 then raise exception 'El porcentaje va de 0 a 100.'; end if;
  update callcenters set reparto_activo = coalesce(p_activo, false), reparto_pct = p_pct,
         agentes_ven_comision = coalesce(p_agentes_ven, false)
   where id = mi_callcenter() returning * into k;
  return k;
end; $$;
revoke all on function callcenter_reparto_guardar(boolean, numeric, boolean) from public, anon;
grant execute on function callcenter_reparto_guardar(boolean, numeric, boolean) to authenticated;

/* Porcentaje propio de un agente (vacío = el general del callcenter). */
create or replace function callcenter_agente_reparto(p_operador uuid, p_pct numeric)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_titular() then raise exception 'Solo el titular del callcenter.'; end if;
  if p_pct is not null and (p_pct < 0 or p_pct > 100) then raise exception 'El porcentaje va de 0 a 100.'; end if;
  update operadores set reparto_pct = p_pct where id = p_operador and callcenter_id = mi_callcenter() and not es_titular;
  if not found then raise exception 'Ese agente no es de tu equipo.'; end if;
end; $$;
revoke all on function callcenter_agente_reparto(uuid, numeric) from public, anon;
grant execute on function callcenter_agente_reparto(uuid, numeric) to authenticated;

/* Lo que ve el agente: solo si su titular encendió el reparto y le permite verlo. */
create or replace function agente_mis_comisiones()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o operadores; k callcenters; pct numeric;
begin
  select * into o from operadores where id = mi_operador();
  if o.id is null or o.callcenter_id is null or o.es_titular then return jsonb_build_object('visible', false); end if;
  select * into k from callcenters where id = o.callcenter_id;
  if not (k.reparto_activo and k.agentes_ven_comision) then return jsonb_build_object('visible', false); end if;
  pct := coalesce(o.reparto_pct, k.reparto_pct);
  return jsonb_build_object('visible', true, 'pct', pct, 'ventas', coalesce((
    select jsonb_agg(jsonb_build_object('fecha', c.creado_en, 'concepto', c.nota, 'tipo', c.tipo,
             'mi_parte', round(c.monto * pct / 100, 2),
             'estado', case when c.cancelada_en is not null then 'cancelada' when c.corte_id is not null then 'en recibo' else 'por cobrar' end)
             order by c.creado_en desc)
      from comisiones c where c.operador_id = o.id and c.creado_en > now() - interval '180 days'), '[]'::jsonb));
end; $$;
revoke all on function agente_mis_comisiones() from public, anon;
grant execute on function agente_mis_comisiones() to authenticated;
