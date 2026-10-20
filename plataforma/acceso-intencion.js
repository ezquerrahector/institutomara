/* Instituto Mara — Pantalla de acceso según lo que la persona eligió en el sitio (19 oct 2026).
   Se carga al final.

   · Si llega desde el sitio con un curso, ruta, regalo, membresía o el plan para empresas,
     el lado izquierdo muestra lo que eligió y los pasos (crear cuenta → pagar → empezar),
     y la pantalla abre en «Crear cuenta», con «¿Ya tienes cuenta? Entra».
   · Lo que eligió se guarda en este dispositivo: al confirmar el correo (o al entrar con
     Google) regresa justo a eso, en lugar de llegar al aula sin nada. */

var INT = { clave:'institutoMara.intencion', vigencia:2 * 864e5 };
var INT_LLAVES = ['curso', 'ir', 'regalar', 'cupon'];

function intLeer(){
  try { var x = JSON.parse(localStorage.getItem(INT.clave) || 'null'); return x && Date.now() - x.t < INT.vigencia ? x : null; } catch(e){ return null; }
}
function intGuardar(q){ try { localStorage.setItem(INT.clave, JSON.stringify({ q:q, t:Date.now() })); } catch(e){} }
function intOlvidar(){ try { localStorage.removeItem(INT.clave); } catch(e){} }

/* 1. Guardar lo elegido o, si regresa sin nada (confirmación de correo, Google), recuperarlo. */
(function(){
  var p = new URLSearchParams(location.search), q = new URLSearchParams(), hay = false;
  INT_LLAVES.forEach(function(k){ if(p.get(k)){ q.set(k, p.get(k)); hay = true; } });
  if(p.get('pago') || p.get('plan') || p.get('membresia') || p.get('regalo') || p.get('empresa')) return;   // regresos de Mercado Pago
  if(hay){ intGuardar('?' + q.toString()); return; }
  var g = intLeer();
  if(g && !p.get('muestra')) history.replaceState(null, '', location.pathname + g.q + location.hash);
})();

/* Lo que se muestra a la izquierda según lo elegido. */
function intDescribir(){
  var p = new URLSearchParams(location.search), cid = p.get('curso'), irA = p.get('ir');
  var pasos = function(a, b, c){ return [a, b, c]; };
  if(cid && p.get('regalar') && typeof programa === 'function' && programa(cid)){
    var g = programa(cid);
    return { ante:'Estás por regalar', titulo:g.nombre, precio:g.precio ? dinero(g.precio) : '',
      pasos:pasos('Crea tu cuenta (1 minuto)', 'Paga con Mercado Pago: tarjeta, OXXO o transferencia', 'Elige cuándo le llega el regalo a la persona'), det:g.cursos ? { ruta:g } : { curso:cid } };
  }
  if(cid && typeof ruta === 'function' && ruta(cid)){
    var r = ruta(cid);
    return { ante:'Estás por inscribirte a la ruta', titulo:r.nombre, precio:r.precio ? dinero(r.precio) + ' · pago único' : '',
      pasos:pasos('Crea tu cuenta (1 minuto)', 'Paga con Mercado Pago: tarjeta, OXXO o transferencia', 'Empiezas hoy, a tu ritmo, y al terminar cada programa obtienes tu constancia'), det:{ ruta:r } };
  }
  if(cid && typeof curso === 'function' && curso(cid)){
    var c = curso(cid);
    return { ante:'Estás por inscribirte a', titulo:c.nombre, precio:c.precio ? dinero(c.precio) + ' · pago único' : '',
      pasos:pasos('Crea tu cuenta (1 minuto)', 'Paga con Mercado Pago: tarjeta, OXXO o transferencia', 'Empiezas hoy, a tu ritmo, y al terminar obtienes tu constancia con folio y QR verificable'), det:{ curso:cid } };
  }
  if(irA === 'membresia'){
    return { ante:'Estás por suscribirte a la', titulo:'Membresía Instituto Mara', precio:typeof precioPlan === 'function' ? 'Desde ' + dinero(precioPlan('esencial')) + ' al mes' : '',
      pasos:pasos('Crea tu cuenta (1 minuto)', 'Elige tu membresía y paga con Mercado Pago', 'Entras a los programas que quieras desde hoy; cancelas cuando quieras'), det:{ membresia:true } };
  }
  if(irA === 'regalos'){
    return { ante:'Estás por', titulo:'Regalar un curso o diplomado', precio:'',
      pasos:pasos('Crea tu cuenta (1 minuto)', 'Elige el curso o diplomado y paga con Mercado Pago', 'Elige cuándo le llega el regalo a la persona'), det:{ regalos:true } };
  }
  if(irA === 'empresas'){
    var r1 = (INT.rangos || []).filter(function(x){ return x.activo !== false; }).sort(function(a, b){ return a.desde - b.desde; })[0];
    var desde = r1 ? 'Desde ' + dinero(r1.precio_mensual) + ' al mes para hasta ' + r1.hasta + ' personas' : 'Desde $1,490 al mes para hasta 5 personas';
    return { ante:'Estás por contratar el', titulo:'Plan para tu equipo', precio:desde,
      pasos:pasos('Crea tu cuenta de administrador (1 minuto)', 'Elige cuántas personas y paga con Mercado Pago', 'Registra a tu equipo y ve su avance y sus constancias'),
      det:{ empresas:true },
      extra:'<p class="int-extra">¿Prefieren probar primero? <a href="../sitio-web/index.html#prueba-empresas">Pidan su prueba sin costo, sin crear cuenta →</a></p>' };
  }
  return null;
}

