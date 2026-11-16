/* Instituto Mara — Programa pendiente de pago (16 nov 2026).
   El agente manda una liga personal: index.html?programa=<id>&ap=<token>.
   · Antes de entrar: la pantalla de acceso dice qué programa le recomendaron y abre «Crear cuenta».
   · Al entrar: la cuenta se une a su ficha (para que la venta cuente para su agente)
     y en su inicio aparece el programa con la primera lección gratis y el botón para pagar.
     El resto del aula funciona normal: nada se bloquea.
   · Al pagar, el programa pasa a «Mis cursos» y su agente, su titular y administración lo
     ven como «Ya pagó». */

var PEND = { lista:[], llego:null };
var PEND_LLAVE = 'institutoMara.pendiente';

(function(){
  var q = new URLSearchParams(location.search), prog = q.get('programa'), ap = q.get('ap');
  if(prog || ap){
    try{ localStorage.setItem(PEND_LLAVE, JSON.stringify({ programa:prog || null, ap:ap || null, t:Date.now() })); }catch(e){}
    q.delete('programa'); q.delete('ap');
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q.toString() : '') + location.hash);
  }
  PEND.llego = pendGuardado();
  /* Pantalla de acceso: decir qué programa es y abrir «Crear cuenta». */
  var c = PEND.llego && PEND.llego.programa && typeof curso === 'function' ? curso(PEND.llego.programa) : null;
  var form = document.getElementById('formEntrar');
  if(c && form && !(window.sesion)){
    var d = document.createElement('div');
    d.className = 'aviso aviso-info'; d.style.margin = '0 0 14px';
    d.innerHTML = '<b>Te recomendaron: ' + esc(c.nombre) + '</b><br>Crea tu cuenta (1 minuto) para entrar. La primera lección es gratis; ' +
      'cuando quieras continuar, pagas desde ahí.';
    form.parentNode.insertBefore(d, form.parentNode.firstChild);
    var tab = document.getElementById('tabCrear'); if(tab && tab.onclick) setTimeout(function(){ tab.onclick(); }, 0);
  }
})();

function pendGuardado(){
  try{ var x = JSON.parse(localStorage.getItem(PEND_LLAVE) || 'null'); return x && Date.now() - x.t < 30 * 864e5 ? x : null; }catch(e){ return null; }
}
function pendOlvidar(){ try{ localStorage.removeItem(PEND_LLAVE); }catch(e){} }
function pendVisibles(){
  if(!window.sesion) return [];
  return PEND.lista.filter(function(id, i, a){ return a.indexOf(id) === i && curso(id) && !estaInscrito(sesion.id, id); });
}

/* Al entrar: unir la cuenta con su ficha y traer sus programas pendientes. */
var _entrarAppPend = entrarApp;
entrarApp = function(){
  _entrarAppPend.apply(this, arguments);
  if(!sesion || sesion.rol !== 'alumno' || !window.Nube || !Nube.empresaRpc) return;
  var g = pendGuardado();
  var ligar = g && g.ap ? Nube.empresaRpc('alumno_ligar_cuenta', { p_token:g.ap }).catch(function(){ return null; }) : Promise.resolve(null);
  ligar.then(function(){ return Nube.empresaRpc('mis_programas_pendientes', {}).catch(function(){ return []; }); })
    .then(function(l){
      PEND.lista = (l || []).map(function(x){ return typeof x === 'string' ? x : (x && x.mis_programas_pendientes) || null; }).filter(Boolean);
      if(g && g.programa && PEND.lista.indexOf(g.programa) < 0 && curso(g.programa)) PEND.lista.unshift(g.programa);
      pendOlvidar();
      if(estado.vista === 'mis-cursos') pintar();
      var p = g && g.programa;
      if(p && curso(p) && !estaInscrito(sesion.id, p)) setTimeout(function(){ pendBienvenida(p); }, 400);
    });
};

function pendBienvenida(id){
  var c = curso(id); if(!c) return;
  abrirModal('Tu programa: ' + c.nombre,
    '<p style="margin-bottom:10px">' + (c.horas ? c.horas + ' horas · ' : '') + 'acceso por 12 meses · constancia con folio y QR al terminar.</p>' +
    '<p style="margin-bottom:10px">Empieza hoy con la <b>primera lección gratis</b>. Cuando quieras continuar con el resto, pagas <b>' + dinero(c.precio) + '</b> ' +
      '(tarjeta, OXXO o transferencia) y se abre todo el programa.</p>' +
    '<p style="color:var(--gris);font-size:.9rem">Lo vas a tener siempre en tu inicio, en «Pendiente de pago».</p>',
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Después</button>' +
    '<a class="btn btn-linea" href="index.html?muestra=' + encodeURIComponent(id) + '">Ver la lección gratis</a>' +
    '<button class="btn btn-mor" onclick="cerrarModal();abrirPago(\'' + id + '\')">Pagar y continuar</button>');
}

/* Inicio del alumno: tarjeta «Pendiente de pago» arriba de sus cursos. */
function pendHtml(){
  var l = pendVisibles(); if(!l.length) return '';
  return '<div class="tarjeta" style="border:2px solid var(--morado);margin-bottom:18px">' +
    '<span class="etiqueta alerta">Pendiente de pago</span>' +
    l.map(function(id){ var c = curso(id);
      return '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;margin-top:10px">' +
        '<div><h3 style="color:var(--tinta);margin:0 0 4px">' + esc(c.nombre) + '</h3>' +
        '<p style="color:var(--gris);margin:0;font-size:.92rem">' + (c.horas ? c.horas + ' h · ' : '') + dinero(c.precio) + ' · La primera lección es gratis; paga para abrir el resto.</p></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn-linea btn-sm" href="index.html?muestra=' + encodeURIComponent(id) + '">Ver la lección gratis</a>' +
        '<button class="btn btn-mor btn-sm" onclick="abrirPago(\'' + id + '\')">Pagar y continuar</button></div></div>';
    }).join('') + '</div>';
}
var _vistaMisCursosPend = vistaMisCursos;
vistaMisCursos = function(){
  var h = _vistaMisCursosPend.apply(this, arguments), extra = pendHtml();
  if(!extra) return h;
  var marca = 'Explorar el catálogo</button></div>', i = h.indexOf(marca);   /* después del encabezado «Hola, …» */
  return i >= 0 ? h.slice(0, i + marca.length) + extra + h.slice(i + marca.length) : extra + h;
};
