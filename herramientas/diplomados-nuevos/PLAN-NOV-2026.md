# Plan de diplomados nuevos — tanda de noviembre 2026

Aprobado por Héctor el 19 oct 2026. Sale de la revisión de mercado del 19 oct (ManpowerGroup «Escasez de talento 2026»,
SEP «Estrategia Nacional de Formación Continua 2026», catálogos de Anáhuac Online, ADIPA y MiDiplomado, y la demanda
de Lean Six Sigma en Guanajuato).

Se construye **uno por día hábil**, en este orden, con el mismo formato y las mismas 10 validaciones que los 17
diplomados de octubre (ver `INSTRUCCIONES.md`). Todo se acumula en la rama **`tanda-diplomados-nov-2026`**; Héctor
la publica en tandas (PR a `main` + SQL en Supabase).

## Orden, identificadores y precio

| # | id | pref | Diplomado (nombre sugerido) | Precio | familia/área | Estado |
|---|---|---|---|---|---|---|
| 1 | d-calidad-lean | cal | Diplomado en Calidad y Mejora Continua: Lean, Six Sigma e ISO 9001 | 1890 | Negocios y finanzas | Publicado (2026-10-20) |
| 2 | d-datos-ia | dat | Diplomado en Análisis de Datos e Inteligencia Artificial para Tomar Decisiones | 1890 | Tecnología | Listo en rama (2026-10-26) |
| 3 | d-ventas-experiencia | vtp | Diplomado en Ventas Profesionales y Experiencia del Cliente | 1690 | Negocios y finanzas | Publicado (2026-10-28) |
| 4 | d-proteccion-civil | pci | Diplomado en Protección Civil y Brigadas de Emergencia en el Trabajo | 1890 | Negocios y finanzas | Pendiente |
| 5 | d-intervencion-crisis | cri | Diplomado en Intervención en Crisis y Prevención del Suicidio | 1690 | Salud y bienestar | Pendiente |
| 6 | d-psicologia-organizacional | por | Diplomado en Psicología Organizacional y Desarrollo del Talento | 1690 | Salud y bienestar | Pendiente |
| 7 | d-docencia-nem | nem | Diplomado en Docencia para la Nueva Escuela Mexicana: Planeación y Evaluación | 1690 | Desarrollo humano | Pendiente |
| 8 | d-adicciones | adi | Diplomado en Prevención y Atención de las Adicciones | 1690 | Salud y bienestar | Pendiente |
| 9 | d-crianza-positiva | crz | Diplomado en Crianza Positiva y Orientación Familiar | 1690 | Desarrollo humano | Pendiente |
| 10 | d-estimulacion-temprana | etm | Diplomado en Estimulación Temprana y Desarrollo Infantil (0 a 6 años) | 1690 | Desarrollo humano | Pendiente |
| 11 | d-sexualidad-humana | sxh | Diplomado en Sexualidad Humana | 1690 | Salud y bienestar | Pendiente |
| 12 | d-coaching | cch | Diplomado en Coaching Profesional | 1690 | Desarrollo humano | Pendiente |
| 13 | d-mantenimiento-tpm | tpm | Diplomado en Mantenimiento Industrial y TPM | 1890 | Negocios y finanzas | Pendiente |
| 14 | d-pyme | pym | Diplomado en Finanzas y Administración para Dueños de PyME | 1690 | Negocios y finanzas | Pendiente |
| 15 | d-bienestar-laboral | blm | Diplomado en Bienestar Laboral, Manejo del Estrés y Mindfulness | 1690 | Desarrollo humano | Pendiente |

Las categorías de la tabla son las que ya existen en el sitio (`familia` y `area` en meta.json); confírmalas contra los `meta.json` de octubre y no inventes otras.

## Tanda 2 — categorías nuevas (pedido de Héctor, 26 oct 2026)

**Cambio de orden (pedido de Héctor, 28 oct 2026): esta tabla va PRIMERO.** La tarea hace los #16-27 en este orden y, al terminarlos, regresa a los pendientes #4-15 de la tabla de arriba, con el mismo procedimiento. Objetivo: abrir
categorías nuevas en el sitio para que quien busca cursos encuentre temas que hoy no tenemos (cocina, contenido,
oficios, salud, hogar, dinero). Todos son diplomados de 30 h (el generador `crear-diplomado.js` solo hace
diplomados). Precio sugerido abajo; Héctor puede ajustarlo en Administración.

**Área (`area` en meta.json) en esta tanda:** usa el nombre exacto de la columna «Área nueva». El sitio crea la
tarjeta sola la primera vez que aparece un área nueva (ver `AREA_VIEJA`/`ICONO_AREA` en `sitio-web/index.html`).
Desde el 26 oct el sitio usa 11 áreas: Psicología y terapia · Comunicación e influencia · Crecimiento personal ·
Liderazgo, RH y seguridad laboral · Ventas y marketing · Tecnología e IA · IA para tu profesión · Idiomas ·
Criminología y forense · Cuidado, infancia y educación · Administración y contabilidad. Para los #1-15 sigue
valiendo la `familia` de la tabla de arriba.

| # | id | pref | Programa (nombre sugerido) | Precio | Área nueva | Giros (prospectos, nombres exactos) | Estado |
|---|---|---|---|---|---|---|---|
| 16 | d-cocina-negocio | coc | Diplomado en Cocina y Repostería para Emprender: costeo, recetas estándar y venta | 1690 | Cocina y gastronomía | Restaurante; Cafetería; Panadería / repostería | Publicado (2026-11-02) |
| 17 | d-manejo-alimentos | mha | Diplomado en Inocuidad y Manejo Higiénico de Alimentos (NOM-251 y Distintivo H) | 1890 | Cocina y gastronomía | Restaurante; Hotelería; Comedor industrial / catering; Hospital / clínica privada | Publicado (2026-11-03) |
| 18 | d-contenido-video | vid | Diplomado en Creación de Contenido y Edición de Video con el Celular | 1690 | Creatividad y contenido | Agencia de marketing digital | Pendiente |
| 19 | d-nutricion | nut | Diplomado en Nutrición y Alimentación Saludable | 1690 | Salud y nutrición | Gimnasio / centro deportivo; Hospital / clínica privada; Comedor industrial / catering | Pendiente |
| 20 | d-energia-solar | sol | Diplomado en Energía Solar Fotovoltaica: diseño, cálculo e instalación segura | 1690 | Oficios y técnica | Constructora; Instalaciones eléctricas / solares | Pendiente |
| 21 | d-hospitalidad | hos | Diplomado en Hospitalidad y Servicio en Hoteles y Restaurantes | 1690 | Turismo y hospitalidad | Hotelería; Restaurante; Agencia de viajes | Pendiente |
| 22 | d-derecho-practico | der | Diplomado en Derecho Práctico para la Vida Diaria: trabajo, renta, familia y consumo | 1690 | Dinero y derecho | — | Pendiente |
| 23 | d-finanzas-inversion | inv | Diplomado en Finanzas Personales e Inversión para Principiantes: CETES, fondos y Afore | 1690 | Dinero y derecho | — | Pendiente |
| 24 | d-perros | per | Diplomado en Cuidado, Conducta y Adiestramiento de Perros | 1690 | Hogar, familia y mascotas | Veterinaria; Estética canina | Pendiente |
| 25 | d-hogar-familia | org | Diplomado en Organización del Hogar, Rutinas y Economía Familiar | 1690 | Hogar, familia y mascotas | — | Pendiente |
| 26 | d-primeros-auxilios | pax | Diplomado en Primeros Auxilios y Respuesta a Emergencias (teórico) | 1690 | Salud y nutrición | Colegio privado; Guardería / estancia infantil; Industria / manufactura | Pendiente |
| 27 | d-cafe-barismo | caf | Diplomado en Café de Especialidad, Barismo y Negocio de Cafetería | 1690 | Cocina y gastronomía | Cafetería; Restaurante | Pendiente |

