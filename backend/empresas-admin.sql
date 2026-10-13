-- ============================================================================
-- Instituto Mara — Empresas: administración, administradores de empresa y reportes
-- (13 oct 2026). Se ejecuta DESPUÉS de empresas-resenas.sql. Se puede correr
-- más de una vez sin romper nada.
--
--   1. Tabla «empresas» (cliente corporativo): datos, descuento pactado y
--      catálogo permitido. Las compras (en línea o manuales) se ligan a ella.
--   2. Administradores de empresa: personas que ven SOLO a su gente. Se dan de
--      alta por correo; si aún no tienen cuenta, quedan ligados al registrarse.
--   3. Empleados (miembros): entran solos al canjear un código EMP-, o los
--      agrega administración del Instituto.
--   4. Reporte: avance y constancias de los empleados, solo de los programas
--      que pagó la empresa (lo personal de cada quien no se muestra).
--   5. Venta manual (transferencia / factura) que genera los lugares.
-- ============================================================================

-- 1. Empresas -----------------------------------------------------------------
create table if not exists empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  razon_social text,
  rfc text,
  contacto_nombre text,
  contacto_correo text,
  contacto_tel text,
  descuento_pct numeric not null default 0 check (descuento_pct between 0 and 100),
  cursos_permitidos text[],                 -- null = todo el catálogo
  notas text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
alter table empresas enable row level security;

create table if not exists empresas_admins (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  correo text not null,
  nombre text,
  usuario_id uuid references perfiles(id) on delete set null,
  creado_en timestamptz not null default now()
);
create unique index if not exists empresas_admins_unico on empresas_admins (empresa_id, lower(correo));
create index if not exists empresas_admins_usuario on empresas_admins (usuario_id);
alter table empresas_admins enable row level security;

create table if not exists empresas_miembros (
  empresa_id uuid not null references empresas(id) on delete cascade,
  usuario_id uuid not null references perfiles(id) on delete cascade,
  area text,
  num_empleado text,
  origen text not null default 'manual',     -- 'codigo' | 'manual'
  agregado_en timestamptz not null default now(),
  primary key (empresa_id, usuario_id)
);
create index if not exists empresas_miembros_usuario on empresas_miembros (usuario_id);
alter table empresas_miembros enable row level security;

alter table empresas_compras add column if not exists empresa_id uuid references empresas(id) on delete set null;
alter table empresas_compras add column if not exists medio text not null default 'mercadopago';
alter table empresas_compras add column if not exists nota text;
-- Los paquetes especiales pueden ser de 1 a 500 lugares; la compra en línea sigue limitada a 5-50 por la función «tienda».
alter table empresas_compras drop constraint if exists empresas_compras_lugares_check;
alter table empresas_compras add constraint empresas_compras_lugares_check check (lugares between 1 and 500);
create index if not exists empresas_compras_empresa on empresas_compras (empresa_id);

-- 2. ¿Quien consulta administra esta empresa? ----------------------------------
create or replace function es_admin_empresa(p_empresa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from empresas_admins where empresa_id = p_empresa and usuario_id = auth.uid());
$$;
grant execute on function es_admin_empresa(uuid) to authenticated;

-- Empresas que administra el usuario en sesión. De paso liga las invitaciones
-- que se hicieron a su correo antes de que tuviera cuenta.
create or replace function mis_empresas()
returns setof empresas
language plpgsql security definer set search_path = public as $$
declare mi_correo text;
begin
  if auth.uid() is null then return; end if;
  select lower(correo) into mi_correo from perfiles where id = auth.uid();
  if mi_correo is not null then
    update empresas_admins set usuario_id = auth.uid()
      where usuario_id is null and lower(correo) = mi_correo;
  end if;
  return query
    select e.* from empresas e
    where e.activo and exists (select 1 from empresas_admins a where a.empresa_id = e.id and a.usuario_id = auth.uid())
    order by e.nombre;
end; $$;
revoke all on function mis_empresas() from public;
grant execute on function mis_empresas() to authenticated;

-- Permisos (RLS) ---------------------------------------------------------------
drop policy if exists "empresas lee" on empresas;
create policy "empresas lee" on empresas for select using (es_admin() or es_admin_empresa(id));
drop policy if exists "empresas admin escribe" on empresas;
create policy "empresas admin escribe" on empresas for all using (es_admin()) with check (es_admin());
grant select, insert, update, delete on empresas to authenticated;

