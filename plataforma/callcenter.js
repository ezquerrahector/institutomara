/* Instituto Mara — Callcenters (10 nov 2026).
   Se carga al final (después de embajadores.js). Requiere backend/callcenter-20261110.sql.

   · Administración → «Planes y operadores» → Callcenters: alta del callcenter con su
     titular, cifras de cada uno, su gente, auditoría de llamadas y días de caducidad.
     En Prospectos se puede mandar un lote a la bolsa de un callcenter.
   · Titular → «Mi equipo»: bolsa por repartir (a mano o parejo), agentes (alta,
     baja, descuento máximo, metas), cifras del equipo y evaluación de llamadas.
     En «Llamadas» ve solo lo que tiene asignado a su nombre.
   · Agente de callcenter: la misma consola de llamadas, sin montos de comisión.
   · Todos: liga de la grabación (opcional) al registrar la llamada y bitácora de
     las fichas que se abren. Los operadores internos no cambian. */

var CC = { lista:[], resumen:[], ops:[], datos:null, sel:{}, q:'', filtroAg:'', abierto:null, adm:{} };
var CC_RUBRICA = [
  ['apertura', 'Apertura', 'Saluda, se presenta y dice para qué llama'],
  ['guion', 'Guion', 'Sigue el guion y da la información correcta'],
  ['objeciones', 'Objeciones', 'Escucha y responde las objeciones'],
  ['cierre', 'Cierre', 'Pide el siguiente paso: prueba, demo o fecha'],
  ['registro', 'Registro', 'Lo que registró coincide con la llamada']
];
var CC_ACCION = { al_callcenter:'Llegó al callcenter', repartido:'Repartido', a_bolsa:'Regresó a la bolsa', regresado:'Regresó a Instituto Mara', recuperado:'Recuperado por Instituto Mara', a_operador:'Asignado a operador' };

function ccOp(){ return (window.LL && LL.op) || (window.PLN && PLN.miOp) || null; }
function esTitular(){ var o = ccOp(); return !!(esOperador() && o && o.callcenter_id && o.es_titular); }
function esAgenteCC(){ var o = ccOp(); return !!(esOperador() && o && o.callcenter_id && !o.es_titular); }
function esDeCallcenter(){ var o = ccOp(); return !!(esOperador() && o && o.callcenter_id); }
function ccFecha(iso){ return iso ? new Date(iso).toLocaleString('es-MX', { day:'numeric', month:'short', hour:'numeric', minute:'2-digit' }) : '—'; }
function ccHoyIni(){ var d = new Date(); d.setHours(0,0,0,0); return d; }
function ccPctBarra(v, meta){
  if(!meta) return '';
  var p = Math.min(100, Math.round(100 * v / meta));
  return '<div style="height:6px;background:var(--linea);border-radius:4px;margin-top:4px;overflow:hidden"><div style="height:100%;width:'+p+'%;background:'+(p >= 100 ? '#059669' : '#6D28D9')+'"></div></div>';
}
function ccAsegurarOp(){
  if(!esOperador() || ccOp()) return Promise.resolve(ccOp());
  return Nube.tabla('operadores?select=*&usuario_id=eq.' + sesion.id).then(function(r){
    var o = (r && r[0]) || null; if(window.LL) LL.op = o; if(window.PLN) PLN.miOp = o; return o;
  });
}

/* ============================================================================
   Menú: «Mi equipo» para el titular; sin «Comisiones» para el agente
   ========================================================================== */
var _pintarNavCC = pintarNav;
pintarNav = function(){
  _pintarNavCC();
  if(!esOperador()) return;
  var nav = $('nav');
  if(esAgenteCC()){ var b = nav.querySelector('button[data-v="op-comisiones"]'); if(b) b.remove(); }
  if(esTitular() && !nav.querySelector('button[data-v="cc-equipo"]')){
    var e = document.createElement('button'); e.setAttribute('data-v', 'cc-equipo'); e.textContent = 'Mi equipo';
    e.onclick = function(){ ir('cc-equipo'); };
    var ll = nav.querySelector('button[data-v="llamadas"]');
    if(ll && ll.nextSibling) nav.insertBefore(e, ll.nextSibling); else nav.appendChild(e);
  }
};
var _pintarCC = pintar;
pintar = function(){
  if(estado.vista === 'cc-equipo' && esTitular()){
    $('vista').innerHTML = vistaCCEquipo();
    var bs = $('nav').querySelectorAll('button');
    for(var i=0;i<bs.length;i++) bs[i].classList.toggle('activa', bs[i].getAttribute('data-v') === 'cc-equipo');
    return;
  }
  if(estado.vista === 'op-comisiones' && esAgenteCC()){ estado.vista = 'llamadas'; }
  _pintarCC();
};
var _entrarAppCC = entrarApp;
entrarApp = function(){
  _entrarAppCC();
  if(esOperador()) ccAsegurarOp().then(function(o){
    if(!o || !o.callcenter_id) return;
    $('rolUsuario').textContent = o.es_titular ? 'Titular de callcenter' : 'Agente';
    pintarNav();
    var bs = $('nav').querySelectorAll('button');
    for(var i=0;i<bs.length;i++) bs[i].classList.toggle('activa', bs[i].getAttribute('data-v') === estado.vista);
  }).catch(function(){});
};

/* ============================================================================
   Consola de llamadas
   ========================================================================== */
