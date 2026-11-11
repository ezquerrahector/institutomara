/* Instituto Mara — Callcenter, etapa 2: base de alumnos (10 nov 2026).
   Se carga después de callcenter.js. Requiere backend/callcenter-alumnos-20261110.sql.

   · Operador (interno o de callcenter) → menú «Alumnos»: las personas que tiene
     asignadas, quién toca hoy, ficha con su historial y registro de cada llamada.
   · Titular → «Mi equipo»: bolsa de alumnos por repartir, cifras por agente y las
     llamadas a alumnos entran a la evaluación.
   · Administración → Prospectos → Alumnos: asignar los filtrados (o a una persona)
     a un operador o a la bolsa de un callcenter. En Callcenters: cifras de alumnos,
     ventas con comisión y los ajustes de la comisión. */

var CA = { lista:null, contactos:[], tab:'hoy', q:'', abierta:null, ops:[], ccs:[], equipo:null, sel:{}, filtroAg:'' };
var CA_RES = [
  ['no_contesto', 'No contestó'], ['buzon', 'Buzón'], ['equivocado', 'Número equivocado'],
  ['otro_dia', 'Llamar otro día (agendar)'], ['info_enviada', 'Le mandé información'], ['interesado', 'Interesado (agendar seguimiento)'],
  ['compro', 'Dice que ya compró'], ['no_interesa', 'No le interesa'], ['no_llamar', 'Pide que no le llamen']
];
var CA_RES_TXT = {}; CA_RES.forEach(function(r){ CA_RES_TXT[r[0]] = r[1]; });

function caCerrada(p){ return p.estado === 'no_interesa' || p.sin_promociones; }
function caFinHoy(){ var d = new Date(); d.setHours(23,59,59,999); return d; }
function caFechaLocal(d){ var z = function(n){ return (n < 10 ? '0' : '') + n; }; return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+'T'+z(d.getHours())+':'+z(d.getMinutes()); }
function caNombreOp(id){ var o = CA.ops.concat((CC.datos && CC.datos.ops) || []).filter(function(x){ return x.id === id; })[0]; return o ? o.nombre : '—'; }
function caNombreCC(id){ var k = CA.ccs.concat(CC.lista || []).filter(function(x){ return x.id === id; })[0]; return k ? k.nombre : 'Callcenter'; }

/* ============================================================================
   Operador → «Alumnos»
   ========================================================================== */
var _pintarNavCA = pintarNav;
pintarNav = function(){
  _pintarNavCA();
  if(!esOperador()) return;
  var nav = $('nav');
  if(!nav.querySelector('button[data-v="ca-alumnos"]')){
    var b = document.createElement('button'); b.setAttribute('data-v', 'ca-alumnos'); b.textContent = 'Alumnos';
    b.onclick = function(){ ir('ca-alumnos'); };
    var ll = nav.querySelector('button[data-v="llamadas"]');
    if(ll && ll.nextSibling) nav.insertBefore(b, ll.nextSibling); else nav.appendChild(b);
  }
};
var _pintarCA = pintar;
pintar = function(){
  if(estado.vista === 'ca-alumnos' && esOperador()){
    $('vista').innerHTML = vistaCAAlumnos();
    var bs = $('nav').querySelectorAll('button');
    for(var i=0;i<bs.length;i++) bs[i].classList.toggle('activa', bs[i].getAttribute('data-v') === 'ca-alumnos');
    return;
  }
  _pintarCA();
};

