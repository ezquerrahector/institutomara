-- ============================================================================
-- Instituto Mara — Piloto para empresas y módulo de Prospectos (13 oct 2026)
-- Se ejecuta DESPUÉS de empresas-admin.sql. Se puede correr más de una vez.
--
-- A. PILOTO PARA EMPRESAS
--    · Administración → Empresas → «Crear piloto»: N lugares (5 por defecto)
--      durante D días (15 por defecto) en una lista de programas. Cada lugar es
--      un código EMP- que sirve para UNO de esos programas, a elección de la
--      persona.
--    · Quien entra con un lugar de piloto queda inscrito con estatus «piloto»
--      y fecha de vencimiento. Al vencer pierde el acceso (conserva su avance).
--    · La constancia NO se emite mientras la inscripción sea de piloto.
--    · «Formalizar piloto»: registra el pago, convierte las inscripciones de
--      piloto en normales (se libera la constancia) y extiende los lugares
--      que no se usaron a 12 meses.
--
-- B. PROSPECTOS (Administración → Prospectos)
--    · prospectos: empresas a las que se les ofrece capacitación (se cargan
--      desde CSV sin duplicar).
--    · prospecto_contactos: cada contacto (correo, WhatsApp, llamada…), con
--      fecha, canal, número de toque y resultado.
--    · prospecto_giros: el texto por giro que usan los correos.
--    · Secuencia automática de correo (toques 2 y 3) con la tarea diaria
--      «mara-prospectos»; solo envía si está encendida en Ajustes.
-- ============================================================================

-- ============================ A. PILOTO =====================================
alter table cupones add column if not exists cursos text[];              -- lista de programas válidos (null = usa curso_id)
alter table cupones add column if not exists piloto boolean not null default false;
alter table inscripciones add column if not exists vence date;          -- solo para pilotos
alter table empresas_compras add column if not exists cursos text[];     -- programas del piloto
alter table empresas_compras drop constraint if exists empresas_compras_estado_check;
alter table empresas_compras add constraint empresas_compras_estado_check
  check (estado in ('pendiente_pago','pagado','cancelado','piloto'));
alter table empresas_codigos add column if not exists curso_id text;    -- programa que eligió quien lo canjeó

-- Validar cupón: ahora respeta la lista de programas del cupón (pilotos).
create or replace function aplicar_cupon(p_codigo text, p_curso_id text)
returns table (valido boolean, motivo text, precio_original numeric,
               descuento numeric, precio_final numeric)
language plpgsql security definer set search_path = public as $$
declare
  c cupones%rowtype;
  p numeric;
  d numeric;
begin
  select precio into p from cursos where id = p_curso_id and publicado;
  if p is null then
    return query select false, 'Ese curso no está disponible.', 0::numeric, 0::numeric, 0::numeric; return;
  end if;
  select * into c from cupones where upper(codigo) = upper(btrim(p_codigo));
  if not found or not c.activo then
    return query select false, 'Ese cupón no existe o ya no está activo.', p, 0::numeric, p; return;
  end if;
  if c.vence is not null and c.vence < current_date then
    return query select false, 'Ese cupón ya venció.', p, 0::numeric, p; return;
  end if;
  if c.usos_max is not null and c.usos >= c.usos_max then
    return query select false, 'Ese cupón ya llegó a su límite de usos.', p, 0::numeric, p; return;
  end if;
  if c.cursos is not null and array_length(c.cursos, 1) > 0 then
    if not (p_curso_id = any(c.cursos)) then
      return query select false, 'Este lugar es para otros programas. Revisa la lista que te compartió tu empresa.', p, 0::numeric, p; return;
    end if;
  elsif c.curso_id is not null and c.curso_id <> p_curso_id then
    return query select false, 'Ese cupón no aplica a este curso.', p, 0::numeric, p; return;
  end if;
  if c.curso_id is null and c.cursos is null and p_curso_id like 'r-%' then
    return query select false, 'Las rutas ya tienen precio especial; este cupón es para programas individuales.', p, 0::numeric, p; return;
  end if;
  d := case when c.tipo = 'porcentaje' then round(p * least(c.valor, 100) / 100, 2) else least(c.valor, p) end;
  return query select true, coalesce(c.descripcion, 'Cupón aplicado'), p, d, round(p - d, 2);
