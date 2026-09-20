-- ============================================================================
-- Instituto Mara — cuentas en la nube (paso 2 del backend)
-- ----------------------------------------------------------------------------
-- Ejecuta este archivo en Supabase → SQL Editor → Run, DESPUÉS de schema.sql.
-- Hace cuatro cosas:
--   1. Crea el perfil del alumno automáticamente cuando se registra.
--   2. Corrige los permisos para que nadie pueda regalarse un curso de paga.
--   3. Permite que el alumno genere su propia constancia al terminar.
--   4. Carga el catálogo de cursos (necesario para las inscripciones y para que
--      el cobro tome el precio del servidor).
-- Se puede volver a ejecutar las veces que quieras: no duplica nada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Perfil automático al registrarse
-- ---------------------------------------------------------------------------
-- Cuando alguien crea su cuenta, Supabase guarda el correo en auth.users. Este
-- disparador crea de inmediato su fila en `perfiles` con el nombre y el
-- teléfono que escribió, y le asigna folio de alumno.
create or replace function crear_perfil_al_registrarse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfiles (id, nombre, correo, telefono, rol, folio)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nombre',''), split_part(new.email,'@',1)),
    new.email,
    nullif(new.raw_user_meta_data->>'telefono',''),
    'alumno',
    'IM-' || to_char(now(),'YY') || '-' || lpad((floor(random()*100000))::text, 5, '0')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function crear_perfil_al_registrarse();

-- ---------------------------------------------------------------------------
-- 2. Nadie se regala un curso de paga
-- ---------------------------------------------------------------------------
-- Antes, un alumno podía crear su propia inscripción a cualquier curso. Ahora
-- solo puede inscribirse solo a los cursos gratuitos (precio 0); los de paga
-- los inscribe el webhook de Mercado Pago (que usa la llave de servicio y no
-- pasa por estas reglas) o el administrador a mano.
drop policy if exists "insc crear" on inscripciones;
create policy "insc crear" on inscripciones for insert with check (
  es_admin()
  or (
    usuario_id = auth.uid()
    and exists (select 1 from cursos c where c.id = curso_id and coalesce(c.precio,0) = 0 and c.publicado)
  )
);

-- El alumno puede darse de baja / reactivar solo sus propias inscripciones
drop policy if exists "insc admin edita" on inscripciones;
create policy "insc admin edita" on inscripciones for update using (es_admin());

-- ---------------------------------------------------------------------------
-- 3. Constancia propia al terminar el curso
-- ---------------------------------------------------------------------------
-- El folio lo genera el alumno al completar el curso, pero solo para cursos en
-- los que está inscrito. Leerlas sigue siendo público (así funciona el QR).
drop policy if exists "constancias admin crea" on constancias;
create policy "constancias propias crea" on constancias for insert with check (
  es_admin()
  or (
    usuario_id = auth.uid()
    and exists (select 1 from inscripciones i where i.usuario_id = auth.uid() and i.curso_id = curso_id)
  )
);

-- El alumno necesita poder guardar su avance actualizado (upsert) y el admin
-- necesita poder corregirlo; esto ya estaba, se deja explícito por claridad.
drop policy if exists "avance propio upsert" on avances;
create policy "avance propio upsert" on avances for insert with check (usuario_id = auth.uid() or es_admin());

