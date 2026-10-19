/* Instituto Mara — Planes mensuales para empresas y rol de operador (19 oct 2026).
   Se carga al final: reemplaza o envuelve funciones del aula con el mismo nombre.
   Requiere backend/planes-operadores-20261019.sql y la función «tienda» con las
   acciones plan_liga y plan_cancelar.

   · Administración → «Planes y operadores»: tabla de rangos (precio y comisión),
     reglas, alta de operadores, aprobación de descuentos y lista de planes.
   · Ficha de la empresa: crear el plan, generar la liga de pago, lugares.
   · «Mi empresa»: el administrador de la empresa ve su plan y reparte lugares.
   · Alumno con lugar en un plan: todo el catálogo (sin rutas), como una membresía. */

var PLN = { rangos:null, ops:[], todos:[], empresas:[], comis:[], porEmpresa:{}, lugares:{}, miOp:null };
var PLN_ESTADO = { por_aprobar:'Espera aprobación', rechazado:'Descuento rechazado', pendiente_pago:'Esperando pago', activo:'Activo',
  cancelado:'Cancelado', vencido:'Vencido' };
var PLN_COLOR = { por_aprobar:'alerta', rechazado:'error', pendiente_pago:'alerta', activo:'ok', cancelado:'gris', vencido:'gris' };

function esOperador(){ return !!(sesion && sesion.rol === 'operador'); }
function plnErr(e, extra){ return '<div class="aviso aviso-error">'+esc(e && e.message || e)+(extra ? '<br><small>'+extra+'</small>' : '')+'</div>'; }
var PLN_FALTA_SQL = 'Si dice que no existe la tabla o la función, falta ejecutar backend/planes-operadores-20261019.sql en Supabase.';

/* ---------- Datos y cálculos ---------- */
function plnCargarRangos(forzar){
  if(PLN.rangos && !forzar) return Promise.resolve(PLN.rangos);
  return Nube.tabla('planes_rangos?select=*&order=desde.asc').then(function(r){ PLN.rangos = r || []; return PLN.rangos; });
}
function plnRangoDe(n){
  return (PLN.rangos||[]).filter(function(r){ return r.activo && r.desde <= n && (r.hasta == null || r.hasta >= n); })[0] || null;
}
function plnRangoTxt(r){ return r.hasta == null ? 'Más de ' + (r.desde - 1) + ' personas' : r.desde + ' a ' + r.hasta + ' personas'; }
function plnMesesAnual(){ return Number(ajuste('plan_meses_anual', 10)) || 10; }
function plnDescMax(){ return Number(ajuste('plan_desc_max_operador', 10)); }
function plnDescMeses(){ return Number(ajuste('plan_desc_meses', 3)) || 3; }
/* Comisión aproximada: supone que Mercado Pago retiene alrededor de 4 %. La real
   se calcula con lo que deposita Mercado Pago en cada pago. */
function plnComisionAprox(monto, pct){
  var neto = monto * 0.96, iva = monto * 0.16 / 1.16;
  return Math.max(0, neto - iva) * pct / 100;
}
function plnPrecioTxt(p){
  if(Number(p.descuento_pct) > 0){
    return p.periodo === 'mensual'
      ? dinero(p.monto_inicial) + ' al mes los primeros ' + p.descuento_meses + ' meses (' + Number(p.descuento_pct) + '% de descuento), después ' + dinero(p.precio_lista) + ' al mes'
      : dinero(p.monto_inicial) + ' por 12 meses (' + Number(p.descuento_pct) + '% de descuento)';
  }
  return p.periodo === 'mensual' ? dinero(p.precio_lista) + ' al mes' : dinero(p.precio_lista) + ' por 12 meses';
}
function plnFecha(iso){ return iso ? fechaLarga(String(iso).slice(0,10)) : '—'; }
function plnVigente(p){ return p && (p.estado === 'activo' || p.estado === 'cancelado') && p.vigente_hasta && new Date(p.vigente_hasta) >= new Date(); }
function plnOperador(id){ return (PLN.ops||[]).filter(function(o){ return o.id === id; })[0] || null; }
function plnTelWa(t){ var d = String(t||'').replace(/\D/g,''); return d.length === 10 ? '52' + d : d; }

/* ============================================================================
   Administración → Planes y operadores
   ========================================================================== */
function vistaAdminPlanes(){
  if(!sesion || sesion.rol !== 'admin') return '';
  setTimeout(plnCargarAdmin, 0);
  return '<div class="seccion"><div class="encabezado-fila"><div><h2>Planes y operadores</h2>'+
    '<p class="sub" style="margin:0">Plan mensual por número de personas: precios, comisión de los operadores, aprobaciones y planes contratados.</p></div></div>'+
    '<div id="pln-aprobar"></div>'+
    '<div class="tarjeta"><h3 style="color:var(--tinta);margin-bottom:6px">Tabla de planes</h3>'+
      '<p style="color:var(--gris);font-size:.92rem;margin-bottom:12px">Precio mensual con IVA incluido. Todo el catálogo de cursos y diplomados (sin rutas). '+
      'El plan anual cuesta <b>'+plnMesesAnual()+' mensualidades</b>. La comisión se calcula sobre el neto: lo que deposita Mercado Pago menos el IVA de la venta.</p>'+
      '<div id="pln-rangos">Cargando…</div></div>'+
    '<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:12px">Reglas del plan</h3><div id="pln-reglas">Cargando…</div></div>'+
    '<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:6px">Operadores</h3>'+
      '<p style="color:var(--gris);font-size:.92rem;margin-bottom:12px">Personas que llaman a los prospectos. Entran con su propia cuenta y solo ven sus prospectos asignados y sus empresas. Si aún no tienen cuenta, se activa sola cuando se registren con ese correo.</p>'+
      '<div id="pln-ops">Cargando…</div></div>'+
    '<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:12px">Planes de empresas</h3><div id="pln-planes">Cargando…</div></div>'+
    '</div>';
}
function plnCargarAdmin(){
  return Promise.all([
    plnCargarRangos(true),
    Nube.tabla('operadores?select=*&order=nombre.asc'),
    Nube.tabla('empresas_planes?select=*&order=creado_en.desc&limit=1000'),
    Nube.tabla('empresas?select=id,nombre,operador_id&order=nombre.asc'),
    Nube.tabla('comisiones?select=operador_id,monto,corte_id&limit=20000'),
    Nube.cargarAjustes(BD).catch(function(){ return null; })
  ]).then(function(r){
    PLN.ops = r[1] || []; PLN.todos = r[2] || []; PLN.empresas = r[3] || []; PLN.comis = r[4] || [];
    plnPintarAprobar(); plnPintarRangos(); plnPintarReglas(); plnPintarOps(); plnPintarPlanes();
  }).catch(function(e){ var c = $('pln-rangos'); if(c) c.innerHTML = plnErr(e, PLN_FALTA_SQL); });
}
function plnNombreEmpresa(id){ var e = (PLN.empresas||[]).filter(function(x){ return x.id === id; })[0]; return e ? e.nombre : '—'; }

