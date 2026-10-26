/* Instituto Mara — Administración → Prospectos → Alumnos (20 oct 2026).
   Fase 1 de «Campañas»: una sola lista de personas que va creciendo.
   · Se llena sola con las cuentas del aula; se agregan personas a mano o por CSV
     (anuncios, DM, WhatsApp, eventos), sin duplicar por correo o teléfono.
   · Etiquetas calculadas en el servidor: sin cuenta, registrado sin compra,
     alumno, egresado, con membresía, por su empresa.
   · Ficha con historial, mensaje de WhatsApp listo y «No quiere promociones».
   Requiere backend/prospectos-alumnos-20261020.sql. Se carga después de
   prospectos.js y llamadas.js. */

var AP = { lista:null, contactos:[], f:{ q:'', tipo:'', origen:'', estado:'', promo:'', prog:'' }, csv:null, cola:null, idx:null };
if(window.PR && !PR.tab) PR.tab = 'empresas';

var AP_ETQ = {
  sin_cuenta:['Sin cuenta','gris'], sin_compra:['Registrado sin compra','alerta'], alumno:['Alumno','ok'],
  egresado:['Egresado','tur'], membresia:['Con membresía','tur'], empresa:['Por su empresa','gris']
};
var AP_ESTADOS = { nuevo:'Sin contactar', contactado:'Contactado', respondio:'Respondió', inscrito:'Inscrito', no_interesa:'No le interesó' };
var AP_COLOR = { nuevo:'gris', contactado:'alerta', respondio:'tur', inscrito:'ok', no_interesa:'error' };
var AP_ORIGEN = { registro:'Se registró en el aula', sitio:'Sitio web', anuncio:'Anuncio', instagram:'Instagram', facebook:'Facebook',
  tiktok:'TikTok', whatsapp:'WhatsApp', evento:'Evento', referido:'Referido', otro:'Otro' };
var AP_CANAL = { correo:'Correo', whatsapp:'WhatsApp', llamada:'Llamada', instagram:'Instagram', facebook:'Facebook', otro:'Otro' };
var AP_ICONO = { correo:'✉', whatsapp:'💬', llamada:'☎', instagram:'📷', facebook:'📘', otro:'•' };

/* ---------- Datos ---------- */
function apCargar(){
  return Promise.all([
    Nube.tabla('rpc/alumnos_prospectos_lista', { metodo:'POST', cuerpo:{} }),
    Nube.tabla('alumnos_contactos?select=*&order=fecha.asc&limit=20000')
  ]).then(function(r){ AP.lista = r[0] || []; AP.contactos = r[1] || []; AP.idx = null; });
}
function apHuella(){ return JSON.stringify([AP.lista, AP.contactos]); }
function apPorId(id){ return (AP.lista||[]).filter(function(p){ return p.id === id; })[0]; }
function apContactos(id){
  if(!AP.idx){ AP.idx = {}; AP.contactos.forEach(function(c){ (AP.idx[c.persona_id] = AP.idx[c.persona_id] || []).push(c); }); }
  return AP.idx[id] || [];
}
function apNombre(p){ return p.nombre || p.correo || p.telefono || 'Sin nombre'; }
function apPila(p){ var n = String(p.nombre||'').trim().split(/\s+/)[0] || ''; return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : ''; }
function apNumWa(p){ var t = String(p.telefono||'').replace(/\D/g,''); if(t.length === 10) t = '52' + t; return t.length >= 12 ? t : ''; }
function apTiene(p, e){ return (p.etiquetas||[]).indexOf(e) >= 0; }
function apProg(id){ var c = id && curso(id); return c ? c.nombre : ''; }
function apAula(){ return (BD.config.urlPublica || 'https://institutomara.com').replace(/\/$/, '') + '/plataforma/index.html'; }
function apSitio(){ return (BD.config.urlPublica || 'https://institutomara.com').replace(/\/$/, '') + '/sitio-web/'; }
function apMuestra(id){ return id && curso(id) && !ruta(id) ? apAula() + '?muestra=' + encodeURIComponent(id) : ''; }
function apEtiquetas(p){
  return (p.etiquetas||[]).map(function(e){ var x = AP_ETQ[e]; return x ? '<span class="etiqueta '+x[1]+'" style="margin:0 4px 4px 0">'+x[0]+'</span>' : ''; }).join('');
}
function apUltimo(p){ var h = apContactos(p.id); return h.length ? h[h.length - 1] : null; }

/* ---------- Pestañas Empresas · Alumnos ---------- */
function apPestanas(act){
  var b = function(k, t){ return '<button class="'+(act===k?'on':'')+'" aria-pressed="'+(act===k)+'" onclick="apTab(\''+k+'\')">'+t+'</button>'; };
  return '<div class="chips-aula" style="margin:0 0 16px">'+b('empresas','🏢 Empresas')+b('alumnos','🎓 Alumnos')+'</div>';
}
function apTab(t){ PR.tab = t; estado.prospectoId = null; estado.apId = null; pintar(); window.scrollTo(0, 0); }

var _vistaAdminProspectosAp = vistaAdminProspectos;
vistaAdminProspectos = function(){
  if(!sesion || sesion.rol !== 'admin') return _vistaAdminProspectosAp();
  if(PR.tab === 'alumnos') return estado.apId ? apVistaFicha() : apVistaLista();
  var h = _vistaAdminProspectosAp();
  if(estado.prospectoId || !h) return h;
  return h.replace('<div class="seccion">', '<div class="seccion">' + apPestanas('empresas'));
};
var _irBaseAlumnosProspectos = ir;
ir = function(v, datos){
  if(v === 'admin-prospectos' && !(datos && datos.apId)) estado.apId = null;
  return _irBaseAlumnosProspectos(v, datos);
};

