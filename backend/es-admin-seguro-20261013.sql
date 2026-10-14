-- Instituto Mara — corrección del 13 oct 2026.
-- Síntoma: el aula respondía «stack depth limit exceeded» en perfiles, empresas,
-- cupones, prospectos… La función es_admin() leía perfiles pasando por su
-- política, que a su vez llama a es_admin(): un ciclo sin fin.
-- Con SECURITY DEFINER (dueño postgres, que se salta RLS) ya no se cicla.
-- Se puede correr más de una vez. Ejecutado en producción el 13/10/2026.
create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin');
$$;
grant execute on function es_admin() to authenticated, anon;
