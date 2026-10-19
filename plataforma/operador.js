/* Instituto Mara — Panel completo del operador (19 oct 2026).
   Se carga después de llamadas.js. Requiere backend/empresas-operador-20261019.sql.

   Menú del operador: Llamadas · Empresas · Cursos · Cupones · Precios · Mi perfil.
   · Empresas: solo las que atiende. En cada una ve su prueba (y puede pedir 15 días
     más), registra el plan pactado, reparte lugares, da de alta al administrador y
     ve el avance de la gente. No ve precios manuales ni la venta por curso.
   · Cursos: el catálogo para consultar temarios y mandar la lección gratis.
   · Cupones: descuentos de hasta su límite, para compartir con la gente.
   · Precios: plan para empresas, membresías individuales y comisión estimada.
   Administración aprueba o rechaza en «Planes y operadores» las solicitudes de
   más días de prueba. */

var OPR = { emp:null, planes:[], q:'' };
function oprId(){ return (LL.op && LL.op.id) || (PLN.miOp && PLN.miOp.id) || null; }
function oprAsegurar(){
  if(!esOperador() || oprId()) return Promise.resolve(LL.op);
  return Nube.tabla('operadores?select=*&usuario_id=eq.' + sesion.id).then(function(r){ LL.op = PLN.miOp = (r && r[0]) || null; return LL.op; });
}
/* Empresas que crea el operador: quedan a su nombre, sin descuento pactado (eso lo pone administración). */
var _guardarEmpresaOpr = Nube.guardarEmpresa;
Nube.guardarEmpresa = function(id, datos){
  if(esOperador()){ datos = Object.assign({}, datos); delete datos.descuento_pct; delete datos.cursos_permitidos; if(!id) datos.operador_id = oprId(); }
  return _guardarEmpresaOpr(id, datos);
};

/* ============================================================================
   Empresas (lista)
   ========================================================================== */
function vistaOprEmpresas(){
  setTimeout(function(){
    oprAsegurar().then(function(){
      return Promise.all([ Nube.empresasAdmin(), Nube.tabla('empresas_planes?select=*&order=creado_en.desc&limit=500') ]);
    }).then(function(r){ EMP.datos = r[0]; OPR.planes = r[1] || []; oprPintarLista(); })
      .catch(function(e){ var c = $('oe-datos'); if(c) c.innerHTML = plnErr(e); });
  }, 0);
  return '<div class="seccion"><div class="encabezado-fila"><div><h2>Mis empresas</h2>'+
    '<p class="sub" style="margin:0">Las empresas que atiendes: su prueba, su plan y el avance de su gente.</p></div>'+
    '<button class="btn btn-mor" onclick="nuevaEmpresa()">+ Nueva empresa</button></div>'+
    '<div class="campo" style="max-width:420px;margin-top:12px"><label for="oe-q">Buscar</label><input id="oe-q" value="'+esc(OPR.q)+'" oninput="OPR.q=this.value;oprPintarLista()"></div>'+
    '<div id="oe-datos">Cargando…</div></div>';
}
function oprPruebaDe(id){
  var c = (EMP.datos && EMP.datos.compras || []).filter(function(x){ return x.empresa_id === id && x.estado === 'piloto'; })[0];
  return c || null;
}
function oprPlanDe(id){
  var l = OPR.planes.filter(function(p){ return p.empresa_id === id; });
  return l.filter(plnVigente)[0] || l.filter(function(p){ return ['pendiente_pago','por_aprobar','rechazado'].indexOf(p.estado) >= 0; })[0] || null;
}
function oprPintarLista(){
  var caja = $('oe-datos'), d = EMP.datos; if(!caja || !d) return;
  var q = plNorm(OPR.q);
  var l = d.empresas.filter(function(e){ return !q || plNorm(e.nombre + ' ' + (e.contacto_nombre||'')).indexOf(q) >= 0; });
  if(!d.empresas.length){ caja.innerHTML = '<div class="tarjeta vacio"><p>Todavía no tienes empresas. Se crean solas cuando una empresa acepta la prueba en «Llamadas», o con «Nueva empresa».</p></div>'; return; }
  caja.innerHTML = '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Empresa</th><th>Prueba</th><th>Plan</th><th></th></tr></thead><tbody>'+
    l.map(function(e){
      var k = oprPruebaDe(e.id), p = oprPlanDe(e.id);
      var prueba = k ? '<span class="etiqueta tur">En prueba</span>'+(k.extension_estado === 'pendiente' ? '<br><small>Pediste más días</small>' : '') : '<small style="color:var(--gris)">—</small>';
      var plan = p ? '<span class="etiqueta '+(PLN_COLOR[p.estado]||'gris')+'">'+esc(PLN_ESTADO[p.estado]||p.estado)+'</span><br><small>'+esc(p.rango_texto)+' · '+esc(p.periodo)+'</small>' : '<small style="color:var(--gris)">Sin plan</small>';
      return '<tr><td><b>'+esc(e.nombre)+'</b>'+(e.contacto_nombre ? '<br><small style="color:var(--gris)">'+esc(e.contacto_nombre)+'</small>' : '')+'</td>'+
        '<td>'+prueba+'</td><td>'+plan+'</td><td><button class="btn btn-linea btn-sm" onclick="ir(\'admin-empresa\',{empresaId:\''+e.id+'\'})">Abrir</button></td></tr>';
    }).join('')+'</tbody></table></div></div>';
}

