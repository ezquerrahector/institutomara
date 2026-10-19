/* Instituto Mara — Supervisión de operadores (19 oct 2026).
   Se carga después de prueba.js. Requiere backend/prueba-y-supervision-20261019.sql.

   Administración → «Planes y operadores»: cifras de cada operador (le tocan hoy,
   atrasadas, sin llamar, llamadas del día/semana/mes, resultados, pruebas, planes,
   comisiones, última actividad) y la lista de empresas atrasadas con su último
   comentario. Además le llega un resumen por correo cada día hábil a las 7:00 p. m.
   El operador ve sus propios números arriba de «Llamadas». */

var SUP = { datos:[] };
function supCifra(t, v, color, sub){
  return '<div style="flex:1 1 110px;min-width:110px;background:var(--nube);border-radius:12px;padding:10px 12px">'+
    '<div style="font-size:.72rem;color:var(--gris);text-transform:uppercase;letter-spacing:.5px">'+t+'</div>'+
    '<div style="font-size:1.35rem;font-weight:800;color:'+(color || 'var(--tinta)')+'">'+v+'</div>'+(sub ? '<small style="color:var(--gris)">'+sub+'</small>' : '')+'</div>';
}
function supResultados(o){
  var l = Object.keys(o || {}).map(function(k){ return [k, o[k]]; }).sort(function(a,b){ return b[1] - a[1]; });
  return l.length ? l.map(function(x){ return '<span class="etiqueta gris" style="margin:2px 4px 2px 0;text-transform:none;letter-spacing:0">'+esc(x[0])+': '+x[1]+'</span>'; }).join('') : '<span style="color:var(--gris)">Sin llamadas.</span>';
}
function supFecha(iso){ return iso ? new Date(iso).toLocaleDateString('es-MX', { day:'numeric', month:'short' }) : '—'; }