/* ---------- Lista ---------- */
function apVistaLista(){
  var habia = !!AP.lista, antes = habia ? apHuella() : '';
  setTimeout(function(){
    if(habia) apPintarLista();
    apCargar().then(function(){
      if(estado.vista !== 'admin-prospectos' || PR.tab !== 'alumnos' || estado.apId) return;
      if(!habia) apPintarLista();
      else if(apHuella() !== antes) repintarConservando(apPintarLista);
    }).catch(function(e){
      if(habia) return;
      var c = $('ap-datos'); if(c) c.innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+
        '<br><small>Si dice que no existe la función o la tabla, falta ejecutar backend/prospectos-alumnos-20261020.sql en Supabase.</small></div>';
    });
  }, 0);
  return '<div class="seccion">'+apPestanas('alumnos')+'<div class="encabezado-fila"><div><h2>Prospectos de alumnos</h2>'+
    '<p class="sub" style="margin:0">Cuentas del aula y personas interesadas: quiénes son, qué les interesa y cómo vas con cada una.</p></div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-linea" onclick="apAgregar()">Agregar persona</button>'+
    '<button class="btn btn-mor" onclick="apSubirCSV()">Subir CSV</button></div></div><div id="ap-datos">'+(habia ? '' : 'Cargando…')+'</div></div>';
}

var AP_FILTROS = {
  tipo: { rot:'Tipo', ops: Object.keys(AP_ETQ).map(function(k){ return [k, AP_ETQ[k][0], function(p){ return apTiene(p, k); }]; }) },
  estado: { rot:'Seguimiento', ops: Object.keys(AP_ESTADOS).map(function(k){ return [k, AP_ESTADOS[k], function(p){ return p.estado === k; }]; }) },
  origen: { rot:'Origen', ops: Object.keys(AP_ORIGEN).map(function(k){ return [k, AP_ORIGEN[k], function(p){ return p.origen === k; }]; }) },
  promo: { rot:'Datos y permisos', ops:[
    ['si','Acepta promociones', function(p){ return !p.sin_promociones; }],
    ['no','No quiere promociones', function(p){ return !!p.sin_promociones; }],
    ['correo','Con correo', function(p){ return !!p.correo; }],
    ['tel','Con WhatsApp', function(p){ return !!apNumWa(p); }],
    ['sintel','Sin teléfono', function(p){ return !apNumWa(p); }] ] }
};
function apPasa(p, g, v){
  if(!v) return true;
  var op = AP_FILTROS[g].ops.filter(function(o){ return o[0] === v; })[0];
  return !op || op[2](p);
}
function apFiltrados(omitir){
  var f = AP.f, q = prNorm(f.q);
  return (AP.lista||[]).filter(function(p){
    if(f.prog && p.programa_interes !== f.prog) return false;
    for(var g in AP_FILTROS){ if(g !== omitir && !apPasa(p, g, f[g])) return false; }
    return !q || prNorm([p.nombre, p.correo, p.telefono, apProg(p.programa_interes), p.notas, p.lote].join(' ')).indexOf(q) >= 0;
  });
}
function apFiltro(g, v){ AP.f[g] = AP.f[g] === v ? '' : v; apPintarFiltros(); apPintarTabla(); }
function apLimpiar(){ AP.f = { q:'', tipo:'', origen:'', estado:'', promo:'', prog:'' }; apPintarLista(); }
var _apBuscarT = null;
function apBuscar(v){ AP.f.q = v; clearTimeout(_apBuscarT); _apBuscarT = setTimeout(function(){ apPintarFiltros(); apPintarTabla(); }, 150); }