/* ============================================================================
   Ficha de la empresa (operador)
   ========================================================================== */
function vistaOprEmpresa(){
  var id = estado.empresaId;
  setTimeout(function(){
    oprAsegurar().then(function(){ return Nube.empresasAdmin(); }).then(function(d){
      EMP.datos = d;
      var e = empresaPorId(id), cab = $('oe-cab'); if(!cab) return;
      if(!e){ cab.innerHTML = '<div class="aviso aviso-error">No encontré esta empresa entre las tuyas.</div>'; return; }
      cab.innerHTML = '<h2>'+esc(e.nombre)+'</h2><p class="sub" style="margin:0">'+[e.contacto_nombre, e.contacto_correo, e.contacto_tel].filter(Boolean).map(esc).join(' · ')+'</p>';
      oprPintarPrueba(id); oprPintarAdmins(id); oprPintarDatos(id);
      plnCargarEmpresa(id, 'operador');
      cargarReporteEmpresa(id, 'operador');
    }).catch(function(err){ var c = $('oe-cab'); if(c) c.innerHTML = plnErr(err); });
  }, 0);
  return '<div class="seccion"><button class="btn btn-fantasma btn-sm no-imprimir" style="margin-bottom:14px" onclick="ir(\'admin-empresas\')">← Mis empresas</button>'+
    '<div id="oe-cab">Cargando…</div>'+
    '<div class="tarjeta no-imprimir" id="oe-prueba" style="margin-top:18px">Cargando prueba…</div>'+
    plnCajaEmpresa()+
    '<div class="tarjeta no-imprimir" id="oe-admins" style="margin-top:18px"></div>'+
    '<div id="rep-emp" style="margin-top:22px"></div>'+
    '<div class="tarjeta no-imprimir" id="oe-datos" style="margin-top:18px"></div></div>';
}

