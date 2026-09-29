# Cómo escribir un diplomado nuevo de Instituto Mara (formato «Persuasión ética», 30 h)

Tu trabajo es ESCRIBIR EL CONTENIDO de un diplomado de máxima calidad en una especificación JSON. El generador
(`herramientas/crear-diplomado.js`) arma con ella las lecciones, los repasos, los laboratorios, los mapas visuales,
el cuaderno PDF y todo lo demás. NO edites nada en plataforma/, sitio-web/ ni backend/.

## Quién estudia y qué debe sentir
Adultos mexicanos de 22 a 55 años que estudian desde el celular, sin formación previa en el tema. Al terminar deben sentir
que valió la pena: que aprendieron cosas que no sabían, que ya pueden HACER algo nuevo, que el contenido es serio, actual,
basado en evidencia y aplicable a su vida en México. Tono: cálido, claro, directo, trato de «tú», español de México,
sin tecnicismos sin explicar, sin relleno motivacional, sin promesas exageradas.

## Investigación primero
Antes de escribir, investiga con WebSearch/WebFetch el estado actual del tema: autores de referencia, evidencia científica,
qué enseñan los mejores cursos y diplomados del mercado (temarios de universidades y plataformas), mitos frecuentes y
datos de México (leyes, instituciones, teléfonos) cuando apliquen. Usa esa investigación para que el temario sea igual o
mejor que lo mejor del mercado. Nada de datos inventados: ni cifras, ni estudios, ni citas textuales, ni artículos de ley.
Si un dato cambia seguido, dilo con «verifica la versión vigente en…». Separa claramente lo que tiene evidencia de lo que
es popular pero no tiene respaldo (y desmiente los mitos).

## Estructura obligatoria (8 módulos × 4 lecciones + reto + laboratorio + evaluación)
- 8 módulos que progresen de fundamentos a aplicación avanzada; el módulo 8 integra todo y su laboratorio es el PROYECTO FINAL
  (4 partes que retoman los módulos 1-2, 3-4, 5-6 y 7-8).
- Cada lección: 3-4 párrafos de explicación (en total 250-400 palabras, con ideas concretas, ejemplos y matices),
  «así no / así sí», un caso ficticio con nombre y lugar de México, 3 preguntas de decisión, un completar, práctica escrita,
  modelo de respuesta, plantilla lista para usar y 2-3 ideas clave. Al menos 2 lecciones por módulo con relacionar.
- Reto del módulo (90 min) con entregable y criterios de autoevaluación.
- Laboratorio: situación inicial + 4 escenas con consigna escrita + 3 preguntas de revisión + plantilla.
- Evaluación del módulo: 10 preguntas de 4 opciones, de APLICACIÓN (casos), no de memoria literal.

## Formato de archivos
Escribe en `herramientas/diplomados-nuevos/<id>/`:
- `meta.json`:
```json
{ "id": "d-…", "pref": "ab", "nombre": "Diplomado en …", "color": "#RRGGBB", "familia": "Desarrollo humano",
  "desc": "250-700 caracteres: qué aprenderás, cómo (casos, 8 laboratorios, proyecto final, cuaderno PDF) y para quién.",
  "aprender": ["6-8 resultados de aprendizaje concretos, con verbo de acción"],
  "aviso": "(opcional) alcance y límites éticos o profesionales del diplomado, en 2-3 frases",
  "referencias": ["8-15 referencias en APA 7 en español: libros, artículos y fuentes oficiales reales y verificables"] }
```
- `m1-2.json`, `m3-4.json`, `m5-6.json`, `m7-8.json`, cada uno `{ "modulos": [ módulo, módulo ] }` con:
```json
{ "t": "Título del módulo", "r": "Resumen de 1-2 frases",
  "lecciones": [ {
     "t": "Título de la lección", "obj": "Objetivo: qué podrás hacer (una frase)",
     "texto": ["párrafo 1 (puede usar <b> e <i>)", "párrafo 2", "párrafo 3"],
     "comparar": ["«Así no: frase o conducta realista»", "«Así sí: frase o conducta realista»"],
     "caso": "Caso ficticio: Nombre, contexto en una ciudad de México, situación concreta con un dilema.",
     "p": [ ["Pregunta sobre el caso", "respuesta correcta", "distractor plausible", "distractor plausible", "explica: por qué la correcta es mejor y qué falla en las otras"], […], […] ],
     "completar": ["Frase con ___ para la palabra clave de la lección.", "palabra"],
     "relacionar": [["concepto","aplicación"], … 4-5 pares, derechas distintas] ,   // opcional, ≥2 por módulo
     "refl": "Consigna de práctica escrita (20 min) aplicada a la vida o el trabajo de la persona, con partes claras.",
     "modelo": "Ejemplo de respuesta bien hecha (60-120 palabras) y qué la hace buena.",
     "plantilla": ["Rótulo", "Texto con [campos] para copiar y usar; puede tener saltos \n"],
     "clave": ["idea clave 1", "idea clave 2"] } × 4 ],
  "reto": { "texto": "Qué hacer en 90 min", "entregable": "Qué produce", "criterios": "Revisa: criterio 1, criterio 2, criterio 3 y criterio 4." },
  "lab": { "t": "Título del laboratorio", "obj": "objetivo", "esc": "Situación inicial (2-4 frases, con <b>nombre</b> y ciudad)",
           "e": [["Escena 1: lo que pasa", "Consigna: qué escribes o decides"], … 4],
           "p": [["Pregunta", "correcta", "distractor", "distractor", "explica"], … 3],
           "pl": ["Rótulo de la plantilla", "texto"] },
  "quiz": [ ["Pregunta de aplicación", "correcta", "distractor", "distractor", "distractor"], … 10 ] }
```

## Reglas de calidad (se validan automáticamente; si fallan, corrige)
- La respuesta correcta NO debe ser sistemáticamente la más larga: iguala la longitud de las opciones (máx. 55 % de
  preguntas con la correcta como la más larga). Distractores plausibles, nada absurdo ni obvio.
- La palabra del completar debe aparecer en el texto de la lección.
- Sin comillas dobles rectas dentro de los textos: usa «». Sin «TODO», sin texto en inglés salvo términos técnicos explicados.
- Acentos y ortografía impecables. No repitas oraciones entre lecciones.
- Casos variados (edades, ciudades, oficios, géneros); nada de estereotipos; nada de marcas registradas en los casos.
- Ética: no enseñes a manipular, engañar, acosar ni dañar; cuando el tema toque riesgo (violencia, crisis, delitos), incluye
  cómo pedir ayuda (911; Línea de la Vida 800 911 2000) y los límites de lo que el diplomado habilita (no sustituye a un
  profesional con cédula, no certifica peritos, etc.).

## Validación que tú mismo corres (repite hasta que pase)
1. `node herramientas/crear-diplomado.js herramientas/diplomados-nuevos/<id> --simular`  → sin errores y estimado ≥ 30 h.
2. Relee todo el contenido como si fueras el alumno más exigente y como si fueras un experto del tema: corrige errores de
   concepto, datos dudosos, ambigüedades en preguntas, distractores que también podrían ser correctos, repeticiones y tono.
NO ejecutes sin --simular. Al terminar, responde con la línea de la simulación, el temario (títulos de módulos y lecciones)
y una lista de los datos o afirmaciones que convenga que un experto verifique.
