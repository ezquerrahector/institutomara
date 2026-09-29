#!/usr/bin/env node
/* Crea (o regenera) un diplomado nuevo con el formato de Persuasión ética a partir de una especificación compacta.
   Uso: node herramientas/crear-diplomado.js herramientas/diplomados-nuevos/<id>.json [--simular]
   Genera: catálogo (plataforma/cursos/diplomados-2026-10.js), mapas SVG por módulo, cuaderno .md y PDF,
   oferta y destacados del sitio, temario, y el SQL acumulado backend/diplomados-nuevos-202610.sql.
   El formato de la especificación está en herramientas/diplomados-nuevos/INSTRUCCIONES.md. */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');
const [fuente, modo] = process.argv.slice(2), simular = modo === '--simular';
let S;
if (fs.statSync(fuente).isDirectory()) { // carpeta: meta.json + partes con {modulos:[…]} en orden alfabético
  S = JSON.parse(fs.readFileSync(path.join(fuente, 'meta.json'), 'utf8')); S.modulos = S.modulos || [];
  for (const f of fs.readdirSync(fuente).filter(f => f.endsWith('.json') && f !== 'meta.json').sort()) S.modulos.push(...JSON.parse(fs.readFileSync(path.join(fuente, f), 'utf8')).modulos);
} else S = JSON.parse(fs.readFileSync(fuente, 'utf8'));
const HORAS = S.horas || 30, PRECIO = S.precio || 1690, REV = S.revision || '20261004';
const ARCH = 'diplomados-2026-10.js';
const errores = [];
const req = (cond, msg) => { if (!cond) errores.push(msg); };

// ---------- Validación de la especificación ----------
req(/^d-[a-z0-9-]+$/.test(S.id), 'id inválido');
req(/^[a-z]{2,3}$/.test(S.pref || ''), 'pref de 2-3 letras');
req(S.nombre && S.nombre.startsWith('Diplomado'), 'nombre debe empezar con «Diplomado»');
req(/^#[0-9A-Fa-f]{6}$/.test(S.color || ''), 'color hex');
req(S.desc && S.desc.length >= 250 && S.desc.length <= 700, 'desc de 250 a 700 caracteres (tiene ' + (S.desc || '').length + ')');
req(Array.isArray(S.aprender) && S.aprender.length >= 5, 'aprender: 5 o más');
req(Array.isArray(S.modulos) && S.modulos.length === 8, 'se requieren 8 módulos');
req(Array.isArray(S.referencias) && S.referencias.length >= 5, 'referencias APA: 5 o más');
const P5 = (q, d, n) => { req(Array.isArray(q) && q.length === 5, d + ': pregunta mal formada (se esperan 5 elementos)');
  if (!Array.isArray(q)) return; const ops = q.slice(1, n + 1); req(new Set(ops).size === ops.length, d + ': opciones repetidas «' + q[0].slice(0, 40) + '»'); req(ops.every(o => typeof o === 'string' && o.trim()), d + ': opción vacía'); };
(S.modulos || []).forEach((m, i) => {
  const d = 'M' + (i + 1);
  req(m.t && m.r, d + ': t y r'); req(Array.isArray(m.lecciones) && m.lecciones.length === 4, d + ': 4 lecciones');
  (m.lecciones || []).forEach((l, j) => { const e = d + 'L' + (j + 1);
    req(l.t && l.obj, e + ': t/obj'); req(Array.isArray(l.texto) && l.texto.length >= 3, e + ': texto con 3+ párrafos');
    req(l.texto && l.texto.join(' ').split(/\s+/).length >= 220, e + ': texto de 220+ palabras (tiene ' + (l.texto ? l.texto.join(' ').split(/\s+/).length : 0) + ')');
    req(Array.isArray(l.comparar) && l.comparar.length === 2, e + ': comparar [mal, bien]'); req(l.caso && l.caso.length > 80, e + ': caso');
    req(Array.isArray(l.p) && l.p.length >= 3, e + ': 3+ preguntas'); (l.p || []).forEach((q, k) => { P5(q, e + 'P' + (k + 1), 3); req(q[4] && q[4].length > 20, e + ': explica en pregunta ' + (k + 1)); });
    req(Array.isArray(l.completar) && /___/.test(l.completar[0]) && l.completar[1], e + ': completar [frase con ___, respuesta]');
    if (l.relacionar) { req(l.relacionar.length >= 4 && new Set(l.relacionar.map(p => p[1])).size === l.relacionar.length, e + ': relacionar 4+ pares, derechas distintas'); }
    req(l.refl && l.refl.length > 60, e + ': refl'); req(l.modelo && l.modelo.length > 120, e + ': modelo'); req(Array.isArray(l.plantilla) && l.plantilla.length === 2, e + ': plantilla'); req(Array.isArray(l.clave) && l.clave.length >= 2, e + ': clave');
  });
  req(m.lecciones && m.lecciones.filter(l => l.relacionar).length >= 1, d + ': al menos un relacionar por módulo');
  req(m.reto && m.reto.texto && m.reto.entregable && m.reto.criterios, d + ': reto {texto, entregable, criterios}');
  const L = m.lab || {}; req(L.t && L.obj && L.esc, d + ': lab t/obj/esc'); req(Array.isArray(L.e) && L.e.length === 4, d + ': lab con 4 escenas');
  req(Array.isArray(L.p) && L.p.length >= 3, d + ': lab con 3+ preguntas'); (L.p || []).forEach((q, k) => { P5(q, d + 'lab P' + (k + 1), 3); req(q[4] && q[4].length > 15, d + ' lab: explica en pregunta ' + (k + 1)); }); req(Array.isArray(L.pl) && L.pl.length === 2, d + ': lab pl');
  req(Array.isArray(m.quiz) && m.quiz.length >= 10, d + ': quiz de 10+'); (m.quiz || []).forEach((q, k) => P5(q, d + 'quiz' + (k + 1), 4));
});
const todo = JSON.stringify(S);
req(!/"[^"]*\\"[^"]*"/.test(todo.replace(/<[^>]+>/g, '')), 'comillas dobles rectas dentro de textos: usa «»');
req(!/\b(TODO|lorem|xxx)\b/i.test(todo), 'texto provisional');
if (errores.length) { console.error('ERRORES (' + errores.length + '):\n' + errores.slice(0, 60).join('\n')); process.exit(1); }