Los 11 giros nuevos (Restaurante, Cafetería, Panadería / repostería, Comedor industrial / catering, Gimnasio / centro deportivo, Constructora, Instalaciones eléctricas / solares, Agencia de viajes, Veterinaria, Estética canina, Guardería / estancia infantil) se dieron de alta en `prospecto_giros` el 28 oct 2026, con su tema y su problema para llamadas, correos y WhatsApp.

### Cuidados de la tanda 2
- **16 Cocina y repostería.** Formato de texto e interactivo: el valor está en recetas estándar con gramajes, costeo
  por porción en Excel, precio de venta, conservación, empaque, etiquetado (NOM-051 si vende empacado), venta por
  WhatsApp y apps de reparto. Decir que la práctica en cocina es indispensable; incluir fotos o esquemas solo propios.
- **17 Manejo higiénico.** Verificar la versión vigente de la NOM-251-SSA1-2009 y del Distintivo H (Secretaría de
  Turismo). Aclarar que no otorga el Distintivo H ni sustituye la capacitación que exija la autoridad sanitaria.
- **18 Contenido y video.** CapCut/InShot, guion corto, ganchos, luz y audio con el celular, métricas, derechos de
  autor y música con licencia. Distinto de Marketing Digital y de Fotografía de Producto.
- **19 Nutrición.** Plato del Bien Comer y Guías Alimentarias (verificar vigentes), etiquetado frontal, lectura de
  etiquetas. Prohibido dar planes de dieta, conteo de calorías por persona o metas de peso; incluir señales de
  trastornos de la conducta alimentaria con canalización a profesional y la línea de la Alianza Nacional para los
  Trastornos de la Conducta Alimentaria. Aclarar que no sustituye a un nutriólogo con cédula.
- **20 Energía solar.** Cálculo de consumo con recibo de CFE, dimensionamiento, NOM-001-SEDE vigente, interconexión con
  CFE (verificar trámite), seguridad eléctrica. Decir que la instalación la debe hacer personal calificado.
- **21 Hospitalidad.** Recepción, housekeeping, servicio en restaurante, quejas, reseñas en línea, upselling ético.
- **22 Derecho práctico.** Ley Federal del Trabajo (finiquito vs liquidación), arrendamiento, pensión alimenticia,
  Profeco. Siempre «verifica con un abogado tu caso»; no es asesoría legal. Verificar artículos vigentes.
- **23 Finanzas e inversión.** Distinto del curso «Finanzas personales y salir de deudas» (ese es deudas y presupuesto; este va a ahorro e inversión). Educativo, sin recomendaciones personalizadas: CETES, fondos, Afore, riesgo/rendimiento, fraudes
  (CONDUSEF). Decir que no es asesoría financiera.
- **24 Perros.** Bienestar animal, refuerzo positivo, socialización; nada de castigos físicos; canalizar a veterinario.
- **26 Primeros auxilios.** Solo teórico, con aviso claro de que la práctica presencial certificada es indispensable;
  911; no sustituye cursos de Cruz Roja o equivalentes. Coordinar con #4 (protección civil) para no repetir.

## Tanda 3 — emprendimiento (aprobada por Héctor el 28 oct 2026)

**Cambio de orden (pedido de Héctor, 3 nov 2026): esta tabla va PRIMERO.** La tarea hace los #28-48 en orden; después, los pendientes de la tanda 2 (#18-27) y al final los pendientes #4-15.

Pedido de Héctor: diplomados para quien quiere emprender o ya tiene un negocio pequeño. **Aprobados todos el 28 oct**
(«de acuerdo con todos») más el #48 de composta. Desde el 3 nov van PRIMERO, en el orden de la tabla. `area` = «Emprendimiento y negocio propio» (icono 🚀 ya en taxonomia.js) salvo el #48, que también va ahí.
Todos de 30 h, $1,690. Los giros de la columna son sugerencia: úsalos sólo si el diplomado es de los 3 más útiles para ese giro.
Base de la selección: en México las micro son el 95.5 % de los establecimientos y la rama con más unidades es el
comercio de abarrotes y alimentos, con poco más de un millón (INEGI, Censos Económicos 2024); oficios más pedidos en
centros de capacitación (gastronomía, belleza, electricidad, carpintería, mecánica, fotografía); nichos que señalan
guías de negocio 2026 (tiendas en línea de nicho, mascotas, comida ligera, reventa y reacondicionados, servicios a
vendedores en línea). Regla para oficios manuales: teoría, negocio, higiene y seguridad en línea; decir siempre que la
práctica presencial es indispensable y que no certifica (ni sustituye estándares de competencia del CONOCER).