-- ---------------------------------------------------------------------------
-- 4. Catálogo de cursos (31)
-- ---------------------------------------------------------------------------
-- El contenido de las lecciones sigue viviendo en los archivos
-- plataforma/cursos/*.js; aquí solo van los datos que necesitan las
-- inscripciones, los pagos y las constancias.
insert into cursos (id, nombre, descripcion, color, nivel, familia, periodo_tipo, periodo_num, horas, precio, publicado, proximamente) values
  ('c-ingles', 'Inglés básico A1', 'Empieza de cero y termina presentándote, hablando de tu día, comprando, pidiendo en un restaurante y moviéndote por una ciudad. Con voz para escuchar cada frase y ejercicios para practicar tu pronunciación.', '#6D28D9', 'Cursos libres de capacitación', 'Idiomas', null, null, 20, 890, true, false),
  ('c-ia', 'IA aplicada al trabajo (general)', 'Usa inteligencia artificial para redactar, resumir, ordenar datos, organizar tu semana y decidir mejor, sin tecnicismos y cuidando tu información. Con plantillas listas para copiar.', '#14B8A6', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 10, 990, true, false),
  ('c-ia-oficina', 'IA para la Oficina', 'Correo, juntas, reportes, presentaciones y hojas de cálculo: cómo la IA le quita horas muertas al trabajo de oficina. Con casos reales y plantillas listas para copiar.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-ventas', 'IA para Ventas y Atención a Clientes', 'Prospección, guiones de venta, manejo de objeciones, cotizaciones, seguimiento por WhatsApp y clientes molestos, con la IA como tu asistente comercial.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-emprendedores', 'IA para Emprendedores y Pequeños Negocios', 'Valida tu idea, define tu propuesta, calcula precios, ordena tus números y promociona tu negocio en redes y WhatsApp con la IA como socio de trabajo.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-finanzas', 'IA para Finanzas', 'Conciliaciones, reportes financieros, análisis de variaciones, flujo de efectivo y comunicación con dirección, usando IA con el rigor que exigen los números.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-rh', 'IA para Recursos Humanos', 'Vacantes sin sesgos, filtrado de candidatos con criterio, entrevistas estructuradas, onboarding, evaluación de desempeño y comunicación interna, con IA y cuidando los datos del personal.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-docentes', 'IA para Docentes e Instructores', 'Planeación de clases, materiales diferenciados, rúbricas, evaluación, retroalimentación y comunicación con familias, usando IA para ganar tiempo sin perder tu criterio pedagógico.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-salud', 'IA para el Sector Salud', 'Para personal administrativo y profesional de consultorios, clínicas y hospitales: agenda, comunicación con pacientes, materiales educativos, documentación y gestión, con reglas estrictas de privacidad y sin sustituir el juicio clínico.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-manufactura', 'IA para Manufactura', 'Instrucciones de trabajo, análisis de fallas, calidad, mantenimiento, reportes de turno y mejora continua en planta, usando IA con los datos y el criterio de tu operación.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-marketing', 'IA para Marketing y Redes Sociales', 'Estrategia de contenido, textos que venden, calendarios, anuncios, correos y análisis de resultados en redes sociales, usando IA sin perder la voz de tu marca.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-contadores', 'IA para Contadores', 'Despacho y área contable: atención a clientes, investigación fiscal verificada, papeles de trabajo, conciliaciones en Excel, comunicación de obligaciones y organización del despacho con IA.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-directivos', 'IA para Directivos y Gerentes', 'Pensar mejor, decidir con más información, comunicar con claridad, dirigir juntas efectivas e impulsar la adopción de IA en tu equipo con reglas claras.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-atencion-cliente', 'IA para Atención al Cliente', 'Respuestas rápidas y humanas, base de conocimiento, manejo de quejas, encuestas de satisfacción y chatbots responsables, con IA como apoyo de tu equipo de servicio.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-proyectos', 'IA para Gestión de Proyectos', 'Definir alcance, dividir el trabajo, planear, identificar riesgos, dar seguimiento y comunicar el avance de tus proyectos con apoyo de IA.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-abogados', 'IA para Abogados', 'Revisión de contratos, resúmenes de expedientes, redacción de escritos, investigación jurídica verificada y comunicación con clientes, con IA y respeto absoluto al secreto profesional.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-compras', 'IA para Compras y Abastecimiento', 'Requisiciones claras, búsqueda y evaluación de proveedores, comparación de cotizaciones, negociación y seguimiento de pedidos con apoyo de IA.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-logistica', 'IA para Logística e Inventarios', 'Control de inventarios, clasificación ABC, puntos de reorden, pronóstico sencillo de demanda, rutas de entrega y comunicación de incidencias con IA y Excel.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-ecommerce', 'IA para Comercio Electrónico', 'Fichas de producto que venden, fotos, precios y márgenes, promociones, marketplaces, atención postventa y análisis de tu tienda en línea con IA.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-inmobiliarias', 'IA para Inmobiliarias', 'Fichas y anuncios de propiedades, seguimiento a prospectos, visitas, análisis de precios, contratos de arrendamiento y comunicación con clientes, con IA y veracidad.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-arquitectura', 'IA para Arquitectos', 'Renders, propuestas de diseño, memorias de cálculo y presentaciones a cliente con apoyo de IA.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-diseno', 'IA para Diseño y Creación de Contenido', 'Imágenes, video, guiones y piezas gráficas creadas y editadas más rápido con herramientas de IA.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-programadores', 'IA para Programadores', 'Generación y revisión de código, documentación y pruebas apoyadas en asistentes de IA.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-automatizacion', 'Automatización con IA sin Programar', 'Conecta correo, hojas de cálculo, WhatsApp y formularios con herramientas de automatización sin escribir código.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-freelance', 'IA para Freelancers y Consultores Independientes', 'Propuestas, cotizaciones, seguimiento a clientes y organización del tiempo apoyados en IA.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-callcenter', 'IA para Call Centers y BPO', 'Guiones de llamada, resúmenes de interacción y clasificación de tickets con apoyo de IA.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-turismo', 'IA para Turismo y Hotelería', 'Reservas, itinerarios personalizados, promoción de destinos y atención a huéspedes con IA.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-estudiantes', 'IA para Estudiantes e Investigación', 'Búsqueda y organización de fuentes, resúmenes, fichas de estudio y apoyo para tesis con IA.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-construccion', 'IA para Construcción y Obra', 'Presupuestos, bitácoras de obra, cronogramas y control de materiales apoyados en IA.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-ia-campo', 'IA para Agronegocios y Campo', 'Registro de cosechas, control de insumos, clima y precios de mercado apoyados en IA.', '#0D9488', 'Cursos libres de capacitación', 'Inteligencia Artificial aplicada', null, null, 6, 590, true, false),
  ('c-office', 'Computación y Office', 'Domina Windows, archivos, correo, la nube, Word, Excel y PowerPoint desde cero, con hojas de Excel de práctica dentro de las lecciones y un proyecto final de oficina real.', '#5B21B6', 'Cursos libres de capacitación', 'Tecnología', null, null, 12, 990, true, false)
on conflict (id) do update set
  nombre = excluded.nombre, descripcion = excluded.descripcion, color = excluded.color,
  nivel = excluded.nivel, familia = excluded.familia, periodo_tipo = excluded.periodo_tipo,
  periodo_num = excluded.periodo_num, horas = excluded.horas, precio = excluded.precio,
  publicado = excluded.publicado, proximamente = excluded.proximamente;

-- ---------------------------------------------------------------------------
-- 5. Hazte administrador
-- ---------------------------------------------------------------------------
-- Primero crea tu cuenta normal en el aula (Crear cuenta) y confirma tu correo.
-- Después ejecuta esta línea UNA vez, con tu correo:
--   update perfiles set rol = 'admin' where correo = 'tucorreo@ejemplo.com';