drop policy if exists "empresas admins lee" on empresas_admins;
create policy "empresas admins lee" on empresas_admins for select using (es_admin() or usuario_id = auth.uid() or es_admin_empresa(empresa_id));
drop policy if exists "empresas admins escribe" on empresas_admins;
create policy "empresas admins escribe" on empresas_admins for all using (es_admin()) with check (es_admin());
grant select, insert, update, delete on empresas_admins to authenticated;

drop policy if exists "empresas miembros lee" on empresas_miembros;
create policy "empresas miembros lee" on empresas_miembros for select using (es_admin() or usuario_id = auth.uid() or es_admin_empresa(empresa_id));
drop policy if exists "empresas miembros escribe" on empresas_miembros;
create policy "empresas miembros escribe" on empresas_miembros for all using (es_admin()) with check (es_admin());
grant select, insert, update, delete on empresas_miembros to authenticated;

-- Las compras y los códigos ahora también los ve el administrador de la empresa.
drop policy if exists "empresa compra propia" on empresas_compras;
create policy "empresa compra propia" on empresas_compras for select using (
  comprador_id = auth.uid() or es_admin() or (empresa_id is not null and es_admin_empresa(empresa_id)));
drop policy if exists "empresa compra admin edita" on empresas_compras;
create policy "empresa compra admin edita" on empresas_compras for update using (es_admin()) with check (es_admin());
grant update on empresas_compras to authenticated;

drop policy if exists "empresa codigos propios" on empresas_codigos;
create policy "empresa codigos propios" on empresas_codigos for select using (
  es_admin() or exists (select 1 from empresas_compras e where e.id = empresas_codigos.compra_id
    and (e.comprador_id = auth.uid() or (e.empresa_id is not null and es_admin_empresa(e.empresa_id)))));

-- 3. Al canjear un código EMP-, la persona queda como empleado de la empresa ---
create or replace function ligar_codigo_empresa() returns trigger
language plpgsql security definer set search_path = public as $$
declare cod text; emp uuid;
begin
  if new.nota like 'Acceso otorgado con el cupón EMP-%' then
    cod := substring(new.nota from 'EMP-[A-Z0-9]+');
    update empresas_codigos set usuario_id = new.usuario_id, canjeado_en = now()
      where codigo = cod and usuario_id is null;
    select e.empresa_id into emp from empresas_codigos k join empresas_compras e on e.id = k.compra_id where k.codigo = cod;
    if emp is not null and new.usuario_id is not null then
      insert into empresas_miembros (empresa_id, usuario_id, origen) values (emp, new.usuario_id, 'codigo')
        on conflict (empresa_id, usuario_id) do nothing;
    end if;
  end if;
  return new;
end; $$;

-- El panel del comprador también lo puede abrir el administrador de la empresa.
create or replace function empresa_avance(p_compra uuid)
returns table (codigo text, asignado_nombre text, asignado_correo text, enviado_en timestamptz,
               alumno text, canjeado_en timestamptz, lecciones_vistas int, modulos_aprobados int,
               constancia_folio text, constancia_fecha date)
language sql stable security definer set search_path = public as $$
  select k.codigo, k.asignado_nombre, k.asignado_correo, k.enviado_en,
         p.nombre, k.canjeado_en,
         coalesce(array_length(a.lecciones_vistas, 1), 0),
         coalesce((select count(*)::int from jsonb_each_text(a.calificaciones_modulo) q where q.value::numeric >= 80), 0),
         c.folio, c.fecha
  from empresas_codigos k
  join empresas_compras e on e.id = k.compra_id
  left join perfiles p on p.id = k.usuario_id
  left join avances a on a.usuario_id = k.usuario_id and a.curso_id = e.curso_id
  left join constancias c on c.usuario_id = k.usuario_id and c.curso_id = e.curso_id
  where k.compra_id = p_compra
    and (e.comprador_id = auth.uid() or es_admin() or (e.empresa_id is not null and es_admin_empresa(e.empresa_id)))
  order by k.codigo;
$$;
grant execute on function empresa_avance(uuid) to authenticated;

