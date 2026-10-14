-- ============================================================================
-- Instituto Mara — Prospectos: Instagram como canal de contacto (13 oct 2026).
-- Se puede correr más de una vez.
-- ============================================================================
do $$
declare r record;
begin
  -- Quita la regla anterior de «canal», tenga el nombre que tenga.
  for r in select conname from pg_constraint
            where conrelid = 'prospecto_contactos'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%canal%'
  loop
    execute format('alter table prospecto_contactos drop constraint %I', r.conname);
  end loop;
end $$;
alter table prospecto_contactos add constraint prospecto_contactos_canal_check
  check (canal in ('correo','whatsapp','llamada','instagram','visita','otro'));
select 'ok' as resultado;
