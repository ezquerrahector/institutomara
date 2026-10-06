# Ampliar preguntas de 2 opciones a 4 (Instituto Mara)

Cada lote (`loteN.json`) tiene preguntas de práctica que hoy sólo tienen 2 opciones. Para cada una escribe 2 distractores
nuevos para que quede con 4 opciones, y una explicación breve. Escribe el resultado en `loteN.salida.json`:

```json
[ { "k": "<igual que en el lote>", "nuevas": ["distractor 1", "distractor 2"], "explica": "1-2 frases: por qué la correcta es la mejor", "p": "(opcional) enunciado ajustado" } ]
```

Reglas:
- Una sola respuesta correcta, inequívoca. Los distractores deben ser plausibles para alguien que no estudió, pero claramente
  peores para quien sí estudió la lección. Nada absurdo, chistoso ni obvio; nada que también pueda ser correcto.
- Longitud parecida a las opciones existentes (no hagas los distractores mucho más cortos ni más largos). Mismo estilo y
  formato que las opciones originales (si son etiquetas cortas, etiquetas cortas; si son frases, frases).
- Muchas preguntas son de clasificar (p. ej. «Duelo esperable» / «Señal para canalizar»): agrega categorías vecinas
  plausibles pero incorrectas para ese caso (p. ej. «Duelo complicado que requiere hospitalización»). Si el enunciado deja
  de tener sentido con 4 opciones, ajústalo en "p" (sin cambiar qué es correcto).
- En cursos de idiomas, los distractores son errores típicos de hispanohablantes (falsos amigos, tiempos verbales, orden).
- En Excel/Office/IA, distractores técnicamente verosímiles (funciones o menús reales usados en el lugar equivocado).
- "explica": si ya trae explicación úsala como base y mejórala; si está vacía, escríbela. No menciones letras ni posiciones.
- Español de México impecable, trato de «tú», sin comillas dobles rectas dentro de los textos (usa «»).
- No dupliques una opción existente ni repitas un distractor dentro de la misma pregunta.
- Debe haber una salida por cada pregunta del lote (mismo número de elementos y mismas k).
Valida al final: `node herramientas/opciones4/revisar.js loteN` (debe decir OK).
