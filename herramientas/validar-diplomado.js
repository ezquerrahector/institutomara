#!/usr/bin/env node
/* Batería de validación de un diplomado nuevo (después de crear-diplomado.js). Uso: node herramientas/validar-diplomado.js <id>
   V1 especificación y V2 horas los hace crear-diplomado.js. Aquí: V3 estructura, V4 calidad de texto, V5 sesgo de respuestas,
   V6 coherencia de ejercicios, V7 repaso y relacionar, V8 render en navegador, V9 sitio/SQL/SVG/PDF. V10 = revisión experta (agente). */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const RAIZ = path.join(__dirname, '..'), id = process.argv[2];
global.window = {}; const dir = path.join(RAIZ, 'plataforma/cursos');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'rutas.js')) eval(fs.readFileSync(path.join(dir, f), 'utf8'));
const c = window.CURSOS_MARA.find(x => x.id === id); if (!c) { console.error('No existe ' + id); process.exit(1); }
const R = {}; const fallo = (v, m) => (R[v] = R[v] || []).push(m);
const L = c.modulos.flatMap(m => m.lecciones), B = L.flatMap(l => l.bloques.map(b => ({ l, b })));
const Q = []; B.forEach(({ l, b }) => (b.preguntas || []).forEach(q => Q.push({ l: l.id, q }))); c.modulos.forEach(m => m.quiz.preguntas.forEach(q => Q.push({ l: m.id + '-quiz', q })));
const limpio = t => String(t).replace(/<\/?(b|i|strong|em|u)>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
// V3 estructura
const ids = [c.id, ...c.modulos.map(m => m.id), ...L.map(l => l.id)]; if (new Set(ids).size !== ids.length) fallo('V3', 'ids repetidos');
if (window.CURSOS_MARA.filter(x => x.id === id).length !== 1) fallo('V3', 'curso duplicado en el catálogo');
Q.forEach(({ l, q }) => { if (!(q.correcta >= 0 && q.correcta < q.ops.length)) fallo('V3', l + ': correcta fuera de rango');
  if (new Set(q.ops.map(o => o.trim().toLowerCase())).size !== q.ops.length) fallo('V3', l + ': opciones repetidas: ' + q.p.slice(0, 50));
  if (q.ops.length < 3) fallo('V3', l + ': menos de 3 opciones'); });
c.modulos.forEach(m => { if (m.quiz.preguntas.length < 10) fallo('V3', m.id + ': quiz < 10'); if (!m.lecciones.some(l => /-lab$/.test(l.id))) fallo('V3', m.id + ': sin laboratorio'); });
// V4 calidad de texto
const textos = []; B.forEach(({ l, b }) => { for (const k of ['texto', 'mal', 'bien', 'pregunta']) if (typeof b[k] === 'string') textos.push([l.id, limpio(b[k])]); });
Q.forEach(({ l, q }) => textos.push([l, q.p + ' ' + q.ops.join(' ') + ' ' + (q.explica || '')]));
const FIJAS = /Bienvenida|Compara tu respuesta|Lee el caso y piensa|En cada criterio|Hazlo sobre un caso real|Escribe con tus palabras|Diagnóstico 15 min|Descarga el cuaderno|Escribe como si estuvieras|Registra tu primera versión del reto|Felicidades, terminaste|Usa los modelos de las cuatro lecciones|Cada lección sigue|Cada módulo cierra|Repasar de nuevo|Bitácora del reto|Repaso del módulo|Revisa el caso: ¿qué haría/;
const vistos = new Map();
textos.forEach(([l, t]) => {
  if (/"/.test(t)) fallo('V4', l + ': comillas rectas: ' + t.slice(0, 60));
  if (/\b(TODO|lorem|undefined|null|NaN)\b/.test(t)) fallo('V4', l + ': texto provisional/indefinido');
  if (/\b(tambien|despues|asi mismo|ademas|facil|dificil|practica aplicada|telefono|numero|pagina|rapido|dia a dia|dias|analisis)\b/.test(t)) fallo('V4', l + ': posible falta de acento: ' + (t.match(/\b(tambien|despues|asi mismo|ademas|facil|dificil|telefono|numero|pagina|rapido|dias|analisis)\b/) || [''])[0]);
  if (/\s[,.;:]/.test(t.replace(/\.\.\./g, ''))) fallo('V4', l + ': espacio antes de puntuación');
  if (/[¿][^?]*$/.test(t) && !/\?/.test(t)) fallo('V4', l + ': ¿ sin cerrar');
  t.split(/(?<=[.!?])\s+/).filter(s => s.length > 70).forEach(s => { if (FIJAS.test(s)) return; if (vistos.has(s) && vistos.get(s) !== l) fallo('V4', 'oración repetida en ' + l + ' y ' + vistos.get(s) + ': ' + s.slice(0, 60)); vistos.set(s, l); });
});
// Repetición contra otros diplomados
const otros = new Set(); window.CURSOS_MARA.filter(x => x.id !== id).forEach(x => JSON.stringify(x.modulos).replace(/<[^>]+>/g, ' ').split(/(?<=[.!?])\s+/).filter(s => s.length > 80).forEach(s => otros.add(s.trim())));
let rep = 0; JSON.stringify(c.modulos).replace(/<[^>]+>/g, ' ').split(/(?<=[.!?])\s+/).filter(s => s.length > 80).forEach(s => { if (otros.has(s.trim()) && !FIJAS.test(s) && !/Lee el caso y piensa|En cada criterio/.test(s)) rep++; });
if (rep > 3) fallo('V4', rep + ' oraciones idénticas a otros programas');
// V5 sesgo de respuestas
const pos = [0, 0, 0, 0]; let masLarga = 0; Q.forEach(({ q }) => { pos[q.correcta]++; const lens = q.ops.map(o => o.length); if (lens[q.correcta] === Math.max(...lens) && lens.filter(x => x === Math.max(...lens)).length === 1) masLarga++; });
const n3 = Q.length; if (Math.max(pos[0], pos[1], pos[2]) / n3 > 0.45) fallo('V5', 'posición de la correcta desbalanceada: ' + pos.join('/'));
if (masLarga / n3 > 0.55) fallo('V5', 'la respuesta correcta es la más larga en ' + Math.round(100 * masLarga / n3) + '% de las preguntas (máx. 55%)');
// V6 coherencia de ejercicios
L.forEach(l => { const txt = limpio(l.bloques.map(b => JSON.stringify(b)).join(' ')).toLowerCase();
  l.bloques.filter(b => b.tipo === 'completar').forEach(b => b.items.forEach(it => { if ((it.frase.match(/___/g) || []).length !== 1) fallo('V6', l.id + ': completar con más de un ___');
    const r = it.resp[0].toLowerCase(); const sin = txt.split(it.frase.toLowerCase()).join(''); if (!sin.includes(r)) fallo('V6', l.id + ': la respuesta «' + it.resp[0] + '» no aparece en la lección'); }));
  if (!l.bloques.some(b => b.tipo === 'reflexion')) fallo('V6', l.id + ': sin práctica escrita'); });
// V7 repaso y relacionar
B.forEach(({ l, b }) => { if (b.tipo === 'relacionar') { if (b.pares.length < 4) fallo('V7', l.id + ': relacionar corto'); if (new Set(b.pares.map(p => p[1])).size !== b.pares.length) fallo('V7', l.id + ': relacionar repetido'); }
  if (b.tipo === 'tarjetas') b.tarjetas.forEach((t, i) => { if (!t.frente || !t.reverso) fallo('V7', l.id + ': tarjeta ' + i + ' vacía'); }); });
if (c.modulos.some(m => !m.lecciones.some(l => l.bloques.some(b => b.tipo === 'tarjetas')))) fallo('V7', 'módulo sin repaso');
// V8 render en navegador
try { const out = execSync('node ' + path.join(__dirname, 'prueba-navegador.js') + ' ' + id, { encoding: 'utf8', timeout: 120000 }); if (!/OK/.test(out)) fallo('V8', out.slice(0, 400)); } catch (e) { fallo('V8', 'navegador: ' + String(e.stdout || e.message).slice(0, 300)); }
// V9 sitio, SQL, SVG y PDF
const html = fs.readFileSync(path.join(RAIZ, 'sitio-web/index.html'), 'utf8');
const O = JSON.parse(html.match(/var OFERTA = (\[.*?\]);/s)[1]).find(x => x.id === id), D = JSON.parse(html.match(/var DESTACADOS = (\[.*?\]);/s)[1]).find(x => x.id === id);
if (!O || O.h !== c.horas || O.p !== c.precio) fallo('V9', 'OFERTA no coincide'); if (!D || D.h !== c.horas) fallo('V9', 'DESTACADOS no coincide');
const T = JSON.parse(fs.readFileSync(path.join(RAIZ, 'sitio-web/temarios.json'), 'utf8'))[id]; if (!T || T.h !== c.horas || T.m.length !== c.modulos.length) fallo('V9', 'temario no coincide');
const sqlP = path.join(RAIZ, 'backend/diplomados-nuevos-202610.sql'), sql = fs.existsSync(sqlP) ? fs.readFileSync(sqlP, 'utf8') : ''; if (!sql.includes("('" + id + "'")) fallo('V9', 'falta en SQL');
const aula = fs.readFileSync(path.join(RAIZ, 'plataforma/index.html'), 'utf8'); if (!aula.includes('cursos/diplomados-2026-10.js')) fallo('V9', 'aula no carga el archivo');
B.filter(({ b }) => b.tipo === 'imagen').forEach(({ b }) => { const f = path.join(RAIZ, 'plataforma', b.url); if (!fs.existsSync(f)) fallo('V9', 'falta ' + b.url); else try { execSync('python3 -c "import xml.dom.minidom,sys;xml.dom.minidom.parse(sys.argv[1])" ' + f); } catch (e) { fallo('V9', 'SVG inválido ' + b.url); } });
const pdf = path.join(RAIZ, 'plataforma/recursos', id, 'cuaderno.pdf'); if (!fs.existsSync(pdf) || fs.statSync(pdf).size < 20000) fallo('V9', 'PDF ausente o muy pequeño');
// Resultado
const V = ['V3 estructura', 'V4 calidad de texto', 'V5 sesgo de respuestas', 'V6 coherencia de ejercicios', 'V7 repaso y relacionar', 'V8 navegador', 'V9 sitio/SQL/SVG/PDF'];
let ok = true; V.forEach(v => { const k = v.split(' ')[0]; const f = R[k] || []; if (f.length) ok = false; console.log((f.length ? '✗ ' : '✓ ') + v + (f.length ? ' — ' + f.length + ' hallazgos:\n    ' + f.slice(0, 12).join('\n    ') : '')); });
console.log(ok ? 'VALIDACIÓN AUTOMÁTICA APROBADA' : 'HAY HALLAZGOS POR CORREGIR'); process.exit(ok ? 0 : 1);