/* ---------- Prueba: estado, más días o crear una ---------- */
function oprPintarPrueba(id){
  var caja = $('oe-prueba'); if(!caja) return;
  var pruebas = (EMP.datos.compras||[]).filter(function(x){ return x.empresa_id === id && x.medio === 'piloto'; });
  var activa = pruebas.filter(function(x){ return x.estado === 'piloto'; })[0];
  var h = '<h3 style="color:var(--tinta);margin-bottom:6px">Prueba sin costo</h3>';
  if(activa){
    h += '<p style="color:var(--gris);margin-bottom:10px">'+esc(activa.nota || '')+'</p>';
    if(activa.extension_estado === 'pendiente') h += '<div class="aviso aviso-info">Pediste '+activa.extension_dias+' días más el '+esc(fechaCortaEmp(activa.extension_en))+'. Administración te responde aquí.</div>';
    else {
      if(activa.extension_estado === 'aprobada') h += '<div class="aviso aviso-ok" style="margin-bottom:10px">Administración aprobó '+activa.extension_dias+' días más.</div>';
      if(activa.extension_estado === 'rechazada') h += '<div class="aviso aviso-error" style="margin-bottom:10px">Administración no aprobó la extensión.</div>';
      h += '<details><summary style="cursor:pointer;font-weight:700;color:var(--morado)">Pedir más días de prueba</summary>'+
        '<p style="color:var(--gris);font-size:.9rem;margin:8px 0">Es el escalón 5 de la escalera: úsalo solo si la empresa ya está usando la prueba y necesita más tiempo para decidir. Lo aprueba administración.</p>'+
        '<div class="fila"><div class="campo"><label for="oe-dias">Días</label><input id="oe-dias" type="number" min="1" max="30" value="15"></div></div>'+
        '<div class="campo"><label for="oe-mot">¿Por qué la necesitan?</label><textarea id="oe-mot" rows="2" placeholder="Ej. RH estuvo de vacaciones; 3 de 5 personas ya empezaron."></textarea></div>'+
        '<div id="oe-ext-av"></div><button class="btn btn-linea" onclick="oprPedirExtension(\''+id+'\',\''+activa.id+'\')">Enviar solicitud</button></details>';
    }
    h += '<p style="color:var(--gris);font-size:.88rem;margin-top:10px">Los lugares de la prueba están abajo, en «Lugares (códigos de acceso)»: ahí registras a cada persona.</p>';
  } else if(pruebas.length){
    h += '<p style="color:var(--gris)">La prueba ya terminó o se formalizó. Si les gustó, registra el plan pactado en la caja de abajo.</p>';
  } else {
    var prosp = (PR.lista||[]).filter(function(p){ return p.empresa_id === id; })[0];
    var marcados = prosp ? (prosp.cursos_ids||[]) : [];
    var todos = (BD.cursos||[]).filter(function(c){ return c.publicado !== false && !ruta(c.id) && Number(c.precio) > 0; })
      .sort(function(a,b){ var x = marcados.indexOf(a.id) >= 0, y = marcados.indexOf(b.id) >= 0; return x === y ? a.nombre.localeCompare(b.nombre) : (x ? -1 : 1); });
    h += '<p style="color:var(--gris);margin-bottom:10px">Todavía no tiene prueba. Crea los 5 lugares por 15 días y elige los programas que podrán tomar.</p>'+
      '<div class="campo"><input id="oe-pq" placeholder="Buscar programa…" oninput="var q=plNorm(this.value);document.querySelectorAll(\'#oe-plist label\').forEach(function(l){l.style.display=!q||plNorm(l.textContent).indexOf(q)>=0?\'flex\':\'none\';})"></div>'+
      '<div id="oe-plist" style="max-height:220px;overflow:auto;border:1px solid var(--linea);border-radius:10px;padding:8px 10px;margin-bottom:10px">'+
      todos.map(function(c){ return '<label style="display:flex;gap:8px;padding:3px 0;align-items:flex-start"><input type="checkbox" class="oe-pc" style="width:auto;flex:none;margin-top:4px" value="'+c.id+'"'+(marcados.indexOf(c.id) >= 0 ? ' checked' : '')+'> '+esc(c.nombre)+'</label>'; }).join('')+
      '</div><div id="oe-p-av"></div><button class="btn btn-mor" onclick="oprCrearPrueba(\''+id+'\')">Crear prueba (5 lugares, 15 días)</button>';
  }
  caja.innerHTML = h;
}
function oprPedirExtension(id, compraId){
  Nube.empresaRpc('piloto_solicitar_extension', { p_compra:compraId, p_dias:Math.floor(Number($('oe-dias').value)) || 15, p_motivo:$('oe-mot').value.trim() })
    .then(function(){ return Nube.empresasAdmin(); }).then(function(d){ EMP.datos = d; oprPintarPrueba(id); })
    .catch(function(e){ $('oe-ext-av').innerHTML = plnErr(e); });
}
function oprCrearPrueba(id){
  var cursos = [].slice.call(document.querySelectorAll('.oe-pc:checked')).map(function(x){ return x.value; });
  if(!cursos.length){ $('oe-p-av').innerHTML = '<div class="aviso aviso-error">Marca al menos un programa.</div>'; return; }
  Nube.empresaRpc('empresa_crear_piloto', { p_empresa:id, p_cursos:cursos, p_lugares:5, p_dias:15, p_nota:'Prueba creada por el operador', p_plazo:30 })
    .then(function(){ pintar(); }).catch(function(e){ $('oe-p-av').innerHTML = plnErr(e); });
}

