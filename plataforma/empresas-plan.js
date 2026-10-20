/* Instituto Mara — Empresas: solo el plan mensual (19 oct 2026).
   Se carga después de supervision.js. Requiere backend/empresas-en-linea-20261019.sql.

   · Menú «Empresas» (cualquier persona con cuenta): tabla del plan, contratar en línea
     (paga con Mercado Pago y queda activa) o pedir la prueba sin costo (le llega al
     operador con menos pendientes). Ya no se compran lugares por curso; los paquetes
     anteriores se siguen mostrando.
   · Ficha de la empresa (administración): sin cotización ni venta manual por curso;
     en el plan, «Registrar pago por transferencia».
   · Consola de llamadas: «Pidió información por correo» envía el correo de información
     firmado por el operador; las solicitudes del sitio salen hasta arriba. */

function epRangosVenta(){ return (PLN.rangos || []).filter(function(r){ return r.activo !== false && r.hasta != null && r.desde <= 100; }); }
function epTabla(){
  var l = epRangosVenta();
  return '<div class="tabla-caja" style="margin-bottom:8px"><div class="tabla-scroll"><table><thead><tr><th>Personas</th><th>Al mes, IVA incluido</th></tr></thead><tbody>'+
    l.map(function(r, i){ return '<tr><td>'+(i === 0 ? 'Hasta '+r.hasta : r.desde+' a '+r.hasta)+'</td><td><b>'+dinero(r.precio_mensual)+'</b></td></tr>'; }).join('')+
    '<tr><td>Más de 100</td><td>Pide tu cotización</td></tr></tbody></table></div></div>'+
    '<p style="color:var(--gris);font-size:.9rem;margin-bottom:6px">Paga el año y llévate '+(12 - plnMesesAnual())+' meses gratis.</p>';
}

