#!/usr/bin/env node
/* Amplía un diplomado a 30+ horas reales (opción B) a partir de un archivo de ampliación.
   Uso: node herramientas/ampliar-diplomado.js herramientas/ampliaciones/<id>[.json | carpeta] [revision]
   El archivo de ampliación trae:
     id, horas, desc, aprender (texto extra para "Lo que vas a aprender"),
     talleres: [ {caso, p:[[pregunta, correcta, mal1, mal2, explica]...], comp:[titulo, mal, bien], refl, pl:[rotulo, texto]} ]  (uno por lección, en orden)
     labs:     [ {t, obj, esc, e:[[escena, consigna]...], p:[...], pl:[rotulo, texto]} ]  (uno por módulo; el último es el proyecto final)
   Inserta el taller antes del bloque "clave" de cada lección, agrega el laboratorio al final de cada módulo
   y el proyecto final al último. Actualiza catálogo, temarios del sitio, oferta, destacados, rutas y genera el SQL. */
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
// Acepta un archivo .json o una carpeta con partes (a.json, b.json, …) que se unen en orden.
const fuente = process.argv[2];
const partes = fs.statSync(fuente).isDirectory() ? fs.readdirSync(fuente).filter(f => f.endsWith('.json')).sort().map(f => path.join(fuente, f)) : [fuente];
const amp = { talleres: [], labs: [] };
for (const f of partes) { const x = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const k in x) if (k === 'talleres' || k === 'labs') amp[k].push(...x[k]); else amp[k] = x[k]; }
const REV = process.argv[3] || '20261002';

// Barajado determinista para que la respuesta correcta no quede siempre en la misma posición
let semilla = [...amp.id].reduce((a, ch) => a * 31 + ch.charCodeAt(0) >>> 0, 7);
const azar = () => (semilla = (semilla * 1103515245 + 12345) >>> 0) / 4294967296;
function pregunta([p, bien, m1, m2, explica]) {
  const ops = [bien, m1, m2];
  for (let i = ops.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [ops[i], ops[j]] = [ops[j], ops[i]]; }
  return { p, ops, correcta: ops.indexOf(bien), explica };
}
const plantilla = ([rotulo, texto], nota) => ({ tipo: 'plantilla', rotulo, texto, nota });

function taller(t) {
  return [
    { tipo: 'titulo', texto: 'Taller práctico' },
    { tipo: 'destacado', texto: t.caso },
    { tipo: 'practica', rotulo: 'Decide en el caso', preguntas: t.p.map(pregunta) },
    { tipo: 'comparar', titulo: t.comp[0], mal: t.comp[1], bien: t.comp[2] },
    ...[].concat(t.refl).map((consigna, i) => ({ tipo: 'reflexion', rotulo: i ? 'Da un paso más' : 'Escribe tu respuesta al caso', pregunta: consigna,
      ayuda: i ? 'Aplícalo a tu propio trabajo o a una situación que conozcas.' : 'Escribe con tus palabras. Revisa que cubras cada parte de la consigna.' })),
    plantilla(t.pl, 'Cópiala y adáptala a tu trabajo.')
  ];
}
function laboratorio(l, final) {
  const b = [{ tipo: 'destacado', texto: l.esc }];
  l.e.forEach(([escena, consigna], i) => {
    b.push({ tipo: 'texto', texto: '<p>' + escena + '</p>' });
    b.push({ tipo: 'reflexion', rotulo: (final ? 'Tu entrega — parte ' : 'Tu respuesta — escena ') + (i + 1), pregunta: consigna,
      ayuda: final ? 'Hazlo sobre un caso real o que conozcas bien. Guarda tu texto: al final tendrás tu proyecto completo.' : 'Escribe como si estuvieras ahí. No hay una sola respuesta correcta.' });
  });
  b.push({ tipo: 'practica', rotulo: 'Revisa tus decisiones', preguntas: l.p.map(pregunta) });
  b.push(plantilla(l.pl, final ? 'Úsala como índice de tu proyecto final.' : 'Cópiala y úsala en tu trabajo.'));
  return b;
}

// 1) Catálogo
const dir = path.join(RAIZ, 'plataforma/cursos');
const archivo = fs.readdirSync(dir).find(f => f.endsWith('.js') && fs.readFileSync(path.join(dir, f), 'utf8').includes('push({"id":"' + amp.id + '"'));
if (!archivo) throw new Error('No encontré ' + amp.id);
const lineas = fs.readFileSync(path.join(dir, archivo), 'utf8').split('\n');
const idx = lineas.findIndex(l => l.startsWith('window.CURSOS_MARA.push({"id":"' + amp.id + '"'));
const c = JSON.parse(lineas[idx].slice('window.CURSOS_MARA.push('.length, lineas[idx].lastIndexOf(')')));
if (c.modulos.some(m => m.lecciones.some(l => /-lab$/.test(l.id)))) throw new Error(amp.id + ' ya estaba ampliado');
const lecs = c.modulos.flatMap(m => m.lecciones);
if (amp.talleres.length !== lecs.length) throw new Error(`Talleres: ${amp.talleres.length}, lecciones: ${lecs.length}`);
if (amp.labs.length !== c.modulos.length) throw new Error(`Laboratorios: ${amp.labs.length}, módulos: ${c.modulos.length}`);
lecs.forEach((l, i) => {
  let k = l.bloques.map(b => b.tipo).lastIndexOf('clave');
  if (k < 0) k = l.bloques.length;
  l.bloques.splice(k, 0, ...taller(amp.talleres[i]));
});
c.modulos.forEach((m, i) => {
  const final = i === c.modulos.length - 1, l = amp.labs[i];
  m.lecciones.push({ id: m.id + '-lab', titulo: (final ? 'Proyecto final — ' : 'Laboratorio del módulo ' + (i + 1) + ' — ') + l.t, objetivo: l.obj, bloques: laboratorio(l, final) });
  m.resumen = m.resumen.replace(/\s*$/, '') + (final ? ' Cierra con el proyecto final del diplomado.' : ' Incluye un laboratorio de simulación.');
});
c.horas = amp.horas; c.desc = amp.desc; c.revisionContenido = REV;
lineas[idx] = 'window.CURSOS_MARA.push(' + JSON.stringify(c) + ');';
fs.writeFileSync(path.join(dir, archivo), lineas.join('\n'));

