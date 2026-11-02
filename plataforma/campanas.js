/* Instituto Mara — Administración → Prospectos → Campañas (2 nov 2026).
   Un correo para TODOS los prospectos con correo que no pidieron baja ni marcaron «No le interesó».
   Se envía por lotes (Brevo), registra cada envío y muestra la entregabilidad (rebotes, bloqueos, spam).
   Requiere backend/campanas-20261102.sql y la función «campanas». */
var CP = { lista:null, sel:null };
function cpAbrir(){
  abrirModal('Campañas por correo', '<div id="cp-caja">Cargando…</div>', '<button class="btn btn-fantasma" onclick="cerrarModal()">Cerrar</button>');
  var md = document.querySelector('#mFondo .modal'); if(md) md.style.maxWidth = '1080px';
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
        '<button class="btn btn-linea btn-sm" onclick="cpPrueba(\''+x.id+'\')">Enviar prueba</button>'+(x.enviados ? '<button class="btn btn-linea btn-sm" onclick="cpReporte(\''+x.id+'\')">⬇ Reporte Excel</button>' : '')+
        '<button class="btn btn-mor btn-sm" onclick="cpEnviar(\''+x.id+'\')">'+(x.estado === 'enviada' ? 'Enviar a los nuevos' : 'Enviar a todos')+'</button></div></div>'; }).join('')
      : '<div class="aviso">Aún no hay campañas.</div>')+'<div id="cp-aviso"></div>';
}
function cpEditar(id){
  var x = id ? CP.lista.filter(function(c){ return c.id === id; })[0] : { nombre:'', asunto:'', texto:'', segmento:'' };
  var giros = (PR.giros || []).map(function(g){ return '<option value="'+esc(g.segmento)+'"'+(x.segmento === g.segmento ? ' selected' : '')+'>'+esc(g.segmento)+'</option>'; }).join('');
  var paso = function(n, t, d){ return '<div style="display:flex;gap:10px;align-items:baseline;margin:4px 0 10px"><span style="flex:none;width:24px;height:24px;border-radius:50%;background:var(--morado);color:#fff;font-weight:700;font-size:.8rem;display:inline-flex;align-items:center;justify-content:center">'+n+'</span><div><b>'+t+'</b>'+(d ? '<div class="ayuda" style="font-size:.8rem;color:var(--gris)">'+d+'</div>' : '')+'</div></div>'; };
  var btnEmp = function(campo){ return '<button type="button" class="btn btn-linea btn-sm" style="margin-top:6px" onclick="cpInsertar(\''+campo+'\')">+ Insertar nombre de la empresa</button>'; };
  $('cp-caja').innerHTML = '<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px" class="cp-editor">'+
    '<div>'+
      paso(1, '¿A quién va?', 'Se omite automáticamente a quien pidió baja, a quien no le interesó y a quien no tiene correo.')+
      '<div class="fila"><div class="campo"><label for="cp-n">Nombre de la campaña</label><input id="cp-n" value="'+esc(x.nombre)+'" maxlength="120" placeholder="Ej. Navidad 2026"><div class="ayuda">Solo lo ves tú.</div></div>'+
      '<div class="campo"><label for="cp-s">Giro</label><select id="cp-s"><option value="">Todos los giros</option>'+giros+'</select><div class="ayuda">Opcional: limita a un giro.</div></div></div>'+
      paso(2, 'Asunto del correo', 'Lo primero que leen en su bandeja. Corto y claro.')+
      '<div class="campo"><input id="cp-a" value="'+esc(x.asunto)+'" maxlength="200" placeholder="Ej. {empresa}: regala un diplomado a tu equipo" oninput="cpVista()">'+btnEmp('cp-a')+'</div>'+
      paso(3, 'Mensaje', 'Escribe solo el cuerpo. La firma y el enlace para darse de baja se agregan solos.')+
      '<div class="campo"><textarea id="cp-t" rows="12" placeholder="Hola, equipo de {empresa}:\n\nEste fin de año…" oninput="cpVista()">'+esc(x.texto)+'</textarea>'+btnEmp('cp-t')+'</div>'+
    '</div>'+
    '<div><div style="position:sticky;top:0">'+paso('👁', 'Así lo verá la empresa', 'Vista previa con «Empresa de ejemplo».')+
      '<div style="border:1px solid var(--linea);border-radius:14px;overflow:hidden;background:#fff"><div style="padding:10px 14px;background:#F8F7FC;border-bottom:1px solid var(--linea);font-size:.85rem"><div style="color:var(--gris)">De: Héctor Ezquerra · Instituto Mara</div><div><b id="cp-va"></b></div></div>'+
      '<div id="cp-vt" style="padding:14px;font-size:.88rem;line-height:1.55;white-space:pre-wrap;max-height:420px;overflow:auto"></div></div></div></div>'+
  '</div>'+
  '<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;border-top:1px solid var(--linea);padding-top:12px"><button class="btn btn-fantasma btn-sm" onclick="cpPintarLista()">← Volver</button><button class="btn btn-mor btn-sm" id="cp-g" onclick="cpGuardar(\''+(id||'')+'\')">Guardar campaña</button></div>'+
  '<div class="ayuda" style="text-align:right;font-size:.8rem;color:var(--gris);margin-top:6px">Guardar no envía nada: después podrás mandarte una prueba y luego enviarla a todos.</div><div id="cp-aviso"></div>';
  if(!document.getElementById('cp-css')){ var st = document.createElement('style'); st.id = 'cp-css'; st.textContent = '@media(max-width:820px){.cp-editor{grid-template-columns:1fr!important}.cp-editor .fila{grid-template-columns:1fr}}'; document.head.appendChild(st); }
  cpVista();
}
function cpInsertar(campo){
  var el = $(campo), i = el.selectionStart == null ? el.value.length : el.selectionStart, f = el.selectionEnd == null ? i : el.selectionEnd;
  el.value = el.value.slice(0, i) + '{empresa}' + el.value.slice(f); el.focus(); el.selectionStart = el.selectionEnd = i + 9; cpVista();
}
function cpVista(){
  if(!$('cp-va')) return;
  var r = function(t){ return String(t || '').replace(/\{empresa\}/g, 'Empresa de ejemplo').replace(/\*/g, ''); };
  $('cp-va').textContent = r($('cp-a').value) || '(sin asunto)';
  $('cp-vt').innerHTML = (esc(r($('cp-t').value)) || '<span style="color:var(--gris)">Aquí aparecerá tu mensaje…</span>') +
    '<div style="margin-top:14px">Saludos cordiales,<br><br><b>Héctor Ezquerra</b><br>Director Académico | Instituto Mara<br>institutomara.com · WhatsApp 81 2028 2120</div>'+
    '<div style="margin-top:12px;font-size:.75rem;color:var(--gris)">Si prefieren no recibir más información, respondan «baja» o usen este enlace…</div>';
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

/* Reporte por campaña en Excel (.xlsx): hoja «Resumen» y hoja «Detalle» (una fila por empresa). */
function cpXlsx(){ return window.XLSX ? Promise.resolve(window.XLSX) : new Promise(function(ok, mal){ var sc = document.createElement('script');
  sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; sc.onload = function(){ ok(window.XLSX); }; sc.onerror = function(){ mal(new Error('No se pudo cargar el generador de Excel.')); }; document.head.appendChild(sc); }); }
function cpReporte(id){
  var av = $('cp-aviso'); av.innerHTML = '<div class="aviso">Armando el reporte con los datos de Brevo…</div>';
  Promise.all([Nube.funcionServidor('campanas', { accion:'reporte', id:id }), cpXlsx()]).then(function(r){
    var d = r[0], X = r[1], f = d.filas || [];
    var cuenta = function(fn){ return f.filter(fn).length; }, pct = function(n){ return f.length ? Math.round(n / f.length * 1000) / 10 + '%' : '0%'; };
    var ent = cuenta(function(x){ return x.entregado; }), ab = cuenta(function(x){ return x.abrio; }), cl = cuenta(function(x){ return x.clic; });
    var reb = cuenta(function(x){ return /Rebote|inválido/.test(x.entrega); }), bloq = cuenta(function(x){ return /Bloqueado|spam/.test(x.entrega); }), nos = cuenta(function(x){ return x.envio === 'falla'; });
    var resumen = [['Campaña', d.campana.nombre], ['Asunto', d.campana.asunto], ['Enviada', d.campana.enviada_en ? new Date(d.campana.enviada_en).toLocaleString('es-MX') : d.campana.estado], [],
      ['Indicador', 'Cantidad', '% de envíos'], ['Destinatarios', f.length, '100%'], ['No salieron', nos, pct(nos)], ['Entregados', ent, pct(ent)], ['Abrieron', ab, pct(ab)], ['Hicieron clic', cl, pct(cl)],
      ['Rebotes', reb, pct(reb)], ['Bloqueados o spam', bloq, pct(bloq)], [], ['Nota', 'Brevo no puede ver la bandeja de cada persona: “entregado sin abrir” puede ser que no lo ha leído o que cayó en no deseados. Las aperturas pueden tardar o no registrarse si el lector bloquea imágenes.']];
    var detalle = [['Empresa', 'Giro', 'Correo', 'Teléfono', 'Fecha de envío', 'Resultado del envío', 'Estado de entrega', 'Entregado', 'Abrió', 'Clic', 'Motivo', 'Estado del prospecto']].concat(f.map(function(x){
      return [x.empresa, x.giro, x.correo, x.telefono, x.fecha ? new Date(x.fecha).toLocaleString('es-MX') : '', x.envio === 'falla' ? 'Falla' : 'Enviado', x.entrega, x.entregado ? 'Sí' : 'No', x.abrio ? 'Sí' : 'No', x.clic ? 'Sí' : 'No', x.motivo, (window.PR_ESTADOS && PR_ESTADOS[x.estadoProspecto]) || x.estadoProspecto]; }));
    var wb = X.utils.book_new(), h1 = X.utils.aoa_to_sheet(resumen), h2 = X.utils.aoa_to_sheet(detalle);
    h1['!cols'] = [{ wch:22 }, { wch:60 }, { wch:14 }]; h2['!cols'] = [{wch:34},{wch:18},{wch:32},{wch:14},{wch:18},{wch:14},{wch:30},{wch:10},{wch:8},{wch:8},{wch:40},{wch:18}];
    h2['!autofilter'] = { ref: 'A1:L' + detalle.length };
    X.utils.book_append_sheet(wb, h1, 'Resumen'); X.utils.book_append_sheet(wb, h2, 'Detalle');
    X.writeFile(wb, 'Reporte campaña - ' + String(d.campana.nombre).replace(/[\\/:*?"<>|]/g, '').slice(0, 60) + '.xlsx');
    av.innerHTML = '<div class="aviso aviso-ok">Reporte descargado: ' + f.length + ' destinatarios, ' + ab + ' abrieron.</div>';
  }).catch(function(e){ av.innerHTML = '<div class="aviso aviso-error">' + esc(e.message) + '</div>'; });
}