end; $$;
revoke all on function aplicar_cupon(text, text) from public;
grant execute on function aplicar_cupon(text, text) to authenticated;

-- Canjear cupón: los de piloto inscriben con estatus «piloto» y vencimiento.
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
      values (p_usuario, p_curso_id, 'piloto', coalesce(c.vence, current_date + 15))
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

-- Al canjear un lugar EMP- se guarda también el programa que eligió.
create or replace function ligar_codigo_empresa() returns trigger
language plpgsql security definer set search_path = public as $$
declare cod text; emp uuid;
begin
  if new.nota like 'Acceso otorgado con el cupón EMP-%' then
    cod := substring(new.nota from 'EMP-[A-Z0-9]+');
    update empresas_codigos set usuario_id = new.usuario_id, canjeado_en = now(), curso_id = new.curso_id
      where codigo = cod and usuario_id is null;
    select e.empresa_id into emp from empresas_codigos k join empresas_compras e on e.id = k.compra_id where k.codigo = cod;
    if emp is not null and new.usuario_id is not null then
      insert into empresas_miembros (empresa_id, usuario_id, origen) values (emp, new.usuario_id, 'codigo')
        on conflict (empresa_id, usuario_id) do nothing;
    end if;
  end if;
  return new;
end; $$;

-- Constancias: no se emiten para inscripciones de piloto.
drop policy if exists "constancias propias crea" on constancias;
create policy "constancias propias crea" on constancias for insert with check (
  es_admin()
  or (
    usuario_id = auth.uid()
    and exists (select 1 from inscripciones i where i.usuario_id = auth.uid() and i.curso_id = constancias.curso_id
                and i.estatus <> 'piloto'
                and (i.estatus <> 'membresia' or membresia_permite_constancia(auth.uid(), constancias.curso_id)))
  )
);

-- Lugares de la empresa (ahora incluye pilotos).
drop function if exists empresa_lugares(uuid);
create or replace function empresa_lugares(p_empresa uuid)
returns table (codigo text, compra_id uuid, curso_id text, asignado_nombre text, asignado_correo text,
               enviado_en timestamptz, usuario_id uuid, alumno text, canjeado_en timestamptz, vence date,
               piloto boolean, cursos text[])
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
           coalesce(cu.piloto, false), e.cursos
    from empresas_codigos k
    join empresas_compras e on e.id = k.compra_id
    left join perfiles p on p.id = k.usuario_id
    left join cupones cu on cu.codigo = k.codigo
    where e.empresa_id = p_empresa and e.estado in ('pagado','piloto')
    order by e.creado_en desc, (k.usuario_id is null), k.codigo;
end; $$;
revoke all on function empresa_lugares(uuid) from public;
grant execute on function empresa_lugares(uuid) to authenticated;

