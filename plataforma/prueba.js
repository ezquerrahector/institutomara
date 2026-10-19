/* Instituto Mara — Prueba sin costo con todo el catálogo (19 oct 2026).
   Se carga después de comisiones.js. Requiere backend/prueba-y-supervision-20261019.sql.

   La prueba ya no lleva lista de programas: da TODO el catálogo (como el plan) a
   5 personas por 15 días. Las personas se registran con nombre y correo y les llega
   su acceso. Durante la prueba no hay constancia; si la empresa contrata el plan,
   cada persona conserva su avance y su lugar pasa al plan.
   Aparece en: ficha de la empresa del operador, ficha de administración, «Mi empresa»
   y en «Aceptó la prueba» de la consola de llamadas. Las pruebas viejas (por programa,
   con códigos) siguen mostrándose como antes hasta que venzan. */

var PB = { porEmpresa:{}, lugares:{}, activo:{} };
LL_RES.forEach(function(r){ if(r[0] === 'piloto') r[2] = 'Al guardar, se crea su prueba de 5 personas por 15 días con todo el catálogo.'; });
PLN_ESTADO.prueba = 'Prueba sin costo'; PLN_COLOR.prueba = 'tur';
var _plnPrecioTxtPb = plnPrecioTxt;
plnPrecioTxt = function(p){ return p && p.estado === 'prueba' ? 'Sin costo · ' + (p.prueba_dias || 15) + ' días' : _plnPrecioTxtPb(p); };

function pbVigente(q){ return !!(q && q.estado === 'prueba' && !q.convertida_en && new Date(q.vigente_hasta) > new Date()); }
function pbUltimoDia(q){ return new Date(new Date(q.vigente_hasta).getTime() - 864e5).toISOString().slice(0,10); }
function pbQuedan(q){ return Math.max(0, Math.ceil((new Date(q.vigente_hasta) - new Date()) / 864e5) - 1); }
function pbDe(id){ return (PB.porEmpresa[id] || [])[0] || null; }

function pbCargar(id, modo, cajaId){
  return Promise.all([
    Nube.tabla('empresas_planes?select=*&empresa_id=eq.' + id + '&estado=eq.prueba&order=creado_en.desc&limit=5'),
    Nube.tabla('empresas_planes?select=id&empresa_id=eq.' + id + '&estado=eq.activo&limit=1')
  ]).then(function(r){
    PB.porEmpresa[id] = r[0] || []; PB.activo[id] = !!(r[1] && r[1].length);
    var q = pbDe(id);
    return q && pbVigente(q) ? Nube.empresaRpc('plan_lugares', { p_plan:q.id }).then(function(l){ PB.lugares[q.id] = l || []; }) : null;
  }).then(function(){ pbPintar(id, modo, cajaId); })
    .catch(function(e){ var c = $(cajaId); if(c) c.innerHTML = '<h3 style="color:var(--tinta);margin-bottom:6px">Prueba sin costo</h3>' + plnErr(e, 'Si dice que no existe la función, falta ejecutar backend/prueba-y-supervision-20261019.sql en Supabase.'); });
}

