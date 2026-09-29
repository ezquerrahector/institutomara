#!/usr/bin/env node
/* Profundiza un curso corto: agrega módulos completos, tercera opción a preguntas de 2 opciones, extras y nuevas horas (precio igual).
   Uso: node herramientas/profundizar-curso.js herramientas/profundizar/<id>.json [--simular | --pendientes]   (--pendientes lista las preguntas de 2 opciones)
   JSON: { id, horas, aprender:["…"],
     terceras: [ {p:"texto exacto de la pregunta", op:"nuevo distractor"} ],   // TODAS las preguntas de 2 opciones
     extras: { "<id lección>": [bloques] },
     modulos: [ { t:"Título del módulo", r:"resumen", lecciones:[ {t, obj, bloques:[…]} ], quiz:[ {p, ops:[4 opciones], correcta} ] } ] } */
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..'), dir = path.join(RAIZ, 'plataforma/cursos');
const [fuente, modo] = process.argv.slice(2), simular = modo === '--simular';
const amp = JSON.parse(fs.readFileSync(fuente, 'utf8'));
global.window = {}; for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'rutas.js')) eval(fs.readFileSync(path.join(dir, f), 'utf8'));
const est = require('./horas-actividad.js');
const c = window.CURSOS_MARA.find(x => x.id === amp.id); if (!c) throw new Error('No encontré ' + amp.id);
if (c.modulos.length > 3) throw new Error(amp.id + ' ya estaba profundizado');
const antes = est(c), errores = [];
// Validador compartido con ampliar-curso
const TIPOS = { texto: ['texto'], destacado: ['texto'], titulo: ['texto'], lista: ['items'], tabla: ['encabezados', 'filas'], practica: ['preguntas'], completar: ['items'], relacionar: ['pares'], ordenar: ['items'], tarjetas: ['tarjetas'], pasos: ['pasos'], comparar: ['mal', 'bien'], reflexion: ['pregunta'], plantilla: ['texto'], clave: ['items'], excel: ['datos', 'retos'], actividad: ['texto'] };
function preg(q, donde, min) { if (!q.p || !Array.isArray(q.ops) || q.ops.length < min) errores.push(donde + ': pregunta con menos de ' + min + ' opciones: ' + (q.p || '').slice(0, 50));
  else if (!(q.correcta >= 0 && q.correcta < q.ops.length)) errores.push(donde + ': correcta fuera de rango'); else if (new Set(q.ops).size !== q.ops.length) errores.push(donde + ': opciones repetidas'); }
function validar(b, donde) {
  const req = TIPOS[b.tipo]; if (!req) return errores.push(donde + ': tipo desconocido ' + b.tipo);
  for (const k of req) if (b[k] == null || (Array.isArray(b[k]) && !b[k].length)) errores.push(donde + ': falta ' + k);
  if (b.tipo === 'practica') b.preguntas.forEach(q => preg(q, donde, 3));
  if (b.tipo === 'completar') b.items.forEach((x, i) => { if (!/___/.test(x.frase) || !Array.isArray(x.resp)) errores.push(donde + ' completar ' + i); });
  if (b.tipo === 'relacionar' && new Set(b.pares.map(p => p[1])).size !== b.pares.length) errores.push(donde + ': relacionar repetido');
  if (b.tipo === 'tarjetas') b.tarjetas.forEach((t, i) => { if (!t.frente || !t.reverso) errores.push(donde + ' tarjeta ' + i); });
  if (b.tipo === 'ordenar') b.items.forEach((t, i) => { if (!t.frase || t.frase.split(' ').length < 3) errores.push(donde + ' ordenar ' + i); });
  if (b.tipo === 'excel') { const n = b.datos[0].length; b.datos.forEach((f, i) => { if (f.length !== n) errores.push(donde + ' excel fila ' + i); });
    b.retos.forEach((r, i) => { if (!r.celda || !r.formula || r.esperado === undefined || !r.texto) errores.push(donde + ' reto ' + i); if (/−/.test(r.formula)) errores.push(donde + ' reto ' + i + ' signo −'); }); }
}
// 1) Terceras opciones
const todas = [];
c.modulos.forEach(m => { m.lecciones.forEach(l => l.bloques.forEach(b => (b.preguntas || []).forEach(q => todas.push(q)))); ((m.quiz || {}).preguntas || []).forEach(q => todas.push(q)); });
for (const t of amp.terceras || []) { const qs = todas.filter(q => q.p === t.p && q.ops.length === 2);
  if (!qs.length) errores.push('tercera sin pregunta: ' + t.p.slice(0, 60)); qs.forEach(q => { if (q.ops.includes(t.op)) errores.push('tercera repetida: ' + t.op); q.ops.push(t.op); }); }
