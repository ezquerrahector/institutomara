-- ============================================================================
-- Instituto Mara — ajustes globales, membresías, regalos y descuento de recompra
-- Ejecutar en Supabase → SQL Editor. Se puede repetir sin problema.
-- ============================================================================

-- ---------- Ajustes globales (una sola fila) ----------
-- Los lee cualquiera (la constancia y los precios de membresía se ven sin sesión);
-- solo el administrador los cambia.
create table if not exists ajustes (
  id boolean primary key default true check (id),
  director_nombre text not null default '',
  director_puesto text not null default 'Dirección Académica',
  firma_img text,                                   -- imagen PNG en data URL (máx. ~300 KB)
  precio_esencial numeric not null default 249,     -- membresía mensual: cursos (sin diplomados)
  precio_total numeric not null default 449,        -- membresía mensual: todo incluido
  precio_anual numeric not null default 3990,       -- membresía anual: todo incluido
  dias_constancia_diplomado int not null default 60,-- días de membresía para emitir constancia de diplomado
  recompra_pct numeric not null default 40,
  recompra_dias int not null default 15,
  recompra_recordatorio_dia int not null default 10,
  actualizado_en timestamptz not null default now()
);
insert into ajustes (id) values (true) on conflict (id) do nothing;
alter table ajustes enable row level security;
drop policy if exists "ajustes lectura" on ajustes;
drop policy if exists "ajustes admin" on ajustes;
create policy "ajustes lectura" on ajustes for select using (true);
create policy "ajustes admin" on ajustes for update using (es_admin()) with check (es_admin());
grant select on ajustes to anon, authenticated;
grant update on ajustes to authenticated;

-- ---------- Membresías ----------
create table if not exists membresias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfiles(id) on delete cascade,
  plan text not null check (plan in ('esencial','total','anual')),
  estado text not null default 'pendiente' check (estado in ('pendiente','activa','cancelada','vencida')),
  mp_preapproval_id text unique,
  monto numeric,
  inicio timestamptz,
  vigente_hasta timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists membresias_usuario on membresias(usuario_id);
alter table membresias enable row level security;
drop policy if exists "membresia propia" on membresias;
create policy "membresia propia" on membresias for select using (usuario_id = auth.uid() or es_admin());
grant select on membresias to authenticated;

-- ---------- Regalos ----------
create table if not exists regalos (
  id uuid primary key default gen_random_uuid(),
  comprador_id uuid not null references perfiles(id) on delete cascade,
  curso_id text not null references cursos(id) on delete cascade,
  para_nombre text not null,
  para_correo text,
  para_tel text,
  mensaje text,
  de_nombre text,
  entregar_en date not null default current_date,
  monto numeric,
  codigo text unique,
  estado text not null default 'pendiente_pago'
    check (estado in ('pendiente_pago','pagado','enviado','canjeado','cancelado')),
  mp_pago_id text,
  enviado_en timestamptz,
  creado_en timestamptz not null default now()
);
create index if not exists regalos_comprador on regalos(comprador_id);
alter table regalos enable row level security;
drop policy if exists "regalo propio" on regalos;
create policy "regalo propio" on regalos for select using (comprador_id = auth.uid() or es_admin());
grant select on regalos to authenticated;

-- Al canjear el cupón de un regalo, el regalo queda como canjeado.
create or replace function marcar_regalo_canjeado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.usos > old.usos and new.codigo like 'REGALO-%' then
    update regalos set estado = 'canjeado' where codigo = new.codigo and estado <> 'canjeado';
  end if;
  return new;
end; $$;
drop trigger if exists regalo_canjeado on cupones;
create trigger regalo_canjeado after update of usos on cupones
  for each row execute function marcar_regalo_canjeado();

-- ---------- Descuento de recompra (al terminar un programa) ----------
create table if not exists recompras (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfiles(id) on delete cascade,
  curso_id text not null,
  codigo text not null unique,
  enviado_en timestamptz,
  recordado_en timestamptz,
  creado_en timestamptz not null default now(),
  unique (usuario_id, curso_id)
);
alter table recompras enable row level security;
drop policy if exists "recompra propia" on recompras;
create policy "recompra propia" on recompras for select using (usuario_id = auth.uid() or es_admin());
grant select on recompras to authenticated;


-- ---------- Qué cubre una membresía ----------
-- Esencial: cursos (no diplomados ni rutas). Total y Anual: todo.
create or replace function membresia_cubre(p_usuario uuid, p_curso text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membresias m
    where m.usuario_id = p_usuario and m.estado in ('activa','cancelada')
      and m.vigente_hasta >= now()
      and (m.plan in ('total','anual')
           or (m.plan = 'esencial' and p_curso not like 'r-%'
               and coalesce((select c.nivel from cursos c where c.id = p_curso), '') <> 'Diplomados'))
  );
$$;
grant execute on function membresia_cubre(uuid, text) to authenticated;

-- Constancia de un programa tomado con membresía: los diplomados piden una
-- antigüedad mínima de membresía (ajustes.dias_constancia_diplomado).
create or replace function membresia_permite_constancia(p_usuario uuid, p_curso text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select c.nivel from cursos c where c.id = p_curso), '') <> 'Diplomados'
      or exists (select 1 from membresias m where m.usuario_id = p_usuario and m.inicio is not null
                 and m.inicio <= now() - make_interval(days => (select dias_constancia_diplomado from ajustes limit 1)));
$$;
grant execute on function membresia_permite_constancia(uuid, text) to authenticated;

drop policy if exists "constancias propias crea" on constancias;
create policy "constancias propias crea" on constancias for insert with check (
  es_admin()
  or (
    usuario_id = auth.uid()
    and exists (select 1 from inscripciones i where i.usuario_id = auth.uid() and i.curso_id = constancias.curso_id
                and (i.estatus <> 'membresia' or membresia_permite_constancia(auth.uid(), constancias.curso_id)))
  )
);

-- ---------- Tarea diaria: entregar regalos programados y recordar descuentos ----------
-- Usa el mismo secreto de la bóveda que ya usa la tarea de invitaciones (mara_service_role).
select cron.unschedule('mara-tienda') where exists (select 1 from cron.job where jobname = 'mara-tienda');
select cron.schedule('mara-tienda', '0 15 * * *', $$
  select net.http_post(
    url := 'https://xvihjhfvwjgpesxpdtnl.supabase.co/functions/v1/tienda',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name='mara_service_role')),
    body := '{"accion":"diaria"}'::jsonb)
$$);

select 'ok' as resultado;