function pbPintar(id, modo, cajaId){
  var caja = $(cajaId); if(!caja) return;
  var q = pbDe(id), staff = modo !== 'empresa', h = '<h3 style="color:var(--tinta);margin-bottom:6px">Prueba sin costo</h3>';
  if(q && pbVigente(q)){
    var l = PB.lugares[q.id] || [];
    h += '<div class="aviso aviso-ok" style="margin-bottom:12px"><b>Activa: '+q.lugares+' personas con todo el catálogo</b> · termina el <b>'+esc(fechaLarga(pbUltimoDia(q)))+'</b>'+
      ' (quedan '+pbQuedan(q)+' días).<br><small>Durante la prueba no hay constancia. Si contratan el plan, cada persona conserva su avance y obtiene su constancia al terminar.</small></div>';
    if(staff && q.extension_estado === 'pendiente') h += '<div class="aviso aviso-info" style="margin-bottom:12px">Se pidieron '+q.extension_dias+' días más el '+esc(fechaCortaEmp(q.extension_en))+'. Administración responde en «Planes y operadores».</div>';
    if(staff && q.extension_estado === 'aprobada') h += '<div class="aviso aviso-ok" style="margin-bottom:12px">Administración aprobó '+q.extension_dias+' días más.</div>';
    if(staff && q.extension_estado === 'rechazada') h += '<div class="aviso aviso-error" style="margin-bottom:12px">Administración no aprobó la extensión.</div>';
    h += '<div class="encabezado-fila" style="margin:4px 0 8px"><h4 style="margin:0">Personas de la prueba</h4><span style="color:var(--gris);font-size:.92rem">'+l.length+' de '+q.lugares+'</span></div>';
    if(l.length) h += '<div class="tabla-caja" style="margin-bottom:12px"><div class="tabla-scroll"><table><thead><tr><th>Persona</th><th>Cuenta</th><th>Último acceso</th><th></th></tr></thead><tbody>'+
      l.map(function(x){
        return '<tr><td><b>'+esc(x.alumno || x.nombre)+'</b><br><small>'+esc(x.correo)+'</small></td>'+
          '<td>'+(x.usuario_id ? (x.iniciado_en ? '<span class="etiqueta ok">Estudiando</span>' : '<span class="etiqueta tur">Con cuenta</span>') : '<span class="etiqueta alerta">Falta crear su cuenta</span>')+'</td>'+
          '<td>'+esc(x.usuario_id ? hace(x.ultimo_acceso) : '—')+'</td>'+
          '<td style="white-space:nowrap">'+(x.usuario_id ? '' : '<button class="btn btn-linea btn-sm" onclick="pbMandar(\''+id+'\',\''+x.id+'\',this)">Reenviar acceso</button> <button class="btn btn-fantasma btn-sm" onclick="pbWhats(\''+id+'\',\''+x.id+'\')">WhatsApp</button> ')+
            (x.iniciado_en ? '' : '<button class="btn btn-fantasma btn-sm" onclick="pbLiberar(\''+id+'\',\''+modo+'\',\''+cajaId+'\',\''+x.id+'\')">Quitar</button>')+'</td></tr>';
      }).join('')+'</tbody></table></div></div>';
    if(l.length < q.lugares) h += '<div class="fila"><div class="campo"><label for="pb-nom">Nombre</label><input id="pb-nom" maxlength="120"></div>'+
      '<div class="campo"><label for="pb-cor">Correo</label><input id="pb-cor" type="email" placeholder="correo@empresa.com"></div></div><div id="pb-av"></div>'+
      '<button class="btn btn-mor" onclick="pbAgregar(\''+id+'\',\''+modo+'\',\''+cajaId+'\')">Agregar y mandarle su acceso</button>';
    else h += '<div class="aviso aviso-info">Ya están ocupados los '+q.lugares+' lugares de la prueba.</div>';
    if(modo === 'operador' && q.extension_estado !== 'pendiente') h += pbFormExtension(id, q);
    if(modo === 'admin') h += '<div style="margin-top:14px;display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap"><div class="campo" style="margin:0;max-width:140px"><label for="pb-mas">Dar más días</label><input id="pb-mas" type="number" min="1" max="60" value="15"></div>'+
      '<button class="btn btn-linea" onclick="pbDarDias(\''+id+'\',\''+cajaId+'\')">Extender la prueba</button></div>';
  } else if(q){
    h += q.convertida_en
      ? '<p style="color:var(--gris)">La prueba pasó al plan contratado el '+esc(fechaCortaEmp(q.convertida_en))+'. Las personas siguen en el plan con su avance.</p>'
      : '<p style="color:var(--gris);margin-bottom:10px">La prueba terminó el '+esc(fechaLarga(pbUltimoDia(q)))+'. Las personas conservan su avance: si contratan el plan, siguen donde se quedaron.</p>';
    if(!q.convertida_en && modo === 'operador'){
      if(q.extension_estado === 'pendiente') h += '<div class="aviso aviso-info">Pediste '+q.extension_dias+' días más. Administración responde en «Planes y operadores».</div>';
      else h += pbFormExtension(id, q);
    }
    if(!q.convertida_en && modo === 'admin') h += '<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap"><div class="campo" style="margin:0;max-width:140px"><label for="pb-mas">Reabrir por</label><input id="pb-mas" type="number" min="1" max="60" value="15"></div>'+
      '<button class="btn btn-linea" onclick="pbDarDias(\''+id+'\',\''+cajaId+'\')">Días más</button></div>';
  } else if(staff && !PB.activo[id]){
    h += '<p style="color:var(--gris);margin-bottom:10px">Todavía no tiene prueba. Se crea con <b>todo el catálogo</b>: cada persona toma los cursos y diplomados que quiera. Después registras a las personas y les llega su acceso por correo.</p>';
    if(modo === 'admin') h += '<div class="fila"><div class="campo"><label for="pb-n">Personas</label><input id="pb-n" type="number" min="1" max="50" value="5"></div>'+
      '<div class="campo"><label for="pb-d">Días</label><input id="pb-d" type="number" min="1" max="60" value="15"></div></div>';
    h += '<div id="pb-av"></div><button class="btn btn-mor" onclick="pbCrear(\''+id+'\',\''+modo+'\',\''+cajaId+'\')">'+(modo === 'admin' ? 'Crear prueba' : 'Crear prueba (5 personas, 15 días)')+'</button>';
  } else if(staff){
    h += '<p style="color:var(--gris)">Ya tiene un plan activo; no necesita prueba.</p>';
  } else { caja.style.display = 'none'; caja.innerHTML = ''; return; }
  caja.style.display = ''; caja.innerHTML = h;
}
function pbFormExtension(id, q){
  return '<details style="margin-top:14px"><summary style="cursor:pointer;font-weight:700;color:var(--morado)">Pedir más días de prueba</summary>'+
    '<p style="color:var(--gris);font-size:.9rem;margin:8px 0">Úsalo solo si la empresa ya está usando la prueba y necesita más tiempo para decidir. Lo aprueba administración.</p>'+
    '<div class="fila"><div class="campo"><label for="pb-dias">Días</label><input id="pb-dias" type="number" min="1" max="30" value="15"></div></div>'+
    '<div class="campo"><label for="pb-mot">¿Por qué la necesitan?</label><textarea id="pb-mot" rows="2" placeholder="Ej. RH estuvo de vacaciones; 3 de 5 personas ya empezaron."></textarea></div>'+
    '<div id="pb-ext-av"></div><button class="btn btn-linea" onclick="pbPedirDias(\''+id+'\',\''+q.id+'\')">Enviar solicitud</button></details>';
}
function pbCaja(){ var ids = ['oe-prueba','pb-adm','pb-emp']; for(var i=0;i<ids.length;i++) if($(ids[i])) return ids[i]; return null; }
function pbRecargar(id, modo, cajaId){ return pbCargar(id, modo, cajaId || pbCaja()); }
function pbCrear(id, modo, cajaId){
  var n = $('pb-n') ? Math.floor(Number($('pb-n').value)) : 5, d = $('pb-d') ? Math.floor(Number($('pb-d').value)) : 15, av = $('pb-av');
  Nube.empresaRpc('plan_crear_prueba', { p_empresa:id, p_lugares:n, p_dias:d, p_nota:modo === 'admin' ? 'Prueba creada por administración' : 'Prueba creada por el operador' })
    .then(function(){ pbMarcarProspecto(id); return pbRecargar(id, modo, cajaId); })
    .catch(function(e){ av.innerHTML = plnErr(e); });
}
/* El prospecto de esa empresa pasa a «En prueba». */
function pbMarcarProspecto(id){
  var p = (PR.lista || []).filter(function(x){ return x.empresa_id === id; })[0];
  var pid = (p && p.id) || estado.prospectoPiloto;
  if(!pid || (p && ['piloto','cliente'].indexOf(p.estado) >= 0)) return;
  Nube.tabla('prospectos?id=eq.' + pid, { metodo:'PATCH', prefer:'return=minimal', cuerpo:{ estado:'piloto', empresa_id:id } })
    .then(function(){ if(p) p.estado = 'piloto'; estado.prospectoPiloto = null; }).catch(function(){});
}
function pbAgregar(id, modo, cajaId){
  var q = pbDe(id), av = $('pb-av'), nom = $('pb-nom').value.trim(), cor = $('pb-cor').value.trim();
  Nube.empresaRpc('plan_asignar_lugar', { p_plan:q.id, p_nombre:nom, p_correo:cor })
    .then(function(x){ return Nube.funcionServidor('tienda', { accion:'plan_invitar', lugarId:x.id }).catch(function(){ return { enviado:false }; }); })
    .then(function(r){ return pbRecargar(id, modo, cajaId).then(function(){
      var a = $('pb-av'); if(a) a.innerHTML = '<div class="aviso aviso-'+(r && r.enviado ? 'ok' : 'info')+'">'+(r && r.enviado ? 'Listo: '+esc(nom)+' ya tiene su lugar y le llegó su acceso por correo.' : 'Listo: '+esc(nom)+' ya tiene su lugar. Mándale su acceso por WhatsApp.')+'</div>'; }); })
    .catch(function(e){ av.innerHTML = plnErr(e); });
}
function pbLugar(id, lugarId){ var q = pbDe(id); return ((q && PB.lugares[q.id]) || []).filter(function(x){ return x.id === lugarId; })[0]; }
function pbMandar(id, lugarId, b){
  if(b){ b.disabled = true; b.textContent = 'Enviando…'; }
  Nube.funcionServidor('tienda', { accion:'plan_invitar', lugarId:lugarId })
    .then(function(r){ if(b) b.textContent = r && r.enviado ? 'Enviado ✓' : 'No se pudo enviar'; })
    .catch(function(e){ if(b){ b.disabled = false; b.textContent = 'Reenviar acceso'; } alert(e.message); });
}
function pbWhats(id, lugarId){
  var x = pbLugar(id, lugarId), q = pbDe(id), e = plnEmpresaDatos(id); if(!x || !q) return;
  var t = '📚 Hola ' + String(x.nombre).split(' ')[0] + ', *' + (e.nombre || 'tu empresa') + '* te dio acceso a todos los cursos y diplomados de Instituto Mara, sin costo hasta el ' + fechaLarga(pbUltimoDia(q)) + '.\n\n' +
    '👉 Crea tu cuenta con este correo: ' + x.correo + '\n' + location.origin + location.pathname + '\n\nAl entrar, elige en «Catálogo» el programa que quieras y presiona «Empezar».';
  window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener');
}
function pbLiberar(id, modo, cajaId, lugarId){
  if(!confirm('¿Quitar a esta persona de la prueba? Su lugar queda libre para alguien más.')) return;
  Nube.empresaRpc('plan_liberar_lugar', { p_lugar:lugarId }).then(function(){ return pbRecargar(id, modo, cajaId); }).catch(function(e){ alert(e.message); });
}
function pbPedirDias(id, planId){
  Nube.empresaRpc('prueba_solicitar_extension', { p_plan:planId, p_dias:Math.floor(Number($('pb-dias').value)) || 15, p_motivo:$('pb-mot').value.trim() })
    .then(function(){ return pbRecargar(id, 'operador'); }).catch(function(e){ $('pb-ext-av').innerHTML = plnErr(e); });
}
function pbDarDias(id, cajaId){
  var q = pbDe(id), d = Math.floor(Number($('pb-mas').value));
  Nube.empresaRpc('prueba_resolver_extension', { p_plan:q.id, p_aprobar:true, p_dias:d })
    .then(function(){ return pbRecargar(id, 'admin', cajaId); }).catch(function(e){ alert(e.message); });
}