function apPintarLista(){
  var caja = $('ap-datos'); if(!caja || !AP.lista) return;
  var L = AP.lista, n = function(fn){ return L.filter(fn).length; };
  var met = function(rot, val, pie){ return '<div class="metrica"><div class="rot">'+rot+'</div><div class="val">'+val+'</div><div class="pie">'+pie+'</div></div>'; };
  var progs = {}; L.forEach(function(p){ if(p.programa_interes) progs[p.programa_interes] = (progs[p.programa_interes]||0) + 1; });
  caja.innerHTML = '<div class="rejilla rejilla-4" style="margin:6px 0 18px">'+
      met('Personas', L.length, n(function(p){ return apTiene(p,'sin_cuenta'); })+' sin cuenta en el aula')+
      met('Registrados sin compra', n(function(p){ return apTiene(p,'sin_compra'); }), 'crearon cuenta y no han comprado')+
      met('Alumnos', n(function(p){ return apTiene(p,'alumno'); }), n(function(p){ return apTiene(p,'egresado'); })+' egresados · '+n(function(p){ return apTiene(p,'membresia'); })+' con membresía')+
      met('Respondieron', n(function(p){ return p.estado === 'respondio'; }), n(function(p){ return p.estado === 'nuevo'; })+' sin contactar · '+n(function(p){ return p.sin_promociones; })+' sin promociones')+
    '</div>'+
    '<div class="fila" style="margin-bottom:8px"><div class="campo" style="margin:0"><label for="ap-q">Buscar</label><input id="ap-q" placeholder="Nombre, correo, teléfono, programa…" value="'+esc(AP.f.q)+'" oninput="apBuscar(this.value)"></div>'+
      '<div class="campo" style="margin:0"><label for="ap-p">Programa de interés</label><select id="ap-p" onchange="AP.f.prog=this.value;apPintarFiltros();apPintarTabla()"><option value="">Todos</option>'+
        Object.keys(progs).sort(function(a,b){ return apProg(a).localeCompare(apProg(b)); }).map(function(k){ return '<option value="'+esc(k)+'"'+(AP.f.prog===k?' selected':'')+'>'+esc(apProg(k)||k)+' ('+progs[k]+')</option>'; }).join('')+'</select></div></div>'+
    '<div id="ap-filtros" style="margin:4px 0 6px"></div><div id="ap-tabla"></div>';
  apPintarFiltros(); apPintarTabla();
}
function apPintarFiltros(){
  var caja = $('ap-filtros'); if(!caja) return;
  var activos = ['tipo','estado','origen','promo'].filter(function(g){ return AP.f[g]; }).length;
  caja.innerHTML = '<p style="color:var(--gris);font-size:.85rem;margin:0 0 8px">Elige solo lo que te interese; los renglones que dejes sin elegir no filtran. Lo que elijas se combina.</p>'+
    '<div style="display:grid;grid-template-columns:minmax(110px,150px) 1fr;gap:6px 12px;align-items:start">'+
    Object.keys(AP_FILTROS).map(function(g){
      var F = AP_FILTROS[g], base = apFiltrados(g);
      var ops = F.ops.map(function(o){
        var k = base.filter(o[2]).length, on = AP.f[g] === o[0];
        if(g === 'origen' && !k && !on) return '';
        return '<button class="'+(on?'on':'')+'" title="'+(on?'Quitar este filtro':'Filtrar')+'" onclick="apFiltro(\''+g+'\',\''+o[0]+'\')">'+(on?'✓ ':'')+esc(o[1])+' <small>'+k+'</small>'+(on?' ✕':'')+'</button>';
      }).join('');
      return '<b style="font-size:.9rem;padding-top:9px">'+F.rot+'</b><div class="chips-aula" style="margin:0">'+(ops || '<small style="color:var(--gris);padding-top:9px">—</small>')+'</div>';
    }).join('')+'</div>'+
    (activos || AP.f.prog || AP.f.q ? '<button class="btn btn-fantasma btn-sm" style="margin-top:6px" onclick="apLimpiar()">✕ Quitar todos los filtros</button>' : '');
}
function apSeguimientoTxt(p){
  var h = apContactos(p.id), u = h[h.length - 1];
  if(!u) return '<span style="color:var(--gris)">Sin contacto</span>';
  var resp = h.filter(function(c){ return c.sentido === 'entrante' && c.resultado !== 'baja'; }).pop();
  return (AP_ICONO[u.canal]||'•')+' '+h.length+(h.length === 1 ? ' contacto' : ' contactos')+' · '+prFecha(u.fecha)+
    (resp ? '<br><b style="color:#065F46">Respondió '+prFecha(resp.fecha)+' por '+esc(AP_CANAL[resp.canal]||resp.canal)+'</b>' : '');
}
function apFila(p){
  var prog = apProg(p.programa_interes);
  return '<tr><td style="min-width:190px"><a href="#" onclick="apAbrir(\''+p.id+'\');return false"><b>'+esc(apNombre(p))+'</b></a><br>'+
      '<small style="color:var(--gris)">'+esc(AP_ORIGEN[p.origen]||p.origen)+' · '+prFecha(p.registrado_en || p.creado_en)+'</small></td>'+
    '<td style="font-size:.88rem;min-width:210px">'+(p.correo ? prCopiable(p.correo, '✉') : '<small style="color:var(--gris)">Sin correo</small>')+
      (p.telefono ? '<br>'+prCopiable(String(p.telefono).replace(/\D/g,'').slice(-10), '💬') : '')+'</td>'+
    '<td style="min-width:170px">'+apEtiquetas(p)+(prog ? '<div style="font-size:.82rem;color:var(--gris)">Le interesa: '+esc(prog)+'</div>' : '')+'</td>'+
    '<td style="font-size:.86rem;min-width:160px">'+apSeguimientoTxt(p)+'</td>'+
    '<td><span class="etiqueta '+(AP_COLOR[p.estado]||'gris')+'">'+esc(AP_ESTADOS[p.estado]||p.estado)+'</span>'+
      (p.sin_promociones ? '<div style="font-size:.8rem;color:var(--gris);margin-top:4px">🚫 Sin promociones</div>' : '')+'</td>'+
    '<td><button class="btn btn-linea btn-sm" onclick="apAbrir(\''+p.id+'\')">Abrir</button></td></tr>';
}
function apPintarTabla(){
  var caja = $('ap-tabla'); if(!caja) return;
  var filas = apFiltrados();
  if(!filas.length){ caja.innerHTML = '<div class="tarjeta vacio"><p>'+(AP.lista.length ? 'Nadie coincide con el filtro.' : 'Todavía no hay personas. Agrega una o sube un CSV.')+'</p></div>'; return; }
  filasPorPartes(caja, 'ap', filas.map(apFila), '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr>'+
    '<th>Persona</th><th>Contacto</th><th>Tipo</th><th>Seguimiento</th><th>Estado</th><th></th></tr></thead><tbody>',
    '</tbody></table></div></div><p style="color:var(--gris);font-size:.85rem;margin-top:8px">'+filas.length+' de '+AP.lista.length+' personas.</p>');
}

