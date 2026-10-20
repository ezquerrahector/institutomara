/* Instituto Mara — Cambiar el número de personas del plan (19 oct 2026).
   Se carga después de renovaciones.js. Requiere backend/cambio-rango-20261019.sql.

   · «Agregar más lugares»: los lugares nuevos son de inmediato; hoy se paga solo la
     diferencia proporcional y, desde el siguiente cobro, el precio del rango nuevo.
     Lo hacen quien administra la empresa (hasta 100 personas), su operador y administración.
   · «Cambiar a menos lugares»: desde el siguiente cobro, sin devolución. Si hay más
     personas que el nuevo límite, se elige a quiénes conservar.
   · Un cambio pendiente se ve en la ficha del plan y se puede cancelar. */

var CR = { pend:{}, q:null, t:null };
function crPuede(p){ return p && p.estado === 'activo' && !p.cancelado_en && Number(p.pagos_aprobados) >= 1 && p.vigente_hasta && new Date(p.vigente_hasta) >= new Date(); }
function crFin(p){ return new Date(new Date(p.vigente_hasta).getTime() - 3 * 864e5).toISOString(); }
function crCada(p){ return p.periodo === 'anual' ? 'por 12 meses' : 'al mes'; }

var _plnCargarEmpresaCr = plnCargarEmpresa;
plnCargarEmpresa = function(id, modo){
  return _plnCargarEmpresaCr(id, modo).then(function(){
    var p = plnActual(id); if(!crPuede(p)) return;
    return Nube.tabla('plan_cambios?select=*&plan_id=eq.' + p.id + '&estado=in.(pendiente_pago,programado)&order=creado_en.desc&limit=1')
      .then(function(l){ CR.pend[p.id] = (l || [])[0] || null; plnPintarEmpresa(id, modo); })
      .catch(function(){});
  });
};

var _plnPintarEmpresaCr = plnPintarEmpresa;
plnPintarEmpresa = function(id, modo){
  _plnPintarEmpresaCr(id, modo);
  var p = plnActual(id), caja = $('emp-plan');
  if(!caja || !crPuede(p)) return;
  var c = CR.pend[p.id], h = '';
  if(c && c.tipo === 'subir'){
    h = '<div class="aviso aviso-info" style="margin-bottom:12px">Cambio a <b>'+esc(c.rango_texto)+'</b> pendiente: falta pagar la diferencia de <b>'+dinero(c.diferencia)+'</b>.'+
      (c.liga_vence ? ' La liga vale hasta el '+plnFecha(c.liga_vence)+'.' : '')+'</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">'+
      (modo === 'empresa' ? '<button class="btn btn-mor" onclick="crPagar(\''+id+'\',\''+c.id+'\')">Pagar la diferencia</button>'
                          : '<button class="btn btn-mor" onclick="crLigaStaff(\''+id+'\',\''+c.id+'\')">Ver o enviar la liga</button>')+
      (modo === 'admin' ? '<button class="btn btn-linea" onclick="crPagoManual(\''+id+'\',\''+c.id+'\')">Registrar transferencia de la diferencia</button>' : '')+
      '<button class="btn btn-fantasma" onclick="crCancelar(\''+id+'\',\''+c.id+'\')">Cancelar el cambio</button></div>';
  } else if(c && c.tipo === 'bajar'){
    h = '<div class="aviso aviso-info" style="margin-bottom:12px">Desde el <b>'+plnFecha(crFin(p))+'</b> el plan cambia a <b>'+esc(c.rango_texto)+'</b>: '+dinero(c.monto_siguiente)+' '+crCada(p)+'. '+
      'Hasta entonces conservan sus '+(p.lugares ? p.lugares+' lugares' : 'lugares')+'.'+
      (c.conservar && c.conservar.length ? ' Ese día se quedan solo las '+c.conservar.length+' personas elegidas.' : '')+'</div>'+
      '<div style="margin-bottom:16px"><button class="btn btn-fantasma" onclick="crCancelar(\''+id+'\',\''+c.id+'\')">Cancelar el cambio</button></div>';
  } else {
    h = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">'+
      (p.lugares ? '<button class="btn btn-linea" onclick="crAbrir(\''+id+'\',\'subir\')">Agregar más lugares</button>' : '')+
      (p.lugares == null || p.lugares > 5 ? '<button class="btn btn-fantasma" onclick="crAbrir(\''+id+'\',\'bajar\')">Cambiar a menos lugares</button>' : '')+
      '</div>';
  }
  var aviso = caja.querySelector('.aviso'); if(!aviso) return;
  var ancla = aviso.nextElementSibling && aviso.nextElementSibling.querySelector && aviso.nextElementSibling.querySelector('[onclick^="epPagoManual"]') ? aviso.nextElementSibling : aviso;
  ancla.insertAdjacentHTML('afterend', h);
  // Lugares llenos: en vez de «pídelo a Instituto Mara», el botón.
  [].forEach.call(caja.querySelectorAll('.aviso-info'), function(a){
    if(a.textContent.indexOf('Ya están ocupados todos los lugares') === 0 && !c)
      a.innerHTML = 'Ya están ocupados todos los lugares. Para sumar más personas, usa <b>«Agregar más lugares»</b>.';
  });
};

