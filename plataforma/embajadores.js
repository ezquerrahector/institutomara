/* Instituto Mara — Administración → Embajadores (26 oct 2026).
   Programa de embajadores: cualquier persona se registra en el sitio (sitio-web/embajadores.html),
   recibe un código de descuento y gana comisión por las ventas hechas con él.
   · La venta la registra la base sola (canjear_cupon → registrar_venta_embajador).
   · Aquí administración ve embajadores, ventas y saldos, registra depósitos,
     cancela una comisión por reembolso, pausa un código y ajusta los porcentajes.
   Requiere backend/embajadores-20261026.sql. Se carga después de planes.js. */

var EMB = { lista:null, ventas:[], pagos:[], aj:null, abierto:null };

function embHoy(){ var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
function embCargar(){
  return Promise.all([
    Nube.tabla('embajadores?select=*&order=creado_en.desc'),
    Nube.tabla('embajador_ventas?select=*&order=creado_en.desc&limit=5000'),
    Nube.tabla('embajador_pagos?select=*&order=pagado_en.desc&limit=2000'),
    Nube.tabla('ajustes?id=eq.true&select=embajador_comision_pct,embajador_descuento_pct,embajador_dias_espera,embajador_minimo')
  ]).then(function(r){ EMB.lista = r[0] || []; EMB.ventas = r[1] || []; EMB.pagos = r[2] || []; EMB.aj = (r[3] || [])[0] || {}; });
}
function embSaldos(id){
  var hoy = embHoy(), s = { ventas:0, espera:0, disponible:0, pagado:0, total:0 };
  EMB.ventas.forEach(function(v){
    if(v.embajador_id !== id || v.estado === 'cancelada') return;
    s.ventas++; s.total += Number(v.precio_pagado);
    if(v.estado === 'pagada') s.pagado += Number(v.comision);
    else if(v.disponible_en <= hoy) s.disponible += Number(v.comision);
    else s.espera += Number(v.comision);
  });
  return s;
}
function embEstadoVenta(v){ return v.estado === 'pendiente' ? (v.disponible_en <= embHoy() ? 'Disponible' : 'En espera') : (v.estado === 'pagada' ? 'Pagada' : 'Cancelada'); }

function vistaAdminEmbajadores(){
  if(!NUBE) return '<div class="seccion"><h2>Embajadores</h2><div class="aviso aviso-info">Necesita la conexión con el servidor.</div></div>';
  if(!EMB.lista){
    embCargar().then(function(){ if(estado.vista === 'admin-embajadores') pintar(); })
      .catch(function(e){ var c = $('emb-caja'); if(c) c.innerHTML = '<div class="aviso aviso-error">No se pudieron cargar los embajadores: '+esc(e.message)+'<br>Si es la primera vez, falta ejecutar <b>backend/embajadores-20261026.sql</b>.</div>'; });
    return '<div class="seccion"><h2>Embajadores</h2><div id="emb-caja"><p class="vacio">Cargando…</p></div></div>';
  }
  var a = EMB.aj || {}, min = Number(a.embajador_minimo || 300);
  var tot = { n:EMB.lista.length, activos:0, ventas:0, vendido:0, porPagar:0, listos:0 };
  var filas = EMB.lista.map(function(e){
    var s = embSaldos(e.id);
    if(e.estado === 'activo') tot.activos++;
    tot.ventas += s.ventas; tot.vendido += s.total; tot.porPagar += s.disponible; if(s.disponible >= min) tot.listos++;
    return '<tr><td><b>'+esc(e.nombre)+'</b><br><small>'+esc(e.correo)+(e.telefono ? ' · '+esc(e.telefono) : '')+'</small></td>'+
      '<td><b>'+esc(e.codigo)+'</b><br><small>'+(e.estado === 'activo' ? 'Activo' : e.estado === 'pausado' ? 'Pausado' : 'Baja')+'</small></td>'+
      '<td>'+s.ventas+'<br><small>'+dinero(s.total)+'</small></td>'+
      '<td>'+dinero(s.espera)+'</td><td><b'+(s.disponible >= min ? ' style="color:var(--verde,#059669)"' : '')+'>'+dinero(s.disponible)+'</b></td><td>'+dinero(s.pagado)+'</td>'+
      '<td>'+(e.clabe ? '<small>'+esc(e.banco||'')+' •'+esc(String(e.clabe).slice(-4))+'</small>' : '<small style="color:var(--gris)">Sin cuenta</small>')+'</td>'+
      '<td><button class="btn btn-linea btn-sm" onclick="embAbrir(\''+e.id+'\')">Ver</button></td></tr>';
  }).join('');
  return '<div class="seccion"><h2>Embajadores</h2>'+
    '<p class="sub">Personas que recomiendan cursos con su código. Quien compra tiene '+esc(a.embajador_descuento_pct)+' % de descuento y el embajador gana '+esc(a.embajador_comision_pct)+' % de lo pagado sin IVA. '+
      'La comisión queda disponible a los '+esc(a.embajador_dias_espera)+' días y se deposita al juntar '+dinero(min)+'. Registro público: <a href="../sitio-web/embajadores.html" target="_blank" rel="noopener">sitio-web/embajadores.html</a></p>'+
    '<div class="rejilla rejilla-4" style="margin:14px 0">'+
      '<div class="tarjeta"><small>Embajadores</small><h3>'+tot.n+'</h3><small>'+tot.activos+' activos</small></div>'+
      '<div class="tarjeta"><small>Ventas con código</small><h3>'+tot.ventas+'</h3><small>'+dinero(tot.vendido)+' cobrados</small></div>'+
      '<div class="tarjeta"><small>Comisión disponible</small><h3>'+dinero(tot.porPagar)+'</h3><small>'+tot.listos+' listos para depósito</small></div>'+
      '<div class="tarjeta"><small>Depósitos hechos</small><h3>'+EMB.pagos.length+'</h3><small>'+dinero(EMB.pagos.reduce(function(x, p){ return x + Number(p.monto); }, 0))+'</small></div></div>'+
    (EMB.lista.length ? '<div class="tabla-caja"><div class="tabla-scroll"><table><tr><th>Embajador</th><th>Código</th><th>Ventas</th><th>En espera</th><th>Disponible</th><th>Pagado</th><th>Cuenta</th><th></th></tr>'+filas+'</table></div></div>'
      : '<div class="tarjeta"><p class="vacio">Todavía no hay embajadores. Comparte la página de registro.</p></div>')+
    '<details style="margin-top:22px"><summary><b>Reglas del programa</b></summary>'+
      '<div class="fila" style="margin-top:12px">'+
        '<div class="campo"><label for="emb-com">Comisión (%)</label><input id="emb-com" type="number" min="1" max="60" value="'+esc(a.embajador_comision_pct)+'"></div>'+
        '<div class="campo"><label for="emb-desc">Descuento del cliente (%)</label><input id="emb-desc" type="number" min="0" max="50" value="'+esc(a.embajador_descuento_pct)+'"></div>'+
        '<div class="campo"><label for="emb-dias">Días de espera</label><input id="emb-dias" type="number" min="7" max="60" value="'+esc(a.embajador_dias_espera)+'"></div>'+
        '<div class="campo"><label for="emb-min">Mínimo para depósito ($)</label><input id="emb-min" type="number" min="0" value="'+esc(a.embajador_minimo)+'"></div></div>'+
      '<p style="color:var(--gris);font-size:.88rem">Cambiar el descuento actualiza el cupón de todos los embajadores. La comisión nueva aplica a las ventas siguientes. Hay que mantener el 7 de la garantía por debajo de los días de espera.</p>'+
      '<div id="emb-aj-av"></div><button class="btn btn-mor" onclick="embGuardarReglas()">Guardar reglas</button></details></div>';
}

function embAbrir(id){
  var e = EMB.lista.filter(function(x){ return x.id === id; })[0]; if(!e) return;
  var s = embSaldos(id), min = Number((EMB.aj||{}).embajador_minimo || 300);
  var vs = EMB.ventas.filter(function(v){ return v.embajador_id === id; });
  var ps = EMB.pagos.filter(function(p){ return p.embajador_id === id; });
  var nom = function(cid){ var c = programa(cid); return c ? c.nombre : cid; };
  abrirModal(esc(e.nombre)+' · '+esc(e.codigo),
    '<p style="color:var(--gris);font-size:.9rem">'+esc(e.correo)+(e.telefono ? ' · '+esc(e.telefono) : '')+(e.ciudad || e.pais ? ' · '+esc([e.ciudad, e.pais].filter(Boolean).join(', ')) : '')+
      '<br>Registrado el '+new Date(e.creado_en).toLocaleDateString('es-MX')+(e.como_promueve ? '<br>Cómo promueve: '+esc(e.como_promueve) : '')+'</p>'+
    '<p style="margin:10px 0"><b>Cuenta:</b> '+(e.clabe ? esc(e.titular||'')+' · '+esc(e.banco||'')+' · CLABE '+esc(e.clabe) : '<span style="color:var(--gris)">no ha registrado cuenta</span>')+'</p>'+
    '<p><b>Disponible:</b> '+dinero(s.disponible)+' · <b>En espera:</b> '+dinero(s.espera)+' · <b>Pagado:</b> '+dinero(s.pagado)+'</p>'+
    (s.disponible > 0 ? '<div class="tarjeta" style="margin:12px 0"><b>Registrar depósito por '+dinero(s.disponible)+'</b>'+(s.disponible < min ? ' <small style="color:var(--gris)">(aún no llega al mínimo de '+dinero(min)+')</small>' : '')+
      '<div class="fila" style="margin-top:8px"><div class="campo"><label for="emb-ref">Referencia o clave de rastreo</label><input id="emb-ref" maxlength="80"></div></div>'+
      '<div id="emb-p-av"></div><button class="btn btn-mor btn-sm" onclick="embPagar(\''+id+'\')"'+(e.clabe ? '' : ' disabled title="Falta su cuenta"')+'>Marcar como depositado</button></div>' : '')+
    '<h4 style="margin:14px 0 6px">Ventas</h4>'+(vs.length ? '<div class="tabla-scroll"><table><tr><th>Fecha</th><th>Programa</th><th>Pagó</th><th>Comisión</th><th>Estado</th><th></th></tr>'+
      vs.map(function(v){ return '<tr><td>'+new Date(v.creado_en).toLocaleDateString('es-MX')+'</td><td>'+esc(nom(v.curso_id))+(v.tipo === 'regalo' ? ' 🎁' : '')+'</td><td>'+dinero(v.precio_pagado)+'</td><td>'+dinero(v.comision)+'</td><td>'+embEstadoVenta(v)+'</td>'+
        '<td>'+(v.estado === 'pendiente' ? '<button class="btn btn-fantasma btn-sm" title="Reembolso o contracargo" onclick="embCancelar(\''+v.id+'\',\''+id+'\')">Cancelar</button>' : '')+'</td></tr>'; }).join('')+'</table></div>' : '<p class="vacio">Sin ventas todavía.</p>')+
    (ps.length ? '<h4 style="margin:14px 0 6px">Depósitos</h4><ul>'+ps.map(function(p){ return '<li>'+new Date(p.pagado_en).toLocaleDateString('es-MX')+': '+dinero(p.monto)+(p.referencia ? ' · '+esc(p.referencia) : '')+'</li>'; }).join('')+'</ul>' : '')+
    '<div class="fila" style="margin-top:14px;gap:8px">'+
      (e.estado === 'activo' ? '<button class="btn btn-linea btn-sm" onclick="embEstado(\''+id+'\',\'pausado\')">Pausar código</button>' : '<button class="btn btn-linea btn-sm" onclick="embEstado(\''+id+'\',\'activo\')">Reactivar código</button>')+
    '</div>',
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cerrar</button>');
}
function embRefrescar(id){ return embCargar().then(function(){ pintar(); if(id) embAbrir(id); }); }
function embPagar(id){
  var e = EMB.lista.filter(function(x){ return x.id === id; })[0], hoy = embHoy();
  var vs = EMB.ventas.filter(function(v){ return v.embajador_id === id && v.estado === 'pendiente' && v.disponible_en <= hoy; });
  var monto = Math.round(vs.reduce(function(x, v){ return x + Number(v.comision); }, 0) * 100) / 100;
  if(!vs.length || monto <= 0) return;
  if(!confirm('¿Registrar el depósito de '+dinero(monto)+' a '+e.nombre+'?')) return;
  Nube.tabla('embajador_pagos', { metodo:'POST', prefer:'return=representation', cuerpo:{ embajador_id:id, monto:monto, referencia:($('emb-ref').value || '').trim() || null } })
    .then(function(r){ var pid = r && r[0] && r[0].id;
      return Nube.tabla('embajador_ventas?id=in.('+vs.map(function(v){ return v.id; }).join(',')+')', { metodo:'PATCH', cuerpo:{ estado:'pagada', pago_id:pid } }); })
    .then(function(){ return embRefrescar(id); })
    .catch(function(x){ var av = $('emb-p-av'); if(av) av.innerHTML = '<div class="aviso aviso-error">'+esc(x.message)+'</div>'; });
}
function embCancelar(ventaId, id){
  if(!confirm('¿Cancelar esta comisión? Úsalo cuando hubo reembolso o contracargo de la venta.')) return;
  Nube.tabla('embajador_ventas?id=eq.'+ventaId, { metodo:'PATCH', cuerpo:{ estado:'cancelada' } }).then(function(){ return embRefrescar(id); }).catch(function(x){ alert(x.message); });
}
function embEstado(id, est){
  var e = EMB.lista.filter(function(x){ return x.id === id; })[0];
  Promise.all([
    Nube.tabla('embajadores?id=eq.'+id, { metodo:'PATCH', cuerpo:{ estado:est } }),
    Nube.tabla('cupones?codigo=eq.'+encodeURIComponent(e.codigo), { metodo:'PATCH', cuerpo:{ activo:est === 'activo' } })
  ]).then(function(){ return embRefrescar(id); }).catch(function(x){ alert(x.message); });
}
function embGuardarReglas(){
  var n = function(id){ return Number($(id).value); }, av = $('emb-aj-av');
  var d = { embajador_comision_pct:n('emb-com'), embajador_descuento_pct:n('emb-desc'), embajador_dias_espera:n('emb-dias'), embajador_minimo:n('emb-min') };
  if(!(d.embajador_comision_pct > 0) || d.embajador_descuento_pct < 0 || d.embajador_dias_espera < 7){ av.innerHTML = '<div class="aviso aviso-error">Revisa los valores: comisión mayor a 0 y al menos 7 días de espera.</div>'; return; }
  var cambiaDesc = d.embajador_descuento_pct !== Number(EMB.aj.embajador_descuento_pct);
  Nube.tabla('ajustes?id=eq.true', { metodo:'PATCH', cuerpo:d })
    .then(function(){ return cambiaDesc && d.embajador_descuento_pct > 0 ? Nube.tabla('cupones?descripcion=like.Embajador:*', { metodo:'PATCH', cuerpo:{ valor:d.embajador_descuento_pct } }) : null; })
    .then(function(){ return embCargar(); }).then(function(){ pintar(); })
    .catch(function(x){ av.innerHTML = '<div class="aviso aviso-error">'+esc(x.message)+'</div>'; });
}

/* Menú: «Embajadores» antes de «Reseñas» (solo administración) */
var _pintarNavEmb = pintarNav;
pintarNav = function(){
  _pintarNavEmb();
  if(!sesion || sesion.rol !== 'admin') return;
  if($('nav').querySelector('button[data-v="admin-embajadores"]')) return;
  var b = document.createElement('button'); b.setAttribute('data-v', 'admin-embajadores'); b.textContent = 'Embajadores';
  b.onclick = function(){ ir('admin-embajadores'); };
  var ref = $('nav').querySelector('button[data-v="admin-resenas"]');
  if(ref) $('nav').insertBefore(b, ref); else $('nav').appendChild(b);
};
var _pintarEmb = pintar;
pintar = function(){
  if(sesion && sesion.rol === 'admin' && estado.vista === 'admin-embajadores'){
    $('vista').innerHTML = vistaAdminEmbajadores();
    var bs = $('nav').querySelectorAll('button');
    for(var i=0;i<bs.length;i++) bs[i].classList.toggle('activa', bs[i].getAttribute('data-v') === 'admin-embajadores');
    return;
  }
  _pintarEmb();
};
