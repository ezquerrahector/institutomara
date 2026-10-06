-- ============================================================================
-- Instituto Mara — paquetes para empresas (5 a 50 lugares) y reseñas con estrellas
-- Ejecutar en Supabase → SQL Editor después de tienda.sql. Se puede repetir.
-- ============================================================================

-- ---------- Descuentos por volumen (editables en Ajustes) ----------
alter table ajustes add column if not exists emp_pct_5  numeric not null default 15;  -- 5 a 9 lugares
alter table ajustes add column if not exists emp_pct_10 numeric not null default 25;  -- 10 a 24 lugares
alter table ajustes add column if not exists emp_pct_25 numeric not null default 35;  -- 25 a 50 lugares

-- ---------- Número de lecciones por programa (para la regla del 50 % de las reseñas) ----------
alter table cursos add column if not exists lecciones int;
update cursos c set lecciones = v.n from (values
('d-tanatologia',30),
('d-nom035',25),
('c-pap',12),
('c-excel-avanzado',23),
('c-ingles-a2',25),
('d-adulto-mayor',33),
('c-inteligencia-emocional',13),
('c-finanzas-personales',19),
('d-marketing-digital',25),
('d-contabilidad-resico',25),
('c-atencion-ventas',13),
('d-liderazgo',25),
('d-proyectos',25),
('d-recursos-humanos',25),
('c-power-bi',20),
('d-asistente-administrativo',25),
('c-comunicacion',15),
('c-ciberseguridad',15),
('d-seguridad-higiene',25),
('c-ingles-b1',25),
('c-venta-en-linea',18),
('c-canva',15),
('c-productividad',15),
('c-logistica',18),
('d-tcc',30),
('d-neurodiversidad',25),
('d-infancia-adolescencia',25),
('c-ansiedad-depresion',17),
('c-neurociencia',17),
('c-ingles-servicio',16),
('d-terapias-contextuales',30),
('d-evaluacion-clinica',25),
('c-ia-psicologos',15),
('c-fotografia-producto',13),
('c-ingles-b2',25),
('c-ingles-kids',25),
('c-frances-a1',25),
('c-portugues-a1',27),
('c-italiano-a1',25),
('c-aleman-a1',25),
('d-seduccion-atraccion',40),
('d-imagen-personal',40),
('d-psicologia-forense',40),
('d-lenguaje-corporal',40),
('d-psicologia-influencia',40),
('d-leer-personas',40),
('d-conversaciones-dificiles',40),
('d-confianza-seguridad',40),
('d-manipulacion',40),
('d-negociacion',40),
('d-storytelling',40),
('d-psicologia-social',40),
('d-detectar-mentiras',40),
('d-oratoria',40),
('d-psicologia-pareja',40),
('d-inteligencia-social',40),
('d-criminologia',40),
('diplomado-estoicismo-vida-moderna',30),
('c-ia',25),
('c-ia-oficina',14),
('c-ia-ventas',14),
('c-ia-emprendedores',14),
('c-ia-finanzas',14),
('c-ia-rh',14),
('c-ia-docentes',14),
('c-ia-salud',14),
('c-ia-manufactura',14),
('c-ia-marketing',14),
('c-ia-contadores',14),
('c-ia-directivos',14),
('c-ia-atencion-cliente',14),
('c-ia-proyectos',14),
('c-ia-abogados',14),
('c-ia-compras',14),
('c-ia-logistica',14),
('c-ia-ecommerce',14),
('c-ia-inmobiliarias',14),
('c-ia-arquitectura',14),
('c-ia-diseno',14),
('c-ia-programadores',14),
('c-ia-automatizacion',14),
('c-ia-freelance',14),
('c-ia-callcenter',14),
('c-ia-turismo',14),
('c-ia-estudiantes',14),
('c-ia-construccion',14),
('c-ia-campo',14),
('c-ingles',30),
('c-office',26),
('diplomado-persuasion-etica',50)
) as v(id, n) where c.id = v.id;

-- ---------- Compras de empresas ----------
create table if not exists empresas_compras (
  id uuid primary key default gen_random_uuid(),
  comprador_id uuid not null references perfiles(id) on delete cascade,
  empresa text not null,
  rfc text,
  contacto_nombre text,
  contacto_correo text,
  contacto_tel text,
  curso_id text not null references cursos(id) on delete restrict,
  lugares int not null check (lugares between 5 and 50),
  precio_unit numeric not null,
  pct numeric not null default 0,
  total numeric not null,
  estado text not null default 'pendiente_pago' check (estado in ('pendiente_pago','pagado','cancelado')),
  mp_pago_id text,
  pagado_en timestamptz,
  creado_en timestamptz not null default now()
);
create index if not exists empresas_compras_comprador on empresas_compras(comprador_id);
alter table empresas_compras enable row level security;
drop policy if exists "empresa compra propia" on empresas_compras;
create policy "empresa compra propia" on empresas_compras for select using (comprador_id = auth.uid() or es_admin());
grant select on empresas_compras to authenticated;

create table if not exists empresas_codigos (
  codigo text primary key,
  compra_id uuid not null references empresas_compras(id) on delete cascade,
  asignado_nombre text,
  asignado_correo text,
  enviado_en timestamptz,
  usuario_id uuid references perfiles(id) on delete set null,
  canjeado_en timestamptz
);
create index if not exists empresas_codigos_compra on empresas_codigos(compra_id);
alter table empresas_codigos enable row level security;
drop policy if exists "empresa codigos propios" on empresas_codigos;
create policy "empresa codigos propios" on empresas_codigos for select using (
  es_admin() or exists (select 1 from empresas_compras e where e.id = empresas_codigos.compra_id and e.comprador_id = auth.uid()));
