/* Instituto Mara — Comisiones de los operadores (19 oct 2026).
   Se carga después de operador.js. Requiere backend/comisiones-20261019.sql.

   Operador: menú «Comisiones» (acumulado, recibos, aceptar o pedir revisión,
   comprobante de pago) y «Mi perfil» → cuenta para recibir comisiones (CLABE).
   Administración, en «Planes y operadores»: recibos por pagar, dudas, ajustes,
   pago con referencia y comprobante, y aviso cuando un operador cambia su cuenta.
   Los recibos se arman solos: el 16 (corte del 1 al 15) y el día 1 (corte del 16
   al fin de mes). */

var COM = { cortes:[], pend:[], ajPend:[], admCortes:[], admOps:[] };
var COM_ESTADOS = {
  enviado:     ['Por aceptar', 'alerta'],
  en_revision: ['En revisión', 'error'],
  aceptado:    ['Aceptado · por pagar', 'tur'],
  pagado:      ['Pagado', 'ok']
};
var COM_MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
var COM_BANCOS = { '002':'Banamex', '012':'BBVA', '014':'Santander', '021':'HSBC', '030':'BanBajío', '036':'Inbursa', '044':'Scotiabank',
  '058':'Banregio', '062':'Afirme', '072':'Banorte', '127':'Banco Azteca', '137':'BanCoppel', '638':'Nu México', '646':'STP', '722':'Mercado Pago' };