/* La sección vieja «Lugares (códigos de acceso)» solo se muestra si la empresa tiene códigos. */
var _pintarReporteEmpresaPb = pintarReporteEmpresa;
pintarReporteEmpresa = function(id){
  _pintarReporteEmpresaPb(id);
  var hs = document.querySelectorAll('#vista h3');
  for(var i=0;i<hs.length;i++) if(hs[i].textContent === 'Lugares (códigos de acceso)'){
    var bloque = hs[i].closest('.no-imprimir');
    if(bloque && !bloque.querySelector('code')) bloque.style.display = 'none';
  }
};

/* ---------- Dónde aparece ---------- */
/* «Mis empresas» del operador: la prueba nueva también cuenta como «En prueba». */
var _oprPruebaDePb = oprPruebaDe;
oprPruebaDe = function(id){
  var vieja = _oprPruebaDePb(id); if(vieja) return vieja;
  return (OPR.planes || []).filter(function(p){ return p.empresa_id === id && pbVigente(p); })[0] || null;
};
/* Ficha del operador: si la empresa tiene una prueba vieja activa, se muestra como antes. */
var _oprPintarPruebaPb = oprPintarPrueba;
oprPintarPrueba = function(id){
  var vieja = (EMP.datos.compras||[]).filter(function(x){ return x.empresa_id === id && x.medio === 'piloto' && x.estado === 'piloto'; })[0];
  if(vieja) return _oprPintarPruebaPb(id);
  var caja = $('oe-prueba'); if(!caja) return;
  caja.innerHTML = 'Cargando prueba…';
  pbCargar(id, 'operador', 'oe-prueba');
};
/* Ficha de administración: la caja de prueba reemplaza el formulario de piloto por programas. */
formPiloto = function(id){
  setTimeout(function(){ pbCargar(id, 'admin', 'pb-adm'); }, 0);
  return '<div class="tarjeta" id="pb-adm" style="background:var(--nube);margin:6px 0 14px">Cargando prueba…</div>';
};
/* «Mi empresa»: el administrador de la empresa registra a su gente de la prueba. */
var _vistaPortalEmpresaPb = vistaPortalEmpresa;
vistaPortalEmpresa = function(){
  var h = _vistaPortalEmpresaPb();
  if(!estado.empresaId || h.indexOf('id="emp-plan"') < 0) return h;
  var id = estado.empresaId;
  setTimeout(function(){ pbCargar(id, 'empresa', 'pb-emp'); }, 0);
  return h.replace('<div class="tarjeta no-imprimir" id="emp-plan"', '<div class="tarjeta no-imprimir" id="pb-emp" style="margin-top:18px;display:none"></div><div class="tarjeta no-imprimir" id="emp-plan"');
};