/* El titular ve en su consola solo lo que tiene a su nombre (lo de su equipo está en «Mi equipo»). */
var _llListaCC = llLista;
llLista = function(tab){
  var l = _llListaCC(tab);
  if(esTitular()){ var yo = ccOp().id; l = l.filter(function(p){ return p.asignado_a === yo; }); }
  return l;
};
/* Bitácora: cada ficha que abre un operador queda registrada. */
var _llPintarFichaCC = llPintarFicha;
llPintarFicha = function(id){
  _llPintarFichaCC(id);
  if(esOperador() && prPorId(id)) Nube.empresaRpc('prospecto_consulta', { p_prospecto:id }).catch(function(){});
};
/* Liga o ID de la grabación (opcional). */
var _llPintarRegistroCC = llPintarRegistro;
llPintarRegistro = function(p){
  _llPintarRegistroCC(p);
  var com = $('lr-com'); if(!com || $('lr-grab')) return;
  com.closest('.campo').insertAdjacentHTML('afterend',
    '<div class="campo"><label for="lr-grab">Liga o ID de la grabación (opcional)</label><input id="lr-grab" maxlength="500" placeholder="Si tu sistema graba, pega aquí la liga o el número de la grabación"></div>');
};
var _empresaRpcCC = Nube.empresaRpc;
Nube.empresaRpc = function(nombre, args){
  if(nombre === 'registrar_llamada' && $('lr-grab') && $('lr-grab').value.trim()) args = Object.assign({}, args, { p_grabacion:$('lr-grab').value.trim() });
  return _empresaRpcCC.call(Nube, nombre, args);
};
/* Historial: la grabación aparece junto a la llamada. */
var _llPintarHistCC = llPintarHist;
llPintarHist = function(p){
  _llPintarHistCC(p);
  var caja = $('lf-hist'); if(!caja) return;
  var con = (PR.contactos||[]).filter(function(c){ return c.prospecto_id === p.id && c.grabacion; });
  if(con.length) caja.insertAdjacentHTML('beforeend', '<div style="margin-top:10px;font-size:.88rem"><b>Grabaciones:</b> '+
    con.map(function(c){ return ccGrabacion(c.grabacion) + ' <small style="color:var(--gris)">(' + esc(ccFecha(c.fecha)) + ')</small>'; }).join(' · ')+'</div>');
};
function ccGrabacion(g){
  if(!g) return '';
  return /^https?:\/\//i.test(g) ? '<a href="'+esc(g)+'" target="_blank" rel="noopener">▶ Escuchar</a>' : '<span>🎙 '+esc(g)+'</span>';
}
/* El agente del callcenter no ve montos de comisión (se los paga su callcenter). */
var _supCargarMiosCC = supCargarMios;
supCargarMios = function(){
  if(!esAgenteCC()) return _supCargarMiosCC();
  Promise.all([ Nube.empresaRpc('operador_metricas', {}), Nube.tabla('callcenter_metas?select=*&operador_id=eq.' + ccOp().id).catch(function(){ return []; }) ]).then(function(r){
    var m = (r[0] || [])[0], meta = (r[1] || [])[0] || {}, c = $('ll-mios'); if(!m || !c) return;
    var conMeta = function(v, mt){ return mt ? 'meta: ' + mt + ccPctBarra(v, mt) : null; };
    c.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
      supCifra('Te tocan hoy', m.toca_hoy)+
      supCifra('Atrasadas', m.atrasadas, m.atrasadas ? '#B45309' : '#065F46')+
      supCifra('Llamadas hoy', m.llamadas_hoy, null, conMeta(m.llamadas_hoy, meta.llamadas_dia) || (m.llamadas_semana + ' en la semana'))+
      supCifra('Conversaciones del mes', m.conversaciones_mes, null, meta.conversaciones_semana ? 'meta: ' + meta.conversaciones_semana + ' a la semana' : null)+
      supCifra('Pruebas del mes', m.pruebas_mes, null, conMeta(m.pruebas_mes, meta.pruebas_mes))+
      supCifra('Planes del mes', m.planes_mes, null, conMeta(m.planes_mes, meta.planes_mes))+
      '</div>'+(m.atrasadas ? '<p style="color:#B45309;font-size:.88rem;margin-top:8px">Tienes '+m.atrasadas+' llamada'+(m.atrasadas === 1 ? '' : 's')+' atrasada'+(m.atrasadas === 1 ? '' : 's')+': aparecen primero en «Toca hoy».</p>' : '');
  }).catch(function(){});
};
var _plnPintarOpInicioCC = plnPintarOpInicio;
plnPintarOpInicio = function(){
  _plnPintarOpInicioCC();
  if(!esAgenteCC()) return;
  var caja = $('op-datos'); if(!caja) return;
  caja.querySelectorAll('tr').forEach(function(tr){ var c = tr.children[3]; if(c) c.remove(); });
  caja.querySelectorAll('p').forEach(function(p){ if(/comisión/i.test(p.textContent)) p.remove(); });
};
var _vistaMiPerfilCC = vistaMiPerfil;
vistaMiPerfil = function(){
  var h = _vistaMiPerfilCC();
  if(esAgenteCC()) setTimeout(function(){ var t = $('com-banco'); if(t) t.remove(); }, 0);
  return h;
};

/* ============================================================================
   Titular → «Mi equipo»
   ========================================================================== */
function vistaCCEquipo(){
  setTimeout(ccCargarEquipo, 0);
  return '<div class="seccion"><div class="encabezado-fila"><div><h2>Mi equipo</h2>'+
    '<p class="sub" style="margin:0">Reparte los prospectos que te asigna Instituto Mara, da de alta a tus agentes y evalúa sus llamadas.</p></div>'+
    '<button class="btn btn-fantasma btn-sm" onclick="ccCargarEquipo()">Actualizar</button></div>'+
    '<div id="cc-cifras">Cargando…</div>'+
    '<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:6px">Prospectos del callcenter</h3><div id="cc-bolsa"></div></div>'+
    '<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:6px">Agentes</h3><div id="cc-agentes"></div></div>'+
    '<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:6px">Evaluar llamadas</h3><div id="cc-eval"></div></div>'+
    '<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:6px">Movimientos recientes</h3><div id="cc-mov"></div></div>'+
    '</div>';
}
function ccCargarEquipo(){
  return ccAsegurarOp().then(function(o){
    if(!o || !o.callcenter_id) throw new Error('Tu cuenta no está ligada a un callcenter.');
    var cc = o.callcenter_id, desde = new Date(Date.now() - 14 * 864e5).toISOString();
    return Promise.all([
      Nube.tabla('callcenters?select=*&id=eq.' + cc),
      Nube.tabla('operadores?select=id,nombre,correo,telefono,activo,es_titular,descuento_max,usuario_id&callcenter_id=eq.' + cc + '&order=nombre.asc'),
      Nube.tabla('prospectos?select=id,nombre,nombre_corto,segmento,telefono,estado,asignado_a,proxima_llamada,llamadas_intentos,ultimo_resultado,ultima_llamada,num_origen,callcenter_en&callcenter_id=eq.' + cc + '&order=num_origen.asc.nullslast,id.asc&limit=5000'),
      Nube.empresaRpc('equipo_metricas', {}),
      Nube.tabla('callcenter_metas?select=*'),
      Nube.tabla('prospecto_contactos?select=id,prospecto_id,fecha,resultado,resumen,creado_por,grabacion,contacto_nombre&canal=eq.llamada&fecha=gte.' + encodeURIComponent(desde) + '&order=fecha.desc&limit=600'),
      Nube.tabla('llamada_evaluaciones?select=*&order=creado_en.desc,id.desc&limit=2000'),
      Nube.tabla('prospecto_consultas?select=operador_id&fecha=gte.' + encodeURIComponent(ccHoyIni().toISOString()) + '&order=id&limit=10000'),
      Nube.tabla('callcenter_movimientos?select=*&order=fecha.desc&limit=60'),
      Nube.cargarAjustes(BD).catch(function(){ return null; })
    ]);
  }).then(function(r){
    CC.datos = { cc:(r[0]||[])[0] || {}, ops:r[1] || [], pros:r[2] || [], met:r[3] || [], metas:r[4] || [], llam:r[5] || [], evals:r[6] || [], cons:r[7] || [], mov:r[8] || [] };
    CC.sel = {};
    ccPintarCifras(); ccPintarBolsa(); ccPintarAgentes(); ccPintarEval(); ccPintarMov();
  }).catch(function(e){ var c = $('cc-cifras'); if(c) c.innerHTML = plnErr(e, 'Si dice que no existe la función, falta correr backend/callcenter-20261110.sql en Supabase.'); });
}
function ccNombreOp(id){ var o = (CC.datos && CC.datos.ops || []).concat(CC.adm.ops || []).filter(function(x){ return x.id === id; })[0]; return o ? o.nombre : '—'; }
function ccOpPorUsuario(uid, lista){ return (lista || CC.datos.ops).filter(function(o){ return o.usuario_id === uid; })[0] || null; }
function ccPromedio(evals, op){
  var l = evals.filter(function(e){ return e.operador_id === op; });
  return l.length ? (l.reduce(function(a, e){ return a + Number(e.total); }, 0) / l.length).toFixed(1) : null;
}