function plnPintarAprobar(){
  var caja = $('pln-aprobar'); if(!caja) return;
  var l = PLN.todos.filter(function(p){ return p.estado === 'por_aprobar'; });
  if(!l.length){ caja.innerHTML = ''; return; }
  caja.innerHTML = '<div class="tarjeta" style="margin-bottom:18px;border-color:#F59E0B"><h3 style="color:var(--tinta);margin-bottom:6px">Descuentos por aprobar ('+l.length+')</h3>'+
    '<p style="color:var(--gris);font-size:.92rem;margin-bottom:12px">El operador pactó más de lo que puede dar solo. La empresa recibe su liga de pago en cuanto lo apruebes.</p>'+
    '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Empresa</th><th>Plan</th><th>Lo que se pactó</th><th>Operador</th><th></th></tr></thead><tbody>'+
    l.map(function(p){ var o = plnOperador(p.operador_id);
      return '<tr><td><b>'+esc(plnNombreEmpresa(p.empresa_id))+'</b><br><small>'+esc(fechaCortaEmp(p.creado_en))+'</small></td>'+
        '<td>'+esc(p.rango_texto)+' · '+esc(p.periodo)+'<br><small>'+esc(plnPrecioTxt(p))+'</small></td>'+
        '<td>'+esc(p.nota || '—')+'</td><td>'+esc(o ? o.nombre : '—')+'</td>'+
        '<td style="white-space:nowrap"><button class="btn btn-mor btn-sm" onclick="plnAprobar(\''+p.id+'\',true)">Aprobar</button> '+
        '<button class="btn btn-fantasma btn-sm" onclick="plnAprobar(\''+p.id+'\',false)">Rechazar</button></td></tr>';
    }).join('')+'</tbody></table></div></div></div>';
}
function plnAprobar(id, si){
  var nota = si ? '' : prompt('¿Por qué se rechaza? (lo verá el operador)', '');
  if(!si && nota === null) return;
  Nube.empresaRpc('plan_aprobar', { p_plan:id, p_aprobar:si, p_nota:nota || null })
    .then(function(){ return plnCargarAdmin(); }).catch(function(e){ alert(e.message); });
}

/* ---------- Tabla de rangos ---------- */
function plnPintarRangos(){
  var caja = $('pln-rangos'); if(!caja) return;
  var rs = PLN.rangos || [], meses = plnMesesAnual();
  caja.innerHTML = '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Personas</th><th>Precio mensual</th><th>Por persona</th><th>Anual</th>'+
    '<th>Comisión 1.er pago</th><th>Comisión mensual desde el 2.º</th><th>Activo</th></tr></thead><tbody>'+
    rs.map(function(r, i){
      var porPersona = r.hasta ? dinero(Math.round(r.precio_mensual / r.hasta)) : '—';
      var ci = plnComisionAprox(r.precio_mensual, r.comision_inicial_pct), cr = plnComisionAprox(r.precio_mensual, r.comision_recurrente_pct);
      return '<tr><td style="white-space:nowrap"><input id="pr-d-'+i+'" type="number" min="1" value="'+r.desde+'" style="width:76px"> a '+
          '<input id="pr-h-'+i+'" type="number" min="1" value="'+(r.hasta==null?'':r.hasta)+'" placeholder="sin tope" style="width:86px"></td>'+
        '<td><input id="pr-p-'+i+'" type="number" min="1" step="1" value="'+r.precio_mensual+'" style="width:110px"></td>'+
        '<td>'+porPersona+'</td><td>'+dinero(r.precio_mensual * meses)+'</td>'+
        '<td><input id="pr-ci-'+i+'" type="number" min="0" max="100" value="'+r.comision_inicial_pct+'" style="width:64px">%<br><small>≈ '+dinero(Math.round(ci))+'</small></td>'+
        '<td><input id="pr-cr-'+i+'" type="number" min="0" max="100" value="'+r.comision_recurrente_pct+'" style="width:64px">%<br><small>≈ '+dinero(Math.round(cr))+' al mes</small></td>'+
        '<td><input id="pr-a-'+i+'" type="checkbox"'+(r.activo?' checked':'')+'></td></tr>';
    }).join('')+'</tbody></table></div></div>'+
    '<p style="color:var(--gris);font-size:.85rem;margin:8px 0 12px">Las comisiones en pesos son aproximadas (suponen que Mercado Pago retiene cerca de 4 %). '+
      'En el plan anual el operador recibe el % del 1.er pago sobre cada pago anual. Los planes ya contratados conservan el precio y la comisión con que se vendieron.</p>'+
    '<div id="pr-aviso"></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="pr-btn" class="btn btn-mor" onclick="plnGuardarRangos()">Guardar tabla</button>'+
    '<button class="btn btn-linea" onclick="plnAgregarRango()">+ Agregar rango</button></div>';
}
function plnGuardarRangos(){
  var rs = PLN.rangos || [], av = $('pr-aviso'), filas = [];
  for(var i=0;i<rs.length;i++){
    var d = Math.floor(Number($('pr-d-'+i).value)), hv = $('pr-h-'+i).value.trim(), h = hv === '' ? null : Math.floor(Number(hv));
    var f = { id:rs[i].id, desde:d, hasta:h, precio_mensual:Number($('pr-p-'+i).value), comision_inicial_pct:Number($('pr-ci-'+i).value),
              comision_recurrente_pct:Number($('pr-cr-'+i).value), activo:$('pr-a-'+i).checked };
    if(!(d >= 1) || (h != null && h < d) || !(f.precio_mensual > 0)){ av.innerHTML = '<div class="aviso aviso-error">Revisa el renglón '+(i+1)+': personas y precio.</div>'; return; }
    filas.push(f);
  }
  /* Los rangos activos no deben encimarse ni dejar huecos. */
  var act = filas.filter(function(f){ return f.activo; }).sort(function(a,b){ return a.desde - b.desde; });
  for(var j=0;j<act.length;j++){
    if(j === 0 && act[j].desde !== 1){ av.innerHTML = '<div class="aviso aviso-error">El primer rango debe empezar en 1 persona.</div>'; return; }
    if(j > 0){
      var prev = act[j-1];
      if(prev.hasta == null || act[j].desde !== prev.hasta + 1){ av.innerHTML = '<div class="aviso aviso-error">Los rangos deben seguirse sin huecos ni encimarse (revisa el que empieza en '+act[j].desde+').</div>'; return; }
    }
  }
  if(act.length && act[act.length-1].hasta != null) av.innerHTML = '<div class="aviso aviso-info">Aviso: el último rango tiene tope; las empresas más grandes no podrán contratar el plan.</div>';
  var b = $('pr-btn'); b.disabled = true;
  Promise.all(filas.map(function(f){
    var o = rs.filter(function(r){ return r.id === f.id; })[0], cambio = false;
    ['desde','hasta','precio_mensual','comision_inicial_pct','comision_recurrente_pct','activo'].forEach(function(k){ if(String(o[k]) !== String(f[k])) cambio = true; });
    if(!cambio) return null;
    var c = Object.assign({}, f); delete c.id;
    return Nube.tabla('planes_rangos?id=eq.' + f.id, { metodo:'PATCH', cuerpo:c, prefer:'return=minimal' });
  })).then(function(){ return plnCargarRangos(true); })
    .then(function(){ plnPintarRangos(); $('pr-aviso').innerHTML = '<div class="aviso aviso-ok">Tabla guardada.</div>'; })
    .catch(function(e){ b.disabled = false; av.innerHTML = plnErr(e); });
}
function plnAgregarRango(){
  var rs = (PLN.rangos||[]).filter(function(r){ return r.activo; }), ult = rs[rs.length-1];
  var nuevo = { desde: ult ? (ult.hasta == null ? ult.desde + 1000 : ult.hasta + 1) : 1, hasta:null, precio_mensual: ult ? ult.precio_mensual : 1490, activo:false };
  Nube.tabla('planes_rangos', { metodo:'POST', cuerpo:nuevo, prefer:'return=minimal' })
    .then(function(){ return plnCargarRangos(true); }).then(plnPintarRangos)
    .then(function(){ $('pr-aviso').innerHTML = '<div class="aviso aviso-info">Se agregó un rango apagado al final. Ajusta las personas y el precio, márcalo como activo y guarda.</div>'; })
    .catch(function(e){ $('pr-aviso').innerHTML = plnErr(e); });
}