// 2) Temarios del sitio
const INTER = ['practica', 'completar', 'relacionar', 'ordenar', 'tarjetas', 'pronunciar', 'excel'];
const tPath = path.join(RAIZ, 'sitio-web/temarios.json');
const T = JSON.parse(fs.readFileSync(tPath, 'utf8'));
const t = T[amp.id];
const B = c.modulos.flatMap(m => m.lecciones).flatMap(l => l.bloques);
t.h = amp.horas; t.d = amp.desc;
if (amp.aprender && !t.a.includes(amp.aprender)) t.a.push(amp.aprender);
t.m = c.modulos.map((m, i) => ({ t: t.m[i].t, r: m.resumen, l: m.lecciones.map(l => l.titulo.replace(/^Lección \d+ — /, '')) }));
t.s = { mod: c.modulos.length, lec: c.modulos.reduce((a, m) => a + m.lecciones.length, 0),
  ej: B.filter(b => INTER.includes(b.tipo) || b.tipo === 'pasos').length + B.filter(b => b.tipo === 'reflexion').length,
  xl: B.filter(b => b.tipo === 'excel').reduce((a, b) => a + (b.retos || []).length, 0) };
fs.writeFileSync(tPath, JSON.stringify(T));

// 3) Oferta y destacados del sitio, rutas
const recorta = (txt, n) => { if (txt.length <= n) return txt; const s = txt.slice(0, n); return s.slice(0, s.lastIndexOf(' ')).replace(/[,;:.]$/, '') + '…'; };
const sPath = path.join(RAIZ, 'sitio-web/index.html');
let html = fs.readFileSync(sPath, 'utf8');
html = html.replace(new RegExp('\\{"id":"' + amp.id + '"[^{}]*?"h":\\d+([^{}]*?)"d":"([^"]*)"', 'g'), (todo, medio, d) => {
  const largo = d.replace(/…$/, '').length + 1;
  return todo.replace(/"h":\d+/, '"h":' + amp.horas).replace('"d":"' + d + '"', '"d":' + JSON.stringify(recorta(amp.desc, largo)));
});
fs.writeFileSync(sPath, html);

const horasDe = {};
global.window = {};
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'rutas.js')) eval(fs.readFileSync(path.join(dir, f), 'utf8'));
for (const x of window.CURSOS_MARA) horasDe[x.id] = x.horas;
const rPath = path.join(dir, 'rutas.js');
let rutas = fs.readFileSync(rPath, 'utf8');
const sqlRutas = [];
rutas = rutas.replace(/\{"id":"(r-[^"]+)"[^{}]*?"cursos":\[([^\]]*)\][^{}]*?"horas":(\d+)/g, (todo, rid, lista, h) => {
  const ids = JSON.parse('[' + lista + ']');
  if (!ids.includes(amp.id)) return todo;
  const nuevas = ids.reduce((a, i) => a + (horasDe[i] || 0), 0);
  sqlRutas.push(`UPDATE cursos SET horas=${nuevas} WHERE id='${rid}';`);
  html = html.replace(new RegExp('(\\{"id":"' + rid + '"[^{}]*?"horas":)\\d+'), '$1' + nuevas);
  return todo.replace(/"horas":\d+$/, '"horas":' + nuevas);
});
fs.writeFileSync(rPath, rutas);
fs.writeFileSync(sPath, html);

// 4) SQL
const sql = `-- ${c.nombre}: ampliado a ${amp.horas} horas reales (opción B).\nBEGIN;\nUPDATE cursos SET horas=${amp.horas}, descripcion='${amp.desc.replace(/'/g, "''")}' WHERE id='${amp.id}';\n${sqlRutas.join('\n')}${sqlRutas.length ? '\n' : ''}COMMIT;\n`;
const sqlPath = path.join(RAIZ, `backend/${amp.id.replace(/^d-/, '')}-${amp.horas}h-${REV}.sql`);
fs.writeFileSync(sqlPath, sql);
console.log(`${amp.id} (${archivo}): ${t.s.lec} lecciones, ${t.s.ej} ejercicios, ${amp.horas} h. Rutas: ${sqlRutas.join(' ') || 'ninguna'}. SQL: ${path.basename(sqlPath)}`);
