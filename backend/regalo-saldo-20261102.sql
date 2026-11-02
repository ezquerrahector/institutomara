-- Instituto Mara — regalos con valor en pesos (2 nov 2026).
-- 1) Un regalo puede ser «abierto» (un monto para el programa que elija quien lo recibe): curso_id opcional.
-- 2) valor = lo que vale el regalo (precio de lista del programa al regalarlo, o el monto abierto).
-- 3) Los códigos REGALO-… nuevos son cupones de monto fijo sin curso: sirven para cualquier curso o diplomado
--    (las rutas quedan fuera por la regla de aplicar_cupon). Si el programa elegido cuesta más, se paga la
--    diferencia; si cuesta menos, canjear_cupon crea un código SALDO-… por lo que sobra (mismo vencimiento).
alter table regalos alter column curso_id drop not null;
alter table regalos add column if not exists valor numeric;
alter table regalos add column if not exists abierto boolean not null default false;

create or replace function public.canjear_cupon(p_codigo text, p_curso_id text, p_usuario uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v record;
  c cupones%rowtype;
  v_saldo text;
  v_resto numeric;
begin
  select * into v from aplicar_cupon(p_codigo, p_curso_id);
  if not v.valido then
    return jsonb_build_object('ok', false, 'motivo', v.motivo);
  end if;
  select * into c from cupones where upper(codigo) = upper(btrim(p_codigo));
  update cupones set usos = usos + 1 where upper(codigo) = upper(btrim(p_codigo));

  if v.precio_final <= 0 then
    if c.piloto then
      insert into inscripciones (usuario_id, curso_id, estatus, vence)
      values (p_usuario, p_curso_id, 'piloto', current_date + coalesce(c.dias_acceso, 15))
      on conflict (usuario_id, curso_id) do nothing;
    else
      insert into inscripciones (usuario_id, curso_id, estatus)
      values (p_usuario, p_curso_id, 'activa')
      on conflict (usuario_id, curso_id) do nothing;
    end if;
    insert into pagos (usuario_id, curso_id, monto, medio, nota)
    values (p_usuario, p_curso_id, 0, 'Cupón',
            'Acceso otorgado con el cupón ' || upper(btrim(p_codigo)) || case when c.piloto then ' (piloto)' else '' end);
    -- Regalo o saldo de monto fijo que vale más que el programa elegido: lo que sobra queda como saldo.
    v_resto := round(coalesce(c.valor, 0) - v.precio_original, 2);
    if c.tipo = 'monto' and (c.codigo like 'REGALO-%' or c.codigo like 'SALDO-%') and v_resto >= 1 then
      v_saldo := 'SALDO-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 7));
      insert into cupones (codigo, descripcion, tipo, valor, usos_max, vence)
      values (v_saldo, 'Saldo de regalo (' || c.codigo || ')', 'monto', v_resto, 1, coalesce(c.vence, current_date + 365));
    end if;
  else
    perform registrar_venta_embajador(p_codigo, p_curso_id, p_usuario, v.precio_final);
  end if;
  return jsonb_build_object('ok', true, 'precio_final', v.precio_final,
                            'descuento', v.descuento, 'gratis', v.precio_final <= 0, 'piloto', c.piloto,
                            'saldo', v_saldo, 'saldo_monto', case when v_saldo is null then null else v_resto end, 'saldo_vence', case when v_saldo is null then null else coalesce(c.vence, current_date + 365) end);
end; $function$;
