-- ============================================================================
-- Instituto Mara — cupones de descuento
-- ----------------------------------------------------------------------------
-- Ejecuta este archivo en Supabase → SQL Editor → Run, después de nube.sql.
-- Permite crear códigos de descuento (por porcentaje o por monto fijo), incluso
-- del 100% para regalar un curso completo (becas, promociones, cortesías).
--
-- Reglas importantes:
--   · El descuento SIEMPRE se calcula en el servidor. El navegador solo muestra
--     el resultado; si alguien manipula la página, el cobro no cambia.
--   · Los cupones solo los ve y los edita el administrador. El alumno nunca
--     puede listar los códigos: solo puede probar uno a la vez.
-- Se puede volver a ejecutar sin problema.
-- ============================================================================

create table if not exists cupones (
  codigo text primary key,
  descripcion text,
  tipo text not null check (tipo in ('porcentaje','monto')),
  valor numeric not null check (valor > 0),
  curso_id text references cursos(id) on delete cascade,   -- null = cualquier curso
  usos_max int,                                            -- null = ilimitado
  usos int not null default 0,
  vence date,                                              -- null = sin vencimiento
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

alter table cupones enable row level security;

drop policy if exists "cupones admin lee" on cupones;
drop policy if exists "cupones admin crea" on cupones;
drop policy if exists "cupones admin actualiza" on cupones;
drop policy if exists "cupones admin borra" on cupones;

create policy "cupones admin lee" on cupones for select using (es_admin());
create policy "cupones admin crea" on cupones for insert with check (es_admin());
create policy "cupones admin actualiza" on cupones for update using (es_admin());
create policy "cupones admin borra" on cupones for delete using (es_admin());

-- ---------------------------------------------------------------------------
-- Validar un cupón (lo llama el alumno desde el aula)
-- ---------------------------------------------------------------------------
-- Regresa si el cupón sirve y cuánto quedaría a pagar. No expone la lista de
-- cupones: hay que saber el código exacto.
create or replace function aplicar_cupon(p_codigo text, p_curso_id text)
returns table (valido boolean, motivo text, precio_original numeric,
               descuento numeric, precio_final numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  c cupones%rowtype;
  p numeric;
  d numeric;
begin
  select precio into p from cursos where id = p_curso_id and publicado;
  if p is null then
    return query select false, 'Ese curso no está disponible.', 0::numeric, 0::numeric, 0::numeric;
    return;
  end if;

  select * into c from cupones where upper(codigo) = upper(btrim(p_codigo));
  if not found or not c.activo then
    return query select false, 'Ese cupón no existe o ya no está activo.', p, 0::numeric, p;
    return;
  end if;
  if c.vence is not null and c.vence < current_date then
    return query select false, 'Ese cupón ya venció.', p, 0::numeric, p;
    return;
  end if;
  if c.usos_max is not null and c.usos >= c.usos_max then
    return query select false, 'Ese cupón ya llegó a su límite de usos.', p, 0::numeric, p;
    return;
  end if;
  if c.curso_id is not null and c.curso_id <> p_curso_id then
    return query select false, 'Ese cupón no aplica a este curso.', p, 0::numeric, p;
    return;
  end if;

  d := case when c.tipo = 'porcentaje'
            then round(p * least(c.valor, 100) / 100, 2)
            else least(c.valor, p) end;

  return query select true, coalesce(c.descripcion, 'Cupón aplicado'), p, d, round(p - d, 2);
end;
$$;

revoke all on function aplicar_cupon(text, text) from public;
grant execute on function aplicar_cupon(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Canjear un cupón (lo llama el servidor, nunca el navegador)
-- ---------------------------------------------------------------------------
-- Suma un uso y, cuando el descuento cubre el curso completo, inscribe al
-- alumno y deja registrado el movimiento en pagos con monto 0.
create or replace function canjear_cupon(p_codigo text, p_curso_id text, p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  select * into v from aplicar_cupon(p_codigo, p_curso_id);
  if not v.valido then
    return jsonb_build_object('ok', false, 'motivo', v.motivo);
  end if;

  update cupones set usos = usos + 1 where upper(codigo) = upper(btrim(p_codigo));

  if v.precio_final <= 0 then
    insert into inscripciones (usuario_id, curso_id, estatus)
    values (p_usuario, p_curso_id, 'activa')
    on conflict (usuario_id, curso_id) do nothing;

    insert into pagos (usuario_id, curso_id, monto, medio, nota)
    values (p_usuario, p_curso_id, 0, 'Cupón',
            'Acceso otorgado con el cupón ' || upper(btrim(p_codigo)));
  end if;

  return jsonb_build_object('ok', true, 'precio_final', v.precio_final,
                            'descuento', v.descuento, 'gratis', v.precio_final <= 0);
end;
$$;

revoke all on function canjear_cupon(text, text, uuid) from public;
-- Solo el servidor (llave de servicio) la ejecuta; por eso no se otorga a nadie más.

-- ---------------------------------------------------------------------------
-- Ejemplos (descomenta y ajusta si quieres crearlos desde aquí; también se
-- pueden crear desde Administración → Cupones en el aula):
--
--   insert into cupones (codigo, descripcion, tipo, valor, usos_max, vence)
--   values ('BIENVENIDA20', '20% de descuento de bienvenida', 'porcentaje', 20, 100, '2026-12-31');
--
--   insert into cupones (codigo, descripcion, tipo, valor, curso_id, usos_max)
--   values ('BECAINGLES', 'Beca completa de Inglés A1', 'porcentaje', 100, 'c-ingles', 5);
-- ---------------------------------------------------------------------------
