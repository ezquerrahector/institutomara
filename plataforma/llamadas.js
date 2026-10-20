/* Instituto Mara — Consola de llamadas (19 oct 2026).
   Se carga después de planes.js. Requiere backend/llamadas-20261019.sql.

   · El operador entra directo a «Llamadas»: su cola del día (agendadas que ya
     tocan y empresas sin llamar), y las de 2.ª y 3.ª llamada.
   · Cada ficha muestra el guion aprobado con los datos ya puestos (su nombre,
     su teléfono, la empresa, los programas de su giro) y un formulario para
     registrar con quién habló, el resultado, la siguiente llamada y comentarios.
   · Si la empresa acepta la prueba, desde la misma ficha se crea la empresa, su
     administrador y los 5 lugares por 15 días.
   · Administración reparte prospectos en bloques desde Prospectos y puede abrir
     la consola para ver lo mismo que el operador. */

var LL = { op:null, ops:[], tab:'hoy', q:'', cola:[], guion:null };
var LL_RES = [
  ['no_contesto','No contestó', 'Se vuelve a llamar el siguiente día hábil.'],
  ['buzon','Buzón o dejé recado', 'Se vuelve a llamar en 2 días hábiles.'],
  ['recepcion','Recepción no me transfirió', 'Anota el nombre del encargado si te lo dieron. Se vuelve a llamar en 2 días hábiles.'],
  ['otro_dia','Pidió que llame otro día', 'Escribe la fecha y hora que te dijo.'],
  ['info_correo','Pidió información por correo', 'Escribe su correo. Se vuelve a llamar en 3 días hábiles.'],
  ['piloto','Aceptó la prueba', 'Al guardar, se crea su prueba de 5 lugares por 15 días.'],
  ['demo','Agendó demostración', 'Escribe la fecha y hora de la demostración.'],
  ['proveedor','Ya tiene proveedor', 'Se le vuelve a ofrecer en unos dos meses.'],
  ['no_interesa','No le interesa', 'Ya no se le vuelve a llamar.'],
  ['equivocado','Número equivocado', 'Se saca de la lista.']
];
var LL_RES_TXT = {}; LL_RES.forEach(function(r){ LL_RES_TXT[r[0]] = r[1]; });
var LL_TRANSV = {
  planta: ['d-nom035','d-seguridad-higiene','d-calidad-lean','c-excel-avanzado','d-liderazgo'],
  clientes: ['c-atencion-ventas','d-nom035','c-excel-avanzado','d-liderazgo'],
  oficina: ['c-excel-avanzado','d-nom035','c-atencion-ventas','d-liderazgo']
};

function llEsAdmin(){ return !!(sesion && sesion.rol === 'admin'); }
function llCerrado(p){ return ['no_interesa','descartado','baja','cliente'].indexOf(p.estado) >= 0; }
function llFinHoy(){ var d = new Date(); d.setHours(23,59,59,999); return d; }
function llToca(p){
  if(llCerrado(p)) return false;
  if(p.proxima_llamada) return new Date(p.proxima_llamada) <= llFinHoy();
  return !p.llamadas_intentos && ['nuevo','contactado'].indexOf(p.estado) >= 0;
}
var LL_TABS = [
  ['hoy','Toca hoy', function(p){ return llToca(p); }],
  ['sin','Sin llamar', function(p){ return !llCerrado(p) && !p.llamadas_intentos; }],
  ['segunda','2.ª llamada', function(p){ return !llCerrado(p) && Number(p.llamada_toque) === 1 && ['piloto','demo'].indexOf(p.estado) < 0; }],
  ['tercera','3.ª llamada', function(p){ return !llCerrado(p) && Number(p.llamada_toque) >= 2 && ['piloto','demo'].indexOf(p.estado) < 0; }],
  ['agenda','Agendadas', function(p){ return !llCerrado(p) && p.proxima_llamada && new Date(p.proxima_llamada) > llFinHoy(); }],
  ['pruebas','Pruebas y demos', function(p){ return p.estado === 'piloto' || p.estado === 'demo'; }],
  ['cerrados','Cerrados', function(p){ return llCerrado(p); }],
  ['todos','Todos', function(){ return true; }]
];
function llLista(tab){
  var t = LL_TABS.filter(function(x){ return x[0] === tab; })[0] || LL_TABS[0], q = plNorm(LL.q);
  return (PR.lista||[]).filter(t[2]).filter(function(p){
    return !q || plNorm([p.nombre, p.segmento, p.telefono, p.whatsapp, p.contacto_nombre].join(' ')).indexOf(q) >= 0;
  }).sort(function(a, b){
    /* Primero las agendadas (por hora), luego las que nunca se han llamado (en el orden del archivo). */
    var fa = a.proxima_llamada ? new Date(a.proxima_llamada).getTime() : Infinity, fb = b.proxima_llamada ? new Date(b.proxima_llamada).getTime() : Infinity;
    return fa !== fb ? fa - fb : (Number(a.num_origen)||1e9) - (Number(b.num_origen)||1e9);
  });
}
function llOperadorDe(p){
  if(esOperador()) return LL.op;
  return (LL.ops||[]).filter(function(o){ return o.id === p.asignado_a; })[0] || null;
}
function llFechaHora(iso){
  if(!iso) return '—';
  var d = new Date(iso), hoyD = new Date(), man = new Date(); man.setDate(man.getDate() + 1);
  var hora = d.toLocaleTimeString('es-MX', { hour:'numeric', minute:'2-digit' });
  if(d.toDateString() === hoyD.toDateString()) return 'Hoy ' + hora;
  if(d.toDateString() === man.toDateString()) return 'Mañana ' + hora;
  return d.toLocaleDateString('es-MX', { weekday:'short', day:'numeric', month:'short' }) + ' ' + hora;
}
function llTelHref(t){ var d = String(t||'').replace(/\D/g,''); return d ? 'tel:' + (d.length === 10 ? '+52' + d : '+' + d) : ''; }

function llCargar(){
  var pasos = [ prCargar(), plnCargarRangos().catch(function(){ return []; }) ];
  if(esOperador()) pasos.push(Nube.tabla('operadores?select=*&usuario_id=eq.' + sesion.id).then(function(r){ LL.op = (r && r[0]) || null; PLN.miOp = LL.op; }));
  else pasos.push(Nube.tabla('operadores?select=*&order=nombre.asc').then(function(r){ LL.ops = r || []; }).catch(function(){ LL.ops = []; }));
  return Promise.all(pasos);
}

/* ============================================================================
   Lista (cola de llamadas)
   ========================================================================== */
