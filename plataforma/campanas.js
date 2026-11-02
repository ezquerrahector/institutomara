/* Instituto Mara — Administración → Prospectos → Campañas (2 nov 2026).
   Un correo para TODOS los prospectos con correo que no pidieron baja ni marcaron «No le interesó».
   Se envía por lotes (Brevo), registra cada envío y muestra la entregabilidad (rebotes, bloqueos, spam).
   Requiere backend/campanas-20261102.sql y la función «campanas». */
var CP = { lista:null, sel:null };
function cpAbrir(){
  abrirModal('Campañas por correo', '<div id="cp-caja">Cargando…</div>', '<button class="btn btn-fantasma" onclick="cerrarModal()">Cerrar</button>');
  cpCargar();
}
function cpCargar(){
  return Nube.tabla('campanas?select=*&order=creada_en.desc').then(function(r){ CP.lista = r || []; cpPintarLista(); })
    .catch(function(e){ $('cp-caja').innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'<br><small>Si dice que no existe la tabla, falta ejecutar backend/campanas-20261102.sql en Supabase.</small></div>'; });
}
var CP_EST = { borrador:['Borrador','gris'], enviando:['Enviando','alerta'], enviada:['Enviada','ok'] };
function cpPintarLista(){
  var c = $('cp-caja'); if(!c) return;
  c.innerHTML = '<p class="sub">Se envían a todos los prospectos con correo, <b>excepto</b> quienes pidieron no recibir correos o marcaste «No le interesó». Cada correo lleva su enlace de baja.</p>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0"><button class="btn btn-mor btn-sm" onclick="cpEditar(null)">+ Nueva campaña</button>'+
    '<button class="btn btn-linea btn-sm" onclick="cpEntregas()">📬 Revisar entregas (rebotes / spam)</button></div>'+
    (CP.lista.length ? CP.lista.map(function(x){ var e = CP_EST[x.estado] || [x.estado,'gris'];
      return '<div style="border:1px solid var(--borde,#E9E6F7);border-radius:12px;padding:12px 14px;margin:8px 0">'+
        '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>'+esc(x.nombre)+'</b><span class="etiqueta '+e[1]+'">'+e[0]+'</span></div>'+
        '<div style="color:var(--gris);font-size:.85rem;margin:4px 0">'+esc(x.asunto)+' · enviados: '+(x.enviados||0)+(x.enviada_en ? ' · '+new Date(x.enviada_en).toLocaleDateString('es-MX') : '')+'</div>'+
        '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-linea btn-sm" onclick="cpEditar(\''+x.id+'\')">Editar</button>'+
        '<button class="btn btn-linea btn-sm" onclick="cpPrueba(\''+x.id+'\')">Enviar prueba</button>'+
        '<button class="btn btn-mor btn-sm" onclick="cpEnviar(\''+x.id+'\')">'+(x.estado === 'enviada' ? 'Enviar a los nuevos' : 'Enviar a todos')+'</button></div></div>'; }).join('')
      : '<div class="aviso">Aún no hay campañas.</div>')+'<div id="cp-aviso"></div>';
}
function cpEditar(id){
  var x = id ? CP.lista.filter(function(c){ return c.id === id; })[0] : { nombre:'', asunto:'', texto:'', segmento:'' };
  var giros = (PR.giros || []).map(function(g){ return '<option value="'+esc(g.segmento)+'"'+(x.segmento === g.segmento ? ' selected' : '')+'>'+esc(g.segmento)+'</option>'; }).join('');
  $('cp-caja').innerHTML = '<label>Nombre interno<input id="cp-n" value="'+esc(x.nombre)+'" maxlength="120"></label>'+
    '<label>Asunto <small>(usa {empresa} para personalizar)</small><input id="cp-a" value="'+esc(x.asunto)+'" maxlength="200"></label>'+
    '<label>Giro <small>(opcional)</small><select id="cp-s"><option value="">Todos los giros</option>'+giros+'</select></label>'+
    '<label>Mensaje <small>({empresa} se reemplaza; la firma y el enlace de baja se agregan solos)</small><textarea id="cp-t" rows="14">'+esc(x.texto)+'</textarea></label>'+
    '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-fantasma btn-sm" onclick="cpPintarLista()">← Volver</button><button class="btn btn-mor btn-sm" id="cp-g" onclick="cpGuardar(\''+(id||'')+'\')">Guardar</button></div><div id="cp-aviso"></div>';
}
function cpGuardar(id){
  var cuerpo = { nombre:$('cp-n').value.trim(), asunto:$('cp-a').value.trim(), texto:$('cp-t').value.trim(), segmento:$('cp-s').value || null };
  if(!cuerpo.nombre || !cuerpo.asunto || !cuerpo.texto){ $('cp-aviso').innerHTML = '<div class="aviso aviso-error">Completa nombre, asunto y mensaje.</div>'; return; }
  var p = id ? Nube.tabla('campanas?id=eq.'+id, { metodo:'PATCH', prefer:'return=minimal', cuerpo:cuerpo }) : Nube.tabla('campanas', { metodo:'POST', prefer:'return=minimal', cuerpo:cuerpo });
  p.then(cpCargar).catch(function(e){ $('cp-aviso').innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
}
function cpPrueba(id){
  var para = prompt('¿A qué correo envío la prueba?', (sesion && sesion.correo) || 'contacto@institutomara.com'); if(!para) return;
  $('cp-aviso').innerHTML = '<div class="aviso">Enviando prueba…</div>';
  Nube.funcionServidor('campanas', { accion:'prueba', id:id, para:para })
    .then(function(){ $('cp-aviso').innerHTML = '<div class="aviso aviso-ok">Prueba enviada a '+esc(para)+'. Revisa también la carpeta de spam.</div>'; })
    .catch(function(e){ $('cp-aviso').innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
}
function cpEnviar(id){
  var av = $('cp-aviso'); av.innerHTML = '<div class="aviso">Calculando destinatarios…</div>';
  Nube.funcionServidor('campanas', { accion:'audiencia', id:id }).then(function(a){
    if(!a.pendientes){ av.innerHTML = '<div class="aviso aviso-ok">Ya se envió a todos ('+a.yaEnviados+'). Omitidos por baja / no le interesó / sin correo: '+a.omitidos+'.</div>'; return; }
    if(!confirm('Se enviará a '+a.pendientes+' prospecto(s)'+(a.yaEnviados ? ' (ya se envió a '+a.yaEnviados+')' : '')+'.\nSe omiten '+a.omitidos+' (pidieron baja, no les interesó o no tienen correo).\n\n¿Enviar ahora?')) { av.innerHTML = ''; return; }
    var tot = 0, fallas = [];
    (function lote(){
      av.innerHTML = '<div class="aviso">Enviando… '+tot+' de '+a.pendientes+'</div>';
      Nube.funcionServidor('campanas', { accion:'enviar', id:id }).then(function(r){
        tot += r.enviados; fallas = fallas.concat(r.fallas || []);
        if(r.restantes > 0 && (r.enviados || (r.fallas||[]).length)) return setTimeout(lote, 1500);
        av.innerHTML = '<div class="aviso aviso-ok">Listo: '+tot+' enviados.'+(fallas.length ? '<br>No salieron '+fallas.length+':<br>'+fallas.slice(0,30).map(esc).join('<br>') : '')+'</div>';
        Nube.tabla('campanas?select=*&order=creada_en.desc').then(function(l){ CP.lista = l || []; var keep = av.innerHTML; cpPintarLista(); $('cp-aviso').innerHTML = keep; });
      }).catch(function(e){ av.innerHTML = '<div class="aviso aviso-error">Se detuvo después de '+tot+' envíos: '+esc(e.message)+'. Puedes volver a presionar «Enviar»: no se repite a quien ya lo recibió.</div>'; });
    })();
  }).catch(function(e){ av.innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
}
var CP_EV = { requests:'Enviados', delivered:'Entregados', opened:'Abiertos (personas únicas pueden repetirse)', uniqueOpened:'Aperturas únicas', clicks:'Clics', softBounces:'Rebote temporal', hardBounces:'Rebote definitivo (correo no existe)',
  blocked:'Bloqueados por Brevo', spam:'Marcados como spam', invalid:'Correo inválido', deferred:'Retrasados por el servidor destino', unsubscribed:'Se dieron de baja', error:'Error' };
function cpEntregas(){
  $('cp-caja').innerHTML = 'Consultando Brevo…';
  Nube.funcionServidor('campanas', { accion:'entregas', dias:30 }).then(function(r){
    var t = r.tipos || {}, env = t.requests || 0, ent = t.delivered || 0, ab = t.uniqueOpened || t.opened || 0;
    var pct = function(n){ return env ? Math.round(n / env * 100) + '%' : '—'; };
    $('cp-caja').innerHTML = '<p class="sub">Últimos '+r.dias+' días de correos a prospectos. Brevo no puede ver si un correo cayó en «no deseados»; lo indican pocas aperturas pese a estar entregado, y las quejas de spam.</p>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:10px 0">'+
      [['Enviados',env,''],['Entregados',ent,pct(ent)],['Abiertos',ab,pct(ab)],['Rebotes',(t.hardBounces||0)+(t.softBounces||0),pct((t.hardBounces||0)+(t.softBounces||0))],['Bloqueados',t.blocked||0,pct(t.blocked||0)],['Spam',t.spam||0,pct(t.spam||0)]]
        .map(function(k){ return '<div style="border:1px solid var(--borde,#E9E6F7);border-radius:10px;padding:10px"><div style="font-size:.75rem;color:var(--gris);text-transform:uppercase">'+k[0]+'</div><div style="font-size:1.4rem;font-weight:800">'+k[1]+'</div><div style="font-size:.8rem;color:var(--gris)">'+k[2]+'</div></div>'; }).join('')+'</div>'+
      (env && ab / env < 0.12 ? '<div class="aviso aviso-error">Aperturas muy bajas: es probable que muchos correos lleguen a «no deseados». Revisa la autenticación del dominio (SPF, DKIM y DMARC) en Brevo → Remitentes y dominios.</div>' : '')+
      '<h4 style="margin:12px 0 6px">Correos con problema ('+(r.problemas||[]).length+')</h4>'+
      ((r.problemas||[]).length ? '<div style="max-height:260px;overflow:auto;font-size:.85rem">'+r.problemas.map(function(p){ return '<div style="padding:5px 0;border-bottom:1px solid var(--borde,#eee)"><b>'+esc(p.correo)+'</b> · '+esc(CP_EV[p.evento]||p.evento)+' · '+esc((p.fecha||'').slice(0,10))+(p.motivo ? '<br><small style="color:var(--gris)">'+esc(p.motivo)+'</small>' : '')+'</div>'; }).join('')+'</div>' : '<div class="aviso aviso-ok">Sin rebotes, bloqueos ni quejas en este periodo.</div>')+
      '<div style="margin-top:10px"><button class="btn btn-fantasma btn-sm" onclick="cpPintarLista()">← Volver</button></div>';
  }).catch(function(e){ $('cp-caja').innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div><button class="btn btn-fantasma btn-sm" onclick="cpPintarLista()">← Volver</button>'; });
}