/* Cuántos cursos y diplomados hay (del mismo archivo que usa el sitio). */
function intCuenta(){
  var T = INT.temarios; if(!T) return null;
  var c = 0, d = 0; for(var k in T){ if(T[k].tipo === 'Diplomado') d++; else c++; }
  return { c:c, d:d };
}

/* Desplegable «Ver temario y lo que vas a aprender»: se llena con el mismo temario del sitio. */
function intDetalle(det, abierto){
  if(!det) return '';
  var cuerpo = '', titulo = 'Ver temario y lo que vas a aprender', ficha = '';
  var li = function(l){ return '<ul>' + l.map(function(t){ return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>'; };
  if(det.curso){
    var t = INT.temarios && INT.temarios[det.curso];
    if(!t) return INT.temarios === undefined ? '<p class="int-cargando">Cargando temario…</p>' : '';
    var s = t.s || {}, datos = [t.h ? t.h + ' horas' : '', s.mod ? s.mod + ' módulos' : '', s.lec ? s.lec + ' lecciones' : '', s.ej ? s.ej + ' ejercicios' : ''].filter(Boolean).join(' · ');
    cuerpo = (datos ? '<p class="int-datos">' + esc(datos) + '</p>' : '') +
      (t.d ? '<p>' + esc(t.d) + '</p>' : '') +
      (t.a && t.a.length ? '<h3>Lo que vas a aprender</h3>' + li(t.a) : '') +
      (t.m && t.m.length ? '<h3>Temario</h3><ol class="int-mods">' + t.m.map(function(m, i){ return '<li><b>Módulo ' + (i + 1) + '. ' + esc(m.t) + '</b>' + (m.r ? '<span>' + esc(m.r) + '</span>' : '') + '</li>'; }).join('') + '</ol>' : '');
    ficha = '<a class="int-ficha" href="../sitio-web/index.html#programa-' + encodeURIComponent(det.curso) + '" target="_blank" rel="noopener">Ver ficha completa en el sitio ↗</a>';
  } else if(det.ruta){
    var r = det.ruta, T = INT.temarios || {};
    titulo = 'Ver programas que incluye';
    cuerpo = (r.desc ? '<p>' + esc(r.desc) + '</p>' : '') +
      '<h3>Incluye ' + r.cursos.length + ' programas' + (r.horas ? ' · ' + r.horas + ' horas' : '') + '</h3>' +
      '<ol class="int-mods">' + r.cursos.map(function(id){ var c = (typeof curso === 'function' && curso(id)) || T[id] || {}, n = c.nombre || c.n || id, h = c.horas || c.h;
        return '<li><b>' + esc(n) + '</b>' + (h ? '<span>' + h + ' horas · <a href="../sitio-web/index.html#programa-' + encodeURIComponent(id) + '" target="_blank" rel="noopener">ver temario ↗</a></span>' : '') + '</li>'; }).join('') + '</ol>' +
      (r.suma && r.precio ? '<p class="int-datos">Por separado costarían ' + esc(dinero(r.suma)) + '; en la ruta ahorras ' + esc(dinero(r.suma - r.precio)) + '.</p>' : '');
  } else if(det.membresia){
    titulo = 'Ver planes y qué incluye';
    var cu = intCuenta(), pr = function(k, n){ return typeof precioPlan === 'function' ? precioPlan(k) : n; };
    var cursosTxt = cu ? 'Los ' + cu.c + ' cursos' : 'Todos los cursos', todo = cu ? cu.c + ' cursos y ' + cu.d + ' diplomados' : 'cursos y diplomados';
    cuerpo = [['Esencial', pr('esencial', 249), 'al mes', [cursosTxt + ': idiomas, Excel, IA, salud y negocios', 'IA para tu profesión incluida', 'Constancia con folio en cada curso', 'Cancelas cuando quieras']],
      ['Total', pr('total', 449), 'al mes', ['Todo el catálogo: ' + todo, 'Programas nuevos sin costo extra', 'Constancia con folio en cada programa', 'Cancelas cuando quieras']],
      ['Anual Total', pr('anual', 3990), 'al año', ['Todo lo de Total durante 12 meses', 'Un solo pago (tarjeta, OXXO o transferencia)', 'Sin renovación automática']]]
      .map(function(p){ return '<h3>' + esc(p[0]) + ' · ' + esc(dinero(p[1])) + ' ' + p[2] + '</h3>' + li(p[3]); }).join('') +
      '<p class="int-datos">Eliges tu plan después de crear tu cuenta.</p>';
  } else if(det.regalos){
    titulo = 'Ver cómo funciona el regalo';
    var cr = intCuenta();
    cuerpo = '<p>Tú lo pagas y la otra persona recibe un correo con tu mensaje y su código, en la fecha que elijas. También se lo puedes mandar por WhatsApp. Ideal para cumpleaños, graduaciones o para tu equipo.</p>' +
      (cr ? '<p class="int-datos">Puedes elegir entre ' + cr.c + ' cursos y ' + cr.d + ' diplomados.</p>' : '') +
      '<a class="int-ficha" href="../sitio-web/index.html#explorar" target="_blank" rel="noopener">Ver el catálogo en el sitio ↗</a>';
  } else if(det.empresas){
    titulo = 'Ver qué incluye y precios';
    var R = (INT.rangos || []).filter(function(x){ return x.activo !== false; }).sort(function(a, b){ return a.desde - b.desde; });
    cuerpo = '<h3>Incluye</h3>' + li(['Todos los cursos y diplomados (más de 80): NOM-035, liderazgo, Excel, servicio, idiomas, IA y más',
        'Cada persona toma los que necesite', 'Panel con el avance de cada persona y reporte en Excel o PDF',
        'Constancia con folio y QR verificable para cada quien', 'Factura disponible']) +
      (R.length ? '<h3>Precio al mes, IVA incluido</h3><table class="int-tabla">' + R.map(function(x){
          return '<tr><td>' + (x.desde <= 1 ? 'Hasta ' + x.hasta : x.desde + ' a ' + x.hasta) + ' personas</td><td>' + esc(dinero(x.precio_mensual)) + '</td></tr>'; }).join('') +
        '<tr><td>Más de ' + R[R.length - 1].hasta + ' personas</td><td>Cotización</td></tr></table>' : '') +
      '<p class="int-datos">Puedes cambiar el número de lugares cuando lo necesites.</p>';
  }
  return '<details class="int-det"' + (abierto ? ' open' : '') + '><summary>' + esc(titulo) + '</summary><div class="int-det-c">' + cuerpo + ficha + '</div></details>';
}

var _intArte = null;
function intPintar(){
  var pant = $('pantallaLogin'), arte = pant && pant.querySelector('.login-arte');
  if(!arte || pant.classList.contains('oculto')) return;
  var d = intDescribir();
  if(!d) return;
  if(_intArte === null) _intArte = arte.innerHTML;
  var abierto = !!arte.querySelector('details.int-det[open]');
  var logo = arte.querySelector('svg') ? arte.querySelector('svg').outerHTML : '';
  var paloma = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  arte.innerHTML = logo +
    '<p class="int-ante">' + esc(d.ante) + '</p>' +
    '<h1 class="int-titulo">' + esc(d.titulo) + '</h1>' +
    (d.precio ? '<p class="int-precio">' + esc(d.precio) + '</p>' : '') +
    intDetalle(d.det, abierto) +
    '<ol class="int-pasos">' + d.pasos.map(function(t, i){ return '<li><span>' + (i + 1) + '</span>' + esc(t) + '</li>'; }).join('') + '</ol>' +
    (d.extra || '') +
    '<ul class="login-lista int-lista"><li>' + paloma + 'Tu avance se guarda solo</li><li>' + paloma + 'Constancia con folio y QR verificable</li></ul>';
  // Abre en «Crear cuenta» y explica que regresa aquí después de confirmar el correo.
  if($('tabCrear') && !$('tabCrear').classList.contains('activa')) $('tabCrear').click();
  var sub = $('formCrear') && $('formCrear').querySelector('h2 + p');
  if(sub) sub.textContent = 'Solo toma un minuto. Te mandamos un correo para confirmarla y, al confirmarla, regresas aquí para continuar.';
  if($('formCrear') && !$('int-ya')){
    $('formCrear').insertAdjacentHTML('beforeend', '<p id="int-ya" style="text-align:center;margin-top:12px;font-size:.92rem">¿Ya tienes cuenta? <a href="#" onclick="$(\'tabEntrar\').click();return false" style="color:var(--morado);font-weight:600">Entra</a></p>');
  }
}
(function(){
  var css = document.createElement('style');
  css.textContent = '.int-ante{color:#C4B5FD;font-weight:600;margin:26px 0 4px;font-size:.95rem}' +
    '.login-arte h1.int-titulo{margin:0 0 8px;font-size:2.1rem}' +
    '@media(max-width:900px){.login-arte h1.int-titulo{font-size:1.6rem}}' +
    '.int-precio{color:#fff !important;font-weight:700;font-size:1.1rem;margin-bottom:6px}' +
    '.int-pasos{list-style:none;margin:22px 0 0;padding:0;display:flex;flex-direction:column;gap:12px;counter-reset:p}' +
    '.int-pasos li{display:flex;gap:12px;align-items:flex-start;color:#EDE9FE;font-size:.98rem;line-height:1.45}' +
    '.int-pasos span{flex:none;width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.16);color:#fff;font-weight:700;font-size:.85rem;display:flex;align-items:center;justify-content:center}' +
    '.int-extra{margin-top:20px;background:rgba(255,255,255,.1);border-radius:12px;padding:12px 14px;color:#EDE9FE !important;max-width:none !important}' +
    '.int-extra a{color:#fff;font-weight:700}' +
    '.int-lista{margin-top:22px}' +
    '.int-det{margin:14px 0 0;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:12px;max-width:560px}' +
    '.int-det summary{cursor:pointer;padding:11px 14px;font-weight:700;color:#fff;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:10px}' +
    '.int-det summary::-webkit-details-marker{display:none}' +
    '.int-det summary::after{content:"▾";transition:transform .2s}' +
    '.int-det[open] summary::after{transform:rotate(180deg)}' +
    '.int-det summary:focus-visible{outline:2px solid #fff;outline-offset:2px;border-radius:12px}' +
    '.int-det-c{padding:0 14px 14px;color:#EDE9FE;font-size:.93rem;line-height:1.5}' +
    '@media(min-width:901px){.int-det-c{max-height:34vh;overflow:auto;margin-right:4px}}' +
    '.int-det-c p{margin:0 0 10px;color:#EDE9FE !important;max-width:none !important}' +
    '.int-det-c h3{font-size:.95rem;color:#fff;margin:14px 0 6px}' +
    '.int-det-c ul{margin:0;padding-left:18px}.int-det-c ul li{margin-bottom:4px}' +
    '.int-mods{margin:0;padding-left:0;list-style:none;display:flex;flex-direction:column;gap:8px}' +
    '.int-mods b{display:block;color:#fff;font-weight:600}.int-mods span{display:block;color:#DDD6FE;font-size:.88rem}' +
    '.int-mods a,.int-ficha{color:#fff;font-weight:600}' +
    '.int-ficha{display:inline-block;margin-top:12px}' +
    '.int-datos{color:#C4B5FD !important;font-weight:600}' +
    '.int-cargando{color:#C4B5FD !important;margin-top:10px}' +
    '.int-tabla{width:100%;border-collapse:collapse}.int-tabla td{padding:5px 0;border-bottom:1px solid rgba(255,255,255,.12)}.int-tabla td+td{text-align:right;font-weight:700;color:#fff}';
  document.head.appendChild(css);
  intPintar();
  // Los precios llegan del servidor un momento después: se vuelve a pintar.
  setTimeout(intPintar, 1500);
  // El temario es el mismo que muestra el sitio.
  var qp = new URLSearchParams(location.search);
  if(qp.get('curso') || qp.get('ir') === 'membresia' || qp.get('ir') === 'regalos')
    fetch('../sitio-web/temarios.json').then(function(r){ return r.ok ? r.json() : false; })
      .then(function(t){ INT.temarios = t || false; intPintar(); }).catch(function(){ INT.temarios = false; intPintar(); });
  // El precio del plan se lee de la tabla pública de precios (no requiere sesión).
  var u = window.BD && BD.config && String(BD.config.supabaseUrl || '').replace(/\/+$/, ''), k = window.BD && BD.config && BD.config.supabaseAnonKey;
  if(new URLSearchParams(location.search).get('ir') === 'empresas' && window.NUBE && u && k)
    fetch(u + '/rest/v1/planes_rangos?select=desde,hasta,precio_mensual,activo&order=desde.asc', { headers:{ apikey:k, Authorization:'Bearer ' + k } })
      .then(function(r){ return r.ok ? r.json() : []; }).then(function(l){ INT.rangos = l || []; intPintar(); }).catch(function(){});
})();

/* 2. Ya dentro: lo elegido se usó, se olvida. */
var _entrarAppInt = entrarApp;
entrarApp = function(){ _entrarAppInt.apply(this, arguments); intOlvidar(); };