function vistaLlamadas(){
  if(!sesion || !(llEsAdmin() || esOperador())) return '';
  if(estado.llamadaId) return vistaLlamada();
  /* Al volver a la lista (por ejemplo, desde una llamada) se pinta al instante con lo que
     ya se tenía y se actualiza en segundo plano; solo se vuelve a pintar si cambió algo. */
  var habia = !!(LL.cargado && PR.lista), antes = habia ? llHuella() : '';
  setTimeout(function(){
    if(habia) llPintarLista();
    llCargar().then(function(){
      LL.cargado = true;
      if(estado.vista !== 'llamadas' || estado.llamadaId) return;
      if(!habia) llPintarLista();
      else if(llHuella() !== antes) repintarConservando(llPintarLista);
    }).catch(function(e){
      if(habia) return;
      var c = $('ll-datos'); if(c) c.innerHTML = plnErr(e, 'Si dice que no existe la columna o la función, falta ejecutar backend/llamadas-20261019.sql en Supabase.');
    });
  }, 0);
  return '<div class="seccion"><div class="encabezado-fila"><div><h2>Llamadas</h2>'+
    '<p class="sub" style="margin:0">'+(esOperador() ? 'Tus empresas por llamar. Abre una, sigue el guion y registra lo que pasó.' : 'La consola de los operadores: lo mismo que ven ellos, con todos los prospectos asignados.')+'</p></div>'+
    (llEsAdmin() ? '<button class="btn btn-linea" onclick="ir(\'admin-prospectos\')">← Prospectos</button>' : '')+'</div>'+
    '<div id="ll-datos">'+(habia ? '' : 'Cargando…')+'</div></div>';
}
function llHuella(){ return prHuella() + JSON.stringify([LL.op, PLN.rangos || null]); }
function llPintarLista(){
  var caja = $('ll-datos'); if(!caja || !PR.lista) return;
  var L = PR.lista, hoyStr = new Date().toDateString();
  var hechasHoy = PR.contactos.filter(function(c){ return c.canal === 'llamada' && new Date(c.fecha).toDateString() === hoyStr && (!esOperador() || c.creado_por === sesion.id); }).length;
  var met = function(rot, val, pie){ return '<div class="metrica"><div class="rot">'+rot+'</div><div class="val">'+val+'</div><div class="pie">'+pie+'</div></div>'; };
  var asignados = llEsAdmin() ? L.filter(function(p){ return p.asignado_a; }) : L;
  if(!asignados.length){
    caja.innerHTML = '<div class="tarjeta vacio"><p>'+(esOperador() ? 'Todavía no tienes empresas asignadas. Administración te las asigna en bloques; aparecerán aquí.' :
      'Todavía no hay prospectos asignados a un operador. Asígnalos desde Prospectos: selecciónalos y elige «Asignar a».')+'</p></div>';
    return;
  }
  var cuenta = function(tab){ var t = LL_TABS.filter(function(x){ return x[0] === tab; })[0]; return asignados.filter(t[2]).length; };
  caja.innerHTML = '<div class="rejilla rejilla-4" style="margin:6px 0 16px">'+
      met('Toca hoy', cuenta('hoy'), cuenta('sin')+' sin llamar todavía')+
      met('Llamadas de hoy', hechasHoy, esOperador() ? 'registradas por ti' : 'de todos los operadores')+
      met('En seguimiento', cuenta('segunda') + cuenta('tercera'), cuenta('agenda')+' agendadas')+
      met('Pruebas y demos', cuenta('pruebas'), L.filter(function(p){ return p.estado === 'cliente'; }).length+' ya son clientes')+
    '</div>'+
    '<div class="chips-aula" style="margin-bottom:10px">'+LL_TABS.map(function(t){
      return '<button class="'+(LL.tab===t[0]?'on':'')+'" onclick="LL.tab=\''+t[0]+'\';llPintarTablaLl()">'+t[1]+' <small>'+cuenta(t[0])+'</small></button>'; }).join('')+'</div>'+
    '<div class="campo" style="max-width:420px"><label for="ll-q">Buscar</label><input id="ll-q" placeholder="Empresa, giro, teléfono, contacto…" value="'+esc(LL.q)+'" oninput="LL.q=this.value;clearTimeout(LL._t);LL._t=setTimeout(llPintarTablaLl,150)"></div>'+
    '<div id="ll-tabla"></div>';
  llPintarTablaLl();
}
function llPintarTablaLl(){
  var caja = $('ll-tabla'); if(!caja) return;
  document.querySelectorAll('#ll-datos .chips-aula button').forEach(function(b, i){ b.classList.toggle('on', LL_TABS[i][0] === LL.tab); });
  var filas = llLista(LL.tab).filter(function(p){ return !llEsAdmin() || p.asignado_a; });
  LL.cola = filas.map(function(p){ return p.id; });
  if(!filas.length){ caja.innerHTML = '<div class="tarjeta vacio"><p>'+(LL.tab === 'hoy' ? '¡Listo por hoy! No hay llamadas pendientes. Revisa «Agendadas» para ver las próximas.' : 'No hay empresas en esta lista.')+'</p></div>'; return; }
  filasPorPartes(caja, 'll', filas.map(function(p){
      var tel = p.telefono || p.whatsapp, o = llOperadorDe(p);
      var vencida = p.proxima_llamada && new Date(p.proxima_llamada) < new Date();
      return '<tr><td style="min-width:190px"><b>'+esc(p.nombre)+'</b><br><small style="color:var(--gris)">'+esc(p.segmento||'')+(p.contacto_nombre ? ' · '+esc(p.contacto_nombre) : '')+'</small></td>'+
        '<td style="white-space:nowrap">'+(tel ? '<a href="'+llTelHref(tel)+'">'+esc(prTelLimpio(tel).slice(-10))+'</a>' : '<small style="color:var(--gris)">Sin teléfono</small>')+'</td>'+
        '<td>'+llNumeroTxt(p)+'</td>'+
        '<td><small>'+(p.ultimo_resultado ? esc(LL_RES_TXT[p.ultimo_resultado]||p.ultimo_resultado)+'<br>'+esc(llFechaHora(p.ultima_llamada)) : '—')+'</small></td>'+
        '<td><small'+(vencida ? ' style="color:#B45309;font-weight:700"' : '')+'>'+esc(p.proxima_llamada ? llFechaHora(p.proxima_llamada) : (llCerrado(p) ? '—' : 'Cuando puedas'))+'</small></td>'+
        (llEsAdmin() ? '<td><small>'+esc(o ? o.nombre : '—')+'</small></td>' : '')+
        '<td><button class="btn btn-mor btn-sm" onclick="llAbrir(\''+p.id+'\')">'+(llCerrado(p) ? 'Ver' : 'Llamar')+'</button></td></tr>';
    }),
    '<div class="tabla-caja"><div class="tabla-scroll"><table><thead><tr><th>Empresa</th><th>Teléfono</th><th>Llamada</th><th>Último resultado</th><th>Siguiente</th>'+
    (llEsAdmin() ? '<th>Operador</th>' : '')+'<th></th></tr></thead><tbody>',
    '</tbody></table></div></div>'+
    '<p style="color:var(--gris);font-size:.85rem;margin-top:8px">'+filas.length+' empresa'+(filas.length===1?'':'s')+'. Al abrir una, «Siguiente» recorre esta misma lista.</p>');
}
function llNumeroTxt(p){
  if(p.estado === 'piloto') return '<span class="etiqueta tur">En prueba</span>';
  if(p.estado === 'demo') return '<span class="etiqueta tur">Demo</span>';
  if(llCerrado(p)) return '<span class="etiqueta gris">'+esc(PR_ESTADOS[p.estado]||p.estado)+'</span>';
  var t = Number(p.llamada_toque)||0, n = Number(p.llamadas_intentos)||0;
  var etq = t === 0 ? '1.ª llamada' : t === 1 ? '2.ª llamada' : '3.ª llamada';
  return '<b>'+etq+'</b>'+(n ? '<br><small style="color:var(--gris)">'+n+' intento'+(n===1?'':'s')+'</small>' : '');
}
function llAbrir(id){ estado.llamadaId = id; LL.guion = null; pintar(); window.scrollTo(0,0); }
function llSiguiente(paso){
  var c = LL.cola || [], i = c.indexOf(estado.llamadaId);
  if(i < 0 || !c[i + paso]) return;
  llAbrir(c[i + paso]);
}

