/* Instituto Mara — Constancias en Administración y módulo Empresas (13 oct 2026).
   Se carga después del script principal: estas funciones reemplazan a las anteriores
   del mismo nombre. Requiere backend/empresas-admin.sql en Supabase. */
/* Administración → Constancias.
   Antes solo listaba las constancias que el alumno ya había abierto alguna vez
   (el folio se crea al abrir «Ver y descargar»). Ahora muestra también a quien
   terminó y nunca la abrió, para que administración la emita y la vea. */
var FILTRO_CONST = { q:'', curso:'' };
function pendientesDeConstancia(){
  var tiene = {}, i, out = [];
  for(i=0;i<BD.constancias.length;i++) tiene[BD.constancias[i].usuarioId+'|'+BD.constancias[i].cursoId] = true;
  for(i=0;i<BD.inscripciones.length;i++){
    var ins = BD.inscripciones[i], c = curso(ins.cursoId), u = usuario(ins.usuarioId);
    if(!c || !u || tiene[ins.usuarioId+'|'+ins.cursoId] || ins.estatus === 'piloto') continue;
    if(cursoCompleto(ins.usuarioId, c)) out.push({ usuario:u, curso:c, ins:ins });
  }
  return out;
}
function vistaAdminVerificacion(){
  if(!sesion || sesion.rol !== 'admin') return '';
  var q = FILTRO_CONST.q.toLowerCase(), fc = FILTRO_CONST.curso;
  var pasa = function(nombre, correo, cid){
    if(fc && cid !== fc) return false;
    return !q || (String(nombre||'')+' '+String(correo||'')).toLowerCase().indexOf(q) >= 0;
  };
  var pend = pendientesDeConstancia().filter(function(p){ return pasa(p.usuario.nombre, p.usuario.correo, p.curso.id); });
  var emit = BD.constancias.slice().sort(function(a,b){ return String(b.fecha).localeCompare(String(a.fecha)); })
    .filter(function(r){ var u = usuario(r.usuarioId); return pasa(r.nombreAlumno+' '+r.folio+' '+r.nombreCurso, u ? u.correo : '', r.cursoId); });
  var cursosCon = {}; BD.constancias.forEach(function(r){ cursosCon[r.cursoId] = r.nombreCurso; });
  pendientesDeConstancia().forEach(function(p){ cursosCon[p.curso.id] = p.curso.nombre; });
  var opts = Object.keys(cursosCon).sort(function(a,b){ return cursosCon[a].localeCompare(cursosCon[b]); })
    .map(function(id){ return '<option value="'+esc(id)+'"'+(fc===id?' selected':'')+'>'+esc(cursosCon[id])+'</option>'; }).join('');
  var h = '<div class="seccion"><div class="encabezado-fila"><div><h2>Constancias</h2>'+
    '<p class="sub" style="margin:0">Todas las constancias emitidas y los alumnos que ya terminaron pero aún no generan la suya.</p></div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-linea" onclick="descargarConstanciasCSV()">Descargar listado (Excel)</button></div></div>'+
    '<div class="fila" style="margin:14px 0 18px"><div class="campo" style="margin:0"><label for="kc-q">Buscar alumno, correo o folio</label>'+
      '<input id="kc-q" value="'+esc(FILTRO_CONST.q)+'" oninput="FILTRO_CONST.q=this.value;clearTimeout(window._kcT);window._kcT=setTimeout(function(){pintar();var e=$(\'kc-q\');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length);}},300)"></div>'+
    '<div class="campo" style="margin:0"><label for="kc-c">Programa</label><select id="kc-c" onchange="FILTRO_CONST.curso=this.value;pintar()"><option value="">Todos</option>'+opts+'</select></div></div>';
  if(pend.length){
    h += '<div class="aviso aviso-info" style="margin-bottom:12px"><b>'+pend.length+'</b> alumno'+(pend.length===1?' terminó':'s terminaron')+
      ' y todavía no tiene'+(pend.length===1?'':'n')+' su constancia emitida. Puedes emitirla tú: queda registrada con su folio y QR, igual que si la abriera el alumno.</div>'+
      '<div class="tabla-caja" style="margin-bottom:26px"><div class="tabla-scroll"><table><thead><tr><th>Alumno</th><th>Programa</th><th>Horas</th><th></th></tr></thead><tbody>'+
      pend.map(function(p){
        var mem = p.ins.estatus === 'membresia' && p.curso.nivel === 'Diplomados';
        return '<tr><td><b>'+esc(p.usuario.nombreConstancia || p.usuario.nombre)+'</b><br><small>'+esc(p.usuario.correo||'')+'</small></td>'+
          '<td>'+esc(p.curso.nombre)+(mem?'<br><small style="color:#92400E">Tomado con membresía: revisa los días mínimos antes de emitir.</small>':'')+'</td>'+
          '<td>'+p.curso.horas+'</td><td><button class="btn btn-mor btn-sm" onclick="emitirConstanciaAdmin(\''+p.usuario.id+'\',\''+p.curso.id+'\',this)">Emitir y ver</button></td></tr>';
      }).join('')+'</tbody></table></div></div>';
  }
  h += '<h3 style="margin:0 0 10px;color:var(--tinta)">Emitidas ('+emit.length+')</h3>'+
    '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr>'+
    '<th>Folio</th><th>Alumno</th><th>Programa</th><th>Horas</th><th>Fecha</th><th></th></tr></thead><tbody>';
  if(!emit.length) h += '<tr><td colspan="6" class="vacio">'+(BD.constancias.length ? 'Ninguna coincide con la búsqueda.' : 'Aún no se ha emitido ninguna constancia.')+'</td></tr>';
  emit.forEach(function(r){
    var u = usuario(r.usuarioId);
    h += '<tr><td><b>'+esc(r.folio)+'</b></td><td>'+esc(r.nombreAlumno)+(u&&u.correo?'<br><small>'+esc(u.correo)+'</small>':'')+'</td><td>'+esc(r.nombreCurso)+'</td>'+
      '<td>'+r.horas+'</td><td>'+esc(r.fecha)+'</td><td style="white-space:nowrap"><button class="btn btn-linea btn-sm" onclick="ir(\'constancia\',{constanciaId:\''+esc(r.id)+'\'})">Ver / descargar</button> '+
      (u && u.tel ? '<button class="btn btn-fantasma btn-sm" onclick="enviarConstanciaWA(\''+esc(r.id)+'\')">WhatsApp</button>' : '')+'</td></tr>';
  });
  return h + '</tbody></table></div></div></div>';
}
function emitirConstanciaAdmin(uid, cid, btn){
  if(btn){ btn.disabled = true; btn.textContent = 'Emitiendo…'; }
  var rec = asegurarConstancia(uid, cid);
  Promise.resolve(NUBE ? Nube.asegurarConstanciaPublicada(rec) : null).then(function(){
    ir('constancia', { constanciaId: rec.id });
  }).catch(function(e){
    if(btn){ btn.disabled = false; btn.textContent = 'Emitir y ver'; }
    alert('No se pudo registrar la constancia en el servidor: '+e.message);
  });
}
function enviarConstanciaWA(id){
  var r = BD.constancias.find(function(x){ return x.id === id; }); if(!r) return;
  var u = usuario(r.usuarioId), c = curso(r.cursoId), url = urlVerificacion(r, c);
  var tel = String(u && u.tel || '').replace(/\D/g,''); if(tel.length === 10) tel = '52' + tel;
  var t = '🎓 ¡Felicidades, ' + String(r.nombreAlumno).split(' ')[0] + '! Tu constancia de *' + r.nombreCurso + '* (folio ' + r.folio + ') ya está lista.\n\n' +
    'Puedes descargarla desde el aula en «Constancias»: ' + location.origin + location.pathname + '?ir=constancias\nVerificación pública: ' + url;
  window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(t), '_blank', 'noopener');
}
function csvCelda(v){ v = v == null ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v; }
function descargarCSV(nombre, encabezados, filas){
  var txt = String.fromCharCode(0xFEFF) + [encabezados].concat(filas).map(function(f){ return f.map(csvCelda).join(','); }).join('\r\n');
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type:'text/csv;charset=utf-8' }));
  a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
}
function descargarConstanciasCSV(){
  var filas = BD.constancias.map(function(r){
    var u = usuario(r.usuarioId), c = curso(r.cursoId);
    return [r.folio, r.nombreAlumno, u ? u.correo : '', r.nombreCurso, r.horas, r.fecha, urlVerificacion(r, c)];
  });
  pendientesDeConstancia().forEach(function(p){
    filas.push(['(sin emitir)', p.usuario.nombreConstancia || p.usuario.nombre, p.usuario.correo, p.curso.nombre, p.curso.horas, '', '']);
  });
  descargarCSV('constancias-instituto-mara-' + hoy() + '.csv', ['Folio','Alumno','Correo','Programa','Horas','Fecha','Verificación'], filas);
}

/* ============================================================================
   Empresas: Administración → Empresas, y portal «Mi empresa» para el
   administrador de cada empresa (solo ve a su gente y los programas que pagó).
   Requiere backend/empresas-admin.sql.
   ========================================================================== */
var EMP = { datos:null, rep:{}, filtro:{ q:'', curso:'', estado:'' } };
function empresaPorId(id){
  var l = (EMP.datos && EMP.datos.empresas) || BD.misEmpresasAdmin || [];
  for(var i=0;i<l.length;i++) if(l[i].id === id) return l[i];
  return null;
}
function urlVerificarFolio(folio){
  var base = BD.config.urlPublica || new URL('../', location.href).href;
  var d = new URL('verificar.html', base.replace(/\/+$/, '') + '/'); d.searchParams.set('f', folio); return d.href;
}
function hace(iso){
  if(!iso) return 'Nunca';
  var d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? 'Hoy' : d === 1 ? 'Ayer' : 'Hace ' + d + ' días';
}
function cargarMisEmpresas(){
  if(!NUBE || !sesion || sesion.rol === 'admin') return Promise.resolve([]);
  return Nube.misEmpresas().then(function(l){
    var antes = (BD.misEmpresasAdmin || []).length;
    BD.misEmpresasAdmin = l || [];
    if(antes !== BD.misEmpresasAdmin.length) pintarNav();
    if(estado.vista === 'mi-empresa') pintar();
    return BD.misEmpresasAdmin;
  });
}