// ---------- Construcción ----------
let semilla = [...S.id].reduce((a, ch) => a * 31 + ch.charCodeAt(0) >>> 0, 11);
const azar = () => (semilla = (semilla * 1103515245 + 12345) >>> 0) / 4294967296;
function preg(q, n) { const bien = q[1]; const ops = q.slice(1, n + 1);
  for (let i = ops.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [ops[i], ops[j]] = [ops[j], ops[i]]; }
  const o = { p: q[0], ops, correcta: ops.indexOf(bien) }; if (n === 3 && q[4]) o.explica = q[4]; return o; }
const formulas = t => t.replace(/\[=[^\]]*\]/g, f => f.replace(/−/g, '-'));
const pref = S.pref, recursos = 'recursos/' + S.id;
const AYUDA = 'Escribe con tus palabras; no hay respuesta única. Revisa que cubras cada parte de la consigna y apoya tu decisión en un hecho concreto.';
const modulos = S.modulos.map((m, i) => {
  const mid = pref + '-m' + String(i + 1).padStart(2, '0'), final = i === S.modulos.length - 1;
  const lecciones = m.lecciones.map((l, j) => {
    const B = [];
    if (i === 0 && j === 0) {
      B.push({ tipo: 'destacado', texto: '<b>¡Bienvenida, bienvenido!</b> Cada lección sigue el mismo camino: una idea clara, un ejemplo de la vida real, una pregunta para comprobar que la entendiste, un taller breve para aplicarla a tu situación y una frase o plantilla lista para usar. Cada módulo cierra con un reto, un laboratorio de simulación y una evaluación corta. Trabaja a tu ritmo: lo importante es que cada idea te sirva en tu vida.' });
      if (S.aviso) B.push({ tipo: 'destacado', texto: S.aviso });
    }
    if (j === 0) B.push({ tipo: 'imagen', url: recursos + '/visuales/' + mid + '.svg', pie: 'Mapa del módulo: ' + m.lecciones.map(x => x.t).join('; ') + '.' });
    B.push({ tipo: 'texto', texto: l.texto.map(p => '<p>' + p + '</p>').join('') });
    B.push({ tipo: 'comparar', titulo: 'Cómo se ve en la vida real', mal: l.comparar[0], bien: l.comparar[1] });
    B.push({ tipo: 'destacado', texto: l.caso });
    B.push({ tipo: 'practica', rotulo: 'Decide y contrasta', preguntas: l.p.map(q => ({ ...preg(q, 3), pista: 'Revisa el caso: ¿qué haría una persona informada y respetuosa en esa situación?' })) });
    B.push({ tipo: 'completar', rotulo: 'Recupera la idea clave', items: [{ frase: l.completar[0], resp: [].concat(l.completar[1]), explica: l.completar[2] || 'Relaciona este concepto con el caso que acabas de analizar.' }] });
    if (l.relacionar) B.push({ tipo: 'relacionar', rotulo: 'Relaciona el concepto con su aplicación', voz: false, pares: l.relacionar });
    B.push({ tipo: 'reflexion', rotulo: 'Práctica aplicada · 20 minutos orientativos', pregunta: l.refl, ayuda: AYUDA });
    B.push({ tipo: 'texto', texto: '<details class="modelo"><summary>👀 Ver un ejemplo de respuesta (ábrelo después de escribir la tuya)</summary><details><summary>Consultar modelo y retroalimentación</summary><p>' + l.modelo + '</p><p>Compara tu respuesta: identifica qué hiciste igual, qué te faltó y una mejora concreta. El modelo es una posibilidad, no la única respuesta válida.</p></details></details>' });
    if (j === 3) {
      B.push({ tipo: 'tarjetas', guiado: true, voz: false, rotulo: 'Repaso del módulo: casos y respuestas explicadas',
        instrucciones: 'Lee el caso y piensa qué harías. Pulsa «Ver respuesta» para comparar. Si necesitas volver a estudiarlo, elige «Repasar de nuevo»; si ya puedes explicar la idea con tus palabras, elige «Lo comprendí». Es una autoevaluación, no un examen.',
        tarjetas: m.lecciones.map(x => ({ frente: x.caso.replace(/<[^>]+>/g, '') + '\n\n' + x.p[0][0], reverso: x.p[0][1], ej: 'Por qué: ' + x.p[0][4] })) });
      B.push({ tipo: 'texto', texto: '<h3>Reto del módulo · 90 minutos orientativos</h3><p>' + m.reto.texto + '</p><p><strong>Entregable:</strong> ' + m.reto.entregable + '</p><p>Diagnóstico 15 min; primera versión 30; contraste 20; revisión 15; reflexión 10.</p>' });
      B.push({ tipo: 'reflexion', rotulo: 'Bitácora del reto', pregunta: 'Registra tu primera versión del reto, lo que descubriste al contrastarla con las lecciones y tu versión revisada.', ayuda: AYUDA });
      B.push({ tipo: 'texto', texto: '<h3>Autoevaluación del reto</h3><p>' + m.reto.criterios + ' En cada criterio: 0 ausente; 1 genérico; 2 concreto y justificado. Corrige los criterios con 0. Usa los modelos de las cuatro lecciones para contrastar tus decisiones.</p>' });
    }
    B.push({ tipo: 'plantilla', rotulo: l.plantilla[0], texto: formulas(l.plantilla[1]), nota: 'Cópiala, cambia lo que está entre corchetes y úsala esta semana.' });
    B.push({ tipo: 'clave', items: l.clave });
    if (i === 0 && j === 0) B.push({ tipo: 'texto', texto: '<p>📒 <a href="' + recursos + '/cuaderno.pdf" download>Descarga el cuaderno de práctica en PDF</a> si prefieres trabajar en papel.</p>' });
    return { id: mid + '-l' + (j + 1), titulo: l.t, objetivo: l.obj, bloques: B, minutosEstimados: j === 3 ? 150 : 45 };
  });
  const L = m.lab, lb = [{ tipo: 'destacado', texto: L.esc }];
  L.e.forEach(([esc, cons], k) => { lb.push({ tipo: 'texto', texto: '<p><b>' + (final ? 'Parte ' : 'Escena ') + (k + 1) + ' — </b>' + esc + '</p>' });
    lb.push({ tipo: 'reflexion', rotulo: (final ? 'Tu entrega — parte ' : 'Tu respuesta — escena ') + (k + 1), pregunta: cons,
      ayuda: final ? 'Hazlo sobre un caso real o que conozcas bien. Guarda tu texto: al final tendrás tu proyecto completo.' : 'Escribe como si estuvieras ahí. No hay una sola respuesta correcta.' }); });
  lb.push({ tipo: 'practica', rotulo: 'Revisa tus decisiones', preguntas: L.p.map(q => preg(q, 3)) });
  lb.push({ tipo: 'plantilla', rotulo: L.pl[0], texto: formulas(L.pl[1]), nota: final ? 'Úsala como índice de tu proyecto final.' : 'Cópiala y úsala en tu vida diaria o en tu trabajo.' });
  if (final) {
    lb.push({ tipo: 'destacado', texto: '<b>¡Felicidades, terminaste el diplomado!</b> Recorriste ' + S.modulos.length + ' módulos, ' + (S.modulos.length * 4) + ' lecciones, ' + S.modulos.length + ' laboratorios y tu proyecto final. Guarda tu proyecto: es la evidencia de lo que ya sabes hacer. Al aprobar las evaluaciones podrás descargar tu constancia de Instituto Mara.' });
    lb.push({ tipo: 'texto', texto: '<h3>Fuentes y lecturas recomendadas</h3><ul>' + S.referencias.map(r => '<li>' + r + '</li>').join('') + '</ul>' });
  }
  lecciones.push({ id: mid + '-lab', titulo: (final ? 'Proyecto final — ' : 'Laboratorio del módulo ' + (i + 1) + ' — ') + L.t, objetivo: L.obj, bloques: lb, minutosEstimados: 90 });
  return { id: mid, titulo: m.t, resumen: m.r + (final ? ' Cierra con el proyecto final del diplomado.' : ' Incluye un reto y un laboratorio de simulación.'), lecciones,
    quiz: { titulo: final ? 'Evaluación final del diplomado' : 'Evaluación del módulo ' + (i + 1), preguntas: m.quiz.map(q => preg(q, 4)) } };
});
const curso = { id: S.id, nombre: S.nombre, idioma: 'es-MX', color: S.color, nivel: 'Diplomados', familia: S.familia || 'Desarrollo humano', periodoTipo: null, periodoNum: null,
  desc: S.desc, horas: HORAS, precio: PRECIO, publicado: true, proximamente: false, revisionContenido: REV, modulos };

