/* Instituto Mara — Administración → Prospectos (13 oct 2026; seguimiento de WhatsApp 20 oct 2026).
   Campañas a empresas: carga de prospectos desde CSV sin duplicar, ficha
   completa, historial de contactos por canal y número de toque, mensajes
   listos para correo y WhatsApp, envío por Brevo y seguimientos automáticos.
   Requiere backend/prospectos-piloto.sql y la función «prospectos». */

var PR = { lista:null, contactos:[], giros:[], aj:{}, f:{ q:'', estado:'', seg:'', correo:'', wa:'', sw:'', ot:'', sg:'' }, sel:{}, msg:{}, csv:null };
var PR_ESTADOS = { nuevo:'Sin contactar', contactado:'Contactado', respondio:'Respondió', demo:'Demo agendada',
  piloto:'En piloto', cliente:'Cliente', no_interesa:'No le interesó', descartado:'Descartado', baja:'No quiere correos' };
var PR_COLOR = { nuevo:'gris', contactado:'alerta', respondio:'tur', demo:'tur', piloto:'tur', cliente:'ok', no_interesa:'error', descartado:'gris', baja:'gris' };
var PR_CANAL = { correo:'Correo', whatsapp:'WhatsApp', llamada:'Llamada', instagram:'Instagram', visita:'Visita', otro:'Otro' };
var PR_ICONO = { correo:'✉', whatsapp:'💬', llamada:'☎', instagram:'📷', visita:'🤝', otro:'•' };

function prCargar(){
  return Promise.all([
    Nube.tabla('prospectos?select=*&order=num_origen.asc.nullslast,creado_en.asc&limit=5000'),
    Nube.tabla('prospecto_contactos?select=*&order=fecha.asc&limit=20000'),
    Nube.tabla('prospecto_giros?select=*&order=segmento'),
    Nube.tabla('ajustes?id=eq.true&select=prospectos_auto,prospectos_dia_2,prospectos_dia_3').catch(function(){ return [{}]; })
  ]).then(function(r){
    PR.lista = r[0] || []; PR.contactos = r[1] || []; PR.giros = r[2] || []; PR.aj = (r[3] && r[3][0]) || {};
  });
}
/* Huella de los datos cargados: sirve para no volver a pintar si nada cambió */
function prHuella(){ return JSON.stringify([PR.lista, PR.contactos, PR.giros, PR.aj, (window.LL && LL.ops) || null]); }
/* Vuelve a pintar sin mover la página ni perder lo que se está escribiendo en un buscador */
var _pintarCompleto = false;
function repintarConservando(fn){
  var y = window.scrollY, a = document.activeElement, id = a && a.id, s1 = null, s2 = null;
  try{ s1 = a.selectionStart; s2 = a.selectionEnd; }catch(e){}
  _pintarCompleto = true;          /* aquí la tabla se pinta completa para conservar la posición */
  try{ fn(); } finally { _pintarCompleto = false; }
  window.scrollTo(0, y);
  if(id){ var n = document.getElementById(id); if(n && n !== a){ n.focus(); try{ if(s1 != null) n.setSelectionRange(s1, s2); }catch(e){} } }
}
/* Tablas largas: las primeras filas se ven al instante y las demás se agregan en los
   cuadros siguientes. Al final la tabla queda igual que si se pintara de una vez. */
var _filasTurno = {};
function filasPorPartes(caja, clave, filas, antes, despues){
  var PRIMERAS = 60, PASO = 80, turno = _filasTurno[clave] = (_filasTurno[clave] || 0) + 1;
  if(_pintarCompleto || filas.length <= PRIMERAS){ caja.innerHTML = antes + filas.join('') + despues; return; }
  caja.innerHTML = antes + filas.slice(0, PRIMERAS).join('') + despues;
  var tb = caja.querySelector('tbody'), i = PRIMERAS;
  var sigue = function(){
    if(_filasTurno[clave] !== turno || !tb || !tb.isConnected) return;
    tb.insertAdjacentHTML('beforeend', filas.slice(i, i + PASO).join('')); i += PASO;
    if(i < filas.length) requestAnimationFrame(sigue);
  };
  requestAnimationFrame(sigue);
}
/* El buscador filtra cuando dejas de escribir un instante (no en cada letra) */
var _prBuscarT = null;
function prBuscar(v){ PR.f.q = v; clearTimeout(_prBuscarT); _prBuscarT = setTimeout(function(){ prPintarFiltros(); prPintarTabla(); }, 150); }
function prPorId(id){ return (PR.lista||[]).filter(function(p){ return p.id === id; })[0]; }
/* Contactos por prospecto con un índice (antes se recorría todo el historial por cada prospecto).
   El índice se rehace solo cuando cambia la lista de contactos. */