/* ---------- Administradores de la empresa ---------- */
function oprPintarAdmins(id){
  var caja = $('oe-admins'); if(!caja) return;
  var l = EMP.datos.admins.filter(function(a){ return a.empresa_id === id; });
  caja.innerHTML = '<h3 style="color:var(--tinta);margin-bottom:6px">Quién administra el panel de la empresa</h3>'+
    '<p style="color:var(--gris);font-size:.92rem;margin-bottom:12px">Entra con su propia cuenta y ve «Mi empresa»: ahí registra a su gente y ve su avance. Si aún no tiene cuenta, se activa sola cuando se registre con ese correo.</p>'+
    (l.length ? '<div class="tabla-caja" style="margin-bottom:12px"><div class="tabla-scroll"><table><tr><th>Persona</th><th>Cuenta</th><th></th></tr>'+
      l.map(function(a){ return '<tr><td><b>'+esc(a.nombre||a.correo)+'</b><br><small>'+esc(a.correo)+'</small></td>'+
        '<td>'+(a.usuario_id ? '<span class="etiqueta ok">Activa</span>' : '<span class="etiqueta alerta">Falta que se registre</span>')+'</td>'+
        '<td><button class="btn btn-fantasma btn-sm" onclick="oprAccesoAdmin(\''+id+'\',\''+a.id+'\')">Mandar acceso</button></td></tr>'; }).join('')+'</table></div></div>' :
      '<p style="color:var(--gris);margin-bottom:12px">Todavía no hay administrador.</p>')+
    '<div class="fila"><div class="campo"><label for="oa-cor">Correo</label><input id="oa-cor" type="email"></div><div class="campo"><label for="oa-nom">Nombre</label><input id="oa-nom" maxlength="120"></div></div>'+
    '<div id="oa-av"></div><button class="btn btn-linea" onclick="oprAgregarAdmin(\''+id+'\')">Agregar administrador</button>';
}
function oprAgregarAdmin(id){
  Nube.empresaRpc('empresa_agregar_admin', { p_empresa:id, p_correo:$('oa-cor').value.trim(), p_nombre:$('oa-nom').value.trim() || null })
    .then(function(f){ EMP.datos.admins = EMP.datos.admins.filter(function(a){ return a.id !== f.id; }).concat([f]); oprPintarAdmins(id); oprAccesoAdmin(id, f.id); })
    .catch(function(e){ $('oa-av').innerHTML = plnErr(e); });
}
function oprAccesoAdmin(id, aid){
  var a = EMP.datos.admins.filter(function(x){ return x.id === aid; })[0], e = empresaPorId(id); if(!a || !e) return;
  var t = 'Hola' + (a.nombre ? ' ' + a.nombre.split(' ')[0] : '') + ', soy ' + (LL.op ? LL.op.nombre : sesion.nombre) + ' de Instituto Mara. Ya tienes acceso al panel de *' + e.nombre + '* para registrar a tu equipo y ver su avance y sus constancias.\n\n' +
    (a.usuario_id ? '👉 Entra con tu cuenta (' + a.correo + ') aquí: ' : '👉 Crea tu cuenta con este mismo correo (' + a.correo + ') y verás el menú «Mi empresa»: ') + location.origin + location.pathname + '?ir=mi-empresa';
  abrirModal('Mandar acceso a ' + (a.nombre || a.correo),
    '<textarea id="oaa-txt" rows="7" style="width:100%">'+esc(t)+'</textarea>',
    '<button class="btn btn-fantasma" onclick="copiarTexto($(\'oaa-txt\').value)">Copiar</button>'+
    '<a class="btn btn-linea" href="mailto:'+esc(a.correo)+'?subject='+encodeURIComponent('Tu acceso a Instituto Mara')+'&body='+encodeURIComponent(t)+'">Correo</a>'+
    '<button class="btn btn-mor" onclick="window.open(\'https://wa.me/'+plnTelWa(e.contacto_tel)+'?text=\'+encodeURIComponent($(\'oaa-txt\').value),\'_blank\',\'noopener\')">WhatsApp</button>');
}