-- Reporte: también los programas del piloto.
create or replace function empresa_reporte(p_empresa uuid)
returns table (usuario_id uuid, nombre text, correo text, telefono text, area text, num_empleado text,
               ultimo_acceso timestamptz, curso_id text, inscrito date, lecciones text[], calificaciones jsonb,
               avance_actualizado timestamptz, constancia_folio text, constancia_fecha date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (es_admin() or es_admin_empresa(p_empresa)) then
    raise exception 'No tienes acceso a esta empresa.';
  end if;
  return query
    with programas as (
      select distinct unnest(coalesce(ec.cursos, array[ec.curso_id])) as curso_id from empresas_compras ec
      where ec.empresa_id = p_empresa and ec.estado in ('pagado','piloto')
    )
    select m.usuario_id, coalesce(nullif(p.nombre_constancia,''), p.nombre), p.correo, p.telefono, m.area, m.num_empleado,
           p.ultimo_acceso, i.curso_id, i.fecha, coalesce(a.lecciones_vistas, '{}'), coalesce(a.calificaciones_modulo, '{}'::jsonb),
           a.actualizado_en, c.folio, c.fecha
    from empresas_miembros m
    join perfiles p on p.id = m.usuario_id
    left join inscripciones i on i.usuario_id = m.usuario_id and i.curso_id in (select pr.curso_id from programas pr)
    left join avances a on a.usuario_id = m.usuario_id and a.curso_id = i.curso_id
    left join constancias c on c.usuario_id = m.usuario_id and c.curso_id = i.curso_id
    where m.empresa_id = p_empresa
    order by p.nombre, i.curso_id;
end; $$;
revoke all on function empresa_reporte(uuid) from public;
grant execute on function empresa_reporte(uuid) to authenticated;

-- Crear un piloto: N lugares, D días, lista de programas.
create or replace function empresa_crear_piloto(p_empresa uuid, p_cursos text[], p_lugares int default 5,
                                                p_dias int default 15, p_nota text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  e empresas; compra uuid; cod text; i int; j int; validos text[];
  letras text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  fin date := current_date + coalesce(p_dias, 15);
begin
  if not es_admin() then raise exception 'Solo administración puede hacer esto.'; end if;
  select * into e from empresas where id = p_empresa;
  if e.id is null then raise exception 'Empresa no encontrada.'; end if;
  select array_agg(id order by array_position(p_cursos, id)) into validos from cursos where id = any(p_cursos) and publicado;
  if validos is null or array_length(validos, 1) = 0 then raise exception 'Elige al menos un programa.'; end if;
  if p_lugares is null or p_lugares < 1 or p_lugares > 50 then raise exception 'Un piloto va de 1 a 50 lugares.'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 60 then raise exception 'Un piloto dura de 1 a 60 días.'; end if;

  insert into empresas_compras (comprador_id, empresa, rfc, contacto_nombre, contacto_correo, contacto_tel, curso_id, cursos,
                                lugares, precio_unit, pct, total, estado, empresa_id, medio, nota)
  values (auth.uid(), e.nombre, e.rfc, e.contacto_nombre, e.contacto_correo, e.contacto_tel, validos[1], validos,
          p_lugares, 0, 100, 0, 'piloto', e.id, 'piloto',
          'Piloto de ' || p_dias || ' días, hasta el ' || to_char(fin, 'DD/MM/YYYY') || coalesce(' · ' || nullif(trim(p_nota),''), ''))
  returning id into compra;

  for i in 1..p_lugares loop
    loop
      cod := 'EMP-';
      for j in 1..7 loop cod := cod || substr(letras, 1 + floor(random() * 32)::int, 1); end loop;
      exit when not exists (select 1 from cupones where codigo = cod);
    end loop;
    insert into cupones (codigo, descripcion, tipo, valor, curso_id, cursos, piloto, usos_max, vence)
      values (cod, 'Piloto de ' || e.nombre, 'porcentaje', 100, null, validos, true, 1, fin);
    insert into empresas_codigos (codigo, compra_id) values (cod, compra);
  end loop;
  return compra;
end; $$;
revoke all on function empresa_crear_piloto(uuid, text[], int, int, text) from public;
grant execute on function empresa_crear_piloto(uuid, text[], int, int, text) to authenticated;

-- Formalizar un piloto cuando la empresa paga.
create or replace function empresa_formalizar_piloto(p_compra uuid, p_total numeric, p_nota text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare k empresas_compras;
begin
  if not es_admin() then raise exception 'Solo administración puede hacer esto.'; end if;
  select * into k from empresas_compras where id = p_compra;
  if k.id is null or k.estado <> 'piloto' then raise exception 'Ese paquete no es un piloto pendiente.'; end if;
  if p_total is null or p_total < 0 then raise exception 'Revisa el total.'; end if;

  update empresas_compras set estado = 'pagado', pagado_en = now(), total = p_total, medio = 'manual',
         precio_unit = round(p_total / greatest(lugares,1), 2), pct = 0,
         nota = coalesce(nota, '') || ' · Formalizado ' || to_char(current_date, 'DD/MM/YYYY') || coalesce(' · ' || nullif(trim(p_nota),''), '')
   where id = p_compra;

  -- Quienes ya entraron: su inscripción deja de ser de prueba (se libera la constancia).
  update inscripciones i set estatus = 'activa', vence = null
    from empresas_codigos c
   where c.compra_id = p_compra and c.usuario_id is not null
     and i.usuario_id = c.usuario_id and i.curso_id = c.curso_id and i.estatus = 'piloto';

  -- Lugares sin usar: pasan a lugares normales por 12 meses.
  update cupones set piloto = false, vence = current_date + 365, descripcion = 'Lugar de ' || k.empresa
   where codigo in (select codigo from empresas_codigos where compra_id = p_compra) and usos = 0;

  if p_total > 0 then
    insert into pagos (usuario_id, curso_id, monto, medio, referencia_mp, nota)
      values (auth.uid(), k.curso_id, p_total, 'Transferencia', 'piloto-' || p_compra,
              'Empresa: ' || k.empresa || ' · piloto formalizado (' || k.lugares || ' lugares)' || coalesce(' · ' || nullif(trim(p_nota),''), ''));
  end if;
end; $$;
revoke all on function empresa_formalizar_piloto(uuid, numeric, text) from public;
grant execute on function empresa_formalizar_piloto(uuid, numeric, text) to authenticated;


-- ============================ B. PROSPECTOS =================================
create table if not exists prospectos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nombre_corto text,                       -- como se le llama en el correo («Oliansa»)
  segmento text,
  direccion text,
  puntuacion numeric,
  resenas int,
  telefono text,
  correo text,                             -- uno o varios, separados por coma
  whatsapp text,
  web text,
  tipo_negocio text,
  publico text,
  cursos_interes text,                     -- tal como venía en el archivo
  cursos_ids text[],                       -- los mismos, ya ligados al catálogo
  puntos_fuertes text,
  presencia text,
  responde_resenas text,
  gancho text,                             -- frase positiva para abrir el correo
  extra jsonb not null default '{}'::jsonb,-- otras columnas del archivo
  lote text,                               -- archivo o fecha de carga
  num_origen int,                          -- N° en el archivo original
  estado text not null default 'nuevo'
    check (estado in ('nuevo','contactado','respondio','demo','piloto','cliente','descartado','baja')),
  secuencia boolean not null default false,-- recibe los seguimientos automáticos por correo
  empresa_id uuid references empresas(id) on delete set null,
  notas text,
  token uuid not null default gen_random_uuid(),  -- para el enlace «no recibir más»
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists prospectos_estado on prospectos (estado);
create unique index if not exists prospectos_token on prospectos (token);
alter table prospectos enable row level security;

create table if not exists prospecto_contactos (
  id uuid primary key default gen_random_uuid(),
  prospecto_id uuid not null references prospectos(id) on delete cascade,
  fecha timestamptz not null default now(),
  canal text not null check (canal in ('correo','whatsapp','llamada','visita','otro')),
  sentido text not null default 'saliente' check (sentido in ('saliente','entrante')),
  toque int,                               -- 1, 2, 3… (solo salientes)
  asunto text,
  resumen text,
  resultado text,                          -- enviado, rebotó, respondió, sin respuesta, baja…
  automatico boolean not null default false,
  creado_por uuid references perfiles(id) on delete set null
);
create index if not exists prospecto_contactos_p on prospecto_contactos (prospecto_id, fecha);
alter table prospecto_contactos enable row level security;

create table if not exists prospecto_giros (
  segmento text primary key,
  tema text not null,                      -- va en el asunto: «capacitación en ___»
  problema text not null,                  -- el reto del giro, una o dos frases
  giro_corto text not null                 -- para WhatsApp: «Para ___ recomendamos…»
);
alter table prospecto_giros enable row level security;

drop policy if exists "prospectos admin" on prospectos;
create policy "prospectos admin" on prospectos for all using (es_admin()) with check (es_admin());
drop policy if exists "prospecto contactos admin" on prospecto_contactos;
create policy "prospecto contactos admin" on prospecto_contactos for all using (es_admin()) with check (es_admin());
drop policy if exists "prospecto giros admin" on prospecto_giros;
create policy "prospecto giros admin" on prospecto_giros for all using (es_admin()) with check (es_admin());
grant select, insert, update, delete on prospectos, prospecto_contactos, prospecto_giros to authenticated;

create or replace function prospectos_tocar() returns trigger language plpgsql as $$
begin new.actualizado_en := now(); return new; end; $$;
drop trigger if exists prospectos_actualizado on prospectos;
create trigger prospectos_actualizado before update on prospectos for each row execute function prospectos_tocar();

-- Un contacto saliente pasa al prospecto de «nuevo» a «contactado»; una
-- respuesta lo pasa a «respondió» y detiene la secuencia automática.
create or replace function prospecto_contacto_estado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sentido = 'saliente' and coalesce(new.resultado,'') <> 'rebotó' then
    update prospectos set estado = 'contactado' where id = new.prospecto_id and estado = 'nuevo';
  end if;
  if new.sentido = 'entrante' or new.resultado = 'respondió' then
    update prospectos set estado = case when estado in ('nuevo','contactado') then 'respondio' else estado end,
                          secuencia = false
     where id = new.prospecto_id;
  end if;
  return new;
end; $$;
drop trigger if exists prospecto_contacto_estado on prospecto_contactos;
create trigger prospecto_contacto_estado after insert on prospecto_contactos for each row execute function prospecto_contacto_estado();

-- Ajustes de la secuencia automática.
alter table ajustes add column if not exists prospectos_auto boolean not null default false;
alter table ajustes add column if not exists prospectos_dia_2 int not null default 4;
alter table ajustes add column if not exists prospectos_dia_3 int not null default 10;

-- Textos por giro (se editan en Administración → Prospectos → Textos por giro).
insert into prospecto_giros (segmento, tema, problema, giro_corto) values
 ('Manufactura de calzado','NOM-035 y seguridad','En la industria del calzado, capacitar a todo el personal suele chocar con los turnos y la producción, y la NOM-035 y las normas STPS exigen hacerlo.','la industria del calzado'),
 ('Curtiduría / proveeduría de piel','NOM-035 y seguridad','En una curtiduría, capacitar al personal choca con los turnos y la producción, y la NOM-035 y las normas STPS exigen hacerlo.','curtidurías'),
 ('Industria / manufactura','NOM-035, seguridad y liderazgo','En una planta, capacitar a operación y a mandos medios sin detener la producción es difícil, y la NOM-035 y las normas STPS lo exigen.','la industria'),
 ('Concesionaria automotriz','atención y cierre de ventas','En una agencia, cada asesor es la cara de la marca. Capacitar a todo el piso de ventas sin sacarlo del piso es difícil, y la rotación obliga a empezar de nuevo.','agencias automotrices'),
 ('Hotelería','servicio al huésped','En un hotel, el servicio lo dan muchas personas en distintos turnos, y la experiencia del huésped depende de que todas tengan la misma preparación.','hoteles'),
 ('Despacho contable / fiscal','actualización fiscal e IA','En un despacho contable, la actualización fiscal no espera: cambian las reglas, llegan los cierres y el tiempo para capacitar al equipo siempre es poco.','despachos contables'),
 ('Consultorio de psicología','formación clínica','En la práctica clínica, la formación continua marca la diferencia, pero es difícil acomodarla entre consultas.','consultorios de psicología'),
 ('Funeraria','acompañamiento en el duelo','En una funeraria, la forma en que el personal acompaña a una familia en su peor momento es lo que la familia recuerda.','funerarias'),
 ('Hospital / clínica privada','trato al paciente y NOM-035','En un hospital, la experiencia del paciente depende del trato de cada persona del equipo, y los turnos hacen difícil capacitar a todos por igual.','hospitales'),
 ('Agencia de marketing digital','IA y marketing','En una agencia, las herramientas cambian cada mes y la IA ya es parte del trabajo diario. Mantener al equipo al día sin frenar los proyectos es un reto.','agencias de marketing'),
 ('Reclutamiento / capital humano','reclutamiento, LFT y NOM-035','En capital humano, el equipo tiene que estar al día en la Ley Federal del Trabajo, la NOM-035 y las nuevas herramientas para reclutar, y casi nunca hay tiempo para un curso presencial.','empresas de reclutamiento'),
 ('Despacho jurídico','formación especializada','En un despacho, la preparación del equipo en negociación, oratoria y análisis de casos se refleja en cada asunto.','despachos jurídicos'),
 ('Inmobiliaria','negociación y ventas','En el sector inmobiliario, cada asesor gana o pierde una operación por cómo comunica, negocia y da seguimiento.','inmobiliarias'),
 ('Aseguradora / agencia de seguros','atención y ventas','En seguros, la venta y la postventa dependen de cómo el equipo atiende, explica y resuelve.','agencias de seguros'),
 ('Boutique de ropa','venta en línea','En una boutique, la venta ya ocurre tanto en el mostrador como en WhatsApp y redes, y el equipo necesita dominar las dos.','boutiques'),
 ('Coworking / oficinas ejecutivas','productividad e IA','En un centro de negocios, el equipo atiende a muchos clientes distintos y necesita herramientas actuales para hacerlo bien.','centros de negocios'),
 ('Seguridad privada','atención, manejo de conflictos y NOM-035','En seguridad privada, la rotación es alta y cada elemento necesita la misma preparación para atender, mediar y reportar, en cualquier turno.','empresas de seguridad privada'),
 ('Colegio privado','formación docente','En un colegio, la formación docente compite con planeaciones, clases y juntas; casi nunca queda tiempo para un curso presencial.','colegios'),
 ('Call center','atención al cliente e IA','En un call center, la calidad de cada llamada depende de la preparación del agente, y la rotación obliga a capacitar de forma constante.','call centers'),
 ('Centro de terapia infantil / neurodesarrollo','neurodiversidad y acompañamiento','En un centro de terapia infantil, el equipo necesita actualizarse en neurodesarrollo, inclusión y acompañamiento a familias sin dejar de atender.','centros de terapia infantil'),
 ('Diagnóstico médico por imagen','atención al paciente','En un centro de diagnóstico, la rapidez y el trato en recepción y estudio son lo que el paciente recuerda.','centros de diagnóstico'),
 ('Residencia de adultos mayores','cuidado y acompañamiento','En una residencia, la calidad del cuidado depende de que todo el personal, en todos los turnos, tenga la misma preparación.','residencias de adultos mayores'),
 ('Asesoría de imagen','imagen y comunicación','En asesoría de imagen, la formación del equipo en comunicación y marca personal es el producto mismo.','asesoría de imagen')
on conflict (segmento) do nothing;

-- Darse de baja con el enlace del correo (no requiere sesión).
create or replace function prospecto_baja(p_token uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare p prospectos;
begin
  select * into p from prospectos where token = p_token;
  if p.id is null then return null; end if;
  if p.estado <> 'baja' then
    update prospectos set estado = 'baja', secuencia = false where id = p.id;
    insert into prospecto_contactos (prospecto_id, canal, sentido, resumen, resultado)
      values (p.id, 'correo', 'entrante', 'Pidió no recibir más correos (enlace de baja).', 'baja');
  end if;
  return coalesce(p.nombre_corto, p.nombre);
end; $$;
revoke all on function prospecto_baja(uuid) from public;

-- Tarea diaria: seguimientos automáticos (la función revisa si están encendidos).
select cron.unschedule('mara-prospectos') where exists (select 1 from cron.job where jobname = 'mara-prospectos');
select cron.schedule('mara-prospectos', '0 16 * * 1-5', $$
  select net.http_post(
    url := 'https://xvihjhfvwjgpesxpdtnl.supabase.co/functions/v1/prospectos',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name='mara_service_role')),
    body := '{"accion":"diaria"}'::jsonb)
$$);

select 'ok' as resultado;