/* ---------- Reglas ---------- */
function plnPintarReglas(){
  var caja = $('pln-reglas'); if(!caja) return;
  caja.innerHTML = '<div class="fila">'+
    '<div class="campo"><label for="rg-anual">El plan anual cuesta (mensualidades)</label><input id="rg-anual" type="number" min="1" max="12" value="'+plnMesesAnual()+'"></div>'+
    '<div class="campo"><label for="rg-desc">Descuento que el operador da sin pedir permiso (%)</label><input id="rg-desc" type="number" min="0" max="100" value="'+plnDescMax()+'"></div>'+
    '<div class="campo"><label for="rg-meses">Meses que dura ese descuento</label><input id="rg-meses" type="number" min="1" max="12" value="'+plnDescMeses()+'"></div>'+
    '<div class="campo"><label for="rg-const">Pagos para liberar constancias de diplomado</label><input id="rg-const" type="number" min="1" max="12" value="'+Number(ajuste('plan_pagos_constancia_dip',2))+'"></div></div>'+
    '<div id="rg-aviso"></div><button class="btn btn-mor" onclick="plnGuardarReglas()">Guardar reglas</button>';
}
function plnGuardarReglas(){
  var c = { plan_meses_anual:Math.floor(Number($('rg-anual').value)), plan_desc_max_operador:Number($('rg-desc').value),
            plan_desc_meses:Math.floor(Number($('rg-meses').value)), plan_pagos_constancia_dip:Math.floor(Number($('rg-const').value)) };
  if(!(c.plan_meses_anual >= 1 && c.plan_meses_anual <= 12) || !(c.plan_desc_max_operador >= 0 && c.plan_desc_max_operador <= 100) ||
     !(c.plan_desc_meses >= 1) || !(c.plan_pagos_constancia_dip >= 1)){ $('rg-aviso').innerHTML = '<div class="aviso aviso-error">Revisa los valores.</div>'; return; }
  Nube.guardarAjustes(c).then(function(f){ if(f && f[0]) BD.ajustes = f[0]; guardar(); $('rg-aviso').innerHTML = '<div class="aviso aviso-ok">Guardado.</div>'; plnPintarRangos(); })
    .catch(function(e){ $('rg-aviso').innerHTML = plnErr(e); });
}

