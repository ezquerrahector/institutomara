-- Prospectos: la plataforma asigna el N° definitivo al importar (10 nov 2026).
-- Si un renglón llega sin N°, o con un N° que ya existe, recibe el siguiente consecutivo.
create sequence if not exists public.prospectos_num_seq;
select setval('public.prospectos_num_seq', greatest(coalesce((select max(num_origen) from public.prospectos), 0), 1));

create or replace function public.prospecto_num_auto()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.num_origen is null or exists (select 1 from prospectos where num_origen = new.num_origen) then
    loop
      new.num_origen := nextval('prospectos_num_seq');
      exit when not exists (select 1 from prospectos where num_origen = new.num_origen);
    end loop;
  elsif new.num_origen > (select last_value from prospectos_num_seq) then
    perform setval('prospectos_num_seq', new.num_origen);
  end if;
  return new;
end $$;

drop trigger if exists prospecto_num_auto on public.prospectos;
create trigger prospecto_num_auto before insert on public.prospectos
  for each row execute function public.prospecto_num_auto();