/* ============================================================================
   Ficha de llamada: guion + registro
   ========================================================================== */
function vistaLlamada(){
  var id = estado.llamadaId;
  setTimeout(function(){
    (PR.lista ? Promise.resolve() : llCargar()).then(function(){ llPintarFicha(id); })
      .catch(function(e){ var c = $('lf-cab'); if(c) c.innerHTML = plnErr(e); });
  }, 0);
  var c = LL.cola || [], i = c.indexOf(id);
  var nav = i >= 0 && c.length > 1 ? '<div style="display:flex;gap:8px;align-items:center"><button class="btn btn-fantasma btn-sm"'+(i>0?'':' disabled')+' onclick="llSiguiente(-1)">‹ Anterior</button>'+
    '<span style="color:var(--gris);font-size:.9rem">'+(i+1)+' de '+c.length+'</span>'+
    '<button class="btn btn-linea btn-sm"'+(i<c.length-1?'':' disabled')+' onclick="llSiguiente(1)">Siguiente ›</button></div>' : '';
  return '<div class="seccion"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">'+
    '<button class="btn btn-fantasma btn-sm" onclick="estado.llamadaId=null;pintar()">← Llamadas</button>'+nav+'</div>'+
    '<div id="lf-cab">Cargando…</div>'+
    '<div class="rejilla" style="grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:18px;margin-top:16px;align-items:start">'+
      '<div style="min-width:0"><div class="tarjeta" id="lf-guion"></div><div class="tarjeta" style="margin-top:18px" id="lf-registro"></div></div>'+
      '<div style="min-width:0"><div class="tarjeta" id="lf-datos"></div><div class="tarjeta" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:10px">Historial</h3><div id="lf-hist"></div></div></div>'+
    '</div></div>';
}
function llPintarFicha(id){
  var p = prPorId(id), cab = $('lf-cab'); if(!cab) return;
  if(!p){ cab.innerHTML = '<div class="aviso aviso-error">No encontré esa empresa. Quizá ya no está asignada a ti.</div>'; return; }
  var tel = p.telefono || p.whatsapp;
  cab.innerHTML = '<div class="encabezado-fila"><div><h2>'+esc(p.nombre)+'</h2><p class="sub" style="margin:0">'+esc(p.segmento||'')+' · '+llNumeroTxt(p).replace(/<br>/g,' · ')+'</p></div>'+
    (tel ? '<a class="btn btn-mor" href="'+llTelHref(tel)+'">☎ Llamar '+esc(prTelLimpio(tel).slice(-10))+'</a>' : '')+'</div>'+
    (p.estado === 'no_interesa' ? '<div class="aviso aviso-error" style="margin-top:10px">Esta empresa dijo que no le interesa. Ya no se le llama.</div>' : '');
  llPintarGuion(p); llPintarRegistro(p); llPintarDatos(p); llPintarHist(p);
}

/* ---------- Datos que llenan el guion ---------- */
function llSaludo(){ var h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; }
function llCortoPrograma(nombre){ return String(nombre).replace(/^Diplomado (en |de )?/i, '').split(':')[0].replace(/\s*\(.*?\)\s*/g, ' ').trim(); }
function llProgramas(p){
  var pub = function(id){ var c = curso(id); return c && c.publicado !== false ? c : null; };
  var giro = (p.cursos_ids||[]).map(pub).filter(Boolean);
  var s = String(p.segmento||'').toLowerCase();
  var tipo = /calzado|curtidur|manufactura|industria|seguridad privada/.test(s) ? 'planta'
    : /concesionaria|hotel|asegura|seguros|boutique|call center|inmobiliaria|hospital|clínica|diagnóstico|funeraria|residencia/.test(s) ? 'clientes' : 'oficina';
  var ya = giro.map(function(c){ return c.id; });
  var extra = LL_TRANSV[tipo].filter(function(id){ return ya.indexOf(id) < 0; }).map(pub).filter(Boolean);
  return giro.concat(extra).map(function(c){ return llCortoPrograma(c.nombre); });
}
function llTotalProgramas(){
  var n = (BD.cursos||[]).filter(function(c){ return c.publicado !== false && !ruta(c.id); }).length;
  return n > 20 ? 'más de ' + Math.floor((n - 1) / 10) * 10 : 'todos nuestros';
}
function llUltimaConversacion(p){
  var c = prContactos(p.id).filter(function(x){ return x.canal === 'llamada' && x.toque; }).pop();
  return c ? new Date(c.fecha).toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' }) : null;
}
function llDatosGuion(p){
  var o = llOperadorDe(p) || {}, progs = llProgramas(p), r0 = (PLN.rangos||[]).filter(function(r){ return r.activo; })[0];
  var lim = plnDescMax(); if(o && o.descuento_max != null) lim = Math.min(lim, Number(o.descuento_max));
  return {
    saludo: llSaludo(),
    op: o.nombre || sesion.nombre,
    tel: o.telefono ? String(o.telefono).replace(/\D/g,'').replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3') : '(tu teléfono)',
    emp: prCorto(p),
    p1: progs[0] || 'NOM-035', p2: progs[1] || 'Excel', p3: progs[2] || 'Liderazgo',
    n: llTotalProgramas(),
    trato: p.contacto_nombre || '(nombre de la persona)',
    dia: llUltimaConversacion(p) || '(día de la llamada anterior)',
    desde: r0 ? dinero(r0.precio_mensual).replace(/\.00$/, '') : '$1,490',
    hasta: r0 && r0.hasta ? r0.hasta : 5,
    meses: plnMesesAnual(), desc: lim, descMeses: plnDescMeses()
  };
}
/* Texto con las variables resaltadas: {clave} se cambia por su valor. */
function llTxt(t, d){ return esc(t).replace(/\{(\w+)\}/g, function(m, k){ return '<b style="background:#F3E8FF;border-radius:4px;padding:0 3px">'+esc(d[k] != null ? d[k] : m)+'</b>'; }); }

