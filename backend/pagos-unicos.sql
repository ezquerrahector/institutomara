-- ============================================================================
-- Instituto Mara — un pago de Mercado Pago se registra una sola vez
-- ----------------------------------------------------------------------------
-- Mercado Pago a veces manda dos avisos del mismo pago casi al mismo tiempo.
-- Antes, los dos podían registrarse y el ingreso aparecía duplicado. Esto:
--   1. Quita los duplicados que ya existan (deja el primero de cada pago).
--   2. Hace imposible volver a duplicar: la referencia de Mercado Pago queda
--      como única en la tabla.
--   3. Permite al administrador borrar o corregir movimientos desde el aula.
-- Se puede volver a ejecutar sin problema.
-- ============================================================================

-- 1. Quitar duplicados existentes (se conserva el registro más antiguo)
delete from pagos a
using pagos b
where a.referencia_mp is not null
  and a.referencia_mp = b.referencia_mp
  and (a.creado_en, a.id::text) > (b.creado_en, b.id::text);

-- 2. Una referencia de Mercado Pago = un solo pago
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pagos_referencia_mp_unica') then
    alter table pagos add constraint pagos_referencia_mp_unica unique (referencia_mp);
  end if;
end $$;

-- 3. El administrador puede corregir o borrar movimientos
drop policy if exists "pagos admin actualiza" on pagos;
drop policy if exists "pagos admin borra" on pagos;
create policy "pagos admin actualiza" on pagos for update using (es_admin());
create policy "pagos admin borra" on pagos for delete using (es_admin());
