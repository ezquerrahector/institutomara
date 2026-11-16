/* Instituto Mara — Reparto de comisiones del callcenter (16 nov 2026).
   · Titular → «Mi equipo» → «Comisiones de mis agentes»: enciende el reparto, pone el
     porcentaje de SU comisión que le toca a cada agente (general o por agente) y decide si
     sus agentes pueden ver lo que les toca. Instituto Mara le paga al titular; el titular
     les paga a sus agentes. La plataforma solo calcula y, si se permite, se los muestra.
   · Agente → «Mis comisiones» (solo si su titular lo permite). */

var REP = { agente:null };

/* ---------- Titular ---------- */
var _vistaCCEquipoRep = vistaCCEquipo;
vistaCCEquipo = function(){
  return _vistaCCEquipoRep().replace('<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:6px">Evaluar llamadas</h3>',
    '<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:6px">Comisiones de mis agentes</h3><div id="cc-reparto">Cargando…</div></div>'+
    '<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:6px">Evaluar llamadas</h3>');
};
var _ccCargarEquipoRep = ccCargarEquipo;
ccCargarEquipo = function(){
  return Promise.resolve(_ccCargarEquipoRep()).then(function(){
    if(!CC.datos) return;
    return Nube.tabla('operadores?select=id,reparto_pct&callcenter_id=eq.' + CC.datos.cc.id).then(function(l){
      (l || []).forEach(function(x){ var o = CC.datos.ops.filter(function(y){ return y.id === x.id; })[0]; if(o) o.reparto_pct = x.reparto_pct; });
      repPintar();
    }).catch(function(){ repPintar(); });
  });
};
function repPct(o){ var k = CC.datos.cc; return o.reparto_pct != null ? Number(o.reparto_pct) : Number(k.reparto_pct || 0); }
function repPintar(){
  var caja = $('cc-reparto'), d = CC.datos; if(!caja || !d) return;
  var k = d.cc, on = !!k.reparto_activo;
  var agentes = d.ops.filter(function(o){ return !o.es_titular && !o.archivado; });
  var met = function(id){ return d.met.filter(function(m){ return m.operador_id === id; })[0] || {}; };
  caja.innerHTML = '<p style="color:var(--gris);font-size:.92rem;margin-bottom:12px">Instituto Mara te paga a ti las comisiones de todo tu equipo. Aquí decides cuánto de eso le toca a cada agente. '+
      'La plataforma lo calcula; el pago a tus agentes lo haces tú.</p>'+
    '<label style="display:flex;gap:8px;align-items:center;margin-bottom:10px;font-weight:600"><input type="checkbox" id="rp-act" style="width:auto;margin:0"'+(on ? ' checked' : '')+' onchange="repMostrar()"> Repartir comisión a mis agentes</label>'+
    '<div id="rp-cuerpo"'+(on ? '' : ' hidden')+'>'+
      '<div class="fila"><div class="campo" style="max-width:260px"><label for="rp-pct">De tu comisión, ¿cuánto le toca a cada agente? (%)</label><input id="rp-pct" type="number" min="0" max="100" step="1" value="'+Number(k.reparto_pct || 0)+'"></div></div>'+
      '<label style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><input type="checkbox" id="rp-ven" style="width:auto;margin:0"'+(k.agentes_ven_comision ? ' checked' : '')+'> Mis agentes pueden ver lo que les toca (en su menú «Mis comisiones»)</label>'+
    '</div>'+
    '<div id="rp-aviso"></div><button class="btn btn-mor btn-sm" onclick="repGuardar()">Guardar</button>'+
    (on && agentes.length ? '<div class="tabla-caja" style="margin-top:16px"><div class="tabla-scroll"><table><thead><tr><th>Agente</th><th>Su porcentaje</th><th>Tu comisión por sus ventas (mes)</th><th>Le toca (mes)</th><th></th></tr></thead><tbody>'+
      agentes.map(function(o){ var m = met(o.id), pct = repPct(o), com = Number(m.comision_mes || 0);
        return '<tr><td><b>'+esc(o.nombre)+'</b></td>'+
          '<td><input id="rp-a-'+o.id+'" type="number" min="0" max="100" style="max-width:90px" placeholder="'+Number(k.reparto_pct || 0)+'" value="'+(o.reparto_pct != null ? Number(o.reparto_pct) : '')+'"> %'+
            '<br><small style="color:var(--gris)">Vacío = el general</small></td>'+
          '<td>'+dinero(com)+'</td><td><b>'+dinero(Math.round(com * pct) / 100)+'</b></td>'+
          '<td><button class="btn btn-linea btn-sm" onclick="repGuardarAgente(\''+o.id+'\')">Guardar</button></td></tr>'; }).join('')+
      '</tbody></table></div></div><p style="color:var(--gris);font-size:.85rem;margin-top:6px">«Le toca» se calcula sobre la comisión que ya te generó en el mes. Si hay un reembolso, se ajusta solo.</p>' : '');
}
function repMostrar(){ var c = $('rp-cuerpo'); if(c) c.hidden = !$('rp-act').checked; }
function repGuardar(){
  var act = $('rp-act').checked, pct = Number($('rp-pct').value), ven = $('rp-ven').checked, av = $('rp-aviso');
  if(act && !(pct >= 0 && pct <= 100)){ av.innerHTML = '<div class="aviso aviso-error">El porcentaje va de 0 a 100.</div>'; return; }
  Nube.empresaRpc('callcenter_reparto_guardar', { p_activo:act, p_pct:act ? pct : Number(CC.datos.cc.reparto_pct || 0), p_agentes_ven:act && ven })
    .then(function(k){ if(k) CC.datos.cc = Object.assign(CC.datos.cc, k); repPintar(); var a = $('rp-aviso'); if(a) a.innerHTML = '<div class="aviso aviso-ok">Guardado.</div>'; })
    .catch(function(e){ av.innerHTML = plnErr(e); });
}
function repGuardarAgente(id){
  var v = $('rp-a-' + id).value, pct = v === '' ? null : Number(v);
  if(pct != null && !(pct >= 0 && pct <= 100)){ alert('El porcentaje va de 0 a 100.'); return; }
  Nube.empresaRpc('callcenter_agente_reparto', { p_operador:id, p_pct:pct })
    .then(function(){ var o = CC.datos.ops.filter(function(x){ return x.id === id; })[0]; if(o) o.reparto_pct = pct; repPintar(); })
    .catch(function(e){ alert(e.message); });
}

