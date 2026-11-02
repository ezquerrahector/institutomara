-- ============================================================================
-- Instituto Mara — cupón en el regalo abierto (2 nov 2026)
-- ----------------------------------------------------------------------------
-- El regalo abierto («Otra cantidad» / «que elija quien lo recibe») no tiene curso,
-- así que el cupón se calcula sobre el monto del regalo.
--   · Aplican los cupones generales (sin curso ni lista de programas) y los de embajador.
--   · No aplican: códigos de regalo o saldo, lugares de empresa (EMP-) ni pilotos.
--   · Si el cupón deja el regalo en $0, el monto no puede pasar del programa más caro
--     del catálogo (un cupón del 100 % regala un programa, no saldo ilimitado).
-- Se puede volver a ejecutar sin problema.
-- ============================================================================

create or replace function aplicar_cupon_monto(p_codigo text, p_monto numeric)
returns table (valido boolean, motivo text, precio_original numeric, descuento numeric, precio_final numeric)
language plpgsql security definer set search_path = public
as $$
declare
  c cupones%rowtype;
  p numeric := round(coalesce(p_monto, 0), 2);
  d numeric;
  tope numeric;
begin
  if p <= 0 then
    return query select false, 'Elige primero el monto del regalo.', 0::numeric, 0::numeric, 0::numeric; return;
  end if;
  select * into c from cupones where upper(codigo) = upper(btrim(p_codigo));
  if not found or not c.activo then
    return query select false, 'Ese cupón no existe o ya no está activo.', p, 0::numeric, p; return;
  end if;
  if c.codigo like 'REGALO-%' or c.codigo like 'SALDO-%' then
    return query select false, 'Ese código es de un regalo que alguien recibió; no sirve para comprar otro.', p, 0::numeric, p; return;
  end if;
  if c.codigo like 'EMP-%' then
    return query select false, 'Ese código es un lugar de empresa; no sirve para regalar.', p, 0::numeric, p; return;
  end if;
  if coalesce(c.piloto, false) then
    return query select false, 'Ese código es de una prueba para empresas; no sirve para regalar.', p, 0::numeric, p; return;
  end if;
  if c.vence is not null and c.vence < current_date then
    return query select false, 'Ese cupón ya venció.', p, 0::numeric, p; return;
  end if;
  if c.usos_max is not null and c.usos >= c.usos_max then
    return query select false, 'Ese cupón ya llegó a su límite de usos.', p, 0::numeric, p; return;
  end if;
  if c.curso_id is not null or (c.cursos is not null and array_length(c.cursos, 1) > 0) then
    return query select false, 'Ese cupón es para un programa en específico: elige «Un programa en específico» para usarlo.', p, 0::numeric, p; return;
  end if;
  d := case when c.tipo = 'porcentaje' then round(p * least(c.valor, 100) / 100, 2) else least(c.valor, p) end;
  if p - d <= 0 then
    select max(precio) into tope from cursos where publicado and id not like 'r-%';
    if tope is not null and p > tope then
      return query select false, 'Con este cupón el regalo puede ser de hasta $' || to_char(tope, 'FM999,999') || '.', p, 0::numeric, p; return;
    end if;
  end if;
  return query select true, coalesce(c.descripcion, 'Cupón aplicado'), p, d, round(p - d, 2);
end; $$;

revoke all on function aplicar_cupon_monto(text, numeric) from public, anon, authenticated;

-- Cuenta el uso del cupón de un regalo abierto ya pagado y registra la venta del embajador.
-- No inscribe a nadie (lo llama el servidor al confirmarse el pago).
create or replace function canjear_cupon_monto(p_codigo text, p_monto numeric, p_usuario uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v record;
begin
  select * into v from aplicar_cupon_monto(p_codigo, p_monto);
  if not v.valido then
    return jsonb_build_object('ok', false, 'motivo', v.motivo);
  end if;
  update cupones set usos = usos + 1 where upper(codigo) = upper(btrim(p_codigo));
  perform registrar_venta_embajador(p_codigo, null, p_usuario, v.precio_final);
  return jsonb_build_object('ok', true, 'precio_final', v.precio_final, 'descuento', v.descuento);
end; $$;

revoke all on function canjear_cupon_monto(text, numeric, uuid) from public, anon, authenticated;