/* ---------- Datos de la empresa (sin descuento pactado) ---------- */
function oprPintarDatos(id){
  var caja = $('oe-datos'), e = empresaPorId(id); if(!caja || !e) return;
  caja.innerHTML = '<h3 style="color:var(--tinta);margin-bottom:12px">Datos de la empresa</h3>'+
    '<div class="fila"><div class="campo"><label for="od-nom">Nombre</label><input id="od-nom" maxlength="160" value="'+esc(e.nombre||'')+'"></div>'+
    '<div class="campo"><label for="od-rfc">RFC</label><input id="od-rfc" maxlength="13" style="text-transform:uppercase" value="'+esc(e.rfc||'')+'"></div></div>'+
    '<div class="fila"><div class="campo"><label for="od-cn">Contacto</label><input id="od-cn" maxlength="120" value="'+esc(e.contacto_nombre||'')+'"></div>'+
    '<div class="campo"><label for="od-cc">Correo</label><input id="od-cc" type="email" value="'+esc(e.contacto_correo||'')+'"></div>'+
    '<div class="campo"><label for="od-ct">Teléfono</label><input id="od-ct" type="tel" value="'+esc(e.contacto_tel||'')+'"></div></div>'+
    '<div class="campo"><label for="od-notas">Notas</label><textarea id="od-notas" rows="2">'+esc(e.notas||'')+'</textarea></div>'+
    '<div id="od-av"></div><button class="btn btn-mor" onclick="oprGuardarDatos(\''+id+'\')">Guardar datos</button>';
}
function oprGuardarDatos(id){
  var d = { nombre:$('od-nom').value.trim(), rfc:$('od-rfc').value.trim().toUpperCase() || null, contacto_nombre:$('od-cn').value.trim() || null,
    contacto_correo:$('od-cc').value.trim() || null, contacto_tel:$('od-ct').value.replace(/\D/g,'') || null, notas:$('od-notas').value.trim() || null };
  if(!d.nombre){ $('od-av').innerHTML = '<div class="aviso aviso-error">El nombre no puede quedar vacío.</div>'; return; }
  Nube.guardarEmpresa(id, d).then(function(){ $('od-av').innerHTML = '<div class="aviso aviso-ok">Guardado.</div>'; })
    .catch(function(e){ $('od-av').innerHTML = plnErr(e); });
}

/* El reporte compartido: el operador no quita personas (eso es de administración). */
var _cargarReporteOpr = cargarReporteEmpresa;
cargarReporteEmpresa = function(id, modo){ return _cargarReporteOpr(id, modo); };

/* ============================================================================
   Cursos (consulta)
   ========================================================================== */
var OPC = { q:'', tipo:'' };
function vistaOprCursos(){
  setTimeout(oprPintarCursos, 0);
  return '<div class="seccion"><h2>Cursos y diplomados</h2><p class="sub">Consulta el temario de cada programa y comparte la lección gratis con las empresas.</p>'+
    '<div class="fila" style="margin-top:12px"><div class="campo"><label for="oc-q">Buscar</label><input id="oc-q" value="'+esc(OPC.q)+'" placeholder="Excel, NOM-035, inglés…" oninput="OPC.q=this.value;oprPintarCursos()"></div>'+
    '<div class="campo"><label for="oc-t">Tipo</label><select id="oc-t" onchange="OPC.tipo=this.value;oprPintarCursos()"><option value="">Todos</option><option value="c"'+(OPC.tipo==='c'?' selected':'')+'>Cursos</option><option value="d"'+(OPC.tipo==='d'?' selected':'')+'>Diplomados</option></select></div></div>'+
    '<div id="oc-lista"></div></div>';
}
function oprPintarCursos(){
  var caja = $('oc-lista'); if(!caja) return;
  var q = plNorm(OPC.q);
  var l = (BD.cursos||[]).filter(function(c){
    if(c.publicado === false || ruta(c.id)) return false;
    var dip = c.nivel === 'Diplomados';
    if(OPC.tipo === 'c' && dip) return false; if(OPC.tipo === 'd' && !dip) return false;
    return !q || plNorm(c.nombre + ' ' + (c.familia||'') + ' ' + (c.desc||'')).indexOf(q) >= 0;
  }).sort(function(a, b){ return a.nombre.localeCompare(b.nombre); });
  caja.innerHTML = '<p style="color:var(--gris);font-size:.88rem;margin-bottom:8px">'+l.length+' programas. Con el plan para empresas, la gente puede tomar cualquiera.</p>'+
    '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Programa</th><th>Horas</th><th>Precio individual</th><th></th></tr></thead><tbody>'+
    l.map(function(c){
      return '<tr><td><b>'+esc(c.nombre)+'</b><br><small style="color:var(--gris)">'+esc(c.nivel === 'Diplomados' ? 'Diplomado' : 'Curso')+(c.familia ? ' · '+esc(c.familia) : '')+'</small></td>'+
        '<td>'+c.horas+'</td><td>'+dinero(c.precio)+'</td>'+
        '<td style="white-space:nowrap"><button class="btn btn-linea btn-sm" onclick="oprTemario(\''+c.id+'\')">Temario</button> '+
        '<button class="btn btn-fantasma btn-sm" onclick="oprMuestra(\''+c.id+'\')">Lección gratis</button></td></tr>';
    }).join('')+'</tbody></table></div></div>';
}
function oprTemario(cid){
  var c = curso(cid); if(!c) return;
  abrirModal(c.nombre,
    '<p style="color:var(--gris);margin-bottom:10px">'+c.horas+' horas · '+c.modulos.length+' módulos · constancia con folio y QR verificable</p>'+
    '<p style="margin-bottom:12px">'+esc(c.desc||'')+'</p>'+
    c.modulos.map(function(m, i){ return '<details'+(i===0?' open':'')+' style="margin-bottom:6px"><summary style="cursor:pointer;font-weight:700">'+esc(String(m.titulo||'').replace(/<[^>]+>/g,''))+'</summary><ol style="margin:6px 0 0 20px">'+
      m.lecciones.map(function(l){ return '<li>'+esc(String(l.titulo||'').replace(/^Lección\s+\d+\s*[—–-]\s*/,''))+'</li>'; }).join('')+'</ol></details>'; }).join(''),
    '<button class="btn btn-fantasma" onclick="oprMuestra(\''+cid+'\')">Lección gratis</button><button class="btn btn-mor" onclick="cerrarModal()">Cerrar</button>');
}
function oprMuestra(cid){
  var c = curso(cid); if(!c) return;
  var url = location.origin + location.pathname + '?muestra=' + encodeURIComponent(cid);
  var t = 'Le comparto una lección gratis de *' + c.nombre + '* para que vean cómo funciona Instituto Mara: ' + url;
  abrirModal('Lección gratis · ' + c.nombre,
    '<div class="campo"><label for="om-url">Enlace</label><input id="om-url" readonly value="'+esc(url)+'"></div>'+
    '<textarea id="om-txt" rows="4" style="width:100%">'+esc(t)+'</textarea>',
    '<button class="btn btn-fantasma" onclick="copiarTexto($(\'om-txt\').value)">Copiar</button>'+
    '<button class="btn btn-mor" onclick="window.open(\'https://wa.me/?text=\'+encodeURIComponent($(\'om-txt\').value),\'_blank\',\'noopener\')">WhatsApp</button>');
}

