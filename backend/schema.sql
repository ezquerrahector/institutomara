-- ============================================================================
-- Instituto Mara — esquema de base de datos para Supabase (Postgres)
-- ----------------------------------------------------------------------------
-- Este archivo es el "siguiente nivel" de la plataforma: hoy la app guarda todo
-- en el navegador (localStorage). En cuanto crees un proyecto gratuito en
-- https://supabase.com y pegues sus llaves en Ajustes (dentro de la app), este
-- esquema le da respaldo real: mismos alumnos y avance desde cualquier
-- dispositivo, fotos de perfil guardadas en la nube, folios de constancia
-- verificables por cualquiera, y pagos con Mercado Pago.
--
-- Cómo usarlo:
--   1. Crea un proyecto en supabase.com (plan gratuito es suficiente para
--      empezar).
--   2. Ve a SQL Editor → pega todo este archivo → Run.
--   3. Ve a Project Settings → API y copia "Project URL" y "anon public key".
--   4. Pégalas en la app: Administración → Ajustes → (sección que agregues de
--      conexión a Supabase) o directamente en las variables SUPABASE_URL /
--      SUPABASE_ANON_KEY dentro de plataforma/index.html y verificar.html.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------- Usuarios (perfil adicional sobre auth.users) ----------
create table if not exists perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  correo text not null unique,
  telefono text,
  rol text not null default 'alumno' check (rol in ('alumno','admin')),
  folio text,
  foto_url text,
  creado_en timestamptz not null default now()
);

-- ---------- Cursos y jerarquía académica ----------
-- nivel: 'Cursos libres de capacitación' | 'Bachillerato' | 'Licenciatura' (y los que agregues)
-- periodo_tipo/periodo_num: solo aplican a niveles con avance por cuatrimestre/semestre
create table if not exists cursos (
  id text primary key,                 -- mismo id corto que usa el front (ej. 'c-ingles')
  nombre text not null,
  descripcion text,
  color text default '#6D28D9',
  nivel text not null default 'Cursos libres de capacitación',
  familia text default 'General',
  periodo_tipo text,                   -- 'Cuatrimestre' | 'Semestre' | null
  periodo_num int,
  horas numeric default 0,
  precio numeric default 0,
  publicado boolean default false,
  proximamente boolean default false,
  contenido jsonb not null default '[]'::jsonb,  -- módulos/lecciones/bloques, igual que en el front
  creado_en timestamptz not null default now()
);

-- ---------- Inscripciones ----------
create table if not exists inscripciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfiles(id) on delete cascade,
  curso_id text not null references cursos(id) on delete cascade,
  fecha date not null default current_date,
  estatus text not null default 'activa',
  unique(usuario_id, curso_id)
);

-- ---------- Avance (lecciones vistas y calificación de cada módulo) ----------
create table if not exists avances (
  usuario_id uuid not null references perfiles(id) on delete cascade,
  curso_id text not null references cursos(id) on delete cascade,
  lecciones_vistas text[] not null default '{}',
  calificaciones_modulo jsonb not null default '{}'::jsonb,  -- { "c-ingles-m1": 90 }
  actualizado_en timestamptz not null default now(),
  primary key (usuario_id, curso_id)
);

-- ---------- Pagos ----------
create table if not exists pagos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references perfiles(id) on delete set null,
  curso_id text references cursos(id) on delete set null,
  monto numeric not null,
  medio text default 'Mercado Pago',
  referencia_mp text,                 -- id de pago / preferencia de Mercado Pago
  nota text,
  fecha date not null default current_date,
  creado_en timestamptz not null default now()
);

-- ---------- Constancias (registro público para el QR) ----------
create table if not exists constancias (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  usuario_id uuid not null references perfiles(id) on delete cascade,
  curso_id text not null references cursos(id) on delete cascade,
  nombre_alumno text not null,
  nombre_curso text not null,
  horas numeric not null default 0,
  fecha date not null default current_date
);

-- ---------- Dudas (respuesta en máximo 24 horas) ----------
create table if not exists dudas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfiles(id) on delete cascade,
  curso_id text references cursos(id) on delete set null,
  modulo_id text,
  leccion_id text,
  pregunta text not null,
  respuesta text,
  estatus text not null default 'pendiente' check (estatus in ('pendiente','respondida')),
  fecha timestamptz not null default now(),
  fecha_respuesta timestamptz
);

-- ============================================================================
-- Seguridad a nivel de fila (RLS)
-- ============================================================================
alter table perfiles enable row level security;
alter table cursos enable row level security;
alter table inscripciones enable row level security;
alter table avances enable row level security;
alter table pagos enable row level security;
alter table constancias enable row level security;
alter table dudas enable row level security;

-- Función auxiliar: ¿el usuario que hace la consulta es admin?
create or replace function es_admin() returns boolean
language sql stable as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin');
$$;

-- Perfiles: cada quien ve y edita el suyo; el admin ve y edita todos.
create policy "perfil propio" on perfiles for select using (id = auth.uid() or es_admin());
create policy "perfil propio update" on perfiles for update using (id = auth.uid() or es_admin());
create policy "perfil insert" on perfiles for insert with check (id = auth.uid());

-- Cursos: cualquiera autenticado puede ver los publicados o "próximamente";
-- solo el admin ve/edita borradores y edita contenido.
create policy "cursos visibles" on cursos for select using (publicado or proximamente or es_admin());
create policy "cursos solo admin escribe" on cursos for insert with check (es_admin());
create policy "cursos solo admin actualiza" on cursos for update using (es_admin());
create policy "cursos solo admin borra" on cursos for delete using (es_admin());

-- Inscripciones, avances, pagos, dudas: cada alumno ve y crea lo suyo; admin ve/edita todo.
create policy "insc propias" on inscripciones for select using (usuario_id = auth.uid() or es_admin());
create policy "insc crear" on inscripciones for insert with check (usuario_id = auth.uid() or es_admin());
create policy "insc admin edita" on inscripciones for update using (es_admin());

create policy "avance propio" on avances for select using (usuario_id = auth.uid() or es_admin());
create policy "avance propio upsert" on avances for insert with check (usuario_id = auth.uid());
create policy "avance propio update" on avances for update using (usuario_id = auth.uid() or es_admin());

create policy "pagos visibles" on pagos for select using (usuario_id = auth.uid() or es_admin());
create policy "pagos solo admin escribe" on pagos for insert with check (es_admin());

create policy "dudas propias" on dudas for select using (usuario_id = auth.uid() or es_admin());
create policy "dudas crear" on dudas for insert with check (usuario_id = auth.uid());
create policy "dudas admin responde" on dudas for update using (es_admin());

-- Constancias: CUALQUIERA puede leerlas (es lo que hace posible verificar.html
-- sin que la persona que escanea el QR necesite iniciar sesión). Solo el
-- sistema (o el admin) las crea.
create policy "constancias publicas" on constancias for select using (true);
create policy "constancias admin crea" on constancias for insert with check (es_admin());

-- ============================================================================
-- Nota sobre "contenido" de los cursos
-- ----------------------------------------------------------------------------
-- Para no reescribir todo el editor de módulos/lecciones/bloques, la columna
-- cursos.contenido guarda ese árbol tal cual lo produce hoy el editor del
-- front (mismo formato que ves en la función semilla() de plataforma/index.html).
-- Esto permite migrar sin rehacer el editor: se sincroniza el objeto completo
-- en cada guardado en vez de tener una tabla por bloque.
-- ============================================================================
