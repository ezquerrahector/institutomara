-- ============================================================================
-- Instituto Mara — Rutas de aprendizaje (paquetes con precio especial)
-- ----------------------------------------------------------------------------
-- Cada ruta vive en la tabla cursos (id que empieza con r-) para que el cobro,
-- los cupones y el webhook la traten como cualquier programa. Al quedar
-- inscrito en una ruta, un disparador inscribe al alumno en cada programa que
-- incluye. Se puede volver a ejecutar sin problema.
-- ============================================================================

insert into cursos (id, nombre, descripcion, color, nivel, familia, periodo_tipo, periodo_num, horas, precio, publicado, proximamente) values
  ('r-asistente', 'Ruta Asistente Administrativo', 'Todo lo que piden en una vacante de oficina: computación y Office desde cero, Excel intermedio y avanzado, y atención al cliente por teléfono, mostrador y WhatsApp.', '#0F766E', 'Rutas', 'Rutas', null, null, 38, 1990, true, false),
  ('r-emprende', 'Ruta Emprende y Haz Crecer tu Negocio', 'Ordena tu dinero, lleva tus cuentas y tu RESICO sin miedo, y consigue clientes con marketing digital y redes sociales.', '#EA580C', 'Rutas', 'Rutas', null, null, 80, 2990, true, false),
  ('r-lider', 'Ruta Líder de Equipo y Recursos Humanos', 'Dirige a tu equipo con claridad, cumple la NOM-035 en tu centro de trabajo y maneja las emociones y el estrés propios y del equipo.', '#B45309', 'Rutas', 'Rutas', null, null, 72, 2890, true, false),
  ('r-cuidador', 'Ruta Cuidador y Acompañamiento', 'Cuida a una persona mayor con seguridad, da primeros auxilios psicológicos en una crisis y acompaña con respeto en la etapa final de la vida y el duelo.', '#7C3AED', 'Rutas', 'Rutas', null, null, 80, 2990, true, false),
  ('r-ingles', 'Ruta Inglés Completo: de cero a intermedio alto (A1 → B2)', 'Los cuatro niveles seguidos: A1 para presentarte y resolver lo básico, A2 para contar lo que hiciste y usar el inglés en tu trabajo, B1 para opinar, negociar planes y presentar una entrevista, y B2 para hablar con matices, negociar, presentar y escribir como profesional.', '#4F46E5', 'Rutas', 'Rutas', null, null, 92, 2490, true, false),
  ('r-poliglota', 'Ruta Políglota Viajero: francés, italiano y portugués', 'Los tres cursos A1: francés, italiano y portugués de Brasil. Aprende a presentarte, moverte por la ciudad, comprar, comer en un restaurante y socializar, con voz nativa en cada frase y los falsos amigos que más confunden a los hispanohablantes.', '#DB2777', 'Rutas', 'Rutas', null, null, 72, 1990, true, false),
  ('r-educadores', 'Ruta Educación, Crianza y Bienestar Infantil', 'Inclusión y neurodiversidad en el aula y en casa, salud emocional y señales de alerta en niños y adolescentes, y primeros auxilios psicológicos para responder en una crisis.', '#0EA5E9', 'Rutas', 'Rutas', null, null, 74, 3190, true, false),
  ('r-vende', 'Ruta Vende en Línea y Haz Crecer tu Marca', 'Vende en WhatsApp Business, Mercado Libre y redes; atrae clientes con marketing digital y diseña tus publicaciones y tu marca con Canva y toma fotos de producto que venden con tu celular.', '#16A34A', 'Rutas', 'Rutas', null, null, 68, 2690, true, false),
  ('r-psicologia', 'Ruta Psicología Clínica Basada en Evidencia', 'Evaluación y formulación de casos, Terapia Cognitivo-Conductual y terapias contextuales (ACT, DBT y activación conductual): del primer contacto con el paciente al plan de tratamiento con intervenciones basadas en evidencia.', '#7C3AED', 'Rutas', 'Rutas', null, null, 110, 4490, true, false)