/* ============================================================================
   Cupones (hasta el límite del operador)
   ========================================================================== */
function oprLimite(){ return Math.min(plnDescMax(), LL.op && LL.op.descuento_max != null ? Number(LL.op.descuento_max) : plnDescMax()); }
function vistaOprCupones(){
  setTimeout(function(){ oprAsegurar().then(oprCargarCupones).catch(function(e){ var c = $('ocp-lista'); if(c) c.innerHTML = plnErr(e); }); }, 0);
  return '<div class="seccion"><h2>Cupones</h2><p class="sub">Descuentos de hasta <b id="ocp-lim">'+oprLimite()+'%</b> para cursos individuales, para compartir con la gente de una empresa. Los planes para empresas se negocian en la ficha de cada empresa.</p>'+
    '<div class="tarjeta" style="margin:14px 0 18px"><h3 style="color:var(--tinta);margin-bottom:10px">Nuevo cupón</h3>'+
    '<div class="fila"><div class="campo"><label for="ocp-cod">Código</label><input id="ocp-cod" maxlength="30" style="text-transform:uppercase" placeholder="Ej. CALZADOUNO10"></div>'+
    '<div class="campo"><label for="ocp-pct">Descuento (%)</label><input id="ocp-pct" type="number" min="1" max="'+oprLimite()+'" value="'+oprLimite()+'"></div>'+
    '<div class="campo"><label for="ocp-usos">Usos máximos</label><input id="ocp-usos" type="number" min="1" value="10"></div>'+
    '<div class="campo"><label for="ocp-vence">Vence</label><input id="ocp-vence" type="date" value="'+new Date(Date.now()+30*864e5).toISOString().slice(0,10)+'"></div></div>'+
    '<div class="campo"><label for="ocp-desc">Para quién es</label><input id="ocp-desc" maxlength="120" placeholder="Ej. Equipo de Calzado Uno"></div>'+
    '<div id="ocp-av"></div><button class="btn btn-mor" onclick="oprCrearCupon()">Crear cupón</button></div>'+
    '<div id="ocp-lista">Cargando…</div></div>';
}
function oprCargarCupones(){
  var l = $('ocp-lim'); if(l) l.textContent = oprLimite() + '%';
  return Nube.tabla('cupones?select=*&order=creado_en.desc').then(function(r){
    var caja = $('ocp-lista'); if(!caja) return;
    r = (r||[]).filter(function(c){ return !c.piloto && !/^EMP-/.test(c.codigo); });
    caja.innerHTML = r.length ? '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Código</th><th>Descuento</th><th>Usos</th><th>Vence</th><th></th></tr></thead><tbody>'+
      r.map(function(c){ return '<tr><td><b>'+esc(c.codigo)+'</b>'+(c.descripcion ? '<br><small>'+esc(c.descripcion)+'</small>' : '')+'</td><td>'+Number(c.valor)+'%</td>'+
        '<td>'+c.usos+(c.usos_max ? ' / '+c.usos_max : '')+'</td><td>'+esc(c.vence || '—')+'</td>'+
        '<td><button class="btn btn-linea btn-sm" onclick="oprCompartirCupon(\''+esc(c.codigo)+'\','+Number(c.valor)+')">Compartir</button></td></tr>'; }).join('')+
      '</tbody></table></div></div>' : '<p style="color:var(--gris)">Todavía no has creado cupones.</p>';
  });
}
function oprCrearCupon(){
  var cod = $('ocp-cod').value.trim().toUpperCase().replace(/[^A-Z0-9-]/g,''), pct = Number($('ocp-pct').value), av = $('ocp-av');
  if(cod.length < 4){ av.innerHTML = '<div class="aviso aviso-error">El código debe tener al menos 4 letras o números.</div>'; return; }
  if(!(pct >= 1 && pct <= oprLimite())){ av.innerHTML = '<div class="aviso aviso-error">El descuento va de 1% a '+oprLimite()+'%.</div>'; return; }
  Nube.tabla('cupones', { metodo:'POST', prefer:'return=minimal', cuerpo:{ codigo:cod, descripcion:$('ocp-desc').value.trim() || null, tipo:'porcentaje', valor:pct,
      usos_max:Math.max(1, Math.floor(Number($('ocp-usos').value)) || 1), vence:$('ocp-vence').value || null, activo:true } })
    .then(function(){ av.innerHTML = '<div class="aviso aviso-ok">Cupón creado.</div>'; $('ocp-cod').value = ''; return oprCargarCupones(); })
    .catch(function(e){ av.innerHTML = plnErr(/duplicate|unique/i.test(e.message) ? 'Ese código ya existe. Elige otro.' : e); });
}
function oprCompartirCupon(cod, pct){
  var url = location.origin + location.pathname + '?cupon=' + encodeURIComponent(cod);
  var t = '🎁 Tienes ' + pct + '% de descuento en el curso o diplomado que elijas de Instituto Mara. Tu código: *' + cod + '*\n👉 ' + url;
  abrirModal('Compartir ' + cod, '<textarea id="oc-txt" rows="4" style="width:100%">'+esc(t)+'</textarea>',
    '<button class="btn btn-fantasma" onclick="copiarTexto($(\'oc-txt\').value)">Copiar</button>'+
    '<button class="btn btn-mor" onclick="window.open(\'https://wa.me/?text=\'+encodeURIComponent($(\'oc-txt\').value),\'_blank\',\'noopener\')">WhatsApp</button>');
}

