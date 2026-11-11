-- Prospectos: campo Ciudad (10 nov 2026).
-- Se llena solo desde la dirección cuando no viene (carga CSV, tarea diaria, captura manual).
alter table public.prospectos add column if not exists ciudad text;

create or replace function public.prospecto_ciudad_de(p_dir text)
returns text language sql immutable set search_path = public as $$
  select case
    when p_dir is null or btrim(p_dir) = '' then null
    -- León primero: hay colonias de León con nombre de otra ciudad (p. ej. Futurama Monterrey)
    when p_dir ~* '\mle[oó]n\M' then 'León'
    when p_dir ~* '\msilao\M' then 'Silao'
    when p_dir ~* '\mirapuato\M' then 'Irapuato'
    when p_dir ~* '\mcelaya\M' then 'Celaya'
    when p_dir ~* '\msalamanca\M' then 'Salamanca'
    when p_dir ~* 'san francisco del rinc[oó]n' then 'San Francisco del Rincón'
    when p_dir ~* 'purísima|purisima del rinc' then 'Purísima del Rincón'
    when p_dir ~* 'guanajuato, gto|guanajuato capital' and p_dir !~* 'le[oó]n' then 'Guanajuato'
    when p_dir ~* 'quer[eé]taro|qro\.' then 'Querétaro'
    when p_dir ~* 'aguascalientes|ags\.' then 'Aguascalientes'
    when p_dir ~* 'guadalajara|zapopan|tlaquepaque|jal\.' then 'Guadalajara'
    when p_dir ~* 'monterrey|san pedro garza|n\.l\.' then 'Monterrey'
    when p_dir ~* 'san luis potos|s\.l\.p\.' then 'San Luis Potosí'
    else null end;
$$;

create or replace function public.prospecto_ciudad_auto()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.ciudad is null or btrim(new.ciudad) = '' then
    new.ciudad := coalesce(prospecto_ciudad_de(new.direccion), 'León');
  else
    new.ciudad := btrim(new.ciudad);
  end if;
  return new;
end $$;

drop trigger if exists prospecto_ciudad_auto on public.prospectos;
create trigger prospecto_ciudad_auto before insert or update of ciudad, direccion on public.prospectos
  for each row execute function public.prospecto_ciudad_auto();

update public.prospectos set ciudad = coalesce(prospecto_ciudad_de(direccion), 'León');
create index if not exists prospectos_ciudad_idx on public.prospectos (ciudad);
