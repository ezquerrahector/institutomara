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
| 2 | d-datos-ia | dat | Diplomado en Análisis de Datos e Inteligencia Artificial para Tomar Decisiones | 1890 | Tecnología | Pendiente |
| 3 | d-ventas-experiencia | vtp | Diplomado en Ventas Profesionales y Experiencia del Cliente | 1690 | Negocios y finanzas | Pendiente |
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
2. Tomar el primer diplomado de la tabla con Estado «Pendiente» cuya carpeta no exista todavía.
3. Investigar (WebSearch/WebFetch) temarios de los mejores programas del mercado, evidencia y datos de México.
4. Escribir `meta.json` (con `"precio"`, `"area"` y `"giros"` de las tablas) y `m1-2.json` … `m7-8.json` según `INSTRUCCIONES.md`.
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