if (modo === '--pendientes') { console.log(JSON.stringify(todas.filter(q => q.ops.length < 3).map(q => ({ p: q.p, ops: q.ops, correcta: q.ops[q.correcta] })), null, 1)); process.exit(0); }
const faltan = todas.filter(q => q.ops.length < 3); if (faltan.length) errores.push(faltan.length + ' preguntas siguen con 2 opciones, p. ej.: ' + faltan.slice(0, 3).map(q => q.p).join(' | '));
// 2) Extras
const lecs = Object.fromEntries(c.modulos.flatMap(m => m.lecciones).map(l => [l.id, l]));
for (const [lid, bl] of Object.entries(amp.extras || {})) { const l = lecs[lid]; if (!l) { errores.push('lección inexistente ' + lid); continue; }
  bl.forEach((b, i) => validar(b, lid + '#' + i)); let k = l.bloques.map(b => b.tipo).lastIndexOf('clave'); if (k < 0) k = l.bloques.length; l.bloques.splice(k, 0, ...bl); }
// 3) Módulos nuevos
const ultimo = c.modulos[c.modulos.length - 1];
if (ultimo.quiz) ultimo.quiz.titulo = 'Evaluación del módulo ' + c.modulos.length;
(amp.modulos || []).forEach((nm, j) => {
  const n = c.modulos.length + 1, mid = c.id + '-m' + n, final = j === amp.modulos.length - 1;
  const m = { id: mid, titulo: 'Módulo ' + n + ' — ' + nm.t, resumen: nm.r, lecciones: nm.lecciones.map((l, k) => {
    l.bloques.forEach((b, i) => validar(b, mid + '-l' + (k + 1) + '#' + i));
    return { id: mid + '-l' + (k + 1), titulo: 'Lección ' + (k + 1) + ' — ' + l.t, objetivo: l.obj, bloques: l.bloques }; }),
    quiz: { titulo: final ? 'Evaluación final del curso' : 'Evaluación del módulo ' + n, preguntas: nm.quiz } };
  nm.quiz.forEach(q => preg(q, mid + ' quiz', 4)); if (nm.quiz.length < 6) errores.push(mid + ': quiz con menos de 6 preguntas');
  c.modulos.push(m); });
if (errores.length) { console.error('ERRORES:\n' + errores.join('\n')); process.exit(1); }
const despues = est(c);
console.log(`${c.id}: ${c.horas} → ${amp.horas} h · estimado ${antes.toFixed(1)} → ${despues.toFixed(1)} h · proporción ${(despues / amp.horas).toFixed(2)} (meta ≥ 0.80)`);
if (simular) process.exit(0);
c.horas = amp.horas; c.revisionContenido = '20261003';
const archivo = fs.readdirSync(dir).find(f => f.endsWith('.js') && fs.readFileSync(path.join(dir, f), 'utf8').includes('push({"id":"' + amp.id + '"'));
const ruta = path.join(dir, archivo), lineas = fs.readFileSync(ruta, 'utf8').split('\n');
const idx = lineas.findIndex(l => l.startsWith('window.CURSOS_MARA.push({"id":"' + amp.id + '"'));
lineas[idx] = 'window.CURSOS_MARA.push(' + JSON.stringify(c) + ');'; fs.writeFileSync(ruta, lineas.join('\n'));
// Temario
const tPath = path.join(RAIZ, 'sitio-web/temarios.json'), T = JSON.parse(fs.readFileSync(tPath, 'utf8')), t = T[amp.id];
if (t) { t.h = amp.horas; for (const a of amp.aprender || []) if (!t.a.includes(a)) t.a.push(a);
  t.m = c.modulos.map((m, i) => ({ t: (t.m[i] && t.m[i].t) || m.titulo.replace(/^Módulo \d+ — /, ''), r: m.resumen, l: m.lecciones.map(l => l.titulo.replace(/^Lección \d+ — /, '')) }));
  const B = c.modulos.flatMap(m => m.lecciones).flatMap(l => l.bloques), INTER = ['practica', 'completar', 'relacionar', 'ordenar', 'tarjetas', 'excel', 'pasos', 'reflexion'];
  t.s = { ...(t.s || {}), mod: c.modulos.length, lec: c.modulos.reduce((a, m) => a + m.lecciones.length, 0), ej: B.filter(b => INTER.includes(b.tipo)).length, xl: B.filter(b => b.tipo === 'excel').reduce((a, b) => a + b.retos.length, 0) };
  fs.writeFileSync(tPath, JSON.stringify(T)); }
// Sitio: horas
const sPath = path.join(RAIZ, 'sitio-web/index.html');
fs.writeFileSync(sPath, fs.readFileSync(sPath, 'utf8').replace(new RegExp('(\\{"id":"' + amp.id + '"[^{}]*?"h":)\\d+', 'g'), '$1' + amp.horas));
// SQL acumulado
const sql = path.join(RAIZ, 'backend/ia-profesiones-10h-20261003.sql');
let s = fs.existsSync(sql) ? fs.readFileSync(sql, 'utf8') : '-- Cursos de IA por profesión profundizados (mismo precio).\n';
s = s.split('\n').filter(l => !l.includes("id='" + amp.id + "'")).join('\n').replace(/\n*$/, '\n') + `UPDATE cursos SET horas=${amp.horas} WHERE id='${amp.id}';\n`;
fs.writeFileSync(sql, s);
console.log('Escrito en ' + archivo);