/* Consola de llamadas → «Aceptó la prueba»: sin lista de programas. */
llPiloto = function(id){
  var p = prPorId(id);
  abrirModal('Crear la prueba de ' + prCorto(p),
    '<p style="margin-bottom:10px">Se crea una prueba de <b>5 personas por 15 días con todo el catálogo</b>: cada persona toma los cursos y diplomados que quiera. '+
      'Durante la prueba no hay constancia; si contratan, cada persona conserva su avance y obtiene su constancia.</p>'+
    '<div class="fila"><div class="campo"><label for="lp-adm">Correo de quien administrará la plataforma</label><input id="lp-adm" type="email" value="'+esc(p.contacto_correo||'')+'"></div>'+
      '<div class="campo"><label for="lp-nom">Su nombre</label><input id="lp-nom" maxlength="120" value="'+esc(p.contacto_nombre||'')+'"></div></div>'+
    (llProgramas(p).length ? '<p style="color:var(--gris);font-size:.9rem">Recomiéndales empezar por: '+esc(llProgramas(p).slice(0, 3).join(', '))+'.</p>' : '')+
    '<div id="lp-aviso"></div>',
    '<button class="btn btn-fantasma" onclick="cerrarModal();llPintarFicha(\''+id+'\')">Después</button><button id="lp-btn" class="btn btn-mor" onclick="llCrearPiloto(\''+id+'\')">Crear la prueba</button>');
};
llCrearPiloto = function(id){
  var p = prPorId(id), av = $('lp-aviso'), b = $('lp-btn');
  var adm = $('lp-adm').value.trim().toLowerCase(), nom = $('lp-nom').value.trim();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adm)){ av.innerHTML = '<div class="aviso aviso-error">Escribe el correo de quien administrará la plataforma.</div>'; return; }
  b.disabled = true; b.textContent = 'Creando…';
  var empresaId = p.empresa_id;
  (empresaId ? Promise.resolve() :
    Nube.tabla('empresas', { metodo:'POST', prefer:'return=representation', cuerpo:{ nombre:p.nombre, contacto_nombre:nom || null, contacto_correo:adm,
        contacto_tel:prTelLimpio(p.telefono || p.whatsapp) || null, operador_id:esOperador() && LL.op ? LL.op.id : (p.asignado_a || null),
        notas:'Desde Llamadas' + (p.segmento ? ' · ' + p.segmento : '') } })
      .then(function(r){ empresaId = r && r[0] && r[0].id; if(!empresaId) throw new Error('No se pudo crear la empresa.');
        return Nube.tabla('prospectos?id=eq.' + id, { metodo:'PATCH', prefer:'return=minimal', cuerpo:{ empresa_id:empresaId } }); })
  ).then(function(){ return Nube.empresaRpc('empresa_agregar_admin', { p_empresa:empresaId, p_correo:adm, p_nombre:nom || null }); })
   .then(function(){ return Nube.empresaRpc('plan_crear_prueba', { p_empresa:empresaId, p_lugares:5, p_dias:15, p_nota:'Prueba desde Llamadas' }); })
   .then(function(q){ p.empresa_id = empresaId; LL.prueba = q; LL.lugares = [1,2,3,4,5]; llPilotoListo(id, adm, nom);
     var t = $('lpl-txt'); if(t) t.value = t.value.replace('5 lugares sin costo por 15 días', '5 lugares sin costo por 15 días, con todos los cursos y diplomados'); })
   .catch(function(e){ b.disabled = false; b.textContent = 'Crear la prueba'; av.innerHTML = plnErr(e); });
};
llInvitar = function(id){
  var q = LL.prueba, filas = [], b = $('lpp-btn');
  for(var i=0;i<5;i++){
    if(!$('lpp-n'+i)) break;
    var n = $('lpp-n'+i).value.trim(), c = $('lpp-c'+i).value.trim();
    if(!n && !c) continue;
    if(!n || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)){ $('lpp-aviso').innerHTML = '<div class="aviso aviso-error">Revisa el nombre y el correo de la persona '+(i+1)+'.</div>'; return; }
    filas.push({ n:n, c:c });
  }
  if(!filas.length || !q){ cerrarModal(); llPintarFicha(id); return; }
  b.disabled = true; b.textContent = 'Registrando…';
  filas.reduce(function(pr, f){ return pr.then(function(){
      return Nube.empresaRpc('plan_asignar_lugar', { p_plan:q.id, p_nombre:f.n, p_correo:f.c })
        .then(function(x){ return Nube.funcionServidor('tienda', { accion:'plan_invitar', lugarId:x.id }); });
    }); }, Promise.resolve())
    .then(function(){ $('lpp-aviso').innerHTML = '<div class="aviso aviso-ok">Listo: '+filas.length+' persona'+(filas.length===1?'':'s')+' registrada'+(filas.length===1?'':'s')+'. A cada una le llegó su acceso por correo.</div>'; b.textContent = 'Registradas ✓'; })
    .catch(function(e){ b.disabled = false; b.textContent = 'Registrar personas'; $('lpp-aviso').innerHTML = plnErr(e); });
};