function vistaCAAlumnos(){
  setTimeout(caCargar, 0);
  return '<div class="seccion"><div class="encabezado-fila"><div><h2>Alumnos por llamar</h2>'+
    '<p class="sub" style="margin:0">Personas interesadas en los cursos y diplomados. Llama, registra qué pasó y agenda la siguiente llamada.</p></div>'+
    '<button class="btn btn-fantasma btn-sm" onclick="caCargar()">Actualizar</button></div><div id="ca-datos">Cargando…</div></div>';
}
function caCargar(){
  return ccAsegurarOp().then(function(){
    return Promise.all([
      Nube.tabla('rpc/alumnos_prospectos_lista', { metodo:'POST', cuerpo:{} }),
      Nube.tabla('alumnos_contactos?select=*&order=fecha.asc,id.asc&limit=20000')
    ]);
  }).then(function(r){
    var yo = ccOp();
    CA.lista = (r[0] || []).filter(function(p){ return yo && p.asignado_a === yo.id; });
    CA.contactos = r[1] || [];
    caPintar();
  }).catch(function(e){ var c = $('ca-datos'); if(c) c.innerHTML = plnErr(e, 'Si dice que no existe la función, falta correr backend/callcenter-alumnos-20261110.sql en Supabase.'); });
}
function caLista(tab){
  var fin = caFinHoy(), q = plNorm(CA.q);
  return (CA.lista || []).filter(function(p){
    var cerr = caCerrada(p), px = p.proxima_llamada ? new Date(p.proxima_llamada) : null;
    if(tab === 'hoy' && (cerr || (px && px > fin) || (!px && p.llamadas_intentos > 0))) return false;
    if(tab === 'seg' && (cerr || !px || px <= fin)) return false;
    if(tab === 'cerr' && !cerr) return false;
    if(tab === 'todos' && cerr) return false;
    return !q || plNorm([p.nombre, p.correo, p.telefono, apProg(p.programa_interes)].join(' ')).indexOf(q) >= 0;
  }).sort(function(a, b){
    var x = a.proxima_llamada ? new Date(a.proxima_llamada).getTime() : 0, y = b.proxima_llamada ? new Date(b.proxima_llamada).getTime() : 0;
    return x - y;
  });
}
function caPintar(){
  var caja = $('ca-datos'); if(!caja || !CA.lista) return;
  var n = function(t){ return caLista(t).length; };
  var hoyStr = new Date().toDateString(), yo = sesion.id;
  var hechas = CA.contactos.filter(function(c){ return c.canal === 'llamada' && c.creado_por === yo && new Date(c.fecha).toDateString() === hoyStr; }).length;
  var tab = function(k, t){ return '<button class="btn btn-sm '+(CA.tab === k ? 'btn-mor' : 'btn-fantasma')+'" onclick="CA.tab=\''+k+'\';caPintar()">'+t+' ('+n(k)+')</button>'; };
  var l = caLista(CA.tab);
  caja.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">'+
      supCifra('Asignadas', CA.lista.length)+supCifra('Te tocan hoy', n('hoy'), n('hoy') ? '#B45309' : '#065F46')+
      supCifra('Llamadas hoy', hechas)+supCifra('En seguimiento', n('seg'))+'</div>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">'+tab('hoy','Toca hoy')+tab('seg','Agendadas')+tab('todos','Todas abiertas')+tab('cerr','Cerradas')+'</div>'+
    '<div class="campo" style="max-width:360px"><label for="ca-q">Buscar</label><input id="ca-q" value="'+esc(CA.q)+'" placeholder="Nombre, correo, teléfono, programa…" oninput="CA.q=this.value;caPintar();var e=$(\'ca-q\');e.focus();e.setSelectionRange(e.value.length,e.value.length)"></div>'+
    (l.length ? '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Persona</th><th>Le interesa</th><th>Último resultado</th><th>Siguiente llamada</th><th></th></tr></thead><tbody>'+
      l.slice(0, 300).map(function(p){
        var atras = p.proxima_llamada && new Date(p.proxima_llamada) < new Date();
        return '<tr><td><b>'+esc(apNombre(p))+'</b><br>'+apEtiquetas(p)+'</td>'+
          '<td>'+esc(apProg(p.programa_interes) || '—')+'</td>'+
          '<td>'+esc(CA_RES_TXT[p.ultimo_resultado] || (p.llamadas_intentos ? p.ultimo_resultado : 'Sin llamar'))+'<br><small style="color:var(--gris)">'+(p.llamadas_intentos || 0)+' llamada(s)</small></td>'+
          '<td'+(atras ? ' style="color:#B45309;font-weight:700"' : '')+'>'+esc(p.proxima_llamada ? llFechaHora(p.proxima_llamada) : '—')+'</td>'+
          '<td><button class="btn btn-mor btn-sm" onclick="caAbrir(\''+p.id+'\')">Abrir</button></td></tr>';
      }).join('')+'</tbody></table></div></div>' : '<div class="tarjeta vacio"><p>'+(CA.lista.length ? 'No hay personas en esta pestaña.' : 'Todavía no tienes personas asignadas.')+'</p></div>');
}
function caAbrir(id){
  var p = (CA.lista || []).filter(function(x){ return x.id === id; })[0]; if(!p) return;
  CA.abierta = id;
  Nube.empresaRpc('alumno_consulta', { p_persona:id }).catch(function(){});
  var h = CA.contactos.filter(function(c){ return c.persona_id === id; }).slice(-8).reverse();
  var tel = String(p.telefono || '').replace(/\D/g, '').slice(-10), wa = apNumWa(p), mu = apMuestra(p.programa_interes);
  var comprados = (p.cursos || []).map(function(cid){ var c = curso(cid); return c ? c.nombre : cid; });
  var msg = 'Hola ' + (apPila(p) || '') + ', te escribe ' + (ccOp() ? ccOp().nombre.split(' ')[0] : '') + ' de Instituto Mara. ' +
    (mu ? 'Te comparto la lección gratis de ' + apProg(p.programa_interes) + ' para que la veas: ' + mu : 'Te comparto nuestros cursos y diplomados: ' + apSitio());
  var man = new Date(); man.setDate(man.getDate() + 1); man.setHours(10, 0, 0, 0);
  abrirModal(apNombre(p),
    '<div style="margin-bottom:10px">'+apEtiquetas(p)+'</div>'+
    (tel ? '<p style="margin-bottom:6px"><a class="btn btn-mor btn-sm" href="tel:'+esc(tel)+'">☎ Llamar '+esc(tel)+'</a> '+
      (wa ? '<a class="btn btn-linea btn-sm" href="https://wa.me/'+wa+'?text='+encodeURIComponent(msg)+'" target="_blank" rel="noopener">💬 WhatsApp con la información</a>' : '')+'</p>' : '<p style="color:var(--gris)">Sin teléfono.</p>')+
    prCampo('Correo', p.correo, prCopiable(p.correo))+
    prCampo('Le interesa', apProg(p.programa_interes), esc(apProg(p.programa_interes)) + (mu ? ' · <a href="'+esc(mu)+'" target="_blank" rel="noopener">lección gratis</a>' : ''))+
    prCampo('Ya compró', comprados.join(', '))+
    prCampo('Membresía', p.membresia_hasta || (p.etiquetas || []).indexOf('membresia') >= 0 ? 'Activa' : '')+
    prCampo('Notas', p.notas)+
    '<h4 style="margin:12px 0 6px">Historial</h4>'+
    (h.length ? '<div style="font-size:.88rem;margin-bottom:12px">'+h.map(function(c){
      return '<div style="padding:6px 0;border-bottom:1px solid var(--linea)">'+(AP_ICONO[c.canal] || '•')+' <b>'+esc(c.resultado || AP_CANAL[c.canal] || c.canal)+'</b> · '+esc(ccFecha(c.fecha))+
        (c.resumen ? '<br><span style="color:var(--gris)">'+esc(c.resumen)+'</span>' : '')+(c.grabacion ? '<br>'+ccGrabacion(c.grabacion) : '')+'</div>';
    }).join('')+'</div>' : '<p style="color:var(--gris);margin-bottom:12px">Sin contactos todavía.</p>')+
    '<h4 style="margin:12px 0 6px">Registrar la llamada</h4>'+
    '<div class="campo"><label for="ca-res">¿Qué pasó? *</label><select id="ca-res" onchange="caResCambio()"><option value="">Elige…</option>'+CA_RES.map(function(r){ return '<option value="'+r[0]+'">'+esc(r[1])+'</option>'; }).join('')+'</select></div>'+
    '<div class="campo" id="ca-prox-c" style="display:none"><label for="ca-prox">Volver a llamar el *</label><input id="ca-prox" type="datetime-local" value="'+caFechaLocal(man)+'"></div>'+
    '<div class="campo"><label for="ca-prog">Programa que le interesa</label><select id="ca-prog">'+apOpcionesProg(p.programa_interes)+'</select></div>'+
    '<div class="campo"><label for="ca-com">Comentarios</label><textarea id="ca-com" rows="3" placeholder="Qué le interesa, objeciones, cuándo puede pagar…"></textarea></div>'+
    '<div class="campo"><label for="ca-grab">Liga o ID de la grabación (opcional)</label><input id="ca-grab" maxlength="500"></div>'+
    '<p style="color:var(--gris);font-size:.85rem">Si compra en los próximos '+Number(ajuste('alumno_ventana_dias', 30))+' días, la venta cuenta para ti.</p>'+
    '<div id="ca-aviso"></div>',
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cerrar</button><button class="btn btn-mor" onclick="caGuardar(\''+id+'\')">Guardar llamada</button>');
}
function caResCambio(){ var v = $('ca-res').value; $('ca-prox-c').style.display = (v === 'otro_dia' || v === 'interesado') ? '' : 'none'; }
function caGuardar(id){
  var v = $('ca-res').value, av = $('ca-aviso');
  if(!v){ av.innerHTML = '<div class="aviso aviso-error">Elige qué pasó en la llamada.</div>'; return; }
  if(v === 'no_llamar' && !confirm('Se marcará que no quiere que lo contacten y ya no podrás llamarle. ¿Continuar?')) return;
  var prox = (v === 'otro_dia' || v === 'interesado') && $('ca-prox').value ? new Date($('ca-prox').value).toISOString() : null;
  Nube.empresaRpc('alumnos_registrar_llamada', { p_persona:id, p_resultado:v, p_comentario:$('ca-com').value.trim() || null, p_proxima:prox,
      p_programa:$('ca-prog').value || null, p_grabacion:$('ca-grab').value.trim() || null })
    .then(function(){ cerrarModal(); return caCargar(); })
    .catch(function(e){ av.innerHTML = plnErr(e); });
}

/* ============================================================================
   Titular → «Mi equipo»: alumnos
   ========================================================================== */
var _vistaCCEquipoCA = vistaCCEquipo;
vistaCCEquipo = function(){
  return _vistaCCEquipoCA().replace('<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:6px">Agentes</h3>',
    '<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:6px">Alumnos del callcenter</h3><div id="cc-alumnos">Cargando…</div></div>'+
    '<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:6px">Agentes</h3>');
};
var _ccCargarEquipoCA = ccCargarEquipo;
ccCargarEquipo = function(){
  var desde = new Date(Date.now() - 14 * 864e5).toISOString();
  return _ccCargarEquipoCA().then(function(){
    if(!CC.datos) return;
    return Promise.all([
      Nube.tabla('rpc/alumnos_prospectos_lista', { metodo:'POST', cuerpo:{} }),
      Nube.empresaRpc('alumnos_metricas', {}),
      Nube.tabla('alumnos_contactos?select=id,persona_id,fecha,resultado,resumen,creado_por,grabacion&canal=eq.llamada&fecha=gte.' + encodeURIComponent(desde) + '&order=fecha.desc&limit=600')
    ]).then(function(r){
      CA.equipo = { pers:r[0] || [], met:r[1] || [] };
      CC.sel = CC.sel || {};
      /* Las llamadas a alumnos también se evalúan. */
      var yo = ccOp();
      (r[2] || []).forEach(function(c){ c.alumno = true; CC.datos.llam.push(c); });
      CC.datos.llam.sort(function(a, b){ return new Date(b.fecha) - new Date(a.fecha); });
      CC.datos.evals.forEach(function(e){ if(!e.contacto_id && e.alumno_contacto_id) e.contacto_id = e.alumno_contacto_id; });
      caPintarEquipo(); ccPintarEval();
    });
  }).catch(function(e){ var c = $('cc-alumnos'); if(c) c.innerHTML = plnErr(e, 'Falta correr backend/callcenter-alumnos-20261110.sql en Supabase.'); });
};
function caPintarEquipo(){
  var caja = $('cc-alumnos'), d = CA.equipo; if(!caja || !d) return;
  var ops = CC.datos.ops.filter(function(o){ return o.activo; });
  var f = CA.filtroAg, q = plNorm(CC.qa || '');
  var l = d.pers.filter(function(p){
    if(f === 'bolsa' && p.asignado_a) return false;
    if(f && f !== 'bolsa' && p.asignado_a !== f) return false;
    if(!f && caCerrada(p)) return false;
    return !q || plNorm([p.nombre, p.correo, p.telefono, apProg(p.programa_interes)].join(' ')).indexOf(q) >= 0;
  });
  var bolsa = d.pers.filter(function(p){ return !p.asignado_a && !caCerrada(p); }).length;
  var ids = Object.keys(CA.sel).filter(function(k){ return CA.sel[k]; });
  caja.innerHTML = '<div class="tabla-caja" style="margin-bottom:14px"><div class="tabla-scroll"><table><thead><tr><th>Agente</th><th>Asignadas</th><th>Toca hoy</th><th>Atrasadas</th><th>Llamadas hoy · semana</th><th>Interesados</th><th>Ventas del mes</th><th>Comisión</th></tr></thead><tbody>'+
      d.met.map(function(m){ return '<tr><td><b>'+esc(m.nombre)+'</b></td><td>'+m.asignados+'</td><td>'+m.toca_hoy+'</td><td'+(m.atrasadas ? ' style="color:#B45309;font-weight:700"' : '')+'>'+m.atrasadas+'</td>'+
        '<td>'+m.llamadas_hoy+' · '+m.llamadas_semana+'</td><td>'+m.interesados+'</td><td>'+m.ventas_mes+' · '+dinero(m.vendido_mes)+'</td><td>'+dinero(m.comision_mes)+'</td></tr>'; }).join('')+
    '</tbody></table></div></div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">'+
      '<button class="btn btn-mor btn-sm"'+(bolsa && ops.length ? '' : ' disabled')+' onclick="caParejo()">Repartir parejo las '+bolsa+' de la bolsa</button>'+
      '<label style="display:flex;gap:6px;align-items:center;font-size:.9rem"><input type="checkbox" id="ca-yo" style="width:auto;margin:0"> incluirme a mí</label></div>'+
    '<div class="fila" style="margin-bottom:6px"><div class="campo" style="max-width:320px"><label for="ca-qa">Buscar</label><input id="ca-qa" value="'+esc(CC.qa || '')+'" oninput="CC.qa=this.value;caPintarEquipo();var e=$(\'ca-qa\');e.focus();e.setSelectionRange(e.value.length,e.value.length)"></div>'+
      '<div class="campo" style="max-width:260px"><label for="ca-fa">Mostrar</label><select id="ca-fa" onchange="CA.filtroAg=this.value;caPintarEquipo()">'+
        '<option value="">Abiertas (todas)</option><option value="bolsa"'+(f === 'bolsa' ? ' selected' : '')+'>Por repartir</option>'+
        CC.datos.ops.map(function(o){ return '<option value="'+o.id+'"'+(f === o.id ? ' selected' : '')+'>De '+esc(o.nombre)+'</option>'; }).join('')+'</select></div></div>'+
    (ids.length ? '<div class="aviso" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><b>'+ids.length+' seleccionada(s)</b>'+
      '<select id="ca-asig"><option value="">Asignar a…</option>'+ops.map(function(o){ return '<option value="'+o.id+'">'+esc(o.nombre)+(o.es_titular ? ' (yo)' : '')+'</option>'; }).join('')+'</select>'+
      '<button class="btn btn-mor btn-sm" onclick="caRepartir(true)">Asignar</button><button class="btn btn-fantasma btn-sm" onclick="caRepartir(false)">Regresar a la bolsa</button>'+
      '<button class="btn btn-fantasma btn-sm" onclick="CA.sel={};caPintarEquipo()">Quitar selección</button></div>' : '')+
    (l.length ? '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th><input type="checkbox" style="width:auto;margin:0" aria-label="Seleccionar todas" onchange="caSelTodas(this.checked)"></th><th>Persona</th><th>Agente</th><th>Le interesa</th><th>Último resultado</th><th>Siguiente</th></tr></thead><tbody>'+
      l.slice(0, 400).map(function(p){
        return '<tr><td><input type="checkbox" style="width:auto;margin:0"'+(CA.sel[p.id] ? ' checked' : '')+' onchange="CA.sel[\''+p.id+'\']=this.checked;caPintarEquipo()"></td>'+
          '<td><b>'+esc(apNombre(p))+'</b><br>'+apEtiquetas(p)+'</td>'+
          '<td>'+(p.asignado_a ? esc(ccNombreOp(p.asignado_a)) : '<span class="etiqueta alerta">Por repartir</span>')+'</td>'+
          '<td>'+esc(apProg(p.programa_interes) || '—')+'</td>'+
          '<td>'+esc(CA_RES_TXT[p.ultimo_resultado] || (p.llamadas_intentos ? p.ultimo_resultado : 'Sin llamar'))+'</td>'+
          '<td>'+esc(p.proxima_llamada ? llFechaHora(p.proxima_llamada) : '—')+'</td></tr>';
      }).join('')+'</tbody></table></div></div>'+(l.length > 400 ? '<p style="color:var(--gris);font-size:.85rem;margin-top:6px">Se muestran 400 de '+l.length+'.</p>' : '')
      : '<p style="color:var(--gris)">No hay personas en esta vista.</p>');
}
function caSelTodas(si){
  var f = CA.filtroAg, q = plNorm(CC.qa || '');
  CA.equipo.pers.forEach(function(p){
    if(f === 'bolsa' && p.asignado_a) return; if(f && f !== 'bolsa' && p.asignado_a !== f) return; if(!f && caCerrada(p)) return;
    if(q && plNorm([p.nombre, p.correo, p.telefono, apProg(p.programa_interes)].join(' ')).indexOf(q) < 0) return;
    CA.sel[p.id] = si;
  });
  caPintarEquipo();
}
function caRepartir(si){
  var ids = Object.keys(CA.sel).filter(function(k){ return CA.sel[k]; }), op = si ? $('ca-asig').value : null;
  if(si && !op){ alert('Elige a quién se las asignas.'); return; }
  if(!confirm(si ? '¿Asignar '+ids.length+' persona(s) a '+ccNombreOp(op)+'?' : '¿Regresar '+ids.length+' persona(s) a la bolsa del callcenter?')) return;
  Nube.empresaRpc('callcenter_alumnos_repartir', { p_ids:ids, p_operador:op }).then(function(){ CA.sel = {}; return ccCargarEquipo(); }).catch(function(e){ alert(e.message); });
}
function caParejo(){
  var yo = $('ca-yo') && $('ca-yo').checked;
  if(!confirm('¿Repartir parejo todas las personas de la bolsa entre tus agentes activos'+(yo ? ' (incluyéndote)' : '')+'?')) return;
  Nube.empresaRpc('callcenter_alumnos_parejo', { p_incluir_titular:!!yo }).then(function(r){
    var por = (r && r.por_agente) || {};
    alert('Repartidas: ' + ((r && r.repartidos) || 0) + (Object.keys(por).length ? '\n' + Object.keys(por).map(function(k){ return ccNombreOp(k) + ': ' + por[k]; }).join('\n') : ''));
    return ccCargarEquipo();
  }).catch(function(e){ alert(e.message); });
}

/* ============================================================================
   Administración → Prospectos → Alumnos: asignar
   ========================================================================== */
var _apCargarCA = apCargar;
apCargar = function(){
  var extra = llEsAdmin() ? Promise.all([
    Nube.tabla('operadores?select=id,nombre,activo,callcenter_id,es_titular&order=nombre.asc'),
    Nube.tabla('callcenters?select=*&order=nombre.asc')
  ]).catch(function(){ return [[], []]; }) : Promise.resolve([[], []]);
  return Promise.all([_apCargarCA(), extra]).then(function(r){
    CA.ops = r[1][0] || []; CA.ccs = r[1][1] || [];
    if(window.AP_FILTROS && CA.ops.length){
      AP_FILTROS.asig = { rot:'Asignación', ops: [['sin', 'Sin asignar', function(p){ return !p.asignado_a && !p.callcenter_id; }]]
        .concat(CA.ops.filter(function(o){ return o.activo; }).map(function(o){ return [o.id, '☎ ' + o.nombre, function(p){ return p.asignado_a === o.id; }]; }))
        .concat(CA.ccs.map(function(k){ return ['cc:' + k.id, '📞 ' + k.nombre, function(p){ return p.callcenter_id === k.id; }]; })) };
      if(AP.f.asig == null) AP.f.asig = '';
    }
  });
};
function caOpcionesAsig(){
  return '<option value="">Asignar a…</option>'+
    '<optgroup label="Operadores">'+CA.ops.filter(function(o){ return o.activo; }).map(function(o){
      return '<option value="'+o.id+'">'+esc(o.nombre)+(o.callcenter_id ? ' · ' + esc(caNombreCC(o.callcenter_id)) : '')+'</option>'; }).join('')+'</optgroup>'+
    (CA.ccs.some(function(k){ return k.activo; }) ? '<optgroup label="Bolsa de un callcenter (lo reparte su titular)">'+
      CA.ccs.filter(function(k){ return k.activo; }).map(function(k){ return '<option value="cc:'+k.id+'">📞 '+esc(k.nombre)+'</option>'; }).join('')+'</optgroup>' : '')+
    '<option value="quitar">Quitar asignación (regresa a ti)</option>';
}
var _apPintarTablaCA = apPintarTabla;
apPintarTabla = function(){
  _apPintarTablaCA();
  var caja = $('ap-tabla'); if(!caja || !llEsAdmin() || !CA.ops.length) return;
  var n = apFiltrados().length;
  if(!n) return;
  caja.insertAdjacentHTML('afterbegin', '<div class="aviso" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">'+
    '<span>Para que les llamen: asigna <b>las '+n+' personas del filtro</b> a</span><select id="ap-asig">'+caOpcionesAsig()+'</select>'+
    '<button class="btn btn-mor btn-sm" onclick="caAsignarFiltrados()">Asignar</button>'+
    '<small style="color:var(--gris);flex-basis:100%">Quien pidió no recibir promociones nunca se asigna.</small></div>');
};
function caAsignar(ids, v){
  if(!v) return Promise.reject(new Error('Elige a quién.'));
  if(v === 'quitar') return Nube.empresaRpc('alumnos_asignar', { p_ids:ids, p_operador:null });
  if(v.indexOf('cc:') === 0) return Nube.empresaRpc('alumnos_asignar_a_callcenter', { p_ids:ids, p_callcenter:v.slice(3) });
  return Nube.empresaRpc('alumnos_asignar', { p_ids:ids, p_operador:v });
}
function caAsignarFiltrados(){
  var v = $('ap-asig').value, ids = apFiltrados().map(function(p){ return p.id; });
  if(!v){ alert('Elige a quién se las asignas.'); return; }
  var dest = v === 'quitar' ? 'quitarles la asignación' : 'asignarlas a ' + (v.indexOf('cc:') === 0 ? 'la bolsa de ' + caNombreCC(v.slice(3)) : caNombreOp(v));
  if(!confirm('¿' + ids.length + ' persona(s): ' + dest + '?')) return;
  caAsignar(ids, v).then(function(r){
    alert(v === 'quitar' ? 'Listo.' : 'Asignadas: ' + ((r && r.asignados) || 0) + ((r && r.omitidos) ? '\nNo se asignaron ' + r.omitidos + ' porque pidieron no recibir promociones.' : ''));
    return apCargar().then(function(){ apPintarLista(); });
  }).catch(function(e){ alert(e.message); });
}
var _apSeguimientoTxtCA = apSeguimientoTxt;
apSeguimientoTxt = function(p){
  var h = _apSeguimientoTxtCA(p);
  if(p.asignado_a) h += '<div style="font-size:.8rem;margin-top:3px">☎ '+esc(caNombreOp(p.asignado_a))+(p.proxima_llamada ? ' · '+esc(llFechaHora(p.proxima_llamada)) : '')+'</div>';
  else if(p.callcenter_id) h += '<div style="font-size:.8rem;margin-top:3px">📞 '+esc(caNombreCC(p.callcenter_id))+' (por repartir)</div>';
  return h;
};
var _apPintarDatosCA = apPintarDatos;
apPintarDatos = function(p){
  _apPintarDatosCA(p);
  var caja = $('af-datos'); if(!caja || !llEsAdmin() || !CA.ops.length) return;
  var quien = p.asignado_a ? caNombreOp(p.asignado_a) + (p.callcenter_id ? ' · ' + caNombreCC(p.callcenter_id) : '') : p.callcenter_id ? 'Bolsa de ' + caNombreCC(p.callcenter_id) : 'Nadie';
  caja.insertAdjacentHTML('beforeend', '<div style="border-top:1px solid var(--linea);margin-top:12px;padding-top:12px">'+
    prCampo('Le llama', quien)+
    (p.sin_promociones ? '<p style="color:var(--gris);font-size:.88rem">Pidió no recibir promociones: no se puede asignar.</p>' :
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><select id="af-asig">'+caOpcionesAsig()+'</select><button class="btn btn-linea btn-sm" onclick="caAsignarUna(\''+p.id+'\')">Asignar</button></div>')+'</div>');
};
function caAsignarUna(id){
  caAsignar([id], $('af-asig').value).then(function(){ return apCargar().then(function(){ apPintarFicha(id); }); }).catch(function(e){ alert(e.message); });
}

/* ============================================================================
   Administración → Callcenters: cifras de alumnos, ventas y ajustes
   ========================================================================== */
var _ccAdmPintarCA = ccAdmPintar;
ccAdmPintar = function(){
  _ccAdmPintarCA();
  (CC.resumen || []).forEach(function(k){
    var det = $('cc-adm-' + k.callcenter_id), fila = det && det.previousElementSibling; if(!fila || k.alumnos_bolsa == null) return;
    fila.insertAdjacentHTML('beforeend', supCifra('Alumnos por repartir', k.alumnos_bolsa, k.alumnos_bolsa ? '#B45309' : null)+
      supCifra('Alumnos abiertos', k.alumnos_abiertos, null, k.alumnos_llamadas_hoy + ' llamadas hoy')+
      supCifra('Ventas a alumnos', k.alumnos_ventas_mes, null, dinero(k.alumnos_vendido_mes) + ' en el mes'));
  });
  var caja = $('pln-cc'); if(!caja) return;
  caja.insertAdjacentHTML('beforeend', '<div id="ca-adm" style="border-top:1px solid var(--linea);margin-top:18px;padding-top:14px">Cargando ventas a alumnos…</div>');
  caAdmVentas();
};
function caAdmVentas(){
  var desde = new Date(Date.now() - 60 * 864e5).toISOString();
  Nube.tabla('comisiones?select=*&tipo=eq.alumno&creado_en=gte.' + encodeURIComponent(desde) + '&order=creado_en.desc&limit=300').then(function(l){
    var caja = $('ca-adm'); if(!caja) return;
    var pct = Number(ajuste('alumno_comision_pct', 20)), ven = Number(ajuste('alumno_ventana_dias', 30)), esp = Number(ajuste('alumno_dias_espera', 15));
    caja.innerHTML = '<h4 style="margin:0 0 6px">Ventas a alumnos con comisión</h4>'+
      '<p style="color:var(--gris);font-size:.9rem;margin-bottom:10px">Si una persona asignada compra (curso, diplomado, membresía o regalo) y su operador le llamó en los últimos '+ven+' días, '+
        'el operador gana el '+pct+'% de lo pagado sin IVA. Entra al recibo a los '+esp+' días, por la garantía. Si hay reembolso antes, cancélala aquí.</p>'+
      (l && l.length ? '<div class="tabla-caja" style="margin-bottom:12px"><div class="tabla-scroll"><table><thead><tr><th>Fecha</th><th>Venta</th><th>Operador</th><th>Cobrado</th><th>Comisión</th><th></th></tr></thead><tbody>'+
        l.map(function(c){ var o = plnOperador(c.operador_id);
          return '<tr><td>'+esc(ccFecha(c.creado_en))+'</td><td>'+esc(c.nota || '')+'</td><td>'+esc(o ? o.nombre : '—')+'</td><td>'+dinero(c.cobrado)+'</td>'+
            '<td>'+(c.cancelada_en ? '<span class="etiqueta gris">Cancelada</span>' : dinero(c.monto) + (c.corte_id ? '' : '<br><small style="color:var(--gris)">entra al recibo el '+esc(new Date(c.disponible_en).toLocaleDateString('es-MX'))+'</small>'))+'</td>'+
            '<td>'+(!c.cancelada_en && !c.corte_id ? '<button class="btn btn-fantasma btn-sm" onclick="caCancelarComision(\''+c.id+'\')">Cancelar</button>' : '')+'</td></tr>';
        }).join('')+'</tbody></table></div></div>' : '<p style="color:var(--gris);margin-bottom:12px">Todavía no hay ventas a alumnos con comisión.</p>')+
      '<div class="fila"><div class="campo"><label for="ca-pct">Comisión (%)</label><input id="ca-pct" type="number" min="0" max="100" value="'+pct+'"></div>'+
        '<div class="campo"><label for="ca-ven">Días desde la llamada para que cuente</label><input id="ca-ven" type="number" min="1" max="180" value="'+ven+'"></div>'+
        '<div class="campo"><label for="ca-esp">Días de espera (garantía)</label><input id="ca-esp" type="number" min="0" max="90" value="'+esp+'"></div></div>'+
      '<div id="ca-aaviso"></div><button class="btn btn-linea btn-sm" onclick="caGuardarAjustes()">Guardar</button>';
  }).catch(function(e){ var c = $('ca-adm'); if(c) c.innerHTML = plnErr(e, 'Falta correr backend/callcenter-alumnos-20261110.sql en Supabase.'); });
}
function caGuardarAjustes(){
  var a = Number($('ca-pct').value), v = Math.floor(Number($('ca-ven').value)), e = Math.floor(Number($('ca-esp').value)), av = $('ca-aaviso');
  if(!(a >= 0 && a <= 100) || !(v >= 1 && v <= 180) || !(e >= 0 && e <= 90)){ av.innerHTML = '<div class="aviso aviso-error">Revisa los números.</div>'; return; }
  Nube.guardarAjustes({ alumno_comision_pct:a, alumno_ventana_dias:v, alumno_dias_espera:e }).then(function(f){ if(f && f[0]) BD.ajustes = f[0]; guardar(); caAdmVentas(); })
    .catch(function(x){ av.innerHTML = plnErr(x); });
}
function caCancelarComision(id){
  var m = prompt('¿Por qué se cancela? (por ejemplo: reembolso)'); if(m === null) return;
  Nube.empresaRpc('comision_alumno_cancelar', { p_comision:id, p_motivo:m }).then(caAdmVentas).catch(function(e){ alert(e.message); });
}

/* Recibos: las ventas a alumnos se muestran con su concepto. */
var _comDesgloseCA = comDesglose;
comDesglose = function(k, comis, ajus, op){
  comis = (comis || []).map(function(c){
    if(c.tipo !== 'alumno') return c;
    return Object.assign({}, c, { tipo:'recurrente', plan:{ empresa:{ nombre:c.nota || 'Venta a alumno' }, rango_texto:'Venta a alumno', periodo:'' },
      pago:{ numero:'de alumno', monto:c.cobrado, creado_en:c.creado_en } });
  });
  return _comDesgloseCA(k, comis, ajus, op).replace('Base = lo que depositó Mercado Pago (ya sin su comisión) menos el IVA de la venta.',
    'Base = lo que depositó Mercado Pago (ya sin su comisión) menos el IVA de la venta. En ventas a alumnos, base = lo pagado sin IVA.');
};

/* Nombres de las personas en la tabla de evaluación (sin mezclarlas con las empresas). */
var _ccTablaEvalCA = ccTablaEval;
ccTablaEval = function(llam, evals, pros, ops, tipo){
  var extra = ((CA.equipo && CA.equipo.pers) || []).concat(CA.admPers || []).map(function(p){ return { id:p.id, nombre:apNombre(p) }; });
  return _ccTablaEvalCA(llam, evals, (pros || []).concat(extra), ops, tipo);
};