/* Guiones aprobados por Héctor el 19 oct 2026. */
var LL_GUIONES = [
  { id:'recepcion', rot:'1. Recepción', partes:[
    ['', '{saludo}, habla {op}, de Instituto Mara. ¿Me podría comunicar, por favor, con la persona de Capital Humano o con quien se encarga de la capacitación del personal?'],
    ['Si preguntan «¿de parte de quién?» o «¿de qué se trata?»', 'Somos una escuela en línea que capacita equipos de trabajo, con constancia con folio y QR verificable que pueden agregar a su currículum. Le estamos regalando a {emp} una prueba de 5 lugares sin costo por 15 días, en temas como {p1}, {p2} y {p3}. ¿Con quién lo podría platicar?'],
    ['Si no lo transfieren', 'Entiendo. ¿Me podría compartir el contacto de esa persona para mandarle la información? ¿Y a qué hora es más fácil encontrarla?']
  ]},
  { id:'encargado', rot:'2. Con quien decide', partes:[
    ['', 'Gracias por tomar mi llamada, {trato}. En Instituto Mara capacitamos equipos de trabajo en línea; su gente estudia desde el celular o la computadora, a su ritmo.'],
    ['', 'Para {emp} le pueden servir mucho {p1}, {p2} y {p3}, o cualquiera de nuestros {n} cursos y diplomados. Al terminar, cada persona recibe una constancia con folio y QR verificable, que puede agregar a su currículum.'],
    ['', 'Y lo que más valoran las empresas: usted tiene su propio panel, donde ve quién está estudiando, cuánto avanzó cada persona y quién ya terminó, y puede descargar el reporte.'],
    ['', 'Les quiero regalar 5 lugares por 15 días para que lo prueben sin compromiso. Si les gusta, es muy sencillo: una mensualidad fija según el número de colaboradores, y todos pueden tomar todo el catálogo. Desde {desde} al mes para hasta {hasta} personas, IVA incluido.'],
    ['', '¿Les gustaría empezar la prueba esta semana?'],
    ['Si dice que sí', 'Perfecto. ¿A qué correo le mando el acceso como administrador? ¿Ya tiene en mente a las 5 personas o prefiere que se las registre yo? Solo necesito nombre y correo de cada una.'],
    ['Si dice «mándeme información»', 'Con gusto. ¿A qué correo se la envío? Le marco el (día) para resolver sus dudas. ¿Le queda mejor en la mañana o en la tarde?']
  ]},
  { id:'segunda', rot:'3. Segunda llamada', partes:[
    ['', '{saludo}, {trato}, habla {op}, de Instituto Mara. El {dia} platicamos sobre la prueba de 5 lugares sin costo para su equipo, con programas como {p1} y {p2}. ¿Tuvo oportunidad de revisar la información que le envié?'],
    ['Si la revisó', '¿Qué le pareció? ¿Le gustaría que activemos la prueba esta semana? Solo necesito el correo de quien va a administrar y los nombres de las personas.'],
    ['Si no la revisó', 'No se preocupe, se lo resumo en un minuto: son 5 lugares gratis por 15 días, su gente toma los cursos desde el celular y usted ve el avance de cada uno en su panel. ¿Arrancamos?'],
    ['Si dice que todavía lo está viendo', 'Claro. ¿Hay algo que le ayude a decidir, como una demostración de 20 minutos por Meet o Teams? Si no, ¿le marco el (día)?'],
    ['Si antes solo hablaste con recepción', 'Hace unos días les llamé para ofrecerles una prueba de capacitación sin costo; ¿me podría comunicar con {trato}?']
  ]},
  { id:'tercera', rot:'4. Tercera llamada', partes:[
    ['', '{saludo}, {trato}, habla {op}, de Instituto Mara. Le he buscado un par de veces por la prueba de capacitación para su equipo y no quiero quitarle más tiempo. Solo quería saber si la dejamos para otro momento o si les gustaría aprovecharla ahora: 5 lugares sin costo por 15 días, en {p1}, {p2} o el que necesiten.'],
    ['Si dice que ahora no', 'Entiendo perfecto. ¿Le parece si le busco en (mes), cuando estén planeando la capacitación? Y si antes le surge algo, me puede escribir a contacto@institutomara.com.'],
    ['Si dice que sí', 'Se sigue igual que con quien decide: correo del administrador y nombres de las personas.'],
    ['Si dice que no le interesa', 'Gracias por su tiempo y por decírmelo. Que tenga excelente día. (Registra «No le interesa»: ya no se le vuelve a llamar.)']
  ]},
  { id:'recado', rot:'5. Recado o buzón', partes:[
    ['', '{saludo}, habla {op}, de Instituto Mara, para la persona de Capital Humano de {emp}. Le llamo para regalarles una prueba de capacitación en línea para su equipo: 5 lugares sin costo por 15 días. Me puede regresar la llamada al {tel} o escribir a contacto@institutomara.com. Gracias, que tenga buen día.']
  ]},
  { id:'objeciones', rot:'6. Objeciones', partes:[
    ['«Ya tenemos proveedor de capacitación»', 'Qué bueno que ya capacitan a su gente. Muchas empresas nos usan como complemento en temas como {p1} o {p2}. La prueba no los compromete a nada; ¿por qué no la comparan?'],
    ['«No tenemos presupuesto» (escalones 1 a 3)', 'Entiendo. Por eso empezamos sin costo: prueben 15 días y decidan con resultados. Y si les sirve, pueden arrancar con el plan para hasta {hasta} personas y crecer después. Si prefieren pagar el año, les queda en {meses} meses.'],
    ['Solo si la objeción sigue (escalones 4 a 6)', 'Puedes ofrecer hasta {desc}% de descuento los primeros {descMeses} meses. Más que eso, o extender la prueba, lo pides a administración desde la ficha de la empresa.'],
    ['«¿La constancia es oficial?»', 'Es una constancia propia de Instituto Mara, con folio y QR verificable, que pueden agregar a su currículum. No es de la SEP.'],
    ['«No tenemos tiempo para capacitar»', 'Justo por eso es en línea: cada persona estudia desde su celular, en el tiempo que tenga, y usted ve en su panel quién avanza.'],
    ['«Mándeme información por correo»', 'Con gusto. ¿A qué correo se la envío? ¿Le marco el (día) para resolver sus dudas?'],
    ['«¿Dan factura?»', 'Sí. Nos manda su constancia de situación fiscal y el uso de CFDI a contacto@institutomara.com, y se la generamos.']
  ]}
];
function llGuionSugerido(p){
  var t = Number(p.llamada_toque)||0;
  if(t >= 2) return 'tercera';
  if(t === 1) return 'segunda';
  return 'recepcion';
}
function llPintarGuion(p){
  var caja = $('lf-guion'); if(!caja) return;
  var sel = LL.guion || llGuionSugerido(p), d = llDatosGuion(p), g = LL_GUIONES.filter(function(x){ return x.id === sel; })[0];
  var sug = llGuionSugerido(p);
  caja.innerHTML = '<h3 style="color:var(--tinta);margin-bottom:4px">Guion</h3>'+
    '<p style="color:var(--gris);font-size:.88rem;margin-bottom:6px">Te toca: <b>'+esc(LL_GUIONES.filter(function(x){ return x.id === sug; })[0].rot.replace(/^\d\.\s*/,''))+'</b>'+
      (sug === 'recepcion' ? ' (y luego «Con quien decide» cuando te lo pasen)' : '')+'. Lo resaltado ya está lleno con los datos de esta empresa.</p>'+
    '<div class="chips-aula">'+LL_GUIONES.map(function(x){ return '<button class="'+(x.id===sel?'on':'')+'" onclick="LL.guion=\''+x.id+'\';llPintarGuion(prPorId(\''+p.id+'\'))">'+esc(x.rot)+'</button>'; }).join('')+'</div>'+
    '<div style="margin-top:8px;font-size:1.02rem;line-height:1.65">'+g.partes.map(function(x){
      return (x[0] ? '<div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;color:var(--morado);font-weight:700;margin:14px 0 4px">'+esc(x[0])+'</div>' : '')+
        '<p style="margin:0 0 10px">'+llTxt(x[1], d)+'</p>';
    }).join('')+'</div>';
}

