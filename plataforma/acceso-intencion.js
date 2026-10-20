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
      pasos:pasos('Crea tu cuenta (1 minuto)', 'Paga con Mercado Pago: tarjeta, OXXO o transferencia', 'Elige cuándo le llega el regalo a la persona') };
  }
  if(cid && typeof ruta === 'function' && ruta(cid)){
    var r = ruta(cid);
    return { ante:'Estás por inscribirte a la ruta', titulo:r.nombre, precio:r.precio ? dinero(r.precio) + ' · pago único' : '',
      pasos:pasos('Crea tu cuenta (1 minuto)', 'Paga con Mercado Pago: tarjeta, OXXO o transferencia', 'Empiezas hoy, a tu ritmo, y al terminar cada programa obtienes tu constancia') };
  }
  if(cid && typeof curso === 'function' && curso(cid)){
    var c = curso(cid);
    return { ante:'Estás por inscribirte a', titulo:c.nombre, precio:c.precio ? dinero(c.precio) + ' · pago único' : '',
      pasos:pasos('Crea tu cuenta (1 minuto)', 'Paga con Mercado Pago: tarjeta, OXXO o transferencia', 'Empiezas hoy, a tu ritmo, y al terminar obtienes tu constancia con folio y QR verificable') };
  }
  if(irA === 'membresia'){
    return { ante:'Estás por suscribirte a la', titulo:'Membresía Instituto Mara', precio:typeof precioPlan === 'function' ? 'Desde ' + dinero(precioPlan('esencial')) + ' al mes' : '',
      pasos:pasos('Crea tu cuenta (1 minuto)', 'Elige tu membresía y paga con Mercado Pago', 'Entras a los programas que quieras desde hoy; cancelas cuando quieras') };
  }
  if(irA === 'regalos'){
    return { ante:'Estás por', titulo:'Regalar un curso', precio:'',
      pasos:pasos('Crea tu cuenta (1 minuto)', 'Elige el curso y paga con Mercado Pago', 'Elige cuándo le llega el regalo a la persona') };
  }
  if(irA === 'empresas'){
    var r1 = (INT.rangos || []).filter(function(x){ return x.activo !== false; }).sort(function(a, b){ return a.desde - b.desde; })[0];
    var desde = r1 ? 'Desde ' + dinero(r1.precio_mensual) + ' al mes para hasta ' + r1.hasta + ' personas' : 'Desde $1,490 al mes para hasta 5 personas';
    return { ante:'Estás por contratar el', titulo:'Plan para tu equipo', precio:desde,
      pasos:pasos('Crea tu cuenta de administrador (1 minuto)', 'Elige cuántas personas y paga con Mercado Pago', 'Registra a tu equipo y ve su avance y sus constancias'),
      extra:'<p class="int-extra">¿Prefieren probar primero? <a href="../sitio-web/index.html#prueba-empresas">Pidan su prueba sin costo, sin crear cuenta →</a></p>' };
  }
  return null;
}

var _intArte = null;
function intPintar(){
  var pant = $('pantallaLogin'), arte = pant && pant.querySelector('.login-arte');
  if(!arte || pant.classList.contains('oculto')) return;
  var d = intDescribir();
  if(!d) return;
  if(_intArte === null) _intArte = arte.innerHTML;
  var logo = arte.querySelector('svg') ? arte.querySelector('svg').outerHTML : '';
  var paloma = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  arte.innerHTML = logo +
    '<p class="int-ante">' + esc(d.ante) + '</p>' +
    '<h1 class="int-titulo">' + esc(d.titulo) + '</h1>' +
    (d.precio ? '<p class="int-precio">' + esc(d.precio) + '</p>' : '') +
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
    '.int-lista{margin-top:22px}';
  document.head.appendChild(css);
  intPintar();
  // Los precios llegan del servidor un momento después: se vuelve a pintar.
  setTimeout(intPintar, 1500);
  // El precio del plan se lee de la tabla pública de precios (no requiere sesión).
  var u = window.BD && BD.config && String(BD.config.supabaseUrl || '').replace(/\/+$/, ''), k = window.BD && BD.config && BD.config.supabaseAnonKey;
  if(new URLSearchParams(location.search).get('ir') === 'empresas' && window.NUBE && u && k)
    fetch(u + '/rest/v1/planes_rangos?select=desde,hasta,precio_mensual,activo&order=desde.asc', { headers:{ apikey:k, Authorization:'Bearer ' + k } })
      .then(function(r){ return r.ok ? r.json() : []; }).then(function(l){ INT.rangos = l || []; intPintar(); }).catch(function(){});
})();

/* 2. Ya dentro: lo elegido se usó, se olvida. */
var _entrarAppInt = entrarApp;
entrarApp = function(){ _entrarAppInt.apply(this, arguments); intOlvidar(); };