/* ---------- Ficha ---------- */
function apAbrir(id){ AP.cola = apFiltrados().map(function(p){ return p.id; }); estado.apId = id; pintar(); window.scrollTo(0, 0); }
function apSiguiente(paso){
  var c = AP.cola || [], i = c.indexOf(estado.apId);
  if(i < 0 || !c[i + paso]) return;
  estado.apId = c[i + paso]; pintar(); window.scrollTo(0, 0);
}
function apVistaFicha(){
  var id = estado.apId;
  setTimeout(function(){
    (AP.lista ? Promise.resolve() : apCargar()).then(function(){ apPintarFicha(id); })
      .catch(function(e){ var c = $('af-cab'); if(c) c.innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
  }, 0);
  var c = AP.cola || [], i = c.indexOf(id);
  var nav = i >= 0 && c.length > 1 ? '<div style="display:flex;gap:8px;align-items:center"><button class="btn btn-fantasma btn-sm"'+(i>0?'':' disabled')+' onclick="apSiguiente(-1)">‹ Anterior</button>'+
    '<span style="color:var(--gris);font-size:.9rem">'+(i+1)+' de '+c.length+'</span>'+
    '<button class="btn btn-mor btn-sm"'+(i<c.length-1?'':' disabled')+' onclick="apSiguiente(1)">Siguiente ›</button></div>' : '';
  return '<div class="seccion"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">'+
    '<button class="btn btn-fantasma btn-sm" onclick="estado.apId=null;pintar()">← Alumnos</button>'+nav+'</div>'+
    '<div id="af-cab">Cargando…</div>'+
    '<div class="rejilla" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px;margin-top:18px;align-items:start">'+
      '<div style="min-width:0"><div class="tarjeta" id="af-msg"></div>'+
        '<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:10px">Historial</h3><div id="af-hist"></div></div></div>'+
      '<div style="min-width:0"><div class="tarjeta" id="af-datos"></div></div>'+
    '</div></div>';
}
function apPintarFicha(id){
  var p = apPorId(id), cab = $('af-cab'); if(!cab) return;
  if(!p){ cab.innerHTML = '<div class="aviso aviso-error">No encontré a esa persona.</div>'; return; }
  cab.innerHTML = '<div class="encabezado-fila"><div><h2>'+esc(apNombre(p))+'</h2><div style="margin-top:6px">'+apEtiquetas(p)+'</div></div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><select id="af-estado" aria-label="Estado" onchange="apCambiarEstado(\''+id+'\',this.value)">'+
      Object.keys(AP_ESTADOS).map(function(k){ return '<option value="'+k+'"'+(p.estado===k?' selected':'')+'>'+AP_ESTADOS[k]+'</option>'; }).join('')+'</select>'+
    (p.sin_promociones
      ? '<button class="btn btn-linea btn-sm" onclick="apPromos(\''+id+'\',false)">Volver a permitir promociones</button>'
      : '<button class="btn btn-fantasma btn-sm" onclick="apPromos(\''+id+'\',true)">🚫 Pidió no recibir promociones</button>')+'</div></div>'+
    (p.sin_promociones ? '<div class="aviso aviso-info" style="margin-top:10px">🚫 Pidió no recibir promociones'+(p.baja_en ? ' el '+prFecha(p.baja_en) : '')+'. Las campañas no le escribirán; los correos de su cuenta (confirmación, recibos, constancias) le siguen llegando.</div>' : '')+
    '<div style="margin-top:8px;font-size:.9rem">'+apSeguimientoTxt(p)+'</div>';
  apPintarDatos(p); apPintarHistorial(p); apPintarMensaje(p);
}
function apPintarDatos(p){
  var caja = $('af-datos'); if(!caja) return;
  var prog = apProg(p.programa_interes), mu = apMuestra(p.programa_interes);
  var comprados = (p.cursos||[]).map(function(cid){ var c = curso(cid); return '<li>'+esc(c ? c.nombre : cid)+'</li>'; }).join('');
  caja.innerHTML = '<div class="encabezado-fila" style="margin-bottom:10px"><h3 style="color:var(--tinta);margin:0">Datos</h3><button class="btn btn-fantasma btn-sm" onclick="apEditar(\''+p.id+'\')">Editar</button></div>'+
    prCampo('Correo', p.correo, prCopiable(p.correo))+
    prCampo('Teléfono / WhatsApp', p.telefono, prCopiable(String(p.telefono||'').replace(/\D/g,'').slice(-10)))+
    prCampo('Origen', AP_ORIGEN[p.origen] || p.origen)+
    prCampo('Programa de interés', prog, esc(prog) + (mu ? '<br><a href="'+esc(mu)+'" target="_blank" rel="noopener">Ver su lección gratis</a> '+
      '<button class="btn btn-fantasma btn-sm" style="padding:2px 7px" title="Copiar enlace" aria-label="Copiar enlace de la lección gratis" onclick="prCopiar(this,\''+esc(mu)+'\')">⧉</button>' : ''))+
    (p.usuario_id
      ? prCampo('Cuenta en el aula', 1, 'Creada el '+prFecha(p.registrado_en)+' · último acceso: '+esc(haceCuanto(p.ultimo_acceso).toLowerCase()))+
        prCampo('Programas comprados', comprados ? 1 : '', '<ul style="margin-left:18px">'+comprados+'</ul>')+
        prCampo('Último programa que estudió', apProg(p.ultimo_curso))+
        prCampo('Constancias', p.constancias || '')+
        prCampo('Membresía', apTiene(p,'membresia') ? 1 : '', 'Activa'+(p.membresia_hasta ? ' hasta el '+prFecha(p.membresia_hasta) : ''))
      : prCampo('Cuenta en el aula', 1, '<span style="color:var(--gris)">Todavía no crea cuenta. Si se registra con este correo, se liga sola.</span>'))+
    prCampo('Notas', p.notas, esc(p.notas||'').replace(/\n/g,'<br>'))+
    prCampo('En la lista desde', prFecha(p.creado_en) + (p.lote ? ' · '+p.lote : ''))+
    (!p.usuario_id ? '<button class="btn btn-fantasma btn-sm" style="color:#B91C1C" onclick="apBorrar(\''+p.id+'\')">Quitar de la lista</button>' : '');
}
function apPintarHistorial(p){
  var caja = $('af-hist'); if(!caja) return;
  var h = apContactos(p.id).slice().reverse();
  caja.innerHTML = (h.length ? '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">'+h.map(function(c){
      var ent = c.sentido === 'entrante';
      return '<div style="border-left:3px solid '+(ent ? '#059669' : c.resultado === 'rebotó' ? '#DC2626' : 'var(--morado)')+';padding:4px 10px">'+
        '<div style="display:flex;justify-content:space-between;gap:8px"><b>'+(ent ? 'Respuesta' : 'Contacto')+' · '+esc(AP_CANAL[c.canal]||c.canal)+'</b>'+
        '<span style="color:var(--gris);font-size:.85rem;white-space:nowrap">'+prFecha(c.fecha)+' <button class="btn btn-fantasma btn-sm" style="padding:0 6px" title="Borrar registro" aria-label="Borrar registro" onclick="apBorrarContacto(\''+p.id+'\',\''+c.id+'\')">×</button></span></div>'+
        (c.asunto ? '<div style="font-size:.88rem">'+esc(c.asunto)+'</div>' : '')+
        (c.resumen ? '<div style="font-size:.88rem;color:var(--gris)">'+esc(c.resumen)+'</div>' : '')+
        '<div style="font-size:.8rem;color:var(--gris)">'+esc(c.resultado||'')+(c.automatico ? ' · automático' : '')+'</div></div>';
    }).join('')+'</div>' : '<p style="color:var(--gris);margin-bottom:12px">Sin contactos todavía.</p>')+
    '<details><summary style="cursor:pointer;font-weight:700;color:var(--morado)">Registrar un contacto o respuesta</summary>'+
    '<div class="fila" style="margin-top:10px"><div class="campo"><label for="ac-canal">Canal</label><select id="ac-canal">'+Object.keys(AP_CANAL).map(function(k){ return '<option value="'+k+'">'+AP_CANAL[k]+'</option>'; }).join('')+'</select></div>'+
    '<div class="campo"><label for="ac-sent">¿Qué pasó?</label><select id="ac-sent"><option value="saliente|enviado">Yo le escribí o llamé</option><option value="entrante|respondió">Me respondió</option>'+
      '<option value="saliente|rebotó">El correo rebotó</option><option value="saliente|sin respuesta">Llamé y no contestó</option></select></div>'+
    '<div class="campo"><label for="ac-fecha">Fecha</label><input id="ac-fecha" type="date" value="'+hoy()+'"></div></div>'+
    '<div class="campo"><label for="ac-nota">Nota</label><input id="ac-nota" maxlength="300" placeholder="Ej. le interesa el diplomado de Tanatología, pagará en noviembre"></div>'+
    '<button class="btn btn-linea btn-sm" onclick="apRegistrar(\''+p.id+'\')">Guardar</button></details>';
}

/* Mensaje de WhatsApp según quién es (se puede editar antes de abrirlo). */
function apMensaje(p){
  var n = apPila(p), hola = 'Hola' + (n ? ' ' + n : '') + ', soy Héctor de Instituto Mara.';
  var prog = apProg(p.programa_interes), mu = apMuestra(p.programa_interes);
  var ult = apProg(p.ultimo_curso) || apProg((p.cursos||[])[0]);
  if(apTiene(p,'egresado'))
    return hola + ' ¡Felicidades otra vez por terminar ' + (ult ? '*' + ult + '*' : 'tu programa') + '! 🎓\n\n' +
      (prog && (p.cursos||[]).indexOf(p.programa_interes) < 0
        ? 'Vi que también te interesa *' + prog + '*.' + (mu ? ' Puedes probar una lección gratis aquí: ' + mu : '') + '\n\n¿Te ayudo a inscribirte?'
        : 'Si quieres seguir aprendiendo, te comparto el catálogo: ' + apSitio() + '\n\n¿Qué tema te gustaría estudiar ahora? Te recomiendo por dónde seguir.');
  if(apTiene(p,'alumno'))
    return hola + ' ¿Cómo vas con ' + (ult ? '*' + ult + '*' : 'tu programa') + '?\n\nPuedes seguir donde te quedaste aquí: ' + apAula() + '\n\nSi tienes cualquier duda del contenido, con gusto te ayudo.';
  if(apTiene(p,'membresia'))
    return hola + ' Te recuerdo que con tu membresía puedes tomar los programas incluidos sin costo extra: ' + apAula() + '\n\n¿Ya elegiste por cuál empezar? Si me dices qué te interesa, te recomiendo uno.';
  if(apTiene(p,'sin_compra'))
    return hola + (prog
      ? ' Vi que creaste tu cuenta en el aula y que te interesa *' + prog + '*.' + (mu ? ' Puedes probar una lección gratis aquí: ' + mu : '') + '\n\n¿Tienes alguna duda para inscribirte?'
      : ' Vi que creaste tu cuenta en el aula. ¿Encontraste el programa que buscabas?\n\nTe comparto el catálogo: ' + apSitio() + '\n\nSi me dices qué te interesa, te recomiendo por dónde empezar.');
  return hola + (prog
    ? ' Gracias por tu interés en *' + prog + '*.' + (mu ? ' Te comparto una lección gratis para que lo pruebes sin costo: ' + mu : ' Te comparto la información: ' + apSitio()) + '\n\n¿Tienes alguna duda sobre el programa?'
    : ' Gracias por tu interés en nuestros cursos y diplomados en línea. Te comparto el catálogo: ' + apSitio() + '\n\n¿Qué tema te gustaría estudiar? Te recomiendo por dónde empezar.');
}
function apPintarMensaje(p){
  var caja = $('af-msg'); if(!caja) return;
  var num = apNumWa(p);
  if(p.estado === 'no_interesa'){ caja.innerHTML = '<h3 style="color:var(--tinta);margin-bottom:8px">WhatsApp</h3><p style="color:var(--gris)">Le marcaste «No le interesó»: ya no se le escribe. Si vuelve a buscarnos, cambia su estado.</p>'; return; }
  if(p.sin_promociones){ caja.innerHTML = '<h3 style="color:var(--tinta);margin-bottom:8px">WhatsApp</h3><p style="color:var(--gris)">Pidió no recibir promociones. Si te escribe con una duda, contéstale desde tu WhatsApp normalmente.</p>'; return; }
  caja.innerHTML = '<h3 style="color:var(--tinta);margin-bottom:8px">Mensaje de WhatsApp</h3>'+
    (num
      ? '<p style="color:var(--gris);font-size:.88rem;margin-bottom:8px">Listo según quién es. Cámbialo si quieres antes de abrirlo.</p>'+
        '<textarea id="af-wa" rows="8" style="width:100%">'+esc(apMensaje(p))+'</textarea>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn btn-tur" onclick="apAbrirWa(\''+p.id+'\')">Abrir WhatsApp y registrar</button>'+
        '<button class="btn btn-fantasma btn-sm" onclick="prCopiar(this,$(\'af-wa\').value)">Copiar texto</button></div>'
      : '<p style="color:var(--gris)">No tiene teléfono registrado. Agrégalo con «Editar» para mandarle el mensaje.</p>');
}
function apAbrirWa(id){
  var p = apPorId(id), num = apNumWa(p), txt = ($('af-wa').value || '').trim();
  if(!num || !txt) return;
  window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(txt), '_blank', 'noopener');
  apInsertarContacto({ persona_id:id, canal:'whatsapp', sentido:'saliente', resultado:'enviado', creado_por:sesion.id,
    resumen:txt.length > 160 ? txt.slice(0, 157) + '…' : txt }).then(function(){ apPintarFicha(id); });
}

/* ---------- Acciones ---------- */
function apActualizarFila(id){
  return apCargar().then(function(){ if(estado.apId === id) apPintarFicha(id); });
}
function apInsertarContacto(fila){
  return Nube.tabla('alumnos_contactos', { metodo:'POST', prefer:'return=representation', cuerpo:fila })
    .then(function(r){
      if(r && r[0]){ AP.contactos.push(r[0]); AP.idx = null; }
      return Nube.tabla('alumnos_prospectos?id=eq.' + fila.persona_id + '&select=estado,sin_promociones,baja_en').then(function(x){
        var p = apPorId(fila.persona_id); if(p && x && x[0]) Object.assign(p, x[0]);
      });
    }).catch(function(e){ alert(e.message); });
}
function apRegistrar(id){
  var v = $('ac-sent').value.split('|');
  apInsertarContacto({ persona_id:id, canal:$('ac-canal').value, sentido:v[0], resultado:v[1], resumen:$('ac-nota').value.trim() || null,
    fecha:new Date($('ac-fecha').value + 'T' + new Date().toTimeString().slice(0,8)).toISOString(), creado_por:sesion.id })
    .then(function(){ apPintarFicha(id); });
}
function apBorrarContacto(pid, cid){
  if(!confirm('¿Borrar este registro del historial?')) return;
  Nube.tabla('alumnos_contactos?id=eq.' + cid, { metodo:'DELETE', prefer:'return=minimal' })
    .then(function(){ AP.contactos = AP.contactos.filter(function(c){ return c.id !== cid; }); AP.idx = null; apPintarFicha(pid); })
    .catch(function(e){ alert(e.message); });
}
function apCambiarEstado(id, v){
  Nube.tabla('alumnos_prospectos?id=eq.' + id, { metodo:'PATCH', prefer:'return=minimal', cuerpo:{ estado:v } })
    .then(function(){ apPorId(id).estado = v; apPintarFicha(id); })
    .catch(function(e){ alert(e.message); apPintarFicha(id); });
}
function apPromos(id, sinPromos){
  var p = apPorId(id);
  if(sinPromos && !confirm('¿Marcar que '+apNombre(p)+' pidió no recibir promociones? Las campañas ya no le escribirán.')) return;
  Nube.tabla('alumnos_prospectos?id=eq.' + id, { metodo:'PATCH', prefer:'return=representation', cuerpo:{ sin_promociones:sinPromos } })
    .then(function(x){
      if(x && x[0]){ p.sin_promociones = x[0].sin_promociones; p.baja_en = x[0].baja_en; }
      if(sinPromos) return apInsertarContacto({ persona_id:id, canal:'otro', sentido:'entrante', resultado:'baja', creado_por:sesion.id,
        resumen:'Pidió no recibir promociones (registrado a mano).' });
    }).then(function(){ apPintarFicha(id); })
    .catch(function(e){ alert(e.message); });
}
function apBorrar(id){
  var p = apPorId(id);
  if(!confirm('¿Quitar a '+apNombre(p)+' de la lista? Se borra también su historial. Esto no se puede deshacer.')) return;
  Nube.tabla('alumnos_prospectos?id=eq.' + id, { metodo:'DELETE', prefer:'return=minimal' })
    .then(function(){ AP.lista = AP.lista.filter(function(x){ return x.id !== id; }); estado.apId = null; pintar(); })
    .catch(function(e){ alert(e.message); });
}

/* Programas para elegir (cursos, diplomados y rutas publicados). */
function apOpcionesProg(sel){
  return '<option value="">— Ninguno —</option>' + BD.cursos.filter(function(c){ return c.publicado && Number(c.precio) > 0; })
    .sort(function(a, b){ return a.nombre.localeCompare(b.nombre); })
    .map(function(c){ return '<option value="'+esc(c.id)+'"'+(c.id===sel?' selected':'')+'>'+esc(c.nombre)+(ruta(c.id) ? ' (ruta)' : '')+'</option>'; }).join('');
}
function apOpcionesOrigen(sel, conRegistro){
  return Object.keys(AP_ORIGEN).filter(function(k){ return conRegistro || k !== 'registro'; })
    .map(function(k){ return '<option value="'+k+'"'+(k===sel?' selected':'')+'>'+AP_ORIGEN[k]+'</option>'; }).join('');
}
function apEditar(id){
  var p = apPorId(id);
  abrirModal('Editar '+apNombre(p),
    '<div class="campo"><label for="ae-nombre">Nombre</label><input id="ae-nombre" value="'+esc(p.nombre||'')+'"></div>'+
    '<div class="fila"><div class="campo"><label for="ae-correo">Correo</label><input id="ae-correo" type="email" value="'+esc(p.correo||'')+'"'+(p.usuario_id ? ' disabled' : '')+'>'+
      (p.usuario_id ? '<small style="color:var(--gris)">Es el correo de su cuenta; se cambia en Alumnos.</small>' : '')+'</div>'+
    '<div class="campo"><label for="ae-tel">Teléfono / WhatsApp</label><input id="ae-tel" type="tel" value="'+esc(p.telefono||'')+'"></div></div>'+
    '<div class="fila"><div class="campo"><label for="ae-origen">Origen</label><select id="ae-origen">'+apOpcionesOrigen(p.origen, p.origen === 'registro')+'</select></div>'+
    '<div class="campo"><label for="ae-prog">Programa de interés</label><select id="ae-prog">'+apOpcionesProg(p.programa_interes)+'</select></div></div>'+
    '<div class="campo"><label for="ae-notas">Notas</label><textarea id="ae-notas" rows="3">'+esc(p.notas||'')+'</textarea></div><div id="ae-aviso"></div>',
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cancelar</button><button class="btn btn-mor" onclick="apGuardarEdicion(\''+id+'\')">Guardar</button>');
}
function apGuardarEdicion(id){
  var p = apPorId(id), v = function(k){ var x = $('ae-'+k).value.trim(); return x || null; };
  var d = { nombre:v('nombre'), telefono:v('tel'), origen:$('ae-origen').value, programa_interes:v('prog'), notas:v('notas') };
  if(!p.usuario_id) d.correo = v('correo');
  if(!p.usuario_id && !d.correo && !d.telefono){ $('ae-aviso').innerHTML = '<div class="aviso aviso-error">Necesita al menos correo o teléfono.</div>'; return; }
  if(d.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.correo)){ $('ae-aviso').innerHTML = '<div class="aviso aviso-error">Ese correo no parece válido.</div>'; return; }
  Nube.tabla('alumnos_prospectos?id=eq.' + id, { metodo:'PATCH', prefer:'return=minimal', cuerpo:d })
    .then(function(){ cerrarModal(); return apActualizarFila(id); })
    .catch(function(e){
      $('ae-aviso').innerHTML = '<div class="aviso aviso-error">'+(/duplicate|unique/i.test(e.message) ? 'Ya hay otra persona en la lista con ese correo.' : esc(e.message))+'</div>';
    });
}

/* ---------- Agregar una persona ---------- */
function apAgregar(){
  abrirModal('Agregar persona',
    '<p style="color:var(--gris);margin-bottom:12px">Para quien te escribió por un anuncio, DM, WhatsApp o en un evento. Si ya está en la lista (mismo correo o teléfono), solo se completan sus datos.</p>'+
    '<div class="campo"><label for="aa-nombre">Nombre</label><input id="aa-nombre" autocomplete="off"></div>'+
    '<div class="fila"><div class="campo"><label for="aa-correo">Correo</label><input id="aa-correo" type="email" autocomplete="off"></div>'+
    '<div class="campo"><label for="aa-tel">Teléfono / WhatsApp</label><input id="aa-tel" type="tel" autocomplete="off" placeholder="10 dígitos"></div></div>'+
    '<div class="fila"><div class="campo"><label for="aa-origen">¿De dónde llegó?</label><select id="aa-origen">'+apOpcionesOrigen('instagram')+'</select></div>'+
    '<div class="campo"><label for="aa-prog">Programa de interés</label><select id="aa-prog">'+apOpcionesProg('')+'</select></div></div>'+
    '<div class="campo"><label for="aa-notas">Notas</label><textarea id="aa-notas" rows="2" placeholder="Ej. preguntó por el precio y si dan constancia"></textarea></div>'+
    '<p style="color:var(--gris);font-size:.82rem">Agrega solo a personas que te dieron su contacto.</p><div id="aa-aviso"></div>',
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cancelar</button><button id="aa-btn" class="btn btn-mor" onclick="apGuardarNueva()">Agregar</button>');
}
function apGuardarNueva(){
  var v = function(k){ return $('aa-'+k).value.trim(); };
  var fila = { nombre:v('nombre'), correo:v('correo'), telefono:v('tel'), origen:$('aa-origen').value, programa_interes:v('prog'), notas:v('notas') };
  var aviso = function(t){ $('aa-aviso').innerHTML = '<div class="aviso aviso-error">'+t+'</div>'; };
  if(fila.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fila.correo)) return aviso('Ese correo no parece válido.');
  if(!fila.correo && fila.telefono.replace(/\D/g,'').length < 10) return aviso('Escribe un correo o un teléfono de 10 dígitos.');
  var b = $('aa-btn'); b.disabled = true; b.textContent = 'Guardando…';
  Nube.tabla('rpc/alumnos_prospectos_importar', { metodo:'POST', cuerpo:{ p_filas:[fila], p_lote:'Alta manual ' + hoy(), p_origen:fila.origen } })
    .then(function(r){
      return apCargar().then(function(){
        cerrarModal();
        var id = r && r.ids && r.ids[0];
        if(r && r.existian) alert('Esa persona ya estaba en la lista; se completaron los datos que le faltaban.');
        if(id){ AP.cola = null; estado.apId = id; pintar(); } else apPintarLista();
      });
    }).catch(function(e){ b.disabled = false; b.textContent = 'Agregar'; aviso(esc(e.message)); });
}

/* ---------- Subir CSV ---------- */
var AP_COLS = {
  nombre:['nombre','nombre completo','name','full name','alumno','cliente','contacto','persona','nombres'],
  apellido:['apellido','apellidos','last name'],
  correo:['correo','email','e mail','correo electronico','mail'],
  telefono:['telefono','celular','whatsapp','tel','movil','phone','numero','numero de telefono','numero de whatsapp'],
  origen:['origen','fuente','source','canal','medio','de donde'],
  programa:['programa','curso','programa de interes','curso de interes','interes','diplomado','le interesa'],
  notas:['notas','nota','comentarios','comentario','observaciones','mensaje']
};
function apOrigenDe(t){
  var n = prNorm(t); if(!n) return '';
  if(/insta|\big\b/.test(n)) return 'instagram';
  if(/face|\bfb\b|meta|messenger/.test(n)) return 'facebook';
  if(/tik/.test(n)) return 'tiktok';
  if(/whats|\bwa\b/.test(n)) return 'whatsapp';
  if(/anunc|\bads?\b|publicidad|campana/.test(n)) return 'anuncio';
  if(/event|feria|expo|conferencia|taller/.test(n)) return 'evento';
  if(/refer|recomend/.test(n)) return 'referido';
  if(/sitio|web|pagina|formulario/.test(n)) return 'sitio';
  return '';
}
function apSubirCSV(){
  abrirModal('Subir personas (CSV)',
    '<p style="margin-bottom:10px">Sube el archivo como lo tengas (CSV desde Excel o Google Sheets). Reconozco las columnas por su nombre: nombre, apellidos, correo, teléfono o WhatsApp, origen, programa de interés y notas.</p>'+
    '<p style="margin-bottom:12px;color:var(--gris);font-size:.9rem">No se duplica a nadie: si el correo o el teléfono ya están en la lista, solo se completan los datos que falten y conserva su historial. Cada fila necesita correo o teléfono.</p>'+
    '<div class="campo"><label for="acsv-arch">Archivo</label><input id="acsv-arch" type="file" accept=".csv,text/csv" onchange="apLeerCSV(this.files[0])"></div>'+
    '<div class="fila"><div class="campo"><label for="acsv-origen">Origen (si el archivo no lo trae)</label><select id="acsv-origen">'+apOpcionesOrigen('anuncio')+'</select></div>'+
    '<div class="campo"><label for="acsv-lote">Nombre de esta tanda</label><input id="acsv-lote" value="Carga '+hoy()+'"></div></div>'+
    '<p style="color:var(--gris);font-size:.82rem">Sube solo contactos de personas que te dieron sus datos (anuncios, mensajes, eventos). Las listas compradas dañan la reputación del correo y no cumplen la ley de datos personales.</p>'+
    '<div id="acsv-res"></div>',
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cancelar</button><button id="acsv-btn" class="btn btn-mor" disabled onclick="apImportar()">Importar</button>');
  if(!AP.lista) apCargar().catch(function(){});
}
function apLeerCSV(arch){
  if(!arch) return;
  var lector = new FileReader();
  lector.onload = function(){
    var filas = prParseCSV(String(lector.result)), res = $('acsv-res');
    if(filas.length < 2){ res.innerHTML = '<div class="aviso aviso-error">El archivo no tiene filas.</div>'; return; }
    var map = {};
    filas[0].forEach(function(h, i){
      var n = prNorm(h);
      Object.keys(AP_COLS).some(function(k){ if(AP_COLS[k].indexOf(n) >= 0 && map[k] == null){ map[k] = i; return true; } return false; });
    });
    if(map.correo == null && map.telefono == null){ res.innerHTML = '<div class="aviso aviso-error">No encontré columna de correo ni de teléfono. Revisa que el archivo tenga encabezados.</div>'; return; }
    var conocidos = {};
    (AP.lista||[]).forEach(function(p){
      if(p.correo) conocidos['c:' + p.correo.toLowerCase()] = true;
      var t = String(p.telefono||'').replace(/\D/g,'').slice(-10); if(t.length === 10) conocidos['t:' + t] = true;
    });
    var listas = [], nuevos = 0, existen = 0, invalidos = 0, repetidos = 0, enArchivo = {}, sinProg = {};
    filas.slice(1).forEach(function(f){
      var g = function(k){ var i = map[k]; return i == null ? '' : String(f[i]||'').trim(); };
      var correo = (g('correo').match(/[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+/) || [''])[0].toLowerCase();
      var tel = g('telefono'), t10 = tel.replace(/\D/g,'').slice(-10);
      if(!correo && t10.length < 10){ invalidos++; return; }
      var claves = []; if(correo) claves.push('c:' + correo); if(t10.length === 10) claves.push('t:' + t10);
      if(claves.some(function(k){ return enArchivo[k]; })){ repetidos++; return; }
      claves.forEach(function(k){ enArchivo[k] = true; });
      if(claves.some(function(k){ return conocidos[k]; })) existen++; else nuevos++;
      var prog = g('programa'), pid = prog ? prCursoDeNombre(prog) : null;
      if(prog && !pid) sinProg[prog] = true;
      var nombre = [g('nombre'), g('apellido')].filter(Boolean).join(' ');
      var notas = g('notas'); if(prog && !pid) notas = (notas ? notas + '\n' : '') + 'Le interesa: ' + prog;
      listas.push({ nombre:nombre, correo:correo, telefono:t10.length === 10 ? tel : '', origen:apOrigenDe(g('origen')), programa_interes:pid || '', notas:notas });
    });
    AP.csv = listas;
    var falta = Object.keys(sinProg);
    res.innerHTML = '<div class="aviso aviso-info"><b>'+nuevos+' nuevos</b> · '+existen+' ya estaban (se completan sus datos vacíos) · '+
      (invalidos ? invalidos+' sin correo ni teléfono válido · ' : '')+(repetidos ? repetidos+' repetidos en el archivo · ' : '')+'se importan '+listas.length+'.'+
      '<br><small>Columnas reconocidas: '+Object.keys(map).join(', ')+'.</small>'+
      (falta.length ? '<br><small>Programas que no encontré en el catálogo (se guardan en notas): '+falta.slice(0,8).map(esc).join('; ')+(falta.length>8?'…':'')+'</small>' : '')+'</div>';
    $('acsv-btn').disabled = !listas.length;
  };
  lector.readAsText(arch, 'utf-8');
}
function apImportar(){
  var d = AP.csv, b = $('acsv-btn'); if(!d || !d.length) return;
  var lote = $('acsv-lote').value.trim() || ('Carga ' + hoy()), origen = $('acsv-origen').value;
  b.disabled = true; b.textContent = 'Importando…';
  var total = { nuevos:0, existian:0, invalidos:0 }, cadena = Promise.resolve();
  for(var i=0;i<d.length;i+=400){
    (function(parte){
      cadena = cadena.then(function(){
        return Nube.tabla('rpc/alumnos_prospectos_importar', { metodo:'POST', cuerpo:{ p_filas:parte, p_lote:lote, p_origen:origen } })
          .then(function(r){ if(r){ total.nuevos += r.nuevos||0; total.existian += r.existian||0; total.invalidos += r.invalidos||0; } });
      });
    })(d.slice(i, i+400));
  }
  cadena.then(function(){ return apCargar(); })
    .then(function(){
      cerrarModal(); AP.csv = null; apPintarLista();
      alert('Listo: ' + total.nuevos + ' personas nuevas' + (total.existian ? ', ' + total.existian + ' ya estaban (datos completados)' : '') + (total.invalidos ? ', ' + total.invalidos + ' omitidas' : '') + '.');
    })
    .catch(function(e){ b.disabled = false; b.textContent = 'Importar'; $('acsv-res').innerHTML += '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
}