grant select on empresas_codigos to authenticated;

-- Cuando alguien entra con un código de empresa, queda ligado a su lugar.
create or replace function ligar_codigo_empresa() returns trigger
language plpgsql security definer set search_path = public as $$
declare cod text;
begin
  if new.nota like 'Acceso otorgado con el cupón EMP-%' then
    cod := substring(new.nota from 'EMP-[A-Z0-9]+');
    update empresas_codigos set usuario_id = new.usuario_id, canjeado_en = now()
      where codigo = cod and usuario_id is null;
  end if;
  return new;
end; $$;
drop trigger if exists codigo_empresa_canjeado on pagos;
create trigger codigo_empresa_canjeado after insert on pagos
  for each row execute function ligar_codigo_empresa();

-- Avance del equipo: solo quien compró (o administración) lo ve.
create or replace function empresa_avance(p_compra uuid)
returns table (codigo text, asignado_nombre text, asignado_correo text, enviado_en timestamptz,
               alumno text, canjeado_en timestamptz, lecciones_vistas int, modulos_aprobados int,
               constancia_folio text, constancia_fecha date)
language sql stable security definer set search_path = public as $$
  select k.codigo, k.asignado_nombre, k.asignado_correo, k.enviado_en,
         p.nombre, k.canjeado_en,
         coalesce(array_length(a.lecciones_vistas, 1), 0),
         coalesce((select count(*)::int from jsonb_each_text(a.calificaciones_modulo) q where q.value::numeric >= 80), 0),
         c.folio, c.fecha
  from empresas_codigos k
  join empresas_compras e on e.id = k.compra_id
  left join perfiles p on p.id = k.usuario_id
  left join avances a on a.usuario_id = k.usuario_id and a.curso_id = e.curso_id
  left join constancias c on c.usuario_id = k.usuario_id and c.curso_id = e.curso_id
  where k.compra_id = p_compra and (e.comprador_id = auth.uid() or es_admin())
  order by k.codigo;
$$;
grant execute on function empresa_avance(uuid) to authenticated;

-- ---------- Reseñas con estrellas ----------
create table if not exists resenas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfiles(id) on delete cascade,
  curso_id text not null references cursos(id) on delete cascade,
  estrellas int not null check (estrellas between 1 and 5),
  comentario text check (char_length(comentario) <= 800),
  nombre_publico text,
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
  creado_en timestamptz not null default now(),
  moderado_en timestamptz,
  unique (usuario_id, curso_id)
);
create index if not exists resenas_curso on resenas(curso_id, estado);

-- Puede reseñar quien está inscrito y ya vio al menos la mitad de las lecciones.
create or replace function puede_resenar(p_usuario uuid, p_curso text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from inscripciones i where i.usuario_id = p_usuario and i.curso_id = p_curso)
     and coalesce((select array_length(a.lecciones_vistas, 1) from avances a where a.usuario_id = p_usuario and a.curso_id = p_curso), 0)
         >= ceil(coalesce((select c.lecciones from cursos c where c.id = p_curso), 10) * 0.5);
$$;
grant execute on function puede_resenar(uuid, text) to authenticated;

-- El nombre público («Ana G.») y el estado los pone el servidor, no el navegador.
create or replace function preparar_resena() returns trigger
language plpgsql security definer set search_path = public as $$
declare n text;
begin
  if not es_admin() then
    select nombre into n from perfiles where id = new.usuario_id;
    n := btrim(coalesce(n, ''));
    new.nombre_publico := case when n = '' then 'Alumno de Instituto Mara'
      else split_part(n, ' ', 1) || case when split_part(n, ' ', 2) <> '' then ' ' || left(split_part(n, ' ', 2), 1) || '.' else '' end end;
    new.estado := 'pendiente';
    new.moderado_en := null;
    new.comentario := nullif(btrim(coalesce(new.comentario, '')), '');
  else
    if tg_op = 'UPDATE' and new.estado is distinct from old.estado then new.moderado_en := now(); end if;
  end if;
  return new;
end; $$;
drop trigger if exists resena_preparar on resenas;
create trigger resena_preparar before insert or update on resenas
  for each row execute function preparar_resena();

alter table resenas enable row level security;
drop policy if exists "resenas publicas" on resenas;
drop policy if exists "resena propia crea" on resenas;
drop policy if exists "resena propia edita" on resenas;
drop policy if exists "resena admin" on resenas;
drop policy if exists "resena borra" on resenas;
create policy "resenas publicas" on resenas for select using (estado = 'aprobada' or usuario_id = auth.uid() or es_admin());
create policy "resena propia crea" on resenas for insert with check (usuario_id = auth.uid() and puede_resenar(auth.uid(), curso_id));
create policy "resena propia edita" on resenas for update using (usuario_id = auth.uid() or es_admin())
  with check (es_admin() or (usuario_id = auth.uid() and puede_resenar(auth.uid(), curso_id)));
create policy "resena borra" on resenas for delete using (usuario_id = auth.uid() or es_admin());
grant select on resenas to anon, authenticated;
grant insert, update, delete on resenas to authenticated;

-- Promedio público por programa (solo reseñas aprobadas).
create or replace view resenas_resumen as
  select curso_id, round(avg(estrellas)::numeric, 1) as promedio, count(*)::int as cantidad
  from resenas where estado = 'aprobada' group by curso_id;
grant select on resenas_resumen to anon, authenticated;

select 'ok' as resultado;