/* ---------- Agente ---------- */
var _pintarNavRep = pintarNav;
pintarNav = function(){
  _pintarNavRep();
  if(!esAgenteCC() || !REP.agente || !REP.agente.visible) return;
  var nav = $('nav');
  if(!nav.querySelector('button[data-v="cc-mis-com"]')){
    var b = document.createElement('button'); b.setAttribute('data-v', 'cc-mis-com'); b.textContent = 'Mis comisiones';
    b.onclick = function(){ ir('cc-mis-com'); };
    var p = nav.querySelector('button[data-v="mi-perfil"]'); if(p) nav.insertBefore(b, p); else nav.appendChild(b);
  }
};
var _entrarAppRep = entrarApp;
entrarApp = function(){
  _entrarAppRep.apply(this, arguments);
  if(!esOperador()) return;
  ccAsegurarOp().then(function(o){
    if(!o || !o.callcenter_id || o.es_titular) return;
    return Nube.empresaRpc('agente_mis_comisiones', {}).then(function(r){ REP.agente = r || null; pintarNav(); });
  }).catch(function(){});
};
var _pintarRep = pintar;
pintar = function(){
  if(estado.vista === 'cc-mis-com' && esAgenteCC()){
    $('vista').innerHTML = repVistaAgente();
    var bs = $('nav').querySelectorAll('button');
    for(var i=0;i<bs.length;i++) bs[i].classList.toggle('activa', bs[i].getAttribute('data-v') === 'cc-mis-com');
    return;
  }
  _pintarRep();
};
function repVistaAgente(){
  var r = REP.agente || {};
  if(!r.visible) return '<div class="seccion"><div class="tarjeta vacio"><p>Tu titular no ha activado esta sección.</p></div></div>';
  var l = r.ventas || [], suma = function(est){ return l.filter(function(v){ return v.estado === est; }).reduce(function(a, v){ return a + Number(v.mi_parte || 0); }, 0); };
  var mes = new Date(); mes.setDate(1); mes.setHours(0,0,0,0);
  var delMes = l.filter(function(v){ return v.estado !== 'cancelada' && new Date(v.fecha) >= mes; }).reduce(function(a, v){ return a + Number(v.mi_parte || 0); }, 0);
  return '<div class="seccion"><h2>Mis comisiones</h2><p class="sub">Te toca el <b>'+Number(r.pct)+' %</b> de lo que tus ventas le generan a tu callcenter. Te paga tu titular.</p>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 16px">'+supCifra('Este mes', dinero(delMes))+supCifra('Por cobrar', dinero(suma('por cobrar')))+supCifra('En recibo', dinero(suma('en recibo')))+'</div>'+
    (l.length ? '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Fecha</th><th>Venta</th><th>Te toca</th><th>Estado</th></tr></thead><tbody>'+
      l.map(function(v){ return '<tr><td>'+esc(new Date(v.fecha).toLocaleDateString('es-MX'))+'</td><td>'+esc(v.concepto || (v.tipo === 'alumno' ? 'Venta a alumno' : 'Plan de empresa'))+'</td>'+
        '<td>'+dinero(v.mi_parte)+'</td><td>'+esc(v.estado === 'cancelada' ? 'Cancelada (reembolso)' : v.estado === 'en recibo' ? 'En recibo de tu titular' : 'Por cobrar')+'</td></tr>'; }).join('')+
      '</tbody></table></div></div>' : '<div class="tarjeta vacio"><p>Todavía no tienes ventas con comisión. Cuando una persona o empresa que llamaste pague, aparece aquí.</p></div>')+'</div>';
}
