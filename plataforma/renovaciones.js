/* Instituto Mara — Etiqueta de renovación para quien administra una empresa (19 oct 2026).
   Se carga después de empresas-plan.js. Requiere backend/renovaciones-20261019.sql.

   Si el plan de su empresa se renueva a mano (anual o pagado por transferencia) y le
   faltan 7 días o menos, ya venció (3 días de gracia) o ya perdió el acceso, aparece
   una etiqueta arriba de todas las pantallas con el botón para pagar en Mercado Pago.
   Cobro con tarjeta rechazado (19 oct): la misma etiqueta, con «Actualizar forma de pago»
   (liga para registrar otra tarjeta); en la ficha del plan, el aviso para operador y administración.
   Requiere backend/cobro-rechazado-20261019.sql. */

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
  else if(p.situacion === 'tarjeta'){ txt = '⚠️ No pudimos cobrar el plan de <b>'+esc(p.empresa)+'</b> con su tarjeta. Su equipo tiene acceso hasta el '+esc(renFecha(p.acceso_hasta))+'.'; color = '#FFEDD5;color:#9A3412'; boton = 'Actualizar forma de pago'; }
  else if(p.situacion === 'tarjeta_vencido'){ txt = '🔒 El plan de <b>'+esc(p.empresa)+'</b> está detenido porque no se pudo cobrar. Su equipo ya no puede entrar a los programas; su avance está guardado.'; color = '#FEE2E2;color:#991B1B'; boton = 'Reactivar'; }
  else { txt = '🔒 El plan de <b>'+esc(p.empresa)+'</b> venció y su equipo ya no puede entrar a los programas. Su avance está guardado.'; color = '#FEE2E2;color:#991B1B'; boton = 'Reactivar'; }
  barra.insertAdjacentHTML('afterend', '<div id="ren-banda" class="no-imprimir" style="background:'+color+';padding:10px 16px">'+
    '<div style="max-width:1180px;margin:0 auto;display:flex;gap:10px 16px;align-items:center;justify-content:space-between;flex-wrap:wrap;font-size:.95rem">'+
    '<span>'+txt+'</span><button id="ren-btn" class="btn btn-mor btn-sm" onclick="renPagar(\''+p.plan_id+'\')">'+boton+' · '+dinero(p.monto)+'</button></div></div>');
}
function renPagar(planId){
  var p = REN.lista.filter(function(x){ return x.plan_id === planId; })[0], b = $('ren-btn');
  if(p && p.liga){ location.href = p.liga; return; }
  if(b){ b.disabled = true; b.textContent = 'Abriendo Mercado Pago…'; }
  Nube.funcionServidor('tienda', { accion:p && String(p.situacion).indexOf('tarjeta') === 0 ? 'plan_tarjeta' : 'plan_renovar', planId:planId })
    .then(function(r){ if(r && r.liga) location.href = r.liga; else throw new Error('No se pudo generar la liga de pago.'); })
    .catch(function(e){ if(b){ b.disabled = false; b.textContent = 'Reintentar'; } alert(e.message); });
}
var _entrarAppRen = entrarApp;
entrarApp = function(){ _entrarAppRen(); setTimeout(renCargar, 0); };

/* Ficha del plan (operador y administración): aviso de cobro con tarjeta rechazado. */
function renFaseCobro(p){
  if(!p || p.periodo !== 'mensual' || !p.mp_preapproval_id || ['activo','vencido'].indexOf(p.estado) < 0 || p.cancelado_en || Number(p.pagos_aprobados) < 1 || !p.vigente_hasta) return null;
  var acceso = new Date(p.vigente_hasta).getTime(), ahora = Date.now();
  if(acceso < ahora - 30 * 864e5) return null;
  var rechazo = p.cobro_fallido_en && new Date(p.cobro_fallido_en) > new Date(p.periodo_inicio || p.inicio || 0);
  if(!rechazo && ahora < acceso - 2 * 864e5) return null;
  return acceso < ahora ? 'tarjeta_vencido' : 'tarjeta';
}
var _plnPintarEmpresaRen = plnPintarEmpresa;
plnPintarEmpresa = function(id, modo){
  _plnPintarEmpresaRen(id, modo);
  if(modo === 'empresa') return;
  var l = (PLN.porEmpresa[id] || []), p = l.filter(function(x){ return renFaseCobro(x); })[0], caja = $('emp-plan');
  if(!p || !caja) return;
  var vencido = renFaseCobro(p) === 'tarjeta_vencido';
  var h = '<div class="aviso aviso-error ren-cobro" style="margin-bottom:12px">'+(vencido
      ? '🔒 <b>No se pudo cobrar con tarjeta</b> y el equipo perdió el acceso el '+plnFecha(p.vigente_hasta)+'.'
      : '⚠️ <b>Mercado Pago no pudo cobrar con tarjeta.</b> Tienen acceso hasta el '+plnFecha(p.vigente_hasta)+'.')+
    ' Ya se le envió a la empresa la liga para registrar otra tarjeta.'+
    '<div style="margin-top:8px"><button class="btn btn-mor btn-sm" onclick="renLigaStaff(\''+id+'\',\''+p.id+'\')">Ver o enviar la liga</button></div></div>';
  var t = caja.querySelector('h3');
  if(t) t.insertAdjacentHTML('afterend', h);
};
function renLigaStaff(id, planId){
  var e = plnEmpresaDatos(id), p = plnBuscar(id, planId) || {};
  Nube.funcionServidor('tienda', { accion:'plan_tarjeta', planId:planId }).then(function(r){
    var nom = e.contacto_nombre ? ' ' + String(e.contacto_nombre).split(' ')[0] : '';
    var t = 'Hola' + nom + ', Mercado Pago no pudo cobrar la mensualidad del plan de *' + (e.nombre || 'su empresa') + '* con la tarjeta registrada. ' +
      'Para que su equipo no pierda el acceso, pueden registrar otra tarjeta aquí (se cobra la mensualidad pendiente de ' + dinero(r.monto) + ' y todo sigue igual):\n\n👉 ' + r.liga;
    abrirModal('Liga para otra tarjeta · ' + (e.nombre || ''),
      '<div class="campo"><label for="rt-url">Liga de Mercado Pago</label><input id="rt-url" readonly value="'+esc(r.liga)+'"></div>'+
      '<p style="margin:6px 0 10px">Mensaje listo para WhatsApp:</p><textarea id="rt-txt" rows="7" style="width:100%">'+esc(t)+'</textarea>',
      '<button class="btn btn-fantasma" onclick="copiarTexto($(\'rt-url\').value)">Copiar liga</button>'+
      '<button class="btn btn-linea" onclick="copiarTexto($(\'rt-txt\').value)">Copiar mensaje</button>'+
      '<button class="btn btn-mor" onclick="window.open(\'https://wa.me/'+plnTelWa(e.contacto_tel)+'?text=\'+encodeURIComponent($(\'rt-txt\').value),\'_blank\',\'noopener\')">WhatsApp</button>');
  }).catch(function(err){ alert(err.message); });
}