-- 4. Reporte de la empresa -----------------------------------------------------
-- Una fila por empleado y programa pagado por la empresa (también los que aún
-- no empiezan). Solo para administración o el administrador de esa empresa.
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
      select distinct ec.curso_id from empresas_compras ec
      where ec.empresa_id = p_empresa and ec.estado = 'pagado'
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

-- Lugares (códigos) de todas las compras de la empresa.
create or replace function empresa_lugares(p_empresa uuid)
returns table (codigo text, compra_id uuid, curso_id text, asignado_nombre text, asignado_correo text,
               enviado_en timestamptz, usuario_id uuid, alumno text, canjeado_en timestamptz, vence date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (es_admin() or es_admin_empresa(p_empresa)) then
    raise exception 'No tienes acceso a esta empresa.';
  end if;
  return query
    select k.codigo, k.compra_id, e.curso_id, k.asignado_nombre, k.asignado_correo, k.enviado_en,
           k.usuario_id, p.nombre, k.canjeado_en, cu.vence
    from empresas_codigos k
    join empresas_compras e on e.id = k.compra_id
    left join perfiles p on p.id = k.usuario_id
    left join cupones cu on cu.codigo = k.codigo
    where e.empresa_id = p_empresa and e.estado = 'pagado'
    order by e.curso_id, (k.usuario_id is null), k.codigo;
end; $$;
revoke all on function empresa_lugares(uuid) from public;
grant execute on function empresa_lugares(uuid) to authenticated;

-- 5. Herramientas de administración -------------------------------------------
-- Dar de alta a un administrador de empresa por correo.
create or replace function empresa_agregar_admin(p_empresa uuid, p_correo text, p_nombre text default null)
returns empresas_admins
language plpgsql security definer set search_path = public as $$
declare fila empresas_admins; limpio text := lower(trim(p_correo));
begin
  if not es_admin() then raise exception 'Solo administración puede hacer esto.'; end if;
  if limpio !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisa el correo.'; end if;
  insert into empresas_admins (empresa_id, correo, nombre, usuario_id)
    values (p_empresa, limpio, nullif(trim(p_nombre),''), (select id from perfiles where lower(correo) = limpio))
    on conflict (empresa_id, lower(correo)) do update set nombre = coalesce(excluded.nombre, empresas_admins.nombre),
      usuario_id = coalesce(empresas_admins.usuario_id, excluded.usuario_id)
    returning * into fila;
  return fila;
end; $$;
revoke all on function empresa_agregar_admin(uuid, text, text) from public;
grant execute on function empresa_agregar_admin(uuid, text, text) to authenticated;

-- Agregar a un empleado que ya tiene cuenta (por correo).
create or replace function empresa_agregar_miembro(p_empresa uuid, p_correo text, p_area text default null, p_num text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not es_admin() then raise exception 'Solo administración puede hacer esto.'; end if;
  select id into uid from perfiles where lower(correo) = lower(trim(p_correo));
  if uid is null then raise exception 'No hay ninguna cuenta con ese correo. Asígnale un lugar para que se registre.'; end if;
  insert into empresas_miembros (empresa_id, usuario_id, area, num_empleado, origen)
    values (p_empresa, uid, nullif(trim(p_area),''), nullif(trim(p_num),''), 'manual')
    on conflict (empresa_id, usuario_id) do update set area = coalesce(excluded.area, empresas_miembros.area),
      num_empleado = coalesce(excluded.num_empleado, empresas_miembros.num_empleado);
  return uid;
end; $$;
revoke all on function empresa_agregar_miembro(uuid, text, text, text) from public;
grant execute on function empresa_agregar_miembro(uuid, text, text, text) to authenticated;

-- Área y número de empleado: los edita administración o el administrador de la empresa.
create or replace function empresa_editar_miembro(p_empresa uuid, p_usuario uuid, p_area text, p_num text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (es_admin() or es_admin_empresa(p_empresa)) then raise exception 'No tienes acceso a esta empresa.'; end if;
  update empresas_miembros set area = nullif(trim(p_area),''), num_empleado = nullif(trim(p_num),'')
    where empresa_id = p_empresa and usuario_id = p_usuario;
end; $$;
revoke all on function empresa_editar_miembro(uuid, uuid, text, text) from public;
grant execute on function empresa_editar_miembro(uuid, uuid, text, text) to authenticated;

-- Ligar una compra hecha en línea a una empresa (y sumar a quienes ya la usaron).
create or replace function empresa_ligar_compra(p_compra uuid, p_empresa uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo administración puede hacer esto.'; end if;
  update empresas_compras set empresa_id = p_empresa where id = p_compra;
  if p_empresa is not null then
    insert into empresas_miembros (empresa_id, usuario_id, origen)
      select p_empresa, k.usuario_id, 'codigo' from empresas_codigos k
      where k.compra_id = p_compra and k.usuario_id is not null
      on conflict (empresa_id, usuario_id) do nothing;
  end if;
end; $$;
revoke all on function empresa_ligar_compra(uuid, uuid) from public;
grant execute on function empresa_ligar_compra(uuid, uuid) to authenticated;

-- Venta manual (transferencia, factura, convenio): registra la compra pagada y
-- genera los lugares (cupones EMP- de 100 %, un uso, 12 meses por defecto).
create or replace function empresa_venta_manual(p_empresa uuid, p_curso text, p_lugares int, p_total numeric,
                                                p_nota text default null, p_vence date default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  e empresas; c cursos; compra uuid; cod text; i int; j int;
  letras text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  vence date := coalesce(p_vence, current_date + 365);
begin
  if not es_admin() then raise exception 'Solo administración puede hacer esto.'; end if;
  select * into e from empresas where id = p_empresa;
  if e.id is null then raise exception 'Empresa no encontrada.'; end if;
  select * into c from cursos where id = p_curso;
  if c.id is null then raise exception 'Programa no encontrado.'; end if;
  if p_lugares is null or p_lugares < 1 or p_lugares > 500 then raise exception 'Los lugares van de 1 a 500.'; end if;
  if p_total is null or p_total < 0 then raise exception 'Revisa el total.'; end if;

  insert into empresas_compras (comprador_id, empresa, rfc, contacto_nombre, contacto_correo, contacto_tel, curso_id,
                                lugares, precio_unit, pct, total, estado, pagado_en, empresa_id, medio, nota)
  values (auth.uid(), e.nombre, e.rfc, e.contacto_nombre, e.contacto_correo, e.contacto_tel, c.id, p_lugares,
          round(p_total / p_lugares, 2),
          case when coalesce(c.precio,0) > 0 then greatest(0, round(100 - (p_total / p_lugares) * 100 / c.precio, 1)) else 0 end,
          p_total, 'pagado', now(), e.id, 'manual', nullif(trim(p_nota),''))
  returning id into compra;

  for i in 1..p_lugares loop
    loop
      cod := 'EMP-';
      for j in 1..7 loop cod := cod || substr(letras, 1 + floor(random() * 32)::int, 1); end loop;
      exit when not exists (select 1 from cupones where codigo = cod);
    end loop;
    insert into cupones (codigo, descripcion, tipo, valor, curso_id, usos_max, vence)
      values (cod, 'Lugar de ' || e.nombre, 'porcentaje', 100, c.id, 1, vence);
    insert into empresas_codigos (codigo, compra_id) values (cod, compra);
  end loop;

  if p_total > 0 then
    insert into pagos (usuario_id, curso_id, monto, medio, referencia_mp, nota)
      values (auth.uid(), c.id, p_total, 'Transferencia', 'manual-' || compra,
              'Empresa: ' || e.nombre || ' · ' || p_lugares || ' lugares (venta manual)' || coalesce(' · ' || nullif(trim(p_nota),''), ''));
  end if;
  return compra;
end; $$;
revoke all on function empresa_venta_manual(uuid, text, int, numeric, text, date) from public;
grant execute on function empresa_venta_manual(uuid, text, int, numeric, text, date) to authenticated;

-- 6. Si quien compra en línea ya administra UNA empresa, la compra se liga sola.
create or replace function empresa_compra_autoligar() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; emp uuid;
begin
  if new.empresa_id is null then
    select count(distinct a.empresa_id), min(a.empresa_id::text)::uuid into n, emp
      from empresas_admins a where a.usuario_id = new.comprador_id;
    if n = 1 then new.empresa_id := emp; end if;
  end if;
  return new;
end; $$;
drop trigger if exists empresa_compra_ligar on empresas_compras;
create trigger empresa_compra_ligar before insert on empresas_compras
  for each row execute function empresa_compra_autoligar();
