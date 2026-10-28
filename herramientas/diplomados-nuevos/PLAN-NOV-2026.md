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
| 3 | d-ventas-experiencia | vtp | Diplomado en Ventas Profesionales y Experiencia del Cliente | 1690 | Negocios y finanzas | Listo en rama (2026-10-28) |
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

Al terminar el #15, la tarea sigue con esta tabla en el mismo orden y con el mismo procedimiento. Objetivo: abrir
categorías nuevas en el sitio para que quien busca cursos encuentre temas que hoy no tenemos (cocina, contenido,
oficios, salud, hogar, dinero). Todos son diplomados de 30 h (el generador `crear-diplomado.js` solo hace
diplomados). Precio sugerido abajo; Héctor puede ajustarlo en Administración.

**Área (`area` en meta.json) en esta tanda:** usa el nombre exacto de la columna «Área nueva». El sitio crea la
tarjeta sola la primera vez que aparece un área nueva (ver `AREA_VIEJA`/`ICONO_AREA` en `sitio-web/index.html`).
Desde el 26 oct el sitio usa 11 áreas: Psicología y terapia · Comunicación e influencia · Crecimiento personal ·
Liderazgo, RH y seguridad laboral · Ventas y marketing · Tecnología e IA · IA para tu profesión · Idiomas ·
Criminología y forense · Cuidado, infancia y educación · Administración y contabilidad. Para los #1-15 sigue
valiendo la `familia` de la tabla de arriba.

| # | id | pref | Programa (nombre sugerido) | Precio | Área nueva | Giros (prospectos) | Estado |
|---|---|---|---|---|---|---|---|
| 16 | d-cocina-negocio | coc | Diplomado en Cocina y Repostería para Emprender: costeo, recetas estándar y venta | 1690 | Cocina y gastronomía | Restaurante, Cafetería, Panadería | Pendiente |
| 17 | d-manejo-alimentos | mha | Diplomado en Inocuidad y Manejo Higiénico de Alimentos (NOM-251 y Distintivo H) | 1890 | Cocina y gastronomía | Restaurante, Hotel, Comedor industrial, Hospital | Pendiente |
| 18 | d-contenido-video | vid | Diplomado en Creación de Contenido y Edición de Video con el Celular | 1690 | Creatividad y contenido | Agencia de marketing digital | Pendiente |
| 19 | d-nutricion | nut | Diplomado en Nutrición y Alimentación Saludable | 1690 | Salud y nutrición | Gimnasio, Hospital, Comedor industrial | Pendiente |
| 20 | d-energia-solar | sol | Diplomado en Energía Solar Fotovoltaica: diseño, cálculo e instalación segura | 1690 | Oficios y técnica | Constructora, Instalaciones eléctricas | Pendiente |
| 21 | d-hospitalidad | hos | Diplomado en Hospitalidad y Servicio en Hoteles y Restaurantes | 1690 | Turismo y hospitalidad | Hotel, Restaurante, Agencia de viajes | Pendiente |
| 22 | d-derecho-practico | der | Diplomado en Derecho Práctico para la Vida Diaria: trabajo, renta, familia y consumo | 1690 | Dinero y derecho | — | Pendiente |
| 23 | d-finanzas-inversion | inv | Diplomado en Finanzas Personales e Inversión para Principiantes: CETES, fondos y Afore | 1690 | Dinero y derecho | — | Pendiente |
| 24 | d-perros | per | Diplomado en Cuidado, Conducta y Adiestramiento de Perros | 1690 | Hogar, familia y mascotas | Veterinaria, Estética canina | Pendiente |
| 25 | d-hogar-familia | org | Diplomado en Organización del Hogar, Rutinas y Economía Familiar | 1690 | Hogar, familia y mascotas | — | Pendiente |
| 26 | d-primeros-auxilios | pax | Diplomado en Primeros Auxilios y Respuesta a Emergencias (teórico) | 1690 | Salud y nutrición | Escuela, Guardería, Industria | Pendiente |
| 27 | d-cafe-barismo | caf | Diplomado en Café de Especialidad, Barismo y Negocio de Cafetería | 1690 | Cocina y gastronomía | Cafetería | Pendiente |

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
2. Tomar el primer diplomado de la tabla con Estado «Pendiente» cuya carpeta no exista todavía (primero la tabla de #1-15 y luego la de la Tanda 2).
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