// Horas estimadas (mismo modelo calibrado de los diplomados)
const Bs = modulos.flatMap(m => m.lecciones).flatMap(l => l.bloques);
const refl = Bs.filter(b => b.tipo === 'reflexion').length, npl = Bs.filter(b => b.tipo === 'plantilla').length;
const np = Bs.reduce((a, b) => a + (b.preguntas || []).length, 0) + modulos.reduce((a, m) => a + m.quiz.preguntas.length, 0);
const w = JSON.stringify(modulos).replace(/<[^>]+>/g, ' ').split(/\s+/).length / 1000;
const est = -0.028 * w + 0.291 * refl + 0.074 * np - 0.06 * npl;
const pos = [0, 0, 0, 0]; modulos.forEach(m => { m.lecciones.forEach(l => l.bloques.forEach(b => (b.preguntas || []).forEach(q => pos[q.correcta]++))); m.quiz.preguntas.forEach(q => pos[q.correcta]++); });
console.log(`${S.id}: ${modulos.length} módulos, ${modulos.reduce((a, m) => a + m.lecciones.length, 0)} lecciones, ${refl} reflexiones, ${np} preguntas, ${Math.round(w * 1000)} palabras · estimado ${est.toFixed(1)} h (declaradas ${HORAS}) · posiciones correctas ${pos.join('/')}`);
if (est < HORAS) { console.error('ERROR: el estimado (' + est.toFixed(1) + ' h) no alcanza las ' + HORAS + ' h declaradas'); process.exit(1); }
if (simular) process.exit(0);