on conflict (id) do update set
  nombre = excluded.nombre, descripcion = excluded.descripcion, color = excluded.color,
  nivel = excluded.nivel, familia = excluded.familia, horas = excluded.horas,
  publicado = excluded.publicado, proximamente = excluded.proximamente;
-- Nota: el precio NO se sobrescribe al repetir este archivo, para respetar el que
-- hayas cambiado a mano. Para cambiarlo: update cursos set precio = 2490 where id = 'r-emprende';

create table if not exists rutas_cursos (
  ruta_id  text not null references cursos(id) on delete cascade,
  curso_id text not null references cursos(id) on delete cascade,
  orden    int  not null default 0,
  primary key (ruta_id, curso_id)
);
alter table rutas_cursos enable row level security;
drop policy if exists "rutas_cursos lectura" on rutas_cursos;
create policy "rutas_cursos lectura" on rutas_cursos for select using (true);

delete from rutas_cursos where ruta_id in ('r-asistente', 'r-emprende', 'r-lider', 'r-cuidador', 'r-ingles', 'r-poliglota', 'r-educadores', 'r-vende', 'r-psicologia');
insert into rutas_cursos (ruta_id, curso_id, orden) values
  ('r-asistente', 'c-office', 1),
  ('r-asistente', 'c-excel-avanzado', 2),
  ('r-asistente', 'c-atencion-ventas', 3),
  ('r-emprende', 'c-finanzas-personales', 1),
  ('r-emprende', 'd-contabilidad-resico', 2),
  ('r-emprende', 'd-marketing-digital', 3),
  ('r-lider', 'd-liderazgo', 1),
  ('r-lider', 'd-nom035', 2),
  ('r-lider', 'c-inteligencia-emocional', 3),
  ('r-cuidador', 'd-adulto-mayor', 1),
  ('r-cuidador', 'c-pap', 2),
  ('r-cuidador', 'd-tanatologia', 3),
  ('r-ingles', 'c-ingles', 1),
  ('r-ingles', 'c-ingles-a2', 2),
  ('r-ingles', 'c-ingles-b1', 3),
  ('r-ingles', 'c-ingles-b2', 4),
  ('r-poliglota', 'c-frances-a1', 1),
  ('r-poliglota', 'c-italiano-a1', 2),
  ('r-poliglota', 'c-portugues-a1', 3),
  ('r-educadores', 'd-neurodiversidad', 1),
  ('r-educadores', 'd-infancia-adolescencia', 2),
  ('r-educadores', 'c-pap', 3),
  ('r-vende', 'c-venta-en-linea', 1),
  ('r-vende', 'd-marketing-digital', 2),
  ('r-vende', 'c-canva', 3),
  ('r-vende', 'c-fotografia-producto', 4),
  ('r-psicologia', 'd-evaluacion-clinica', 1),
  ('r-psicologia', 'd-tcc', 2),
  ('r-psicologia', 'd-terapias-contextuales', 3);

-- Inscribirse a una ruta = inscribirse a cada programa que incluye
create or replace function expandir_ruta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into inscripciones (usuario_id, curso_id, estatus)
  select new.usuario_id, rc.curso_id, 'activa'
  from rutas_cursos rc where rc.ruta_id = new.curso_id
  on conflict (usuario_id, curso_id) do update set estatus = 'activa';
  return new;
end;
$$;
drop trigger if exists inscripcion_ruta on inscripciones;
create trigger inscripcion_ruta
  after insert or update of estatus on inscripciones
  for each row when (new.estatus = 'activa' and new.curso_id like 'r-%')
  execute function expandir_ruta();

-- Los cupones generales no se suman al precio especial de una ruta
-- (un cupón hecho para una ruta en particular sí aplica).
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
  if c.curso_id is null and p_curso_id like 'r-%' then
    return query select false, 'Las rutas ya tienen precio especial; este cupón es para programas individuales.', p, 0::numeric, p;
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
