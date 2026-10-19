/* Instituto Mara — Etiqueta de renovación para quien administra una empresa (19 oct 2026).
   Se carga después de empresas-plan.js. Requiere backend/renovaciones-20261019.sql.

   Si el plan de su empresa se renueva a mano (anual o pagado por transferencia) y le
   faltan 7 días o menos, ya venció (3 días de gracia) o ya perdió el acceso, aparece
   una etiqueta arriba de todas las pantallas con el botón para pagar en Mercado Pago. */

var REN = { lista:[] };
function renFecha(iso){ return new Date(iso).toLocaleDateString('es-MX', { day:'numeric', month:'long' }); }
function renCargar(){
  if(!NUBE || !sesion || sesion.rol === 'admin' || sesion.rol === 'operador') return Promise.resolve();
  return Nube.empresaRpc('mis_renovaciones', {}).then(function(r){ REN.lista = r || []; renPintar(); }).catch(function(){});
}
function renPintar(){
  var viejo = $('ren-banda'); if(viejo) viejo.remove();
  var p = REN.lista[0], barra = document.querySelector('#app header.barra'); if(!p || !barra) return;
  var txt, color, boton;
  if(p.situacion === 'por_vencer'){ txt = '⏰ El plan de <b>'+esc(p.empresa)+'</b> vence el '+esc(renFecha(p.fin))+'. Renuévenlo para que su equipo no pierda el acceso.'; color = '#FEF3C7;color:#92400E'; boton = 'Renovar'; }
  else if(p.situacion === 'gracia'){ txt = '⚠️ El plan de <b>'+esc(p.empresa)+'</b> venció. Su equipo tiene acceso hasta el '+esc(renFecha(p.acceso_hasta))+'.'; color = '#FFEDD5;color:#9A3412'; boton = 'Renovar ahora'; }
  else { txt = '🔒 El plan de <b>'+esc(p.empresa)+'</b> venció y su equipo ya no puede entrar a los programas. Su avance está guardado.'; color = '#FEE2E2;color:#991B1B'; boton = 'Reactivar'; }
  barra.insertAdjacentHTML('afterend', '<div id="ren-banda" class="no-imprimir" style="background:'+color+';padding:10px 16px">'+
    '<div style="max-width:1180px;margin:0 auto;display:flex;gap:10px 16px;align-items:center;justify-content:space-between;flex-wrap:wrap;font-size:.95rem">'+
    '<span>'+txt+'</span><button id="ren-btn" class="btn btn-mor btn-sm" onclick="renPagar(\''+p.plan_id+'\')">'+boton+' · '+dinero(p.monto)+'</button></div></div>');
}
function renPagar(planId){
  var p = REN.lista.filter(function(x){ return x.plan_id === planId; })[0], b = $('ren-btn');
  if(p && p.liga){ location.href = p.liga; return; }
  if(b){ b.disabled = true; b.textContent = 'Abriendo Mercado Pago…'; }
  Nube.funcionServidor('tienda', { accion:'plan_renovar', planId:planId })
    .then(function(r){ if(r && r.liga) location.href = r.liga; else throw new Error('No se pudo generar la liga de pago.'); })
    .catch(function(e){ if(b){ b.disabled = false; b.textContent = 'Reintentar'; } alert(e.message); });
}
var _entrarAppRen = entrarApp;
entrarApp = function(){ _entrarAppRen(); setTimeout(renCargar, 0); };
