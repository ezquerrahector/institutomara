// Asigna el área («a») a cada programa de la oferta del sitio. Uso: node herramientas/areas-sitio.js
const fs = require('fs'), path = require('path');
const P = path.join(__dirname, '../sitio-web/index.html'); let html = fs.readFileSync(P, 'utf8');
const POR_FAMILIA = { 'Idiomas':'Idiomas', 'IA aplicada':'Tecnología e IA', 'Tecnología':'Tecnología e IA', 'IA por profesión':'IA para tu profesión',
  'Salud y bienestar':'Psicología y salud', 'Desarrollo humano':'Desarrollo humano', 'Negocios y finanzas':'Negocios y oficina', 'Administración y oficina':'Negocios y oficina' };
const POR_ID = {
  'd-tanatologia':'Psicología y salud','d-adulto-mayor':'Psicología y salud','d-tcc':'Psicología y salud','d-terapias-contextuales':'Psicología y salud',
  'd-evaluacion-clinica':'Psicología y salud','d-neurodiversidad':'Psicología y salud','d-infancia-adolescencia':'Psicología y salud','d-psicologia-forense':'Psicología y salud',
  'd-nom035':'Negocios y oficina','d-contabilidad-resico':'Negocios y oficina','d-marketing-digital':'Negocios y oficina','d-proyectos':'Negocios y oficina',
  'd-recursos-humanos':'Negocios y oficina','d-asistente-administrativo':'Negocios y oficina','d-seguridad-higiene':'Negocios y oficina','d-liderazgo':'Desarrollo humano',
  'diplomado-persuasion-etica':'Desarrollo humano','diplomado-estoicismo-vida-moderna':'Desarrollo humano','d-seduccion-atraccion':'Desarrollo humano',
  'd-imagen-personal':'Desarrollo humano','d-lenguaje-corporal':'Desarrollo humano','c-canva':'Negocios y oficina','c-fotografia-producto':'Negocios y oficina',
  'c-comunicacion':'Desarrollo humano','c-productividad':'Desarrollo humano','c-ia-psicologos':'IA para tu profesión'
};
const re = /var OFERTA = (\[.*?\]);/s, O = JSON.parse(html.match(re)[1]);
O.forEach(o => { o.a = POR_ID[o.id] || o.a || POR_FAMILIA[o.f] || 'Desarrollo humano'; });
html = html.replace(re, () => 'var OFERTA = ' + JSON.stringify(O) + ';'); fs.writeFileSync(P, html);
const c = {}; O.forEach(o => c[o.a] = (c[o.a] || 0) + 1); console.log(c);