function comEtiqueta(e){ var x = COM_ESTADOS[e] || [e, 'gris']; return '<span class="etiqueta '+x[1]+'">'+esc(x[0])+'</span>'; }
function comPeriodo(k){
  var d = new Date(String(k.periodo_desde || k.fecha_corte) + 'T12:00:00'), h = new Date(String(k.periodo_hasta || k.fecha_corte) + 'T12:00:00');
  return d.getMonth() === h.getMonth() && d.getFullYear() === h.getFullYear()
    ? d.getDate() + ' al ' + h.getDate() + ' de ' + COM_MESES[h.getMonth()] + ' ' + h.getFullYear()
    : d.getDate() + ' de ' + COM_MESES[d.getMonth()] + ' al ' + h.getDate() + ' de ' + COM_MESES[h.getMonth()] + ' ' + h.getFullYear();
}
function comFechaHora(iso){ return iso ? new Date(iso).toLocaleString('es-MX', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'; }
function comClabeOculta(c){ c = String(c || ''); return c ? c.slice(0,3) + ' ••• ' + c.slice(-4) : '—'; }
function comSuma(l){ return (l||[]).reduce(function(a, x){ return a + Number(x.monto || 0); }, 0); }
function comAncho(){ var m = $('modales').querySelector('.modal'); if(m) m.style.maxWidth = '860px'; }
var COM_SEL = '*,plan:empresas_planes(rango_texto,periodo,empresa:empresas(nombre)),pago:plan_pagos(numero,monto,neto_mp,iva,base_comision,creado_en,reembolsado)';

/* Desglose de un recibo (lo usan el operador, administración y la impresión). */
function comDesglose(k, comis, ajus, op){
  var filas = (comis||[]).map(function(c){
    var p = c.pago || {}, pl = c.plan || {}, emp = (pl.empresa && pl.empresa.nombre) || '—';
    var nota = c.cancelada_en ? '<br><small style="color:#991B1B">Cancelada por reembolso</small>'
      : (c.monto_original != null && Number(c.monto_original) !== Number(c.monto) ? '<br><small style="color:#92400E">Ajustada por reembolso (era '+dinero(c.monto_original)+')</small>' : '');
    return '<tr><td><b>'+esc(emp)+'</b><br><small>'+esc(pl.rango_texto || '')+' · '+esc(pl.periodo || '')+'</small></td>'+
      '<td>'+(c.tipo === 'inicial' ? (pl.periodo === 'anual' ? 'Pago anual' : '1.er pago') : 'Pago '+(p.numero || ''))+'<br><small>'+esc(fechaCortaEmp(p.creado_en))+'</small></td>'+
      '<td>'+dinero(p.monto)+'</td><td>'+dinero(c.base)+'</td><td>'+Number(c.pct)+'%</td><td style="text-align:right"><b>'+dinero(c.monto)+'</b>'+nota+'</td></tr>';
  }).join('');
  var aj = (ajus||[]).map(function(a){
    return '<tr><td colspan="5">'+(a.tipo === 'reembolso' ? '↩️ ' : '✏️ ')+esc(a.motivo)+' <small style="color:var(--gris)">'+esc(fechaCortaEmp(a.creado_en))+'</small></td>'+
      '<td style="text-align:right;color:'+(Number(a.monto) < 0 ? '#991B1B' : '#065F46')+'"><b>'+dinero(a.monto)+'</b></td></tr>';
  }).join('');
  var total = k ? Number(k.total) : comSuma(comis) + comSuma(ajus);
  return '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Empresa</th><th>Pago</th><th>Cobrado (IVA incl.)</th>'+
    '<th title="Lo que depositó Mercado Pago menos el IVA">Base</th><th>%</th><th style="text-align:right">Comisión</th></tr></thead><tbody>'+
    (filas || '<tr><td colspan="6" style="color:var(--gris)">Sin comisiones.</td></tr>')+
    (aj ? '<tr><td colspan="6" style="background:#FAF8FF"><b>Ajustes</b></td></tr>' + aj : '')+
    '<tr><td colspan="5" style="text-align:right"><b>Total</b></td><td style="text-align:right;font-size:1.1rem"><b>'+dinero(total)+'</b></td></tr>'+
    '</tbody></table></div></div>'+
    '<p style="color:var(--gris);font-size:.82rem;margin-top:8px">Base = lo que depositó Mercado Pago (ya sin su comisión) menos el IVA de la venta.</p>';
}
function comCabecera(k, op){
  /* Recibo generado antes de que el operador capturara su cuenta: se muestra la actual (queda fija al aceptarlo). */
  if(!k.clabe && op && op.clabe && k.estado === 'enviado') k = Object.assign({}, k, { titular:op.titular, banco:op.banco, clabe:op.clabe + ' (se registra al aceptar)' });
  return '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px">'+
    '<div><div style="font-size:.8rem;color:var(--gris);text-transform:uppercase;letter-spacing:.6px">Recibo de comisiones · folio '+esc(k.folio)+'</div>'+
    '<div style="font-size:1.15rem;font-weight:700;color:var(--tinta)">'+esc(comPeriodo(k))+'</div>'+
    '<div style="margin-top:4px">'+comEtiqueta(k.estado)+'</div></div>'+
    '<div style="font-size:.92rem;line-height:1.6"><b>'+esc(op && op.nombre || '')+'</b><br>'+
      'Titular: '+esc(k.titular || '—')+'<br>Banco: '+esc(k.banco || '—')+'<br>CLABE: '+esc(k.clabe || 'pendiente de capturar')+'</div></div>';
}
function comHistorial(k){
  var h = [];
  h.push('Enviado: ' + comFechaHora(k.enviado_en || k.creado_en));
  if(k.duda) h.push('Duda del operador ('+comFechaHora(k.duda_en)+'): «'+esc(k.duda)+'»');
  if(k.respuesta) h.push('Respuesta ('+comFechaHora(k.respuesta_en)+'): «'+esc(k.respuesta)+'»');
  if(k.aceptado_en) h.push('<b>Aceptado por el operador: '+comFechaHora(k.aceptado_en)+'</b>');
  if(k.pagado_en) h.push('<b>Pagado: '+comFechaHora(k.pagado_en)+'</b> · referencia '+esc(k.referencia || '—'));
  return '<div style="margin-top:14px;font-size:.88rem;line-height:1.7;color:var(--tinta)">'+h.map(function(x){ return '• '+x; }).join('<br>')+'</div>';
}
function comCargarDetalle(id){
  return Promise.all([
    Nube.tabla('comision_cortes?select=*&id=eq.' + id),
    Nube.tabla('comisiones?select=' + COM_SEL + '&corte_id=eq.' + id + '&order=creado_en.asc'),
    Nube.tabla('comision_ajustes?select=*&corte_id=eq.' + id + '&order=creado_en.asc')
  ]).then(function(r){ return { k:(r[0]||[])[0], comis:r[1]||[], ajus:r[2]||[] }; });
}
/* Impresión / PDF del recibo en una ventana aparte. */
function comImprimir(id, nombreOp){
  var w = window.open('', '_blank'); if(!w) return;
  comCargarDetalle(id).then(function(d){
    var k = d.k;
    w.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Recibo '+esc(k.folio)+' · Instituto Mara</title>'+
      '<style>body{font-family:Arial,sans-serif;color:#1f1640;margin:32px;max-width:860px}table{width:100%;border-collapse:collapse;font-size:13px}'+
      'th,td{border-bottom:1px solid #e6e1f5;padding:7px 6px;text-align:left;vertical-align:top}th{background:#f6f3ff}small{color:#6b6585}'+
      '.etiqueta{font-size:11px;font-weight:bold;text-transform:uppercase;background:#f3f4f6;padding:2px 8px;border-radius:99px}</style></head><body>'+
      '<h2 style="color:#6D28D9;margin:0 0 4px">Instituto Mara</h2>'+comCabecera(k, { nombre:nombreOp })+comDesglose(k, d.comis, d.ajus)+comHistorial(k)+
      '<p style="margin-top:40px;font-size:12px;color:#6b6585">Recibo simple de comisiones por promoción y venta de planes de capacitación. '+
      'La aceptación se registró en institutomara.com con la cuenta del operador.</p>'+
      '<script>setTimeout(function(){ window.print(); }, 300);<\/script></body></html>');
    w.document.close();
  }).catch(function(e){ w.close(); alert(e.message); });
}
function comVerComprobante(id){
  Nube.tabla('comision_comprobantes?select=nombre,tipo,datos&corte_id=eq.' + id).then(function(r){
    var c = r && r[0]; if(!c){ alert('No hay comprobante.'); return; }
    var bin = atob(c.datos), b = new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) b[i] = bin.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([b], { type:c.tipo }));
    var a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener';
    if(!/^image\/|pdf$/.test(c.tipo)) a.download = c.nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
  }).catch(function(e){ alert(e.message); });
}
function comAviso(evento, corteId){ return Nube.funcionServidor('tienda', { accion:'comision_aviso', evento:evento, corteId:corteId || null }).catch(function(){ return null; }); }