/* ---------- Registrar la llamada ---------- */
function llPintarRegistro(p){
  var caja = $('lf-registro'); if(!caja) return;
  if(llCerrado(p) && p.estado !== 'cliente'){ caja.innerHTML = '<h3 style="color:var(--tinta);margin-bottom:6px">Registro</h3><p style="color:var(--gris)">Esta empresa está cerrada ('+esc(PR_ESTADOS[p.estado]||p.estado)+').</p>'; return; }
  caja.innerHTML = '<h3 style="color:var(--tinta);margin-bottom:10px">¿Qué pasó en la llamada?</h3>'+
    '<div class="campo"><label>Resultado</label><div id="lr-res" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:6px">'+
      LL_RES.map(function(r){ return '<label style="display:flex;gap:8px;align-items:center;border:1.5px solid var(--linea);border-radius:10px;padding:8px 10px;cursor:pointer;font-weight:600">'+
        '<input type="radio" name="lr-res" value="'+r[0]+'" style="width:auto;flex:none;margin:0" onchange="llCambioResultado(\''+p.id+'\')"><span>'+esc(r[1])+'</span></label>'; }).join('')+'</div>'+
      '<small id="lr-ayuda" style="color:var(--gris)">Elige qué pasó.</small></div>'+
    '<div class="fila"><div class="campo"><label for="lr-nom">¿Con quién hablaste?</label><input id="lr-nom" maxlength="120" placeholder="Ej. Lic. Rosa Ramírez" value="'+esc(p.contacto_nombre||'')+'"></div>'+
      '<div class="campo"><label for="lr-pto">Puesto</label><input id="lr-pto" maxlength="80" placeholder="Ej. Capital Humano" value="'+esc(p.contacto_puesto||'')+'"></div></div>'+
    '<div class="campo"><label for="lr-cor">Correo (de quien decide o de quien administrará la plataforma)</label><input id="lr-cor" type="email" value="'+esc(p.contacto_correo||'')+'"></div>'+
    '<div class="campo"><label for="lr-cuando">Siguiente llamada</label><input id="lr-cuando" type="datetime-local">'+
      '<small style="color:var(--gris)">Si lo dejas vacío, el sistema la agenda según el resultado.</small></div>'+
    '<div class="campo"><label for="lr-com">Comentarios</label><textarea id="lr-com" rows="3" placeholder="Lo que te dijo: cuántas personas son, qué temas le interesan, objeciones…"></textarea></div>'+
    '<div id="lr-aviso"></div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button id="lr-btn" class="btn btn-mor" onclick="llGuardar(\''+p.id+'\',true)">Guardar y siguiente</button>'+
    '<button class="btn btn-linea" onclick="llGuardar(\''+p.id+'\',false)">Guardar</button></div>';
}
function llCambioResultado(id){
  var v = (document.querySelector('input[name=lr-res]:checked')||{}).value, r = LL_RES.filter(function(x){ return x[0] === v; })[0];
  $('lr-ayuda').textContent = r ? r[2] : '';
  document.querySelectorAll('#lr-res label').forEach(function(l){ var on = l.querySelector('input').checked; l.style.borderColor = on ? 'var(--morado)' : 'var(--linea)'; l.style.background = on ? '#F5F3FF' : ''; });
  if(v === 'piloto' || v === 'info_correo'){ var c = $('lr-cor'); if(c && !c.value) c.focus(); }
  if(v === 'otro_dia' || v === 'demo'){ var w = $('lr-cuando'); if(w && !w.value) w.focus(); }
}
function llGuardar(id, siguiente){
  var p = prPorId(id), av = $('lr-aviso'), b = $('lr-btn');
  var v = (document.querySelector('input[name=lr-res]:checked')||{}).value;
  if(!v){ av.innerHTML = '<div class="aviso aviso-error">Elige el resultado de la llamada.</div>'; return; }
  var cuando = $('lr-cuando').value ? new Date($('lr-cuando').value).toISOString() : null;
  if(v === 'piloto' && !$('lr-cor').value.trim()){ av.innerHTML = '<div class="aviso aviso-error">Escribe el correo de quien administrará la plataforma: a ese correo le llega su acceso.</div>'; return; }
  b.disabled = true;
  Nube.empresaRpc('registrar_llamada', { p_prospecto:id, p_resultado:v, p_contacto_nombre:$('lr-nom').value.trim() || null,
      p_contacto_puesto:$('lr-pto').value.trim() || null, p_contacto_correo:$('lr-cor').value.trim() || null,
      p_comentario:$('lr-com').value.trim() || null, p_proxima:cuando })
    .then(function(fila){
      if(fila) PR.lista = PR.lista.map(function(x){ return x.id === id ? fila : x; });
      return Nube.tabla('prospecto_contactos?prospecto_id=eq.' + id + '&select=*&order=fecha.asc').then(function(cs){
        PR.contactos = PR.contactos.filter(function(c){ return c.prospecto_id !== id; }).concat(cs || []);
      });
    })
    .then(function(){
      if(v === 'piloto') return llPiloto(id);
      var c = LL.cola || [], i = c.indexOf(id);
      if(siguiente && i >= 0 && c[i + 1]) llAbrir(c[i + 1]);
      else if(siguiente){ estado.llamadaId = null; pintar(); }
      else llPintarFicha(id);
    })
    .catch(function(e){ b.disabled = false; av.innerHTML = plnErr(e); });
}