/* ---------- Administración → Empresas (lista) ---------- */
function vistaAdminEmpresas(){
  if(!sesion || sesion.rol !== 'admin') return '';
  setTimeout(function(){
    Nube.empresasAdmin().then(function(d){ EMP.datos = d; pintarListaEmpresas(); })
      .catch(function(e){ var c = $('ae-datos'); if(c) c.innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+
        '<br><small>Si dice que no existe la tabla, falta ejecutar backend/empresas-admin.sql en Supabase.</small></div>'; });
  }, 0);
  return '<div class="seccion"><div class="encabezado-fila"><div><h2>Empresas</h2>'+
    '<p class="sub" style="margin:0">Clientes corporativos: sus paquetes, sus administradores y el avance de su gente.</p></div>'+
    '<button class="btn btn-mor" onclick="nuevaEmpresa()">+ Nueva empresa</button></div><div id="ae-datos">Cargando…</div></div>';
}
function pintarListaEmpresas(){
  var caja = $('ae-datos'), d = EMP.datos; if(!caja || !d) return;
  var cuenta = function(lista, id, campo){ return lista.filter(function(x){ return x[campo||'empresa_id'] === id; }).length; };
  var lugares = function(id){ return d.compras.filter(function(c){ return c.empresa_id === id && c.estado === 'pagado'; })
    .reduce(function(a,c){ return a + Number(c.lugares||0); }, 0); };
  var ventas = function(id){ return d.compras.filter(function(c){ return c.empresa_id === id && c.estado === 'pagado'; })
    .reduce(function(a,c){ return a + Number(c.total||0); }, 0); };
  var h = '';
  if(!d.empresas.length) h += '<div class="tarjeta vacio"><p>Aún no hay empresas. Crea la primera con «Nueva empresa» o desde una compra en línea (abajo).</p></div>';
  else h += '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Empresa</th><th>Administradores</th><th>Empleados</th><th>Lugares</th><th>Vendido</th><th></th></tr></thead><tbody>'+
    d.empresas.map(function(e){
      return '<tr><td><b>'+esc(e.nombre)+'</b>'+(e.activo?'':' <span class="etiqueta gris">Inactiva</span>')+(e.rfc?'<br><small>'+esc(e.rfc)+'</small>':'')+'</td>'+
        '<td>'+cuenta(d.admins, e.id)+'</td><td>'+cuenta(d.miembros, e.id)+'</td><td>'+lugares(e.id)+'</td><td>'+dinero(ventas(e.id))+'</td>'+
        '<td><button class="btn btn-linea btn-sm" onclick="ir(\'admin-empresa\',{empresaId:\''+e.id+'\'})">Abrir</button></td></tr>';
    }).join('')+'</tbody></table></div></div>';
  var sueltas = d.compras.filter(function(c){ return !c.empresa_id && c.estado === 'pagado'; });
  if(sueltas.length){
    h += '<h3 style="margin:26px 0 6px;color:var(--tinta)">Compras en línea sin empresa ligada</h3>'+
      '<p class="sub">Paquetes que alguien pagó desde «Capacita a tu equipo». Lígalos a una empresa para que aparezcan en su reporte.</p>'+
      '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Empresa (como la escribió)</th><th>Programa</th><th>Lugares</th><th>Total</th><th></th></tr></thead><tbody>'+
      sueltas.map(function(c){
        var p = programa(c.curso_id);
        return '<tr><td><b>'+esc(c.empresa)+'</b><br><small>'+esc(c.contacto_correo||'')+'</small></td><td>'+esc(p?p.nombre:c.curso_id)+'</td><td>'+c.lugares+'</td><td>'+dinero(c.total)+'</td>'+
          '<td style="white-space:nowrap"><button class="btn btn-mor btn-sm" onclick="empresaDesdeCompra(\''+c.id+'\')">Crear empresa</button> '+
          (d.empresas.length ? '<select onchange="if(this.value)ligarCompraEmpresa(\''+c.id+'\',this.value)" style="max-width:170px"><option value="">Ligar a…</option>'+
            d.empresas.map(function(e){ return '<option value="'+e.id+'">'+esc(e.nombre)+'</option>'; }).join('')+'</select>' : '')+'</td></tr>';
      }).join('')+'</tbody></table></div></div>';
  }
  caja.innerHTML = h;
}
function formEmpresa(e){
  e = e || {};
  return '<div class="fila"><div class="campo"><label for="ef-nom">Nombre comercial *</label><input id="ef-nom" maxlength="160" value="'+esc(e.nombre||'')+'"></div>'+
    '<div class="campo"><label for="ef-rs">Razón social</label><input id="ef-rs" maxlength="200" value="'+esc(e.razon_social||'')+'"></div></div>'+
    '<div class="fila"><div class="campo"><label for="ef-rfc">RFC</label><input id="ef-rfc" maxlength="13" style="text-transform:uppercase" value="'+esc(e.rfc||'')+'"></div>'+
    '<div class="campo"><label for="ef-desc">Descuento pactado (%)</label><input id="ef-desc" type="number" min="0" max="100" value="'+esc(e.descuento_pct==null?0:e.descuento_pct)+'"></div></div>'+
    '<div class="fila"><div class="campo"><label for="ef-cn">Contacto</label><input id="ef-cn" maxlength="120" value="'+esc(e.contacto_nombre||'')+'"></div>'+
    '<div class="campo"><label for="ef-cc">Correo de contacto</label><input id="ef-cc" type="email" value="'+esc(e.contacto_correo||'')+'"></div>'+
    '<div class="campo"><label for="ef-ct">Teléfono</label><input id="ef-ct" type="tel" value="'+esc(e.contacto_tel||'')+'"></div></div>'+
    '<div class="campo"><label for="ef-notas">Notas internas (no las ve la empresa)</label><textarea id="ef-notas" rows="2">'+esc(e.notas||'')+'</textarea></div>'+
    (e.id ? '<label style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><input type="checkbox" id="ef-act"'+(e.activo!==false?' checked':'')+'> Activa (si la apagas, sus administradores dejan de ver el portal)</label>' : '')+
    '<div id="ef-aviso"></div>';
}
function leerFormEmpresa(){
  var d = { nombre:$('ef-nom').value.trim(), razon_social:$('ef-rs').value.trim()||null, rfc:$('ef-rfc').value.trim().toUpperCase()||null,
    descuento_pct:Math.max(0, Math.min(100, Number($('ef-desc').value)||0)), contacto_nombre:$('ef-cn').value.trim()||null,
    contacto_correo:$('ef-cc').value.trim()||null, contacto_tel:$('ef-ct').value.replace(/\D/g,'')||null, notas:$('ef-notas').value.trim()||null };
  if($('ef-act')) d.activo = $('ef-act').checked;
  return d;
}
function nuevaEmpresa(pref){
  abrirModal('Nueva empresa', formEmpresa(pref),
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cancelar</button><button id="ef-btn" class="btn btn-mor" onclick="crearEmpresa()">Crear</button>');
}
function crearEmpresa(compraId, adminCorreo){
  var d = leerFormEmpresa(), av = $('ef-aviso'), b = $('ef-btn');
  if(!d.nombre){ av.innerHTML = '<div class="aviso aviso-error">Escribe el nombre de la empresa.</div>'; return; }
  b.disabled = true;
  Nube.guardarEmpresa(null, d).then(function(e){
    var pasos = [];
    if(compraId) pasos.push(Nube.empresaRpc('empresa_ligar_compra', { p_compra:compraId, p_empresa:e.id }));
    if(adminCorreo) pasos.push(Nube.empresaRpc('empresa_agregar_admin', { p_empresa:e.id, p_correo:adminCorreo, p_nombre:d.contacto_nombre }));
    return Promise.all(pasos).then(function(){ cerrarModal(); ir('admin-empresa', { empresaId:e.id }); });
  }).catch(function(e){ b.disabled = false; av.innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
}
function empresaDesdeCompra(compraId){
  var c = EMP.datos.compras.filter(function(x){ return x.id === compraId; })[0]; if(!c) return;
  var comprador = usuario(c.comprador_id), correo = c.contacto_correo || (comprador && comprador.correo) || '';
  abrirModal('Nueva empresa desde la compra', formEmpresa({ nombre:c.empresa, rfc:c.rfc, contacto_nombre:c.contacto_nombre || (comprador && comprador.nombre),
      contacto_correo:correo, contacto_tel:c.contacto_tel })+
    '<p style="color:var(--gris);font-size:.9rem">Se liga la compra y <b>'+esc(correo||'quien compró')+'</b> queda como administrador de la empresa.</p>',
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cancelar</button><button id="ef-btn" class="btn btn-mor" onclick="crearEmpresa(\''+compraId+'\',\''+esc(correo)+'\')">Crear y ligar</button>');
}
function ligarCompraEmpresa(compraId, empresaId){
  Nube.empresaRpc('empresa_ligar_compra', { p_compra:compraId, p_empresa:empresaId })
    .then(function(){ pintar(); }).catch(function(e){ alert(e.message); });
}

/* ---------- Administración → ficha de una empresa ---------- */
function vistaAdminEmpresa(){
  if(!sesion || sesion.rol !== 'admin') return '';
  var id = estado.empresaId;
  setTimeout(function(){
    Nube.empresasAdmin().then(function(d){
      EMP.datos = d;
      var e = empresaPorId(id), caja = $('aemp-cab'); if(!caja) return;
      if(!e){ caja.innerHTML = '<div class="aviso aviso-error">No se encontró la empresa.</div>'; return; }
      caja.innerHTML = '<h2>'+esc(e.nombre)+'</h2><p class="sub" style="margin:0">'+(e.rfc?esc(e.rfc)+' · ':'')+(e.contacto_nombre?esc(e.contacto_nombre)+' · ':'')+esc(e.contacto_correo||'')+
        (Number(e.descuento_pct)?' · descuento pactado '+Number(e.descuento_pct)+'%':'')+'</p>';
      pintarAdminsEmpresa(id); pintarComprasEmpresa(id);
      $('aemp-datos').innerHTML = formEmpresa(e)+'<button id="ef-btn" class="btn btn-mor" onclick="guardarDatosEmpresa(\''+id+'\')">Guardar datos</button>';
    }).catch(function(e){ var c = $('aemp-cab'); if(c) c.innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
    cargarReporteEmpresa(id, 'admin');
  }, 0);
  return '<div class="seccion"><button class="btn btn-fantasma btn-sm no-imprimir" style="margin-bottom:14px" onclick="ir(\'admin-empresas\')">← Empresas</button>'+
    '<div id="aemp-cab">Cargando…</div>'+
    '<div id="rep-emp" style="margin-top:22px"></div>'+
    '<div class="no-imprimir">'+
    '<div class="tarjeta" style="margin-top:26px"><h3 style="color:var(--tinta);margin-bottom:6px">Administradores de la empresa</h3>'+
      '<p style="color:var(--gris);font-size:.92rem;margin-bottom:12px">Entran al aula con su propia cuenta y ven el menú «Mi empresa» con el avance de su gente. Si aún no tienen cuenta, se activa sola cuando se registren con ese correo.</p>'+
      '<div id="aemp-admins">Cargando…</div></div>'+
    '<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:6px">Paquetes y lugares</h3><div id="aemp-compras">Cargando…</div></div>'+
    '<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:6px">Agregar empleado con cuenta</h3>'+
      '<p style="color:var(--gris);font-size:.92rem;margin-bottom:12px">Para alguien que ya tiene cuenta y se inscribió por su lado. Quienes entran con un código de la empresa se agregan solos.</p>'+
      '<div class="fila"><div class="campo"><label for="am-cor">Correo de su cuenta</label><input id="am-cor" type="email"></div>'+
      '<div class="campo"><label for="am-area">Área</label><input id="am-area" maxlength="80"></div>'+
      '<div class="campo"><label for="am-num">No. de empleado</label><input id="am-num" maxlength="40"></div></div><div id="am-aviso"></div>'+
      '<button class="btn btn-linea" onclick="agregarMiembroEmpresa(\''+id+'\')">Agregar</button></div>'+
    '<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:12px">Datos de la empresa</h3><div id="aemp-datos">Cargando…</div></div>'+
    '</div></div>';
}
function guardarDatosEmpresa(id){
  var d = leerFormEmpresa(), av = $('ef-aviso');
  if(!d.nombre){ av.innerHTML = '<div class="aviso aviso-error">El nombre no puede quedar vacío.</div>'; return; }
  Nube.guardarEmpresa(id, d).then(function(){ av.innerHTML = '<div class="aviso aviso-ok">Guardado.</div>'; })
    .catch(function(e){ av.innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
}
function pintarAdminsEmpresa(id){
  var caja = $('aemp-admins'); if(!caja) return;
  var l = EMP.datos.admins.filter(function(a){ return a.empresa_id === id; });
  caja.innerHTML = (l.length ? '<div class="tabla-caja" style="margin-bottom:12px"><div class="tabla-scroll"><table><tr><th>Persona</th><th>Estado</th><th></th></tr>'+
    l.map(function(a){
      return '<tr><td><b>'+esc(a.nombre||a.correo)+'</b><br><small>'+esc(a.correo)+'</small></td>'+
        '<td>'+(a.usuario_id ? '<span class="etiqueta ok">Activo</span>' : '<span class="etiqueta alerta">Falta que se registre</span>')+'</td>'+
        '<td style="white-space:nowrap"><button class="btn btn-fantasma btn-sm" onclick="invitarAdminEmpresa(\''+id+'\',\''+a.id+'\')">Enviar acceso</button> '+
        '<button class="btn btn-fantasma btn-sm" onclick="quitarAdminEmpresa(\''+id+'\',\''+a.id+'\')">Quitar</button></td></tr>';
    }).join('')+'</table></div></div>' : '<p style="color:var(--gris);margin-bottom:12px">Todavía no hay administradores.</p>')+
    '<div class="fila"><div class="campo"><label for="ad-cor">Correo *</label><input id="ad-cor" type="email"></div>'+
    '<div class="campo"><label for="ad-nom">Nombre</label><input id="ad-nom" maxlength="120"></div></div><div id="ad-aviso"></div>'+
    '<button class="btn btn-linea" onclick="agregarAdminEmpresa(\''+id+'\')">Agregar administrador</button>';
}
function agregarAdminEmpresa(id){
  var cor = $('ad-cor').value.trim(), av = $('ad-aviso');
  Nube.empresaRpc('empresa_agregar_admin', { p_empresa:id, p_correo:cor, p_nombre:$('ad-nom').value.trim() })
    .then(function(f){ EMP.datos.admins = EMP.datos.admins.filter(function(a){ return a.id !== f.id; }).concat([f]); pintarAdminsEmpresa(id);
      invitarAdminEmpresa(id, f.id); })
    .catch(function(e){ av.innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
}
function quitarAdminEmpresa(id, aid){
  if(!confirm('¿Quitar a este administrador? Deja de ver el portal de la empresa.')) return;
  Nube.quitarAdminEmpresa(aid).then(function(){ EMP.datos.admins = EMP.datos.admins.filter(function(a){ return a.id !== aid; }); pintarAdminsEmpresa(id); })
    .catch(function(e){ alert(e.message); });
}
function invitarAdminEmpresa(id, aid){
  var a = EMP.datos.admins.filter(function(x){ return x.id === aid; })[0], e = empresaPorId(id); if(!a || !e) return;
  var enlace = location.origin + location.pathname + '?ir=mi-empresa';
  var t = 'Hola' + (a.nombre ? ' ' + a.nombre.split(' ')[0] : '') + ', ya tienes acceso al panel de *' + e.nombre + '* en Instituto Mara para ver el avance y las constancias de tu equipo.\n\n' +
    (a.usuario_id ? '👉 Entra con tu cuenta (' + a.correo + ') aquí: ' : '👉 Crea tu cuenta con este mismo correo (' + a.correo + ') y verás el menú «Mi empresa»: ') + enlace;
  abrirModal('Enviar acceso a '+(a.nombre||a.correo),
    '<p style="margin-bottom:10px">Mándale este mensaje por WhatsApp o correo:</p><textarea id="ia-txt" rows="7" style="width:100%">'+esc(t)+'</textarea>',
    '<button class="btn btn-fantasma" onclick="copiarTexto($(\'ia-txt\').value)">Copiar</button>'+
    '<button id="ia-correo" class="btn btn-linea" onclick="enviarAccesoCorreo(\''+id+'\',\''+aid+'\')">Enviar por correo</button>'+
    '<button class="btn btn-mor" onclick="window.open(\'https://wa.me/?text=\'+encodeURIComponent($(\'ia-txt\').value),\'_blank\',\'noopener\')">WhatsApp</button>');
}
function enviarAccesoCorreo(id, aid){
  var a = EMP.datos.admins.filter(function(x){ return x.id === aid; })[0], e = empresaPorId(id), b = $('ia-correo'); if(!a || !e) return;
  b.disabled = true; b.textContent = 'Enviando…';
  Nube.funcionServidor('prospectos', { accion:'correo', para:a.correo, asunto:'Tu acceso al panel de ' + e.nombre + ' · Instituto Mara', texto:$('ia-txt').value })
    .then(function(){ b.textContent = 'Enviado ✓'; })
    .catch(function(err){ b.disabled = false; b.textContent = 'Enviar por correo'; alert('No se pudo enviar: ' + err.message); });
}
function copiarTexto(t){
  var ok = function(){ alert('Copiado.'); };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, ok); else ok();
}
function agregarMiembroEmpresa(id){
  var av = $('am-aviso');
  Nube.empresaRpc('empresa_agregar_miembro', { p_empresa:id, p_correo:$('am-cor').value.trim(), p_area:$('am-area').value.trim(), p_num:$('am-num').value.trim() })
    .then(function(){ av.innerHTML = '<div class="aviso aviso-ok">Agregado.</div>'; $('am-cor').value=''; cargarReporteEmpresa(id, 'admin'); })
    .catch(function(e){ av.innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
}
function pintarComprasEmpresa(id){
  var caja = $('aemp-compras'), e = empresaPorId(id); if(!caja || !e) return;
  var l = EMP.datos.compras.filter(function(c){ return c.empresa_id === id; });
  var progs = BD.cursos.filter(function(c){ return c.publicado && Number(c.precio) > 0; }).sort(function(a,b){ return a.nombre.localeCompare(b.nombre); });
  caja.innerHTML = (l.length ? '<div class="tabla-caja" style="margin-bottom:16px"><div class="tabla-scroll"><table><tr><th>Fecha</th><th>Programa</th><th>Lugares</th><th>Total</th><th>Cómo pagó</th><th>Estado</th></tr>'+
    l.map(function(c){ var p = programa(c.curso_id);
      var prog = c.cursos && c.cursos.length > 1 ? c.cursos.length+' programas a elegir' : esc(p?p.nombre:c.curso_id);
      var medio = c.medio==='manual' ? 'Transferencia / manual' : c.medio==='piloto' ? 'Sin costo (piloto)' : c.medio==='cotizacion' ? 'Liga de pago (cotización)' : 'Mercado Pago';
      return '<tr><td>'+esc(String(c.pagado_en||c.creado_en).slice(0,10))+'</td><td>'+prog+(c.nota?'<br><small>'+esc(c.nota)+'</small>':'')+'</td><td>'+c.lugares+'</td><td>'+dinero(c.total)+'</td>'+
        '<td>'+medio+'</td><td>'+esc(ESTADO_EMP[c.estado]||c.estado)+
        (c.estado==='piloto' ? '<br><button class="btn btn-mor btn-sm" style="margin-top:6px" onclick="formalizarPiloto(\''+id+'\',\''+c.id+'\')">Formalizar (ya pagó)</button>' : '')+
        (c.estado==='pendiente_pago' && c.liga_pago ? '<br><small>'+(ligaVencida(c) ? 'Liga vencida' : 'Liga vigente hasta '+esc(String(c.liga_vence||'').slice(0,10)))+'</small><br>'+
          '<button class="btn btn-linea btn-sm" style="margin-top:6px" onclick="verLigaCotizacion(\''+id+'\',\''+c.id+'\')">Ver liga</button> '+
          '<button class="btn btn-fantasma btn-sm" style="margin-top:6px" onclick="cancelarCotizacion(\''+id+'\',\''+c.id+'\')">Cancelar</button>' : '')+'</td></tr>'; }).join('')+
    '</table></div></div>' : '<p style="color:var(--gris);margin-bottom:12px">Sin paquetes todavía.</p>')+
    formPiloto(id)+
    formCotizacion(id, progs)+
    '<h4 style="margin:22px 0 10px">Registrar venta manual (transferencia, factura o convenio)</h4>'+
    '<div class="campo"><label for="vm-curso">Programa</label><select id="vm-curso" onchange="cotizarVentaManual(\''+id+'\')">'+
      progs.map(function(c){ return '<option value="'+c.id+'">'+esc(c.nombre)+' · '+dinero(c.precio)+'</option>'; }).join('')+'</select></div>'+
    '<div class="fila"><div class="campo"><label for="vm-n">Lugares</label><input id="vm-n" type="number" min="1" max="500" value="5" oninput="cotizarVentaManual(\''+id+'\')"></div>'+
    '<div class="campo"><label for="vm-total">Total cobrado (MXN)</label><input id="vm-total" type="number" min="0" step="0.01"></div>'+
    '<div class="campo"><label for="vm-vence">Los lugares vencen</label><input id="vm-vence" type="date" value="'+new Date(Date.now()+365*864e5).toISOString().slice(0,10)+'"></div></div>'+
    '<div class="campo"><label for="vm-nota">Nota (folio de factura, referencia de la transferencia…)</label><input id="vm-nota" maxlength="200"></div>'+
    '<div id="vm-aviso"></div><button id="vm-btn" class="btn btn-mor" onclick="registrarVentaManual(\''+id+'\')">Registrar y generar lugares</button>';
  cotizarVentaManual(id); calcularCotizacion(id);
}
function cotizarVentaManual(id){
  var e = empresaPorId(id), c = curso($('vm-curso').value), n = Math.max(1, Number($('vm-n').value)||1); if(!c || !e) return;
  var total = Math.round(Number(c.precio) * n * (100 - Number(e.descuento_pct||0))) / 100;
  $('vm-total').value = total;
  $('vm-aviso').innerHTML = '<div class="aviso aviso-info">Precio de lista '+dinero(Number(c.precio)*n)+(Number(e.descuento_pct)?' con '+Number(e.descuento_pct)+'% pactado':'')+'. Puedes cambiar el total si negociaste otro precio.</div>';
}
function registrarVentaManual(id){
  var b = $('vm-btn'), av = $('vm-aviso'), n = Math.floor(Number($('vm-n').value)), total = Number($('vm-total').value);
  if(!(n >= 1 && n <= 500)){ av.innerHTML = '<div class="aviso aviso-error">Los lugares van de 1 a 500.</div>'; return; }
  if(!confirm('¿Registrar '+n+' lugares por '+dinero(total)+'? Se generan los códigos y el pago aparece en «Pagos».')) return;
  b.disabled = true;
  Nube.empresaRpc('empresa_venta_manual', { p_empresa:id, p_curso:$('vm-curso').value, p_lugares:n, p_total:total, p_nota:$('vm-nota').value.trim(), p_vence:$('vm-vence').value || null })
    .then(function(){ pintar(); }).catch(function(e){ b.disabled = false; av.innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
}

/* ---------- Cotización con liga de pago (precio negociado) ---------- */
function ligaVencida(c){ return c.liga_vence && new Date(c.liga_vence).getTime() < Date.now(); }
function formCotizacion(id, progs){
  var e = empresaPorId(id);
  return '<h4 style="margin:22px 0 4px">Cotización con liga de pago (precio negociado)</h4>'+
    '<p style="color:var(--gris);font-size:.92rem;margin-bottom:10px">Genera una liga de Mercado Pago por el monto que acordaste. Cuando la empresa paga, se crean sus lugares y le llega el acceso a «Mi empresa».</p>'+
    '<div class="campo"><label for="cq-curso">Programa</label><select id="cq-curso" onchange="calcularCotizacion(\''+id+'\')">'+
      progs.filter(function(c){ return !ruta(c.id); }).map(function(c){ return '<option value="'+c.id+'">'+esc(c.nombre)+' · '+dinero(c.precio)+'</option>'; }).join('')+'</select></div>'+
    '<div class="fila"><div class="campo"><label for="cq-n">Lugares</label><input id="cq-n" type="number" min="1" max="500" value="5" oninput="calcularCotizacion(\''+id+'\')"></div>'+
    '<div class="campo"><label for="cq-total">Total a cobrar (MXN)</label><input id="cq-total" type="number" min="30" step="0.01" oninput="resumenCotizacion(\''+id+'\')"></div>'+
    '<div class="campo"><label for="cq-dias">La liga vale (días)</label><input id="cq-dias" type="number" min="1" max="60" value="15"></div></div>'+
    '<div class="campo"><label for="cq-nota">Nota interna (opcional)</label><input id="cq-nota" maxlength="200"></div>'+
    '<label style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><input type="checkbox" id="cq-correo"'+(e && e.contacto_correo ? ' checked' : ' disabled')+'> '+
      (e && e.contacto_correo ? 'Enviar la cotización por correo a '+esc(e.contacto_correo) : 'Enviar por correo (la empresa no tiene correo de contacto)')+'</label>'+
    '<div id="cq-aviso"></div><button id="cq-btn" class="btn btn-mor" onclick="generarCotizacion(\''+id+'\')">Generar liga de pago</button>';
}
function calcularCotizacion(id){
  var e = empresaPorId(id), c = curso(($('cq-curso')||{}).value), n = Math.max(1, Number(($('cq-n')||{}).value)||1); if(!c || !e) return;
  $('cq-total').value = Math.round(Number(c.precio) * n * (100 - Number(e.descuento_pct||0))) / 100;
  resumenCotizacion(id);
}
function resumenCotizacion(id){
  var e = empresaPorId(id), c = curso($('cq-curso').value), n = Math.max(1, Number($('cq-n').value)||1), t = Number($('cq-total').value)||0; if(!c || !e) return;
  var lista = Number(c.precio) * n, pct = lista > 0 ? Math.round((1 - t / lista) * 1000) / 10 : 0;
  $('cq-aviso').innerHTML = '<div class="aviso aviso-info">Precio de lista '+dinero(lista)+(Number(e.descuento_pct)?' · descuento pactado '+Number(e.descuento_pct)+'%':'')+
    '. Con este total: '+dinero(Math.round(t / n * 100) / 100)+' por persona'+(pct > 0 ? ' ('+pct+'% de descuento)' : '')+'.'+
    (t > 0 && t < 30 ? '<br><b>Mercado Pago no acepta cobros menores a $30.</b>' : '')+'</div>';
}
function generarCotizacion(id){
  var b = $('cq-btn'), av = $('cq-aviso'), n = Math.floor(Number($('cq-n').value)), total = Number($('cq-total').value);
  if(!(n >= 1 && n <= 500)){ av.innerHTML = '<div class="aviso aviso-error">Los lugares van de 1 a 500.</div>'; return; }
  if(!(total >= 30)){ av.innerHTML = '<div class="aviso aviso-error">El total mínimo para cobrar con Mercado Pago es de $30.</div>'; return; }
  if(!confirm('¿Generar la liga de pago por '+dinero(total)+' para '+n+' lugares?')) return;
  b.disabled = true; b.textContent = 'Generando…';
  Nube.funcionServidor('tienda', { accion:'empresa_cotizacion', empresaId:id, cursoId:$('cq-curso').value, lugares:n, total:total,
      dias:Number($('cq-dias').value)||15, nota:$('cq-nota').value.trim(), enviarCorreo:!!($('cq-correo') && $('cq-correo').checked) })
    .then(function(r){
      return Nube.empresasAdmin().then(function(d){ EMP.datos = d; pintarComprasEmpresa(id); verLigaCotizacion(id, r.compraId, r.enviado); });
    })
    .catch(function(err){ b.disabled = false; b.textContent = 'Generar liga de pago'; av.innerHTML = '<div class="aviso aviso-error">'+esc(err.message)+'</div>'; });
}
function telWaEmpresa(t){
  var d = String(t||'').replace(/\D/g,''); if(!d) return '';
  return d.length === 10 ? '52' + d : d;
}
function verLigaCotizacion(id, compraId, enviado){
  var c = (EMP.datos.compras||[]).filter(function(x){ return x.id === compraId; })[0], e = empresaPorId(id); if(!c || !e) return;
  var p = programa(c.curso_id), vence = String(c.liga_vence||'').slice(0,10).split('-').reverse().join('/');
  var t = 'Hola' + (e.contacto_nombre ? ' ' + String(e.contacto_nombre).split(' ')[0] : '') + ', como lo platicamos, esta es la liga para pagar la capacitación de *' + e.nombre + '*:\n\n' +
    '• *' + (p ? p.nombre : c.curso_id) + '*\n• ' + c.lugares + ' lugares (' + dinero(c.precio_unit) + ' por persona)\n• Total: *' + dinero(c.total) + '*\n\n' +
    'Pueden pagar con tarjeta, transferencia u OXXO: ' + c.liga_pago + '\n\n' +
    'La liga vale hasta el ' + vence + '. Al confirmarse el pago les llega el acceso a su panel para asignar los lugares. Si necesitan factura, envíen sus datos fiscales a contacto@institutomara.com.';
  var tel = telWaEmpresa(e.contacto_tel);
  abrirModal('Liga de pago · ' + e.nombre,
    (enviado ? '<div class="aviso aviso-ok">La cotización se envió por correo a '+esc(e.contacto_correo)+'.</div>' : '')+
    '<div class="campo"><label for="lq-url">Liga de Mercado Pago</label><input id="lq-url" readonly value="'+esc(c.liga_pago)+'"></div>'+
    '<p style="margin:6px 0 10px">Mensaje listo para WhatsApp:</p><textarea id="lq-txt" rows="10" style="width:100%">'+esc(t)+'</textarea>',
    '<button class="btn btn-fantasma" onclick="copiarTexto($(\'lq-url\').value)">Copiar liga</button>'+
    '<button class="btn btn-linea" onclick="copiarTexto($(\'lq-txt\').value)">Copiar mensaje</button>'+
    '<button class="btn btn-mor" onclick="window.open(\'https://wa.me/'+tel+'?text=\'+encodeURIComponent($(\'lq-txt\').value),\'_blank\',\'noopener\')">WhatsApp</button>');
}
function cancelarCotizacion(id, compraId){
  if(!confirm('¿Cancelar esta cotización? La liga deja de aceptar pagos.')) return;
  Nube.funcionServidor('tienda', { accion:'empresa_cotizacion_cancelar', compraId:compraId })
    .then(function(){ return Nube.empresasAdmin().then(function(d){ EMP.datos = d; pintarComprasEmpresa(id); }); })
    .catch(function(err){ alert(err.message); });
}

/* ---------- Portal «Mi empresa» (administrador de la empresa) ---------- */
function vistaPortalEmpresa(){
  var l = BD.misEmpresasAdmin || [];
  if(!l.length){
    setTimeout(function(){ cargarMisEmpresas().then(function(x){ if(!x.length){ var c = $('pe-vacio'); if(c) c.innerHTML = '<p>Tu cuenta no administra ninguna empresa. Si deberías tener acceso, pídele a Instituto Mara que te den de alta con este correo ('+esc(sesion.correo)+').</p>'; } }); }, 0);
    return '<div class="seccion"><h2>Mi empresa</h2><div class="tarjeta vacio" id="pe-vacio"><p>Cargando…</p></div></div>';
  }
  if(!estado.empresaId || !empresaPorId(estado.empresaId)) estado.empresaId = l[0].id;
  var e = empresaPorId(estado.empresaId);
  setTimeout(function(){ cargarReporteEmpresa(e.id, 'empresa'); }, 0);
  return '<div class="seccion"><div class="encabezado-fila"><div><h2>'+esc(e.nombre)+'</h2>'+
    '<p class="sub" style="margin:0">Avance y constancias de tu equipo en los programas que contrató la empresa.</p></div>'+
    (l.length > 1 ? '<select class="no-imprimir" onchange="estado.empresaId=this.value;pintar()">'+l.map(function(x){ return '<option value="'+x.id+'"'+(x.id===e.id?' selected':'')+'>'+esc(x.nombre)+'</option>'; }).join('')+'</select>' : '')+
    '</div><div id="rep-emp" style="margin-top:18px">Cargando…</div>'+
    '<div class="no-imprimir" style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-linea" onclick="ir(\'empresas\')">Comprar más lugares</button>'+
    '<a class="btn btn-fantasma" href="https://wa.me/528120282120?text='+encodeURIComponent('Hola, soy de '+e.nombre+' y quiero cotizar un paquete especial.')+'" target="_blank" rel="noopener">Cotizar un paquete especial</a></div>'+
    '<p class="no-imprimir" style="color:var(--gris);font-size:.88rem;margin-top:14px">¿Necesitas factura? Envía tus datos fiscales (constancia de situación fiscal y uso de CFDI) a <a href="mailto:contacto@institutomara.com?subject='+encodeURIComponent('Factura '+e.nombre)+'">contacto@institutomara.com</a> y te la enviamos.</p></div>';
}

/* ---------- Reporte (lo comparten administración y el portal) ---------- */
function cargarReporteEmpresa(id, modo){
  var caja = $('rep-emp'); if(caja && !EMP.rep[id]) caja.innerHTML = '<p style="color:var(--gris)">Cargando reporte…</p>';
  return Promise.all([ Nube.empresaRpc('empresa_reporte', { p_empresa:id }), Nube.empresaRpc('empresa_lugares', { p_empresa:id }) ])
    .then(function(r){ EMP.rep[id] = { filas:armarFilasReporte(r[0]||[]), lugares:r[1]||[], modo:modo }; pintarReporteEmpresa(id); })
    .catch(function(e){ var c = $('rep-emp'); if(c) c.innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
}
function armarFilasReporte(rows){
  var min = BD.config.minimoAprobatorio || 80;
  return rows.map(function(f){
    var c = f.curso_id ? curso(f.curso_id) : null, pct = 0, est = 'Sin programa', mods = 0, prom = null;
    var cal = f.calificaciones || {}, lec = f.lecciones || [];
    var vals = Object.keys(cal).map(function(k){ return Number(cal[k]); }).filter(function(n){ return !isNaN(n); });
    mods = vals.filter(function(n){ return n >= min; }).length;
    if(vals.length) prom = Math.round(vals.reduce(function(a,b){ return a+b; },0) / vals.length);
    if(c){
      var tot = totalLecciones(c) + c.modulos.length;
      pct = tot ? Math.min(100, Math.round((lec.length + mods) * 100 / tot)) : 0;
      est = f.constancia_folio ? 'Concluido' : pct >= 100 ? 'Concluido' : (lec.length || vals.length) ? 'En curso' : 'Sin empezar';
    }
    return { uid:f.usuario_id, nombre:f.nombre, correo:f.correo, tel:f.telefono||'', area:f.area||'', num:f.num_empleado||'',
      acceso:f.ultimo_acceso, cursoId:f.curso_id, curso:c ? c.nombre : (f.curso_id||''), horas:c ? c.horas : '', inscrito:f.inscrito,
      lecciones:lec.length, totalLecciones:c ? totalLecciones(c) : 0, modulos:mods, totalModulos:c ? c.modulos.length : 0,
      promedio:prom, pct:pct, estado:est, folio:f.constancia_folio||'', fechaConst:f.constancia_fecha||'', actualizado:f.avance_actualizado };
  });
}
function filasFiltradas(id){
  var R = EMP.rep[id], q = EMP.filtro.q.toLowerCase(); if(!R) return [];
  return R.filas.filter(function(f){
    if(EMP.filtro.curso && f.cursoId !== EMP.filtro.curso) return false;
    if(EMP.filtro.estado && f.estado !== EMP.filtro.estado) return false;
    return !q || (f.nombre+' '+f.correo+' '+f.area+' '+f.num).toLowerCase().indexOf(q) >= 0;
  });
}
function pintarReporteEmpresa(id){
  var caja = $('rep-emp'), R = EMP.rep[id]; if(!caja || !R) return;
  var personas = {}, enCurso = 0, concl = 0, sin = 0, sumPct = 0, nPct = 0, porCurso = {};
  R.filas.forEach(function(f){
    personas[f.uid] = true;
    if(!f.cursoId) return;
    if(f.estado === 'Concluido') concl++; else if(f.estado === 'En curso') enCurso++; else sin++;
    sumPct += f.pct; nPct++;
    var pc = porCurso[f.cursoId] = porCurso[f.cursoId] || { nombre:f.curso, n:0, concl:0, suma:0 };
    pc.n++; pc.suma += f.pct; if(f.estado === 'Concluido') pc.concl++;
  });
  var lug = R.lugares, usados = lug.filter(function(k){ return k.usuario_id; }).length,
      libres = lug.filter(function(k){ return !k.usuario_id && !k.asignado_nombre; }).length;
  /* Lugares de prueba sin curso todavía: se agrupan en un renglón «Por elegir». */
  lug.forEach(function(k){ var key = k.curso_id || '__elegir';
    var pc = porCurso[key] = porCurso[key] || { nombre:k.curso_id ? ((curso(k.curso_id)||{}).nombre||k.curso_id) : 'Por elegir (lugares sin curso asignado)', n:0, concl:0, suma:0, elegir:!k.curso_id };
    pc.lugares = (pc.lugares||0) + 1; pc.activos = (pc.activos||0) + (k.usuario_id?1:0); });
  var met = function(rot, val, pie){ return '<div class="metrica"><div class="rot">'+rot+'</div><div class="val">'+val+'</div><div class="pie">'+pie+'</div></div>'; };
  var cursosOpt = Object.keys(porCurso).filter(function(cid){ return !porCurso[cid].elegir; }).map(function(cid){ return '<option value="'+esc(cid)+'"'+(EMP.filtro.curso===cid?' selected':'')+'>'+esc(porCurso[cid].nombre)+'</option>'; }).join('');
  var estOpt = ['Sin empezar','En curso','Concluido','Sin programa'].map(function(s){ return '<option'+(EMP.filtro.estado===s?' selected':'')+'>'+s+'</option>'; }).join('');
  var filas = filasFiltradas(id), admin = R.modo === 'admin';
  var h = '<div class="rejilla rejilla-4" style="margin-bottom:20px">'+
      met('Personas', Object.keys(personas).length, 'en el equipo')+
      met('Lugares', usados+' / '+lug.length, 'activados'+(libres?' · '+libres+' sin asignar':''))+
      met('Concluidos', concl, enCurso+' en curso · '+sin+' sin empezar')+
      met('Avance promedio', (nPct ? Math.round(sumPct/nPct) : 0)+'%', 'de todos los programas')+
    '</div>';
  if(Object.keys(porCurso).length){
    h += '<div class="tabla-caja" style="margin-bottom:22px"><div class="tabla-scroll"><table><thead><tr><th>Programa</th><th>Lugares</th><th>Inscritos</th><th>Concluidos</th><th>Avance promedio</th></tr></thead><tbody>'+
      Object.keys(porCurso).map(function(cid){ var p = porCurso[cid];
        if(p.elegir) return '<tr><td style="color:var(--gris)"><i>'+esc(p.nombre)+'</i></td><td>'+(p.activos||0)+' / '+p.lugares+'</td><td>—</td><td>—</td><td>—</td></tr>';
        return '<tr><td><b>'+esc(p.nombre)+'</b></td><td>'+(p.lugares ? (p.activos||0)+' / '+p.lugares : '—')+'</td><td>'+p.n+'</td><td>'+p.concl+'</td><td>'+(p.n ? Math.round(p.suma/p.n) : 0)+'%</td></tr>'; }).join('')+
      '</tbody></table></div></div>';
  }
  h += '<div class="encabezado-fila no-imprimir" style="margin-bottom:10px"><h3 style="margin:0;color:var(--tinta)">Avance por persona</h3>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-linea btn-sm" onclick="descargarReporteEmpresa(\''+id+'\')">Descargar Excel (CSV)</button>'+
      '<button class="btn btn-linea btn-sm" onclick="window.print()">Imprimir o guardar PDF</button></div></div>'+
    '<div class="fila no-imprimir" style="margin-bottom:12px"><div class="campo" style="margin:0"><label for="re-q">Buscar</label><input id="re-q" placeholder="Nombre, correo, área…" value="'+esc(EMP.filtro.q)+'" oninput="EMP.filtro.q=this.value;pintarTablaReporte(\''+id+'\')"></div>'+
      '<div class="campo" style="margin:0"><label for="re-c">Programa</label><select id="re-c" onchange="EMP.filtro.curso=this.value;pintarTablaReporte(\''+id+'\')"><option value="">Todos</option>'+cursosOpt+'</select></div>'+
      '<div class="campo" style="margin:0"><label for="re-e">Estado</label><select id="re-e" onchange="EMP.filtro.estado=this.value;pintarTablaReporte(\''+id+'\')"><option value="">Todos</option>'+estOpt+'</select></div></div>'+
    '<div id="re-tabla"></div>'+
    '<div class="no-imprimir"><div class="encabezado-fila" style="margin:26px 0 10px"><h3 style="margin:0;color:var(--tinta)">Lugares (códigos de acceso)</h3>'+
      (lug.length ? '<button class="btn btn-linea btn-sm" onclick="descargarLugaresEmpresa(\''+id+'\')">Descargar lugares (CSV)</button>' : '')+'</div>'+
    resumenPilotos(id, lug)+
    (lug.length ? '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Código</th><th>Programa</th><th>Persona</th><th>Estado</th><th>Vence</th><th></th></tr></thead><tbody>'+
      lug.map(function(k){
        var est = k.usuario_id ? '<span class="etiqueta ok">Activado</span>' : k.enviado_en ? '<span class="etiqueta alerta">Invitación enviada</span>' : k.asignado_nombre ? '<span class="etiqueta gris">Asignado</span>' : '<span class="etiqueta gris">Libre</span>';
        return '<tr><td><code>'+esc(k.codigo)+'</code>'+(k.piloto?'<br><span class="etiqueta alerta">Piloto</span>':'')+'</td><td>'+celdaPrograma(id, k)+'</td>'+
          '<td>'+esc(k.alumno || k.asignado_nombre || '—')+(k.asignado_correo?'<br><small>'+esc(k.asignado_correo)+'</small>':'')+'</td><td>'+est+'</td><td>'+celdaVence(k)+'</td>'+
          '<td style="white-space:nowrap">'+(k.usuario_id ? '' : '<button class="btn btn-linea btn-sm" onclick="empAsignarLugar(\''+id+'\',\''+esc(k.codigo)+'\')">'+(k.asignado_nombre?'Reenviar':'Asignar')+'</button> '+
            '<button class="btn btn-fantasma btn-sm" onclick="empCompartirLugar(\''+id+'\',\''+esc(k.codigo)+'\')">WhatsApp</button>')+'</td></tr>';
      }).join('')+'</tbody></table></div></div>' : '<p style="color:var(--gris)">'+(admin ? 'Esta empresa todavía no tiene lugares. Regístralos en «Paquetes y lugares».' : 'Aún no tienes lugares. Cuando Instituto Mara active tu prueba sin costo o compres lugares, aparecerán aquí con el botón «Asignar» para repartirlos entre tu equipo y elegir el curso de cada persona.')+'</p>')+
    '</div>';
  caja.innerHTML = h;
  pintarTablaReporte(id);
}
function pintarTablaReporte(id){
  var caja = $('re-tabla'), R = EMP.rep[id]; if(!caja || !R) return;
  var filas = filasFiltradas(id), admin = R.modo === 'admin';
  var color = { 'Concluido':'ok', 'En curso':'alerta', 'Sin empezar':'gris', 'Sin programa':'gris' };
  caja.innerHTML = '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Persona</th><th>Programa</th><th>Avance</th><th>Estado</th><th>Último acceso</th><th>Constancia</th><th class="no-imprimir"></th></tr></thead><tbody>'+
    (filas.length ? filas.map(function(f){
      var dormido = f.estado !== 'Concluido' && f.cursoId && (!f.acceso || (Date.now() - new Date(f.acceso).getTime()) > 14*864e5);
      return '<tr><td><b>'+esc(f.nombre)+'</b><br><small>'+esc(f.correo)+(f.area||f.num?' · '+esc([f.area,f.num].filter(Boolean).join(' · ')):'')+'</small></td>'+
        '<td>'+esc(f.curso||'—')+'</td>'+
        '<td>'+(f.cursoId ? '<div class="avance" style="min-width:90px"><i style="width:'+f.pct+'%"></i></div><small>'+f.pct+'% · '+f.lecciones+'/'+f.totalLecciones+' lecciones · '+f.modulos+'/'+f.totalModulos+' módulos'+(f.promedio!=null?' · prom. '+f.promedio:'')+'</small>' : '—')+'</td>'+
        '<td><span class="etiqueta '+(color[f.estado]||'gris')+'">'+esc(f.estado)+'</span></td>'+
        '<td'+(dormido?' style="color:#B45309"':'')+'>'+esc(hace(f.acceso))+'</td>'+
        '<td>'+(f.folio ? '<a href="'+esc(urlVerificarFolio(f.folio))+'" target="_blank" rel="noopener">'+esc(f.folio)+'</a><br><small>'+esc(f.fechaConst)+'</small>' : '—')+'</td>'+
        '<td class="no-imprimir" style="white-space:nowrap"><button class="btn btn-fantasma btn-sm" onclick="editarMiembroEmpresa(\''+id+'\',\''+f.uid+'\')">Área</button>'+
          (f.tel && dormido ? ' <button class="btn btn-fantasma btn-sm" onclick="recordarMiembro(\''+id+'\',\''+f.uid+'\',\''+esc(f.cursoId)+'\')">Recordar</button>' : '')+
          (admin ? ' <button class="btn btn-fantasma btn-sm" onclick="quitarMiembro(\''+id+'\',\''+f.uid+'\')">Quitar</button>' : '')+'</td></tr>';
    }).join('') : '<tr><td colspan="7" class="vacio">'+(R.filas.length ? 'Nadie coincide con el filtro.' : 'Todavía no hay personas. Aparecen aquí en cuanto activan su lugar.')+'</td></tr>')+
    '</tbody></table></div></div>';
}
function editarMiembroEmpresa(id, uid){
  var f = EMP.rep[id].filas.filter(function(x){ return x.uid === uid; })[0] || {};
  abrirModal('Datos de '+(f.nombre||'la persona'),
    '<div class="fila"><div class="campo"><label for="em-area">Área</label><input id="em-area" maxlength="80" value="'+esc(f.area||'')+'"></div>'+
    '<div class="campo"><label for="em-num">No. de empleado</label><input id="em-num" maxlength="40" value="'+esc(f.num||'')+'"></div></div><div id="em-av"></div>',
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cancelar</button><button class="btn btn-mor" onclick="guardarMiembroEmpresa(\''+id+'\',\''+uid+'\')">Guardar</button>');
}
function guardarMiembroEmpresa(id, uid){
  Nube.empresaRpc('empresa_editar_miembro', { p_empresa:id, p_usuario:uid, p_area:$('em-area').value, p_num:$('em-num').value })
    .then(function(){ cerrarModal(); cargarReporteEmpresa(id, EMP.rep[id].modo); })
    .catch(function(e){ $('em-av').innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
}
function quitarMiembro(id, uid){
  if(!confirm('¿Quitar a esta persona del reporte de la empresa? No pierde su acceso ni su avance.')) return;
  Nube.quitarMiembroEmpresa(id, uid).then(function(){ cargarReporteEmpresa(id, 'admin'); }).catch(function(e){ alert(e.message); });
}
function recordarMiembro(id, uid, cid){
  var f = EMP.rep[id].filas.filter(function(x){ return x.uid === uid && x.cursoId === cid; })[0]; if(!f) return;
  var e = empresaPorId(id), tel = f.tel.replace(/\D/g,''); if(tel.length === 10) tel = '52' + tel;
  var t = 'Hola ' + f.nombre.split(' ')[0] + ', te recordamos tu programa *' + f.curso + '*' + (e ? ' de ' + e.nombre : '') + ' en Instituto Mara. Vas en ' + f.pct + '%. ¡Retómalo aquí! ' + location.origin + location.pathname;
  window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(t), '_blank', 'noopener');
}
function descargarReporteEmpresa(id){
  var e = empresaPorId(id), nombre = (e ? e.nombre : 'empresa').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  descargarCSV('reporte-' + nombre + '-' + hoy() + '.csv',
    ['Nombre','Correo','Área','No. empleado','Programa','Horas','Inscrito','Avance %','Lecciones','Módulos aprobados','Promedio','Estado','Último acceso','Folio constancia','Fecha constancia','Verificación'],
    filasFiltradas(id).map(function(f){
      return [f.nombre, f.correo, f.area, f.num, f.curso, f.horas, f.inscrito||'', f.cursoId ? f.pct : '', f.cursoId ? f.lecciones+'/'+f.totalLecciones : '',
        f.cursoId ? f.modulos+'/'+f.totalModulos : '', f.promedio==null ? '' : f.promedio, f.estado, f.acceso ? String(f.acceso).slice(0,10) : 'Nunca',
        f.folio, f.fechaConst, f.folio ? urlVerificarFolio(f.folio) : ''];
    }));
}
function descargarLugaresEmpresa(id){
  descargarCSV('lugares-' + hoy() + '.csv', ['Código','Programa','Asignado a','Correo','Estado','Activó','Vence','Enlace de activación'],
    EMP.rep[id].lugares.map(function(k){
      return [k.codigo, nombreLugar(k), k.alumno || k.asignado_nombre || '', k.asignado_correo || '',
        k.usuario_id ? 'Activado' : k.enviado_en ? 'Invitación enviada' : k.asignado_nombre ? 'Asignado' : 'Libre',
        k.canjeado_en ? String(k.canjeado_en).slice(0,10) : '', k.vence || '', k.usuario_id ? '' : empEnlaceLugar(k)];
    }));
}
function empEnlaceLugar(k){ return location.origin + location.pathname + '?cupon=' + encodeURIComponent(k.codigo) + (k.curso_id ? '&curso=' + encodeURIComponent(k.curso_id) : ''); }
function nombreLugar(k){
  if(k.curso_id) return (curso(k.curso_id)||{}).nombre || k.curso_id;
  if(k.cursos && k.cursos.length) return 'A elegir: ' + k.cursos.map(function(x){ return (curso(x)||{}).nombre || x; }).join(', ');
  return '—';
}
function empLugar(id, cod){ return ((EMP.rep[id]||{}).lugares||[]).filter(function(k){ return k.codigo === cod; })[0]; }
function empCompartirLugar(id, cod){
  var k = empLugar(id, cod), e = empresaPorId(id), c = k && curso(k.curso_id); if(!k) return;
  var plazo = k.piloto ? '\n\n⏳ Actívalo antes del ' + fechaLarga(String(k.vence||'').slice(0,10)) + '; tendrás ' + (k.dias_acceso || 15) + ' días de acceso desde que lo actives.' : '';
  var t = k.piloto && !k.curso_id
    ? '📚 *' + (e ? e.nombre : 'Tu empresa') + '* te dio un lugar de prueba en Instituto Mara, 100% en línea. Elige uno de estos programas:\n' +
      (k.cursos||[]).map(function(x){ return '• ' + ((curso(x)||{}).nombre || x); }).join('\n') + plazo + '\n\n🎟 Tu código: *' + cod + '*\n👉 Actívalo aquí: ' + empEnlaceLugar(k)
    : k.piloto
    ? '📚 *' + (e ? e.nombre : 'Tu empresa') + '* te dio un lugar de prueba en *' + (c ? c.nombre : 'un programa') + '* de Instituto Mara, 100% en línea.' + plazo + '\n\n🎟 Tu código: *' + cod + '*\n👉 Actívalo aquí: ' + empEnlaceLugar(k)
    : '📚 *' + (e ? e.nombre : 'Tu empresa') + '* te dio un lugar en *' + (c ? c.nombre : 'un programa') + '* de Instituto Mara: 100% en línea y con constancia al terminar.\n\n🎟 Tu código: *' + cod + '*\n👉 Actívalo aquí: ' + empEnlaceLugar(k);
  window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener');
}
function empAsignarLugar(id, cod){
  var k = empLugar(id, cod) || {};
  abrirModal('Asignar lugar '+cod,
    '<div class="campo"><label for="al-nom">Nombre de la persona *</label><input id="al-nom" maxlength="120" value="'+esc(k.asignado_nombre||'')+'"></div>'+
    '<div class="campo"><label for="al-cor">Correo</label><input id="al-cor" type="email" value="'+esc(k.asignado_correo||'')+'"><small style="color:var(--gris)">Le enviamos la invitación con su código. Si lo dejas vacío, solo queda anotado y se lo mandas tú por WhatsApp.</small></div>'+
    (k.piloto && k.cursos && k.cursos.length > 1 ? '<div class="campo"><label for="al-curso">Curso para esta persona</label><select id="al-curso"><option value="">Que la persona elija entre los del piloto</option>'+
      k.cursos.map(function(x){ return '<option value="'+esc(x)+'"'+(k.curso_id===x?' selected':'')+'>'+esc((curso(x)||{}).nombre || x)+'</option>'; }).join('')+'</select></div>' : '')+
    '<div id="al-aviso"></div>',
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cancelar</button><button id="al-btn" class="btn btn-mor" onclick="empGuardarLugar(\''+id+'\',\''+cod+'\')">Guardar y enviar</button>');
}
function empGuardarLugar(id, cod){
  var b = $('al-btn'); b.disabled = true;
  var datos = { accion:'empresa_invitar', codigo:cod, nombre:$('al-nom').value.trim(), correo:$('al-cor').value.trim() };
  if($('al-curso')) datos.cursoId = $('al-curso').value || null;
  Nube.funcionServidor('tienda', datos)
    .then(function(r){ cerrarModal(); if(r && r.enviado) alert('Invitación enviada.'); cargarReporteEmpresa(id, EMP.rep[id].modo); })
    .catch(function(e){ b.disabled = false; $('al-aviso').innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
}


/* ==========================================================================
   Piloto para empresas (13 oct 2026): N lugares sin costo por D días en una
   lista de programas. La constancia se libera hasta que la empresa paga.
   Requiere backend/prospectos-piloto.sql.
   ========================================================================== */
var PILOTO = { q:'' };
function formPiloto(id){
  var pre = (estado.pilotoCursos && estado.pilotoEmpresa === id) ? estado.pilotoCursos : [];
  var progs = BD.cursos.filter(function(c){ return c.publicado && Number(c.precio) > 0 && !ruta(c.id); })
    .sort(function(a,b){ var x = pre.indexOf(a.id) >= 0, y = pre.indexOf(b.id) >= 0; return x === y ? a.nombre.localeCompare(b.nombre) : (x ? -1 : 1); });
  return '<div class="tarjeta" style="background:var(--nube);margin:6px 0 4px"><h4 style="margin-bottom:6px">Crear piloto sin costo</h4>'+
    '<p style="color:var(--gris);font-size:.9rem;margin-bottom:10px">Genera lugares de prueba. Cada persona elige uno de los programas marcados. Al vencer pierde el acceso (conserva su avance) y la constancia solo se libera cuando formalices el piloto.</p>'+
    '<div class="campo"><label for="pl-q">Programas del piloto</label><input id="pl-q" placeholder="Buscar programa…" oninput="filtrarPiloto(this.value)"></div>'+
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:-4px 0 8px"><button type="button" class="btn btn-linea btn-sm" onclick="marcarPiloto(true)">Seleccionar los que se ven</button>'+
      '<button type="button" class="btn btn-fantasma btn-sm" onclick="marcarPiloto(false)">Quitar todos</button>'+
      '<span id="pl-cuenta" style="color:var(--gris);font-size:.9rem">'+(pre.length ? pre.length + (pre.length === 1 ? ' programa elegido' : ' programas elegidos') : 'Ningún programa elegido')+'</span></div>'+
    '<div id="pl-lista" onchange="contarPiloto()" style="max-height:230px;overflow:auto;border:1px solid var(--linea);border-radius:10px;padding:8px 10px;background:var(--papel);margin-bottom:12px">'+
      '<p id="pl-vacio" style="display:none;color:var(--gris);margin:4px 0">Ningún programa coincide con la búsqueda.</p>'+
      progs.map(function(c){ return '<label class="pl-op" data-n="'+esc(c.nombre.toLowerCase())+'" style="display:flex;gap:8px;align-items:flex-start;padding:4px 0"><input type="checkbox" value="'+c.id+'"'+(pre.indexOf(c.id) >= 0 ? ' checked' : '')+'> <span>'+esc(c.nombre)+' <small style="color:var(--gris)">'+dinero(c.precio)+'</small></span></label>'; }).join('')+
    '</div>'+
    '<div class="fila"><div class="campo"><label for="pl-n">Lugares</label><input id="pl-n" type="number" min="1" max="50" value="5"></div>'+
    '<div class="campo"><label for="pl-d">Días de acceso por persona</label><input id="pl-d" type="number" min="1" max="60" value="15"><small style="color:var(--gris)">Se cuentan desde que cada persona activa su lugar.</small></div>'+
    '<div class="campo"><label for="pl-plazo">Plazo para activar (días)</label><input id="pl-plazo" type="number" min="1" max="120" value="30"><small style="color:var(--gris)">Después de este plazo, los lugares sin activar vencen.</small></div></div>'+
    '<div class="campo"><label for="pl-nota">Nota (opcional)</label><input id="pl-nota" maxlength="200" placeholder="Ej. campaña empresas León, octubre"></div>'+
    '<div id="pl-aviso"></div><button id="pl-btn" class="btn btn-mor" onclick="crearPiloto(\''+id+'\')">Crear piloto y generar lugares</button></div>';
}
function plNorm(t){ return String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function filtrarPiloto(q){
  q = plNorm(q).trim();
  var n = 0;
  document.querySelectorAll('#pl-lista .pl-op').forEach(function(el){
    var ver = !q || plNorm(el.getAttribute('data-n')).indexOf(q) >= 0;
    el.style.display = ver ? 'flex' : 'none'; if(ver) n++;
  });
  var v = $('pl-vacio'); if(v) v.style.display = n ? 'none' : 'block';
}
function marcarPiloto(v){
  document.querySelectorAll('#pl-lista .pl-op').forEach(function(el){
    if(!v || el.style.display !== 'none') el.querySelector('input').checked = v;
  });
  contarPiloto();
}
function contarPiloto(){
  var n = document.querySelectorAll('#pl-lista input:checked').length, c = $('pl-cuenta');
  if(c) c.textContent = n ? n + (n === 1 ? ' programa elegido' : ' programas elegidos') : 'Ningún programa elegido';
}
function crearPiloto(id){
  var cursos = [].slice.call(document.querySelectorAll('#pl-lista input:checked')).map(function(x){ return x.value; });
  var n = Math.floor(Number($('pl-n').value)), d = Math.floor(Number($('pl-d').value)), pz = Math.floor(Number($('pl-plazo').value)), av = $('pl-aviso'), b = $('pl-btn');
  if(!(pz >= 1 && pz <= 120)){ av.innerHTML = '<div class="aviso aviso-error">El plazo para activar va de 1 a 120 días.</div>'; return; }
  if(!cursos.length){ av.innerHTML = '<div class="aviso aviso-error">Marca al menos un programa.</div>'; return; }
  if(!(n >= 1 && n <= 50) || !(d >= 1 && d <= 60)){ av.innerHTML = '<div class="aviso aviso-error">Revisa los lugares (1 a 50) y los días (1 a 60).</div>'; return; }
  if(!confirm('¿Crear un piloto de '+n+' lugares, con '+d+' días de acceso por persona y '+pz+' días para activarlos, en '+cursos.length+' programa(s)?')) return;
  b.disabled = true;
  Nube.empresaRpc('empresa_crear_piloto', { p_empresa:id, p_cursos:cursos, p_lugares:n, p_dias:d, p_nota:$('pl-nota').value.trim(), p_plazo:pz })
    .then(function(){
      estado.pilotoCursos = null;
      if(estado.prospectoPiloto) return Nube.tabla('prospectos?id=eq.' + estado.prospectoPiloto, { metodo:'PATCH', prefer:'return=minimal', cuerpo:{ estado:'piloto', empresa_id:id } })
        .then(function(){ estado.prospectoPiloto = null; }).catch(function(){});
    })
    .then(function(){ pintar(); })
    .catch(function(e){ b.disabled = false; av.innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'<br><small>Si dice que no existe la función, falta ejecutar backend/prospectos-piloto.sql en Supabase.</small></div>'; });
}
function formalizarPiloto(id, compraId){
  var c = EMP.datos.compras.filter(function(x){ return x.id === compraId; })[0]; if(!c) return;
  abrirModal('Formalizar piloto',
    '<p style="margin-bottom:12px">La empresa ya pagó. Al formalizar: quienes entraron conservan su programa sin fecha límite, se libera su constancia, y los lugares que no se usaron pasan a durar 12 meses.</p>'+
    '<div class="campo"><label for="fp-total">Total cobrado (MXN)</label><input id="fp-total" type="number" min="0" step="0.01"></div>'+
    '<div class="campo"><label for="fp-nota">Nota (factura, referencia…)</label><input id="fp-nota" maxlength="200"></div><div id="fp-aviso"></div>'+
    '<p style="color:var(--gris);font-size:.88rem">Si contrataron más lugares de los del piloto, regístralos además con «Venta manual».</p>',
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cancelar</button><button id="fp-btn" class="btn btn-mor" onclick="confirmarFormalizar(\''+id+'\',\''+compraId+'\')">Formalizar</button>');
}
function confirmarFormalizar(id, compraId){
  var t = Number($('fp-total').value), b = $('fp-btn');
  if(!(t >= 0) || $('fp-total').value === ''){ $('fp-aviso').innerHTML = '<div class="aviso aviso-error">Escribe el total cobrado.</div>'; return; }
  b.disabled = true;
  Nube.empresaRpc('empresa_formalizar_piloto', { p_compra:compraId, p_total:t, p_nota:$('fp-nota').value.trim() })
    .then(function(){ cerrarModal(); pintar(); })
    .catch(function(e){ b.disabled = false; $('fp-aviso').innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
}

/* Inscripción de piloto: acceso hasta su fecha y sin constancia. */
function pilotoDe(cid){
  if(!sesion) return null;
  for(var i=0;i<BD.inscripciones.length;i++){ var x = BD.inscripciones[i];
    if(x.usuarioId === sesion.id && x.cursoId === cid && x.estatus === 'piloto') return x; }
  return null;
}
function pilotoVencido(ins){ return ins && ins.estatus === 'piloto' && ins.vence && String(ins.vence).slice(0,10) < hoy(); }
var _estaInscritoBase = estaInscrito;
estaInscrito = function(uid, cid){
  var ins = _estaInscritoBase(uid, cid);
  if(ins && pilotoVencido(ins) && !(sesion && sesion.rol === 'admin')) return null;
  return ins;
};
var _bloqueoMembresiaBase = constanciaBloqueadaPorMembresia;
constanciaBloqueadaPorMembresia = function(c){
  var p = pilotoDe(c.id);
  if(p) return 'Ya terminaste todo el programa. Lo tomaste con un <b>lugar de prueba</b> de tu empresa, así que tu constancia se libera en cuanto tu empresa formalice la inscripción. Tu avance queda guardado.';
  return _bloqueoMembresiaBase(c);
};
var _vistaAulaBase = vistaAula;
vistaAula = function(){
  var h = _vistaAulaBase(), p = pilotoDe(estado.cursoId);
  if(!p) return h;
  var aviso = '<div class="aviso aviso-info" style="margin-bottom:18px">Estás usando un <b>lugar de prueba</b> de tu empresa'+
    (p.vence ? ', con acceso hasta el <b>'+fechaLarga(String(p.vence).slice(0,10))+'</b>' : '')+
    '. Tu avance se guarda; la constancia se libera cuando tu empresa formalice la inscripción.</div>';
  return h.replace('<div class="tarjeta" style="margin-bottom:26px', aviso + '<div class="tarjeta" style="margin-bottom:26px');
};


/* Piloto vencido sin que la empresa lo formalizara: se le ofrece al empleado
   continuar por su cuenta con un descuento (lo atiende Instituto Mara por WhatsApp). */
function pilotosVencidosMios(){
  if(!sesion || sesion.rol === 'admin') return [];
  return BD.inscripciones.filter(function(x){ return x.usuarioId === sesion.id && x.estatus === 'piloto' && pilotoVencido(x); });
}
var _vistaMisCursosBase = vistaMisCursos;
vistaMisCursos = function(){
  var h = _vistaMisCursosBase(), l = pilotosVencidosMios();
  if(!l.length) return h;
  var cajas = l.map(function(x){
    var c = curso(x.cursoId) || { nombre:x.cursoId }, a = avance(sesion.id, x.cursoId), pct = c.modulos ? porcentaje(sesion.id, c) : 0;
    var txt = 'Hola, soy ' + sesion.nombre + '. Tuve un lugar de prueba de mi empresa en «' + c.nombre + '» y terminó. Me gustaría continuarlo por mi cuenta, ¿me pueden dar el descuento?';
    return '<div class="tarjeta" style="margin-bottom:16px;border-color:var(--morado)">'+
      '<h3 style="color:var(--tinta);margin-bottom:6px">Tu prueba de ' + esc(c.nombre) + ' terminó</h3>'+
      '<p style="margin-bottom:12px">Tu acceso de prueba venció el ' + fechaLarga(String(x.vence).slice(0,10)) + (pct ? ' y llevabas <b>' + pct + '%</b>' : '') +
      '. Tu avance está guardado. Si tu empresa no va a continuar, <b>escríbenos y te damos un descuento especial</b> para que lo termines por tu cuenta y obtengas tu constancia.</p>'+
      '<a class="btn btn-tur" target="_blank" rel="noopener" href="https://wa.me/528120282120?text=' + encodeURIComponent(txt) + '">Pedir mi descuento por WhatsApp</a></div>';
  }).join('');
  var i = h.indexOf('</h2>');
  return i > 0 ? h.slice(0, i + 5) + '<div style="margin:14px 0 6px">' + cajas + '</div>' + h.slice(i + 5) : cajas + h;
};


/* Lugares de piloto: celda compacta y lista de programas en una ventana. */
function celdaPrograma(id, k){
  if(k.curso_id) return '<b>' + esc((curso(k.curso_id)||{}).nombre || k.curso_id) + '</b>';
  var n = (k.cursos||[]).length;
  if(n === 1) return esc((curso(k.cursos[0])||{}).nombre || k.cursos[0]);
  if(n > 1) return '<span class="etiqueta gris">Por elegir</span> ' + n + ' programas · <a href="#" onclick="verProgramasLugar(\'' + id + '\',\'' + esc(k.codigo) + '\');return false">ver lista</a>';
  return '—';
}
function resumenPilotos(id, lug){
  var grupos = {};
  lug.forEach(function(k){ if(!k.piloto) return; var g = grupos[k.compra_id] = grupos[k.compra_id] || { n:0, activos:0, vence:k.vence, dias:k.dias_acceso, cursos:k.cursos||[], codigo:k.codigo };
    g.n++; if(k.usuario_id) g.activos++; });
  return Object.keys(grupos).map(function(cid){ var g = grupos[cid];
    return '<div class="aviso aviso-info" style="margin-bottom:12px;display:flex;gap:10px 18px;flex-wrap:wrap;align-items:center">'+
      '<b>Prueba sin costo</b><span>' + g.activos + ' de ' + g.n + ' lugares activados</span>'+
      '<span>' + (g.dias || 15) + ' días de acceso por persona, desde que activa</span>'+
      (g.vence ? '<span>Activar antes del ' + fechaLarga(String(g.vence).slice(0,10)) + '</span>' : '')+
      '<a href="#" onclick="verProgramasLugar(\'' + id + '\',\'' + esc(g.codigo) + '\');return false">' + g.cursos.length + (g.cursos.length === 1 ? ' programa incluido' : ' programas incluidos') + '</a></div>';
  }).join('');
}
function verProgramasLugar(id, cod){
  var k = empLugar(id, cod); if(!k) return;
  var cs = (k.cursos||[]).map(function(x){ return curso(x) || { id:x, nombre:x }; });
  var dip = cs.filter(function(c){ return c.nivel === 'Diplomados' || /^d-|^diplomado/.test(c.id); }), cur = cs.filter(function(c){ return dip.indexOf(c) < 0; });
  var lista = function(t, arr){ return arr.length ? '<h4 style="margin:12px 0 6px">' + t + ' (' + arr.length + ')</h4><ul class="pl-prog" style="margin-left:18px;line-height:1.7">' +
    arr.sort(function(a,b){ return a.nombre.localeCompare(b.nombre); }).map(function(c){ return '<li data-n="' + esc(plNorm(c.nombre)) + '">' + esc(c.nombre) + '</li>'; }).join('') + '</ul>' : ''; };
  abrirModal('Programas de la prueba',
    '<p style="color:var(--gris);margin-bottom:10px">Al asignar un lugar puedes elegir el curso de la persona. Si no lo eliges, ella escoge uno de esta lista.</p>'+
    '<div class="campo" style="margin-bottom:4px"><input id="vp-q" placeholder="Buscar programa…" aria-label="Buscar programa" oninput="var q=plNorm(this.value);document.querySelectorAll(\'.pl-prog li\').forEach(function(li){li.style.display=!q||li.getAttribute(\'data-n\').indexOf(q)>=0?\'\':\'none\';})"></div>'+
    lista('Diplomados', dip) + lista('Cursos', cur),
    '<button class="btn btn-mor" onclick="cerrarModal()">Cerrar</button>');
}

function fechaCortaEmp(iso){
  if(!iso) return '';
  var m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'], d = String(iso).slice(0,10).split('-');
  return Number(d[2]) + ' ' + m[Number(d[1]) - 1] + ' ' + d[0];
}
function celdaVence(k){
  if(k.piloto && k.usuario_id && k.canjeado_en){
    var fin = new Date(new Date(k.canjeado_en).getTime() + (k.dias_acceso || 15) * 864e5).toISOString();
    return '<small style="color:var(--gris)">Acceso hasta el</small><br>' + fechaCortaEmp(fin);
  }
  if(!k.vence) return '—';
  return (k.piloto && !k.usuario_id ? '<small style="color:var(--gris)">Activar antes del</small><br>' : '') + fechaCortaEmp(k.vence);
}
