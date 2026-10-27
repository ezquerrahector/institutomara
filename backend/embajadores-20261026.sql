-- ============================================================================
-- Instituto Mara — programa de embajadores y cupón en regalos (26 oct 2026)
-- ----------------------------------------------------------------------------
-- Embajador: cualquier persona se registra gratis en el sitio y recibe un código.
--   · Quien compra con ese código tiene un descuento (ajustes.embajador_descuento_pct, 10 %).
--   · El embajador gana una comisión (ajustes.embajador_comision_pct, 20 %) sobre lo
--     pagado sin IVA, en cursos, diplomados y regalos pagados (no en compras propias).
--   · La comisión queda disponible a los ajustes.embajador_dias_espera (15) días por la
--     garantía de 7 días; se paga por transferencia al juntar ajustes.embajador_minimo ($300).
-- La venta se registra sola en canjear_cupon (la llama el webhook al aprobarse el pago,
-- y la función «tienda» al pagarse un regalo con cupón). Se puede volver a ejecutar.
-- ============================================================================

alter table ajustes add column if not exists embajador_comision_pct numeric not null default 20;
alter table ajustes add column if not exists embajador_descuento_pct numeric not null default 10;
alter table ajustes add column if not exists embajador_dias_espera int not null default 15;
alter table ajustes add column if not exists embajador_minimo numeric not null default 300;

-- Regalo con cupón
alter table regalos add column if not exists cupon text;
alter table regalos add column if not exists descuento numeric;

create table if not exists embajadores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  correo text not null,
  telefono text,
  pais text,
  ciudad text,
  como_promueve text,
  codigo text not null unique,
  token uuid not null unique default gen_random_uuid(),
  estado text not null default 'activo' check (estado in ('activo','pausado','baja')),
  titular text, banco text, clabe text,
  notas text,
  creado_en timestamptz not null default now()
);
create unique index if not exists embajadores_correo on embajadores(lower(correo));

create table if not exists embajador_ventas (
  id uuid primary key default gen_random_uuid(),
  embajador_id uuid not null references embajadores(id) on delete cascade,
  cupon text not null,
  curso_id text,
  usuario_id uuid,
  tipo text not null default 'curso' check (tipo in ('curso','regalo')),
  precio_pagado numeric not null,
  base numeric not null,
  pct numeric not null,
  comision numeric not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','pagada','cancelada')),
  disponible_en date not null,
  pago_id uuid,
  creado_en timestamptz not null default now()
);
create index if not exists embajador_ventas_emb on embajador_ventas(embajador_id, estado);

create table if not exists embajador_pagos (
  id uuid primary key default gen_random_uuid(),
  embajador_id uuid not null references embajadores(id) on delete cascade,
  monto numeric not null check (monto > 0),
  referencia text,
  nota text,
  pagado_en timestamptz not null default now()
);

alter table embajadores enable row level security;
alter table embajador_ventas enable row level security;
alter table embajador_pagos enable row level security;
drop policy if exists "embajadores admin" on embajadores;
drop policy if exists "embajador_ventas admin" on embajador_ventas;
drop policy if exists "embajador_pagos admin" on embajador_pagos;
create policy "embajadores admin" on embajadores for all using (es_admin()) with check (es_admin());
create policy "embajador_ventas admin" on embajador_ventas for all using (es_admin()) with check (es_admin());
create policy "embajador_pagos admin" on embajador_pagos for all using (es_admin()) with check (es_admin());
grant select, insert, update, delete on embajadores, embajador_ventas, embajador_pagos to authenticated;

-- Registrar la venta de un embajador (si el cupón es suyo). La llama canjear_cupon.
create or replace function registrar_venta_embajador(p_codigo text, p_curso_id text, p_usuario uuid, p_precio numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  e embajadores%rowtype;
  a ajustes%rowtype;
  correo_comprador text;
  b numeric;
begin
  if p_precio is null or p_precio <= 0 then return; end if;
  select * into e from embajadores where codigo = upper(btrim(p_codigo)) and estado = 'activo';
  if not found then return; end if;
  if p_usuario is not null then
    select correo into correo_comprador from perfiles where id = p_usuario;
    if lower(coalesce(correo_comprador, '')) = lower(e.correo) then return; end if;  -- compra propia: sin comisión
  end if;
  select * into a from ajustes where id;
  b := round(p_precio / 1.16, 2);
  insert into embajador_ventas (embajador_id, cupon, curso_id, usuario_id, tipo, precio_pagado, base, pct, comision, disponible_en)
  values (e.id, e.codigo, p_curso_id, p_usuario, case when p_usuario is null then 'regalo' else 'curso' end,
          p_precio, b, a.embajador_comision_pct, round(b * a.embajador_comision_pct / 100, 2),
          current_date + a.embajador_dias_espera);
end; $$;
revoke all on function registrar_venta_embajador(text, text, uuid, numeric) from public;

-- canjear_cupon: igual que la versión en producción (con pilotos) + registro de venta de embajador.
create or replace function public.canjear_cupon(p_codigo text, p_curso_id text, p_usuario uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v record;
  c cupones%rowtype;
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
  else
    perform registrar_venta_embajador(p_codigo, p_curso_id, p_usuario, v.precio_final);
  end if;
  return jsonb_build_object('ok', true, 'precio_final', v.precio_final,
                            'descuento', v.descuento, 'gratis', v.precio_final <= 0, 'piloto', c.piloto);
end; $function$;