/* ---------- Datos e historial ---------- */
function llPintarDatos(p){
  var caja = $('lf-datos'); if(!caja) return;
  var fila = function(rot, html){ return html ? '<div style="margin-bottom:9px"><div style="font-size:.74rem;text-transform:uppercase;letter-spacing:.06em;color:var(--gris);font-weight:700">'+rot+'</div><div>'+html+'</div></div>' : ''; };
  var tel = function(t){ return t ? '<a href="'+llTelHref(t)+'">☎ '+esc(prTelLimpio(t).slice(-10))+'</a>' : ''; };
  var progs = (p.cursos_ids||[]).map(function(cid){ var c = curso(cid); return c ? '<li>'+esc(c.nombre)+'</li>' : ''; }).join('');
  caja.innerHTML = '<h3 style="color:var(--tinta);margin-bottom:10px">Datos</h3>'+
    fila('Teléfono', tel(p.telefono))+fila('WhatsApp', p.whatsapp && prTelLimpio(p.whatsapp) !== prTelLimpio(p.telefono) ? tel(p.whatsapp) : '')+
    fila('Quien decide', p.contacto_nombre ? esc(p.contacto_nombre)+(p.contacto_puesto ? ' · '+esc(p.contacto_puesto) : '') : '')+
    fila('Correo', esc(p.contacto_correo || String(p.correo||'').split(',')[0] || ''))+
    fila('Dirección', esc(p.direccion||''))+
    fila('Web', p.web ? String(p.web).split('|').map(function(w){ w = w.trim(); return w ? '<a href="'+esc(/^https?:/.test(w) ? w : 'https://'+w)+'" target="_blank" rel="noopener">'+esc(w)+'</a>' : ''; }).join('<br>') : '')+
    fila('Programas para su giro', progs ? '<ul style="margin-left:18px">'+progs+'</ul>' : '')+
    fila('Lo que destacan sus clientes', esc(p.puntos_fuertes||''))+
    fila('Notas', esc(p.notas||''))+
    (p.empresa_id ? '<div class="aviso aviso-info">Ya tiene empresa en la plataforma'+(p.estado === 'piloto' ? ', con su prueba activa' : '')+'.</div>' : '');
}
function llPintarHist(p){
  var caja = $('lf-hist'); if(!caja) return;
  var h = prContactos(p.id).slice().reverse();
  caja.innerHTML = h.length ? '<div style="display:flex;flex-direction:column;gap:10px">'+h.map(function(c){
      return '<div style="border-left:3px solid '+(c.sentido === 'entrante' ? '#059669' : 'var(--morado)')+';padding:3px 10px">'+
        '<div style="display:flex;justify-content:space-between;gap:8px"><b>'+(PR_ICONO[c.canal]||'')+' '+esc(c.resultado || PR_CANAL[c.canal] || c.canal)+'</b>'+
        '<span style="color:var(--gris);font-size:.82rem;white-space:nowrap">'+esc(llFechaHora(c.fecha))+'</span></div>'+
        (c.contacto_nombre ? '<div style="font-size:.86rem">Con '+esc(c.contacto_nombre)+(c.contacto_puesto ? ' ('+esc(c.contacto_puesto)+')' : '')+'</div>' : '')+
        (c.asunto ? '<div style="font-size:.86rem">'+esc(c.asunto)+'</div>' : '')+
        (c.resumen ? '<div style="font-size:.86rem;color:var(--gris)">'+esc(c.resumen)+'</div>' : '')+'</div>';
    }).join('')+'</div>' : '<p style="color:var(--gris)">Todavía no hay contactos con esta empresa.</p>';
}

/* ============================================================================
   Aceptó la prueba: empresa + administrador + 5 lugares por 15 días
   ========================================================================== */