/* ============================================================================
   Precios: plan para empresas + membresías individuales (consulta)
   ========================================================================== */
var _plnPintarOpInicioOpr = plnPintarOpInicio;
plnPintarOpInicio = function(){
  _plnPintarOpInicioOpr();
  var caja = $('op-datos'); if(!caja) return;
  caja.insertAdjacentHTML('beforeend', '<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:6px">Para personas (no empresas)</h3>'+
    '<p style="color:var(--gris);font-size:.92rem;margin-bottom:10px">Si alguien quiere estudiar por su cuenta, esto es lo que puede contratar en el aula.</p>'+
    '<ul style="margin-left:18px;line-height:1.8">'+
      '<li>Membresía <b>Esencial</b>: '+dinero(precioPlan('esencial'))+' al mes · todos los cursos (sin diplomados)</li>'+
      '<li>Membresía <b>Total</b>: '+dinero(precioPlan('total'))+' al mes · todo el catálogo</li>'+
      '<li>Membresía <b>Anual Total</b>: '+dinero(precioPlan('anual'))+' por 12 meses</li>'+
      '<li>Programas sueltos desde '+dinero(Math.min.apply(null, (BD.cursos||[]).filter(function(c){ return c.publicado !== false && Number(c.precio) > 0; }).map(function(c){ return Number(c.precio); }).concat([999999])))+' · y se pueden regalar desde el aula (botón «Regalar»)</li>'+
    '</ul></div>');
};

/* ============================================================================
   Administración: solicitudes de más días de prueba
   ========================================================================== */
