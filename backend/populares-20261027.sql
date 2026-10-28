-- Instituto Mara — popularidad pública (27 oct 2026). Ya aplicado en Supabase.
-- Solo conteos de inscripciones por área y por programa; ordena áreas y sugerencias del sitio.
create or replace function populares()
returns table (tipo text, clave text, n bigint)
language sql security definer set search_path = public stable as $$
  select 'area', c.area, count(i.*) from cursos c left join inscripciones i on i.curso_id = c.id
   where c.publicado and c.id not like 'r-%' and c.area is not null group by c.area
  union all
  select 'curso', c.id, count(i.*) from cursos c join inscripciones i on i.curso_id = c.id
   where c.publicado and c.id not like 'r-%' group by c.id
$$;
revoke all on function populares() from public;
grant execute on function populares() to anon, authenticated;