/* Administración: solicitudes de más días de las pruebas nuevas, junto a las viejas. */
var _plnCargarAdminPb = plnCargarAdmin;
plnCargarAdmin = function(){
  return _plnCargarAdminPb().then(function(){
    return Nube.tabla('empresas_planes?select=id,empresa_id,extension_dias,extension_motivo,extension_en&estado=eq.prueba&extension_estado=eq.pendiente')
      .then(function(r){ PLN.extPruebas = r || []; oprPintarExtensiones(); }).catch(function(){});
  });
};
var _oprPintarExtensionesPb = oprPintarExtensiones;
oprPintarExtensiones = function(){
  var guardadas = PLN.extensiones || [];
  PLN.extensiones = guardadas.concat((PLN.extPruebas || []).map(function(q){
    return { id:'plan:' + q.id, empresa:plnNombreEmpresa(q.empresa_id), extension_dias:q.extension_dias, extension_motivo:q.extension_motivo, extension_en:q.extension_en };
  }));
  _oprPintarExtensionesPb();
  PLN.extensiones = guardadas;
};
var _oprResolverExtPb = oprResolverExt;
oprResolverExt = function(id, si){
  if(String(id).indexOf('plan:') !== 0) return _oprResolverExtPb(id, si);
  Nube.empresaRpc('prueba_resolver_extension', { p_plan:id.slice(5), p_aprobar:si })
    .then(function(){ return plnCargarAdmin(); }).catch(function(e){ alert(e.message); });
};

