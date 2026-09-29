// Pinta en Chromium todos los bloques de un programa (o de todos) y reporta errores. Uso: node herramientas/prueba-navegador.js [id]
const path = require('path'); const { chromium } = require(require.resolve('playwright', { paths: ['/tmp/claude-0/node_modules', process.cwd()] }));
const http = require('http'), fs = require('fs'), RAIZ = path.join(__dirname, '..'), id = process.argv[2];
const srv = http.createServer((q, r) => { const f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'application/javascript' : f.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' }); r.end(d); }); }).listen(0, async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 390, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:' + srv.address().port + '/plataforma/index.html'); await p.waitForTimeout(1500);
  const r = await p.evaluate(id => { let n = 0; const fail = []; for (const c of window.CURSOS_MARA) { if (id && c.id !== id) continue; c.modulos.forEach(m => m.lecciones.forEach(l => l.bloques.forEach((b, i) => { try { const h = pintarBloque(b, i); if (!h || h.length < 20) fail.push(l.id + ' ' + b.tipo + ' vacío'); n++; } catch (e) { fail.push(l.id + ' ' + b.tipo + ': ' + e.message); } }))); } return { n, fail }; }, id);
  const imgs = id ? await p.evaluate(async id => { const c = window.CURSOS_MARA.find(x => x.id === id); const u = c.modulos.flatMap(m => m.lecciones).flatMap(l => l.bloques).filter(b => b.tipo === 'imagen').map(b => b.url); const res = []; for (const x of u) { const r = await fetch(x); res.push(r.status); } return res; }, id) : [];
  const malos = errs.filter(e => !/supabase|fetch|Failed to load/i.test(e));
  console.log(r.fail.length || malos.length || imgs.some(s => s !== 200) ? 'FALLA ' + JSON.stringify({ fail: r.fail.slice(0, 10), errs: malos.slice(0, 5), imgs }) : 'OK ' + r.n + ' bloques, ' + imgs.length + ' imágenes');
  await b.close(); srv.close(); });