/* ---------- Administración ---------- */
var _vistaAdminPlanesSup = vistaAdminPlanes;
vistaAdminPlanes = function(){
  var h = _vistaAdminPlanesSup();
  return h.replace('<div id="pln-com"></div>', '<div id="pln-sup"></div><div id="pln-com"></div>');
};
var _plnCargarAdminSup = plnCargarAdmin;
plnCargarAdmin = function(){ return _plnCargarAdminSup().then(supCargarAdmin); };
function supCargarAdmin(){
  return Nube.empresaRpc('operador_metricas', {}).then(function(r){ SUP.datos = r || []; supPintarAdmin(); })
    .catch(function(e){ var c = $('pln-sup'); if(c) c.innerHTML = plnErr(e, 'Falta correr backend/prueba-y-supervision-20261019.sql en Supabase.'); });
}
function supPintarAdmin(){
  var caja = $('pln-sup'); if(!caja) return;
  var l = SUP.datos.filter(function(m){ return m.activo; });
  if(!l.length){ caja.innerHTML = ''; return; }
  caja.innerHTML = '<div class="tarjeta" style="margin-bottom:18px"><div class="encabezado-fila" style="margin-bottom:6px"><h3 style="color:var(--tinta);margin:0">Supervisión de operadores</h3>'+
    '<button class="btn btn-fantasma btn-sm" onclick="supCargarAdmin()">Actualizar</button></div>'+
    '<p style="color:var(--gris);font-size:.92rem;margin-bottom:12px">Cómo va cada quien hoy. «Atrasadas» son empresas que tenían llamada en un día anterior y no se registró. Te llega este resumen por correo cada día hábil a las 7:00 p. m.</p>'+
    l.map(function(m){
      var atr = m.atrasadas_lista || [];
      return '<div style="border:1px solid var(--linea);border-radius:14px;padding:14px 16px;margin-bottom:12px">'+
        '<div class="encabezado-fila" style="margin-bottom:10px"><b style="font-size:1.05rem">'+esc(m.nombre)+'</b>'+
          '<small style="color:var(--gris)">Última actividad: '+esc(m.ultima_actividad ? hace(m.ultima_actividad) : 'sin actividad')+' · '+m.asignadas+' empresas asignadas</small></div>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">'+
          supCifra('Le tocan hoy', m.toca_hoy)+
          supCifra('Atrasadas', m.atrasadas, m.atrasadas ? '#B45309' : '#065F46')+
          supCifra('Sin llamar', m.sin_llamar)+
          supCifra('Llamadas hoy', m.llamadas_hoy, null, m.llamadas_semana+' en la semana · '+m.llamadas_mes+' en el mes')+
          supCifra('Pruebas activas', m.pruebas_activas, null, m.pruebas_mes+' creadas en el mes')+
          supCifra('Planes activos', m.planes_activos, null, m.planes_mes+' nuevos en el mes')+
          supCifra('Comisión del mes', dinero(m.comision_mes), null, dinero(m.comision_por_cobrar)+' por cobrar')+
        '</div>'+
        '<div style="font-size:.88rem;margin-bottom:6px"><b>Hoy:</b> '+supResultados(m.resultados_hoy)+'</div>'+
        '<div style="font-size:.88rem"><b>En el mes:</b> '+supResultados(m.resultados_mes)+' <span style="color:var(--gris)">· '+m.conversaciones_mes+' conversaciones con quien decide</span></div>'+
        (atr.length ? '<details style="margin-top:10px"'+(atr.length <= 5 ? ' open' : '')+'><summary style="cursor:pointer;font-weight:600;color:#B45309">Empresas atrasadas ('+m.atrasadas+')</summary>'+
          '<div class="tabla-caja" style="margin-top:8px"><div class="tabla-scroll"><table><thead><tr><th>Empresa</th><th>Tocaba</th><th>Último resultado</th><th>Último comentario</th></tr></thead><tbody>'+
          atr.map(function(a){ return '<tr><td><b>'+esc(a.nombre)+'</b><br><small>'+esc(a.telefono || '')+'</small></td><td>'+esc(supFecha(a.proxima))+'</td>'+
            '<td>'+esc(a.resultado ? (LL_RES_TXT[a.resultado] || a.resultado) : '—')+'</td><td><small>'+esc(a.comentario || '—')+'</small></td></tr>'; }).join('')+
          '</tbody></table></div></div></details>' : '')+
        '</div>';
    }).join('')+'</div>';
}

/* ---------- El operador: sus números arriba de «Llamadas» ---------- */
var _vistaLlamadasSup = vistaLlamadas;
vistaLlamadas = function(){
  var h = _vistaLlamadasSup();
  if(!esOperador() || estado.llamadaId || !h) return h;
  setTimeout(supCargarMios, 0);
  return h.replace('<div id="ll-datos">', '<div id="ll-mios" style="margin-bottom:14px"></div><div id="ll-datos">');
};
function supCargarMios(){
  Nube.empresaRpc('operador_metricas', {}).then(function(r){
    var m = (r || [])[0], c = $('ll-mios'); if(!m || !c) return;
    c.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
      supCifra('Te tocan hoy', m.toca_hoy)+
      supCifra('Atrasadas', m.atrasadas, m.atrasadas ? '#B45309' : '#065F46')+
      supCifra('Llamadas hoy', m.llamadas_hoy, null, m.llamadas_semana+' en la semana')+
      supCifra('Pruebas activas', m.pruebas_activas)+
      supCifra('Planes activos', m.planes_activos)+
      supCifra('Comisión del mes', dinero(m.comision_mes))+
      '</div>'+(m.atrasadas ? '<p style="color:#B45309;font-size:.88rem;margin-top:8px">Tienes '+m.atrasadas+' llamada'+(m.atrasadas === 1 ? '' : 's')+' atrasada'+(m.atrasadas === 1 ? '' : 's')+': aparecen primero en «Toca hoy».</p>' : '');
  }).catch(function(){});
}