/* ---------- La persona que estudia con la prueba ---------- */
function miPruebaVigente(){ var p = BD.miPlan; return p && p.estado === 'prueba' && p.vigente_hasta && new Date(p.vigente_hasta) >= new Date() ? p : null; }
var _miPlanVigentePb = miPlanVigente;
miPlanVigente = function(){ return _miPlanVigentePb() || miPruebaVigente(); };
var _textoIncluidoPb = textoIncluido;
textoIncluido = function(){ return miPruebaVigente() && !_miPlanVigentePb() ? 'Incluido en la prueba de tu empresa' : _textoIncluidoPb(); };
var _avisoMembresiaFichaPb = avisoMembresiaFicha;
avisoMembresiaFicha = function(c){
  var p = miPruebaVigente();
  if(p && !_miPlanVigentePb() && !ruta(c.id)) return '<div class="aviso aviso-ok" style="margin-top:14px">Este programa está <b>incluido en la prueba de '+esc(p.empresa)+'</b> hasta el '+
    esc(fechaLarga(new Date(new Date(p.vigente_hasta).getTime() - 864e5).toISOString().slice(0,10)))+'. Tu avance se guarda; la constancia se libera cuando tu empresa active su plan.</div>';
  return _avisoMembresiaFichaPb(c);
};
var _bloqueoConstanciaPb = constanciaBloqueadaPorMembresia;
constanciaBloqueadaPorMembresia = function(c){
  var ins = inscripcionPropia(c.id), p = BD.miPlan;
  if(ins && ins.estatus === 'empresa' && p && (p.estado === 'prueba' || !(Number(p.pagos_aprobados) >= 1)))
    return 'Ya terminaste. Lo tomaste en la prueba de <b>'+esc(p.empresa)+'</b>: la constancia se libera en cuanto tu empresa active su plan. Tu avance está guardado.';
  return _bloqueoConstanciaPb(c);
};
