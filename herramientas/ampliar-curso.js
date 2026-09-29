#!/usr/bin/env node
/* Amplía un curso con práctica interactiva SIN cambiar horas ni precio (el contenido sube hasta justificar lo declarado).
   Uso: node herramientas/ampliar-curso.js herramientas/ampliaciones-cursos/<id>.json [--simular]
   JSON: { id, extras: { "<id de lección>": [bloques…] },            // se insertan antes del último bloque "clave"
           practicas: [ { modulo: <índice 0..>, t: "título", obj: "objetivo", bloques: [bloques…] } ] }  // lección nueva al final del módulo
   --simular: valida y muestra horas estimadas antes/después sin escribir nada. */
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..'), dir = path.join(RAIZ, 'plataforma/cursos');
const [fuente, modo] = process.argv.slice(2), simular = modo === '--simular';
const amp = JSON.parse(fs.readFileSync(fuente, 'utf8'));
global.window = {}; for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'rutas.js')) eval(fs.readFileSync(path.join(dir, f), 'utf8'));
const est = require('./horas-actividad.js');

// Validación de bloques
const TIPOS = { texto: ['texto'], destacado: ['texto'], titulo: ['texto'], lista: ['items'], tabla: ['encabezados', 'filas'],
  practica: ['preguntas'], completar: ['items'], relacionar: ['pares'], ordenar: ['items'], tarjetas: ['tarjetas'], pasos: ['pasos'],
  comparar: ['mal', 'bien'], reflexion: ['pregunta'], plantilla: ['texto'], clave: ['items'], excel: ['datos', 'retos'],
  dialogo: ['lineas'], pronunciar: ['frases'], escuchar: ['frases'], vocabulario: ['palabras'], actividad: ['texto'] };
const errores = [];
function validar(b, donde) {
  const req = TIPOS[b.tipo]; if (!req) return errores.push(donde + ': tipo desconocido ' + b.tipo);
  for (const k of req) if (b[k] == null || (Array.isArray(b[k]) && !b[k].length)) errores.push(donde + ': falta ' + k + ' en ' + b.tipo);
  if (b.tipo === 'practica') b.preguntas.forEach((q, i) => {
    if (!q.p || !Array.isArray(q.ops) || q.ops.length < 2) errores.push(donde + ' pregunta ' + i + ' incompleta');
    else if (!(q.correcta >= 0 && q.correcta < q.ops.length)) errores.push(donde + ' pregunta ' + i + ': correcta fuera de rango');
    else if (new Set(q.ops).size !== q.ops.length) errores.push(donde + ' pregunta ' + i + ': opciones repetidas'); });
  if (b.tipo === 'completar') b.items.forEach((x, i) => { if (!/___/.test(x.frase) || !Array.isArray(x.resp) || !x.resp.length) errores.push(donde + ' completar ' + i + ': necesita ___ y resp[]'); });
  if (b.tipo === 'relacionar') b.pares.forEach((p, i) => { if (!Array.isArray(p) || p.length !== 2) errores.push(donde + ' par ' + i); });
  if (b.tipo === 'relacionar' && new Set(b.pares.map(p => p[1])).size !== b.pares.length) errores.push(donde + ': relacionar con respuestas repetidas');
  if (b.tipo === 'tarjetas') b.tarjetas.forEach((t, i) => { if (!t.frente || !t.reverso) errores.push(donde + ' tarjeta ' + i); });
  if (b.tipo === 'ordenar') b.items.forEach((t, i) => { if (!t.frase || t.frase.split(' ').length < 3) errores.push(donde + ' ordenar ' + i + ': frase de 3+ palabras'); });
  if (b.tipo === 'excel') { const cols = b.datos[0].length; b.datos.forEach((f, i) => { if (f.length !== cols) errores.push(donde + ' excel fila ' + i + ' con ' + f.length + ' columnas (esperadas ' + cols + ')'); });
    b.retos.forEach((r, i) => { if (!r.celda || !r.formula || r.esperado === undefined || !r.texto) errores.push(donde + ' reto ' + i + ' incompleto'); if (/−/.test(r.formula)) errores.push(donde + ' reto ' + i + ': usa "-" ASCII'); }); }
}
const c = window.CURSOS_MARA.find(x => x.id === amp.id); if (!c) throw new Error('No encontré ' + amp.id);
const antes = est(c);
const lecs = Object.fromEntries(c.modulos.flatMap(m => m.lecciones).map(l => [l.id, l]));
for (const [lid, bloques] of Object.entries(amp.extras || {})) {
  const l = lecs[lid]; if (!l) { errores.push('lección inexistente ' + lid); continue; }
  bloques.forEach((b, i) => validar(b, lid + '#' + i));
  let k = l.bloques.map(b => b.tipo).lastIndexOf('clave'); if (k < 0) k = l.bloques.length;
  l.bloques.splice(k, 0, ...bloques);
}
for (const p of amp.practicas || []) {
  const m = c.modulos[p.modulo]; if (!m) { errores.push('módulo inexistente ' + p.modulo); continue; }
  const id = m.id + '-pr' + (m.lecciones.filter(l => /-pr\d*$/.test(l.id)).length || '');
  p.bloques.forEach((b, i) => validar(b, id + '#' + i));
  m.lecciones.push({ id, titulo: 'Práctica guiada — ' + p.t, objetivo: p.obj, bloques: p.bloques });
}
if (errores.length) { console.error('ERRORES:\n' + errores.join('\n')); process.exit(1); }
const despues = est(c);
console.log(`${c.id}: ${c.horas} h declaradas · estimado ${antes.toFixed(1)} → ${despues.toFixed(1)} h · proporción ${(antes / c.horas).toFixed(2)} → ${(despues / c.horas).toFixed(2)} (meta ≥ 0.80 cursos · 0.76 diplomados)`);
if (simular) process.exit(0);

