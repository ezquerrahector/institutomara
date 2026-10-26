/* Divide el catálogo para que el aula cargue rápido.
   Uso: node herramientas/dividir-catalogo.js

   Las FUENTES siguen siendo plataforma/cursos/*.js (las que editan
   crear-diplomado.js, ampliar-curso.js, editar-curso.js, etc.). Este script
   genera a partir de ellas:
     · plataforma/cursos/indice.js       → todos los programas SIN el contenido
                                            de las lecciones (nombres, temario,
                                            minutos, ejercicios, nº de preguntas).
                                            Es lo único que se baja al abrir el aula.
     · plataforma/cursos/contenido/<id>.js → bloques de cada lección y preguntas de
                                            cada evaluación; el aula lo pide solo
                                            cuando el alumno abre ese programa.
   y actualiza la versión de indice.js en plataforma/index.html.

   Hay que correrlo cada vez que cambie cualquier archivo de plataforma/cursos/.
   Los scripts de herramientas que escriben cursos ya lo llaman solos al final. */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const RAIZ = path.join(__dirname, '..');
const DIR = path.join(RAIZ, 'plataforma/cursos');
const DIR_CONT = path.join(DIR, 'contenido');
const GENERADOS = ['indice.js', 'rutas.js'];

/* Orden en que el aula registraba los archivos (define el orden del catálogo).
   Un archivo nuevo de cursos que no esté aquí se agrega al final, en orden alfabético. */
const ORDEN = ['ingles-a1.js', 'ia-general.js', 'ia-profesiones.js', 'office.js',
  'catalogo-2.js', 'catalogo-3.js', 'catalogo-4.js', 'catalogo-5.js', 'catalogo-6.js',
  'catalogo-7.js', 'catalogo-8.js', 'persuasion-etica.js', 'estoicismo-vida-moderna.js',
  'diplomados-2026-10.js'];

function fuentes() {
  const hay = fs.readdirSync(DIR).filter(f => f.endsWith('.js') && GENERADOS.indexOf(f) < 0);
  const extra = hay.filter(f => ORDEN.indexOf(f) < 0).sort();
  return ORDEN.filter(f => hay.indexOf(f) >= 0).concat(extra);
}

/* Mismo cálculo de minutos y ejercicios que usa el aula (interactivo.js). */
function cargarMI() {
  const ctx = { window: {}, document: { createElement: () => ({ style: {} }), head: { appendChild() {} },
    getElementById: () => null, addEventListener() {} }, navigator: {}, setTimeout, console };
  ctx.window.window = ctx.window; ctx.window.document = ctx.document;
  vm.createContext(ctx);
  vm.runInContext('var window = this.window; ' + fs.readFileSync(path.join(RAIZ, 'plataforma/interactivo.js'), 'utf8'), ctx);
  return ctx.window.MI;
}

function huella(s) { return crypto.createHash('sha256').update(s).digest('hex').slice(0, 10); }

function dividir() {
  const MI = cargarMI();
  const ctx = { window: { CURSOS_MARA: [] } }; ctx.window.window = ctx.window;
  vm.createContext(ctx);
  for (const f of fuentes()) vm.runInContext('var window = this.window; ' + fs.readFileSync(path.join(DIR, f), 'utf8'), ctx);
  const cursos = JSON.parse(JSON.stringify(ctx.window.CURSOS_MARA));

  const ids = new Set();
  fs.mkdirSync(DIR_CONT, { recursive: true });
  const indice = [];
  for (const c of cursos) {
    if (ids.has(c.id)) throw new Error('Programa repetido en las fuentes: ' + c.id);
    ids.add(c.id);
    const contenido = { l: {}, q: {} };
    const esq = Object.assign({}, c, { modulos: [] });
    for (const m of c.modulos || []) {
      const em = Object.assign({}, m, { lecciones: [] });
      for (const l of m.lecciones || []) {
        const el = Object.assign({}, l);
        delete el.bloques;
        el._min = MI.minutos(l);
        el._nej = MI.contarEjercicios(l);
        el._nb = (l.bloques || []).length;
        contenido.l[l.id] = l.bloques || [];
        em.lecciones.push(el);
      }
      if (m.quiz) {
        contenido.q[m.id] = m.quiz.preguntas || [];
        /* Se conserva el número de preguntas (la portada del programa lo muestra);
           el texto de cada pregunta llega con el contenido. */
        em.quiz = Object.assign({}, m.quiz, { preguntas: (m.quiz.preguntas || []).map(() => 0) });
      }
      esq.modulos.push(em);
    }
    const txt = JSON.stringify(contenido);
    esq._v = huella(txt);
    esq._parcial = true;
    fs.writeFileSync(path.join(DIR_CONT, c.id + '.js'),
      '/* Contenido de «' + String(c.nombre).replace(/\*\//g, '') + '». Archivo generado con herramientas/dividir-catalogo.js: no se edita a mano. */\n' +
      'window.MARA_CONTENIDO(' + JSON.stringify(c.id) + ',' + txt + ');\n');
    indice.push(esq);
  }
  /* Quita contenido de programas que ya no existen */
  for (const f of fs.readdirSync(DIR_CONT)) if (f.endsWith('.js') && !ids.has(f.slice(0, -3))) fs.unlinkSync(path.join(DIR_CONT, f));

  const cuerpo = 'window.CURSOS_MARA = window.CURSOS_MARA || [];\n' +
    indice.map(c => 'window.CURSOS_MARA.push(' + JSON.stringify(c) + ');').join('\n') + '\n';
  const ind = '/* Índice del catálogo (sin el contenido de las lecciones). Archivo generado con\n' +
    '   herramientas/dividir-catalogo.js a partir de las fuentes de plataforma/cursos/: no se edita a mano. */\n' + cuerpo;
  fs.writeFileSync(path.join(DIR, 'indice.js'), ind);

  /* Versión de indice.js en el aula, para que el navegador no use una copia vieja */
  const rutaHtml = path.join(RAIZ, 'plataforma/index.html');
  const html = fs.readFileSync(rutaHtml, 'utf8');
  const nuevo = html.replace(/cursos\/indice\.js\?v=[A-Za-z0-9]+/, 'cursos/indice.js?v=' + huella(ind));
  if (nuevo !== html) fs.writeFileSync(rutaHtml, nuevo);
  else if (html.indexOf('cursos/indice.js?v=') < 0) console.warn('Aviso: plataforma/index.html no carga cursos/indice.js');

  const kb = n => Math.round(n / 1024) + ' KB';
  console.log('Catálogo dividido: ' + indice.length + ' programas · índice ' + kb(ind.length) +
    ' · contenido en plataforma/cursos/contenido/');
}

if (require.main === module) dividir();
module.exports = dividir;
