-- ============================================================================
-- Instituto Mara — Las constancias emitidas son permanentes (19 oct 2026)
-- Se puede correr más de una vez.
--
-- Pedido de Héctor: las constancias son el argumento de venta; deben estar siempre
-- activas y, si una persona vuelve a registrarse, debe volver a verlas.
--
-- Antes: al borrar la cuenta de un alumno (o un curso) sus constancias se borraban en
-- cascada, y su folio/QR dejaba de verificarse.
-- Ahora:
--   · Borrar una cuenta NO borra sus constancias: quedan sin cuenta ligada, con nombre,
--     programa, horas, fecha, folio y el correo con que se emitieron. Se siguen
--     verificando por folio o QR.
--   · Si esa persona se vuelve a registrar con el mismo correo, sus constancias se ligan
--     solas a su cuenta nueva.
--   · Borrar o renombrar un curso tampoco borra constancias (guardan su nombre y horas).
--   · Si la persona cambia su correo, la constancia guarda el nuevo.
-- ============================================================================

alter table constancias add column if not exists correo text;
update constancias k set correo = lower(p.correo) from perfiles p where p.id = k.usuario_id and k.correo is null;

-- Las llaves hacia perfiles y cursos pasan de «borrar en cascada» a «dejar sin liga».
do $$
declare r record;
begin
  for r in select c.conname from pg_constraint c
           where c.conrelid = 'public.constancias'::regclass and c.contype = 'f'
             and c.confrelid in ('public.perfiles'::regclass, 'public.cursos'::regclass)
  loop
    execute format('alter table constancias drop constraint %I', r.conname);
  end loop;
end $$;
alter table constancias alter column usuario_id drop not null;
alter table constancias alter column curso_id drop not null;
alter table constancias add constraint constancias_usuario_id_fkey foreign key (usuario_id) references perfiles(id) on delete set null;
alter table constancias add constraint constancias_curso_id_fkey foreign key (curso_id) references cursos(id) on delete set null on update cascade;
create index if not exists constancias_correo on constancias (lower(correo)) where usuario_id is null;

-- Al emitirse, la constancia guarda el correo de la persona.
create or replace function constancia_guardar_correo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.correo is null and new.usuario_id is not null then
    select lower(correo) into new.correo from perfiles where id = new.usuario_id;
  end if;
  return new;
end; $$;
drop trigger if exists constancia_correo on constancias;
create trigger constancia_correo before insert on constancias
  for each row execute function constancia_guardar_correo();

-- Al registrarse alguien, recupera las constancias emitidas a su correo.
create or replace function constancias_religar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.correo is not null then
    update constancias set usuario_id = new.id
     where usuario_id is null and lower(correo) = lower(new.correo);
  end if;
  return new;
end; $$;
drop trigger if exists perfil_religar_constancias on perfiles;
create trigger perfil_religar_constancias after insert on perfiles
  for each row execute function constancias_religar();

-- Si la persona cambia su correo, la constancia guarda el nuevo (y recupera las que hubiera a ese correo).
create or replace function constancias_correo_nuevo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.correo is distinct from old.correo and new.correo is not null then
    update constancias set correo = lower(new.correo) where usuario_id = new.id;
    update constancias set usuario_id = new.id where usuario_id is null and lower(correo) = lower(new.correo);
  end if;
  return new;
end; $$;
drop trigger if exists perfil_correo_constancias on perfiles;
create trigger perfil_correo_constancias after update of correo on perfiles
  for each row execute function constancias_correo_nuevo();

notify pgrst, 'reload schema';
select 'ok' as resultado, (select count(*) from constancias) as constancias, (select count(*) from constancias where correo is null) as sin_correo;