/* ---------- Operadores ---------- */
function plnPintarOps(){
  var caja = $('pln-ops'); if(!caja) return;
  var porPagar = function(id){ return PLN.comis.filter(function(c){ return c.operador_id === id && !c.corte_id; }).reduce(function(a,c){ return a + Number(c.monto||0); }, 0); };
  var empresas = function(id){ return PLN.empresas.filter(function(e){ return e.operador_id === id; }).length; };
  caja.innerHTML = (PLN.ops.length ? '<div class="tabla-caja" style="margin-bottom:14px"><div class="tabla-scroll"><table><thead><tr><th>Operador</th><th>Teléfono</th><th>Cuenta</th><th>Empresas</th><th>Comisión por pagar</th><th></th></tr></thead><tbody>'+
    PLN.ops.map(function(o){
      return '<tr><td><b>'+esc(o.nombre)+'</b><br><small>'+esc(o.correo)+'</small>'+(o.activo?'':' <span class="etiqueta gris">Inactivo</span>')+'</td>'+
        '<td>'+esc(o.telefono||'—')+'</td>'+
        '<td>'+(o.usuario_id ? '<span class="etiqueta ok">Activa</span>' : '<span class="etiqueta alerta">Falta que se registre</span>')+'</td>'+
        '<td>'+empresas(o.id)+'</td><td>'+dinero(porPagar(o.id))+'</td>'+
        '<td style="white-space:nowrap"><button class="btn btn-fantasma btn-sm" onclick="plnEditarOp(\''+o.id+'\')">Editar</button> '+
        '<button class="btn btn-fantasma btn-sm" onclick="plnAccesoOp(\''+o.id+'\')">Enviar acceso</button></td></tr>';
    }).join('')+'</tbody></table></div></div>' : '<p style="color:var(--gris);margin-bottom:12px">Todavía no hay operadores.</p>')+
    '<h4 style="margin:6px 0 10px">Dar de alta un operador</h4>'+
    '<div class="fila"><div class="campo"><label for="op-cor">Correo *</label><input id="op-cor" type="email"></div>'+
    '<div class="campo"><label for="op-nom">Nombre *</label><input id="op-nom" maxlength="120"></div>'+
    '<div class="campo"><label for="op-tel">Teléfono (el que deja en los recados)</label><input id="op-tel" type="tel" maxlength="20"></div></div>'+
    '<div id="op-aviso"></div><button class="btn btn-mor" onclick="plnAltaOp()">Dar de alta</button>';
}
function plnAltaOp(){
  var av = $('op-aviso');
  Nube.empresaRpc('operador_alta', { p_correo:$('op-cor').value.trim(), p_nombre:$('op-nom').value.trim(), p_telefono:$('op-tel').value.trim() })
    .then(function(f){ return plnCargarAdmin().then(function(){ plnAccesoOp(f.id); }); })
    .catch(function(e){ av.innerHTML = plnErr(e); });
}
function plnEditarOp(id){
  var o = plnOperador(id); if(!o) return;
  abrirModal('Operador: ' + o.nombre,
    '<div class="fila"><div class="campo"><label for="eo-nom">Nombre</label><input id="eo-nom" maxlength="120" value="'+esc(o.nombre)+'"></div>'+
    '<div class="campo"><label for="eo-tel">Teléfono</label><input id="eo-tel" type="tel" value="'+esc(o.telefono||'')+'"></div></div>'+
    '<div class="campo"><label for="eo-desc">Descuento que puede dar sin pedir permiso (%)</label><input id="eo-desc" type="number" min="0" max="100" value="'+esc(o.descuento_max)+'">'+
      '<small style="color:var(--gris)">Nunca rebasa la regla general ('+plnDescMax()+'%).</small></div>'+
    '<div class="campo"><label for="eo-notas">Notas internas</label><textarea id="eo-notas" rows="2">'+esc(o.notas||'')+'</textarea></div>'+
    '<label style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><input type="checkbox" id="eo-act"'+(o.activo?' checked':'')+'> Activo (si lo apagas, deja de ver sus prospectos y empresas; sus comisiones se conservan)</label><div id="eo-aviso"></div>',
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cancelar</button><button class="btn btn-mor" onclick="plnGuardarOp(\''+id+'\')">Guardar</button>');
}
function plnGuardarOp(id){
  var c = { nombre:$('eo-nom').value.trim(), telefono:$('eo-tel').value.replace(/\D/g,'') || null, descuento_max:Math.max(0, Math.min(100, Number($('eo-desc').value)||0)),
            notas:$('eo-notas').value.trim() || null, activo:$('eo-act').checked };
  if(!c.nombre){ $('eo-aviso').innerHTML = '<div class="aviso aviso-error">Escribe el nombre.</div>'; return; }
  Nube.tabla('operadores?id=eq.' + id, { metodo:'PATCH', cuerpo:c, prefer:'return=minimal' })
    .then(function(){ cerrarModal(); return plnCargarAdmin(); }).catch(function(e){ $('eo-aviso').innerHTML = plnErr(e); });
}
function plnAccesoOp(id){
  var o = plnOperador(id); if(!o) return;
  var enlace = location.origin + location.pathname;
  var t = 'Hola ' + o.nombre.split(' ')[0] + ', ya tienes tu acceso de operador en Instituto Mara. Ahí verás tus empresas por llamar, el guion de cada llamada y tus comisiones.\n\n' +
    (o.usuario_id ? '👉 Entra con tu cuenta (' + o.correo + ') aquí: ' : '👉 Crea tu cuenta con este mismo correo (' + o.correo + ') y verás tu panel de operador: ') + enlace;
  abrirModal('Enviar acceso a ' + o.nombre,
    '<p style="margin-bottom:10px">Mándale este mensaje:</p><textarea id="oa-txt" rows="7" style="width:100%">'+esc(t)+'</textarea>',
    '<button class="btn btn-fantasma" onclick="copiarTexto($(\'oa-txt\').value)">Copiar</button>'+
    '<button id="oa-correo" class="btn btn-linea" onclick="plnAccesoOpCorreo(\''+id+'\')">Enviar por correo</button>'+
    '<button class="btn btn-mor" onclick="window.open(\'https://wa.me/'+plnTelWa(o.telefono)+'?text=\'+encodeURIComponent($(\'oa-txt\').value),\'_blank\',\'noopener\')">WhatsApp</button>');
}
function plnAccesoOpCorreo(id){
  var o = plnOperador(id), b = $('oa-correo'); if(!o) return;
  b.disabled = true; b.textContent = 'Enviando…';
  Nube.funcionServidor('prospectos', { accion:'correo', para:o.correo, asunto:'Tu acceso de operador · Instituto Mara', texto:$('oa-txt').value })
    .then(function(){ b.textContent = 'Enviado ✓'; })
    .catch(function(e){ b.disabled = false; b.textContent = 'Enviar por correo'; alert('No se pudo enviar: ' + e.message); });
}

/* ---------- Lista de planes ---------- */
function plnPintarPlanes(){
  var caja = $('pln-planes'); if(!caja) return;
  var l = PLN.todos.filter(function(p){ return p.estado !== 'rechazado' && !(p.estado === 'cancelado' && !p.pagos_aprobados); });
  if(!l.length){ caja.innerHTML = '<p style="color:var(--gris)">Aún no hay planes. Se crean desde la ficha de cada empresa (Empresas → Abrir).</p>'; return; }
  var activos = l.filter(function(p){ return p.estado === 'activo'; });
  var mensual = activos.reduce(function(a,p){ return a + (p.periodo === 'mensual' ? Number(p.pagos_aprobados <= p.descuento_meses ? p.monto_inicial : p.precio_lista) : Number(p.precio_lista) / 12); }, 0);
  caja.innerHTML = '<div class="rejilla rejilla-4" style="margin-bottom:16px">'+
      '<div class="metrica"><div class="rot">Planes activos</div><div class="val">'+activos.length+'</div></div>'+
      '<div class="metrica"><div class="rot">Ingreso mensual</div><div class="val">'+dinero(Math.round(mensual))+'</div><div class="pie">el anual cuenta como 1/12</div></div>'+
      '<div class="metrica"><div class="rot">Esperando pago</div><div class="val">'+l.filter(function(p){ return p.estado === 'pendiente_pago'; }).length+'</div></div>'+
      '<div class="metrica"><div class="rot">Por aprobar</div><div class="val">'+l.filter(function(p){ return p.estado === 'por_aprobar'; }).length+'</div></div></div>'+
    '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Empresa</th><th>Plan</th><th>Estado</th><th>Pagos</th><th>Vigente hasta</th><th>Operador</th><th></th></tr></thead><tbody>'+
    l.map(function(p){ var o = plnOperador(p.operador_id);
      return '<tr><td><b>'+esc(plnNombreEmpresa(p.empresa_id))+'</b></td><td>'+esc(p.rango_texto)+' · '+esc(p.periodo)+'<br><small>'+esc(plnPrecioTxt(p))+'</small></td>'+
        '<td><span class="etiqueta '+(PLN_COLOR[p.estado]||'gris')+'">'+esc(PLN_ESTADO[p.estado]||p.estado)+'</span></td><td>'+p.pagos_aprobados+'</td>'+
        '<td>'+esc(p.vigente_hasta ? fechaCortaEmp(p.vigente_hasta) : '—')+'</td><td>'+esc(o ? o.nombre : '—')+'</td>'+
        '<td><button class="btn btn-linea btn-sm" onclick="ir(\'admin-empresa\',{empresaId:\''+p.empresa_id+'\'})">Abrir</button></td></tr>';
    }).join('')+'</tbody></table></div></div>';
}

/* ============================================================================
   Plan en la ficha de la empresa (administración u operador) y en «Mi empresa»
   ========================================================================== */
function plnCajaEmpresa(){ return '<div class="tarjeta no-imprimir" id="emp-plan" style="margin-top:18px">Cargando plan…</div>'; }
function plnCargarEmpresa(id, modo){
  var pasos = [ plnCargarRangos(), Nube.tabla('empresas_planes?select=*&empresa_id=eq.' + id + '&order=creado_en.desc&limit=50') ];
  if(modo === 'admin' && !(PLN.ops && PLN.ops.length)) pasos.push(Nube.tabla('operadores?select=*&order=nombre.asc').then(function(o){ PLN.ops = o || []; }));
  return Promise.all(pasos).then(function(r){
    PLN.porEmpresa[id] = r[1] || [];
    var p = plnActual(id);
    return p && p.estado !== 'por_aprobar' && p.estado !== 'rechazado'
      ? Nube.empresaRpc('plan_lugares', { p_plan:p.id }).then(function(l){ PLN.lugares[p.id] = l || []; })
      : null;
  }).then(function(){ plnPintarEmpresa(id, modo); })
    .catch(function(e){ var c = $('emp-plan'); if(c) c.innerHTML = '<h3 style="color:var(--tinta);margin-bottom:8px">Plan mensual</h3>' + plnErr(e, modo === 'empresa' ? '' : PLN_FALTA_SQL); });
}
/* El plan que importa ahora: el vigente; si no, el último que espera pago o aprobación. */
function plnActual(id){
  var l = PLN.porEmpresa[id] || [];
  return l.filter(plnVigente)[0] ||
    l.filter(function(p){ return p.estado === 'pendiente_pago' || p.estado === 'por_aprobar'; })[0] ||
    l.filter(function(p){ return p.estado === 'rechazado'; })[0] || null;
}
function plnEmpresaDatos(id){ return (typeof empresaPorId === 'function' && empresaPorId(id)) || (PLN.empresas||[]).filter(function(e){ return e.id === id; })[0] || {}; }

function plnPintarEmpresa(id, modo){
  var caja = $('emp-plan'); if(!caja) return;
  var p = plnActual(id), e = plnEmpresaDatos(id), staff = modo !== 'empresa';
  var h = '<h3 style="color:var(--tinta);margin-bottom:6px">Plan mensual: todo el catálogo para su equipo</h3>';
  if(modo === 'admin'){
    h += '<div class="campo" style="max-width:360px"><label for="pe-op">Operador que atiende a esta empresa</label><select id="pe-op" onchange="plnAsignarOperador(\''+id+'\',this.value)">'+
      '<option value="">Sin operador (la atiende administración)</option>'+
      (PLN.ops||[]).filter(function(o){ return o.activo || o.id === e.operador_id; }).map(function(o){ return '<option value="'+o.id+'"'+(o.id===e.operador_id?' selected':'')+'>'+esc(o.nombre)+'</option>'; }).join('')+
      '</select><small style="color:var(--gris)">Gana la comisión de los planes que registre para esta empresa.</small></div>';
  }
  if(p){
    h += '<div class="aviso aviso-'+(p.estado === 'activo' ? 'ok' : p.estado === 'rechazado' ? 'error' : 'info')+'" style="margin-bottom:14px">'+
      '<b>'+esc(p.rango_texto)+' · plan '+esc(p.periodo)+'</b> — <span class="etiqueta '+(PLN_COLOR[p.estado]||'gris')+'">'+esc(PLN_ESTADO[p.estado]||p.estado)+'</span><br>'+
      esc(plnPrecioTxt(p))+', IVA incluido.'+
      (p.estado === 'activo' || p.estado === 'cancelado' ? '<br>'+p.pagos_aprobados+(p.pagos_aprobados === 1 ? ' pago' : ' pagos')+' · acceso hasta el <b>'+plnFecha(p.vigente_hasta)+'</b>'+
        (p.estado === 'cancelado' ? ' (ya no se cobrará más)' : p.periodo === 'mensual' ? ' (se renueva solo cada mes)' : '') : '')+
      (p.estado === 'por_aprobar' ? '<br>El descuento rebasa lo que el operador puede dar solo: administración debe aprobarlo antes de mandar la liga de pago.' : '')+
      (p.estado === 'rechazado' ? '<br>Administración no aprobó el descuento' + (p.aprobacion_nota ? ': ' + esc(p.aprobacion_nota) : '.') + ' Crea una propuesta nueva abajo.' : '')+
      (staff && p.nota ? '<br><small>Lo pactado: '+esc(p.nota)+'</small>' : '')+
      (staff && p.admin_correo ? '<br><small>Administrador de la empresa: '+esc(p.admin_correo)+'</small>' : '')+
      '</div>';
    var acciones = [];
    if(staff && p.estado === 'pendiente_pago') acciones.push('<button class="btn btn-mor" onclick="plnLiga(\''+id+'\',\''+p.id+'\')">'+(p.liga_pago ? 'Ver o enviar la liga de pago' : 'Generar liga de pago')+'</button>');
    if(modo === 'admin' && p.estado === 'por_aprobar') acciones.push('<button class="btn btn-mor" onclick="plnAprobarFicha(\''+id+'\',\''+p.id+'\',true)">Aprobar descuento</button>',
      '<button class="btn btn-fantasma" onclick="plnAprobarFicha(\''+id+'\',\''+p.id+'\',false)">Rechazar</button>');
    if((p.estado === 'activo' && (staff || p.periodo === 'mensual')) || (staff && (p.estado === 'pendiente_pago' || p.estado === 'por_aprobar')))
      acciones.push('<button class="btn btn-fantasma" onclick="plnCancelar(\''+id+'\',\''+p.id+'\',\''+modo+'\')">'+(p.estado === 'activo' ? 'Cancelar el plan' : 'Cancelar la propuesta')+'</button>');
    if(acciones.length) h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">'+acciones.join('')+'</div>';
    if(p.estado === 'activo' || p.estado === 'cancelado' || p.estado === 'pendiente_pago') h += plnHtmlLugares(id, p, modo);
  } else if(!staff){
    h += '<p style="color:var(--gris);margin-bottom:10px">Con el plan mensual, todo su equipo toma los cursos y diplomados que quiera por una cuota fija según el número de personas. '+
      'Pregúntanos por él.</p><a class="btn btn-linea" target="_blank" rel="noopener" href="https://wa.me/528120282120?text='+encodeURIComponent('Hola, soy de '+(e.nombre||'mi empresa')+' y quiero información del plan mensual para mi equipo.')+'">Pedir información</a>';
  }
  if(staff && !plnVigente(p) && !(p && p.estado === 'activo')) h += plnFormNuevo(id, p);
  caja.innerHTML = h;
  if(staff && $('pn-n')) plnResumen(id);
}
function plnAsignarOperador(id, opId){
  Nube.tabla('empresas?id=eq.' + id, { metodo:'PATCH', cuerpo:{ operador_id:opId || null }, prefer:'return=minimal' })
    .then(function(){ var e = plnEmpresaDatos(id); if(e) e.operador_id = opId || null; })
    .catch(function(err){ alert(err.message); });
}
function plnAprobarFicha(id, planId, si){
  var nota = si ? '' : prompt('¿Por qué se rechaza? (lo verá el operador)', '');
  if(!si && nota === null) return;
  Nube.empresaRpc('plan_aprobar', { p_plan:planId, p_aprobar:si, p_nota:nota || null })
    .then(function(){ return plnCargarEmpresa(id, 'admin'); }).catch(function(e){ alert(e.message); });
}

/* ---------- Nuevo plan ---------- */
function plnFormNuevo(id, previo){
  var e = plnEmpresaDatos(id);
  var correoAdm = (previo && previo.admin_correo) || e.contacto_correo || '';
  return '<h4 style="margin:4px 0 10px">'+(previo ? 'Nueva propuesta de plan' : 'Registrar el plan que se pactó')+'</h4>'+
    '<div class="fila"><div class="campo"><label for="pn-n">¿Cuántas personas van a estudiar?</label><input id="pn-n" type="number" min="1" value="5" oninput="plnResumen(\''+id+'\')"></div>'+
    '<div class="campo"><label for="pn-per">Forma de pago</label><select id="pn-per" onchange="plnResumen(\''+id+'\')">'+
      '<option value="mensual">Mensual (cobro automático con tarjeta)</option><option value="anual">Anual (12 meses al precio de '+plnMesesAnual()+')</option></select></div>'+
    '<div class="campo"><label for="pn-d">Descuento (%)</label><input id="pn-d" type="number" min="0" max="100" value="0" oninput="plnResumen(\''+id+'\')"></div></div>'+
    '<div class="fila"><div class="campo"><label for="pn-adm">Correo de quien administrará el panel de la empresa</label><input id="pn-adm" type="email" value="'+esc(correoAdm)+'">'+
      '<small style="color:var(--gris)">Con ese correo entra a «Mi empresa» para registrar a su gente y ver su avance.</small></div></div>'+
    '<div class="campo"><label for="pn-nota">Lo que se pactó con la empresa</label><textarea id="pn-nota" rows="2" placeholder="Ej. Habló con la Lic. Ramírez (RH). Arrancan con 5 de producción; si les gusta, suben a 10 en enero."></textarea></div>'+
    '<div id="pn-res"></div><div id="pn-aviso"></div>'+
    '<button id="pn-btn" class="btn btn-mor" onclick="plnCrear(\''+id+'\')">Registrar plan</button>';
}
function plnResumen(id){
  var caja = $('pn-res'); if(!caja) return;
  var n = Math.floor(Number($('pn-n').value)), per = $('pn-per').value, d = Math.max(0, Number($('pn-d').value) || 0);
  var r = n >= 1 ? plnRangoDe(n) : null;
  if(!r){ caja.innerHTML = '<div class="aviso aviso-error">'+(n >= 1 ? 'No hay un rango de precio para '+n+' personas.' : 'Escribe cuántas personas van a estudiar.')+'</div>'; return; }
  var lista = per === 'anual' ? r.precio_mensual * plnMesesAnual() : r.precio_mensual;
  var inicial = Math.round(lista * (100 - d)) / 100, meses = plnDescMeses(), limite = plnDescMax();
  if(esOperador() && PLN.miOp) limite = Math.min(limite, Number(PLN.miOp.descuento_max));
  var aprobar = !(sesion.rol === 'admin') && d > 0 && (per === 'anual' || d > limite);
  var precio = d > 0
    ? (per === 'mensual' ? '<b>'+dinero(inicial)+' al mes</b> los primeros '+meses+' meses y después <b>'+dinero(lista)+' al mes</b>' : '<b>'+dinero(inicial)+'</b> por 12 meses (lista '+dinero(lista)+')')
    : (per === 'mensual' ? '<b>'+dinero(lista)+' al mes</b>' : '<b>'+dinero(lista)+'</b> por 12 meses ('+dinero(Math.round(lista/12))+' al mes)');
  var com = per === 'mensual'
    ? 'Comisión aproximada: '+dinero(Math.round(plnComisionAprox(inicial, r.comision_inicial_pct)))+' del primer pago y '+dinero(Math.round(plnComisionAprox(lista, r.comision_recurrente_pct)))+' de cada mes siguiente.'
    : 'Comisión aproximada: '+dinero(Math.round(plnComisionAprox(inicial, r.comision_inicial_pct)))+' del pago anual.';
  caja.innerHTML = '<div class="aviso aviso-info" style="margin-bottom:12px'+(aprobar ? ';border-left:4px solid #F59E0B' : '')+'">Plan de <b>'+esc(plnRangoTxt(r))+'</b>: '+precio+', IVA incluido. '+
    (r.hasta ? 'Hasta '+r.hasta+' personas registradas a la vez.' : 'Sin límite de personas.')+'<br><small>'+com+' Solo se gana cuando la empresa paga.</small>'+
    (inicial < 30 ? '<br><b>Mercado Pago no acepta cobros menores a $30.</b>' : '')+
    (aprobar ? '<br><b>Este descuento necesita aprobación de administración</b> ('+(per === 'anual' ? 'el plan anual ya trae descuento' : 'tu límite es '+limite+'%')+'). La liga de pago se genera en cuanto lo aprueben.' : '')+
    '</div>';
}
function plnCrear(id){
  var n = Math.floor(Number($('pn-n').value)), per = $('pn-per').value, d = Math.max(0, Number($('pn-d').value) || 0), av = $('pn-aviso'), b = $('pn-btn');
  var adm = $('pn-adm').value.trim(), nota = $('pn-nota').value.trim();
  if(!(n >= 1)){ av.innerHTML = '<div class="aviso aviso-error">Escribe cuántas personas van a estudiar.</div>'; return; }
  if(!adm){ av.innerHTML = '<div class="aviso aviso-error">Escribe el correo de quien administrará el panel de la empresa.</div>'; return; }
  b.disabled = true;
  Nube.empresaRpc('plan_crear', { p_empresa:id, p_empleados:n, p_periodo:per, p_descuento:d, p_admin_correo:adm, p_nota:nota || null })
    .then(function(p){ return plnCargarEmpresa(id, plnModo()).then(function(){ if(p && p.estado === 'pendiente_pago') plnLiga(id, p.id); }); })
    .catch(function(e){ b.disabled = false; av.innerHTML = plnErr(e); });
}
function plnModo(){ return sesion && sesion.rol === 'admin' ? 'admin' : esOperador() ? 'operador' : 'empresa'; }

/* ---------- Liga de pago ---------- */
function plnBuscar(id, planId){ return (PLN.porEmpresa[id]||[]).filter(function(x){ return x.id === planId; })[0]; }
function plnLiga(id, planId){
  var p = plnBuscar(id, planId), e = plnEmpresaDatos(id); if(!p) return;
  if(p.liga_pago){ plnMostrarLiga(id, planId); return; }
  abrirModal('Liga de pago · ' + (e.nombre || ''),
    (p.periodo === 'mensual'
      ? '<p style="margin-bottom:10px">El plan mensual se cobra solo cada mes con tarjeta. Mercado Pago pide el <b>correo de la cuenta con la que pagará la empresa</b>.</p>'+
        '<div class="campo"><label for="lg-mp">Correo de la cuenta de Mercado Pago</label><input id="lg-mp" type="email" value="'+esc(p.admin_correo || e.contacto_correo || '')+'"></div>'
      : '<p style="margin-bottom:10px">Es un solo pago por 12 meses (tarjeta, transferencia u OXXO). La liga vale 15 días.</p>')+
    '<label style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><input type="checkbox" id="lg-correo" checked> Enviar la liga por correo a '+esc(p.admin_correo || e.contacto_correo || 'la empresa')+'</label>'+
    '<div id="lg-aviso"></div>',
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cancelar</button><button id="lg-btn" class="btn btn-mor" onclick="plnGenerarLiga(\''+id+'\',\''+planId+'\')">Generar liga</button>');
}
function plnGenerarLiga(id, planId){
  var b = $('lg-btn'); b.disabled = true; b.textContent = 'Generando…';
  Nube.funcionServidor('tienda', { accion:'plan_liga', planId:planId, correoMP:$('lg-mp') ? $('lg-mp').value.trim() : '', enviarCorreo:!!($('lg-correo') && $('lg-correo').checked) })
    .then(function(r){ return plnCargarEmpresa(id, plnModo()).then(function(){ plnMostrarLiga(id, planId, r.enviado); }); })
    .catch(function(err){ b.disabled = false; b.textContent = 'Generar liga'; $('lg-aviso').innerHTML = plnErr(err); });
}
function plnMostrarLiga(id, planId, enviado){
  var p = plnBuscar(id, planId), e = plnEmpresaDatos(id); if(!p || !p.liga_pago) return;
  var nom = e.contacto_nombre ? ' ' + String(e.contacto_nombre).split(' ')[0] : '';
  var t = 'Hola' + nom + ', como lo platicamos, esta es la liga para activar el plan de capacitación de *' + (e.nombre || 'su empresa') + '*:\n\n' +
    '• *' + p.rango_texto + '*: todo el catálogo de cursos y diplomados\n• ' + plnPrecioTxt(p) + ', IVA incluido\n' +
    '• Constancia con folio y QR verificable al terminar cada programa\n• Panel para ver el avance de cada persona\n\n👉 ' + p.liga_pago + '\n\n' +
    (p.periodo === 'mensual' ? 'El cobro es automático cada mes y pueden cancelarlo cuando quieran.' : 'Es un solo pago por 12 meses. La liga vale hasta el ' + plnFecha(p.liga_vence) + '.') +
    ' Si necesitan factura, envíen sus datos fiscales a contacto@institutomara.com.';
  abrirModal('Liga de pago · ' + (e.nombre || ''),
    (enviado ? '<div class="aviso aviso-ok">Se envió por correo a ' + esc(p.admin_correo || e.contacto_correo || '') + '.</div>' : '')+
    '<div class="campo"><label for="lq-url">Liga de Mercado Pago</label><input id="lq-url" readonly value="'+esc(p.liga_pago)+'"></div>'+
    '<p style="margin:6px 0 10px">Mensaje listo para WhatsApp:</p><textarea id="lq-txt" rows="12" style="width:100%">'+esc(t)+'</textarea>'+
    '<p style="color:var(--gris);font-size:.88rem;margin-top:8px">¿La empresa necesita pagar con otra cuenta? <a href="#" onclick="plnRehacerLiga(\''+id+'\',\''+planId+'\');return false">Generar una liga nueva</a>.</p>',
    '<button class="btn btn-fantasma" onclick="copiarTexto($(\'lq-url\').value)">Copiar liga</button>'+
    '<button class="btn btn-linea" onclick="copiarTexto($(\'lq-txt\').value)">Copiar mensaje</button>'+
    '<button class="btn btn-mor" onclick="window.open(\'https://wa.me/'+plnTelWa(e.contacto_tel)+'?text=\'+encodeURIComponent($(\'lq-txt\').value),\'_blank\',\'noopener\')">WhatsApp</button>');
}
function plnRehacerLiga(id, planId){
  var p = plnBuscar(id, planId); if(!p) return;
  p.liga_pago = null; plnLiga(id, planId);
}
function plnCancelar(id, planId, modo){
  var p = plnBuscar(id, planId); if(!p) return;
  var txt = p.estado === 'activo'
    ? '¿Cancelar el plan? Ya no se cobrará más; el equipo conserva el acceso hasta el ' + plnFecha(p.vigente_hasta) + '.'
    : '¿Cancelar esta propuesta? La liga de pago deja de servir.';
  if(!confirm(txt)) return;
  Nube.funcionServidor('tienda', { accion:'plan_cancelar', planId:planId })
    .then(function(){ return plnCargarEmpresa(id, modo); }).catch(function(e){ alert(e.message); });
}

/* ---------- Lugares del plan ---------- */
function plnHtmlLugares(id, p, modo){
  var l = PLN.lugares[p.id] || [], tope = p.lugares;
  var h = '<div class="encabezado-fila" style="margin:4px 0 8px"><h4 style="margin:0">Personas del plan</h4>'+
    '<span style="color:var(--gris);font-size:.92rem">'+l.length+(tope ? ' de '+tope : '')+' lugares ocupados</span></div>'+
    '<p style="color:var(--gris);font-size:.9rem;margin-bottom:10px">Cada persona entra con su propio correo y toma los programas que quiera. '+
      'Un lugar se puede cambiar de persona mientras no haya empezado; si ya empezó, hasta el siguiente mes pagado.</p>';
  if(l.length) h += '<div class="tabla-caja" style="margin-bottom:12px"><div class="tabla-scroll"><table><thead><tr><th>Persona</th><th>Cuenta</th><th>Último acceso</th><th></th></tr></thead><tbody>'+
    l.map(function(x){
      var bloqueado = x.liberable_desde && new Date(x.liberable_desde) > new Date() && modo !== 'admin';
      return '<tr><td><b>'+esc(x.alumno || x.nombre)+'</b><br><small>'+esc(x.correo)+'</small></td>'+
        '<td>'+(x.usuario_id ? (x.iniciado_en ? '<span class="etiqueta ok">Estudiando</span>' : '<span class="etiqueta tur">Con cuenta</span>') : '<span class="etiqueta alerta">Falta crear su cuenta</span>')+'</td>'+
        '<td>'+esc(x.usuario_id ? hace(x.ultimo_acceso) : '—')+'</td>'+
        '<td style="white-space:nowrap">'+(x.usuario_id ? '' : '<button class="btn btn-linea btn-sm" onclick="plnAvisarLugar(\''+id+'\',\''+p.id+'\',\''+x.id+'\')">Mandar acceso</button> ')+
          (bloqueado ? '<small style="color:var(--gris)">Se puede cambiar desde el '+esc(fechaCortaEmp(x.liberable_desde))+'</small>'
                     : '<button class="btn btn-fantasma btn-sm" onclick="plnLiberar(\''+id+'\',\''+p.id+'\',\''+x.id+'\')">Liberar lugar</button>')+'</td></tr>';
    }).join('')+'</tbody></table></div></div>';
  if(!tope || l.length < tope){
    h += '<div class="fila"><div class="campo"><label for="lp-nom">Nombre</label><input id="lp-nom" maxlength="120"></div>'+
      '<div class="campo"><label for="lp-cor">Correo</label><input id="lp-cor" type="email"></div></div><div id="lp-aviso"></div>'+
      '<button class="btn btn-linea" onclick="plnAgregarLugar(\''+id+'\',\''+p.id+'\')">Agregar persona</button>';
  } else {
    h += '<div class="aviso aviso-info">Ya están ocupados todos los lugares. Para sumar más personas hay que cambiar a un rango mayor (pídelo a Instituto Mara).</div>';
  }
  return h;
}
function plnAgregarLugar(id, planId){
  var nom = $('lp-nom').value.trim(), cor = $('lp-cor').value.trim(), av = $('lp-aviso');
  Nube.empresaRpc('plan_asignar_lugar', { p_plan:planId, p_nombre:nom, p_correo:cor })
    .then(function(x){
      return plnCargarEmpresa(id, plnModo()).then(function(){ if(x && !x.usuario_id) plnAvisarLugar(id, planId, x.id); });
    })
    .catch(function(e){ av.innerHTML = plnErr(e); });
}
function plnLiberar(id, planId, lugarId){
  if(!confirm('¿Liberar este lugar? La persona deja de tener acceso por el plan (conserva su avance).')) return;
  Nube.empresaRpc('plan_liberar_lugar', { p_lugar:lugarId })
    .then(function(){ return plnCargarEmpresa(id, plnModo()); }).catch(function(e){ alert(e.message); });
}
function plnAvisarLugar(id, planId, lugarId){
  var x = (PLN.lugares[planId]||[]).filter(function(k){ return k.id === lugarId; })[0], e = plnEmpresaDatos(id); if(!x) return;
  var enlace = location.origin + location.pathname;
  var t = '📚 Hola ' + String(x.nombre).split(' ')[0] + ', *' + (e.nombre || 'tu empresa') + '* te dio acceso a todos los cursos y diplomados de Instituto Mara, 100 % en línea y con constancia al terminar.\n\n' +
    '👉 Crea tu cuenta con este correo: ' + x.correo + '\n' + enlace + '\n\nAl entrar, elige en «Catálogo» el programa que quieras y presiona «Empezar».';
  abrirModal('Mandar acceso a ' + x.nombre,
    '<p style="margin-bottom:10px">Mándale este mensaje. Es importante que cree su cuenta con <b>'+esc(x.correo)+'</b>: así el lugar se activa solo.</p>'+
    '<textarea id="la-txt" rows="8" style="width:100%">'+esc(t)+'</textarea>',
    '<button class="btn btn-fantasma" onclick="copiarTexto($(\'la-txt\').value)">Copiar</button>'+
    '<a class="btn btn-linea" href="mailto:'+esc(x.correo)+'?subject='+encodeURIComponent('Tu acceso a Instituto Mara')+'&body='+encodeURIComponent(t)+'">Correo</a>'+
    '<button class="btn btn-mor" onclick="window.open(\'https://wa.me/?text=\'+encodeURIComponent($(\'la-txt\').value),\'_blank\',\'noopener\')">WhatsApp</button>');
}

/* Se inserta la caja del plan en la ficha de la empresa (administración) y en «Mi empresa». */
var _vistaAdminEmpresaPl = vistaAdminEmpresa;
vistaAdminEmpresa = function(){
  var h = _vistaAdminEmpresaPl(); if(!h) return h;
  var id = estado.empresaId;
  setTimeout(function(){ plnCargarEmpresa(id, 'admin'); }, 0);
  return h.replace('<div id="rep-emp"', plnCajaEmpresa() + '<div id="rep-emp"');
};
var _vistaPortalEmpresaPl = vistaPortalEmpresa;
vistaPortalEmpresa = function(){
  var h = _vistaPortalEmpresaPl();
  if(h.indexOf('id="rep-emp"') < 0 || !estado.empresaId) return h;
  var id = estado.empresaId;
  setTimeout(function(){ plnCargarEmpresa(id, 'empresa'); }, 0);
  return h.replace('<div id="rep-emp"', plnCajaEmpresa() + '<div id="rep-emp"');
};

/* ============================================================================
   Alumno con lugar en el plan de su empresa
   ========================================================================== */
function miPlanVigente(){ var p = BD.miPlan; return p && (p.estado === 'activo' || p.estado === 'cancelado') && p.vigente_hasta && new Date(p.vigente_hasta) >= new Date() ? p : null; }
function cargarMiPlan(){
  if(!NUBE || !sesion || sesion.rol !== 'alumno') return Promise.resolve(null);
  return Nube.empresaRpc('mi_plan_empresa', {}).then(function(r){
    var antes = JSON.stringify(BD.miPlan || null);
    BD.miPlan = (r && r[0]) || null; guardar();
    if(antes !== JSON.stringify(BD.miPlan) && ['catalogo','mis-cursos','aula','ia-profesion'].indexOf(estado.vista) >= 0) pintar();
    return BD.miPlan;
  }).catch(function(){ return null; });
}
var _membresiaCubrePl = membresiaCubre;
membresiaCubre = function(cid){
  if(miPlanVigente() && !ruta(cid) && curso(cid)) return true;
  return _membresiaCubrePl(cid);
};
textoIncluido = function(){ return miPlanVigente() ? 'Incluido en el plan de tu empresa' : 'Incluido en tu membresía'; };
textoEmpezarIncluido = function(){ return miPlanVigente() ? 'Empezar' : 'Empezar con mi membresía'; };
var _avisoMembresiaFichaPl = avisoMembresiaFicha;
avisoMembresiaFicha = function(c){
  var p = miPlanVigente();
  if(p && !ruta(c.id)) return '<div class="aviso aviso-ok" style="margin-top:14px">Este programa está <b>incluido en el plan de '+esc(p.empresa)+'</b>. Empieza cuando quieras.</div>';
  return _avisoMembresiaFichaPl(c);
};
/* Inscripción por el plan: solo da acceso mientras el plan esté vigente (si ya terminó, conserva su avance). */
var _estaInscritoPl = estaInscrito;
estaInscrito = function(uid, cid){
  var ins = _estaInscritoPl(uid, cid);
  if(ins && ins.estatus === 'empresa' && !miPlanVigente() && !(sesion && (sesion.rol === 'admin' || sesion.rol === 'operador'))){
    var c = curso(cid); if(!(c && cursoCompleto(uid, c))) return null;
  }
  return ins;
};
/* Diplomados con el plan: la constancia se libera a partir de N pagos (el anual cuenta completo). */
var _bloqueoConstanciaPl = constanciaBloqueadaPorMembresia;
constanciaBloqueadaPorMembresia = function(c){
  var ins = inscripcionPropia(c.id), p = BD.miPlan;
  if(ins && ins.estatus === 'empresa' && c.nivel === 'Diplomados' && p){
    var n = Number(p.pagos_constancia) || 2;
    if(!(p.periodo === 'anual' && p.pagos_aprobados >= 1) && Number(p.pagos_aprobados) < n){
      return 'Ya terminaste todo el diplomado. Como lo tomaste con el plan de <b>'+esc(p.empresa)+'</b>, la constancia de los diplomados se libera cuando el plan lleve <b>'+n+' meses pagados</b> '+
        '(hoy lleva '+p.pagos_aprobados+'). Tu avance está guardado y la podrás descargar en cuanto se cumpla.';
    }
    return '';
  }
  return _bloqueoConstanciaPl(c);
};

/* ============================================================================
   Rol de operador: menú y pantalla de inicio
   ========================================================================== */
function vistaOpInicio(){
  if(!esOperador()) return '';
  setTimeout(function(){
    Promise.all([ plnCargarRangos(), Nube.tabla('operadores?select=*&usuario_id=eq.' + sesion.id) ])
      .then(function(r){ PLN.miOp = (r[1] && r[1][0]) || null; plnPintarOpInicio(); })
      .catch(function(e){ var c = $('op-datos'); if(c) c.innerHTML = plnErr(e); });
  }, 0);
  return '<div class="seccion"><h2>Hola, '+esc(String(sesion.nombre).split(' ')[0])+'</h2>'+
    '<p class="sub">Tu panel de operador. Aquí tienes la tabla de planes para vender.</p><div id="op-datos">Cargando…</div></div>';
}
function plnPintarOpInicio(){
  var caja = $('op-datos'); if(!caja) return;
  var meses = plnMesesAnual(), lim = PLN.miOp ? Math.min(plnDescMax(), Number(PLN.miOp.descuento_max)) : plnDescMax();
  caja.innerHTML = '<div class="tarjeta"><h3 style="color:var(--tinta);margin-bottom:6px">Plan mensual: todo el catálogo por número de personas</h3>'+
    '<p style="color:var(--gris);font-size:.92rem;margin-bottom:12px">Precios con IVA incluido. El anual cuesta '+meses+' mensualidades (2 meses gratis). '+
      'Puedes dar hasta <b>'+lim+'%</b> de descuento los primeros '+plnDescMeses()+' meses sin pedir permiso.</p>'+
    '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Personas</th><th>Mensual</th><th>Anual</th><th>Tu comisión (aprox.)</th></tr></thead><tbody>'+
    (PLN.rangos||[]).filter(function(r){ return r.activo; }).map(function(r){
      return '<tr><td><b>'+esc(plnRangoTxt(r))+'</b></td><td>'+dinero(r.precio_mensual)+'</td><td>'+dinero(r.precio_mensual * meses)+'</td>'+
        '<td><small>'+dinero(Math.round(plnComisionAprox(r.precio_mensual, r.comision_inicial_pct)))+' el 1.er mes + '+
          dinero(Math.round(plnComisionAprox(r.precio_mensual, r.comision_recurrente_pct)))+' cada mes siguiente<br>o '+
          dinero(Math.round(plnComisionAprox(r.precio_mensual * meses, r.comision_inicial_pct)))+' si pagan el año</small></td></tr>';
    }).join('')+'</tbody></table></div></div>'+
    '<p style="color:var(--gris);font-size:.85rem;margin-top:8px">La comisión se gana solo cuando la empresa paga, y se calcula con lo que deposita Mercado Pago menos el IVA.</p></div>';
}

pintarNav = function(){
  var items;
  if(sesion.rol === 'admin'){
    items = [['admin-tablero','Tablero'],['admin-cursos','Cursos'],['admin-alumnos','Alumnos'],
      ['admin-reactivacion','Invitaciones'],['admin-pagos','Pagos'],['admin-cupones','Cupones'],['admin-dudas', bandejaDudasEtiqueta()],
      ['admin-tienda','Membresías y regalos'],['admin-empresas','Empresas'],['admin-prospectos','Prospectos'],['admin-planes','Planes y operadores'],
      ['admin-resenas','Reseñas'],['verificacion','Constancias'],['admin-ajustes','Ajustes']];
  } else if(sesion.rol === 'operador'){
    items = [['op-inicio','Inicio'],['mi-perfil','Mi perfil']];
  } else {
    items = [['mis-cursos','Mis cursos'],['catalogo','Catálogo'],['ia-profesion','IA por profesión'],
      ['membresia','Membresía'],['constancias','Constancias'],['regalos','Regalar'],['empresas','Empresas'],['dudas','Dudas'],['mi-perfil','Mi perfil']];
    if((BD.misEmpresasAdmin||[]).length) items.unshift(['mi-empresa','Mi empresa']);
  }
  var h = '';
  for(var i=0;i<items.length;i++) h += '<button data-v="'+items[i][0]+'">'+items[i][1]+'</button>';
  $('nav').innerHTML = h;
  var bs = $('nav').querySelectorAll('button');
  for(var j=0;j<bs.length;j++) bs[j].onclick = function(){ ir(this.getAttribute('data-v')); };
};

var _pintarPl = pintar;
pintar = function(){
  var v = estado.vista;
  if(v === 'admin-planes'){ $('vista').innerHTML = vistaAdminPlanes(); return; }
  if(v === 'op-inicio'){ $('vista').innerHTML = vistaOpInicio(); return; }
  /* El operador solo ve lo suyo: cualquier otra vista lo regresa a su inicio. */
  if(esOperador() && ['op-inicio','mi-perfil'].indexOf(v) < 0){ estado.vista = 'op-inicio'; $('vista').innerHTML = vistaOpInicio(); return; }
  _pintarPl();
};

var _entrarAppPl = entrarApp;
entrarApp = function(){
  var params = new URLSearchParams(location.search), plan = params.get('plan');
  if(plan) history.replaceState(null, '', location.pathname + location.search.replace(/[?&]plan=[^&]*/, '').replace(/^&/, '?'));
  _entrarAppPl();
  if(sesion.rol === 'operador'){ $('rolUsuario').textContent = 'Operador'; ir('op-inicio'); }
  cargarMiPlan();
  if(plan === 'exito')
    abrirModal('¡Gracias!', '<p>Recibimos la activación del plan. En cuanto Mercado Pago confirme el cobro (suele tardar unos segundos), '+
      'quien administra el panel de la empresa recibe un correo para registrar a su equipo en «Mi empresa».</p>',
      '<button class="btn btn-mor" onclick="cerrarModal()">Entendido</button>');
  else if(plan === 'pendiente')
    abrirModal('Pago en proceso', '<p>Mercado Pago está confirmando el pago. En cuanto se acredite, el plan se activa solo.</p>', '<button class="btn btn-mor" onclick="cerrarModal()">Entendido</button>');
  else if(plan === 'fallo')
    abrirModal('El pago no se completó', '<p>Mercado Pago no pudo cobrar. Puedes intentar de nuevo con la misma liga o escribirnos por WhatsApp.</p>', '<button class="btn btn-mor" onclick="cerrarModal()">Entendido</button>');
};