/* ---------- Menú «Empresas» ---------- */
var _vistaEmpresasEp = vistaEmpresas;
vistaEmpresas = function(){
  var viejo = _vistaEmpresasEp(), corte = viejo.indexOf('<h3 style="margin-bottom:12px;color:var(--tinta)">Tus paquetes</h3>');
  var paquetes = corte >= 0 ? viejo.slice(corte).replace(/<\/div>\s*$/, '') : '';
  setTimeout(function(){ plnCargarRangos().then(function(){ var t = $('ep-tabla'); if(t) t.innerHTML = epTabla(); epResumen(); }).catch(function(){}); }, 0);
  return '<div class="seccion"><h2>Capacita a todo tu equipo con un solo plan</h2>'+
    '<p class="sub">Por una cuota mensual, tu gente entra a todos los cursos y diplomados y cada quien toma los que necesite. Tú registras a cada persona y, desde «Mi empresa», ves quién ya empezó, cuánto lleva y quién terminó. Cada quien obtiene su constancia con folio y QR verificable.</p>'+
    '<div class="rejilla" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px;margin-bottom:26px">'+
      '<div class="tarjeta"><h3 style="color:var(--tinta);margin-bottom:10px">Precios</h3><div id="ep-tabla">Cargando…</div>'+
        '<ul style="margin:10px 0 0 18px;line-height:1.8;color:var(--tinta)"><li>Panel con el avance de cada persona y reporte en Excel o PDF</li><li>Pago con tarjeta y cobro automático, o anual con tarjeta, OXXO o transferencia</li><li>Factura disponible</li></ul></div>'+
      '<div class="tarjeta" id="ep-contratar"><h3 style="color:var(--tinta);margin-bottom:10px">Contratar el plan</h3>'+
        '<div class="campo"><label for="ep-emp">Empresa</label><input id="ep-emp" maxlength="160" placeholder="Nombre comercial o razón social"></div>'+
        '<div class="fila"><div class="campo"><label for="ep-n">¿Cuántas personas?</label><input id="ep-n" type="number" min="1" max="100" value="5" oninput="epResumen()"></div>'+
        '<div class="campo"><label for="ep-per">Forma de pago</label><select id="ep-per" onchange="epResumen()"><option value="mensual">Mensual (cobro automático con tarjeta)</option><option value="anual">Anual (un solo pago)</option></select></div></div>'+
        '<div class="fila"><div class="campo"><label for="ep-rfc">RFC (opcional)</label><input id="ep-rfc" maxlength="13" style="text-transform:uppercase"></div>'+
        '<div class="campo"><label for="ep-tel">Teléfono</label><input id="ep-tel" type="tel" placeholder="10 dígitos"></div></div>'+
        '<div class="campo" id="ep-mp-caja"><label for="ep-mp">Correo de tu cuenta de Mercado Pago</label><input id="ep-mp" type="email" value="'+esc(sesion.correo||'')+'"><small style="color:var(--gris)">El cobro mensual se hace con la tarjeta de esa cuenta; lo puedes cancelar cuando quieras.</small></div>'+
        '<div id="ep-res" class="aviso aviso-info"></div><div id="ep-av"></div>'+
        '<button id="ep-btn" class="btn btn-mor" onclick="epContratar()">Contratar y pagar</button>'+
        '<p style="color:var(--gris);font-size:.85rem;margin-top:10px">Quedas como administrador del panel de tu empresa. ¿Factura? Envía tu constancia de situación fiscal a <a href="mailto:contacto@institutomara.com?subject=Factura">contacto@institutomara.com</a>.</p></div>'+
    '</div>'+
    '<div class="tarjeta" id="ep-prueba" style="margin-bottom:26px;background:var(--nube)"><h3 style="color:var(--tinta);margin-bottom:6px">¿Prefieren probar primero?</h3>'+
      '<p style="color:var(--gris);margin-bottom:12px">Prueba sin costo: 5 personas, 15 días, todo el catálogo. Déjanos tus datos y te llamamos hoy para activarla.</p>'+
      epFormPrueba('epp')+'</div>'+
    paquetes+'</div>';
};
function epFormPrueba(px){
  return '<div class="fila"><div class="campo"><label for="'+px+'-emp">Empresa</label><input id="'+px+'-emp" maxlength="160"></div>'+
      '<div class="campo"><label for="'+px+'-n">¿Cuántas personas son?</label><input id="'+px+'-n" type="number" min="1"></div></div>'+
    '<div class="fila"><div class="campo"><label for="'+px+'-nom">Tu nombre</label><input id="'+px+'-nom" maxlength="120" value="'+esc(sesion && sesion.nombre || '')+'"></div>'+
      '<div class="campo"><label for="'+px+'-pto">Puesto</label><input id="'+px+'-pto" maxlength="80" placeholder="Ej. Recursos Humanos"></div></div>'+
    '<div class="fila"><div class="campo"><label for="'+px+'-cor">Correo</label><input id="'+px+'-cor" type="email" value="'+esc(sesion && sesion.correo || '')+'"></div>'+
      '<div class="campo"><label for="'+px+'-tel">Teléfono</label><input id="'+px+'-tel" type="tel" placeholder="10 dígitos"></div></div>'+
    '<div class="campo"><label for="'+px+'-msg">¿Qué les interesa? (opcional)</label><input id="'+px+'-msg" maxlength="300" placeholder="Ej. NOM-035 y Excel para 12 personas de oficina"></div>'+
    '<div id="'+px+'-av"></div><button id="'+px+'-btn" class="btn btn-linea" onclick="epPedirPrueba(\''+px+'\')">Quiero mi prueba sin costo</button>';
}
function epResumen(){
  var c = $('ep-res'); if(!c) return;
  var n = Math.floor(Number($('ep-n').value)), per = $('ep-per').value, mp = $('ep-mp-caja');
  if(mp) mp.style.display = per === 'mensual' ? '' : 'none';
  if(!(n >= 1)){ c.textContent = 'Escribe cuántas personas.'; return; }
  if(n > 100){ c.innerHTML = 'Para más de 100 personas te hacemos una cotización: escríbenos a <a href="mailto:contacto@institutomara.com">contacto@institutomara.com</a>.'; return; }
  var r = plnRangoDe(n); if(!r){ c.textContent = 'Cargando precios…'; return; }
  c.innerHTML = per === 'mensual'
    ? 'Plan de <b>'+r.desde+' a '+r.hasta+' personas</b>: <b>'+dinero(r.precio_mensual)+' al mes</b>, IVA incluido. Hasta '+r.hasta+' personas registradas a la vez.'
    : 'Plan anual de <b>'+r.desde+' a '+r.hasta+' personas</b>: <b>'+dinero(r.precio_mensual * plnMesesAnual())+'</b> por 12 meses, IVA incluido ('+(12 - plnMesesAnual())+' meses gratis).';
}
function epContratar(){
  var av = $('ep-av'), b = $('ep-btn'), per = $('ep-per').value, mp = $('ep-mp').value.trim();
  if(per === 'mensual' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mp)){ av.innerHTML = plnErr('Escribe el correo de tu cuenta de Mercado Pago.'); return; }
  b.disabled = true; b.textContent = 'Preparando tu pago…';
  Nube.empresaRpc('plan_contratar_en_linea', { p_empresa:$('ep-emp').value.trim(), p_personas:Math.floor(Number($('ep-n').value)), p_periodo:per,
      p_rfc:$('ep-rfc').value.trim() || null, p_telefono:$('ep-tel').value.trim() || null })
    .then(function(p){ return Nube.funcionServidor('tienda', { accion:'plan_liga', planId:p.id, correoMP:mp }); })
    .then(function(r){ if(r && r.liga){ location.href = r.liga; return; } throw new Error('No se pudo generar la liga de pago.'); })
    .catch(function(e){ b.disabled = false; b.textContent = 'Contratar y pagar'; av.innerHTML = plnErr(e); });
}
function epPedirPrueba(px){
  var av = $(px+'-av'), b = $(px+'-btn');
  b.disabled = true; b.textContent = 'Enviando…';
  Nube.funcionServidor('prospectos', { accion:'solicitud', empresa:$(px+'-emp').value.trim(), personas:$(px+'-n').value, nombre:$(px+'-nom').value.trim(),
      puesto:$(px+'-pto').value.trim(), correo:$(px+'-cor').value.trim(), telefono:$(px+'-tel').value.trim(), mensaje:$(px+'-msg').value.trim() })
    .then(function(){ b.textContent = 'Enviado ✓'; av.innerHTML = '<div class="aviso aviso-ok">¡Listo! Te llamamos hoy para activar tu prueba.</div>'; })
    .catch(function(e){ b.disabled = false; b.textContent = 'Quiero mi prueba sin costo'; av.innerHTML = plnErr(e); });
}