function llPiloto(id){
  var p = prPorId(id);
  var ids = (p.cursos_ids||[]).filter(function(x){ var c = curso(x); return c && c.publicado !== false; });
  var nombres = llProgramas(p);
  /* Programas de la prueba: los del giro y los que le sirven a cualquier empresa. */
  var todos = (BD.cursos||[]).filter(function(c){ return c.publicado !== false && !ruta(c.id) && Number(c.precio) > 0; });
  var marcados = ids.concat(todos.filter(function(c){ return nombres.indexOf(llCortoPrograma(c.nombre)) >= 0; }).map(function(c){ return c.id; }))
    .filter(function(x, i, a){ return a.indexOf(x) === i; });
  todos.sort(function(a, b){ var x = marcados.indexOf(a.id) >= 0, y = marcados.indexOf(b.id) >= 0; return x === y ? a.nombre.localeCompare(b.nombre) : (x ? -1 : 1); });
  abrirModal('Crear la prueba de ' + prCorto(p),
    '<p style="margin-bottom:10px">Se crean <b>5 lugares por 15 días</b> (cada persona tiene 15 días desde que activa su lugar, y 30 días para activarlo). '+
      'La constancia se libera cuando la empresa contrate.</p>'+
    '<div class="fila"><div class="campo"><label for="lp-adm">Correo de quien administrará la plataforma</label><input id="lp-adm" type="email" value="'+esc(p.contacto_correo||'')+'"></div>'+
      '<div class="campo"><label for="lp-nom">Su nombre</label><input id="lp-nom" maxlength="120" value="'+esc(p.contacto_nombre||'')+'"></div></div>'+
    '<div class="campo"><label>Programas que podrán elegir</label><div style="max-height:220px;overflow:auto;border:1px solid var(--linea);border-radius:10px;padding:8px 10px">'+
      todos.map(function(c){ return '<label style="display:flex;gap:8px;padding:3px 0;align-items:flex-start"><input type="checkbox" class="lp-c" style="width:auto;flex:none;margin-top:4px" value="'+c.id+'"'+(marcados.indexOf(c.id) >= 0 ? ' checked' : '')+'> '+esc(c.nombre)+'</label>'; }).join('')+
    '</div><small style="color:var(--gris)">Ya vienen marcados los de su giro. Puedes agregar los que te pidieron.</small></div><div id="lp-aviso"></div>',
    '<button class="btn btn-fantasma" onclick="cerrarModal();llPintarFicha(\''+id+'\')">Después</button><button id="lp-btn" class="btn btn-mor" onclick="llCrearPiloto(\''+id+'\')">Crear la prueba</button>');
}
function llCrearPiloto(id){
  var p = prPorId(id), av = $('lp-aviso'), b = $('lp-btn');
  var adm = $('lp-adm').value.trim().toLowerCase(), nom = $('lp-nom').value.trim();
  var cursos = [].slice.call(document.querySelectorAll('.lp-c:checked')).map(function(x){ return x.value; });
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adm)){ av.innerHTML = '<div class="aviso aviso-error">Escribe el correo de quien administrará la plataforma.</div>'; return; }
  if(!cursos.length){ av.innerHTML = '<div class="aviso aviso-error">Marca al menos un programa.</div>'; return; }
  b.disabled = true; b.textContent = 'Creando…';
  var empresaId = p.empresa_id;
  (empresaId ? Promise.resolve() :
    Nube.tabla('empresas', { metodo:'POST', prefer:'return=representation', cuerpo:{ nombre:p.nombre, contacto_nombre:nom || null, contacto_correo:adm,
        contacto_tel:prTelLimpio(p.telefono || p.whatsapp) || null, operador_id:esOperador() && LL.op ? LL.op.id : (p.asignado_a || null),
        notas:'Desde Llamadas' + (p.segmento ? ' · ' + p.segmento : '') } })
      .then(function(r){ empresaId = r && r[0] && r[0].id; if(!empresaId) throw new Error('No se pudo crear la empresa.');
        return Nube.tabla('prospectos?id=eq.' + id, { metodo:'PATCH', prefer:'return=minimal', cuerpo:{ empresa_id:empresaId } }); })
  ).then(function(){ return Nube.empresaRpc('empresa_agregar_admin', { p_empresa:empresaId, p_correo:adm, p_nombre:nom || null }); })
   .then(function(){ return Nube.empresaRpc('empresa_crear_piloto', { p_empresa:empresaId, p_cursos:cursos, p_lugares:5, p_dias:15, p_nota:'Prueba desde Llamadas', p_plazo:30 }); })
   .then(function(){ p.empresa_id = empresaId; return Nube.empresaRpc('empresa_lugares', { p_empresa:empresaId }); })
   .then(function(l){ LL.lugares = (l||[]).filter(function(k){ return k.piloto && !k.usuario_id && !k.asignado_nombre; }); llPilotoListo(id, adm, nom); })
   .catch(function(e){ b.disabled = false; b.textContent = 'Crear la prueba'; av.innerHTML = plnErr(e); });
}
function llPilotoListo(id, adm, nom){
  var p = prPorId(id), enlace = location.origin + location.pathname + '?ir=mi-empresa';
  var t = 'Hola' + (nom ? ' ' + nom.split(' ')[0] : '') + ', soy ' + (LL.op ? LL.op.nombre : sesion.nombre) + ' de Instituto Mara. Ya quedó activa la prueba de *' + p.nombre + '*: 5 lugares sin costo por 15 días.\n\n' +
    '👉 Crea tu cuenta con este correo (' + adm + ') y verás el menú «Mi empresa», donde registras a tu equipo y ves su avance: ' + enlace;
  var filas = (LL.lugares||[]).slice(0, 5).map(function(k, i){
    return '<div class="fila" style="margin-bottom:0"><div class="campo"><label for="lpp-n'+i+'">Persona '+(i+1)+'</label><input id="lpp-n'+i+'" maxlength="120" placeholder="Nombre"></div>'+
      '<div class="campo"><label for="lpp-c'+i+'">Correo</label><input id="lpp-c'+i+'" type="email" placeholder="correo@empresa.com"></div></div>';
  }).join('');
  abrirModal('¡Prueba creada!',
    '<div class="aviso aviso-ok" style="margin-bottom:12px">La prueba de <b>'+esc(p.nombre)+'</b> ya está activa. Mándale su acceso a '+esc(adm)+':</div>'+
    '<textarea id="lpl-txt" rows="6" style="width:100%;margin-bottom:8px">'+esc(t)+'</textarea>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px"><button class="btn btn-fantasma btn-sm" onclick="copiarTexto($(\'lpl-txt\').value)">Copiar</button>'+
      '<a class="btn btn-linea btn-sm" href="mailto:'+esc(adm)+'?subject='+encodeURIComponent('Su prueba en Instituto Mara')+'&body='+encodeURIComponent(t)+'">Correo</a>'+
      '<button class="btn btn-mor btn-sm" onclick="window.open(\'https://wa.me/'+plnTelWa(p.whatsapp || p.telefono)+'?text=\'+encodeURIComponent($(\'lpl-txt\').value),\'_blank\',\'noopener\')">WhatsApp</button></div>'+
    (filas ? '<h4 style="margin-bottom:6px">¿Ya te dieron los nombres? Regístralos aquí (opcional)</h4>'+
      '<p style="color:var(--gris);font-size:.88rem;margin-bottom:8px">A cada persona le llega su invitación por correo. Si no los tienes, el administrador los registra después desde «Mi empresa».</p>'+filas : '')+
    '<div id="lpp-aviso"></div>',
    (filas ? '<button class="btn btn-fantasma" onclick="cerrarModal();llPintarFicha(\''+id+'\')">Listo</button><button id="lpp-btn" class="btn btn-mor" onclick="llInvitar(\''+id+'\')">Registrar personas</button>'
           : '<button class="btn btn-mor" onclick="cerrarModal();llPintarFicha(\''+id+'\')">Listo</button>'));
}
function llInvitar(id){
  var l = LL.lugares || [], pasos = [], b = $('lpp-btn');
  for(var i=0;i<Math.min(5, l.length);i++){
    var n = $('lpp-n'+i).value.trim(), c = $('lpp-c'+i).value.trim();
    if(!n && !c) continue;
    if(!n || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)){ $('lpp-aviso').innerHTML = '<div class="aviso aviso-error">Revisa el nombre y el correo de la persona '+(i+1)+'.</div>'; return; }
    pasos.push({ accion:'empresa_invitar', codigo:l[i].codigo, nombre:n, correo:c });
  }
  if(!pasos.length){ cerrarModal(); llPintarFicha(id); return; }
  b.disabled = true; b.textContent = 'Registrando…';
  pasos.reduce(function(pr, d){ return pr.then(function(){ return Nube.funcionServidor('tienda', d); }); }, Promise.resolve())
    .then(function(){ $('lpp-aviso').innerHTML = '<div class="aviso aviso-ok">Listo: '+pasos.length+' persona'+(pasos.length===1?'':'s')+' registrada'+(pasos.length===1?'':'s')+'. A cada una le llegó su invitación.</div>'; b.textContent = 'Registradas ✓'; })
    .catch(function(e){ b.disabled = false; b.textContent = 'Registrar personas'; $('lpp-aviso').innerHTML = plnErr(e); });
}

