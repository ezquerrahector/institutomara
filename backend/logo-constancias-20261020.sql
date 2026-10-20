-- ============================================================================
-- Instituto Mara — Logo de la empresa en las constancias (20 oct 2026)
-- Se puede correr más de una vez.
--
-- Decisión de Héctor (opción B):
--   · La empresa decide si su logo sale en las constancias de su personal. Va abajo,
--     como un sello más, entre la firma y el «Folio verificable».
--   · La empresa también decide si sale la línea «Capacitación del personal de …»,
--     y con qué nombre.
--   · Por defecto, las dos cosas están apagadas: la constancia sale como siempre.
--   · Lo configuran quien administra la empresa («Mi empresa»), su operador y
--     administración.
--   · Solo aplica a quien tiene un lugar activo en el plan de esa empresa al emitirse
--     la constancia.
--   · Cada constancia guarda una copia del logo y del nombre al emitirse: si después la
--     empresa cambia o quita su logo, o la persona deja la empresa, las constancias ya
--     emitidas no cambian (constancias permanentes).
--   · Lo decide el servidor: aunque alguien mande otro logo al crear su constancia, se
--     ignora.
-- ============================================================================

-- 1. Configuración de la empresa ---------------------------------------------------
alter table empresas add column if not exists logo_img text;                       -- data:image/png;base64,…
alter table empresas add column if not exists logo_en_constancias boolean not null default false;
alter table empresas add column if not exists nombre_en_constancias boolean not null default false;
alter table empresas add column if not exists nombre_constancia text;              -- cómo aparece en la línea

-- 2. Copia en cada constancia --------------------------------------------------------
alter table constancias add column if not exists empresa_id uuid references empresas(id) on delete set null;
alter table constancias add column if not exists empresa_logo text;
alter table constancias add column if not exists empresa_nombre text;

-- 3. ¿Quién puede cambiarla? (administración, su operador o quien administra la empresa)
create or replace function puede_marca_empresa(p_empresa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select es_admin() or es_admin_empresa(p_empresa) or puede_operar_empresa(p_empresa);
$$;
grant execute on function puede_marca_empresa(uuid) to authenticated;

create or replace function empresa_constancias_ver(p_empresa uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare r json;
begin
  if not puede_marca_empresa(p_empresa) then raise exception 'No tienes acceso a esta empresa.'; end if;
  select json_build_object('nombre', e.nombre, 'logo_img', e.logo_img,
           'logo_en_constancias', e.logo_en_constancias, 'nombre_en_constancias', e.nombre_en_constancias,
           'nombre_constancia', coalesce(nullif(trim(e.nombre_constancia), ''), e.nombre))
    into r from empresas e where e.id = p_empresa;
  return r;
end; $$;
revoke all on function empresa_constancias_ver(uuid) from public, anon;
grant execute on function empresa_constancias_ver(uuid) to authenticated;

create or replace function empresa_constancias_guardar(p_empresa uuid, p_logo text, p_logo_on boolean,
                                                       p_nombre_on boolean, p_nombre text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not puede_marca_empresa(p_empresa) then raise exception 'No tienes acceso a esta empresa.'; end if;
  if p_logo is not null and p_logo <> '' then
    if p_logo !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' then
      raise exception 'El logo debe ser una imagen PNG, JPG o WEBP.';
    end if;
    if length(p_logo) > 400000 then raise exception 'El logo pesa demasiado. Usa una imagen más pequeña.'; end if;
  end if;
  if coalesce(p_logo_on, false) and coalesce(nullif(p_logo, ''), null) is null then
    raise exception 'Sube el logo antes de activarlo en las constancias.';
  end if;
  if coalesce(p_nombre_on, false) and coalesce(trim(p_nombre), '') = '' then
    raise exception 'Escribe el nombre que aparecerá en la constancia.';
  end if;
  update empresas set logo_img = nullif(p_logo, ''),
                      logo_en_constancias = coalesce(p_logo_on, false),
                      nombre_en_constancias = coalesce(p_nombre_on, false),
                      nombre_constancia = nullif(left(trim(coalesce(p_nombre, '')), 120), '')
   where id = p_empresa;
  return empresa_constancias_ver(p_empresa);
end; $$;
revoke all on function empresa_constancias_guardar(uuid, text, boolean, boolean, text) from public, anon;
grant execute on function empresa_constancias_guardar(uuid, text, boolean, boolean, text) to authenticated;

-- 4. Al emitirse la constancia, el servidor copia el logo y el nombre de la empresa ---
create or replace function constancia_marca_empresa() returns trigger
language plpgsql security definer set search_path = public as $$
declare e empresas%rowtype;
begin
  -- Nunca se acepta lo que mande el navegador.
  new.empresa_id := null; new.empresa_logo := null; new.empresa_nombre := null;
  if new.usuario_id is null then return new; end if;
  select em.* into e
    from empresas_plan_lugares l
    join empresas_planes p on p.id = l.plan_id
    join empresas em on em.id = l.empresa_id
   where l.usuario_id = new.usuario_id and l.activo
     and p.estado in ('activo','cancelado') and p.vigente_hasta >= now()
   order by l.asignado_en desc
   limit 1;
  if e.id is null then return new; end if;
  if e.logo_en_constancias and e.logo_img is not null then new.empresa_logo := e.logo_img; end if;
  if e.nombre_en_constancias then new.empresa_nombre := coalesce(nullif(trim(e.nombre_constancia), ''), e.nombre); end if;
  if new.empresa_logo is not null or new.empresa_nombre is not null then new.empresa_id := e.id; end if;
  return new;
end; $$;
drop trigger if exists constancia_marca on constancias;
create trigger constancia_marca before insert on constancias
  for each row execute function constancia_marca_empresa();

-- Una constancia emitida no cambia su marca después (solo administración podría corregirla).
create or replace function constancia_marca_fija() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then
    new.empresa_id := old.empresa_id; new.empresa_logo := old.empresa_logo; new.empresa_nombre := old.empresa_nombre;
  end if;
  return new;
end; $$;
drop trigger if exists constancia_marca_fija on constancias;
create trigger constancia_marca_fija before update on constancias
  for each row execute function constancia_marca_fija();

notify pgrst, 'reload schema';
select 'ok' as resultado,
       (select count(*) from information_schema.columns where table_name = 'empresas' and column_name in ('logo_img','logo_en_constancias','nombre_en_constancias','nombre_constancia')) as columnas_empresas,
       (select count(*) from information_schema.columns where table_name = 'constancias' and column_name in ('empresa_id','empresa_logo','empresa_nombre')) as columnas_constancias;