/* ---------- Ficha de administración: sin venta por curso; pago por transferencia ---------- */
var _pintarComprasEmpresaEp = pintarComprasEmpresa;
pintarComprasEmpresa = function(id){
  _pintarComprasEmpresaEp(id);
  var pb = $('pb-adm'); if(!pb) return;
  while(pb.nextSibling) pb.parentNode.removeChild(pb.nextSibling);
};
function epSiguienteMonto(p){
  var n = Number(p.pagos_aprobados) || 0;
  if(p.periodo === 'anual') return n === 0 ? Number(p.monto_inicial) : Number(p.precio_lista);
  return n < Number(p.descuento_meses || 0) || n === 0 ? Number(p.monto_inicial) : Number(p.precio_lista);
}
var _plnPintarEmpresaEp = plnPintarEmpresa;
plnPintarEmpresa = function(id, modo){
  _plnPintarEmpresaEp(id, modo);
  if(modo !== 'admin') return;
  var p = plnActual(id), caja = $('emp-plan');
  if(!p || !caja || ['pendiente_pago','activo','cancelado'].indexOf(p.estado) < 0) return;
  var aviso = caja.querySelector('.aviso:not(.ren-cobro)'); if(!aviso) return;
  aviso.insertAdjacentHTML('afterend', '<div style="margin:-4px 0 14px"><button class="btn btn-linea btn-sm" onclick="epPagoManual(\''+id+'\',\''+p.id+'\')">Registrar pago por transferencia</button></div>');
};
function epPagoManual(id, planId){
  var p = plnBuscar(id, planId); if(!p) return;
  abrirModal('Pago por transferencia',
    '<p style="margin-bottom:12px">Registra una transferencia que ya recibiste. El plan se activa (o se renueva un '+(p.periodo === 'anual' ? 'año' : 'mes')+') y, si tiene operador, gana su comisión sobre el monto sin IVA.</p>'+
    '<div class="fila"><div class="campo"><label for="pm-monto">Monto recibido (IVA incluido)</label><input id="pm-monto" type="number" min="1" step="0.01" value="'+epSiguienteMonto(p)+'"></div>'+
    '<div class="campo"><label for="pm-ref">Referencia o clave de rastreo</label><input id="pm-ref" maxlength="60"></div></div><div id="pm-av"></div>',
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cancelar</button><button id="pm-btn" class="btn btn-mor" onclick="epGuardarPagoManual(\''+id+'\',\''+planId+'\')">Registrar pago</button>');
}
function epGuardarPagoManual(id, planId){
  var b = $('pm-btn'); b.disabled = true;
  var pl = plnBuscar(id, planId) || {};
  Nube.empresaRpc('plan_registrar_pago_manual', { p_plan:planId, p_monto:Number($('pm-monto').value), p_referencia:$('pm-ref').value.trim() })
    // Si la tarjeta había fallado, el plan pasa a pagarse por transferencia: se cancela la suscripción para que no cobre doble.
    .then(function(){ return pl.mp_preapproval_id && pl.cobro_fallido_en ? Nube.funcionServidor('tienda', { accion:'plan_a_transferencia', planId:planId }).catch(function(){ return null; }) : null; })
    .then(function(){ cerrarModal(); return plnCargarEmpresa(id, 'admin'); })
    .catch(function(e){ b.disabled = false; $('pm-av').innerHTML = plnErr(e); });
}

/* ---------- Consola de llamadas ---------- */
function epPidioSitio(p){
  var s = p && p.extra && p.extra.solicitud_en;
  return !!(s && !llCerrado(p) && (!p.ultima_llamada || new Date(p.ultima_llamada) < new Date(s)));
}
var _llListaEp = llLista;
llLista = function(tab){
  var l = _llListaEp(tab);
  return l.filter(epPidioSitio).concat(l.filter(function(p){ return !epPidioSitio(p); }));
};
var _llNumeroTxtEp = llNumeroTxt;
llNumeroTxt = function(p){
  var h = _llNumeroTxtEp(p);
  return epPidioSitio(p) ? '<span class="etiqueta error">Pidió prueba desde el sitio</span><br>' + h : h;
};
/* «Pidió información por correo»: además de registrar la llamada, sale el correo firmado por el operador. */
llGuardar = function(id, siguiente){
  var av = $('lr-aviso'), b = $('lr-btn');
  var v = (document.querySelector('input[name=lr-res]:checked')||{}).value;
  if(!v){ av.innerHTML = '<div class="aviso aviso-error">Elige el resultado de la llamada.</div>'; return; }
  var cuando = $('lr-cuando').value ? new Date($('lr-cuando').value).toISOString() : null;
  if(v === 'piloto' && !$('lr-cor').value.trim()){ av.innerHTML = '<div class="aviso aviso-error">Escribe el correo de quien administrará la plataforma: a ese correo le llega su acceso.</div>'; return; }
  b.disabled = true;
  var infoEnviada = null;
  Nube.empresaRpc('registrar_llamada', { p_prospecto:id, p_resultado:v, p_contacto_nombre:$('lr-nom').value.trim() || null,
      p_contacto_puesto:$('lr-pto').value.trim() || null, p_contacto_correo:$('lr-cor').value.trim() || null,
      p_comentario:$('lr-com').value.trim() || null, p_proxima:cuando })
    .then(function(fila){
      if(fila) PR.lista = PR.lista.map(function(x){ return x.id === id ? fila : x; });
      if(v !== 'info_correo') return null;
      return Nube.funcionServidor('prospectos', { accion:'info', id:id })
        .then(function(r){ infoEnviada = r && r.ok; }).catch(function(){ infoEnviada = false; });
    })
    .then(function(){
      return Nube.tabla('prospecto_contactos?prospecto_id=eq.' + id + '&select=*&order=fecha.asc').then(function(cs){
        PR.contactos = PR.contactos.filter(function(c){ return c.prospecto_id !== id; }).concat(cs || []);
      });
    })
    .then(function(){
      if(v === 'piloto') return llPiloto(id);
      var c = LL.cola || [], i = c.indexOf(id);
      if(siguiente && i >= 0 && c[i + 1]) llAbrir(c[i + 1]);
      else if(siguiente){ estado.llamadaId = null; pintar(); }
      else llPintarFicha(id);
      if(infoEnviada !== null) setTimeout(function(){
        var a = $('lr-aviso') || $('ll-datos'); if(!a) return;
        a.insertAdjacentHTML('afterbegin', infoEnviada ? '<div class="aviso aviso-ok" style="margin-bottom:10px">Le enviamos el correo con la información, firmado por ti.</div>'
                                                      : '<div class="aviso aviso-error" style="margin-bottom:10px">No se pudo enviar el correo de información; se reintenta solo mañana.</div>');
      }, 300);
    })
    .catch(function(e){ b.disabled = false; av.innerHTML = plnErr(e); });
};