| # | id | pref | Diplomado (nombre sugerido) | Interés estimado | Riesgo de traslape | Giros (prospectos, nombres exactos) | Estado |
|---|---|---|---|---|---|---|---|
| 28 | d-emprender-cero | emp | Emprender desde Cero: de la idea a las primeras ventas (validación, modelo de negocio, alta en el SAT, permisos y primeras ventas) | Alto | Medio (c-ia-emprendedores, d-pyme) | — | Publicado (2026-11-03) |
| 29 | d-tienda-abarrotes | aba | Tienda de Abarrotes y Minisúper Rentable: surtido, márgenes, proveedores, merma y cobro digital | Alto | Bajo | — | Listo en rama (2026-11-03) |
| 30 | d-tienda-en-linea | tel | Tienda en Línea y Marketplaces: catálogo, pagos, envíos, devoluciones y reglas de Profeco | Alto | Medio (c-venta-en-linea, 11 h) | Boutique de ropa | Pendiente |
| 31 | d-unas-pestanas | una | Uñas, Pestañas y Belleza como Negocio: técnica, higiene y tu propio estudio | Alto | Bajo | — | Pendiente |
| 32 | d-barberia | bar | Barbería y Estética Masculina: servicio, higiene y administración del negocio | Medio-alto | Bajo | — | Pendiente |
| 33 | d-cosmetica-artesanal | cos | Cosmética Natural Artesanal: jabones, velas y cremas, formulación segura, etiquetado y venta | Medio-alto | Bajo | — | Pendiente |
| 34 | d-sublimacion | sub | Sublimación, Serigrafía y Productos Personalizados: equipo, costeo y venta a empresas | Medio-alto | Bajo | Agencia de marketing digital | Pendiente |
| 35 | d-costura-marca | cst | Costura, Arreglos y Tu Propia Marca de Ropa: del taller en casa a la pequeña producción | Medio | Bajo | Boutique de ropa | Pendiente |
| 36 | d-eventos | eve | Organización de Eventos: bodas, XV años y corporativos (presupuesto, proveedores y contratos) | Alto | Bajo | Hotelería; Restaurante | Pendiente |
| 37 | d-renta-vacacional | rva | Renta Vacacional y Hospedaje de Corta Estancia: anuncio, precio, limpieza, reseñas e impuestos | Medio-alto | Medio (d-hospitalidad) | Inmobiliaria | Pendiente |
| 38 | d-freelance | fre | Trabajo Independiente y Servicios Profesionales: asistente virtual, cotizar, contratos, cobro y facturación | Alto | Medio (c-ia-freelancers) | Coworking / oficinas ejecutivas | Pendiente |
| 39 | d-franquicias | frq | Franquicias: evaluar, comprar o convertir tu negocio en franquicia | Medio | Bajo | — | Pendiente |
| 40 | d-importar | imp | Importar y Vender: comercio exterior para pequeños negocios (aduana, padrón, costos y proveedores) | Medio-alto | Bajo | Industria / manufactura | Pendiente |
| 41 | d-huertos-agronegocio | hue | Huertos, Hidroponía y Agronegocio a Pequeña Escala | Medio | Bajo | Restaurante | Pendiente |
| 42 | d-servicios-hogar | sho | Negocio de Servicios para el Hogar: limpieza profesional, mantenimiento y jardinería con cuadrillas | Medio | Bajo | Inmobiliaria; Hotelería | Pendiente |
| 43 | d-reparacion-celulares | rce | Reparación de Celulares y Electrónica: diagnóstico, refacciones y negocio | Medio-alto | Bajo | — | Pendiente |
| 44 | d-clases-tutorias | tut | Negocio de Clases y Tutorías: regularización, idiomas y cursos en línea | Medio | Bajo | Colegio privado | Pendiente |
| 45 | d-artesanias | art | Artesanías y Productos Hechos a Mano: diseño, precio, ferias, venta en línea y exportación | Medio | Bajo | — | Pendiente |
| 46 | d-negocio-mascotas | nmc | Negocio de Mascotas: tienda, guardería, paseo y venta por suscripción | Medio-alto | Medio (d-perros) | Veterinaria; Estética canina | Pendiente |
| 47 | d-taller-automotriz | tal | Taller Mecánico y Autolavado: administración, cotización, garantía y servicio al cliente | Medio | Bajo | Concesionaria automotriz | Pendiente |
| 48 | d-composta-humus | cmp | Composta, Humus de Lombriz y Abonos Orgánicos: producción, calidad y negocio | Medio-alto | Bajo (distinto de #41 Huertos) | Restaurante; Comedor industrial / catering; Hotelería | Pendiente |

### Cuidados de la tanda 3
- Nada de promesas de ingresos («gana X al mes») ni esquemas piramidales, dropshipping engañoso o reventa de marcas sin autorización.
- Trámites y fiscal: SAT (RESICO y plataformas digitales), aviso de funcionamiento o licencia sanitaria (COFEPRIS o estatal), uso de suelo y licencia municipal: siempre «verifica en tu municipio y en el SAT».
- 31-33 belleza y cosmética: higiene y bioseguridad, alergias y reacciones (canalizar a médico); etiquetado de cosméticos (verificar NOM-141-SSA1/SCFI vigente).
- 37 renta vacacional: impuestos por plataformas digitales e impuesto estatal al hospedaje; reglamentos de condominio.
- 40 importar: padrón de importadores, regulaciones no arancelarias y NOM de etiquetado; verificar aranceles vigentes.
- 43 reparación: seguridad con baterías de litio y manejo de residuos electrónicos.
- 46 mascotas: bienestar animal, sin castigos; canalizar a veterinario.
- **48 Composta, humus y abonos orgánicos.** Temario sugerido (investigación del 28 oct 2026):
  M1 El negocio de los abonos orgánicos (mercado: viveros, huertos urbanos, agricultores, paisajismo, municipios; productos: composta, lombricomposta o humus, lixiviado, bocashi, sustratos);
  M2 Ciencia del compostaje (relación carbono/nitrógeno, humedad, aireación, fases y temperatura, higienización de patógenos, madurez);
  M3 Lombricultura (lombriz roja californiana, camas, alimentación, cosecha, plagas, escalar);
  M4 Otros abonos y su uso seguro (bocashi, lixiviados, estiércoles, biofertilizantes; dosis y aplicación sin prometer resultados);
  M5 Calidad, normas y etiquetado (NMX-FF-109-SCFI-2008 humus de lombriz, NMX-AA-180-SCFI-2018 tratamiento aerobio de residuos orgánicos —ambas vigentes al 28 oct 2026, verificar—, análisis de laboratorio, prueba de germinación, contaminantes; registro de nutrientes vegetales ante COFEPRIS: verificar si aplica, el Reglamento se reformó en el DOF del 24 abr 2026; uso del término «orgánico» sólo con certificación conforme a la Ley de Productos Orgánicos y la lista de insumos de SENASICA);
  M6 Insumos, logística y permisos (acuerdos con mercados, restaurantes y comedores; residuos de manejo especial y permisos estatales o municipales; olores, lixiviados, vecinos y uso de suelo);
  M7 Costos, precio y escala en Excel (costo por kilo y por bulto, inversión, punto de equilibrio, pilas volteadas vs. aireación forzada);
  M8 Marca, venta y proyecto final (canales: viveros, ferreterías, huertos, agricultores, paisajismo, programas municipales y B2B de «cierre del ciclo» para restaurantes y hoteles; plan de negocio completo).
  Cuidados: seguridad al manejar estiércoles y residuos (guantes, lavado, no usar heces de perros, gatos ni humanas; no compostar carne en pequeña escala sin control), sin promesas de rendimiento de cosechas, «verifica la norma vigente» y la práctica es indispensable.

## Alcance y cuidados por diplomado

1. **Calidad y Mejora Continua.** Público: supervisores, operarios, ingenieros y mandos de planta (calzado, curtiduría,
   autopartes, alimentos del Bajío). 5S, Kaizen, VSM, desperdicios, SMED, poka-yoke, DMAIC, herramientas estadísticas
   básicas, control estadístico de procesos, 8D / A3, ISO 9001:2015 (verifica la versión vigente y la revisión en curso),
   auditoría interna. Aclarar que no otorga cinta Six Sigma certificada ni certificación ISO. Retos con hoja de Excel cuando aplique.
2. **Análisis de Datos e IA.** Limpieza y modelado de datos en Excel, tablas dinámicas, Power Query, Power BI, indicadores,
   visualización honesta, IA generativa para analizar y explicar datos, privacidad y sesgos. Sin repetir los cursos de
   Excel avanzado / Power BI: integra y lleva a decisiones. Retos de Excel.
3. **Ventas Profesionales y Experiencia del Cliente.** Venta consultiva y B2B, prospección, embudo y CRM, manejo de
   objeciones, cierre ético, posventa, NPS/CSAT, quejas, Profeco y Ley Federal de Protección al Consumidor (verificar).
   Distinto del curso «Atención y ventas» y del diplomado de Negociación.
4. **Protección Civil y Brigadas.** NOM-002-STPS-2010, Ley General de Protección Civil, programa interno, análisis de
   riesgos, brigadas (evacuación, incendio, primeros auxilios, búsqueda y rescate), simulacros, sismos en México.
   Primeros auxilios SOLO teóricos: decir claramente que la práctica presencial con instructor certificado es
   indispensable. 911. Verificar versiones vigentes de cada norma y ley estatal de Guanajuato.
5. **Intervención en Crisis y Prevención del Suicidio.** Modelo de primeros auxilios psicológicos y de crisis,
   evaluación de riesgo (factores, señales, preguntar directamente), plan de seguridad (Stanley-Brown), canalización,
   posvención, autocuidado del interviniente. Ética estricta: no sustituye atención profesional; incluir Línea de la
   Vida 800 911 2000 y 911 en cada módulo pertinente; no detallar métodos. Público: psicólogos, docentes, RH, líderes.
6. **Psicología Organizacional.** Clima, cultura, motivación, selección por competencias, evaluación del desempeño,
   capacitación (DNC), engagement, cambio organizacional, NOM-035 como contexto. Distinto de RH y de Liderazgo.
7. **Docencia NEM.** Plan de Estudio 2022, campos formativos, ejes articuladores, programa analítico y codiseño,
   proyectos (comunitarios, aula, escolares), aprendizaje basado en indagación, evaluación formativa. Verificar todo
   contra documentos vigentes de la SEP y decir «verifica la versión vigente». Aclarar que no es formación oficial de
   USICAMM ni otorga puntos.
8. **Adicciones.** Modelos de adicción, sustancias y conductuales, prevención universal/selectiva/indicada, entrevista
   motivacional, reducción de daños, familia, adicciones en el trabajo, NOM-028-SSA2-2009 (verificar), CONASAMA /
   Línea de la Vida. No sustituye tratamiento.
9. **Crianza Positiva.** Para mamás, papás y cuidadores: apego, desarrollo por etapas, disciplina positiva con
   evidencia, límites, emociones, pantallas, escuela, prevención del abuso (sin detalles gráficos), cuándo buscar
   ayuda. Distinto del diplomado profesional de Salud Emocional Infantil.
10. **Estimulación Temprana.** Desarrollo 0-6 años con hitos de fuentes oficiales (CDC/OMS/Secretaría de Salud),
    motricidad, lenguaje, juego, rutinas, señales de alerta y canalización; actividades caseras seguras. No diagnostica.
11. **Sexualidad Humana.** Enfoque educativo y de salud con evidencia: dimensiones, desarrollo psicosexual por etapas,
    educación sexual integral, consentimiento, salud sexual y reproductiva (NOM-047, ITS con datos oficiales), diversidad
    con respeto, violencia y cómo pedir ayuda. Sin contenido explícito; apto para docentes y familias.
12. **Coaching Profesional.** Competencias del coach (basado en el marco de competencias de la ICF, sin afirmar
    acreditación), escucha, preguntas poderosas, GROW, metas, acuerdos, ética, coaching de equipos, límites con la
    terapia. Fuera: PNL sin evidencia y pseudoterapias.
13. **Mantenimiento Industrial y TPM.** Correctivo, preventivo, predictivo, los 8 pilares de TPM, OEE, análisis de
    fallas, RCM básico, lubricación, planeación, LOTO y seguridad (NOM-004-STPS, verificar). Retos de Excel (OEE, MTBF/MTTR).
14. **Finanzas y Administración para PyME.** Modelo de negocio, costos y precio, punto de equilibrio, flujo de efectivo,
    estados financieros básicos, crédito, cobranza, inventarios, nómina básica, obligaciones fiscales (remitir a
    Contabilidad/RESICO y verificar SAT). Retos de Excel.
15. **Bienestar Laboral, Estrés y Mindfulness.** Estrés y burnout (CIE-11), mindfulness con evidencia (MBSR/MBCT)
    y sus límites, sueño, pausas, programas de bienestar en la empresa ligados a la NOM-035. No es tratamiento.

## Giros de empresa a los que se recomienda cada uno (`giros` en meta.json)
Entra como 3.er programa del giro en el guion de llamada, los correos y el WhatsApp a prospectos. Ajusta si al
escribirlo ves que no encaja; usa los nombres exactos de `INSTRUCCIONES.md`.

| id | giros |
|---|---|
| d-calidad-lean | Manufactura de calzado; Curtiduría / proveeduría de piel; Industria / manufactura |
| d-datos-ia | Despacho contable / fiscal; Industria / manufactura; Coworking / oficinas ejecutivas; Agencia de marketing digital |
| d-ventas-experiencia | Concesionaria automotriz; Inmobiliaria; Aseguradora / agencia de seguros; Boutique de ropa; Hotelería; Call center |
| d-proteccion-civil | Manufactura de calzado; Curtiduría / proveeduría de piel; Industria / manufactura; Hotelería; Hospital / clínica privada; Colegio privado; Residencia de adultos mayores; Seguridad privada |
| d-intervencion-crisis | Consultorio de psicología; Hospital / clínica privada; Colegio privado; Funeraria |
| d-psicologia-organizacional | Reclutamiento / capital humano; Consultorio de psicología; Industria / manufactura |
| d-docencia-nem | Colegio privado |
| d-adicciones | Consultorio de psicología; Hospital / clínica privada; Colegio privado |
| d-crianza-positiva | Centro de terapia infantil / neurodesarrollo; Colegio privado; Consultorio de psicología |
| d-estimulacion-temprana | Centro de terapia infantil / neurodesarrollo; Colegio privado |
| d-sexualidad-humana | Colegio privado; Consultorio de psicología |
| d-coaching | Coworking / oficinas ejecutivas; Reclutamiento / capital humano; Consultorio de psicología |
| d-mantenimiento-tpm | Manufactura de calzado; Curtiduría / proveeduría de piel; Industria / manufactura |
| d-pyme | Boutique de ropa; Coworking / oficinas ejecutivas; Despacho contable / fiscal |
| d-bienestar-laboral | Call center; Hospital / clínica privada; Reclutamiento / capital humano; Industria / manufactura |

## Cómo se publica una tanda
1. PR de `tanda-diplomados-nov-2026` a `main` y merge (método *merge*, no squash: la rama sigue viva).
2. En Supabase → SQL Editor: ejecutar `backend/diplomados-nuevos-202610.sql` (se puede repetir). Carga los diplomados,
   su número de lecciones (regla del 50 % para reseñas) y su recomendación por giro a los prospectos.
3. Comprobar: `select id, horas, precio, lecciones, publicado from cursos where id in (…);` y
   `select segmento, cursos_ids from prospectos where segmento = 'Industria / manufactura' limit 3;`
4. El sitio, el aula, los combos de Empresas y del operador toman el catálogo solos; no hay que tocar nada más.

## Procedimiento de cada día (lo sigue la tarea programada)
1. Clonar el repo, `git fetch origin main`, cambiar a `tanda-diplomados-nov-2026` y traer `main` encima
   (`git merge origin/main`; si hay conflicto en archivos generados, regenerar con los meta de la rama).
2. Tomar el primer diplomado de la tabla con Estado «Pendiente» cuya carpeta no exista todavía (desde el 28 oct: primero la tabla de la Tanda 2, #16-27, y luego los pendientes de la tabla de #1-15).
3. Investigar (WebSearch/WebFetch) temarios de los mejores programas del mercado, evidencia y datos de México.
4. Escribir `meta.json` (con `"precio"`, `"area"` y `"giros"` de las tablas, más `"tema"` y `"dificultad"`) y `m1-2.json` … `m7-8.json` según `INSTRUCCIONES.md`.
   Clasificación desde el 26 oct (`plataforma/taxonomia.js`): `area` = una de las 11 áreas (o la «Área nueva» de la tanda 2),
   `tema` = uno de los temas de esa área en `taxonomia.js` (o uno nuevo y claro, p. ej. «Repostería»), `dificultad` =
   `desde_cero` | `intermedio` | `profesional` (nivel de entrada). Para los #3-15 usa el área equivalente nueva
   (p. ej. «Liderazgo y RH», «Psicología y terapia», «Cuidado, infancia y educación»). `crear-diplomado.js` (en main desde
   el 26 oct; trae `main` a la rama) los escribe en el SQL y en el sitio.
5. `node herramientas/crear-diplomado.js herramientas/diplomados-nuevos/<id> --simular` → sin errores, ≥ 30 h.
6. Revisión V10 por un agente experto independiente que no escribió el contenido; corregir todo lo que señale.
7. `node herramientas/crear-diplomado.js herramientas/diplomados-nuevos/<id>` (sin --simular) y
   `node herramientas/validar-diplomado.js <id>` → V3 a V9 sin fallas. Correr `node herramientas/auditoria.js`.
8. Marcar el Estado como «Listo en rama (fecha)» en esta tabla, anotar al final los datos para revisión de experto,
   commit y `git push`.

## d-calidad-lean: datos para revisión de experto
- ISO 9001:2026 (6.ª ed., publicada el 16 sep 2026): confirmar contra el texto oficial los números de subcláusula citados (6.1.2/6.1.3 riesgos y oportunidades, 6.3 planificación de cambios, 9.2.2 objetivo de cada auditoría, redacción de 7.5 información documentada) — se confirmaron sólo con fuentes secundarias.
- Plazo de transición 2015→2026 («unos tres años», sujeto al IAF y al organismo certificador) y si ya existe NMX-CC-9001-IMNC versión 2026 en el Catálogo Mexicano de Normas. Estado de actualización de IATF 16949.
- ISO 19011:2026 (mayo 2026) y principios de auditoría mencionados (integridad, presentación imparcial, enfoque basado en evidencia).
- Tabla de Prioridad de Acción AIAG-VDA (2019) usada en el ejemplo de AMEF del M8 (S10-O4-D2 = alta; S3-O6-D6 = baja; quiz: 9-4-3 alta, 4-6-7 media) contra el manual impreso.
- Criterio de Cpk 1.33 / 1.67 (en PPAP el 1.67 suele pedirse como Ppk preliminar; depende del cliente). Criterios de %R&R de AIAG (<10 %, 10-30 %, >30 %) y el uso de 6σ.
- Requisitos vigentes de ASQ, IASSC (cintas) y CQI/IRCA (cursos de auditor), citados sólo como ejemplo, sin afirmar acreditación.
- M1 quiz 1 y lab M4: contenido neto declarado como requisito legal (posible NOM-030-SCFI-2006; confirmar vigencia).
- Referencias: editorial y año de la edición en español de Shingo (*Una revolución en la producción: El sistema SMED*: Productivity Press o TGP Hoshin) y de Rother y Shook (*Observar para crear valor*, LEI, 1999); URL de la Ley de Infraestructura de la Calidad en diputados.gob.mx (LICal.pdf).
- Convenciones: calibración como costo de evaluación (algunos autores la ponen en prevención); fórmulas de Excel en español con coma como separador (nota para punto y coma).

## d-datos-ia: datos para revisión de experto
- Categoría: se usó `familia` «Tecnología» y `area` «Tecnología e IA» (las mismas de Excel Avanzado y Power BI en el sitio).
- Nueva LFPDPPP (DOF 20 mar 2025; reforma del 14 nov 2025): confirmar contra el texto vigente los plazos ARCO (20 + 15 días hábiles, ampliables una vez), el consentimiento «expreso y por escrito» para datos sensibles, el alcance del derecho a oponerse a decisiones automatizadas («que afecten de forma significativa»), multas en UMA y que la autoridad sea la Secretaría Anticorrupción y Buen Gobierno. Revisar la URL de diputados.gob.mx (LFPDPPP.pdf) de la referencia. M7: entregar datos a un proveedor de IA como tratamiento/remisión; matiz del RFC de persona moral (confidencial, no dato personal).
- Ley de IA en México: a oct 2026 no hay ley general aprobada (solo iniciativas); el texto dice «verifica su estado actual».
- Cifras de estudios: Brynjolfsson, Li y Raymond (QJE 2025: +14 % casos/hora, +34 % novatos, impacto mínimo en expertos); Dell'Acqua et al. (HBS WP 24-013: 758 consultores; +12.2 % tareas, 25.1 % más rápido, >40 % calidad; −19 puntos fuera de la frontera). Dell'Acqua et al. ya estaría publicado en *Organization Science* (2026): decidir si se cita la versión publicada. Brynjolfsson, Hitt y Kim (2011: 5-6 %, 179 empresas).
- Rutas de menú en Excel 365 en español (Datos > Obtener datos > Del archivo > De la carpeta; Combinar y transformar datos; Vista > Calidad/Distribución/Perfil de columnas con las primeras 1 000 filas; Insertar > Tabla dinámica > Del modelo de datos; Agregar medida; Análisis de hipótesis > Tabla de datos; Hoja de previsión) y en Power BI (Formato > Editar interacciones, actualización programada y puerta de enlace, seguridad a nivel de fila, licencias para compartir). Separador de argumentos en DAX según configuración regional; que Combinar consultas distinga mayúsculas.
- DAX: DIVIDE devuelve vacío con denominador cero; SAMEPERIODLASTYEAR con calendario completo marcado como tabla de fechas; `CALCULATE(COUNTROWS(Atenciones), Atenciones[Dentro de meta] = TRUE())` con columna de tipo verdadero/falso; DISTINCTCOUNT.
- Estadística (recalculada con python por el revisor): margen ≈0.98/√n; diferencia de dos grupos de 400 = ±6.9; caso Wendy (55 % vs 70 %, n=120) ±12.1; caso Tomás (45 % vs 38 %, n=300) no significativo; 3.0 % vs 3.1 % con 500,000 visitas z≈2.9; ~820 por grupo para 18 %→13 % con 80 % de potencia; regla de 1.5 RIC para atípicos.
- Regresión agrícola (M6): pendiente ficticia de ~12 kg de grano por kg de nitrógeno en maíz de riego en Sinaloa (120-240 kg N/ha): que un agrónomo confirme que es verosímil.
- Atribuciones: Goodhart (1975) y formulación de Marilyn Strathern; Berkeley 1973 (Bickel et al., 1975); Anscombe (1973); Abraham Wald y sesgo de supervivencia; premortem (Gary Klein); Cleveland y McGill (posiciones vs ángulos, sin citar); Cairo, Tufte, Knaflic, Minto. Caso de herramienta de selección abandonada en 2018 (Reuters), sin nombrar la empresa.
- Fecha fija en M4 L3 y lab M4 («si hoy es 26 de octubre…»), usada como ejemplo de periodos a la fecha; ejemplos de Buen Fin y Semana Santa como periodos no equivalentes.
- Herramientas: se corrigieron `herramientas/validar-diplomado.js` (V3 y V9) y `herramientas/auditoria.js` para el aula rápida (ya no cuentan `indice.js` como fuente duplicada y V9 verifica `indice.js`, `contenido/<id>.js` y que el aula no cargue fuentes directas). Las fallas «texto provisional» de la auditoría son previas (d-nom035, d-recursos-humanos, c-power-bi, d-tcc, c-aleman-a1, c-ia-programadores).

## d-ventas-experiencia: datos para revisión de experto
- Categoría: `familia` «Negocios y finanzas», `area` «Ventas y marketing», `tema` «Ventas y atención», `dificultad` «desde_cero» (mismo tema que «Atención al cliente y ventas»; este es el diplomado de 30 h, con B2B, embudo, CRM y CX).
- LFPC (última reforma al texto: DOF 12 dic 2025): confirmar contra el texto vigente lo que se dice de los arts. 7 Bis (monto total visible), 10 (prácticas coercitivas, servicios y cargos no solicitados), 18 y 18 Bis (REPEP; plazo de 30 días tras inscribirse, ¿naturales?), 32 (información veraz; aplicado a reseñas falsas o compradas), 56 (5 días hábiles desde la entrega o la firma, lo último; excepción de servicios a ≤10 días hábiles; quién paga flete y seguro al revocar; caso de paneles solares firmados en casa en M5 L3) y 76 Bis fracc. VIII-IX (aviso ≥5 días naturales antes de renovación automática, cancelación inmediata; confirmar su alcance fuera del comercio electrónico).
- Teléfonos: Profeco 55 5568 8722 / 800 468 8722; REPEP 55 9628 0000 / 800 962 8000; Concilianet; REUS de Condusef (si aplica a agentes de seguros además de aseguradoras, Lab M1).
- LFPDPPP (DOF 20 mar 2025): aviso de privacidad, ARCO y uso de bases de datos de terceros en el CRM (M2 L2, M6 L2).
- Gartner: 17 % del tiempo de compra con proveedores (fuente sin año en los resúmenes) y encuesta de 632 compradores (ago-sep 2024; nota de prensa del 25 jun 2025): 61 % prefiere comprar sin vendedor, 73 % evita mensajes irrelevantes, 69 % halló contradicciones entre sitio y vendedores. Seis tareas de compra.
- Rackham (1988): ~35,000 encuentros, 12 años, >20 países; hallazgos citados sin porcentajes (implicación y necesidad-beneficio; cierres clásicos rinden peor en ventas grandes; avances vs continuaciones). Dixon y Adamson: >6,000 vendedores, cinco perfiles, límites del estudio; afirmación de M3 L4 de que la consultora después vendió capacitación sobre el modelo.
- Reichheld y Sasser (1990): −5 puntos de deserción → +25 a 85 % de utilidades según industria. Keiningham et al. (2007): 21 empresas noruegas, >15,500 entrevistas. De Matos et al. (2007): efecto en satisfacción, no en recompra, boca a boca ni imagen. Scheibehenne et al. (2010): efecto promedio de sobrecarga de opciones cercano a cero.
- Convenciones: CSAT como % de 4 y 5 en escala 1-5; CES en escala 1-7 (hay varias versiones); velocidad de ventas, cobertura (~3 veces) y valor de vida simple presentados como heurísticas. Fórmulas de Excel en español con coma (CONTAR.SI.CONJUNTO, PROMEDIO.SI, SI.ERROR).
- Referencias: subtítulo exacto y año de «El vendedor desafiante» (Empresa Activa, 2012) y de «La pregunta decisiva 2.0» (LID, 2012); páginas de Dixon, Freeman y Toman (HBR, 2010).


## d-cocina-negocio: datos para revisión de experto
- Categoría: `familia` «Negocios y finanzas», `area` «Cocina y gastronomía» (área nueva, icono 🍳 ya en taxonomia.js), `tema` «Cocina y repostería para emprender», `dificultad` «desde_cero». Giros: Restaurante; Cafetería; Panadería / repostería (los tres de la tabla).
- NOM-251-SSA1-2009 (vigente en el Catálogo Mexicano de Normas al 2 nov 2026): refrigeración ≤ 7 °C (5.5.2), recepción de refrigerados ≤ 4 °C, calientes > 60 °C y fríos ≤ 7 °C (7.3.3), cocción 63/68/74 °C (7.3.1), recalentar ≥ 74 °C (7.3.2), descongelar nunca a temperatura ambiente (7.4.1). La NOM no fija cifra de congelación (−18 °C se da como referencia de capacitación). Zona de peligro según USDA FSIS (4.4-60 °C; 2 h, 1 h si hace más de 32 °C).
- NOM-051 (modificación DOF 27 mar 2020): solo preenvasados; excluye granel y envasado en el punto de venta. Confirmar los casos frontera usados: cheesecake en vasos cerrados y polvorones en bolsa para tienda (M4), frascos de salsa y bolsas selladas de chicharrones (M7) como preenvasados; pan de vitrina empacado al momento y salsa en vasitos con la orden como excluidos. Lista de alérgenos (4.2.2.2.3) y sulfitos ≥ 10 mg/kg. Que «sin conservadores» con benzoato de sodio sea publicidad engañosa.
- IVA: los ejemplos calculan con 16 % (÷ 1.16) para practicar, con nota de que ciertos panes o pasteles enteros para llevar pueden tener tasa 0 %: confirmar con un contador y ajustar el texto de M5 L3 si conviene.
- SAT: tope RESICO 3.5 millones (2026), factura global a público en general para RESICO, y que las retenciones de plataformas cambiaron en 2026 (se citan sin tasas). Aviso de funcionamiento (LGS art. 200 Bis) ante COFEPRIS o la COPRIS estatal; reglas para vender desde casa por estado y municipio.
- LFPDPPP citada como la publicada en el DOF el 20 mar 2025, sin artículos. LFPC: precio total, propina voluntaria. Referencia de la LFPC y de la LGS quedaron «con reformas» (sin fecha de última reforma).
- Ciencia de repostería y defectos (Gisslen, McGee): pastel hundido, galleta que se extiende, pan denso, cheesecake agrietado; retrogradación del pan en refrigerador; la papa no desala un guisado. Tiempos ficticios de ejemplo (flan a 160 °C ~60 min; galletas 170 °C ~14 min; vaporera de tamales ~90 min) y proporciones de recetas plausibles, no probadas.
- Kasavana y Smith (1982): línea de popularidad al 70 % de la participación esperada y margen promedio ponderado. Comisiones de apps (20-30 %) y cuotas de bazar son ficticias. Datos agregados por los autores: Condusef para comparar créditos (CAT) y alerta por créditos que piden depósito previo; alta en el IMSS al contratar ayuda.
- Referencias: ISBN de la edición en español del manual de las cinco claves de la OMS (9789243594637) en lugar del de inglés; URL de la modificación de la NOM-051 en dof.gob.mx.

## d-manejo-alimentos: datos para revisión de experto
- Categoría: `familia` «Negocios y finanzas», `area` «Cocina y gastronomía», `tema` «Inocuidad y manejo higiénico de alimentos», `dificultad` «desde_cero», precio 1890. Giros: Restaurante; Hotelería; Comedor industrial / catering; Hospital / clínica privada (los cuatro de la tabla).
- NOM-251-SSA1-2009: vigente en Platiica (revisión sistemática del 7 ene 2025: confirmación; sin proyecto de modificación). Confirmar contra el texto oficial los numerales citados: 5.5.1 (HACCP voluntario salvo norma específica), 5.5.2 (≤ 7 °C), 5.5.3 (congelación sin cifra), 5.4.3 (tarimas; los 15 cm son buena práctica), 5.6.7 tabla 1 (recepción ≤ 4 °C, signos de descongelación), 7.4.2 (pescado ≤ 4 °C / ≤ −9 °C), 7.3.1-7.3.3, 7.4.1 y 7.4.1 f, 7.4.4, 7.5 (loza 75-82 °C ≥ 30 s), 5.8, 5.10, 5.12.1, 5.12.4, 5.14, 6.6.1 (fábricas, 1.5 veces la vida de anaquel), 6.8.1 y 7.6.2. Que la 251 canceló NOM-093 y NOM-120 y que aún remite a la NOM-127 de 1994 (hoy NOM-127-SSA1-2021). Si exige registro formal de la capacitación anual en servicio de alimentos.
- Distintivo H: NMX-F-605-NORMEX-2018 (declaratoria DOF 13 ago 2019). Curso de 10 h, vigencia de 1 año y consultores registrados ante SECTUR se confirmaron solo con fuentes secundarias (el texto dice «suele incluir» y «confirma en sectur.gob.mx»). No se dan calificación mínima, costos ni lista de puntos críticos.
- OMS (comunicado 4 jun 2026, datos 2021): 866 millones de enfermedades, 1.5 millones de muertes, menores de 5 años = 9 % de la población y casi un tercio de los casos, 73 % de las muertes por peligros químicos. Cifras de 2015 solo como histórico.
- FDA Food Code 2026 (17 sep 2026): enfriamiento en dos etapas 57→21 °C en 2 h y 21→5 °C en 4 h; política escrita de empleados enfermos; 50 ppm mínimo de cloro para sanitizar (modelo FDA). USDA-FSIS: zona de peligro 4.4-60 °C (2 h / 1 h > 32 °C); temperaturas internas 74/71/63 °C; estudio de 2019 sobre lavar pollo (60 % y 26 %). Miranda y Schaffner (2016), regla de los 5 segundos. CDC: gel ≥ 60 % alcohol no sustituye agua y jabón; 20 s de tallado.
- Diluciones (M4 L3, M8): fórmula mL = ppm × litros ÷ (% × 10), recalculadas por el revisor (p. ej., 15 L a 100 ppm con cloro al 6 % = 25 mL; 5 L a 200 ppm al 5 % = 20 mL). La NOM-251 no fija ppm: el texto dice que manda la etiqueta y que se comprueba con tira reactiva.
- Criterios de juicio (buenas prácticas, no norma): exclusión en dos niveles (diarrea, vómito, fiebre, ictericia → a casa; tos o secreción → reubicar sin contacto con alimentos) y regreso; refrigeradores entre 1 y 4 °C; recipientes de 5-10 cm para enfriar; desechar ante enfriamiento fallido; recalentar o desechar comida transportada que llega bajo 60 °C; «dos o más personas con síntomas parecidos tras comer lo mismo» como posible brote; desinfección de verduras como PCC o prerrequisito según el enfoque; orden del refrigerador (cerdo en trozo junto a la res).
- Visita sanitaria (M8 L2): orden de visita, acompañar, observaciones en el acta, copia del acta y «el plazo que indique el acta»; firmar no implica aceptar todo. Que lo confirme un abogado administrativo. Denuncia sanitaria sin teléfono («verifica el canal vigente en gob.mx/cofepris»). Art. 200 Bis LGS (aviso de funcionamiento).
- Alérgenos: lista de la NOM-051 (4.2.2.2.3; verificar numeración tras la modificación de 2020); señales de anafilaxia y apoyo con autoinyector (M7 L1).
- Referencias: URLs de sidof.segob.gob.mx (5133449, 5567750), fsis.usda.gov/es/node/3293 y la página del Food Code 2026; fechas DOF de NOM-201 (22 dic 2015) y NOM-256 (29 ene 2013); título exacto en español del CXC 80-2020.

## d-emprender-cero: datos para revisión de experto
- Categoría: `familia` «Negocios y finanzas», `area` «Emprendimiento y negocio propio» (icono 🚀), `tema` «Emprender desde cero», `dificultad` «desde_cero», precio 1690, giros [] (la tabla dice «—»). Es el diplomado base de la tanda 3: remite a «Contabilidad Básica, RESICO y Facturación CFDI 4.0» (impuestos y facturación a detalle) y a «Marketing Digital y Redes Sociales» (anuncios).
- INEGI: Censos Económicos 2024 definitivos (micro = 95.4 % de las unidades y 41.4 % del personal ocupado; el plan decía 95.5 %); EDN 2023 (1.7 millones de nacimientos y 1.4 millones de muertes, may 2019-may 2023); esperanza de vida de 7.7 años y supervivencia al primer año de 0.64 (dato publicado en 2015, presentado como histórico); ENAPROCE 2018 (7.6 % de las micro con financiamiento). Confirmar URL de los boletines.
- RESICO 2026: tope $3.5 millones; tabla mensual 1 %-2.5 % aplicada a todo lo cobrado en el mes según el tramo. Reforma que sube el tope a $5 millones para 2027: aprobada en el Congreso en oct 2026, sin publicar en el DOF al 3 nov 2026 → al publicarse, actualizar M7 L1, su clave 2 y la pregunta 2 del quiz M7.
- Plataformas digitales 2026: retención de ISR de 2.5 % con RFC; 20 % de ISR y 100 % de IVA sin RFC (fuentes secundarias). Constancia de situación fiscal no requerida para facturar (SAT 2026). Datos que se piden al cliente para CFDI 4.0 (RFC, nombre, código postal, régimen).
- Aviso de funcionamiento (LGS art. 200 Bis): que es aviso sin visita previa; casos de cosméticos artesanales y de alimentos envasados que se revenden. SARE y permisos municipales presentados en general («verifica en tu municipio»).
- IMPI: unos $3,100 por clase (2026) y vigencia de 10 años. LFPC arts. 7 Bis, 32 y 77 (garantía mínima de 90 días). Nueva LFPDPPP (aviso de privacidad, sin artículos). IMSS: inscripción en no más de 5 días hábiles (LSS art. 15, fr. I), sin excepción por periodo de prueba ni parentesco. NOM-035 básica para centros pequeños.
- Comisiones de terminal (Banxico, jul 2026: crédito 2-3.5 %, débito 1.5-2.5 %; los ejemplos no suman el IVA de la comisión); CoDi sin comisión adicional; DiMo. CAT de los ejemplos ficticio; pagos calculados con PAGO a tasa nominal.
- Evidencia: Camuffo et al. (2020, 116 startups italianas, sin cifras de ingresos); Cooper, Woo y Dunkelberg (1988: 81 %, 33 %, 39 %); CB Insights (111 cierres de startups tecnológicas: 38 % sin dinero, 35 % sin necesidad de mercado, 19 % modelo defectuoso); «métricas de compromiso» atribuidas a Fitzpatrick; términos de la edición en español de Osterwalder (trabajos, frustraciones, alegrías, aliviadores, creadores de alegrías); efectuación de Sarasvathy.
- Criterios didácticos (no normas): pérdida asumible = ahorro menos un fondo de tres meses de gastos; colchón de tres meses de gastos fijos; depósito de renta como inversión de apertura (no capital de trabajo); tasa de IVA de dulces y refrescos en el lab de M7 se deja para que el alumno la investigue.

## d-tienda-abarrotes: datos para revisión de experto
- Categoría: `familia` «Negocios y finanzas», `area` «Emprendimiento y negocio propio», `tema` «Tienda de abarrotes y minisúper», `dificultad` «desde_cero», precio 1690, giros [] (la tabla dice «—»). Remite a «Emprender desde Cero» (alta en el SAT, IMSS), a «Contabilidad Básica, RESICO y Facturación» y no repite el curso de Logística ni el diplomado de Inocuidad.
- INEGI, Censos Económicos 2024 definitivos: clase «tiendas de abarrotes, ultramarinos y misceláneas» = la de más personal ocupado (1,191,398 personas en 2023); +81,500 unidades 2018-2023; agregado abarrotes y alimentos 1,063,448 establecimientos; micro 95.4 %. Falta el total de unidades de la clase 461110 (no se usó). Confirmar URL de CE2024_def_RR.pdf y de ENIF2024_CP.pdf (37.3 % con crédito formal).
- IVA (LIVA 2-A): 0 % a la mayoría de alimentos, hielo y dulces; 16 % a bebidas distintas de la leche, chicles, alimento procesado para mascotas, limpieza e higiene; agua en envase < 10 L a 16 % (garrafón 0 %) y botanas quedaron como «pregunta a tu contador»: confirmar. Que un tendero en RESICO que cobra IVA lo acredite con facturas de compra, el IVA de la comisión de la terminal y la nota de crédito del proveedor como CFDI de egreso.
- IEPS 2026 (DOF 7 nov 2025): $3.0818/L bebidas con azúcar, $1.50/L con edulcorantes, 8 % alimentos ≥ 275 kcal/100 g; que el revendedor normalmente no lo desglosa. RESICO: tope 3.5 millones, 1-2.5 %, día 17, factura global (verificar).
- LFPC 7 Bis (precio total, sin recargo por tarjeta) y criterio de Profeco sobre cobrar más que el precio impreso; NOM-010-SCFI-1994 y calendario de verificación de básculas 2026; teléfono Profeco 800 468 8722.
- Tabaco: LGCT art. 16 (cajetillas de 14 a 25, nada de sueltos ni autoservicio, menores) y Reglamento (DOF 16 dic 2022: prohibición de exhibir; amparos vigentes). Vapeadores: reforma constitucional (DOF 17 ene 2025) y LGS (DOF 15 ene 2026), sanciones penales descritas en general. Alcohol: LGS art. 220. Medicamentos de venta libre fuera de farmacia (M2 L1; art. 226 fr. VI LGS, sin citar).
- Aviso de funcionamiento para abarrotes (lista COFEPRIS, confirmar por estado, sobre todo si rebanan carnes frías o venden a granel). NOM-251: ≤ 7 °C, PEPS y limpieza separada; regla de tienda de retirar productos con consumo preferente vencido («verifica el criterio de Profeco»).
- Evidencia: Gruen, Corsten y Bharadwaj (2002: 8.3 % faltantes; 31 % otra tienda, 26 % otra marca, 9 % no compra); NRF (2023: merma 1.6 % de ventas en 2022, ~65 % por robo; dato de EE. UU.); Underhill (sin cifras). Referencia de Lewison (1999), *Ventas al detalle*, Prentice Hall: confirmar edición.
- Competencia: caso de 2005 contra embotelladoras (CFC, RA-30-2005; amparo SCJN 2010) y que hoy la autoridad sea la Comisión Nacional Antimonopolio. Laboral: «cohecho, delito para ambas partes» (M7 L1) y «la ley limita los descuentos al salario» (M7 L4), sin artículos.
- Convenciones didácticas (no normas): márgenes objetivo por categoría (8-12 % tráfico, 18-22 % rutina, 25-35 % impulso), semáforo de caducidades (secos 60/30 días, lácteos 5/2), comisiones de terminal de 2-3.5 % y de pago de servicios ficticias, cifras de luz ficticias (tarifa PDBT < 25 kW). «WhatsApp» queda en el título de M8 L2.

