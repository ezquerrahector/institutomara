# Cómo ampliar un curso (práctica interactiva, mismas horas y precio)

Objetivo: que el contenido justifique las horas y el precio declarados. NO se cambian horas ni precio.
Meta: proporción estimada/declarada ≥ 0.80 (cursos) o ≥ 0.76 (diplomados), medida con
`node herramientas/ampliar-curso.js herramientas/ampliaciones-cursos/<id>.json --simular`.

## Reglas
- NO edites nada en `plataforma/`, `sitio-web/` ni `backend/`. Solo creas `herramientas/ampliaciones-cursos/<id>.json`.
- Primero lee el curso completo: `node herramientas/ver-curso.js <id>` (imprime módulo, lección, bloque) o carga el catálogo con node.
  Respeta el nivel, el tono, el público y la terminología del curso; no repitas casos ya usados.
- Español de México, trato de «tú», frases claras, contexto mexicano realista (ciudades, negocios, pesos, SAT, IMSS, etc.).
- Datos legales, fiscales, clínicos o técnicos: solo afirmaciones que sabes correctas y vigentes; si algo cambia seguido, dilo como
  «verifica la cifra vigente en…». Nunca inventes artículos de ley, estadísticas ni citas. Nada de marcas registradas en personajes.
- Contenido clínico/psicológico: psicoeducación, no diagnóstico; incluye canalización cuando aplique (Línea de la Vida 800 911 2000).
- Las preguntas deben tener una sola respuesta defendible; distractores plausibles; «correcta» varía de posición (0, 1 o 2); agrega "explica".
- Sin comillas dobles rectas dentro de los textos (usa «» o ‹›). JSON válido.

## Formato del archivo
```json
{ "id": "c-canva",
  "extras":   { "<id de lección existente>": [ bloques… ] },
  "practicas": [ { "modulo": 0, "t": "Título corto", "obj": "Objetivo en una frase", "bloques": [ bloques… ] } ] }
```
- `extras`: bloques que se insertan al final de una lección existente (antes de su «clave»). Úsalos para reforzar lecciones delgadas.
- `practicas`: una lección nueva «Práctica guiada — <t>» al final del módulo indicado (índice desde 0). Idealmente una por módulo.
  Cada práctica guiada debe ser un reto integrador de 30-45 min: un caso realista (destacado) y una mezcla de actividades.

## Tipos de bloque (campos exactos)
- `{"tipo":"titulo","texto":"…"}` · `{"tipo":"texto","texto":"HTML simple: <b>, <i>, <br>"}` · `{"tipo":"destacado","texto":"…"}`
- `{"tipo":"tabla","titulo":"…","encabezados":["A","B"],"filas":[["…","…"]],"nota":"opcional"}`
- `{"tipo":"practica","rotulo":"Decide en el caso","preguntas":[{"p":"…","ops":["…","…","…"],"correcta":1,"explica":"…"}]}` (3 opciones)
- `{"tipo":"completar","rotulo":"Completa","items":[{"frase":"El ___ se paga el día 17.","resp":["ISR","isr"]}]}` (una ___ por frase; resp = variantes aceptadas)
- `{"tipo":"relacionar","rotulo":"…","pares":[["izquierda","derecha"],…]}` (4-6 pares, derechas distintas)
- `{"tipo":"ordenar","rotulo":"Ordena las palabras","items":[{"frase":"frase correcta de 4 a 10 palabras","es":"pista o traducción"}]}`
- `{"tipo":"tarjetas","rotulo":"…","tarjetas":[{"frente":"…","reverso":"…"}]}`
- `{"tipo":"pasos","rotulo":"Pruébalo hoy","pasos":["…","…"]}`
- `{"tipo":"comparar","titulo":"…","mal":"«…»","bien":"«…»"}`
- `{"tipo":"reflexion","rotulo":"…","pregunta":"consigna concreta que pide escribir algo aplicable","ayuda":"arranque sugerido…"}`
- `{"tipo":"plantilla","rotulo":"…","texto":"texto con saltos \n y campos [ ]","nota":"Cópiala y adáptala."}`
- `{"tipo":"excel","rotulo":"…","datos":[["Encabezado A","Encabezado B"],["x",10],["Total",""]],"retos":[{"celda":"B3","formula":"=SUMA(B2:B2)","esperado":10,"texto":"<b>B3</b>: explica qué calcular","requiere":"SUMA(","pista":"=SUMA(…)"}]}`
  Fórmulas en español (SUMA, PROMEDIO, SI, BUSCARV, SUMAR.SI, CONTAR.SI, REDONDEAR, MIN, MAX, Y, O, SI.ERROR, INDICE, COINCIDIR),
  separador «,», signo menos ASCII. Las celdas que el alumno llena van como "". «esperado» = resultado exacto (número o texto).
  Todas las filas con el mismo número de columnas. Calcula tú mismo cada «esperado» con cuidado (puedes verificar con node).
- Idiomas: `{"tipo":"vocabulario","rotulo":"…","palabras":[{"en":"…","es":"…","ej":"…"}]}`,
  `{"tipo":"dialogo","titulo":"…","lineas":[{"quien":"…","en":"…","es":"…"}]}`, `{"tipo":"pronunciar","rotulo":"…","frases":[{"en":"…","es":"…"}]}`,
  `{"tipo":"escuchar","rotulo":"…","frases":[{"en":"…","es":"…"}]}`, `{"tipo":"actividad","rotulo":"…","texto":"…"}`.
  (En cursos de idiomas distintos al inglés, el campo sigue llamándose "en" y contiene la frase en el idioma que se aprende.)
- `{"tipo":"clave","items":["…"]}` — no la agregues en extras; sí al final de cada práctica guiada (2-3 ideas).

## Mezcla sugerida por práctica guiada
destacado (caso) → practica (3-4 preguntas) → una o dos de: completar / relacionar / ordenar / tarjetas / excel (si el curso es de datos o dinero)
→ comparar → reflexion (1-2) → plantilla → clave.

Al terminar corre la simulación, ajusta hasta cumplir la meta y reporta la línea final que imprime.