function ccPintarCifras(){
  var caja = $('cc-cifras'), d = CC.datos; if(!caja || !d) return;
  var bolsa = d.pros.filter(function(p){ return !p.asignado_a && !llCerrado(p); }).length;
  var abiertos = d.pros.filter(function(p){ return !llCerrado(p); }).length;
  var tot = function(k){ return d.met.reduce(function(a, m){ return a + Number(m[k] || 0); }, 0); };
  var cons = function(op){ return d.cons.filter(function(c){ return c.operador_id === op; }).length; };
  caja.innerHTML = '<div class="tarjeta"><div class="encabezado-fila" style="margin-bottom:10px"><h3 style="color:var(--tinta);margin:0">'+esc(d.cc.nombre || 'Callcenter')+'</h3>'+
      '<small style="color:var(--gris)">Si un prospecto pasa '+Number(ajuste('callcenter_dias_caducidad', 15))+' días sin ningún intento, regresa solo a Instituto Mara.</small></div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">'+
      supCifra('Por repartir', bolsa, bolsa ? '#B45309' : null)+
      supCifra('Abiertos', abiertos)+
      supCifra('Llamadas hoy', tot('llamadas_hoy'), null, tot('llamadas_semana') + ' en la semana')+
      supCifra('Atrasadas', tot('atrasadas'), tot('atrasadas') ? '#B45309' : '#065F46')+
      supCifra('Pruebas activas', tot('pruebas_activas'))+
      supCifra('Planes activos', tot('planes_activos'))+
      supCifra('Comisión del mes', dinero(tot('comision_mes')), null, dinero(tot('comision_por_cobrar')) + ' por cobrar')+
    '</div>'+
    '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Agente</th><th>Asignados</th><th>Toca hoy</th><th>Atrasadas</th><th>Llamadas hoy</th><th>Semana</th><th>Pruebas · planes</th><th>Calificación</th><th>Fichas abiertas hoy</th><th>Comisión del mes</th></tr></thead><tbody>'+
    d.met.map(function(m){
      var meta = d.metas.filter(function(x){ return x.operador_id === m.operador_id; })[0] || {}, prom = ccPromedio(d.evals, m.operador_id), c = cons(m.operador_id);
      var raro = c > 15 && c > 2 * Number(m.llamadas_hoy || 0);
      return '<tr><td><b>'+esc(m.nombre)+'</b>'+(m.activo ? '' : ' <span class="etiqueta gris">Inactivo</span>')+'<br><small style="color:var(--gris)">Última actividad: '+esc(m.ultima_actividad ? hace(m.ultima_actividad) : '—')+'</small></td>'+
        '<td>'+m.asignadas+'</td><td>'+m.toca_hoy+'</td><td'+(m.atrasadas ? ' style="color:#B45309;font-weight:700"' : '')+'>'+m.atrasadas+'</td>'+
        '<td>'+m.llamadas_hoy+(meta.llamadas_dia ? ' <small style="color:var(--gris)">de '+meta.llamadas_dia+'</small>'+ccPctBarra(m.llamadas_hoy, meta.llamadas_dia) : '')+'</td>'+
        '<td>'+m.llamadas_semana+'<br><small style="color:var(--gris)">'+m.conversaciones_mes+' conversaciones en el mes</small></td>'+
        '<td>'+m.pruebas_activas+' · '+m.planes_activos+'</td>'+
        '<td>'+(prom ? '<b>'+prom+'</b> / 5' : '<small style="color:var(--gris)">Sin evaluar</small>')+'</td>'+
        '<td'+(raro ? ' style="color:#B91C1C;font-weight:700" title="Abrió muchas fichas para las llamadas que registró"' : '')+'>'+c+(raro ? ' ⚠' : '')+'</td>'+
        '<td>'+dinero(m.comision_mes)+'</td></tr>';
    }).join('')+'</tbody></table></div></div>'+
    '<p style="color:var(--gris);font-size:.85rem;margin-top:8px">Las comisiones se calculan por agente, pero el recibo te llega a ti cada quincena en «Comisiones». ⚠ en fichas abiertas: abrió muchas más fichas de las llamadas que registró.</p></div>';
}

/* ---------- Bolsa y reparto ---------- */
function ccPintarBolsa(){
  var caja = $('cc-bolsa'), d = CC.datos; if(!caja || !d) return;
  var activos = d.ops.filter(function(o){ return o.activo; });
  var q = plNorm(CC.q), f = CC.filtroAg;
  var l = d.pros.filter(function(p){
    if(f === 'bolsa' && p.asignado_a) return false;
    if(f && f !== 'bolsa' && p.asignado_a !== f) return false;
    if(f !== 'cerrados' && !f && llCerrado(p)) return false;
    return !q || plNorm([p.nombre, p.segmento, p.telefono].join(' ')).indexOf(q) >= 0;
  });
  var ids = Object.keys(CC.sel).filter(function(k){ return CC.sel[k]; });
  var bolsa = d.pros.filter(function(p){ return !p.asignado_a && !llCerrado(p); }).length;
  caja.innerHTML = '<p style="color:var(--gris);font-size:.92rem;margin-bottom:12px">Instituto Mara te manda prospectos a la bolsa. Repártelos a mano (selecciona y elige agente) o parejo entre tus agentes activos.</p>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">'+
      '<button class="btn btn-mor btn-sm"'+(bolsa && activos.length ? '' : ' disabled')+' onclick="ccRepartirParejo()">Repartir parejo los '+bolsa+' de la bolsa</button>'+
      '<label style="display:flex;gap:6px;align-items:center;font-size:.9rem"><input type="checkbox" id="cc-yo" style="width:auto;margin:0"> incluirme a mí</label></div>'+
    '<div class="fila" style="margin-bottom:6px"><div class="campo" style="max-width:320px"><label for="cc-q">Buscar</label><input id="cc-q" value="'+esc(CC.q)+'" oninput="CC.q=this.value;ccPintarBolsa();var e=$(\'cc-q\');e.focus();e.setSelectionRange(e.value.length,e.value.length)"></div>'+
      '<div class="campo" style="max-width:260px"><label for="cc-f">Mostrar</label><select id="cc-f" onchange="CC.filtroAg=this.value;ccPintarBolsa()">'+
        '<option value="">Abiertos (todos)</option><option value="bolsa"'+(f === 'bolsa' ? ' selected' : '')+'>Por repartir</option>'+
        d.ops.map(function(o){ return '<option value="'+o.id+'"'+(f === o.id ? ' selected' : '')+'>De '+esc(o.nombre)+'</option>'; }).join('')+'</select></div></div>'+
    (ids.length ? '<div class="aviso" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><b>'+ids.length+' seleccionado(s)</b>'+
      '<select id="cc-asig"><option value="">Asignar a…</option>'+activos.map(function(o){ return '<option value="'+o.id+'">'+esc(o.nombre)+(o.es_titular ? ' (yo)' : '')+'</option>'; }).join('')+'</select>'+
      '<button class="btn btn-mor btn-sm" onclick="ccRepartir(true)">Asignar</button>'+
      '<button class="btn btn-fantasma btn-sm" onclick="ccRepartir(false)">Regresar a la bolsa</button>'+
      '<button class="btn btn-fantasma btn-sm" onclick="CC.sel={};ccPintarBolsa()">Quitar selección</button></div>' : '')+
    (l.length ? '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th><input type="checkbox" style="width:auto;margin:0" onchange="ccSelTodos(this.checked)" aria-label="Seleccionar todos"></th><th>Empresa</th><th>Agente</th><th>Estado</th><th>Intentos</th><th>Siguiente llamada</th></tr></thead><tbody>'+
      l.slice(0, 400).map(function(p){
        return '<tr><td><input type="checkbox" style="width:auto;margin:0"'+(CC.sel[p.id] ? ' checked' : '')+' onchange="CC.sel[\''+p.id+'\']=this.checked;ccPintarBolsa()"></td>'+
          '<td><b>'+esc(p.nombre_corto || p.nombre)+'</b><br><small style="color:var(--gris)">'+esc(p.segmento || '')+'</small></td>'+
          '<td>'+(p.asignado_a ? esc(ccNombreOp(p.asignado_a)) : '<span class="etiqueta alerta">Por repartir</span>')+'</td>'+
          '<td>'+esc(PR_ESTADOS[p.estado] || p.estado)+(p.ultimo_resultado ? '<br><small>'+esc(LL_RES_TXT[p.ultimo_resultado] || p.ultimo_resultado)+'</small>' : '')+'</td>'+
          '<td>'+(p.llamadas_intentos || 0)+'</td><td>'+esc(p.proxima_llamada ? llFechaHora(p.proxima_llamada) : '—')+'</td></tr>';
      }).join('')+'</tbody></table></div></div>'+(l.length > 400 ? '<p style="color:var(--gris);font-size:.85rem;margin-top:6px">Se muestran 400 de '+l.length+'. Usa el buscador o el filtro.</p>' : '')
      : '<p style="color:var(--gris)">No hay prospectos en esta vista.</p>');
}
function ccSelTodos(si){
  var d = CC.datos, f = CC.filtroAg, q = plNorm(CC.q);
  d.pros.forEach(function(p){
    if(f === 'bolsa' && p.asignado_a) return; if(f && f !== 'bolsa' && p.asignado_a !== f) return; if(!f && llCerrado(p)) return;
    if(q && plNorm([p.nombre, p.segmento, p.telefono].join(' ')).indexOf(q) < 0) return;
    CC.sel[p.id] = si;
  });
  ccPintarBolsa();
}
function ccRepartir(si){
  var ids = Object.keys(CC.sel).filter(function(k){ return CC.sel[k]; }), op = si ? $('cc-asig').value : null;
  if(si && !op){ alert('Elige a quién se los asignas.'); return; }
  if(!confirm(si ? '¿Asignar '+ids.length+' prospecto(s) a '+ccNombreOp(op)+'? Los verá en su consola de llamadas.' : '¿Regresar '+ids.length+' prospecto(s) a la bolsa del callcenter?')) return;
  Nube.empresaRpc('callcenter_repartir', { p_ids:ids, p_operador:op }).then(function(){ return ccCargarEquipo(); }).catch(function(e){ alert(e.message); });
}
function ccRepartirParejo(){
  var yo = $('cc-yo') && $('cc-yo').checked;
  if(!confirm('¿Repartir parejo todos los prospectos de la bolsa entre tus agentes activos'+(yo ? ' (incluyéndote)' : '')+'? Le tocan primero a quien tiene menos.')) return;
  Nube.empresaRpc('callcenter_repartir_parejo', { p_ids:null, p_incluir_titular:!!yo }).then(function(r){
    var por = (r && r.por_agente) || {};
    alert('Repartidos: ' + ((r && r.repartidos) || 0) + (Object.keys(por).length ? '\n' + Object.keys(por).map(function(k){ return ccNombreOp(k) + ': ' + por[k]; }).join('\n') : ''));
    return ccCargarEquipo();
  }).catch(function(e){ alert(e.message); });
}