var _prIdx = { arr:null, n:-1, m:null };
function prContactos(id){
  var a = PR.contactos || [];
  if(_prIdx.arr !== a || _prIdx.n !== a.length){
    var m = {}; for(var i=0;i<a.length;i++){ var k = a[i].prospecto_id; (m[k] || (m[k] = [])).push(a[i]); }
    _prIdx = { arr:a, n:a.length, m:m };
  }
  return (_prIdx.m[id] || []).slice();
}
function prCorto(p){ return p.nombre_corto || p.nombre; }
function prFecha(iso){
  if(!iso) return '';
  var d = new Date(iso), m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return d.getDate() + ' ' + m[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
}
function prOrdinal(n){ return n + (n === 1 || n === 3 ? '.er' : '.º'); }
function prNumWa(p, conTel){
  var t = String(p.whatsapp || (conTel ? p.telefono : '') || '').replace(/\D/g,'');
  if(t.length === 10) t = '52' + t;
  return t.length >= 12 ? t : '';
}
function prTelLimpio(t){ return String(t||'').replace(/\D/g,''); }

/* Resumen por canal: cuántos toques, cuándo, si rebotó, si respondió. */
function prResumen(p){
  var h = prContactos(p.id), r = { correo:null, whatsapp:null, otros:0, canales:{}, respondio:null, ultimo:null, reboto:false };
  h.forEach(function(c){
    if(c.sentido === 'entrante'){ if(c.resultado !== 'baja') r.respondio = c; return; }
    if(c.canal === 'correo' || c.canal === 'whatsapp'){
      if(c.canal === 'correo' && c.resultado === 'rebotó'){ r.reboto = true; return; }
      r.canales[c.canal] = (r.canales[c.canal]||0) + 1;
      var x = r[c.canal] = r[c.canal] || { n:0, toque:0, primero:null, ultimo:null };
      x.n++; x.toque = Math.max(x.toque, Number(c.toque||0)); if(!x.primero || Number(c.toque) === 1) x.primero = x.primero || c.fecha; x.ultimo = c.fecha;
    } else { r.otros++; r.canales[c.canal] = (r.canales[c.canal]||0) + 1; }
    r.ultimo = c;
  });
  if(r.correo && r.correo.ultimo && r.reboto){
    var ultCorreo = h.filter(function(c){ return c.canal === 'correo' && c.sentido === 'saliente'; }).pop();
    r.reboto = ultCorreo && ultCorreo.resultado === 'rebotó';
  }
  return r;
}
/* ¿Le toca el siguiente toque? (mismo calendario para correo y WhatsApp) */
function prToca(p, canal){
  if(['respondio','demo','piloto','cliente','no_interesa','descartado','baja'].indexOf(p.estado) >= 0) return null;
  var r = prResumen(p), x = r[canal]; if(r.respondio) return null;
  if(!x){ return p.estado === 'nuevo' ? { toque:1, desde:null } : null; }
  if(x.toque >= 3) return null;
  var h = prContactos(p.id).filter(function(c){ return c.canal === canal && c.sentido === 'saliente' && Number(c.toque) === 1; })[0];
  var base = h ? new Date(h.fecha) : new Date(x.primero);
  var dias = x.toque === 1 ? Number(PR.aj.prospectos_dia_2 || 4) : Number(PR.aj.prospectos_dia_3 || 10);
  var cuando = new Date(base.getTime() + dias * 864e5);
  return { toque:x.toque + 1, cuando:cuando, ya:cuando <= new Date() };
}
function prTocaHoy(p){
  var a = prToca(p,'correo'), b = prToca(p,'whatsapp');
  return (p.correo && a && a.toque > 1 && a.ya) || (prWaPuede(p) && b && b.toque > 1 && b.ya);
}
/* ---------- Seguimiento de WhatsApp (20 oct 2026) ----------
   2.º mensaje a los 4 días del primero y 3.º a los 10 (Ajustes: prospectos_dia_2 / _3).
   Después del 3.º queda en «Secuencia terminada» y Héctor decide (llamada o descanso). */
/* «No escribir por WhatsApp»: pidió no recibir WhatsApp; los demás canales siguen. */
function prNoWa(p){ return !!(p && p.extra && p.extra.no_whatsapp); }
/* ¿Se le puede mandar WhatsApp? (tiene número o teléfono y nada lo impide) */
function prWaPuede(p){ return !!p && !prNoWa(p) && !prSinWa(p) && !prNoContactar(p) && !!(prNumWa(p) || prNumWa(p, true)); }
/* En qué punto de la secuencia de WhatsApp está: toca2 · toca3 · espera · fin · null */
function prWaPaso(p){
  if(!p || prNoWa(p) || prSinWa(p) || prNoContactar(p)) return null;
  if(['respondio','demo','piloto','cliente','descartado'].indexOf(p.estado) >= 0) return null;
  var r = prResumen(p); if(!r.whatsapp || r.respondio) return null;
  if(r.whatsapp.toque >= 3) return 'fin';
  var t = prToca(p, 'whatsapp'); if(!t) return null;
  return t.ya ? 'toca' + t.toque : 'espera';
}

/* ---------- Vista principal ---------- */
function vistaAdminProspectos(){
  if(!sesion || sesion.rol !== 'admin') return '';
  if(estado.prospectoId) return vistaProspecto();
  /* Si ya se tenían los prospectos (por ejemplo, al volver de una ficha), la lista se
     pinta al instante y se actualiza en segundo plano; solo se vuelve a pintar si cambió algo. */
  var habia = !!PR.lista, antes = habia ? prHuella() : '';
  setTimeout(function(){
    if(habia) prPintarLista();
    prCargar().then(function(){
      if(estado.vista !== 'admin-prospectos' || estado.prospectoId) return;
      if(!habia) prPintarLista();
      else if(prHuella() !== antes) repintarConservando(prPintarLista);
    }).catch(function(e){
      if(habia) return;
      var c = $('pr-datos'); if(c) c.innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+
        '<br><small>Si dice que no existe la tabla, falta ejecutar backend/prospectos-piloto.sql en Supabase.</small></div>';
    });
  }, 0);
  return '<div class="seccion"><div class="encabezado-fila"><div><h2>Prospectos</h2>'+
    '<p class="sub" style="margin:0">Empresas a las que ofrecemos capacitación: datos, contactos y seguimiento.</p></div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-linea" onclick="prTextosGiro()">Textos por giro</button>'+
    '<button class="btn btn-mor" onclick="prSubirCSV()">Subir CSV</button></div></div><div id="pr-datos">'+(habia ? '' : 'Cargando…')+'</div></div>';
}
/* Filtros combinables: un renglón por canal; se suman entre sí (Y). */
var PR_FILTROS = {
  correo: { rot:'Correo', ops:[
    ['enviado','Ya le escribí', function(p){ return !!prResumen(p).correo && !prResumen(p).reboto; }],
    ['falta','Falta escribirle', function(p){ var r = prResumen(p); return !!p.correo && !r.correo && !r.reboto && !prNoContactar(p); }],
    ['rebote','Rebotó', function(p){ return prResumen(p).reboto; }],
    ['sin','Sin correo', function(p){ return !p.correo; }] ] },
  wa: { rot:'WhatsApp', ops:[
    ['enviado','Ya le escribí', function(p){ return !!prResumen(p).whatsapp; }],
    ['pend','Pendiente (tiene WhatsApp)', function(p){ return prWaPendiente(p) && !!prNumWa(p); }],
    ['tel','Pendiente (solo teléfono)', function(p){ return prWaPendiente(p) && !prNumWa(p); }],
    ['llamada','Por llamada', function(p){ return prSinWa(p); }],
    ['sin','Sin número', function(p){ return !prSinWa(p) && !prResumen(p).whatsapp && !prNumWa(p, true); }] ] },
  sw: { rot:'Siguiente WhatsApp', ops:[
    ['toca2','Le toca el 2.º', function(p){ return prWaPaso(p) === 'toca2'; }],
    ['toca3','Le toca el 3.º', function(p){ return prWaPaso(p) === 'toca3'; }],
    ['espera','Esperando', function(p){ return prWaPaso(p) === 'espera'; }],
    ['fin','Secuencia terminada', function(p){ return prWaPaso(p) === 'fin'; }],
    ['nowa','No escribir por WhatsApp', function(p){ return prNoWa(p); }] ] },
  ot: { rot:'Llamada / Instagram', ops:[
    ['llamada','Ya le llamé', function(p){ return !!prResumen(p).canales.llamada; }],
    ['instagram','Ya le escribí por Instagram', function(p){ return !!prResumen(p).canales.instagram; }],
    ['ninguno','Ni llamada ni Instagram', function(p){ var c = prResumen(p).canales; return !c.llamada && !c.instagram; }] ] },
  sg: { rot:'Seguimiento', ops:[
    ['toca','Toca hoy', function(p){ return prTocaHoy(p); }],
    ['resp','Respondió', function(p){ return p.estado !== 'no_interesa' && (!!prResumen(p).respondio || ['respondio','demo','piloto','cliente'].indexOf(p.estado) >= 0); }],
    ['nada','Sin respuesta', function(p){ return !prResumen(p).respondio && ['contactado'].indexOf(p.estado) >= 0; }],
    ['nuevo','Sin contactar', function(p){ return p.estado === 'nuevo'; }],
    ['nointeresa','No le interesó', function(p){ return p.estado === 'no_interesa'; }] ] }
};
function prPasa(p, grupo, valor){
  if(!valor) return true;
  var op = PR_FILTROS[grupo].ops.filter(function(o){ return o[0] === valor; })[0];
  return !op || op[2](p);
}
/* omitir: grupo que no se aplica (para contar las opciones de ese renglón). */
function prFiltrados(omitir){
  var f = PR.f, q = f.q.toLowerCase();
  return (PR.lista||[]).filter(function(p){
    if(f.estado && p.estado !== f.estado) return false;
    if(f.seg && p.segmento !== f.seg) return false;
    for(var g in PR_FILTROS){ if(g !== omitir && !prPasa(p, g, f[g])) return false; }
    return !q || [p.nombre, p.segmento, p.correo, p.whatsapp, p.telefono, p.cursos_interes, p.notas].join(' ').toLowerCase().indexOf(q) >= 0;
  }).sort(function(a, b){
    if(f.sw === 'toca2' || f.sw === 'toca3' || f.sw === 'espera'){
      var x = prToca(a,'whatsapp'), y = prToca(b,'whatsapp');
      return (x && x.cuando ? x.cuando.getTime() : 0) - (y && y.cuando ? y.cuando.getTime() : 0);
    }
    return (prSinWa(a) ? 1 : 0) - (prSinWa(b) ? 1 : 0);
  });
}
function prFiltro(g, v){ PR.f[g] = PR.f[g] === v ? '' : v; prPintarFiltros(); prPintarTabla(); }
function prLimpiarFiltros(){ PR.f.correo = PR.f.wa = PR.f.sw = PR.f.ot = PR.f.sg = PR.f.estado = PR.f.seg = PR.f.q = ''; prPintarLista(); }
function prPintarFiltros(){
  var caja = $('pr-filtros'); if(!caja) return;
  var activos = ['correo','wa','sw','ot','sg'].filter(function(g){ return PR.f[g]; }).length;
  /* Cada renglón es independiente: si no eliges nada en él, no filtra.
     Un clic elige la opción; otro clic en la misma la quita. */
  caja.innerHTML = '<p style="color:var(--gris);font-size:.85rem;margin:0 0 8px">Elige solo lo que te interese; los renglones que dejes sin elegir no filtran. Lo que elijas se combina.</p>'+
    '<div style="display:grid;grid-template-columns:minmax(120px,170px) 1fr;gap:6px 12px;align-items:start">'+
    Object.keys(PR_FILTROS).map(function(g){
      var F = PR_FILTROS[g], base = prFiltrados(g);
      return '<b style="font-size:.9rem;padding-top:9px">'+F.rot+'</b><div class="chips-aula" style="margin:0">'+
        F.ops.map(function(o){
          var n = base.filter(o[2]).length, on = PR.f[g] === o[0];
          return '<button class="'+(on?'on':'')+'" title="'+(on?'Quitar este filtro':'Filtrar')+'" onclick="prFiltro(\''+g+'\',\''+o[0]+'\')">'+(on?'✓ ':'')+o[1]+' <small>'+n+'</small>'+(on?' ✕':'')+'</button>';
        }).join('')+'</div>';
    }).join('')+'</div>'+
    (activos || PR.f.estado || PR.f.seg || PR.f.q
      ? '<button class="btn btn-fantasma btn-sm" style="margin-top:6px" onclick="prLimpiarFiltros()">✕ Quitar todos los filtros</button>' : '');
}
/* «No le interesó»: lo dijo claramente; ya no se le contacta por ningún canal. */
function prNoContactar(p){ return !!p && p.estado === 'no_interesa'; }
/* «No tiene WhatsApp»: se contacta por llamada y se va al final de la lista. */
function prSinWa(p){ return !!(p && p.extra && p.extra.sin_whatsapp); }
function prWaPendiente(p){
  return !prSinWa(p) && !prNoWa(p) && !prResumen(p).whatsapp && ['nuevo','contactado'].indexOf(p.estado) >= 0 && !!(prNumWa(p) || prNumWa(p, true));
}
function prMarcarSinWa(id, v){
  var p = prPorId(id), extra = Object.assign({}, p.extra || {});
  if(v) extra.sin_whatsapp = true; else delete extra.sin_whatsapp;
  Nube.tabla('prospectos?id=eq.' + id, { metodo:'PATCH', prefer:'return=representation', cuerpo:{ extra:extra } })
    .then(function(x){ if(x && x[0]) PR.lista = PR.lista.map(function(q){ return q.id === id ? x[0] : q; }); else p.extra = extra; prPintarFicha(id); prPintarMensajes(id); })
    .catch(function(e){ alert(e.message); });
}
function prLlamada(id, resultado){
  var p = prPorId(id);
  prInsertarContacto({ prospecto_id:id, canal:'llamada', sentido:'saliente', resultado:resultado, creado_por:sesion.id,
    resumen:resultado === 'contestó' ? 'Llamada atendida' : 'Llamada sin respuesta' })
    .then(function(){ prPintarFicha(id); prPintarMensajes(id); });
}
/* Ir uno por uno: la ficha recorre la lista tal como estaba filtrada al abrirla. */
function prAbrir(id){ PR.cola = prFiltrados().map(function(p){ return p.id; }); estado.prospectoId = id; pintar(); }
function prSiguiente(paso){
  var c = PR.cola || [], i = c.indexOf(estado.prospectoId);
  if(i < 0 || !c[i + paso]) return;
  estado.prospectoId = c[i + paso]; pintar(); window.scrollTo(0, 0);
}
function prPintarLista(){
  var caja = $('pr-datos'); if(!caja || !PR.lista) return;
  var L = PR.lista, cuenta = function(e){ return L.filter(function(p){ return p.estado === e; }).length; };
  var toca = L.filter(prTocaHoy).length, rebotes = L.filter(function(p){ return prResumen(p).reboto; }).length;
  var met = function(rot, val, pie){ return '<div class="metrica"><div class="rot">'+rot+'</div><div class="val">'+val+'</div><div class="pie">'+pie+'</div></div>'; };
  var segs = {}; L.forEach(function(p){ if(p.segmento) segs[p.segmento] = (segs[p.segmento]||0) + 1; });
  var h = '<div class="rejilla rejilla-4" style="margin:6px 0 18px">'+
      met('Prospectos', L.length, cuenta('nuevo')+' sin contactar'+(cuenta('no_interesa') ? ' · '+cuenta('no_interesa')+' no les interesó' : ''))+
      met('Contactados', cuenta('contactado'), toca ? '<b style="color:#B45309">'+toca+' toca seguimiento hoy</b>' : 'al día')+
      met('Respondieron', cuenta('respondio') + cuenta('demo'), cuenta('demo')+' con demo')+
      met('Pilotos y clientes', cuenta('piloto') + cuenta('cliente'), cuenta('cliente')+' clientes')+
    '</div>'+
    '<div class="tarjeta" style="margin-bottom:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:space-between">'+
      '<div style="flex:1;min-width:240px"><b>Seguimientos automáticos por correo</b><br><small style="color:var(--gris)">De lunes a viernes a las 10:00 se envía el 2.º correo a los '+Number(PR.aj.prospectos_dia_2||4)+' días y el 3.º a los '+Number(PR.aj.prospectos_dia_3||10)+' días a quien tenga la secuencia activa y no haya respondido.</small></div>'+
      '<label style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" id="pr-auto"'+(PR.aj.prospectos_auto?' checked':'')+' onchange="prAuto(this.checked)"> '+(PR.aj.prospectos_auto?'Encendidos':'Apagados')+'</label></div>'+
    '<div class="fila" style="margin-bottom:8px"><div class="campo" style="margin:0"><label for="pr-q">Buscar</label><input id="pr-q" placeholder="Empresa, giro, correo, programa…" value="'+esc(PR.f.q)+'" oninput="prBuscar(this.value)"></div>'+
      '<div class="campo" style="margin:0"><label for="pr-e">Estado</label><select id="pr-e" onchange="PR.f.estado=this.value;prPintarFiltros();prPintarTabla()"><option value="">Todos</option>'+
        Object.keys(PR_ESTADOS).map(function(k){ return '<option value="'+k+'"'+(PR.f.estado===k?' selected':'')+'>'+PR_ESTADOS[k]+' ('+cuenta(k)+')</option>'; }).join('')+'</select></div>'+
      '<div class="campo" style="margin:0"><label for="pr-s">Giro</label><select id="pr-s" onchange="PR.f.seg=this.value;prPintarFiltros();prPintarTabla()"><option value="">Todos</option>'+
        Object.keys(segs).sort().map(function(s){ return '<option'+(PR.f.seg===s?' selected':'')+' value="'+esc(s)+'">'+esc(s)+' ('+segs[s]+')</option>'; }).join('')+'</select></div></div>'+
    '<div id="pr-filtros" style="margin:4px 0 6px"></div>'+
    '<div id="pr-masivo" style="margin:10px 0"></div><div id="pr-tabla"></div>';
  caja.innerHTML = h;
  prPintarFiltros();
  prPintarTabla();
}
function prPintarTabla(){
  var caja = $('pr-tabla'); if(!caja) return;
  var filas = prFiltrados();
  var nSel = Object.keys(PR.sel).filter(function(k){ return PR.sel[k]; }).length;
  $('pr-masivo').innerHTML = nSel
    ? '<div class="aviso aviso-info" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>'+nSel+' seleccionados</b>'+
      '<button class="btn btn-mor btn-sm" onclick="prEnviarMasivo()">Enviar el siguiente correo</button>'+
      '<button class="btn btn-linea btn-sm" onclick="prSecuenciaMasiva(true)">Activar seguimientos</button>'+
      '<button class="btn btn-fantasma btn-sm" onclick="prSecuenciaMasiva(false)">Quitar seguimientos</button>'+
      '<button class="btn btn-fantasma btn-sm" onclick="PR.sel={};prPintarTabla()">Limpiar selección</button></div>'
    : '';
  if(PR.f.sw === 'toca2' || PR.f.sw === 'toca3'){
    var nCad = filas.length, tq = PR.f.sw === 'toca2' ? '2.º' : '3.er';
    $('pr-masivo').insertAdjacentHTML('beforeend', nCad
      ? '<div class="aviso aviso-ok" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px"><span>💬 <b>'+nCad+'</b> empresa'+(nCad===1?'':'s')+' para el '+tq+' WhatsApp. Ábrelas una tras otra con el mensaje listo.</span>'+
        '<button class="btn btn-tur btn-sm" onclick="prCadena()">Enviar en cadena</button></div>'
      : '<div class="aviso aviso-info" style="margin-top:8px">Hoy no le toca el '+tq+' WhatsApp a nadie con estos filtros. Revisa «Esperando» para ver las fechas.</div>');
  }
  if(!filas.length){ caja.innerHTML = '<div class="tarjeta vacio"><p>'+(PR.lista.length ? 'Ningún prospecto coincide con el filtro.' : 'Todavía no hay prospectos. Súbelos con «Subir CSV».')+'</p></div>'; return; }
  filasPorPartes(caja, 'pr', filas.map(prFila), '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr>'+
    '<th><input type="checkbox" aria-label="Seleccionar todos" onchange="prSelTodos(this.checked)"'+(filas.every(function(p){ return PR.sel[p.id]; })?' checked':'')+'></th>'+
    '<th>Empresa</th><th>Contacto</th><th>Seguimiento</th><th>Estado</th><th></th></tr></thead><tbody>',
    '</tbody></table></div></div><p style="color:var(--gris);font-size:.85rem;margin-top:8px">'+filas.length+' de '+PR.lista.length+' prospectos.</p>');
}
function prCopiable(valor, rot){
  if(!valor) return '';
  return '<span style="display:inline-flex;gap:4px;align-items:center;white-space:nowrap">'+esc(rot ? rot + ' ' : '')+'<span style="user-select:all">'+esc(valor)+'</span>'+
    '<button class="btn btn-fantasma btn-sm" style="padding:2px 7px" title="Copiar" aria-label="Copiar '+esc(valor)+'" onclick="prCopiar(this,\''+esc(String(valor).replace(/'/g,"\\'"))+'\')">⧉</button></span>';
}
function prCopiar(btn, t){
  var fin = function(){ var o = btn.textContent; btn.textContent = '✓'; setTimeout(function(){ btn.textContent = o; }, 1300); };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(fin, function(){ prplano(t); }); else prplano(t);
}
function prplano(t){ var a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try{ document.execCommand('copy'); }catch(e){} a.remove(); }
function prSeguimientoTxt(p){
  var r = prResumen(p), partes = [];
  if(r.correo) partes.push('✉ ' + (r.correo.toque > 1 ? r.correo.toque + ' correos' : '1 correo') + ' · ' + prFecha(r.correo.ultimo));
  if(r.reboto) partes.push('<span style="color:#B91C1C">✉ rebotó</span>');
  if(r.whatsapp) partes.push('💬 ' + Math.min(r.whatsapp.toque || r.whatsapp.n, 3) + ' de 3 WhatsApp · ' + prFecha(r.whatsapp.ultimo));
  if(prNoWa(p)) partes.push('<span class="etiqueta gris">🚫 No escribir por WhatsApp</span>');
  else if(prWaPaso(p) === 'fin') partes.push('<span style="color:var(--gris)">💬 Secuencia terminada</span>');
  ['llamada','instagram','visita','otro'].forEach(function(k){ var n = r.canales[k]; if(n) partes.push(PR_ICONO[k] + ' ' + n + ' ' + (k === 'llamada' ? (n > 1 ? 'llamadas' : 'llamada') : PR_CANAL[k])); });
  if(r.respondio) partes.push('<b style="color:#065F46">Respondió ' + prFecha(r.respondio.fecha) + ' por ' + (PR_CANAL[r.respondio.canal]||r.respondio.canal) + '</b>');
  if(!partes.length) partes.push('<span style="color:var(--gris)">Sin contacto</span>');
  var tc = p.correo && prToca(p,'correo'), tw = prWaPuede(p) && !prResumen(p).respondio && prToca(p,'whatsapp'), sig = [];
  [[tc,'correo'],[tw,'WhatsApp']].forEach(function(x){ var t = x[0]; if(t && t.toque > 1) sig.push(prOrdinal(t.toque)+' '+x[1]+(t.ya ? ' <b style="color:#B45309">hoy</b>' : ' el '+prFecha(t.cuando))); });
  if(p.secuencia) sig.push('<span class="etiqueta tur">Auto</span>');
  if(prSinWa(p)) partes.unshift('<span class="etiqueta gris">☎ Por llamada</span>');
  return partes.join('<br>') + (sig.length ? '<br><small style="color:var(--gris)">Siguiente: '+sig.join(' · ')+'</small>' : '');
}
/* Canales por los que ya se le contactó (va debajo del estado). */
function prCanalesTxt(p){
  var c = prResumen(p).canales, k = ['correo','whatsapp','llamada','instagram','visita','otro'].filter(function(x){ return c[x]; });
  if(!k.length) return '';
  return '<div style="font-size:.8rem;color:var(--gris);margin-top:4px;line-height:1.5">por '+k.map(function(x){ return '<span style="white-space:nowrap">'+PR_ICONO[x]+' '+PR_CANAL[x]+'</span>'; }).join(', ')+'</div>';
}
function prFila(p){
  return '<tr><td><input type="checkbox" aria-label="Seleccionar '+esc(prCorto(p))+'"'+(PR.sel[p.id]?' checked':'')+' onchange="PR.sel[\''+p.id+'\']=this.checked;prPintarTabla()"></td>'+
    '<td style="min-width:200px"><a href="#" onclick="prAbrir(\''+p.id+'\');return false"><b>'+esc(p.nombre)+'</b></a><br><small style="color:var(--gris)">'+esc(p.segmento||'')+(p.num_origen?' · #'+p.num_origen:'')+'</small></td>'+
    '<td style="font-size:.88rem;min-width:220px">'+(p.correo ? prCopiable(p.correo.split(',')[0].trim(), '✉') : '<small style="color:var(--gris)">Sin correo</small>')+'<br>'+
      (p.whatsapp ? prCopiable(prTelLimpio(p.whatsapp).slice(-10), '💬') : p.telefono ? prCopiable(prTelLimpio(p.telefono).slice(-10), '☎') : '')+'</td>'+
    '<td style="font-size:.86rem;min-width:200px">'+prSeguimientoTxt(p)+'</td>'+
    '<td><span class="etiqueta '+(PR_COLOR[p.estado]||'gris')+'">'+esc(PR_ESTADOS[p.estado]||p.estado)+'</span>'+prCanalesTxt(p)+'</td>'+
    '<td><button class="btn btn-linea btn-sm" onclick="prAbrir(\''+p.id+'\')">Abrir</button></td></tr>';
}
function prSelTodos(v){ prFiltrados().forEach(function(p){ PR.sel[p.id] = v; }); prPintarTabla(); }
function prAuto(v){
  Nube.tabla('ajustes?id=eq.true', { metodo:'PATCH', prefer:'return=minimal', cuerpo:{ prospectos_auto:v } })
    .then(function(){ PR.aj.prospectos_auto = v; prPintarLista(); })
    .catch(function(e){ alert(e.message); });
}
function prSecuenciaMasiva(v){
  var ids = Object.keys(PR.sel).filter(function(k){ return PR.sel[k]; }); if(!ids.length) return;
  Nube.tabla('prospectos?id=in.(' + ids.join(',') + ')', { metodo:'PATCH', prefer:'return=minimal', cuerpo:{ secuencia:v } })
    .then(function(){ PR.lista.forEach(function(p){ if(ids.indexOf(p.id) >= 0) p.secuencia = v; }); prPintarTabla(); })
    .catch(function(e){ alert(e.message); });
}
function prEnviarMasivo(){
  var ids = Object.keys(PR.sel).filter(function(k){ return PR.sel[k]; });
  var con = ids.map(prPorId).filter(function(p){ return p && p.correo && p.estado !== 'baja' && !prNoContactar(p); });
  if(!con.length){ alert('Ninguno de los seleccionados tiene correo o se puede contactar (los marcados «No le interesó» o «No quiere correos» se omiten).'); return; }
  abrirModal('Enviar correo a '+con.length+' prospecto(s)',
    '<p>Cada uno recibe <b>su siguiente correo</b> de la secuencia (1.º presentación, 2.º recordatorio corto, 3.º cierre), personalizado con su nombre, su giro y sus programas. Sale desde el remitente configurado en Brevo.</p>'+
    '<ul style="margin:10px 0 10px 18px;max-height:180px;overflow:auto">'+con.map(function(p){ var t = prToca(p,'correo'); return '<li>'+esc(prCorto(p))+' — '+(t ? prOrdinal(t.toque)+' correo' : 'ya recibió los 3')+'</li>'; }).join('')+'</ul>'+
    '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="pm-seq" checked> Activar los seguimientos automáticos para ellos</label><div id="pm-aviso"></div>',
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cancelar</button><button id="pm-btn" class="btn btn-mor" onclick="prConfirmarMasivo()">Enviar</button>');
  PR.masivo = con.map(function(p){ return p.id; });
}
function prConfirmarMasivo(){
  var b = $('pm-btn'); b.disabled = true; b.textContent = 'Enviando…';
  Nube.funcionServidor('prospectos', { accion:'enviar', ids:PR.masivo, iniciarSecuencia:$('pm-seq').checked })
    .then(function(r){
      $('pm-aviso').innerHTML = '<div class="aviso aviso-ok">Enviados: '+r.enviados+'.'+(r.fallas && r.fallas.length ? '<br>No salieron:<br>'+r.fallas.map(esc).join('<br>') : '')+'</div>';
      b.textContent = 'Listo'; PR.sel = {};
      return prCargar().then(prPintarLista);
    })
    .catch(function(e){ b.disabled = false; b.textContent = 'Enviar'; $('pm-aviso').innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
}

/* ---------- Ficha del prospecto ---------- */
function vistaProspecto(){
  var id = estado.prospectoId;
  setTimeout(function(){
    (PR.lista ? Promise.resolve() : prCargar()).then(function(){ prPintarFicha(id); prCargarMensajes(id); })
      .catch(function(e){ var c = $('pf-cab'); if(c) c.innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
  }, 0);
  var c = PR.cola || [], i = c.indexOf(id);
  var nav = i >= 0 && c.length > 1 ? '<div style="display:flex;gap:8px;align-items:center"><button class="btn btn-fantasma btn-sm"'+(i>0?'':' disabled')+' onclick="prSiguiente(-1)">‹ Anterior</button>'+
    '<span style="color:var(--gris);font-size:.9rem">'+(i+1)+' de '+c.length+'</span>'+
    '<button class="btn btn-mor btn-sm"'+(i<c.length-1?'':' disabled')+' onclick="prSiguiente(1)">Siguiente ›</button></div>' : '';
  return '<div class="seccion"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">'+
    '<button class="btn btn-fantasma btn-sm" onclick="PR.cadena=null;estado.prospectoId=null;pintar()">← Prospectos</button>'+nav+'</div>'+
    '<div id="pf-cadena">'+prCadenaBarra()+'</div><div id="pf-cab">Cargando…</div>'+
    '<div class="rejilla" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px;margin-top:18px;align-items:start">'+
      '<div style="min-width:0"><div class="tarjeta" id="pf-msg">Preparando mensajes…</div>'+
        '<div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:10px">Historial</h3><div id="pf-hist"></div></div></div>'+
      '<div style="min-width:0"><div class="tarjeta" id="pf-datos"></div></div>'+
    '</div></div>';
}
function prPintarFicha(id){
  var p = prPorId(id), cab = $('pf-cab'); if(!cab) return;
  if(!p){ cab.innerHTML = '<div class="aviso aviso-error">No encontré ese prospecto.</div>'; return; }
  var bc = $('pf-cadena'); if(bc) bc.innerHTML = prCadenaBarra();
  cab.innerHTML = '<div class="encabezado-fila"><div><h2>'+esc(p.nombre)+'</h2><p class="sub" style="margin:0">'+esc(p.segmento||'')+
      (p.puntuacion ? ' · ★ '+esc(p.puntuacion)+(p.resenas?' ('+p.resenas+' reseñas)':'') : '')+'</p></div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><select id="pf-estado" aria-label="Estado" onchange="prCambiarEstado(\''+id+'\',this.value)">'+
      Object.keys(PR_ESTADOS).map(function(k){ return '<option value="'+k+'"'+(p.estado===k?' selected':'')+'>'+PR_ESTADOS[k]+'</option>'; }).join('')+'</select>'+
    '<button class="btn btn-mor btn-sm" onclick="prCrearPiloto(\''+id+'\')">'+(p.empresa_id ? 'Ver empresa y piloto' : 'Crear empresa y piloto')+'</button></div></div>'+
    '<div style="margin-top:8px">'+prSeguimientoTxt(p)+'</div>';
  prPintarDatos(p); prPintarHistorial(p);
}
function prCampo(rot, val, html){ if(val == null || val === '') return ''; return '<div style="margin-bottom:10px"><div style="font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:var(--gris);font-weight:700">'+rot+'</div><div>'+(html || esc(val))+'</div></div>'; }
function prPintarDatos(p){
  var caja = $('pf-datos'); if(!caja) return;
  var webs = String(p.web||'').split('|').map(function(w){ w = w.trim(); if(!w) return ''; var u = /^https?:/.test(w) ? w : 'https://' + w; return '<a href="'+esc(u)+'" target="_blank" rel="noopener">'+esc(w)+'</a>'; }).filter(Boolean).join('<br>');
  var progs = (p.cursos_ids||[]).map(function(cid){ var c = curso(cid); return c ? '<li>'+esc(c.nombre)+' <small style="color:var(--gris)">'+dinero(c.precio)+'</small></li>' : ''; }).join('');
  var extra = p.extra || {}, extraH = Object.keys(extra).map(function(k){ return prCampo(esc(k), extra[k]); }).join('');
  caja.innerHTML = '<div class="encabezado-fila" style="margin-bottom:10px"><h3 style="color:var(--tinta);margin:0">Datos</h3><button class="btn btn-fantasma btn-sm" onclick="prEditar(\''+p.id+'\')">Editar</button></div>'+
    prCampo('Correo', p.correo, String(p.correo||'').split(',').map(function(c){ return prCopiable(c.trim()); }).join('<br>'))+
    prCampo('WhatsApp', p.whatsapp, prCopiable(prTelLimpio(p.whatsapp).slice(-10)))+
    prCampo('Teléfono', p.telefono, prCopiable(prTelLimpio(p.telefono).slice(-10)))+
    prCampo('Dirección', p.direccion)+prCampo('Web / Instagram', p.web, webs)+
    prCampo('Tipo de negocio', p.tipo_negocio)+prCampo('Público objetivo', p.publico)+
    prCampo('Programas recomendados', progs ? 1 : '', '<ul style="margin-left:18px">'+progs+'</ul>')+
    prCampo('Lo que destacan sus reseñas', p.puntos_fuertes)+
    prCampo('Frase de apertura del correo', p.gancho || '(genérica)', esc(p.gancho || 'Sin frase propia: el correo usa una apertura genérica. Agrégala con «Editar».'))+
    prCampo('Presencia en línea', p.presencia)+prCampo('Responde reseñas', p.responde_resenas)+
    prCampo('Notas', p.notas)+extraH+
    prCampo('Cargado', p.lote || prFecha(p.creado_en));
}
function prPintarHistorial(p){
  var caja = $('pf-hist'); if(!caja) return;
  var h = prContactos(p.id).slice().reverse();
  caja.innerHTML = (h.length ? '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">'+h.map(function(c){
      var ent = c.sentido === 'entrante';
      return '<div style="border-left:3px solid '+(ent ? '#059669' : c.resultado === 'rebotó' ? '#DC2626' : 'var(--morado)')+';padding:4px 10px">'+
        '<div style="display:flex;justify-content:space-between;gap:8px"><b>'+(ent ? 'Respuesta' : (c.toque ? prOrdinal(Number(c.toque))+' ' : '')+'contacto')+' · '+esc(PR_CANAL[c.canal]||c.canal)+'</b>'+
        '<span style="color:var(--gris);font-size:.85rem;white-space:nowrap">'+prFecha(c.fecha)+' <button class="btn btn-fantasma btn-sm" style="padding:0 6px" title="Borrar registro" aria-label="Borrar registro" onclick="prBorrarContacto(\''+p.id+'\',\''+c.id+'\')">×</button></span></div>'+
        (c.asunto ? '<div style="font-size:.88rem">'+esc(c.asunto)+'</div>' : '')+
        (c.resumen ? '<div style="font-size:.88rem;color:var(--gris)">'+esc(c.resumen)+'</div>' : '')+
        '<div style="font-size:.8rem;color:var(--gris)">'+esc(c.resultado||'')+(c.automatico ? ' · automático' : '')+'</div></div>';
    }).join('')+'</div>' : '<p style="color:var(--gris);margin-bottom:12px">Sin contactos todavía.</p>')+
    '<details><summary style="cursor:pointer;font-weight:700;color:var(--morado)">Registrar un contacto o respuesta</summary>'+
    '<div class="fila" style="margin-top:10px"><div class="campo"><label for="rc-canal">Canal</label><select id="rc-canal">'+Object.keys(PR_CANAL).map(function(k){ return '<option value="'+k+'">'+PR_CANAL[k]+'</option>'; }).join('')+'</select></div>'+
    '<div class="campo"><label for="rc-sent">¿Qué pasó?</label><select id="rc-sent"><option value="saliente|enviado">Yo lo contacté</option><option value="entrante|respondió">Me respondió</option>'+
      '<option value="saliente|rebotó">El correo rebotó</option><option value="saliente|sin respuesta">Llamé y no contestó</option></select></div>'+
    '<div class="campo"><label for="rc-fecha">Fecha</label><input id="rc-fecha" type="date" value="'+hoy()+'"></div></div>'+
    '<div class="campo"><label for="rc-nota">Nota</label><input id="rc-nota" maxlength="300" placeholder="Ej. le interesa NOM-035 para 20 personas"></div>'+
    '<button class="btn btn-linea btn-sm" onclick="prRegistrar(\''+p.id+'\')">Guardar</button></details>';
}
function prToqueSig(p, canal){ var t = prToca(p, canal); if(t) return t.toque; var r = prResumen(p)[canal]; return r ? Math.min(3, r.toque + 1) : 1; }
function prRegistrar(id){
  var p = prPorId(id), v = $('rc-sent').value.split('|'), canal = $('rc-canal').value;
  var fila = { prospecto_id:id, canal:canal, sentido:v[0], resultado:v[1], resumen:$('rc-nota').value.trim() || null,
    fecha:new Date($('rc-fecha').value + 'T' + new Date().toTimeString().slice(0,8)).toISOString(), creado_por:sesion.id };
  if(v[0] === 'saliente' && v[1] !== 'rebotó' && (canal === 'correo' || canal === 'whatsapp')) fila.toque = prToqueSig(p, canal);
  if(v[1] === 'rebotó'){ var r = prResumen(p).correo; fila.toque = r ? r.toque : 1; }
  prInsertarContacto(fila).then(function(){ prPintarFicha(id); prCargarMensajes(id); });
}
function prInsertarContacto(fila){
  return Nube.tabla('prospecto_contactos', { metodo:'POST', prefer:'return=representation', cuerpo:fila })
    .then(function(r){
      if(r && r[0]) PR.contactos.push(r[0]);
      return Nube.tabla('prospectos?id=eq.' + fila.prospecto_id + '&select=*').then(function(x){
        if(x && x[0]) PR.lista = PR.lista.map(function(p){ return p.id === x[0].id ? x[0] : p; });
      });
    }).catch(function(e){ alert(e.message); });
}
function prBorrarContacto(pid, cid){
  if(!confirm('¿Borrar este registro del historial?')) return;
  Nube.tabla('prospecto_contactos?id=eq.' + cid, { metodo:'DELETE', prefer:'return=minimal' })
    .then(function(){ PR.contactos = PR.contactos.filter(function(c){ return c.id !== cid; }); prPintarFicha(pid); prCargarMensajes(pid); })
    .catch(function(e){ alert(e.message); });
}
function prCambiarEstado(id, v){
  var cambios = { estado:v }; if(['respondio','demo','piloto','cliente','no_interesa','descartado','baja'].indexOf(v) >= 0) cambios.secuencia = false;
  Nube.tabla('prospectos?id=eq.' + id, { metodo:'PATCH', prefer:'return=representation', cuerpo:cambios })
    .then(function(x){ if(x && x[0]) PR.lista = PR.lista.map(function(p){ return p.id === id ? x[0] : p; }); prPintarFicha(id); })
    .catch(function(e){ alert(e.message); });
}

/* Mensajes listos (los arma el servidor, igual que los automáticos). */
function prCargarMensajes(id){
  var caja = $('pf-msg'); if(!caja) return;
  Nube.funcionServidor('prospectos', { accion:'mensajes', id:id })
    .then(function(m){ PR.msg[id] = m; prPintarMensajes(id); })
    .catch(function(e){ caja.innerHTML = '<div class="aviso aviso-error">No pude preparar los mensajes: '+esc(e.message)+'</div>'; });
}
function prPintarMensajes(id){
  var p = prPorId(id), m = PR.msg[id], caja = $('pf-msg'); if(!caja || !p || !m) return;
  var r = prResumen(p), tc = prToca(p,'correo'), tw = prToca(p,'whatsapp');
  var finC = r.correo && r.correo.toque >= 3, finW = r.whatsapp && r.whatsapp.toque >= 3;
  var wa = prNumWa(p), waTel = !wa && prNumWa(p, true);
  if(prNoContactar(p)){
    caja.innerHTML = '<div class="aviso aviso-error"><b>No le interesó.</b> Nos dijo claramente que no le interesa: ya no se le envían correos, WhatsApp ni seguimientos. '+
      'Si vuelve a buscarnos, cambia su estado arriba y aquí aparecerán de nuevo los mensajes.</div>';
    return;
  }
  caja.innerHTML =
    '<div class="encabezado-fila" style="margin-bottom:8px"><h3 style="color:var(--tinta);margin:0">Correo · '+prOrdinal(m.toque)+' toque</h3>'+
      (tc && tc.cuando && !tc.ya ? '<small style="color:var(--gris)">Le toca el '+prFecha(tc.cuando)+'</small>' : '')+'</div>'+
    (p.estado === 'baja' ? '<div class="aviso aviso-error">Pidió no recibir más correos.</div>' :
     !p.correo ? '<p style="color:var(--gris)">Sin correo registrado.</p>' :
     finC ? '<p style="color:var(--gris)">Ya recibió los 3 correos de la secuencia.</p>' :
    '<div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--gris);font-weight:700">Asunto</div>'+
    '<div style="font-weight:600;margin-bottom:8px">'+esc(m.asunto)+'</div>'+
    '<pre style="white-space:pre-wrap;font-family:inherit;font-size:.9rem;background:var(--nube);border:1px solid var(--linea);border-radius:10px;padding:12px;max-height:300px;overflow:auto">'+esc(m.texto)+'</pre>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'+
      '<button class="btn btn-mor btn-sm" onclick="prEnviarUno(\''+id+'\')"'+(m.listo ? '' : ' disabled title="Falta configurar Brevo"')+'>Enviar ahora</button>'+
      '<button class="btn btn-linea btn-sm" onclick="prCopiar(this,PR.msg[\''+id+'\'].texto)">Copiar correo</button>'+
      '<button class="btn btn-linea btn-sm" onclick="prCopiar(this,PR.msg[\''+id+'\'].asunto)">Copiar asunto</button>'+
      '<button class="btn btn-fantasma btn-sm" onclick="prMarcar(\''+id+'\',\'correo\')">Ya lo envié desde Zoho</button></div>'+
    (m.listo ? '' : '<p style="color:var(--gris);font-size:.85rem;margin-top:6px">«Enviar ahora» se activa cuando estén los secretos BREVO_API_KEY y CORREO_REMITENTE en Supabase. Mientras, cópialo y envíalo desde Zoho.</p>')+
    '<label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox"'+(p.secuencia?' checked':'')+' onchange="prSecuencia(\''+id+'\',this.checked)"> Seguimientos automáticos por correo</label>')+
    '<hr style="border:0;border-top:1px solid var(--linea);margin:18px 0">'+
    (prNoWa(p) ?
      '<h3 style="color:var(--tinta);margin-bottom:8px">💬 WhatsApp</h3>'+
      '<div class="aviso aviso-error"><b>No escribir por WhatsApp.</b> Pidió no recibir mensajes por aquí. Correo y llamada siguen disponibles.</div>'+
      '<button class="btn btn-fantasma btn-sm" style="margin-top:8px" onclick="prMarcarNoWa(\''+id+'\',false)">Volver a permitir WhatsApp</button>'
    : prSinWa(p) ?
      '<h3 style="color:var(--tinta);margin-bottom:8px">☎ Contactar por llamada</h3>'+
      '<p style="margin-bottom:10px">Marcaste que no tiene WhatsApp. Teléfono: '+(p.telefono ? prCopiable(prTelLimpio(p.telefono).slice(-10)) : 'sin teléfono')+'</p>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-linea btn-sm" onclick="prLlamada(\''+id+'\',\'contestó\')">Llamé y contestó</button>'+
      '<button class="btn btn-linea btn-sm" onclick="prLlamada(\''+id+'\',\'sin respuesta\')">Llamé y no contestó</button>'+
      '<button class="btn btn-fantasma btn-sm" onclick="prMarcarSinWa(\''+id+'\',false)">Sí tiene WhatsApp</button></div>'+
      '<p style="color:var(--gris);font-size:.85rem;margin-top:8px">Si te interesa la propuesta, usa «Registrar un contacto o respuesta» → «Me respondió».</p>'
    :
    '<h3 style="color:var(--tinta);margin-bottom:8px">WhatsApp'+(finW ? ' · secuencia terminada' : ' · '+prOrdinal(m.toqueWa)+' toque')+'</h3>'+
    (prCadenaHecho(id) ? '<div class="aviso aviso-ok" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">✓ WhatsApp registrado.'+
        (prCadenaSig(id) ? '<button class="btn btn-mor btn-sm" onclick="prCadenaIr(\''+id+'\')">Siguiente empresa ›</button>' : ' <b>Terminaste la cadena.</b> <button class="btn btn-linea btn-sm" onclick="prCadenaSalir()">Volver a la lista</button>')+'</div>' :
     finW ? '<p style="color:var(--gris)">Ya recibió los 3 mensajes: la secuencia de WhatsApp terminó. Si quieres insistir, márcale (abajo, «Otros canales»).</p>' :
     tw && tw.toque > 1 && !tw.ya ? '<div class="aviso aviso-info" style="margin-bottom:8px">El '+prOrdinal(tw.toque)+' WhatsApp le toca el <b>'+prFecha(tw.cuando)+'</b>. Si lo mandas antes, se verá insistente.</div>'+prWaBloque(p, m, wa, waTel) :
     prWaBloque(p, m, wa, waTel)) +
    (finW || prCadenaHecho(id) ? '' : '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn btn-fantasma btn-sm" onclick="prMarcarSinWa(\''+id+'\',true)">☎ No tiene WhatsApp: contactar por llamada</button>'+
      '<button class="btn btn-fantasma btn-sm" onclick="prMarcarNoWa(\''+id+'\',true)">🚫 Pidió no escribirle por WhatsApp</button></div>'))+
    prOtrosCanales(p);
}
/* Mensaje de WhatsApp con sus botones. */
function prWaBloque(p, m, wa, waTel){
  var id = p.id;
  return ''+
    '<pre style="white-space:pre-wrap;font-family:inherit;font-size:.9rem;background:#E7F6F3;border:1px solid var(--linea);border-radius:10px;padding:12px">'+esc(m.whatsapp).replace(/\*([^*\n]+)\*/g,'<b>$1</b>')+'</pre>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'+
      (wa ? '<button class="btn btn-tur btn-sm" onclick="prAbrirWa(\''+id+'\')">Abrir WhatsApp y registrar</button>'
          : waTel ? '<button class="btn btn-tur btn-sm" onclick="prAbrirWa(\''+id+'\')">Abrir WhatsApp con su teléfono</button>'
          : '<span style="color:var(--gris);font-size:.88rem">Sin teléfono registrado.</span>')+
      '<button class="btn btn-linea btn-sm" onclick="prCopiar(this,PR.msg[\''+id+'\'].whatsapp)">Copiar mensaje</button>'+
      (wa || waTel ? '' : '<button class="btn btn-fantasma btn-sm" onclick="prMarcar(\''+id+'\',\'whatsapp\')">Ya lo envié</button>')+'</div>'+
      (waTel ? '<p style="color:var(--gris);font-size:.85rem;margin-top:6px">No tenemos su WhatsApp; se intenta con su teléfono ('+esc(prTelLimpio(p.telefono).slice(-10))+'). Si WhatsApp dice que el número no tiene cuenta, es un fijo.</p>' : '');
}
function prMarcarNoWa(id, v){
  var p = prPorId(id), extra = Object.assign({}, p.extra || {});
  if(v && !confirm('¿Marcar que «'+prCorto(p)+'» pidió no recibir WhatsApp? Ya no aparecerá en los envíos de WhatsApp; correo y llamada siguen.')) return;
  if(v) extra.no_whatsapp = true; else delete extra.no_whatsapp;
  Nube.tabla('prospectos?id=eq.' + id, { metodo:'PATCH', prefer:'return=representation', cuerpo:{ extra:extra } })
    .then(function(x){ if(x && x[0]) PR.lista = PR.lista.map(function(q){ return q.id === id ? x[0] : q; }); else p.extra = extra; prPintarFicha(id); prPintarMensajes(id); })
    .catch(function(e){ alert(e.message); });
}

/* ---------- Envío en cadena del 2.º o 3.er WhatsApp ----------
   La cola se fija al empezar; «Siguiente» salta a quien ya no le toque
   (porque ya se le mandó, respondió o se marcó «no escribir»). */
function prCadena(){
  var filas = prFiltrados(); if(!filas.length) return;
  PR.cadena = { filtro:PR.f.sw, ids:filas.map(function(p){ return p.id; }), hechos:{} };
  PR.cola = PR.cadena.ids.slice(); estado.prospectoId = filas[0].id; pintar(); window.scrollTo(0, 0);
}
function prCadenaActiva(id){ return !!(PR.cadena && PR.cadena.ids.indexOf(id) >= 0); }
function prCadenaHecho(id){ return !!(PR.cadena && PR.cadena.hechos[id]); }
function prCadenaPendientes(){
  if(!PR.cadena) return [];
  return PR.cadena.ids.filter(function(i){ var p = prPorId(i); return p && !PR.cadena.hechos[i] && prWaPaso(p) === PR.cadena.filtro; });
}
function prCadenaSig(id){
  var c = PR.cadena; if(!c) return null;
  var i = c.ids.indexOf(id), pend = prCadenaPendientes();
  for(var k = i + 1; k < c.ids.length; k++) if(pend.indexOf(c.ids[k]) >= 0) return c.ids[k];
  return pend.filter(function(x){ return x !== id; })[0] || null;
}
function prCadenaIr(id){ var s = prCadenaSig(id); if(!s) return prCadenaSalir(); estado.prospectoId = s; pintar(); window.scrollTo(0, 0); }
function prCadenaSalir(){ PR.cadena = null; estado.prospectoId = null; pintar(); }
function prCadenaBarra(){
  var c = PR.cadena, id = estado.prospectoId;
  if(!c || !prCadenaActiva(id)) return '';
  var falta = prCadenaPendientes().length, hechos = Object.keys(c.hechos).length, tq = c.filtro === 'toca2' ? '2.º' : '3.er';
  return '<div class="aviso aviso-ok" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:space-between;margin-bottom:14px">'+
    '<span>💬 <b>Envío en cadena · '+tq+' WhatsApp</b> · '+hechos+' enviado'+(hechos===1?'':'s')+' · faltan '+falta+'</span>'+
    '<span style="display:flex;gap:8px"><button class="btn btn-fantasma btn-sm" onclick="prCadenaIr(\''+id+'\')">Saltar esta ›</button>'+
    '<button class="btn btn-fantasma btn-sm" onclick="prCadenaSalir()">Terminar</button></span></div>';
}
/* Instagram y llamadas: se registran con un clic para que cuenten en el estado. */
function prOtrosCanales(p){
  var id = p.id, ig = String(p.web || '').split(/[\s,;|]+/).filter(function(u){ return /instagram\.com/i.test(u); })[0];
  if(ig && !/^https?:/i.test(ig)) ig = 'https://' + ig;
  var c = prResumen(p).canales;
  return '<hr style="border:0;border-top:1px solid var(--linea);margin:18px 0">'+
    '<h3 style="color:var(--tinta);margin-bottom:8px">Otros canales</h3>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
      (ig ? '<a class="btn btn-linea btn-sm" href="'+esc(ig)+'" target="_blank" rel="noopener">📷 Abrir su Instagram</a>' : '')+
      '<button class="btn btn-linea btn-sm" onclick="prOtroCanal(\''+id+'\',\'instagram\')">📷 Le escribí por Instagram</button>'+
      (prSinWa(p) ? '' : '<button class="btn btn-linea btn-sm" onclick="prLlamada(\''+id+'\',\'contestó\')">☎ Llamé y contestó</button>'+
        '<button class="btn btn-fantasma btn-sm" onclick="prLlamada(\''+id+'\',\'sin respuesta\')">☎ Llamé y no contestó</button>')+
    '</div>'+
    (c.instagram || c.llamada ? '<p style="color:var(--gris);font-size:.85rem;margin-top:6px">'+
      [c.instagram ? '📷 Instagram: ' + c.instagram : '', c.llamada ? '☎ Llamadas: ' + c.llamada : ''].filter(Boolean).join(' · ')+'</p>' : '')+
    (ig ? '' : '<p style="color:var(--gris);font-size:.85rem;margin-top:6px">Para Instagram puedes copiar el mismo mensaje de WhatsApp.</p>');
}
function prOtroCanal(id, canal){
  prInsertarContacto({ prospecto_id:id, canal:canal, sentido:'saliente', resultado:'enviado', creado_por:sesion.id,
    resumen:canal === 'instagram' ? 'Mensaje por Instagram' : null })
    .then(function(){ prPintarFicha(id); prPintarMensajes(id); });
}
function prEnviarUno(id){
  var p = prPorId(id), m = PR.msg[id];
  if(!confirm('¿Enviar el '+prOrdinal(m.toque)+' correo a '+p.correo+'?')) return;
  Nube.funcionServidor('prospectos', { accion:'enviar', ids:[id], toque:m.toque })
    .then(function(r){
      if(r.fallas && r.fallas.length) alert('No salió: ' + r.fallas.join(', '));
      return prCargar().then(function(){ prPintarFicha(id); prCargarMensajes(id); });
    }).catch(function(e){ alert(e.message); });
}
function prMarcar(id, canal){
  if(canal === 'whatsapp' && prCadenaActiva(id)) PR.cadena.hechos[id] = true;
  var m = PR.msg[id] || {}, t = canal === 'correo' ? m.toque : m.toqueWa;
  prInsertarContacto({ prospecto_id:id, canal:canal, sentido:'saliente', toque:t, asunto:canal === 'correo' ? m.asunto : null,
    resultado:'enviado', resumen:canal === 'correo' ? 'Enviado desde Zoho' : null, creado_por:sesion.id })
    .then(function(){ prPintarFicha(id); prCargarMensajes(id); });
}
function prAbrirWa(id){
  var p = prPorId(id), m = PR.msg[id];
  if(!prWaPuede(p)){ alert('A esta empresa no se le escribe por WhatsApp.'); return; }
  window.open('https://wa.me/' + (prNumWa(p) || prNumWa(p, true)) + '?text=' + encodeURIComponent(m.whatsapp), '_blank', 'noopener');
  if(prCadenaActiva(id)) PR.cadena.hechos[id] = true;
  prMarcar(id, 'whatsapp');
}
function prSecuencia(id, v){
  Nube.tabla('prospectos?id=eq.' + id, { metodo:'PATCH', prefer:'return=minimal', cuerpo:{ secuencia:v } })
    .then(function(){ prPorId(id).secuencia = v; prPintarFicha(id); }).catch(function(e){ alert(e.message); });
}
function prEditar(id){
  var p = prPorId(id);
  var inp = function(k, rot, extra){ return '<div class="campo"><label for="pe-'+k+'">'+rot+'</label><input id="pe-'+k+'" value="'+esc(p[k]==null?'':p[k])+'"'+(extra||'')+'></div>'; };
  abrirModal('Editar '+prCorto(p),
    '<div class="fila">'+inp('nombre','Nombre')+inp('nombre_corto','Cómo se le llama en el correo')+'</div>'+
    '<div class="fila">'+inp('correo','Correo(s), separados por coma')+inp('whatsapp','WhatsApp')+inp('telefono','Teléfono')+'</div>'+
    '<div class="campo"><label for="pe-segmento">Giro</label><select id="pe-segmento">'+
      [''].concat(PR.giros.map(function(g){ return g.segmento; })).concat(PR.giros.some(function(g){ return g.segmento === p.segmento; }) || !p.segmento ? [] : [p.segmento])
        .map(function(s){ return '<option'+(s===p.segmento?' selected':'')+'>'+esc(s)+'</option>'; }).join('')+'</select></div>'+
    '<div class="campo"><label for="pe-gancho">Frase de apertura (algo positivo de ellos)</label><textarea id="pe-gancho" rows="2">'+esc(p.gancho||'')+'</textarea>'+
      '<small style="color:var(--gris)">Ej. «Sus clientes destacan la calidad de su piel y su excelente atención». Si la dejas vacía se usa una apertura genérica.</small></div>'+
    '<div class="campo"><label>Programas recomendados</label><div id="pe-progs" style="max-height:200px;overflow:auto;border:1px solid var(--linea);border-radius:10px;padding:8px 10px">'+
      BD.cursos.filter(function(c){ return c.publicado && Number(c.precio) > 0 && !ruta(c.id); })
        .sort(function(a,b){ var x = (p.cursos_ids||[]).indexOf(a.id), y = (p.cursos_ids||[]).indexOf(b.id); if(x>=0 && y>=0) return x-y; if(x>=0) return -1; if(y>=0) return 1; return a.nombre.localeCompare(b.nombre); })
        .map(function(c){ return '<label style="display:flex;gap:8px;padding:3px 0"><input type="checkbox" value="'+c.id+'"'+((p.cursos_ids||[]).indexOf(c.id)>=0?' checked':'')+'> '+esc(c.nombre)+'</label>'; }).join('')+'</div></div>'+
    '<div class="campo"><label for="pe-notas">Notas</label><textarea id="pe-notas" rows="3">'+esc(p.notas||'')+'</textarea></div><div id="pe-aviso"></div>',
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cancelar</button><button class="btn btn-mor" onclick="prGuardarEdicion(\''+id+'\')">Guardar</button>');
}
function prGuardarEdicion(id){
  var v = function(k){ var x = $('pe-'+k).value.trim(); return x || null; };
  var d = { nombre:v('nombre'), nombre_corto:v('nombre_corto'), correo:v('correo'), whatsapp:v('whatsapp'), telefono:v('telefono'),
    segmento:v('segmento'), gancho:v('gancho'), notas:v('notas'),
    cursos_ids:[].slice.call(document.querySelectorAll('#pe-progs input:checked')).map(function(x){ return x.value; }) };
  if(!d.nombre){ $('pe-aviso').innerHTML = '<div class="aviso aviso-error">El nombre no puede quedar vacío.</div>'; return; }
  Nube.tabla('prospectos?id=eq.' + id, { metodo:'PATCH', prefer:'return=representation', cuerpo:d })
    .then(function(x){ if(x && x[0]) PR.lista = PR.lista.map(function(p){ return p.id === id ? x[0] : p; }); cerrarModal(); prPintarFicha(id); prCargarMensajes(id); })
    .catch(function(e){ $('pe-aviso').innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
}
function prCrearPiloto(id){
  var p = prPorId(id);
  var irEmpresa = function(eid){
    estado.prospectoId = null;
    ir('admin-empresa', { empresaId:eid, pilotoCursos:(p.cursos_ids||[]).slice(), pilotoEmpresa:eid, prospectoPiloto:id });
  };
  if(p.empresa_id) return irEmpresa(p.empresa_id);
  if(!confirm('Se crea la empresa «'+p.nombre+'» con sus datos de contacto y te llevo a su ficha con el piloto listo para crear. ¿Continuar?')) return;
  Nube.guardarEmpresa(null, { nombre:p.nombre, contacto_correo:(p.correo||'').split(',')[0].trim() || null,
      contacto_tel:prTelLimpio(p.whatsapp || p.telefono) || null, notas:'Desde Prospectos' + (p.segmento ? ' · ' + p.segmento : '') })
    .then(function(e){
      return Nube.tabla('prospectos?id=eq.' + id, { metodo:'PATCH', prefer:'return=minimal', cuerpo:{ empresa_id:e.id } })
        .then(function(){ p.empresa_id = e.id; irEmpresa(e.id); });
    }).catch(function(e){ alert(e.message); });
}

/* ---------- Textos por giro ---------- */
function prTextosGiro(){
  (PR.lista ? Promise.resolve() : prCargar()).then(function(){
    abrirModal('Textos por giro',
      '<p style="color:var(--gris);margin-bottom:12px">El <b>tema</b> va en el asunto («capacitación en ___») y el <b>reto</b> abre el segundo párrafo del primer correo. Agrega aquí los giros nuevos que traigan tus archivos.</p>'+
      '<div id="tg-lista">'+PR.giros.map(function(g){ return prGiroForm(g, false); }).join('')+'</div>'+
      '<h4 style="margin:14px 0 8px">Agregar giro</h4>'+prGiroForm({ segmento:'', tema:'', problema:'', giro_corto:'' }, true)+'<div id="tg-aviso"></div>',
      '<button class="btn btn-fantasma" onclick="cerrarModal()">Cerrar</button>');
  });
}
function prGiroForm(g, nuevo){
  var k = nuevo ? 'nuevo' : btoa(unescape(encodeURIComponent(g.segmento))).replace(/[^a-z0-9]/gi,'');
  return '<details'+(nuevo?' open':'')+' style="border:1px solid var(--linea);border-radius:10px;padding:8px 12px;margin-bottom:8px"><summary style="cursor:pointer;font-weight:700">'+(nuevo ? 'Nuevo giro' : esc(g.segmento))+'</summary>'+
    (nuevo ? '<div class="campo"><label for="tg-seg-'+k+'">Giro (igual que en el archivo)</label><input id="tg-seg-'+k+'"></div>' : '<input type="hidden" id="tg-seg-'+k+'" value="'+esc(g.segmento)+'">')+
    '<div class="fila"><div class="campo"><label for="tg-tema-'+k+'">Tema</label><input id="tg-tema-'+k+'" value="'+esc(g.tema)+'"></div>'+
    '<div class="campo"><label for="tg-corto-'+k+'">Para WhatsApp («Para ___ recomendamos»)</label><input id="tg-corto-'+k+'" value="'+esc(g.giro_corto)+'"></div></div>'+
    '<div class="campo"><label for="tg-prob-'+k+'">Reto del giro</label><textarea id="tg-prob-'+k+'" rows="2">'+esc(g.problema)+'</textarea></div>'+
    '<button class="btn btn-linea btn-sm" onclick="prGuardarGiro(\''+k+'\')">Guardar</button></details>';
}
function prGuardarGiro(k){
  var d = { segmento:$('tg-seg-'+k).value.trim(), tema:$('tg-tema-'+k).value.trim(), problema:$('tg-prob-'+k).value.trim(), giro_corto:$('tg-corto-'+k).value.trim() };
  if(!d.segmento || !d.tema || !d.problema || !d.giro_corto){ $('tg-aviso').innerHTML = '<div class="aviso aviso-error">Llena los cuatro campos.</div>'; return; }
  Nube.tabla('prospecto_giros?on_conflict=segmento', { metodo:'POST', prefer:'resolution=merge-duplicates,return=minimal', cuerpo:[d] })
    .then(function(){ return prCargar(); }).then(function(){ prTextosGiro(); })
    .catch(function(e){ $('tg-aviso').innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
}

/* ---------- Subir CSV (sin duplicar) ---------- */
function prSubirCSV(){
  abrirModal('Subir prospectos (CSV)',
    '<p style="margin-bottom:10px">Sube el archivo tal como lo tienes (CSV desde Excel o Google Sheets). Reconozco las columnas por su nombre: empresa, segmento, dirección, teléfono, correo, WhatsApp, web, cursos de interés, puntos fuertes, etc. Las que no reconozca se guardan como datos extra.</p>'+
    '<p style="margin-bottom:12px;color:var(--gris);font-size:.9rem">Si una empresa ya existe (mismo correo, mismo teléfono o mismo nombre) no se duplica: se completan los datos que le falten y conserva todo su historial.</p>'+
    '<div class="campo"><label for="csv-arch">Archivo</label><input id="csv-arch" type="file" accept=".csv,text/csv" onchange="prLeerCSV(this.files[0])"></div>'+
    '<div class="campo"><label for="csv-lote">Nombre de esta tanda</label><input id="csv-lote" value="Carga '+hoy()+'"></div><div id="csv-res"></div>',
    '<button class="btn btn-fantasma" onclick="cerrarModal()">Cancelar</button><button id="csv-btn" class="btn btn-mor" disabled onclick="prImportar()">Importar</button>');
  if(!PR.lista) prCargar().catch(function(){});
}
function prParseCSV(t){
  t = t.replace(/^\uFEFF/, '');
  var sep = (t.split('\n')[0].match(/;/g)||[]).length > (t.split('\n')[0].match(/,/g)||[]).length ? ';' : ',';
  var filas = [], fila = [], campo = '', comillas = false;
  for(var i=0;i<t.length;i++){
    var ch = t[i];
    if(comillas){
      if(ch === '"'){ if(t[i+1] === '"'){ campo += '"'; i++; } else comillas = false; }
      else campo += ch;
    } else if(ch === '"') comillas = true;
    else if(ch === sep){ fila.push(campo); campo = ''; }
    else if(ch === '\n' || ch === '\r'){ if(ch === '\r' && t[i+1] === '\n') i++; fila.push(campo); campo = ''; if(fila.some(function(x){ return x.trim(); })) filas.push(fila); fila = []; }
    else campo += ch;
  }
  fila.push(campo); if(fila.some(function(x){ return x.trim(); })) filas.push(fila);
  return filas;
}
function prNorm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
var PR_COLS = {
  nombre:['nombre de la empresa','empresa','nombre','razon social','negocio'],
  segmento:['segmento','giro','sector','industria'],
  direccion:['direccion','domicilio','ubicacion'],
  puntuacion:['puntuacion google','puntuacion','calificacion','rating','estrellas'],
  resenas:['n de resenas','no de resenas','numero de resenas','resenas'],
  telefono:['telefono','tel','telefono fijo'],
  correo:['correo','email','e mail','correo electronico','mail'],
  whatsapp:['whatsapp','celular','movil','wa'],
  web:['web oficial instagram','web','sitio web','pagina web','instagram','redes'],
  tipo_negocio:['tipo de negocio','tipo'],
  publico:['publico objetivo aparente','publico objetivo','publico'],
  cursos_interes:['cursos diplomados de interes','cursos de interes','programas de interes','cursos','programas'],
  puntos_fuertes:['puntos fuertes resenas','puntos fuertes'],
  presencia:['nivel de presencia','presencia'],
  responde_resenas:['responde resenas'],
  gancho:['gancho','frase de apertura'],
  nombre_corto:['nombre corto'],
  num_origen:['n','no','num','numero','#']
};
function prMapearEncabezados(enc){
  var map = {};
  enc.forEach(function(h, i){
    var n = prNorm(h), k = null;
    Object.keys(PR_COLS).some(function(c){ if(PR_COLS[c].indexOf(n) >= 0){ k = c; return true; } return false; });
    if(k && map[k] == null) map[k] = i; else map['extra:' + h.trim()] = i;
  });
  return map;
}
function prCursoDeNombre(nom){
  var n = prNorm(nom); if(!n) return null;
  var cs = BD.cursos.filter(function(c){ return c.publicado && !ruta(c.id); }), mejor = null, pm = 0;
  for(var i=0;i<cs.length;i++){
    var cn = prNorm(cs[i].nombre);
    if(cn === n) return cs[i].id;
    if(cn.indexOf(n) === 0 || n.indexOf(cn) === 0 || cn.indexOf(n) >= 0){ if(0.95 > pm){ pm = 0.95; mejor = cs[i].id; } continue; }
    var a = n.split(' '), b = cn.split(' '), comun = a.filter(function(x){ return x.length > 2 && b.indexOf(x) >= 0; }).length;
    var s = comun / Math.max(1, a.filter(function(x){ return x.length > 2; }).length);
    if(s > pm){ pm = s; mejor = cs[i].id; }
  }
  return pm >= 0.7 ? mejor : null;
}
function prCortoDe(nombre){
  return String(nombre).split(/ - | \(| SA de CV| S\.A\.| S\. de R\.L\.|,/i)[0].trim();
}
function prGanchoDe(pf){
  var primero = String(pf||'').split(';')[0].trim();
  if(!primero || /queja|negativ|mala|malo|deficien|problema|reclamo|oportunidad|lento|caro/i.test(primero)) return null;
  return 'En sus reseñas, sus clientes destacan: ' + primero.charAt(0).toLowerCase() + primero.slice(1).replace(/\.$/, '');
}
function prClaves(p){
  var k = [];
  String(p.correo||'').split(/[,;\s]+/).forEach(function(c){ c = c.trim().toLowerCase(); if(c.indexOf('@') > 0) k.push('c:' + c); });
  [p.telefono, p.whatsapp].forEach(function(t){ t = prTelLimpio(t).slice(-10); if(t.length === 10) k.push('t:' + t); });
  if(p.nombre) k.push('n:' + prNorm(p.nombre));
  return k;
}
function prLeerCSV(arch){
  if(!arch) return;
  var lector = new FileReader();
  lector.onload = function(){
    var filas = prParseCSV(String(lector.result)), res = $('csv-res');
    if(filas.length < 2){ res.innerHTML = '<div class="aviso aviso-error">El archivo no tiene filas.</div>'; return; }
    var map = prMapearEncabezados(filas[0]);
    if(map.nombre == null){ res.innerHTML = '<div class="aviso aviso-error">No encontré la columna con el nombre de la empresa. Revisa que el archivo tenga encabezados.</div>'; return; }
    var indice = {}; (PR.lista||[]).forEach(function(p){ prClaves(p).forEach(function(k){ indice[k] = p; }); });
    var nuevos = [], actualizar = [], omitidos = 0, enArchivo = {}, sinCurso = {};
    filas.slice(1).forEach(function(f){
      var g = function(k){ var i = map[k]; return i == null ? '' : String(f[i]||'').trim(); };
      var p = { nombre:g('nombre') };
      if(!p.nombre){ omitidos++; return; }
      ['segmento','direccion','telefono','correo','whatsapp','web','tipo_negocio','publico','cursos_interes','puntos_fuertes','presencia','responde_resenas','gancho','nombre_corto']
        .forEach(function(k){ var v = g(k); if(v) p[k] = v; });
      if(p.correo) p.correo = p.correo.split(/[;,\s]+/).filter(function(x){ return x.indexOf('@') > 0; }).join(', ');
      var pu = parseFloat(g('puntuacion').replace(',', '.')); if(!isNaN(pu)) p.puntuacion = pu;
      var re = parseInt(g('resenas').replace(/\D/g,''), 10); if(!isNaN(re)) p.resenas = re;
      var no = parseInt(g('num_origen'), 10); if(!isNaN(no)) p.num_origen = no;
      var extra = {}; Object.keys(map).forEach(function(k){ if(k.indexOf('extra:') === 0){ var v = String(f[map[k]]||'').trim(); if(v) extra[k.slice(6)] = v; } });
      if(Object.keys(extra).length) p.extra = extra;
      if(p.cursos_interes){
        p.cursos_ids = [];
        p.cursos_interes.split(/;|\n/).forEach(function(x){ var id = prCursoDeNombre(x); if(id && p.cursos_ids.indexOf(id) < 0) p.cursos_ids.push(id); else if(!id && x.trim()) sinCurso[x.trim()] = true; });
      }
      if(!p.nombre_corto) p.nombre_corto = prCortoDe(p.nombre);
      if(!p.gancho){ var gg = prGanchoDe(p.puntos_fuertes); if(gg) p.gancho = gg; }
      var claves = prClaves(p), existe = null, dup = false;
      claves.some(function(k){ if(indice[k]){ existe = indice[k]; return true; } if(enArchivo[k]){ dup = true; return true; } return false; });
      if(dup){ omitidos++; return; }
      claves.forEach(function(k){ enArchivo[k] = true; });
      if(existe){
        var cambios = {};
        Object.keys(p).forEach(function(k){ var v = existe[k]; if((v == null || v === '' || (Array.isArray(v) && !v.length)) && p[k] != null && k !== 'extra') cambios[k] = p[k]; });
        if(p.extra) cambios.extra = Object.assign({}, p.extra, existe.extra || {});
        actualizar.push({ id:existe.id, nombre:existe.nombre, cambios:cambios });
      } else nuevos.push(p);
    });
    PR.csv = { nuevos:nuevos, actualizar:actualizar };
    var cols = Object.keys(map).filter(function(k){ return k.indexOf('extra:') !== 0; }).map(function(k){ return k; });
    var falta = Object.keys(sinCurso);
    res.innerHTML = '<div class="aviso aviso-info"><b>'+nuevos.length+' nuevos</b> · '+actualizar.length+' ya existían (se completan datos vacíos'+
      (actualizar.filter(function(a){ return Object.keys(a.cambios).length; }).length ? ', '+actualizar.filter(function(a){ return Object.keys(a.cambios).length; }).length+' con cambios' : '')+') · '+omitidos+' omitidos (sin nombre o repetidos en el archivo).'+
      '<br><small>Columnas reconocidas: '+cols.join(', ')+'.</small>'+
      (falta.length ? '<br><small>Programas que no encontré en el catálogo (se guardan como texto): '+falta.slice(0,8).map(esc).join('; ')+(falta.length>8?'…':'')+'</small>' : '')+'</div>';
    $('csv-btn').disabled = !(nuevos.length || actualizar.length);
  };
  lector.readAsText(arch, 'utf-8');
}
function prImportar(){
  var d = PR.csv, b = $('csv-btn'), lote = $('csv-lote').value.trim() || ('Carga ' + hoy()); if(!d) return;
  b.disabled = true; b.textContent = 'Importando…';
  var nuevos = d.nuevos.map(function(p){ p.lote = lote; return p; }), pasos = [];
  /* PostgREST exige que todas las filas de un POST masivo traigan las mismas columnas
     («All object keys must match»). Se completan las que falten: vacías en null,
     extra en {} (es NOT NULL) y cursos_ids en lista vacía. */
  var columnas = {};
  nuevos.forEach(function(p){ Object.keys(p).forEach(function(k){ columnas[k] = true; }); });
  nuevos = nuevos.map(function(p){
    var fila = {};
    Object.keys(columnas).forEach(function(k){
      fila[k] = p[k] !== undefined ? p[k] : (k === 'extra' ? {} : k === 'cursos_ids' ? [] : null);
    });
    return fila;
  });
  for(var i=0;i<nuevos.length;i+=200) pasos.push(nuevos.slice(i, i+200));
  var cadena = Promise.resolve();
  pasos.forEach(function(lotePaso){ cadena = cadena.then(function(){ return Nube.tabla('prospectos', { metodo:'POST', prefer:'return=minimal', cuerpo:lotePaso }); }); });
  d.actualizar.filter(function(a){ return Object.keys(a.cambios).length; }).forEach(function(a){
    cadena = cadena.then(function(){ return Nube.tabla('prospectos?id=eq.' + a.id, { metodo:'PATCH', prefer:'return=minimal', cuerpo:a.cambios }); });
  });
  cadena.then(function(){ return prCargar(); })
    .then(function(){ cerrarModal(); PR.csv = null; prPintarLista(); alert('Listo: ' + nuevos.length + ' prospectos nuevos.'); })
    .catch(function(e){ b.disabled = false; b.textContent = 'Importar'; $('csv-res').innerHTML += '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
}

/* Al entrar desde el menú, Prospectos abre la lista (no la última ficha). */
var _irBaseProspectos = ir;
ir = function(v, datos){
  if(v === 'admin-prospectos' && !(datos && datos.prospectoId)) estado.prospectoId = null;
  return _irBaseProspectos(v, datos);
};