// Escribir catálogo
const archivo = fs.readdirSync(dir).find(f => f.endsWith('.js') && fs.readFileSync(path.join(dir, f), 'utf8').includes('push({"id":"' + amp.id + '"'));
const ruta = path.join(dir, archivo), lineas = fs.readFileSync(ruta, 'utf8').split('\n');
const idx = lineas.findIndex(l => l.startsWith('window.CURSOS_MARA.push({"id":"' + amp.id + '"'));
const orig = JSON.parse(lineas[idx].slice('window.CURSOS_MARA.push('.length, lineas[idx].lastIndexOf(')')));
if (orig.modulos.some(m => m.lecciones.some(l => /-pr\d*$/.test(l.id)))) throw new Error(amp.id + ' ya estaba ampliado');
c.revisionContenido = '20261003';
lineas[idx] = 'window.CURSOS_MARA.push(' + JSON.stringify(c) + ');';
fs.writeFileSync(ruta, lineas.join('\n'));
// Temario del sitio
const tPath = path.join(RAIZ, 'sitio-web/temarios.json'), T = JSON.parse(fs.readFileSync(tPath, 'utf8')), t = T[amp.id];
if (t) { const INTER = ['practica', 'completar', 'relacionar', 'ordenar', 'tarjetas', 'pronunciar', 'excel', 'pasos', 'reflexion', 'escuchar'];
  const B = c.modulos.flatMap(m => m.lecciones).flatMap(l => l.bloques);
  t.m = c.modulos.map((m, i) => ({ ...t.m[i], l: m.lecciones.map(l => l.titulo.replace(/^Lección \d+ — /, '')) }));
  t.s = { ...(t.s || {}), mod: c.modulos.length, lec: c.modulos.reduce((a, m) => a + m.lecciones.length, 0), ej: B.filter(b => INTER.includes(b.tipo)).length,
    xl: B.filter(b => b.tipo === 'excel').reduce((a, b) => a + b.retos.length, 0) };
  fs.writeFileSync(tPath, JSON.stringify(T)); }
console.log('Escrito en ' + archivo);