/* ---------- Agentes ---------- */
function ccPintarAgentes(){
  var caja = $('cc-agentes'), d = CC.datos; if(!caja || !d) return;
  var tope = plnDescMax();
  caja.innerHTML = '<p style="color:var(--gris);font-size:.92rem;margin-bottom:12px">Tus agentes entran con su propia cuenta y solo ven lo que les asignas. Si desactivas a alguien, sus prospectos abiertos regresan a tu bolsa. El descuento máximo general es de '+tope+'%: a cada agente le puedes poner uno menor.</p>'+
    '<div class="tabla-caja" style="margin-bottom:14px"><div class="tabla-scroll"><table><thead><tr><th>Agente</th><th>Teléfono</th><th>Cuenta</th><th>Descuento máx.</th><th>Metas</th><th></th></tr></thead><tbody>'+
    d.ops.map(function(o){
      var m = d.metas.filter(function(x){ return x.operador_id === o.id; })[0];
      var metas = m ? [m.llamadas_dia ? m.llamadas_dia + ' llamadas/día' : '', m.conversaciones_semana ? m.conversaciones_semana + ' conversaciones/semana' : '',
        m.pruebas_mes ? m.pruebas_mes + ' pruebas/mes' : '', m.planes_mes ? m.planes_mes + ' planes/mes' : ''].filter(Boolean).join(' · ') : '';
      return '<tr><td><b>'+esc(o.nombre)+'</b>'+(o.es_titular ? ' <span class="etiqueta tur">Titular</span>' : '')+(o.activo ? '' : ' <span class="etiqueta gris">Inactivo</span>')+'<br><small>'+esc(o.correo)+'</small></td>'+
        '<td>'+esc(o.telefono || '—')+'</td>'+
        '<td>'+(o.usuario_id ? '<span class="etiqueta ok">Activa</span>' : '<span class="etiqueta alerta">Falta que se registre</span>')+'</td>'+
        '<td>'+Number(o.descuento_max)+'%</td><td><small>'+(metas ? esc(metas) : '—')+'</small></td>'+
        '<td style="white-space:nowrap">'+(o.es_titular ? '' : '<button class="btn btn-fantasma btn-sm" onclick="ccEditarAgente(\''+o.id+'\')">Editar</button> ')+
          '<button class="btn btn-fantasma btn-sm" onclick="ccAccesoAgente(\''+o.id+'\')">Enviar acceso</button></td></tr>';
    }).join('')+'</tbody></table></div></div>'+
    '<h4 style="margin:6px 0 10px">Dar de alta un agente</h4>'+
    '<div class="fila"><div class="campo"><label for="ca-cor">Correo *</label><input id="ca-cor" type="email"></div>'+
      '<div class="campo"><label for="ca-nom">Nombre *</label><input id="ca-nom" maxlength="120"></div>'+
      '<div class="campo"><label for="ca-tel">Teléfono</label><input id="ca-tel" type="tel" maxlength="20"></div>'+
      '<div class="campo"><label for="ca-desc">Descuento máx. (%)</label><input id="ca-desc" type="number" min="0" max="'+tope+'" value="'+tope+'"></div></div>'+
    '<div id="ca-aviso"></div><button class="btn btn-mor" onclick="ccAltaAgente()">Dar de alta</button>';
}
function ccAltaAgente(){
  var av = $('ca-aviso');
  Nube.empresaRpc('callcenter_agente_alta', { p_correo:$('ca-cor').value.trim(), p_nombre:$('ca-nom').value.trim(), p_telefono:$('ca-tel').value.trim() || null,
      p_descuento_max:$('ca-desc').value === '' ? null : Number($('ca-desc').value) })
    .then(function(f){ return ccCargarEquipo().then(function(){ ccAccesoAgente(f.id); }); })
    .catch(function(e){ av.innerHTML = plnErr(e); });
}
function ccEditarAgente(id){
  var o = CC.datos.ops.filter(function(x){ return x.id === id; })[0]; if(!o) return;
  var m = CC.datos.metas.filter(function(x){ return x.operador_id === id; })[0] || {}, tope = plnDescMax();
  var num = function(idc, rot, v){ return '<div class="campo"><label for="'+idc+'">'+rot+'</label><input id="'+idc+'" type="number" min="0" value="'+(v == null ? '' : esc(v))+'" placeholder="Sin meta"></div>'; };
  abrirModal('Agente: ' + o.nombre,
    '<div class="campo"><label for="ce-desc">Descuento que puede dar sin pedir permiso (%)</label><input id="ce-desc" type="number" min="0" max="'+tope+'" value="'+esc(o.descuento_max)+'">'+
      '<small style="color:var(--gris)">Máximo '+tope+'%.</small></div>'+
    '<h4 style="margin:10px 0 6px">Metas (opcionales)</h4><div class="fila">'+
      num('ce-m1', 'Llamadas al día', m.llamadas_dia)+num('ce-m2', 'Conversaciones a la semana', m.conversaciones_semana)+'</div><div class="fila">'+
      num('ce-m3', 'Pruebas al mes', m.pruebas_mes)+num('ce-m4', 'Planes al mes', m.planes_mes)+'</div>'+
    '<div id="ce-aviso"></div>',
    '<button class="btn btn-fantasma" onclick="ccActivarAgente(\''+id+'\','+(!o.activo)+')">'+(o.activo ? 'Desactivar' : 'Activar')+'</button>'+
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cancelar</button><button class="btn btn-mor" onclick="ccGuardarAgente(\''+id+'\')">Guardar</button>');
}
function ccNum(idc){ var v = $(idc).value; return v === '' ? null : Math.max(0, Math.floor(Number(v))); }
function ccGuardarAgente(id){
  var av = $('ce-aviso');
  Nube.empresaRpc('callcenter_agente_actualizar', { p_operador:id, p_activo:null, p_descuento_max:Number($('ce-desc').value) })
    .then(function(){ return Nube.empresaRpc('callcenter_meta', { p_operador:id, p_llamadas_dia:ccNum('ce-m1'), p_conversaciones_semana:ccNum('ce-m2'), p_pruebas_mes:ccNum('ce-m3'), p_planes_mes:ccNum('ce-m4') }); })
    .then(function(){ cerrarModal(); return ccCargarEquipo(); })
    .catch(function(e){ av.innerHTML = plnErr(e); });
}
function ccActivarAgente(id, si){
  if(!si && !confirm('¿Desactivar a ' + ccNombreOp(id) + '? Ya no podrá entrar y sus prospectos abiertos regresan a tu bolsa para que los repartas.')) return;
  Nube.empresaRpc('callcenter_agente_actualizar', { p_operador:id, p_activo:si, p_descuento_max:null })
    .then(function(){ cerrarModal(); return ccCargarEquipo(); }).catch(function(e){ alert(e.message); });
}
function ccAccesoAgente(id){
  var o = CC.datos.ops.filter(function(x){ return x.id === id; })[0]; if(!o) return;
  var enlace = location.origin + location.pathname;
  var t = 'Hola ' + o.nombre.split(' ')[0] + ', ya tienes tu acceso a la consola de llamadas de Instituto Mara. Ahí verás las empresas que te toca llamar, el guion de cada llamada y dónde registrar lo que pasó.\n\n' +
    (o.usuario_id ? '👉 Entra con tu cuenta (' + o.correo + ') aquí: ' : '👉 Crea tu cuenta con este mismo correo (' + o.correo + ') y verás tu consola: ') + enlace;
  abrirModal('Enviar acceso a ' + o.nombre,
    '<p style="margin-bottom:10px">Mándale este mensaje:</p><textarea id="cc-acc" rows="7" style="width:100%">'+esc(t)+'</textarea>',
    '<button class="btn btn-fantasma" onclick="copiarTexto($(\'cc-acc\').value)">Copiar</button>'+
    (o.telefono ? '<button class="btn btn-mor" onclick="window.open(\'https://wa.me/'+plnTelWa(o.telefono)+'?text=\'+encodeURIComponent($(\'cc-acc\').value),\'_blank\',\'noopener\')">WhatsApp</button>' : ''));
}

/* ---------- Evaluación de llamadas (titular y auditoría) ---------- */
function ccPintarEval(){
  var caja = $('cc-eval'), d = CC.datos; if(!caja || !d) return;
  var yo = ccOp();
  var l = d.llam.filter(function(c){ var o = ccOpPorUsuario(c.creado_por); return o && o.id !== yo.id; });
  caja.innerHTML = ccTablaEval(l, d.evals, d.pros, d.ops, 'titular');
}
function ccTablaEval(llam, evals, pros, ops, tipo){
  var nomP = function(id){ var p = (pros || []).filter(function(x){ return x.id === id; })[0] || (PR.lista || []).filter(function(x){ return x.id === id; })[0]; return p ? (p.nombre_corto || p.nombre) : '—'; };
  var pend = llam.filter(function(c){ return !evals.some(function(e){ return e.contacto_id === c.id && e.tipo === tipo; }); }).length;
  return '<p style="color:var(--gris);font-size:.92rem;margin-bottom:12px">Llamadas de los últimos 14 días. Califica del 1 al 5: '+
      CC_RUBRICA.map(function(r){ return '<b>'+esc(r[1])+'</b>'; }).join(', ')+'. '+(tipo === 'titular' ? 'Instituto Mara puede auditar cualquier llamada.' : 'Tu evaluación queda como auditoría.')+
      (pend ? ' <b>'+pend+' sin evaluar.</b>' : '')+'</p>'+
    (llam.length ? '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Fecha</th><th>Agente</th><th>Empresa</th><th>Resultado</th><th>Grabación</th><th>Calificación</th><th></th></tr></thead><tbody>'+
      llam.slice(0, 150).map(function(c){
        var o = ccOpPorUsuario(c.creado_por, ops), ev = evals.filter(function(e){ return e.contacto_id === c.id; });
        var mia = ev.filter(function(e){ return e.tipo === tipo; })[0], otra = ev.filter(function(e){ return e.tipo !== tipo; })[0];
        return '<tr><td>'+esc(ccFecha(c.fecha))+'</td><td>'+esc(o ? o.nombre : '—')+'</td><td><b>'+esc(nomP(c.prospecto_id))+'</b>'+(c.resumen ? '<br><small>'+esc(String(c.resumen).slice(0, 120))+'</small>' : '')+'</td>'+
          '<td>'+esc(c.resultado || '—')+'</td><td>'+(ccGrabacion(c.grabacion) || '<small style="color:var(--gris)">—</small>')+'</td>'+
          '<td>'+(mia ? '<b>'+Number(mia.total).toFixed(1)+'</b>' : '<small style="color:var(--gris)">—</small>')+
            (otra ? '<br><small>'+(otra.tipo === 'auditoria' ? 'Auditoría' : 'Titular')+': '+Number(otra.total).toFixed(1)+'</small>' : '')+'</td>'+
          '<td><button class="btn btn-'+(mia ? 'fantasma' : 'linea')+' btn-sm" onclick="ccEvaluar(\''+c.id+'\',\''+tipo+'\')">'+(mia ? 'Ver / cambiar' : 'Evaluar')+'</button></td></tr>';
      }).join('')+'</tbody></table></div></div>' : '<p style="color:var(--gris)">No hay llamadas que evaluar en los últimos 14 días.</p>');
}
function ccEvaluar(contacto, tipo){
  var fuente = tipo === 'titular' ? CC.datos : CC.adm;
  var c = (fuente.llam || []).filter(function(x){ return x.id === contacto; })[0]; if(!c) return;
  var ev = (fuente.evals || []).filter(function(e){ return e.contacto_id === contacto && e.tipo === tipo; })[0] || {};
  var otra = (fuente.evals || []).filter(function(e){ return e.contacto_id === contacto && e.tipo !== tipo; })[0];
  abrirModal('Evaluar llamada',
    '<p style="margin-bottom:6px"><b>'+esc(c.resultado || '')+'</b> · '+esc(ccFecha(c.fecha))+(c.contacto_nombre ? ' · habló con '+esc(c.contacto_nombre) : '')+'</p>'+
    (c.resumen ? '<p style="color:var(--gris);font-size:.92rem;margin-bottom:8px">«'+esc(c.resumen)+'»</p>' : '')+
    (c.grabacion ? '<p style="margin-bottom:10px">'+ccGrabacion(c.grabacion)+'</p>' : '<p style="color:var(--gris);font-size:.88rem;margin-bottom:10px">Sin grabación registrada.</p>')+
    CC_RUBRICA.map(function(r){
      return '<div class="campo"><label for="ev-'+r[0]+'">'+esc(r[1])+' <small style="color:var(--gris);font-weight:400">· '+esc(r[2])+'</small></label>'+
        '<select id="ev-'+r[0]+'">'+[5,4,3,2,1].map(function(n){ return '<option value="'+n+'"'+(Number(ev[r[0]] || 3) === n ? ' selected' : '')+'>'+n+(n === 5 ? ' · excelente' : n === 1 ? ' · deficiente' : '')+'</option>'; }).join('')+'</select></div>';
    }).join('')+
    '<div class="campo"><label for="ev-com">Comentario para el agente</label><textarea id="ev-com" rows="3">'+esc(ev.comentario || '')+'</textarea></div>'+
    (otra ? '<p style="font-size:.88rem;color:var(--gris)">'+(otra.tipo === 'auditoria' ? 'Auditoría de Instituto Mara' : 'Evaluación del titular')+': <b>'+Number(otra.total).toFixed(1)+'</b>'+(otra.comentario ? ' · «'+esc(otra.comentario)+'»' : '')+'</p>' : '')+
    '<div id="ev-aviso"></div>',
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cancelar</button><button class="btn btn-mor" onclick="ccGuardarEval(\''+contacto+'\',\''+tipo+'\')">Guardar</button>');
}
function ccGuardarEval(contacto, tipo){
  var v = function(k){ return Number($('ev-' + k).value); };
  Nube.empresaRpc('evaluar_llamada', { p_contacto:contacto, p_apertura:v('apertura'), p_guion:v('guion'), p_objeciones:v('objeciones'), p_cierre:v('cierre'), p_registro:v('registro'),
      p_comentario:$('ev-com').value.trim() || null })
    .then(function(){ cerrarModal(); return tipo === 'titular' ? ccCargarEquipo() : ccAdmAbrir(CC.abierto); })
    .catch(function(e){ $('ev-aviso').innerHTML = plnErr(e); });
}
/* El agente ve sus evaluaciones en el historial de la ficha. */
var _llPintarHistCC2 = llPintarHist;
llPintarHist = function(p){
  _llPintarHistCC2(p);
  if(!esOperador()) return;
  Nube.tabla('llamada_evaluaciones?select=*&prospecto_id=eq.' + p.id + '&order=creado_en.desc').then(function(l){
    var caja = $('lf-hist'); if(!caja || !l || !l.length) return;
    caja.insertAdjacentHTML('beforeend', '<div style="margin-top:10px;font-size:.88rem"><b>Evaluaciones de tus llamadas:</b>'+
      l.map(function(e){ return '<div style="margin-top:4px">'+(e.tipo === 'auditoria' ? 'Auditoría' : 'Titular')+': <b>'+Number(e.total).toFixed(1)+'</b> / 5'+(e.comentario ? ' · «'+esc(e.comentario)+'»' : '')+'</div>'; }).join('')+'</div>');
  }).catch(function(){});
};

function ccPintarMov(){
  var caja = $('cc-mov'), d = CC.datos; if(!caja || !d) return;
  caja.innerHTML = ccTablaMov(d.mov, d.pros);
}
function ccTablaMov(mov, pros){
  var extra = (window.CA && CA.equipo && CA.equipo.pers) || [];
  var nomP = function(id){ var p = (pros || []).concat(extra).filter(function(x){ return x.id === id; })[0] || (PR.lista || []).filter(function(x){ return x.id === id; })[0]; return p ? (p.nombre_corto || p.nombre || p.correo) : 'Prospecto'; };
  if(!mov.length) return '<p style="color:var(--gris)">Todavía no hay movimientos.</p>';
  return '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Fecha</th><th>Empresa</th><th>Movimiento</th><th>Quedó con</th></tr></thead><tbody>'+
    mov.slice(0, 60).map(function(m){
      return '<tr><td>'+esc(ccFecha(m.fecha))+'</td><td>'+esc(nomP(m.prospecto_id || m.persona_id))+(m.persona_id ? ' <small style="color:var(--gris)">(alumno)</small>' : '')+'</td><td>'+esc(CC_ACCION[m.accion] || m.accion)+(m.nota ? '<br><small>'+esc(m.nota)+'</small>' : '')+'</td>'+
        '<td>'+(m.operador_id ? esc(ccNombreOp(m.operador_id)) : '—')+'</td></tr>';
    }).join('')+'</tbody></table></div></div>';
}

/* ============================================================================
   Administración → «Planes y operadores» → Callcenters
   ========================================================================== */
var _vistaAdminPlanesCC = vistaAdminPlanes;
vistaAdminPlanes = function(){
  var h = _vistaAdminPlanesCC();
  return h.replace('<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:12px">Planes de empresas</h3>',
    '<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:6px">Callcenters</h3><div id="pln-cc">Cargando…</div></div>'+
    '<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:12px">Planes de empresas</h3>');
};
var _plnCargarAdminCC = plnCargarAdmin;
plnCargarAdmin = function(){
  var pedido = Promise.all([ Nube.empresaRpc('callcenter_resumen', {}), Nube.tabla('callcenters?select=*&order=nombre.asc') ]); pedido.catch(function(){});
  return _plnCargarAdminCC().then(function(){
    return pedido.then(function(r){ CC.resumen = r[0] || []; CC.lista = r[1] || []; ccAdmPintar(); })
      .catch(function(e){ var c = $('pln-cc'); if(c) c.innerHTML = plnErr(e, 'Falta correr backend/callcenter-20261110.sql en Supabase.'); });
  });
};
/* La tabla de «Operadores» muestra solo a los internos; los de callcenter están en su callcenter. */
var _plnPintarOpsCC = plnPintarOps;
plnPintarOps = function(){
  var todos = PLN.ops;
  PLN.ops = todos.filter(function(o){ return !o.callcenter_id; });
  try{ _plnPintarOpsCC(); } finally { PLN.ops = todos; }
};
/* En «Supervisión de operadores» se distingue a la gente de cada callcenter. */
var _supPintarAdminCC = supPintarAdmin;
supPintarAdmin = function(){
  var orig = SUP.datos;
  SUP.datos = orig.map(function(m){
    var o = plnOperador(m.operador_id), k = o && o.callcenter_id ? CC.lista.filter(function(x){ return x.id === o.callcenter_id; })[0] : null;
    return k ? Object.assign({}, m, { nombre:m.nombre + ' · ' + k.nombre + (o.es_titular ? ' (titular)' : '') }) : m;
  });
  try{ _supPintarAdminCC(); } finally { SUP.datos = orig; }
};
function ccAdmPintar(){
  var caja = $('pln-cc'); if(!caja) return;
  var dias = Number(ajuste('callcenter_dias_caducidad', 15));
  caja.innerHTML = '<p style="color:var(--gris);font-size:.92rem;margin-bottom:12px">Empresas externas que llaman a tu base. Tú les mandas lotes desde <b>Prospectos</b> (selecciona → «Asignar a…» → el callcenter) y su titular los reparte entre sus agentes. Sus prospectos no los ve nadie más. '+
      'Si un prospecto pasa <b>'+dias+' días</b> sin ningún intento, regresa solo a ti.</p>'+
    (CC.resumen.length ? CC.resumen.map(function(k){
      return '<div style="border:1px solid var(--linea);border-radius:14px;padding:14px 16px;margin-bottom:12px">'+
        '<div class="encabezado-fila" style="margin-bottom:10px"><div><b style="font-size:1.05rem">'+esc(k.nombre)+'</b>'+(k.activo ? '' : ' <span class="etiqueta gris">Inactivo</span>')+
          '<br><small style="color:var(--gris)">Titular: '+esc(k.titular || '—')+' · '+esc(k.titular_correo || '')+' · '+k.agentes_activos+' de '+k.agentes_total+' personas activas</small></div>'+
          '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-linea btn-sm" onclick="ccAdmAbrir(\''+k.callcenter_id+'\')">'+(CC.abierto === k.callcenter_id ? 'Actualizar' : 'Ver detalle')+'</button>'+
          '<button class="btn btn-fantasma btn-sm" onclick="ccAdmEstado(\''+k.callcenter_id+'\','+(!k.activo)+')">'+(k.activo ? 'Desactivar' : 'Activar')+'</button></div></div>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
          supCifra('Por repartir', k.en_bolsa, k.en_bolsa ? '#B45309' : null)+
          supCifra('Abiertos', k.abiertos, null, k.sin_llamar + ' sin llamar')+
          supCifra('Atrasadas', k.atrasadas, k.atrasadas ? '#B45309' : '#065F46')+
          supCifra('Llamadas hoy', k.llamadas_hoy, null, k.llamadas_semana + ' semana · ' + k.llamadas_mes + ' mes')+
          supCifra('Pruebas · planes', k.pruebas_mes + ' · ' + k.planes_activos, null, 'pruebas del mes · planes activos')+
          supCifra('Calificación', k.calificacion_mes == null ? '—' : Number(k.calificacion_mes).toFixed(1), null, k.evaluadas_mes + ' evaluadas en el mes')+
          supCifra('Regresaron', k.regresados_30d, k.regresados_30d ? '#B45309' : null, 'por caducidad, 30 días')+
          supCifra('Fichas abiertas hoy', k.fichas_hoy)+
          supCifra('Comisión por pagar', dinero(k.comision_por_pagar))+
        '</div><div id="cc-adm-'+k.callcenter_id+'"></div></div>';
    }).join('') : '<p style="color:var(--gris);margin-bottom:12px">Todavía no hay callcenters.</p>')+
    '<h4 style="margin:12px 0 10px">Dar de alta un callcenter</h4>'+
    '<div class="fila"><div class="campo"><label for="cn-nom">Nombre del callcenter *</label><input id="cn-nom" maxlength="120"></div>'+
      '<div class="campo"><label for="cn-tnom">Nombre del titular *</label><input id="cn-tnom" maxlength="120"></div></div>'+
    '<div class="fila"><div class="campo"><label for="cn-tcor">Correo del titular *</label><input id="cn-tcor" type="email"></div>'+
      '<div class="campo"><label for="cn-ttel">Teléfono del titular</label><input id="cn-ttel" type="tel" maxlength="20"></div></div>'+
    '<div id="cn-aviso"></div><button class="btn btn-mor" onclick="ccAdmAlta()">Dar de alta</button>'+
    '<div class="campo" style="max-width:340px;margin-top:18px"><label for="cn-dias">Días sin gestión para que un prospecto regrese a ti</label>'+
      '<div style="display:flex;gap:8px"><input id="cn-dias" type="number" min="1" max="120" value="'+dias+'"><button class="btn btn-linea btn-sm" onclick="ccAdmDias()">Guardar</button></div><div id="cn-daviso"></div></div>';
  if(CC.abierto) ccAdmAbrir(CC.abierto);
}
function ccAdmAlta(){
  var av = $('cn-aviso');
  Nube.empresaRpc('callcenter_alta', { p_nombre:$('cn-nom').value.trim(), p_titular_correo:$('cn-tcor').value.trim(), p_titular_nombre:$('cn-tnom').value.trim(), p_titular_telefono:$('cn-ttel').value.trim() || null })
    .then(function(k){ CC.abierto = k.id; return plnCargarAdmin().then(function(){
      var t = (PLN.ops || []).filter(function(o){ return o.callcenter_id === k.id && o.es_titular; })[0];
      if(t) plnAccesoOp(t.id);
    }); })
    .catch(function(e){ av.innerHTML = plnErr(e); });
}
function ccAdmDias(){
  var n = Math.floor(Number($('cn-dias').value));
  if(!(n >= 1 && n <= 120)){ $('cn-daviso').innerHTML = '<div class="aviso aviso-error">Escribe de 1 a 120 días.</div>'; return; }
  Nube.guardarAjustes({ callcenter_dias_caducidad:n }).then(function(f){ if(f && f[0]) BD.ajustes = f[0]; guardar(); $('cn-daviso').innerHTML = '<div class="aviso aviso-ok">Guardado.</div>'; })
    .catch(function(e){ $('cn-daviso').innerHTML = plnErr(e); });
}
function ccAdmEstado(id, si){
  var k = CC.lista.filter(function(x){ return x.id === id; })[0];
  if(!si && !confirm('¿Desactivar «' + (k ? k.nombre : 'este callcenter') + '»? Nadie de su equipo podrá entrar y TODOS sus prospectos regresan a ti (las comisiones ya generadas no cambian).')) return;
  Nube.empresaRpc('callcenter_estado', { p_callcenter:id, p_activo:si }).then(function(n){
    if(!si) alert('Callcenter desactivado. Regresaron ' + (n || 0) + ' prospectos a tu bolsa.');
    return plnCargarAdmin();
  }).catch(function(e){ alert(e.message); });
}
function ccAdmAbrir(id){
  CC.abierto = id;
  var caja = $('cc-adm-' + id); if(!caja) return;
  caja.innerHTML = '<p style="color:var(--gris);margin-top:12px">Cargando…</p>';
  var desde = new Date(Date.now() - 14 * 864e5).toISOString();
  var ops = (PLN.ops || []).filter(function(o){ return o.callcenter_id === id; });
  var uids = ops.map(function(o){ return o.usuario_id; }).filter(Boolean);
  Promise.all([
    uids.length ? Nube.tabla('prospecto_contactos?select=id,prospecto_id,fecha,resultado,resumen,creado_por,grabacion,contacto_nombre&canal=eq.llamada&creado_por=in.(' + uids.join(',') + ')&fecha=gte.' + encodeURIComponent(desde) + '&order=fecha.desc&limit=600') : Promise.resolve([]),
    ops.length ? Nube.tabla('llamada_evaluaciones?select=*&operador_id=in.(' + ops.map(function(o){ return o.id; }).join(',') + ')&order=creado_en.desc&limit=2000') : Promise.resolve([]),
    Nube.tabla('callcenter_movimientos?select=*&callcenter_id=eq.' + id + '&order=fecha.desc&limit=60'),
    Nube.tabla('prospectos?select=id,nombre,nombre_corto&callcenter_id=eq.' + id + '&order=id&limit=5000'),
    Nube.tabla('callcenter_metas?select=*'),
    /* Llamadas a alumnos (etapa 2); si aún no existe la tabla, no pasa nada. */
    uids.length ? Nube.tabla('alumnos_contactos?select=id,persona_id,fecha,resultado,resumen,creado_por,grabacion&canal=eq.llamada&creado_por=in.(' + uids.join(',') + ')&fecha=gte.' + encodeURIComponent(desde) + '&order=fecha.desc&limit=600').catch(function(){ return []; }) : Promise.resolve([]),
    Nube.tabla('alumnos_prospectos?select=id,nombre,correo,telefono&callcenter_id=eq.' + id + '&order=id&limit=10000').catch(function(){ return []; })
  ]).then(function(r){
    var llam = (r[0] || []).concat(r[5] || []).sort(function(a, b){ return new Date(b.fecha) - new Date(a.fecha); });
    var evals = (r[1] || []).map(function(e){ if(!e.contacto_id && e.alumno_contacto_id) e.contacto_id = e.alumno_contacto_id; return e; });
    var pros = (r[3] || []).concat((r[6] || []).map(function(p){ return { id:p.id, nombre:p.nombre || p.correo || p.telefono || 'Persona' }; }));
    CC.adm = { ops:ops, llam:llam, evals:evals, mov:r[2] || [], pros:pros, metas:r[4] || [] };
    var c = $('cc-adm-' + id); if(!c) return;
    c.innerHTML = '<h4 style="margin:16px 0 8px">Su gente</h4>'+
      '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Nombre</th><th>Cuenta</th><th>Descuento máx.</th><th>Calificación</th><th></th></tr></thead><tbody>'+
      ops.map(function(o){ var pr = ccPromedio(CC.adm.evals, o.id);
        return '<tr><td><b>'+esc(o.nombre)+'</b>'+(o.es_titular ? ' <span class="etiqueta tur">Titular</span>' : '')+(o.activo ? '' : ' <span class="etiqueta gris">Inactivo</span>')+'<br><small>'+esc(o.correo)+(o.telefono ? ' · '+esc(o.telefono) : '')+'</small></td>'+
          '<td>'+(o.usuario_id ? '<span class="etiqueta ok">Activa</span>' : '<span class="etiqueta alerta">Falta que se registre</span>')+'</td>'+
          '<td>'+Number(o.descuento_max)+'%</td><td>'+(pr ? '<b>'+pr+'</b> / 5' : '—')+'</td>'+
          '<td style="white-space:nowrap"><button class="btn btn-fantasma btn-sm" onclick="plnEditarOp(\''+o.id+'\')">Editar</button> '+
            (o.es_titular ? '<button class="btn btn-fantasma btn-sm" onclick="plnAccesoOp(\''+o.id+'\')">Enviar acceso</button>' :
              (o.activo ? '<button class="btn btn-fantasma btn-sm" onclick="ccAdmTitular(\''+id+'\',\''+o.id+'\')">Hacer titular</button>' : ''))+'</td></tr>';
      }).join('')+'</tbody></table></div></div>'+
      '<p style="color:var(--gris);font-size:.85rem;margin-top:6px">«Editar» te deja desactivar a cualquiera. El recibo de comisiones del callcenter sale a nombre de su titular, con la cuenta que él registre.</p>'+
      '<h4 style="margin:16px 0 8px">Auditoría de llamadas</h4>'+ccTablaEval(CC.adm.llam, CC.adm.evals, CC.adm.pros, ops, 'auditoria')+
      '<h4 style="margin:16px 0 8px">Movimientos</h4>'+ccTablaMov(CC.adm.mov, CC.adm.pros);
  }).catch(function(e){ var c = $('cc-adm-' + id); if(c) c.innerHTML = plnErr(e); });
}
function ccAdmTitular(cc, op){
  if(!confirm('¿Hacer titular a ' + ccNombreOp(op) + '? El titular actual queda como agente. Desde el próximo recibo, las comisiones del callcenter salen a nombre del nuevo titular.')) return;
  Nube.empresaRpc('callcenter_cambiar_titular', { p_callcenter:cc, p_operador:op }).then(function(){ return plnCargarAdmin(); }).catch(function(e){ alert(e.message); });
}

/* ============================================================================
   Administración → Prospectos: mandar lotes a un callcenter
   ========================================================================== */
var _prCargarCC = prCargar;
prCargar = function(){
  var ccs = llEsAdmin() ? Nube.tabla('callcenters?select=*&order=nombre.asc').catch(function(){ return []; }) : null;
  return _prCargarCC().then(function(){
    if(!ccs) return;
    return ccs.then(function(r){ CC.lista = r || []; ccFiltroCallcenter(); });
  });
};
function ccNombreCC(id){ var k = CC.lista.filter(function(x){ return x.id === id; })[0]; return k ? k.nombre : 'Callcenter'; }
function ccFiltroCallcenter(){
  if(!CC.lista.length || !window.PR_FILTROS || !PR_FILTROS.op) return;
  var ops = PR_FILTROS.op.ops.filter(function(x){ return String(x[0]).indexOf('cc:') !== 0; });
  PR_FILTROS.op.ops = ops.concat(CC.lista.map(function(k){ return ['cc:' + k.id, '📞 ' + k.nombre, function(p){ return p.callcenter_id === k.id; }]; }));
}
var _prCanalesTxtCC = prCanalesTxt;
prCanalesTxt = function(p){
  var h = _prCanalesTxtCC(p);
  if(llEsAdmin() && p.callcenter_id) h += '<div style="font-size:.8rem;margin-top:3px">📞 '+esc(ccNombreCC(p.callcenter_id))+(p.asignado_a ? '' : ' (por repartir)')+'</div>';
  return h;
};
var _prPintarTablaCC = prPintarTabla;
prPintarTabla = function(){
  _prPintarTablaCC();
  var sel = $('pr-asig'); if(!sel || !llEsAdmin()) return;
  ccOpcionesAsignar(sel);
};
function ccOpcionesAsignar(sel){
  /* Los operadores de callcenter llevan el nombre de su callcenter, y cada callcenter activo es una opción (su bolsa). */
  Array.prototype.forEach.call(sel.options, function(op){
    var o = (LL.ops || []).filter(function(x){ return x.id === op.value; })[0];
    if(o && o.callcenter_id && op.textContent.indexOf('·') < 0) op.textContent += ' · ' + ccNombreCC(o.callcenter_id);
  });
  var act = CC.lista.filter(function(k){ return k.activo; });
  if(act.length && !sel.querySelector('optgroup')){
    var g = document.createElement('optgroup'); g.label = 'Bolsa de un callcenter (lo reparte su titular)';
    act.forEach(function(k){ var o = document.createElement('option'); o.value = 'cc:' + k.id; o.textContent = '📞 ' + k.nombre; g.appendChild(o); });
    sel.appendChild(g);
  }
}
var _llAsignarCC = llAsignar;
llAsignar = function(si){
  var v = si && $('pr-asig') ? $('pr-asig').value : '';
  if(v.indexOf('cc:') !== 0) return _llAsignarCC(si);
  var cc = v.slice(3), ids = Object.keys(PR.sel).filter(function(k){ return PR.sel[k]; });
  if(!confirm('¿Mandar '+ids.length+' empresa(s) a la bolsa de «'+ccNombreCC(cc)+'»? Su titular las reparte entre sus agentes y dejan de verlas tus operadores. '+
      'Si alguna ya es cliente, su plan pasa al agente cuando el titular se la asigne.')) return;
  Nube.empresaRpc('asignar_a_callcenter', { p_ids:ids, p_callcenter:cc }).then(function(n){
    PR.lista.forEach(function(p){ if(ids.indexOf(p.id) >= 0){ p.asignado_a = null; p.callcenter_id = cc; } });
    PR.sel = {}; prPintarFiltros(); prPintarTabla();
    alert('Enviadas a ' + ccNombreCC(cc) + ': ' + n + (n < ids.length ? ' (las demás ya estaban ahí)' : ''));
  }).catch(function(e){ alert(e.message); });
};
/* Ficha del prospecto: el selector de operador también ofrece la bolsa de cada callcenter. */
var _prPintarFichaCC = prPintarFicha;
prPintarFicha = function(id){
  _prPintarFichaCC(id);
  var sel = $('pf-op-sel'), p = prPorId(id); if(!sel || !p || !llEsAdmin()) return;
  ccOpcionesAsignar(sel);
  if(p.callcenter_id && !p.asignado_a) sel.value = 'cc:' + p.callcenter_id;
  if(p.callcenter_id) $('pf-op').insertAdjacentHTML('beforeend', '<small style="color:var(--gris)">📞 Es de «'+esc(ccNombreCC(p.callcenter_id))+'»'+(p.asignado_a ? '' : ', por repartir')+'. «Sin asignar» lo regresa a ti.</small>');
};
var _llReasignarUnoCC = llReasignarUno;
llReasignarUno = function(id, sel){
  if(String(sel.value).indexOf('cc:') !== 0) return _llReasignarUnoCC(id, sel);
  var p = prPorId(id), cc = sel.value.slice(3);
  if(!confirm('¿Mandar ' + prCorto(p) + ' a la bolsa de «' + ccNombreCC(cc) + '»? Su titular la reparte.')){ prPintarFicha(id); return; }
  Nube.empresaRpc('asignar_a_callcenter', { p_ids:[id], p_callcenter:cc }).then(function(){
    PR.lista.forEach(function(x){ if(x.id === id){ x.asignado_a = null; x.callcenter_id = cc; } });
    prPintarFicha(id);
  }).catch(function(e){ alert(e.message); prPintarFicha(id); });
};