/* ============================================================================
   Operador → Comisiones
   ========================================================================== */
function vistaOprComisiones(){
  setTimeout(function(){ oprAsegurar().then(comCargarOpr).catch(function(e){ var c = $('com-datos'); if(c) c.innerHTML = plnErr(e); }); }, 0);
  return '<div class="seccion"><h2>Comisiones</h2><p class="sub">Lo que llevas ganado, tus recibos y tus pagos. '+
    'Cada quincena te llega un recibo: del 1 al 15 (sale el 16) y del 16 al fin de mes (sale el día 1). Revísalo y acéptalo para que te transfiramos.</p>'+
    '<div id="com-datos">Cargando…</div></div>';
}
function comCargarOpr(){
  var op = LL.op || PLN.miOp;
  return Promise.all([
    Nube.tabla('comision_cortes?select=*&order=fecha_corte.desc'),
    Nube.tabla('comisiones?select=' + COM_SEL + '&corte_id=is.null&order=creado_en.desc'),
    Nube.tabla('comision_ajustes?select=*&corte_id=is.null&order=creado_en.desc'),
    Nube.tabla('operadores?select=*&id=eq.' + (op && op.id))
  ]).then(function(r){
    COM.cortes = r[0] || []; COM.pend = r[1] || []; COM.ajPend = r[2] || [];
    if(r[3] && r[3][0]){ LL.op = PLN.miOp = r[3][0]; }
    comPintarOpr();
  });
}
function comPintarOpr(){
  var caja = $('com-datos'); if(!caja) return;
  var op = LL.op || {};
  var acumulado = comSuma(COM.pend.filter(function(c){ return !c.cancelada_en; })) + comSuma(COM.ajPend);
  var porCobrar = COM.cortes.filter(function(k){ return k.estado !== 'pagado'; }).reduce(function(a,k){ return a + Number(k.total||0); }, 0);
  var anio = String(new Date().getFullYear());
  var cobrado = COM.cortes.filter(function(k){ return k.estado === 'pagado' && String(k.pagado_en||'').slice(0,4) === anio; }).reduce(function(a,k){ return a + Number(k.total||0); }, 0);
  var porAceptar = COM.cortes.filter(function(k){ return k.estado === 'enviado'; });
  var cifra = function(t, v, s){ return '<div class="tarjeta" style="flex:1 1 180px;padding:16px 18px"><div style="font-size:.8rem;color:var(--gris);text-transform:uppercase;letter-spacing:.6px">'+t+'</div>'+
    '<div style="font-size:1.5rem;font-weight:800;color:var(--tinta);margin:4px 0">'+dinero(v)+'</div><small style="color:var(--gris)">'+s+'</small></div>'; };
  caja.innerHTML =
    (op.clabe ? '' : '<div class="aviso aviso-error" style="margin-bottom:16px">Todavía no capturas la cuenta donde te depositamos. '+
      '<button class="btn btn-mor btn-sm" style="margin-left:8px" onclick="ir(\'mi-perfil\')">Capturar mi CLABE</button></div>')+
    (porAceptar.length ? '<div class="aviso aviso-info" style="margin-bottom:16px">Tienes '+porAceptar.length+' recibo'+(porAceptar.length>1?'s':'')+' por revisar y aceptar.</div>' : '')+
    '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:18px">'+
      cifra('Acumulado', acumulado, 'Entra en tu siguiente recibo')+
      cifra('Por cobrar', porCobrar, 'Recibos que aún no te pagamos')+
      cifra('Cobrado en ' + anio, cobrado, 'Ya transferido')+
    '</div>'+
    '<div class="tarjeta" style="margin-bottom:18px"><h3 style="color:var(--tinta);margin-bottom:10px">Mis recibos</h3>'+
    (COM.cortes.length ? '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Folio</th><th>Periodo</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody>'+
      COM.cortes.map(function(k){
        return '<tr><td>'+esc(k.folio)+'</td><td>'+esc(comPeriodo(k))+'</td><td><b>'+dinero(k.total)+'</b></td><td>'+comEtiqueta(k.estado)+'</td>'+
          '<td><button class="btn '+(k.estado === 'enviado' ? 'btn-mor' : 'btn-linea')+' btn-sm" onclick="comAbrirOpr(\''+k.id+'\')">'+(k.estado === 'enviado' ? 'Revisar' : 'Ver')+'</button></td></tr>';
      }).join('')+'</tbody></table></div></div>'
      : '<p style="color:var(--gris)">Todavía no tienes recibos. El primero sale en el siguiente corte después de que una de tus empresas pague.</p>')+
    '</div>'+
    '<div class="tarjeta"><h3 style="color:var(--tinta);margin-bottom:4px">Acumulado para tu siguiente recibo</h3>'+
    '<p style="color:var(--gris);font-size:.9rem;margin-bottom:10px">Solo cuentan los pagos que Mercado Pago ya aprobó. 35 % del primer pago (o del pago anual) y 5 % de cada mes siguiente.</p>'+
    (COM.pend.length || COM.ajPend.length ? comDesglose(null, COM.pend, COM.ajPend) : '<p style="color:var(--gris)">Nada por ahora.</p>')+
    '</div>';
}
function comAbrirOpr(id){
  comCargarDetalle(id).then(function(d){
    var k = d.k; if(!k) return;
    var op = LL.op || {};
    var pie = '<button class="btn btn-fantasma" onclick="comImprimir(\''+k.id+'\',\''+esc(op.nombre||'').replace(/'/g,'')+'\')">Imprimir / PDF</button>';
    if(k.estado === 'pagado') pie += '<button class="btn btn-linea" onclick="comVerComprobante(\''+k.id+'\')">Ver comprobante</button>';
    if(k.estado === 'enviado') pie += '<button class="btn btn-linea" onclick="comDudaForm(\''+k.id+'\')">Tengo una duda</button><button class="btn btn-mor" id="com-ok" onclick="comAceptar(\''+k.id+'\')">Acepto</button>';
    abrirModal('Recibo ' + k.folio,
      comCabecera(k, op)+
      (k.respuesta && k.estado === 'enviado' ? '<div class="aviso aviso-info" style="margin-bottom:12px"><b>Respuesta de administración:</b> '+esc(k.respuesta)+'</div>' : '')+
      (k.estado === 'en_revision' ? '<div class="aviso aviso-info" style="margin-bottom:12px">Administración está revisando tu duda. Te avisamos por correo cuando responda.</div>' : '')+
      comDesglose(k, d.comis, d.ajus)+comHistorial(k)+
      (k.estado === 'enviado' ? '<p style="margin-top:14px;font-size:.9rem">Al presionar <b>«Acepto»</b> confirmas que el desglose es correcto y que te depositemos <b>'+dinero(k.total)+'</b> en la cuenta de arriba.'+
        (k.clabe ? '' : ' <b style="color:#991B1B">Primero captura tu CLABE en «Mi perfil».</b>')+'</p>' : '')+
      '<div id="com-av"></div><div id="com-duda"></div>', pie);
    comAncho();
  }).catch(function(e){ alert(e.message); });
}
function comAceptar(id){
  var b = $('com-ok'); if(b){ b.disabled = true; b.textContent = 'Guardando…'; }
  Nube.empresaRpc('corte_aceptar', { p_corte:id }).then(function(){
    comAviso('aceptado', id); cerrarModal();
    abrirModal('¡Listo!', '<p>Aceptaste tu recibo. Administración ya tiene el aviso para transferirte; te llega un correo con el comprobante cuando quede pagado.</p>', '<button class="btn btn-mor" onclick="cerrarModal()">Entendido</button>');
    return comCargarOpr();
  }).catch(function(e){ if(b){ b.disabled = false; b.textContent = 'Acepto'; } $('com-av').innerHTML = plnErr(e); });
}
function comDudaForm(id){
  $('com-duda').innerHTML = '<div class="campo" style="margin-top:12px"><label for="com-dtxt">¿Qué no cuadra?</label>'+
    '<textarea id="com-dtxt" rows="3" maxlength="800" placeholder="Ej. Falta el pago de Hotel Dos del 12 de octubre."></textarea></div>'+
    '<button class="btn btn-mor btn-sm" onclick="comEnviarDuda(\''+id+'\')">Enviar a administración</button>';
  $('com-dtxt').focus();
}
function comEnviarDuda(id){
  Nube.empresaRpc('corte_duda', { p_corte:id, p_comentario:$('com-dtxt').value.trim() }).then(function(){
    comAviso('duda', id); cerrarModal();
    abrirModal('Duda enviada', '<p>Administración revisará tu recibo y te responderá. Cuando lo corrija, te llega de nuevo para aceptarlo.</p>', '<button class="btn btn-mor" onclick="cerrarModal()">Entendido</button>');
    return comCargarOpr();
  }).catch(function(e){ $('com-av').innerHTML = plnErr(e); });
}

/* ---------- Mi perfil: cuenta para comisiones ---------- */
var _vistaMiPerfilCom = vistaMiPerfil;
vistaMiPerfil = function(){
  var h = _vistaMiPerfilCom();
  if(!esOperador()) return h;
  setTimeout(function(){ oprAsegurar().then(comPintarBanco).catch(function(){}); }, 0);
  var tarjeta = '<div class="tarjeta" id="com-banco" style="margin-bottom:20px"><h3 style="font-size:1.05rem;color:var(--tinta);margin-bottom:6px">Cuenta para recibir tus comisiones</h3>'+
    '<p style="color:var(--gris);font-size:.9rem;margin-bottom:12px">Aquí te transferimos. Solo tú y administración la ven. Si la cambias, aplica en los recibos que se generen de hoy en adelante.</p>'+
    '<div id="com-bform">Cargando…</div></div>';
  return h.replace('<div class="tarjeta" style="margin-bottom:20px"><h3 style="font-size:1.05rem;color:var(--tinta);margin-bottom:6px">Correo de acceso', tarjeta + '<div class="tarjeta" style="margin-bottom:20px"><h3 style="font-size:1.05rem;color:var(--tinta);margin-bottom:6px">Correo de acceso');
};
function comPintarBanco(){
  var c = $('com-bform'); if(!c) return;
  var o = LL.op || {};
  c.innerHTML = '<div class="campo"><label for="cb-tit">Titular de la cuenta</label><input id="cb-tit" maxlength="120" value="'+esc(o.titular || o.nombre || '')+'"></div>'+
    '<div class="campo"><label for="cb-clabe">CLABE interbancaria (18 dígitos)</label><input id="cb-clabe" inputmode="numeric" maxlength="22" value="'+esc(o.clabe || '')+'" oninput="comDetectarBanco()" placeholder="002 180 0000000000 0"></div>'+
    '<div class="campo"><label for="cb-banco">Banco</label><input id="cb-banco" maxlength="60" value="'+esc(o.banco || '')+'"></div>'+
    (o.banco_actualizado_en ? '<p style="color:var(--gris);font-size:.85rem;margin-bottom:10px">Última actualización: '+esc(comFechaHora(o.banco_actualizado_en))+'</p>' : '')+
    '<button class="btn btn-mor" onclick="comGuardarBanco()">Guardar cuenta</button><div id="cb-aviso"></div>';
}
function comDetectarBanco(){
  var d = $('cb-clabe').value.replace(/\D/g,''), b = $('cb-banco');
  if(d.length >= 3 && COM_BANCOS[d.slice(0,3)] && (!b.value || b.getAttribute('data-auto'))){ b.value = COM_BANCOS[d.slice(0,3)]; b.setAttribute('data-auto','1'); }
}
function comGuardarBanco(){
  var av = $('cb-aviso');
  Nube.empresaRpc('operador_datos_bancarios', { p_titular:$('cb-tit').value.trim(), p_banco:$('cb-banco').value.trim(), p_clabe:$('cb-clabe').value })
    .then(function(r){
      if(r && r.cambio) comAviso('banco');
      av.innerHTML = '<div class="aviso aviso-ok" style="margin-top:12px">'+(r && r.cambio ? 'Cuenta actualizada. Le avisamos a administración del cambio.' : 'Cuenta guardada.')+'</div>';
      LL.op = null; PLN.miOp = null; return oprAsegurar();
    })
    .catch(function(e){ av.innerHTML = '<div style="margin-top:12px">'+plnErr(e)+'</div>'; });
}

/* ============================================================================
   Administración → Planes y operadores: recibos de comisiones
   ========================================================================== */
var _vistaAdminPlanesCom = vistaAdminPlanes;
vistaAdminPlanes = function(){
  var h = _vistaAdminPlanesCom();
  return h.replace('<div id="pln-aprobar"></div>', '<div id="pln-aprobar"></div><div id="pln-com"></div>');
};
var _plnCargarAdminCom = plnCargarAdmin;
plnCargarAdmin = function(){
  return _plnCargarAdminCom().then(comCargarAdmin);
};
function comCargarAdmin(){
  return Promise.all([
    Nube.tabla('comision_cortes?select=*&order=fecha_corte.desc&limit=300'),
    Nube.tabla('operadores?select=id,nombre,correo,titular,banco,clabe,banco_actualizado_en,banco_cambio_visto&order=nombre.asc'),
    Nube.tabla('comision_ajustes?select=operador_id,monto&corte_id=is.null')
  ]).then(function(r){ COM.admCortes = r[0] || []; COM.admOps = r[1] || []; COM.admAjPend = r[2] || []; comPintarAdmin(); })
    .catch(function(e){ var c = $('pln-com'); if(c) c.innerHTML = plnErr(e, 'Falta correr backend/comisiones-20261019.sql en Supabase.'); });
}
function comOp(id){ return COM.admOps.filter(function(o){ return o.id === id; })[0] || {}; }
function comPintarAdmin(){
  var caja = $('pln-com'); if(!caja) return;
  var orden = { en_revision:0, aceptado:1, enviado:2 };
  var abiertos = COM.admCortes.filter(function(k){ return k.estado !== 'pagado'; }).sort(function(a,b){ return orden[a.estado] - orden[b.estado]; });
  var pagados = COM.admCortes.filter(function(k){ return k.estado === 'pagado'; });
  var cambios = COM.admOps.filter(function(o){ return o.banco_cambio_visto === false; });
  var porPagar = abiertos.filter(function(k){ return k.estado === 'aceptado'; }).reduce(function(a,k){ return a + Number(k.total||0); }, 0);
  var fila = function(k){ var o = comOp(k.operador_id);
    return '<tr><td>'+esc(k.folio)+'</td><td><b>'+esc(o.nombre || '—')+'</b></td><td>'+esc(comPeriodo(k))+'</td><td><b>'+dinero(k.total)+'</b></td><td>'+comEtiqueta(k.estado)+'</td>'+
      '<td><button class="btn '+(k.estado === 'aceptado' || k.estado === 'en_revision' ? 'btn-mor' : 'btn-linea')+' btn-sm" onclick="comAbrirAdmin(\''+k.id+'\')">'+
      (k.estado === 'aceptado' ? 'Pagar' : k.estado === 'en_revision' ? 'Responder' : 'Ver')+'</button></td></tr>'; };
  var tabla = function(l){ return '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Folio</th><th>Operador</th><th>Periodo</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody>'+l.map(fila).join('')+'</tbody></table></div></div>'; };
  caja.innerHTML = '<div class="tarjeta" style="margin-bottom:18px'+(abiertos.some(function(k){ return k.estado !== 'enviado'; }) || cambios.length ? ';border-color:#F59E0B' : '')+'">'+
    '<h3 style="color:var(--tinta);margin-bottom:6px">Comisiones de operadores</h3>'+
    '<p style="color:var(--gris);font-size:.92rem;margin-bottom:12px">Los recibos se arman solos el 16 (del 1 al 15) y el día 1 (del 16 al fin de mes). El operador los acepta o te manda su duda; ya aceptados, transfieres y subes el comprobante.'+
      (porPagar ? ' <b>Por pagar hoy: '+dinero(porPagar)+'</b>.' : '')+'</p>'+
    cambios.map(function(o){ return '<div class="aviso aviso-error" style="margin-bottom:10px">🏦 <b>'+esc(o.nombre)+'</b> cambió su cuenta el '+esc(comFechaHora(o.banco_actualizado_en))+': '+
      esc(o.banco || '')+' · CLABE '+esc(o.clabe || '')+' · titular '+esc(o.titular || '')+'. Confírmalo con él antes de transferir. '+
      '<button class="btn btn-linea btn-sm" style="margin-left:6px" onclick="comCambioVisto(\''+o.id+'\')">Ya lo confirmé</button></div>'; }).join('')+
    (abiertos.length ? tabla(abiertos) : '<p style="color:var(--gris)">No hay recibos pendientes.</p>')+
    (pagados.length ? '<details style="margin-top:12px"><summary style="cursor:pointer;font-weight:600">Recibos pagados ('+pagados.length+')</summary><div style="margin-top:10px">'+tabla(pagados)+'</div></details>' : '')+
    '</div>';
  /* La columna de la tabla de operadores ahora es «Acumulado (sin recibo)». */
  var th = document.querySelectorAll('#pln-ops th'); for(var i=0;i<th.length;i++) if(th[i].textContent === 'Comisión por pagar') th[i].textContent = 'Acumulado (sin recibo)';
}
function comCambioVisto(id){
  Nube.tabla('operadores?id=eq.' + id, { metodo:'PATCH', prefer:'return=minimal', cuerpo:{ banco_cambio_visto:true } })
    .then(comCargarAdmin).catch(function(e){ alert(e.message); });
}
function comAbrirAdmin(id){
  comCargarDetalle(id).then(function(d){
    var k = d.k; if(!k) return;
    var o = comOp(k.operador_id);
    var acc = '';
    if(k.estado === 'aceptado') acc =
      '<div class="tarjeta" style="margin-top:16px;background:#F0FDFA"><h4 style="margin-bottom:8px">Marcar como pagado</h4>'+
      '<p style="font-size:.9rem;margin-bottom:10px">Transfiere <b>'+dinero(k.total)+'</b> a '+esc(k.titular || '')+' · '+esc(k.banco || '')+' · CLABE <b>'+esc(k.clabe || '')+'</b> '+
        '<button class="btn btn-fantasma btn-sm" onclick="copiarTextoCom(\''+esc(k.clabe || '')+'\')">Copiar CLABE</button></p>'+
      '<div class="fila"><div class="campo"><label for="cp-ref">Referencia o clave de rastreo</label><input id="cp-ref" maxlength="60"></div>'+
      '<div class="campo"><label for="cp-arch">Comprobante (PDF o imagen, máx. 4 MB)</label><input id="cp-arch" type="file" accept="application/pdf,image/png,image/jpeg,image/webp"></div></div>'+
      '<button class="btn btn-mor" id="cp-btn" onclick="comPagar(\''+k.id+'\')">Marcar pagado y avisar</button></div>';
    if(k.estado !== 'pagado') acc +=
      '<details style="margin-top:14px"'+(k.estado === 'en_revision' ? ' open' : '')+'><summary style="cursor:pointer;font-weight:600">'+(k.estado === 'en_revision' ? 'Responder la duda' : 'Corregir o enviar un mensaje')+'</summary>'+
      '<div style="margin-top:10px"><div class="campo"><label for="cr-msg">Mensaje para '+esc((o.nombre||'').split(' ')[0])+'</label><textarea id="cr-msg" rows="2" maxlength="600"></textarea></div>'+
      '<div class="fila"><div class="campo"><label for="cr-aj">Ajuste en pesos (opcional; negativo para descontar)</label><input id="cr-aj" type="number" step="0.01"></div>'+
      '<div class="campo"><label for="cr-mot">Motivo del ajuste (lo verá en su recibo)</label><input id="cr-mot" maxlength="200"></div></div>'+
      '<button class="btn btn-linea" onclick="comResponder(\''+k.id+'\')">Enviar y pedirle que lo acepte de nuevo</button></div></details>';
    abrirModal('Recibo ' + k.folio + ' · ' + (o.nombre || ''),
      comCabecera(k, o)+(k.estado === 'en_revision' ? '<div class="aviso aviso-error" style="margin-bottom:12px"><b>Duda de '+esc((o.nombre||'').split(' ')[0])+':</b> '+esc(k.duda)+'</div>' : '')+
      comDesglose(k, d.comis, d.ajus)+comHistorial(k)+acc+'<div id="cp-av"></div>',
      '<button class="btn btn-fantasma" onclick="comImprimir(\''+k.id+'\',\''+esc(o.nombre||'').replace(/'/g,'')+'\')">Imprimir / PDF</button>'+
      (k.estado === 'pagado' ? '<button class="btn btn-linea" onclick="comVerComprobante(\''+k.id+'\')">Ver comprobante</button>' : '')+
      '<button class="btn btn-mor" onclick="cerrarModal()">Cerrar</button>');
    comAncho();
  }).catch(function(e){ alert(e.message); });
}
function copiarTextoCom(t){ try{ navigator.clipboard.writeText(t); }catch(e){} }
function comResponder(id){
  var aj = $('cr-aj').value.trim();
  Nube.empresaRpc('corte_responder', { p_corte:id, p_respuesta:$('cr-msg').value.trim(), p_ajuste:aj === '' ? null : Number(aj), p_motivo:$('cr-mot').value.trim() || null })
    .then(function(){ comAviso('respuesta', id); cerrarModal(); return comCargarAdmin(); })
    .catch(function(e){ $('cp-av').innerHTML = plnErr(e); });
}
function comPagar(id){
  var f = $('cp-arch').files[0], av = $('cp-av'), b = $('cp-btn');
  if(!$('cp-ref').value.trim()){ av.innerHTML = plnErr('Escribe la referencia o clave de rastreo.'); return; }
  if(!f){ av.innerHTML = plnErr('Sube el comprobante de la transferencia.'); return; }
  if(f.size > 4 * 1024 * 1024){ av.innerHTML = plnErr('El comprobante pesa más de 4 MB.'); return; }
  b.disabled = true; b.textContent = 'Subiendo…';
  var lector = new FileReader();
  lector.onload = function(){
    var datos = String(lector.result).split(',')[1] || '';
    Nube.empresaRpc('corte_pagar', { p_corte:id, p_referencia:$('cp-ref').value.trim(), p_nombre:f.name, p_tipo:f.type, p_datos:datos })
      .then(function(){ comAviso('pagado', id); cerrarModal(); return comCargarAdmin(); })
      .catch(function(e){ b.disabled = false; b.textContent = 'Marcar pagado y avisar'; av.innerHTML = plnErr(e); });
  };
  lector.onerror = function(){ b.disabled = false; b.textContent = 'Marcar pagado y avisar'; av.innerHTML = plnErr('No se pudo leer el archivo.'); };
  lector.readAsDataURL(f);
}

/* ============================================================================
   Menú del operador con «Comisiones» y ligas de los correos (?ir=…)
   ========================================================================== */
var _pintarNavCom = pintarNav;
pintarNav = function(){
  _pintarNavCom();
  if(!esOperador()) return;
  var perfil = $('nav').querySelector('button[data-v="mi-perfil"]');
  if(perfil && !$('nav').querySelector('button[data-v="op-comisiones"]')){
    var b = document.createElement('button'); b.setAttribute('data-v', 'op-comisiones'); b.textContent = 'Comisiones';
    b.onclick = function(){ ir('op-comisiones'); };
    $('nav').insertBefore(b, perfil);
  }
};
var _pintarCom = pintar;
pintar = function(){
  if(esOperador() && estado.vista === 'op-comisiones'){
    $('vista').innerHTML = vistaOprComisiones();
    var bs = $('nav').querySelectorAll('button');
    for(var i=0;i<bs.length;i++) bs[i].classList.toggle('activa', bs[i].getAttribute('data-v') === 'op-comisiones');
    return;
  }
  _pintarCom();
};
var _entrarAppCom = entrarApp;
entrarApp = function(){
  var irA = new URLSearchParams(location.search).get('ir');
  _entrarAppCom();
  if(irA === 'op-comisiones' && esOperador()){ history.replaceState(null, '', location.pathname); ir('op-comisiones'); }
  else if(irA === 'admin-planes' && sesion && sesion.rol === 'admin'){ history.replaceState(null, '', location.pathname); ir('admin-planes'); }
};