var _plnCargarAdminOpr = plnCargarAdmin;
plnCargarAdmin = function(){
  return _plnCargarAdminOpr().then(function(){
    return Nube.tabla('empresas_compras?select=id,empresa,empresa_id,nota,extension_dias,extension_motivo,extension_estado,extension_por,extension_en&extension_estado=eq.pendiente')
      .then(function(r){ PLN.extensiones = r || []; oprPintarExtensiones(); }).catch(function(){});
  });
};
function oprPintarExtensiones(){
  var caja = $('pln-aprobar'); if(!caja) return;
  var l = PLN.extensiones || []; var viejo = $('pln-ext'); if(viejo) viejo.remove();
  if(!l.length) return;
  caja.insertAdjacentHTML('beforeend', '<div id="pln-ext" class="tarjeta" style="margin-bottom:18px;border-color:#F59E0B"><h3 style="color:var(--tinta);margin-bottom:6px">Pruebas que piden más días ('+l.length+')</h3>'+
    '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Empresa</th><th>Días</th><th>Motivo</th><th></th></tr></thead><tbody>'+
    l.map(function(k){ return '<tr><td><b>'+esc(k.empresa)+'</b><br><small>'+esc(fechaCortaEmp(k.extension_en))+'</small></td><td>'+k.extension_dias+'</td><td>'+esc(k.extension_motivo||'')+'</td>'+
      '<td style="white-space:nowrap"><button class="btn btn-mor btn-sm" onclick="oprResolverExt(\''+k.id+'\',true)">Aprobar</button> '+
      '<button class="btn btn-fantasma btn-sm" onclick="oprResolverExt(\''+k.id+'\',false)">Rechazar</button></td></tr>'; }).join('')+
    '</tbody></table></div></div></div>');
}
function oprResolverExt(id, si){
  Nube.empresaRpc('piloto_resolver_extension', { p_compra:id, p_aprobar:si })
    .then(function(){ return plnCargarAdmin(); }).catch(function(e){ alert(e.message); });
}

/* ============================================================================
   Menú y vistas del operador
   ========================================================================== */
var OPR_VISTAS = { 'admin-empresas':vistaOprEmpresas, 'admin-empresa':vistaOprEmpresa, 'op-cursos':vistaOprCursos, 'op-cupones':vistaOprCupones };
var _pintarNavOpr = pintarNav;
pintarNav = function(){
  _pintarNavOpr();
  if(!esOperador()) return;
  var items = [['llamadas','Llamadas'],['admin-empresas','Empresas'],['op-cursos','Cursos'],['op-cupones','Cupones'],['op-inicio','Precios'],['mi-perfil','Mi perfil']], h = '';
  for(var i=0;i<items.length;i++) h += '<button data-v="'+items[i][0]+'">'+items[i][1]+'</button>';
  $('nav').innerHTML = h;
  $('nav').querySelectorAll('button').forEach(function(b){ b.onclick = function(){ if(this.getAttribute('data-v') === 'llamadas') estado.llamadaId = null; ir(this.getAttribute('data-v')); }; });
};
var _pintarOpr = pintar;
pintar = function(){
  var v = estado.vista;
  if(esOperador() && OPR_VISTAS[v]){
    $('vista').innerHTML = OPR_VISTAS[v]();
    var bs = $('nav').querySelectorAll('button');
    for(var i=0;i<bs.length;i++) bs[i].classList.toggle('activa', bs[i].getAttribute('data-v') === (v === 'admin-empresa' ? 'admin-empresas' : v));
    return;
  }
  _pintarOpr();
};

/* Nueva empresa del operador: sin campo de descuento pactado. */
var _nuevaEmpresaOpr = nuevaEmpresa;
nuevaEmpresa = function(pref){
  if(!esOperador()) return _nuevaEmpresaOpr(pref);
  abrirModal('Nueva empresa', formEmpresa(pref).replace(/<div class="campo"><label for="ef-desc">[\s\S]*?<\/div>/, '<input type="hidden" id="ef-desc" value="0">'),
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cancelar</button><button id="ef-btn" class="btn btn-mor" onclick="oprAsegurar().then(function(){ crearEmpresa(); })">Crear</button>');
};

/* Al registrar un plan se agrega su administrador: se refresca esa caja. */
var _plnCrearOpr = plnCrear;
plnCrear = function(id){
  _plnCrearOpr(id);
  if(!esOperador()) return;
  setTimeout(function(){ Nube.empresasAdmin().then(function(d){ EMP.datos = d; oprPintarAdmins(id); }).catch(function(){}); }, 1500);
};