/* ---------- Modal para cambiar ---------- */
function crAbrir(id, modo){
  var p = plnActual(id); if(!p) return;
  var sugerido = modo === 'subir' ? (Number(p.lugares) || 0) + 1 : Math.max(1, (Number(p.lugares) || 6) - 5);
  CR.q = null;
  abrirModal(modo === 'subir' ? 'Agregar más lugares al plan' : 'Cambiar a menos lugares',
    '<p style="margin-bottom:10px">Hoy su plan es de <b>'+esc(p.rango_texto)+'</b>.</p>'+
    '<div class="campo"><label for="cr-n">¿Cuántas personas en total van a estudiar?</label><input id="cr-n" type="number" min="1" value="'+sugerido+'" oninput="crCotizarLuego(\''+id+'\',\''+modo+'\')"></div>'+
    '<div id="cr-res"><p style="color:var(--gris)">Calculando…</p></div><div id="cr-av"></div>',
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cancelar</button><button id="cr-btn" class="btn btn-mor" disabled onclick="crConfirmar(\''+id+'\',\''+modo+'\')">'+(modo === 'subir' ? 'Continuar' : 'Programar el cambio')+'</button>');
  crCotizar(id, modo);
}
function crCotizarLuego(id, modo){ clearTimeout(CR.t); CR.t = setTimeout(function(){ crCotizar(id, modo); }, 350); }
function crCotizar(id, modo){
  var p = plnActual(id), n = Math.floor(Number($('cr-n').value)), caja = $('cr-res'), b = $('cr-btn');
  if(!caja) return;
  CR.q = null; b.disabled = true;
  if(!(n >= 1)){ caja.innerHTML = '<div class="aviso aviso-error">Escribe cuántas personas van a estudiar.</div>'; return; }
  Nube.empresaRpc('plan_cambio_cotizar', { p_plan:p.id, p_personas:n }).then(function(q){
    if(!$('cr-res') || Math.floor(Number($('cr-n').value)) !== n) return;
    if(q.tipo !== modo){
      caja.innerHTML = '<div class="aviso aviso-error">'+(modo === 'subir' ? 'Con '+n+' personas el plan sería menor. Para eso usa «Cambiar a menos lugares».' : 'Con '+n+' personas el plan sería mayor. Para eso usa «Agregar más lugares».')+'</div>';
      return;
    }
    CR.q = q;
    var staff = q.quien !== 'empresa', cada = q.periodo === 'anual' ? 'por 12 meses' : 'al mes', h = '';
    if(modo === 'subir'){
      h = '<div class="aviso aviso-info" style="margin-bottom:10px">Plan nuevo: <b>'+esc(q.rango_texto)+'</b>'+(q.lugares ? ' (hasta '+q.lugares+' personas a la vez)' : '')+'. Los lugares nuevos son de inmediato.<br>'+
        (q.sin_cobro ? 'No hay diferencia que pagar hoy porque su periodo está por terminar.'
                     : 'Hoy pagan solo la diferencia por los '+q.dias_restantes+' días que faltan de su periodo: <b>'+dinero(q.diferencia)+'</b>, IVA incluido.')+
        '<br>Desde su siguiente cobro, el '+plnFecha(q.fin_periodo)+': <b>'+dinero(q.monto_siguiente)+' '+cada+'</b>'+(Number(q.descuento_pct) > 0 ? ' (con su descuento de '+Number(q.descuento_pct)+' % mientras dure)' : '')+'.'+
        (staff && !q.sin_cobro ? '<br><small>Comisión aproximada: '+dinero(Math.round(plnComisionAprox(q.diferencia, 35)))+' de la diferencia, y después tu % mensual sobre el precio nuevo.</small>' : '')+
        '</div>';
      if(staff && !q.sin_cobro){
        var e = plnEmpresaDatos(id);
        h += '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="cr-correo" checked> Enviar la liga por correo a '+esc(p.admin_correo || e.contacto_correo || 'la empresa')+'</label>';
      }
      b.textContent = q.sin_cobro ? 'Agregar los lugares' : staff ? 'Generar liga de pago' : 'Pagar '+dinero(q.diferencia)+' y agregar lugares';
    } else {
      h = '<div class="aviso aviso-info" style="margin-bottom:10px">Desde su siguiente cobro, el <b>'+plnFecha(q.fin_periodo)+'</b>, el plan queda en <b>'+esc(q.rango_texto)+'</b>: '+dinero(q.monto_siguiente)+' '+cada+', IVA incluido.<br>'+
        'Hasta entonces conservan sus '+(q.lugares_antes ? q.lugares_antes+' lugares' : 'lugares')+'. No hay devolución por el periodo que ya pagaron.</div>';
      if(q.sobran > 0){
        var l = (PLN.lugares[p.id] || []);
        h += '<p style="margin:8px 0"><b>Elige a las '+q.lugares+' personas que conservan su lugar.</b> Las demás dejan de tener acceso por el plan ese día y conservan su avance. Sus constancias ya emitidas siguen vigentes.</p>'+
          '<div id="cr-lista" style="max-height:220px;overflow:auto;border:1px solid var(--linea);border-radius:10px;padding:8px 12px">'+
          l.map(function(x){ return '<label style="display:flex;gap:8px;align-items:center;padding:4px 0"><input type="checkbox" value="'+x.id+'" onchange="crContar()"> '+esc(x.alumno || x.nombre)+' <small style="color:var(--gris)">'+esc(x.correo)+'</small></label>'; }).join('')+
          '</div><p id="cr-cuenta" style="color:var(--gris);font-size:.9rem;margin-top:6px"></p>';
      }
      b.textContent = 'Programar el cambio';
    }
    caja.innerHTML = h;
    if(modo === 'bajar' && q.sobran > 0) crContar(); else b.disabled = false;
  }).catch(function(err){ if($('cr-res')) caja.innerHTML = plnErr(err); });
}
function crElegidos(){ return [].map.call(document.querySelectorAll('#cr-lista input:checked'), function(i){ return i.value; }); }
function crContar(){
  var q = CR.q, n = crElegidos().length, b = $('cr-btn'); if(!q) return;
  $('cr-cuenta').textContent = n + ' de ' + q.lugares + ' elegidas';
  b.disabled = n !== q.lugares;
}
function crConfirmar(id, modo){
  var q = CR.q, b = $('cr-btn'), av = $('cr-av'), p = plnActual(id); if(!q || !p) return;
  b.disabled = true; b.textContent = 'Guardando…';
  var n = Math.floor(Number($('cr-n').value)), enviar = !!($('cr-correo') && $('cr-correo').checked);
  Nube.empresaRpc('plan_cambio_solicitar', { p_plan:p.id, p_personas:n, p_conservar:modo === 'bajar' && q.sobran > 0 ? crElegidos() : null })
    .then(function(c){ return Nube.funcionServidor('tienda', { accion:'plan_cambio', cambioId:c.id, enviarCorreo:enviar }).then(function(r){ return { c:c, r:r }; }); })
    .then(function(x){
      if(x.r && x.r.liga && q.quien === 'empresa'){ b.textContent = 'Abriendo Mercado Pago…'; location.href = x.r.liga; return; }
      return plnCargarEmpresa(id, plnModo()).then(function(){
        if(x.r && x.r.liga) return crLigaStaff(id, x.c.id, x.r.enviado);
        abrirModal(modo === 'subir' ? 'Listo' : 'Cambio programado',
          modo === 'subir' ? '<p>El plan ya es de <b>'+esc(q.rango_texto)+'</b>. Ya pueden registrar a las personas nuevas.</p>'
                           : '<p>Desde el '+plnFecha(q.fin_periodo)+' el plan será de <b>'+esc(q.rango_texto)+'</b>. Les enviamos la confirmación por correo. Si cambian de opinión, pueden cancelar el cambio antes de esa fecha.</p>',
          '<button class="btn btn-mor" onclick="cerrarModal()">Entendido</button>');
      });
    })
    .catch(function(err){ b.disabled = false; b.textContent = 'Reintentar'; av.innerHTML = plnErr(err); plnCargarEmpresa(id, plnModo()); });
}
function crPagar(id, cambioId){
  var c = Object.keys(CR.pend).map(function(k){ return CR.pend[k]; }).filter(function(x){ return x && x.id === cambioId; })[0];
  if(c && c.liga && c.liga_vence && new Date(c.liga_vence) > new Date(Date.now() + 36e5)){ location.href = c.liga; return; }
  Nube.funcionServidor('tienda', { accion:'plan_cambio', cambioId:cambioId })
    .then(function(r){ if(r && r.liga) location.href = r.liga; else throw new Error('No se pudo generar la liga de pago.'); })
    .catch(function(e){ alert(e.message); });
}
function crLigaStaff(id, cambioId, enviado){
  var p = plnActual(id), e = plnEmpresaDatos(id);
  var abrir = function(r){
    var c = CR.pend[p.id] || {};
    var nom = e.contacto_nombre ? ' ' + String(e.contacto_nombre).split(' ')[0] : '';
    var t = 'Hola' + nom + ', como lo platicamos, esta es la liga para cambiar el plan de *' + (e.nombre || 'su empresa') + '* a *' + (c.rango_texto || '') + '*:\n\n' +
      '• Hoy pagan solo la diferencia por lo que falta de su periodo: ' + dinero(r.diferencia) + ', IVA incluido\n' +
      '• Desde su siguiente cobro, el ' + plnFecha(crFin(p)) + ': ' + dinero(c.monto_siguiente) + ' ' + crCada(p) + '\n' +
      '• En cuanto se acredite el pago, pueden registrar a las personas nuevas en «Mi empresa»\n\n👉 ' + r.liga + '\n\nLa liga vale hasta el ' + plnFecha(r.liga_vence) + '.';
    abrirModal('Liga para la diferencia · ' + (e.nombre || ''),
      (enviado ? '<div class="aviso aviso-ok">Se envió por correo a ' + esc(p.admin_correo || e.contacto_correo || '') + '.</div>' : '')+
      '<div class="campo"><label for="crl-url">Liga de Mercado Pago</label><input id="crl-url" readonly value="'+esc(r.liga)+'"></div>'+
      '<p style="margin:6px 0 10px">Mensaje listo para WhatsApp:</p><textarea id="crl-txt" rows="10" style="width:100%">'+esc(t)+'</textarea>',
      '<button class="btn btn-fantasma" onclick="copiarTexto($(\'crl-url\').value)">Copiar liga</button>'+
      '<button class="btn btn-linea" onclick="copiarTexto($(\'crl-txt\').value)">Copiar mensaje</button>'+
      '<button class="btn btn-mor" onclick="window.open(\'https://wa.me/'+plnTelWa(e.contacto_tel)+'?text=\'+encodeURIComponent($(\'crl-txt\').value),\'_blank\',\'noopener\')">WhatsApp</button>');
  };
  return Nube.funcionServidor('tienda', { accion:'plan_cambio', cambioId:cambioId }).then(abrir).catch(function(err){ alert(err.message); });
}
function crCancelar(id, cambioId){
  if(!confirm('¿Cancelar el cambio? El plan sigue como está.')) return;
  Nube.funcionServidor('tienda', { accion:'plan_cambio_cancelar', cambioId:cambioId })
    .then(function(){ return plnCargarEmpresa(id, plnModo()); }).catch(function(e){ alert(e.message); });
}
function crPagoManual(id, cambioId){
  var p = plnActual(id), c = CR.pend[p.id] || {};
  abrirModal('Diferencia pagada por transferencia',
    '<p style="margin-bottom:12px">Registra la transferencia de la diferencia. El plan pasa a <b>'+esc(c.rango_texto || '')+'</b> de inmediato y, si tiene operador, gana su 35 % sobre el monto sin IVA.</p>'+
    '<div class="fila"><div class="campo"><label for="crm-monto">Monto recibido (IVA incluido)</label><input id="crm-monto" type="number" min="1" step="0.01" value="'+Number(c.diferencia || 0)+'"></div>'+
    '<div class="campo"><label for="crm-ref">Referencia o clave de rastreo</label><input id="crm-ref" maxlength="60"></div></div><div id="crm-av"></div>',
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cancelar</button><button id="crm-btn" class="btn btn-mor" onclick="crGuardarPagoManual(\''+id+'\',\''+cambioId+'\')">Registrar pago</button>');
}
function crGuardarPagoManual(id, cambioId){
  var b = $('crm-btn'); b.disabled = true;
  Nube.empresaRpc('plan_cambio_pago_manual', { p_cambio:cambioId, p_monto:Number($('crm-monto').value), p_referencia:$('crm-ref').value.trim() })
    .then(function(){ return Nube.funcionServidor('tienda', { accion:'plan_cambio', cambioId:cambioId }).catch(function(){ return null; }); })
    .then(function(){ cerrarModal(); return plnCargarEmpresa(id, 'admin'); })
    .catch(function(e){ b.disabled = false; $('crm-av').innerHTML = plnErr(e); });
}

/* Regreso de Mercado Pago después de pagar la diferencia. */
var _entrarAppCr = entrarApp;
entrarApp = function(){
  var cambio = new URLSearchParams(location.search).get('plan') === 'cambio';
  _entrarAppCr();
  if(cambio){
    history.replaceState(null, '', location.pathname);
    abrirModal('¡Gracias!', '<p>Recibimos el pago de la diferencia. En cuanto Mercado Pago lo confirme (suele tardar unos segundos), los lugares nuevos quedan listos en «Mi empresa» y les llega un correo de confirmación.</p>',
      '<button class="btn btn-mor" onclick="cerrarModal()">Entendido</button>');
  }
};
