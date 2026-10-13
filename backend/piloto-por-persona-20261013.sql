-- ============================================================================
-- Instituto Mara — Piloto por persona (13 oct 2026). Ejecutar DESPUÉS de
-- prospectos-piloto.sql. Se puede correr más de una vez.
--
--   · Cada empleado tiene N días de acceso contados desde que ACTIVA su lugar
--     (15 por defecto), con un plazo para activarlo (30 días por defecto).
--   · La empresa puede elegir el curso de cada persona al asignar el lugar; si
--     no lo elige, la persona escoge uno de los programas del piloto.
-- ============================================================================

alter table cupones add column if not exists dias_acceso int;   -- piloto: días de acceso desde que se activa

-- Canjear: el acceso del piloto se cuenta desde hoy (día de activación).
create or replace function canjear_cupon(p_codigo text, p_curso_id text, p_usuario uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v record;
  c cupones%rowtype;
begin
  select * into v from aplicar_cupon(p_codigo, p_curso_id);
  if not v.valido then
    return jsonb_build_object('ok', false, 'motivo', v.motivo);
  end if;
  select * into c from cupones where upper(codigo) = upper(btrim(p_codigo));
  update cupones set usos = usos + 1 where upper(codigo) = upper(btrim(p_codigo));

  if v.precio_final <= 0 then
    if c.piloto then
      insert into inscripciones (usuario_id, curso_id, estatus, vence)
      values (p_usuario, p_curso_id, 'piloto', current_date + coalesce(c.dias_acceso, 15))
      on conflict (usuario_id, curso_id) do nothing;
    else
      insert into inscripciones (usuario_id, curso_id, estatus)
      values (p_usuario, p_curso_id, 'activa')
      on conflict (usuario_id, curso_id) do nothing;
    end if;
    insert into pagos (usuario_id, curso_id, monto, medio, nota)
    values (p_usuario, p_curso_id, 0, 'Cupón',
            'Acceso otorgado con el cupón ' || upper(btrim(p_codigo)) || case when c.piloto then ' (piloto)' else '' end);
  end if;
  return jsonb_build_object('ok', true, 'precio_final', v.precio_final,
                            'descuento', v.descuento, 'gratis', v.precio_final <= 0, 'piloto', c.piloto);
end; $$;
revoke all on function canjear_cupon(text, text, uuid) from public;

-- Crear piloto: días de acceso por persona y plazo para activar.
drop function if exists empresa_crear_piloto(uuid, text[], int, int, text);
create or replace function empresa_crear_piloto(p_empresa uuid, p_cursos text[], p_lugares int default 5,
                                                p_dias int default 15, p_nota text default null, p_plazo int default 30)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  e empresas; compra uuid; cod text; i int; j int; validos text[];
  letras text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  limite date := current_date + coalesce(p_plazo, 30);
begin
  if not es_admin() then raise exception 'Solo administración puede hacer esto.'; end if;
  select * into e from empresas where id = p_empresa;
  if e.id is null then raise exception 'Empresa no encontrada.'; end if;
  select array_agg(id order by array_position(p_cursos, id)) into validos from cursos where id = any(p_cursos) and publicado;
  if validos is null or array_length(validos, 1) = 0 then raise exception 'Elige al menos un programa.'; end if;
  if p_lugares is null or p_lugares < 1 or p_lugares > 50 then raise exception 'Un piloto va de 1 a 50 lugares.'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 60 then raise exception 'El acceso dura de 1 a 60 días.'; end if;
  if p_plazo is null or p_plazo < 1 or p_plazo > 120 then raise exception 'El plazo para activar va de 1 a 120 días.'; end if;

  insert into empresas_compras (comprador_id, empresa, rfc, contacto_nombre, contacto_correo, contacto_tel, curso_id, cursos,
                                lugares, precio_unit, pct, total, estado, empresa_id, medio, nota)
  values (auth.uid(), e.nombre, e.rfc, e.contacto_nombre, e.contacto_correo, e.contacto_tel, validos[1], validos,
          p_lugares, 0, 100, 0, 'piloto', e.id, 'piloto',
          'Piloto: ' || p_dias || ' días de acceso por persona; activar antes del ' || to_char(limite, 'DD/MM/YYYY') ||
          coalesce(' · ' || nullif(trim(p_nota),''), ''))
  returning id into compra;

  for i in 1..p_lugares loop
    loop
      cod := 'EMP-';
      for j in 1..7 loop cod := cod || substr(letras, 1 + floor(random() * 32)::int, 1); end loop;
      exit when not exists (select 1 from cupones where codigo = cod);
    end loop;
    insert into cupones (codigo, descripcion, tipo, valor, curso_id, cursos, piloto, dias_acceso, usos_max, vence)
      values (cod, 'Piloto de ' || e.nombre, 'porcentaje', 100, null, validos, true, p_dias, 1, limite);
    insert into empresas_codigos (codigo, compra_id) values (cod, compra);
  end loop;
  return compra;
end; $$;
revoke all on function empresa_crear_piloto(uuid, text[], int, int, text, int) from public;
grant execute on function empresa_crear_piloto(uuid, text[], int, int, text, int) to authenticated;

-- Lugares: ahora también devuelve los días de acceso del piloto.
drop function if exists empresa_lugares(uuid);
create or replace function empresa_lugares(p_empresa uuid)
returns table (codigo text, compra_id uuid, curso_id text, asignado_nombre text, asignado_correo text,
               enviado_en timestamptz, usuario_id uuid, alumno text, canjeado_en timestamptz, vence date,
               piloto boolean, cursos text[], dias_acceso int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (es_admin() or es_admin_empresa(p_empresa)) then
    raise exception 'No tienes acceso a esta empresa.';
  end if;
  return query
    select k.codigo, k.compra_id,
           case when e.estado = 'piloto' or e.cursos is not null then k.curso_id else coalesce(k.curso_id, e.curso_id) end,
           k.asignado_nombre, k.asignado_correo, k.enviado_en,
           k.usuario_id, p.nombre, k.canjeado_en, cu.vence,
           coalesce(cu.piloto, false), e.cursos, cu.dias_acceso
    from empresas_codigos k
    join empresas_compras e on e.id = k.compra_id
    left join perfiles p on p.id = k.usuario_id
    left join cupones cu on cu.codigo = k.codigo
    where e.empresa_id = p_empresa and e.estado in ('pagado','piloto')
    order by e.creado_en desc, (k.usuario_id is null), k.codigo;
end; $$;
revoke all on function empresa_lugares(uuid) from public;
grant execute on function empresa_lugares(uuid) to authenticated;

select 'ok' as resultado;