// ---------- Escritura ----------
// 1) Catálogo
const cPath = path.join(RAIZ, 'plataforma/cursos', ARCH);
let lineas = fs.existsSync(cPath) ? fs.readFileSync(cPath, 'utf8').split('\n').filter(Boolean) : ['/* Diplomados nuevos (octubre 2026). Generado con herramientas/crear-diplomado.js */'];
const linea = 'window.CURSOS_MARA = window.CURSOS_MARA || []; window.CURSOS_MARA.push(' + JSON.stringify(curso) + ');';
const k = lineas.findIndex(l => l.includes('window.CURSOS_MARA.push({"id":"' + S.id + '"'));
if (k >= 0) lineas[k] = linea; else lineas.push(linea);
fs.writeFileSync(cPath, lineas.join('\n') + '\n');
const aula = path.join(RAIZ, 'plataforma/index.html'); let ah = fs.readFileSync(aula, 'utf8');
if (!ah.includes('cursos/' + ARCH)) ah = ah.replace(/(<script src="cursos\/rutas\.js)/, '<script src="cursos/' + ARCH + '?v=' + REV + '"></script>\n$1');
ah = ah.replace(new RegExp('(cursos/' + ARCH.replace('.', '\\.') + '\\?v=)[0-9a-z]+'), '$1' + REV + Date.now().toString(36).slice(-3));
fs.writeFileSync(aula, ah);
// 2) Visuales SVG
const dirR = path.join(RAIZ, 'plataforma', recursos); fs.mkdirSync(path.join(dirR, 'visuales'), { recursive: true });
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hex = S.color.slice(1), rgb = [0, 2, 4].map(i => parseInt(hex.substr(i, 2), 16));
const tinte = '#' + rgb.map(v => Math.round(v + (255 - v) * 0.9).toString(16).padStart(2, '0')).join('');
const oscuro = '#' + rgb.map(v => Math.round(v * 0.45).toString(16).padStart(2, '0')).join('');
function partir(t, n) { const w = t.split(' '), r = ['']; for (const x of w) { if ((r[r.length - 1] + ' ' + x).trim().length > n) r.push(x); else r[r.length - 1] = (r[r.length - 1] + ' ' + x).trim(); } return r; }
modulos.forEach((m, i) => {
  const items = m.lecciones.map(l => l.titulo); let y = 80, cuerpo = '';
  items.forEach((t, j) => { const ln = partir((j + 1 < items.length ? (j + 1) + '. ' : '★ ') + t, 58).slice(0, 2); const h = 34 + ln.length * 24;
    cuerpo += `<rect x="36" y="${y}" width="728" height="${h}" rx="14" fill="${j + 1 < items.length ? 'white' : S.color}"/>` + ln.map((s, q) => `<text x="56" y="${y + 40 + q * 24}" font-family="sans-serif" font-size="20" fill="${j + 1 < items.length ? oscuro : 'white'}">${esc(s)}</text>`).join('');
    y += h + 14; });
  const H = y + 24;
  fs.writeFileSync(path.join(dirR, 'visuales', m.id + '.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 ${H}" role="img"><title>${esc(m.titulo)}</title><rect width="800" height="${H}" rx="24" fill="${tinte}"/><text x="36" y="50" font-family="sans-serif" font-size="22" fill="${oscuro}">MÓDULO ${i + 1} · ${esc(m.titulo.toUpperCase()).slice(0, 52)}</text>${cuerpo}</svg>`);
});
// 3) Cuaderno .md y PDF
let md = `# Cuaderno de trabajo — ${S.nombre.replace(/^Diplomado en /, '')}\n\nInstituto Mara · ${HORAS} horas de trabajo activo. Úsalo junto con la plataforma: aquí están los retos, las prácticas aplicadas y los laboratorios para trabajarlos en papel.\n\n## Cómo trabajar\n\nPor lección: lectura (10 min), caso y comprobación (10 min), práctica aplicada (20 min), contraste con el modelo y revisión (5 min).\n\n`;
S.modulos.forEach((m, i) => { md += `\n## ${i + 1}. ${m.t}\n\n### Reto · 90 minutos\n\n${m.reto.texto}\n\n**Entregable:** ${m.reto.entregable}\n\n**Autoevaluación:** ${m.reto.criterios}\n\n`;
  m.lecciones.forEach((l, j) => { md += `### ${i + 1}.${j + 1} ${l.t}\n\n${l.refl}\n\n**Contraste:** ${l.modelo}\n\n**Mi revisión:** ______________________________________________\n\n`; });
  md += `### ${i === S.modulos.length - 1 ? 'Proyecto final' : 'Laboratorio'} — ${m.lab.t}\n\n${m.lab.esc}\n\n` + m.lab.e.map(([e, c], k) => `**${k + 1}.** ${e}\n\n${c}\n\n`).join('');
});
md += `\n## Fuentes y lecturas recomendadas\n\n` + S.referencias.map(r => '- ' + r).join('\n') + '\n';
md = md.replace(/<[^>]+>/g, '');
fs.writeFileSync(path.join(dirR, 'cuaderno.md'), md);
execFileSync('python3', [path.join(__dirname, 'cuaderno-pdf.py'), path.join(dirR, 'cuaderno.md'), path.join(dirR, 'cuaderno.pdf'), S.color]);
// 4) Sitio: oferta, destacados y temario
const recorta = (t, n) => { if (t.length <= n) return t; const s = t.slice(0, n); return s.slice(0, s.lastIndexOf(' ')).replace(/[,;:.]$/, '') + '…'; };
const sPath = path.join(RAIZ, 'sitio-web/index.html'); let html = fs.readFileSync(sPath, 'utf8');
function upsert(nombre, obj) { const re = new RegExp('var ' + nombre + ' = (\\[.*?\\]);', 's'); const arr = JSON.parse(html.match(re)[1]);
  const i = arr.findIndex(x => x.id === obj.id); if (i >= 0) arr[i] = obj; else arr.push(obj); html = html.replace(re, () => 'var ' + nombre + ' = ' + JSON.stringify(arr) + ';'); }
upsert('OFERTA', { id: S.id, n: S.nombre, f: 'Diplomados', h: HORAS, p: PRECIO, d: recorta(S.desc, 148) });
upsert('DESTACADOS', { id: S.id, n: S.nombre, tipo: 'Diplomado', h: HORAS, p: PRECIO, color: S.color, d: recorta(S.desc, 128), a: S.aprender.slice(0, 3), nuevo: true });
fs.writeFileSync(sPath, html);
const tPath = path.join(RAIZ, 'sitio-web/temarios.json'), T = JSON.parse(fs.readFileSync(tPath, 'utf8'));
const INTER = ['practica', 'completar', 'relacionar', 'tarjetas', 'reflexion'];
T[S.id] = { n: S.nombre, tipo: 'Diplomado', f: 'Diplomados', h: HORAS, p: PRECIO, d: S.desc, a: S.aprender,
  m: modulos.map(m => ({ t: m.titulo, r: m.resumen, l: m.lecciones.map(l => l.titulo) })),
  s: { mod: modulos.length, lec: modulos.reduce((a, m) => a + m.lecciones.length, 0), ej: Bs.filter(b => INTER.includes(b.tipo)).length, xl: 0 } };
fs.writeFileSync(tPath, JSON.stringify(T));
// 5) SQL acumulado (se regenera con todos los diplomados del archivo)
global.window = {}; eval(fs.readFileSync(cPath, 'utf8'));
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const filas = window.CURSOS_MARA.map(c => `  (${q(c.id)}, ${q(c.nombre)}, ${q(c.desc)}, ${q(c.color)}, 'Diplomados', ${q(c.familia)}, null, null, ${c.horas}, ${c.precio}, true, false)`);
fs.writeFileSync(path.join(RAIZ, 'backend/diplomados-nuevos-202610.sql'), `-- Instituto Mara — diplomados nuevos (octubre 2026). Se puede repetir.\ninsert into cursos (id, nombre, descripcion, color, nivel, familia, periodo_tipo, periodo_num, horas, precio, publicado, proximamente) values\n${filas.join(',\n')}\non conflict (id) do update set\n  nombre = excluded.nombre, descripcion = excluded.descripcion, color = excluded.color,\n  nivel = excluded.nivel, familia = excluded.familia, horas = excluded.horas, precio = excluded.precio,\n  publicado = excluded.publicado, proximamente = excluded.proximamente;\n`);
console.log('Escrito: catálogo, ' + modulos.length + ' visuales, cuaderno PDF, sitio, temario y SQL.');
