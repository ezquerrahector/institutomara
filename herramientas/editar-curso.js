// Uso: const {editar}=require('./editar-curso'); editar('id', c => { ... });
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'plataforma', 'cursos');
exports.editar = function (id, fn) {
  const pref = 'window.CURSOS_MARA.push({"id":"' + id + '"';
  const archivo = fs.readdirSync(dir).find(f => f.endsWith('.js') && fs.readFileSync(path.join(dir, f), 'utf8').includes(pref));
  if (!archivo) throw new Error('No encontré ' + id);
  const ruta = path.join(dir, archivo), lineas = fs.readFileSync(ruta, 'utf8').split('\n');
  const idx = lineas.findIndex(l => l.startsWith(pref));
  const c = JSON.parse(lineas[idx].slice('window.CURSOS_MARA.push('.length, lineas[idx].lastIndexOf(')')));
  fn(c);
  lineas[idx] = 'window.CURSOS_MARA.push(' + JSON.stringify(c) + ');';
  fs.writeFileSync(ruta, lineas.join('\n'));
  return archivo;
};
