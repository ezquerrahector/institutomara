# Profundizar un curso de «IA para tu profesión» a 10 horas (precio igual, $590)

Meta: `node herramientas/profundizar-curso.js herramientas/profundizar/<id>.json --simular` sin errores y proporción ≥ 0.80
(estimado ≥ 8.0 h para 10 h declaradas). No pases de ~0.95. NO ejecutes sin --simular.
NO edites plataforma/, sitio-web/ ni backend/: solo creas herramientas/profundizar/<id>.json.

## Primero
1. Lee el curso completo: `node herramientas/ver-curso.js <id>` (tercer argumento = largo de cada bloque, p. ej. `node herramientas/ver-curso.js <id> . 3000`).
2. Lee `herramientas/ampliaciones-cursos/INSTRUCCIONES.md`: reglas de estilo, datos verificables y formato exacto de cada tipo de bloque (aplican igual aquí).
3. Lista las preguntas de 2 opciones: `node herramientas/profundizar-curso.js herramientas/profundizar/<id>.json --pendientes`
   (necesitas un JSON mínimo con id y horas para correrlo).

## Formato
```json
{ "id": "c-ia-contadores", "horas": 10,
  "aprender": ["1 o 2 frases nuevas para «Lo que vas a aprender»"],
  "terceras": [ { "p": "texto EXACTO de la pregunta", "op": "tercer distractor plausible, claramente incorrecto para quien estudió" } ],
  "extras": { "<id de lección existente>": [ bloques ] },
  "modulos": [
    { "t": "Casos por especialidad …", "r": "resumen de 1-2 frases", "lecciones": [ { "t": "…", "obj": "…", "bloques": [ … ] } ], "quiz": [ { "p": "…", "ops": ["a","b","c","d"], "correcta": 2 } ] },
    { "t": "Laboratorio y proyecto final", "r": "…", "lecciones": [ … ], "quiz": [ … ] } ] }
```
- `terceras`: una por CADA pregunta de 2 opciones (lecciones y evaluaciones). El distractor no debe ser absurdo ni ambiguo.
- `extras`: a las 9 lecciones existentes agrégales práctica: al menos un «Taller práctico» corto en cada una
  (titulo «Taller práctico» → destacado con caso → practica de 3 preguntas con 3 opciones y explica → comparar o relacionar/completar → reflexion aplicada).
- `modulos`: exactamente 2 módulos nuevos (quedan 5):
  - Módulo 4 — casos por especialidad o situaciones avanzadas de esa profesión (3 lecciones de 30-40 min cada una: contenido breve,
    ejemplo de prompt, errores comunes de la IA en ese campo, práctica variada, excel si tiene sentido, reflexión, plantilla, clave).
  - Módulo 5 — «Laboratorio y proyecto final»: 2 lecciones. Lección 1: simulación en 4 escenas (texto con la escena + reflexion por escena)
    donde la persona usa IA en un día real de trabajo con errores plantados que debe detectar; practica de revisión. Lección 2: proyecto
    final: construir su kit personal (biblioteca de prompts, política de datos, lista de verificación, un entregable real) en 4-5 reflexiones
    guiadas + plantilla índice + clave.
  - Cada módulo nuevo lleva quiz de 6-8 preguntas con 4 opciones (la correcta en posiciones variadas).
- Siempre: no subir datos personales o confidenciales a herramientas públicas; verificar cifras, normas y citas en fuente oficial;
  la responsabilidad profesional es de la persona. Nombres de herramientas: genéricos («un asistente de IA», «tu hoja de cálculo»),
  o marcas solo como ejemplo sin afirmar funciones o precios que puedan cambiar.
- Retos excel: solo funciones que soporta plataforma/interactivo.js; calcula cada «esperado» con ese evaluador en node.
- No repitas casos ni plantillas que ya existen en el curso. Contexto mexicano realista.