/* ============================================================================
   Administración → Prospectos: asignar en bloques y ver el operador
   ========================================================================== */
var _prCargarLl = prCargar;
prCargar = function(){
  /* Los operadores se piden al mismo tiempo que los prospectos (antes iban después) */
  var ops = llEsAdmin() ? Nube.tabla('operadores?select=*&order=nombre.asc').catch(function(){ return null; }) : null;
  return _prCargarLl().then(function(){
    if(!ops) return;
    return ops.then(function(r){ LL.ops = r || []; if(r) llFiltroOperador(); });
  });
};
/* Renglón de filtro «Operador» (sin asignar, o uno por operador). */
function llFiltroOperador(){
  PR_FILTROS.op = { rot:'Operador', ops:[['sin','Sin asignar', function(p){ return !p.asignado_a; }]].concat(
    (LL.ops||[]).map(function(o){ return [o.id, o.nombre, function(p){ return p.asignado_a === o.id; }]; })) };
  if(PR.f.op === undefined) PR.f.op = '';
}
var _prLimpiarFiltrosLl = prLimpiarFiltros;
prLimpiarFiltros = function(){ PR.f.op = ''; _prLimpiarFiltrosLl(); };
var _prCanalesTxtLl = prCanalesTxt;
prCanalesTxt = function(p){
  var h = _prCanalesTxtLl(p);
  if(llEsAdmin() && p.asignado_a){ var o = (LL.ops||[]).filter(function(x){ return x.id === p.asignado_a; })[0]; if(o) h += '<div style="font-size:.8rem;margin-top:3px">👤 '+esc(o.nombre)+'</div>'; }
  return h;
};
var _prPintarTablaLl = prPintarTabla;
prPintarTabla = function(){
  _prPintarTablaLl();
  var caja = $('pr-masivo'); if(!caja || !llEsAdmin()) return;
  var ids = Object.keys(PR.sel).filter(function(k){ return PR.sel[k]; });
  if(!ids.length) return;
  var ops = (LL.ops||[]).filter(function(o){ return o.activo; });
  var bloque = '<span style="display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap;border-left:1px solid var(--linea);padding-left:10px">'+
    (ops.length ? '<select id="pr-asig" aria-label="Operador"><option value="">Asignar a…</option>'+ops.map(function(o){ return '<option value="'+o.id+'">'+esc(o.nombre)+'</option>'; }).join('')+'</select>'+
      '<button class="btn btn-mor btn-sm" onclick="llAsignar(true)">Asignar</button>' : '<small>Da de alta un operador en «Planes y operadores» para asignar.</small>')+
    '<button class="btn btn-fantasma btn-sm" onclick="llAsignar(false)">Quitar asignación</button></span>';
  var aviso = caja.querySelector('.aviso');
  if(aviso) aviso.insertAdjacentHTML('beforeend', bloque);
};
function llAsignar(si){
  var ids = Object.keys(PR.sel).filter(function(k){ return PR.sel[k]; }), op = si ? $('pr-asig').value : null;
  if(si && !op){ alert('Elige el operador.'); return; }
  var o = (LL.ops||[]).filter(function(x){ return x.id === op; })[0];
  if(!confirm(si ? '¿Asignar '+ids.length+' empresa(s) a '+(o ? o.nombre : 'este operador')+'? Las verá en su consola de llamadas.' : '¿Quitar la asignación de '+ids.length+' empresa(s)?')) return;
  Nube.empresaRpc('asignar_prospectos', { p_ids:ids, p_operador:op })
    .then(function(n){
      PR.lista.forEach(function(p){ if(ids.indexOf(p.id) >= 0) p.asignado_a = op; });
      PR.sel = {}; prPintarFiltros(); prPintarTabla();
      alert((si ? 'Asignadas: ' : 'Sin asignación: ') + n);
    })
    .catch(function(e){ alert(e.message); });
}
var _vistaAdminProspectosLl = vistaAdminProspectos;
vistaAdminProspectos = function(){
  var h = _vistaAdminProspectosLl();
  if(estado.prospectoId || !h) return h;
  return h.replace('<button class="btn btn-linea" onclick="prTextosGiro()">', '<button class="btn btn-linea" onclick="LL.tab=\'hoy\';estado.llamadaId=null;ir(\'llamadas\')">☎ Consola de llamadas</button><button class="btn btn-linea" onclick="prTextosGiro()">');
};

/* ============================================================================
   Menú y vistas
   ========================================================================== */
var _pintarNavLl = pintarNav;
pintarNav = function(){
  _pintarNavLl();
  if(!esOperador()) return;
  var items = [['llamadas','Llamadas'],['op-inicio','Planes y precios'],['mi-perfil','Mi perfil']], h = '';
  for(var i=0;i<items.length;i++) h += '<button data-v="'+items[i][0]+'">'+items[i][1]+'</button>';
  $('nav').innerHTML = h;
  $('nav').querySelectorAll('button').forEach(function(b){ b.onclick = function(){ if(this.getAttribute('data-v') === 'llamadas') estado.llamadaId = null; ir(this.getAttribute('data-v')); }; });
};
var _pintarLl = pintar;
pintar = function(){
  if(estado.vista === 'llamadas'){
    $('vista').innerHTML = vistaLlamadas();
    var bs = $('nav').querySelectorAll('button'); for(var i=0;i<bs.length;i++) bs[i].classList.toggle('activa', bs[i].getAttribute('data-v') === 'llamadas' || (llEsAdmin() && bs[i].getAttribute('data-v') === 'admin-prospectos'));
    return;
  }
  _pintarLl();
};
var _entrarAppLl = entrarApp;
entrarApp = function(){
  _entrarAppLl();
  if(esOperador()) ir('llamadas');
};
