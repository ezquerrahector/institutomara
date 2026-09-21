/* =========================================================================
   INSTITUTO MARA — BLOQUES INTERACTIVOS
   Ejercicios que el alumno resuelve dentro de la lección, con
   retroalimentación inmediata. No necesitan servidor ni audios grabados:
   la pronunciación se genera con la voz del propio navegador.

   Tipos de bloque que agrega este archivo:
     escuchar    frases con botón ▶ (voz en inglés, normal y lenta)
     practica    preguntas de opción múltiple con explicación inmediata
     completar   escribir la palabra que falta
     relacionar  unir cada elemento con su pareja
     ordenar     tocar las palabras en orden para formar la frase
     tarjetas    tarjetas de repaso que se voltean (flashcards)
     pronunciar  escuchar, grabarte con el micrófono y comparar
     tabla       tabla de referencia
     comparar    ejemplo débil vs. ejemplo bueno, lado a lado
     plantilla   texto listo para copiar (instrucciones para IA, correos…)
     pasos       lista de pasos con casillas que se van palomeando
     reflexion   pregunta abierta; la respuesta se guarda para el alumno
     clave       resumen de «lo que te llevas» al final de la lección
   ========================================================================= */
(function(){
var MI = window.MI = {};
MI.reg = [];     /* bloques pintados, por índice */
MI.txt = [];     /* textos para el botón de escuchar */
MI.estado = {};  /* estado de cada ejercicio */
MI.pos = [];     /* posición del bloque dentro de su lección */

function e(s){
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function barajar(a, semilla){
  var r = a.slice(), s = semilla || 7;
  for(var i=r.length-1;i>0;i--){ s = (s*9301+49297)%233280; var j = Math.floor(s/233280*(i+1)); var t=r[i]; r[i]=r[j]; r[j]=t; }
  return r;
}
function barajarDistinto(a, semilla){
  if(a.length < 2) return a.slice();
  var r = barajar(a, semilla), n = 0;
  while(r.join('\u0001') === a.join('\u0001') && n < 9){ r = barajar(a, (semilla||7)+(++n)*13); }
  return r;
}
function norm(s){
  return String(s||'').toLowerCase()
    .replace(/[‘’´`]/g,"'").replace(/[“”]/g,'"')
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[.,;:!?¡¿"]/g,'').replace(/\s+/g,' ').trim();
}
MI.norm = norm;
function reg(b){
  if(MI.reg.length > 800){ MI.reg = []; MI.estado = {}; MI.pos = []; }
  MI.reg.push(b); return MI.reg.length-1;
}
function $i(id){ return document.getElementById(id); }

/* ---------------- Voz (texto a voz del navegador) ---------------- */
var vozEn = null;
function elegirVoz(){
  if(!('speechSynthesis' in window)) return;
  var vs = speechSynthesis.getVoices() || [], pref = ['Samantha','Google US English','Microsoft Aria','Microsoft Jenny','Alex','Karen','Daniel'];
  for(var p=0;p<pref.length;p++) for(var i=0;i<vs.length;i++)
    if(vs[i].name.indexOf(pref[p])>=0 && /^en/i.test(vs[i].lang)){ vozEn = vs[i]; return; }
  for(var j=0;j<vs.length;j++) if(/^en[-_]US/i.test(vs[j].lang)){ vozEn = vs[j]; return; }
  for(var k=0;k<vs.length;k++) if(/^en/i.test(vs[k].lang)){ vozEn = vs[k]; return; }
}
if('speechSynthesis' in window){ elegirVoz(); speechSynthesis.onvoiceschanged = elegirVoz; }
MI.hayVoz = function(){ return 'speechSynthesis' in window; };

MI.hablar = function(texto, lento, alTerminar){
  if(!('speechSynthesis' in window)){ alert('Tu navegador no puede reproducir voz. Prueba con Chrome o Safari actualizados.'); return; }
  speechSynthesis.cancel();
  var limpio = String(texto).replace(/<[^>]+>/g,'').replace(/\s*\/\s*/g,', ').replace(/…/g,'.');
  var u = new SpeechSynthesisUtterance(limpio);
  u.lang = 'en-US'; if(vozEn) u.voice = vozEn;
  u.rate = lento ? 0.62 : 0.92;
  if(alTerminar) u.onend = alTerminar;
  speechSynthesis.speak(u);
};
MI.decir = function(i, lento){ MI.hablar(MI.txt[i], lento); };
/* Botones de escuchar (normal y lento) para un texto en inglés */
MI.botonVoz = function(texto, chico){
  if(!texto) return '';
  MI.txt.push(texto); var i = MI.txt.length-1;
  return '<span class="mi-voz'+(chico?' chico':'')+'">'+
    '<button type="button" title="Escuchar" aria-label="Escuchar" onclick="MI.decir('+i+')">'+
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>'+
    '<button type="button" class="lento" title="Escuchar lento" aria-label="Escuchar lento" onclick="MI.decir('+i+',true)">'+
      '<svg width="17" height="15" viewBox="0 0 30 24" fill="currentColor"><path d="M4 13c0-4 4-7 9-7 4 0 7 2 8 5l3-1c1 0 2 1 1 2l-3 2c0 3-3 5-7 5H7c-2 0-3-1-3-3z"/><circle cx="11" cy="12" r="2" fill="#fff"/></svg></button>'+
    '</span>';
};
/* Reproduce varias líneas seguidas (diálogo completo) */
MI.cola = function(lista, lento){
  var k = 0;
  function sig(){ if(k < lista.length){ MI.hablar(lista[k++], lento, function(){ setTimeout(sig, 380); }); } }
  sig();
};
MI.decirDialogo = function(i, lento){ MI.cola(MI.txt[i], lento); };
MI.botonDialogo = function(lineas){
  MI.txt.push(lineas); var i = MI.txt.length-1;
  return '<div class="mi-dialogo-audio">'+
    '<button type="button" class="btn btn-linea btn-sm" onclick="MI.decirDialogo('+i+')">▶ Escuchar el diálogo</button>'+
    '<button type="button" class="btn btn-fantasma btn-sm" onclick="MI.decirDialogo('+i+',true)">Escuchar lento</button>'+
    '<button type="button" class="btn btn-fantasma btn-sm" onclick="speechSynthesis.cancel()">Detener</button></div>';
};

/* ---------------- Registro de ejercicios resueltos ---------------- */
function marcarResuelto(id){
  try{
    if(typeof estado === 'undefined' || estado.vista !== 'leccion' || !window.sesion) return;
    var a = avance(sesion.id, estado.cursoId);
    if(!a.practica) a.practica = {};
    a.practica[estado.leccionId+':'+MI.pos[id]] = 1;
    guardar();
    if(MI.alResolver) MI.alResolver();
  }catch(err){}
}
function bien(msg){ return '<div class="mi-fb ok">'+msg+'</div>'; }
function mal(msg){ return '<div class="mi-fb no">'+msg+'</div>'; }
var ANIMO_OK = ['¡Muy bien!','¡Exacto!','¡Correcto!','¡Así es!','¡Perfecto!'];
function animo(n){ return ANIMO_OK[n % ANIMO_OK.length]; }

/* =================================================================
   PINTAR — se llama desde pintarBloque() para los tipos nuevos
   ================================================================= */
MI.tipos = ['escuchar','practica','completar','relacionar','ordenar','tarjetas','pronunciar',
            'tabla','comparar','plantilla','pasos','reflexion','clave','excel'];
MI.esInteractivo = function(t){ return ['practica','completar','relacionar','ordenar','tarjetas','pronunciar','excel'].indexOf(t) >= 0; };

MI.pintar = function(b, pos){
  var f = P[b.tipo]; if(!f) return '';
  var id = reg(b); MI.pos[id] = pos;
  return f(b, id);
};

function cab(b, porDefecto, icono){
  return '<div class="mi-cab"><span class="mi-ico">'+(icono||'✎')+'</span>'+
    '<div><div class="mi-rot">'+e(b.rotulo||porDefecto)+'</div>'+
    (b.instruccion ? '<div class="mi-ins">'+b.instruccion+'</div>' : '')+'</div></div>';
}

var P = {};

/* ---- escuchar ---- */
P.escuchar = function(b, id){
  var h = '<div class="bloque mi mi-escuchar">'+cab(b,'Escucha y repite','🔊');
  var fr = b.frases || [];
  for(var i=0;i<fr.length;i++){
    h += '<div class="mi-frase">'+MI.botonVoz(fr[i].en)+
      '<div class="mi-frase-t"><b>'+e(fr[i].en)+'</b>'+
      (fr[i].pron ? '<span class="mi-pron">'+e(fr[i].pron)+'</span>' : '')+
      (fr[i].es ? '<span class="mi-es">'+e(fr[i].es)+'</span>' : '')+'</div></div>';
  }
  if(!MI.hayVoz()) h += '<div class="aviso aviso-info" style="margin:10px 0 0">Tu navegador no reproduce voz. Lee en voz alta guiándote por la pronunciación escrita.</div>';
  return h + '</div>';
};

/* ---- practica (opción múltiple con explicación) ---- */
P.practica = function(b, id){
  var qs = b.preguntas || [];
  MI.estado[id] = { ok:{}, n:qs.length };
  var h = '<div class="bloque mi mi-practica" id="mi-'+id+'">'+cab(b,'Comprueba lo que aprendiste','?');
  for(var i=0;i<qs.length;i++){
    var q = qs[i];
    h += '<div class="mi-preg" id="mi-'+id+'-'+i+'"><div class="mi-p">'+
      (qs.length>1?'<span class="mi-n">'+(i+1)+'</span>':'')+q.p+
      (q.voz ? ' '+MI.botonVoz(q.voz,true) : '')+'</div><div class="mi-ops">';
    for(var j=0;j<q.ops.length;j++)
      h += '<button type="button" class="mi-op" onclick="MI.elegir('+id+','+i+','+j+')">'+q.ops[j]+'</button>';
    h += '</div><div class="mi-exp" id="mi-'+id+'-'+i+'-fb"></div></div>';
  }
  h += '<div class="mi-marcador" id="mi-'+id+'-tot"></div>';
  return h + '</div>';
};
MI.elegir = function(id, i, j){
  var b = MI.reg[id], q = b.preguntas[i], st = MI.estado[id];
  var caja = $i('mi-'+id+'-'+i), bs = caja.querySelectorAll('.mi-op');
  if(st.ok[i]) return;
  var correcto = (j === q.correcta);
  bs[j].classList.add(correcto ? 'ok' : 'no');
  if(correcto){
    st.ok[i] = true;
    for(var k=0;k<bs.length;k++) bs[k].disabled = true;
    $i('mi-'+id+'-'+i+'-fb').innerHTML = bien('<b>'+animo(i)+'</b> '+(q.explica||''));
  }else{
    bs[j].disabled = true;
    $i('mi-'+id+'-'+i+'-fb').innerHTML = mal('<b>Todavía no.</b> '+(q.pista || 'Vuelve a leer la opción con calma y prueba otra.'));
  }
  var n = Object.keys(st.ok).length;
  if(n === st.n){
    $i('mi-'+id+'-tot').innerHTML = '<div class="mi-listo">✓ Ejercicio completado</div>';
    marcarResuelto(id);
  }
};

/* ---- completar ---- */
P.completar = function(b, id){
  var its = b.items || [];
  MI.estado[id] = { ok:{}, n:its.length, intentos:{} };
  var h = '<div class="bloque mi mi-completar" id="mi-'+id+'">'+cab(b,'Completa la frase','✎');
  for(var i=0;i<its.length;i++){
    var it = its[i], partes = String(it.frase).split('___');
    h += '<div class="mi-comp" id="mi-'+id+'-'+i+'"><div class="mi-comp-f">'+
      (its.length>1?'<span class="mi-n">'+(i+1)+'</span>':'')+'<span>'+e(partes[0])+
      '<input type="text" class="mi-hueco" id="mi-'+id+'-'+i+'-in" autocomplete="off" autocapitalize="off" spellcheck="false" '+
      'style="width:'+Math.max(5, Math.min(22, String((it.resp||[''])[0]).length+3))+'ch" '+
      'onkeydown="if(event.key===\'Enter\'){MI.revisarHueco('+id+','+i+')}">'+e(partes[1]||'')+'</span>'+
      '<button type="button" class="mi-rev" onclick="MI.revisarHueco('+id+','+i+')">Revisar</button></div>'+
      (it.es ? '<div class="mi-es">'+e(it.es)+'</div>' : '')+
      '<div id="mi-'+id+'-'+i+'-fb"></div></div>';
  }
  h += '<div class="mi-marcador" id="mi-'+id+'-tot"></div>';
  return h + '</div>';
};
MI.revisarHueco = function(id, i){
  var b = MI.reg[id], it = b.items[i], st = MI.estado[id];
  var inp = $i('mi-'+id+'-'+i+'-in'), v = norm(inp.value), fb = $i('mi-'+id+'-'+i+'-fb');
  if(!v){ fb.innerHTML = mal('Escribe tu respuesta antes de revisar.'); return; }
  var resp = it.resp || [], ok = false;
  for(var k=0;k<resp.length;k++) if(norm(resp[k]) === v) ok = true;
  st.intentos[i] = (st.intentos[i]||0) + 1;
  if(ok){
    st.ok[i] = true; inp.disabled = true; inp.classList.add('ok');
    var frase = String(it.frase).replace('___', resp[0]);
    fb.innerHTML = bien('<b>'+animo(i)+'</b> '+(it.explica||'')) + (b.voz ? '<div class="mi-oir">'+MI.botonVoz(frase,true)+' <span>'+e(frase)+'</span></div>' : '');
    var sig = $i('mi-'+id+'-'+(i+1)+'-in'); if(sig) sig.focus();
  }else{
    inp.classList.add('no'); setTimeout(function(){ inp.classList.remove('no'); }, 600);
    var msg = '<b>Todavía no.</b> ' + (it.pista || 'Revisa la ortografía.');
    if(st.intentos[i] >= 2) msg += ' <button type="button" class="mi-ver" onclick="MI.verHueco('+id+','+i+')">Ver respuesta</button>';
    fb.innerHTML = mal(msg);
  }
  if(Object.keys(st.ok).length === st.n){ $i('mi-'+id+'-tot').innerHTML = '<div class="mi-listo">✓ Ejercicio completado</div>'; marcarResuelto(id); }
};
MI.verHueco = function(id, i){
  var it = MI.reg[id].items[i]; $i('mi-'+id+'-'+i+'-in').value = it.resp[0]; MI.revisarHueco(id, i);
};

/* ---- relacionar ---- */
P.relacionar = function(b, id){
  var pares = b.pares || [];
  var der = []; for(var i=0;i<pares.length;i++) der.push(i);
  der = barajarDistinto(der, pares.length*31 + id);
  MI.estado[id] = { sel:null, hechos:{}, n:pares.length, errores:0 };
  var h = '<div class="bloque mi mi-relacionar" id="mi-'+id+'">'+cab(b,'Relaciona las columnas','⇄')+
    '<div class="mi-ins" style="margin:-4px 0 12px">Toca un elemento de la izquierda y luego su pareja de la derecha.</div>'+
    '<div class="mi-cols"><div class="mi-col">';
  for(var a=0;a<pares.length;a++)
    h += '<button type="button" class="mi-ficha" id="mi-'+id+'-L'+a+'" onclick="MI.relIzq('+id+','+a+')">'+e(pares[a][0])+'</button>';
  h += '</div><div class="mi-col">';
  for(var d=0;d<der.length;d++)
    h += '<button type="button" class="mi-ficha der" id="mi-'+id+'-R'+der[d]+'" onclick="MI.relDer('+id+','+der[d]+')">'+e(pares[der[d]][1])+'</button>';
  h += '</div></div><div id="mi-'+id+'-fb"></div></div>';
  return h;
};
MI.relIzq = function(id, a){
  var st = MI.estado[id]; if(st.hechos[a]) return;
  if(st.sel != null){ var p = $i('mi-'+id+'-L'+st.sel); if(p) p.classList.remove('sel'); }
  st.sel = a; $i('mi-'+id+'-L'+a).classList.add('sel');
  var b = MI.reg[id]; if(b.voz) MI.hablar(b.pares[a][0]);
};
MI.relDer = function(id, d){
  var st = MI.estado[id], fb = $i('mi-'+id+'-fb');
  if(st.hechos[d]) return;
  if(st.sel == null){ fb.innerHTML = mal('Primero toca un elemento de la columna izquierda.'); return; }
  var L = $i('mi-'+id+'-L'+st.sel), R = $i('mi-'+id+'-R'+d);
  if(st.sel === d){
    st.hechos[d] = true; L.classList.remove('sel'); L.classList.add('ok'); R.classList.add('ok'); L.disabled = R.disabled = true;
    st.sel = null; fb.innerHTML = '';
    if(Object.keys(st.hechos).length === st.n){
      fb.innerHTML = '<div class="mi-listo">✓ ¡Todas las parejas correctas!'+(st.errores?' ('+st.errores+' intento'+(st.errores>1?'s':'')+' fallido'+(st.errores>1?'s':'')+')':' Sin un solo error.')+'</div>';
      marcarResuelto(id);
    }
  }else{
    st.errores++;
    R.classList.add('no'); setTimeout(function(){ R.classList.remove('no'); }, 550);
    fb.innerHTML = mal('Esa no es su pareja. Intenta con otra.');
  }
};

/* ---- ordenar ---- */
P.ordenar = function(b, id){
  var its = b.items || [];
  MI.estado[id] = { ok:{}, n:its.length, arm:{} };
  var h = '<div class="bloque mi mi-ordenar" id="mi-'+id+'">'+cab(b,'Ordena las palabras','⇆')+
    '<div class="mi-ins" style="margin:-4px 0 12px">Toca las palabras en el orden correcto. Si te equivocas, toca una palabra de arriba para regresarla.</div>';
  for(var i=0;i<its.length;i++){
    var pal = String(its[i].frase).split(/\s+/);
    var mez = barajarDistinto(pal, i*17+pal.length+id);
    MI.estado[id].arm[i] = [];
    h += '<div class="mi-ord" id="mi-'+id+'-'+i+'">'+
      (its[i].es ? '<div class="mi-es" style="margin-bottom:8px"><span class="mi-n">'+(i+1)+'</span>'+e(its[i].es)+'</div>' : '')+
      '<div class="mi-armado" id="mi-'+id+'-'+i+'-arm"><span class="mi-vacio">Toca las palabras de abajo…</span></div>'+
      '<div class="mi-banco" id="mi-'+id+'-'+i+'-ban">';
    for(var k=0;k<mez.length;k++)
      h += '<button type="button" class="mi-pal" data-p="'+e(mez[k])+'" onclick="MI.ordTomar('+id+','+i+',this)">'+e(mez[k])+'</button>';
    h += '</div><div class="mi-ord-acc"><button type="button" class="mi-rev" onclick="MI.ordRevisar('+id+','+i+')">Revisar</button>'+
      '<button type="button" class="mi-ver" onclick="MI.ordReiniciar('+id+','+i+')">Empezar de nuevo</button></div>'+
      '<div id="mi-'+id+'-'+i+'-fb"></div></div>';
  }
  return h + '<div class="mi-marcador" id="mi-'+id+'-tot"></div></div>';
};
function pintarArmado(id, i){
  var arm = MI.estado[id].arm[i], box = $i('mi-'+id+'-'+i+'-arm'), h = '';
  for(var k=0;k<arm.length;k++) h += '<button type="button" class="mi-pal puesta" onclick="MI.ordQuitar('+id+','+i+','+k+')">'+e(arm[k].t)+'</button>';
  box.innerHTML = h || '<span class="mi-vacio">Toca las palabras de abajo…</span>';
}
MI.ordTomar = function(id, i, btn){
  if(MI.estado[id].ok[i]) return;
  MI.estado[id].arm[i].push({ t:btn.getAttribute('data-p'), el:btn });
  btn.classList.add('usada'); btn.disabled = true; pintarArmado(id, i);
};
MI.ordQuitar = function(id, i, k){
  if(MI.estado[id].ok[i]) return;
  var x = MI.estado[id].arm[i].splice(k,1)[0];
  x.el.classList.remove('usada'); x.el.disabled = false; pintarArmado(id, i);
};
MI.ordReiniciar = function(id, i){
  if(MI.estado[id].ok[i]) return;
  var arm = MI.estado[id].arm[i];
  while(arm.length){ var x = arm.pop(); x.el.classList.remove('usada'); x.el.disabled = false; }
  pintarArmado(id, i); $i('mi-'+id+'-'+i+'-fb').innerHTML = '';
};
MI.ordRevisar = function(id, i){
  var b = MI.reg[id], it = b.items[i], st = MI.estado[id], fb = $i('mi-'+id+'-'+i+'-fb');
  var arm = st.arm[i].map(function(x){ return x.t; }).join(' ');
  var total = String(it.frase).split(/\s+/).length;
  if(st.arm[i].length < total){ fb.innerHTML = mal('Todavía te faltan palabras por acomodar.'); return; }
  var alternativas = [it.frase].concat(it.otras || []), ok = false;
  for(var k=0;k<alternativas.length;k++) if(norm(alternativas[k]) === norm(arm)) ok = true;
  if(ok){
    st.ok[i] = true; $i('mi-'+id+'-'+i+'-arm').classList.add('ok');
    fb.innerHTML = bien('<b>'+animo(i)+'</b> '+(it.explica||'')) + (b.voz ? '<div class="mi-oir">'+MI.botonVoz(it.frase,true)+' <span>Escúchala</span></div>' : '');
    if(Object.keys(st.ok).length === st.n){ $i('mi-'+id+'-tot').innerHTML = '<div class="mi-listo">✓ Ejercicio completado</div>'; marcarResuelto(id); }
  }else{
    fb.innerHTML = mal('<b>Casi.</b> '+(it.pista || 'Revisa el orden: en inglés casi siempre va primero quién hace la acción y luego el verbo.'));
  }
};

/* ---- tarjetas (flashcards) ---- */
P.tarjetas = function(b, id){
  var ts = b.tarjetas || [];
  MI.estado[id] = { i:0, orden:ts.map(function(_,k){return k;}), repasar:[], sabidas:0, vuelta:false };
  return '<div class="bloque mi mi-tarjetas" id="mi-'+id+'">'+cab(b,'Tarjetas de repaso','❏')+
    '<div class="mi-ins" style="margin:-4px 0 12px">Mira el frente, intenta recordar la respuesta y después voltea la tarjeta. Sé honesto contigo: las que no te sabías vuelven al final.</div>'+
    '<div id="mi-'+id+'-caja">'+tarjetaHTML(id)+'</div></div>';
};
function tarjetaHTML(id){
  var b = MI.reg[id], st = MI.estado[id], ts = b.tarjetas;
  if(st.i >= st.orden.length){
    if(st.repasar.length){
      st.orden = st.repasar; st.repasar = []; st.i = 0;
      return '<div class="mi-tj-ronda">Otra vuelta solo con las '+st.orden.length+' que te costaron.</div>'+tarjetaHTML(id);
    }
    marcarResuelto(id);
    return '<div class="mi-listo" style="text-align:center;padding:22px">✓ Terminaste el mazo. Te sabes las '+ts.length+' tarjetas.'+
      '<div style="margin-top:12px"><button type="button" class="mi-ver" onclick="MI.tjReiniciar('+id+')">Repasar otra vez</button></div></div>';
  }
  var t = ts[st.orden[st.i]], frente = t.frente, dorso = t.reverso;
  return '<div class="mi-tj-pos">Tarjeta '+(st.i+1)+' de '+st.orden.length+'</div>'+
    '<div class="mi-tj'+(st.vuelta?' vuelta':'')+'" onclick="MI.tjVoltear('+id+')"><div class="mi-tj-in">'+
      '<div class="mi-tj-cara frente"><div class="mi-tj-txt">'+e(frente)+'</div><div class="mi-tj-pista">Toca para voltear</div></div>'+
      '<div class="mi-tj-cara dorso"><div class="mi-tj-txt">'+e(dorso)+'</div>'+(t.ej?'<div class="mi-tj-ej">'+e(t.ej)+'</div>':'')+'</div>'+
    '</div></div>'+
    '<div class="mi-tj-acc">'+
      (b.voz ? MI.botonVoz(b.vozEn === 'reverso' ? dorso : frente) : '')+
      (st.vuelta
        ? '<button type="button" class="mi-ver" onclick="MI.tjSig('+id+',false)">No me la sabía</button>'+
          '<button type="button" class="mi-rev" onclick="MI.tjSig('+id+',true)">Me la sabía ✓</button>'
        : '<button type="button" class="mi-rev" onclick="MI.tjVoltear('+id+')">Voltear</button>')+
    '</div>';
}
MI.tjVoltear = function(id){ var st = MI.estado[id]; st.vuelta = !st.vuelta; $i('mi-'+id+'-caja').innerHTML = tarjetaHTML(id); };
MI.tjSig = function(id, sabia){
  var st = MI.estado[id];
  if(!sabia) st.repasar.push(st.orden[st.i]);
  st.i++; st.vuelta = false; $i('mi-'+id+'-caja').innerHTML = tarjetaHTML(id);
};
MI.tjReiniciar = function(id){
  var st = MI.estado[id], ts = MI.reg[id].tarjetas;
  st.i = 0; st.orden = barajar(ts.map(function(_,k){return k;}), Date.now()%1000); st.repasar = []; st.vuelta = false;
  $i('mi-'+id+'-caja').innerHTML = tarjetaHTML(id);
};

/* ---- pronunciar (micrófono) ---- */
var Reco = window.SpeechRecognition || window.webkitSpeechRecognition;
P.pronunciar = function(b, id){
  var fr = b.frases || [];
  MI.estado[id] = { ok:{}, n:fr.length };
  var h = '<div class="bloque mi mi-pronunciar" id="mi-'+id+'">'+cab(b,'Practica tu pronunciación','🎙')+
    '<div class="mi-ins" style="margin:-4px 0 12px">'+(Reco
      ? 'Escucha la frase, toca <b>Grabarme</b> y dila en voz alta. El sistema te dice qué tanto se te entendió. Tu voz no se guarda.'
      : 'Escucha la frase y repítela en voz alta tres veces. Cuando te salga natural, márcala como practicada. (Para que el sistema te escuche, abre la lección en Chrome.)')+'</div>';
  for(var i=0;i<fr.length;i++){
    h += '<div class="mi-pr" id="mi-'+id+'-'+i+'"><div class="mi-frase">'+MI.botonVoz(fr[i].en)+
      '<div class="mi-frase-t"><b>'+e(fr[i].en)+'</b>'+(fr[i].pron?'<span class="mi-pron">'+e(fr[i].pron)+'</span>':'')+
      (fr[i].es?'<span class="mi-es">'+e(fr[i].es)+'</span>':'')+'</div></div>'+
      '<div class="mi-pr-acc">'+(Reco
        ? '<button type="button" class="mi-mic" id="mi-'+id+'-'+i+'-mic" onclick="MI.grabar('+id+','+i+')">🎙 Grabarme</button>'
        : '<button type="button" class="mi-rev" onclick="MI.prManual('+id+','+i+')">Ya la practiqué ✓</button>')+
      '</div><div id="mi-'+id+'-'+i+'-fb"></div></div>';
  }
  return h + '<div class="mi-marcador" id="mi-'+id+'-tot"></div></div>';
};
function parecido(a, b){
  var A = norm(a).split(' '), B = norm(b).split(' '), hit = 0, usadas = {};
  for(var i=0;i<A.length;i++) for(var j=0;j<B.length;j++)
    if(!usadas[j] && (A[i] === B[j] || A[i].replace(/'/g,'') === B[j].replace(/'/g,''))){ hit++; usadas[j]=1; break; }
  return A.length ? hit / A.length : 0;
}
function prListo(id, i){
  var st = MI.estado[id]; st.ok[i] = true;
  if(Object.keys(st.ok).length === st.n){ $i('mi-'+id+'-tot').innerHTML = '<div class="mi-listo">✓ Practicaste todas las frases</div>'; marcarResuelto(id); }
}
MI.prManual = function(id, i){ $i('mi-'+id+'-'+i+'-fb').innerHTML = bien('Anotado. Repetir en voz alta es lo que más acelera tu inglés.'); prListo(id, i); };
MI.grabar = function(id, i){
  var fr = MI.reg[id].frases[i], btn = $i('mi-'+id+'-'+i+'-mic'), fb = $i('mi-'+id+'-'+i+'-fb');
  try{ speechSynthesis.cancel(); }catch(x){}
  var r = new Reco(); r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 3;
  btn.classList.add('grabando'); btn.textContent = '● Escuchando… habla ahora';
  var termino = false;
  r.onresult = function(ev){
    termino = true;
    var mejor = 0, dijo = '';
    for(var k=0;k<ev.results[0].length;k++){
      var t = ev.results[0][k].transcript, p = parecido(fr.en, t);
      if(p > mejor || !dijo){ mejor = p; dijo = t; }
    }
    var pct = Math.round(mejor*100);
    if(pct >= 80){ fb.innerHTML = bien('<b>¡Se te entendió perfecto! ('+pct+'%)</b> Escuché: «'+e(dijo)+'».'); prListo(id, i); }
    else if(pct >= 50){ fb.innerHTML = mal('<b>Vas bien ('+pct+'%).</b> Escuché: «'+e(dijo)+'». Escucha la versión lenta y fíjate en las palabras que no coinciden.'); }
    else fb.innerHTML = mal('<b>No se entendió bien ('+pct+'%).</b> Escuché: «'+e(dijo||'…')+'». Acércate al micrófono, habla un poco más despacio y vuelve a intentarlo.');
  };
  r.onerror = function(ev){
    termino = true;
    fb.innerHTML = mal(ev.error === 'not-allowed' || ev.error === 'service-not-allowed'
      ? 'El navegador no dio permiso de usar el micrófono. Actívalo en el candado junto a la dirección de la página, o practica en voz alta y toca «Ya la practiqué».'
        + ' <button type="button" class="mi-ver" onclick="MI.prManual('+id+','+i+')">Ya la practiqué</button>'
      : 'No te escuché. Vuelve a intentarlo hablando un poco más fuerte.');
  };
  r.onend = function(){
    btn.classList.remove('grabando'); btn.textContent = '🎙 Grabarme otra vez';
    if(!termino) fb.innerHTML = mal('No te escuché. Toca el botón y habla en cuanto aparezca «Escuchando».');
  };
  try{ r.start(); }catch(x){ btn.classList.remove('grabando'); btn.textContent = '🎙 Grabarme'; }
};

/* ---- tabla ---- */
P.tabla = function(b, id){
  var h = '<div class="bloque mi-tabla-caja">'+(b.titulo?'<div class="mi-tabla-tit">'+e(b.titulo)+'</div>':'')+
    '<div class="mi-tabla-scroll"><table class="mi-tabla">';
  if(b.encabezados){ h += '<thead><tr>'; for(var i=0;i<b.encabezados.length;i++) h += '<th>'+b.encabezados[i]+'</th>'; h += '</tr></thead>'; }
  h += '<tbody>';
  var fs = b.filas || [];
  for(var f=0;f<fs.length;f++){
    h += '<tr>';
    for(var c=0;c<fs[f].length;c++){
      var cel = fs[f][c];
      h += '<td>'+cel+(b.voz && c === (b.colVoz||0) ? ' '+MI.botonVoz(String(cel).replace(/<[^>]+>/g,''),true) : '')+'</td>';
    }
    h += '</tr>';
  }
  h += '</tbody></table></div>'+(b.nota?'<div class="mi-tabla-nota">'+b.nota+'</div>':'')+'</div>';
  return h;
};

/* ---- comparar ---- */
P.comparar = function(b, id){
  return '<div class="bloque mi-comparar">'+(b.titulo?'<div class="mi-tabla-tit">'+e(b.titulo)+'</div>':'')+
    '<div class="mi-comp-grid">'+
    '<div class="mi-comp-lado mal"><div class="mi-comp-et">✕ '+e(b.malTitulo||'Así no')+'</div><div class="mi-comp-tx">'+b.mal+'</div></div>'+
    '<div class="mi-comp-lado bien"><div class="mi-comp-et">✓ '+e(b.bienTitulo||'Así sí')+'</div><div class="mi-comp-tx">'+b.bien+'</div></div>'+
    '</div>'+(b.nota?'<div class="mi-tabla-nota">'+b.nota+'</div>':'')+'</div>';
};

/* ---- plantilla (texto para copiar) ---- */
P.plantilla = function(b, id){
  return '<div class="bloque mi-plantilla"><div class="mi-pl-cab"><span>'+e(b.rotulo||'Plantilla lista para copiar')+'</span>'+
    '<button type="button" class="mi-copiar" onclick="MI.copiar('+id+',this)">Copiar</button></div>'+
    '<pre class="mi-pl-tx">'+e(b.texto)+'</pre>'+(b.nota?'<div class="mi-pl-nota">'+b.nota+'</div>':'')+'</div>';
};
MI.copiar = function(id, btn){
  var t = MI.reg[id].texto;
  function listo(){ btn.textContent = '¡Copiado!'; btn.classList.add('ok'); setTimeout(function(){ btn.textContent = 'Copiar'; btn.classList.remove('ok'); }, 1800); }
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(listo, function(){ viejo(); });
  else viejo();
  function viejo(){ var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); listo(); }catch(x){} document.body.removeChild(ta); }
};

/* ---- pasos (con casillas) ---- */
function clavePrivada(id){
  try{ if(typeof estado !== 'undefined' && estado.vista === 'leccion' && window.sesion) return estado.leccionId+':'+MI.pos[id]; }catch(x){}
  return null;
}
function notas(){
  try{ var a = avance(sesion.id, estado.cursoId); if(!a.notas) a.notas = {}; return a.notas; }catch(x){ return {}; }
}
P.pasos = function(b, id){
  var k = clavePrivada(id), hechos = (k && notas()[k]) || [];
  var h = '<div class="bloque mi mi-pasos">'+cab(b,'Hazlo paso a paso','☑');
  var ps = b.pasos || [];
  for(var i=0;i<ps.length;i++){
    var on = hechos.indexOf(i) >= 0;
    h += '<label class="mi-paso'+(on?' hecho':'')+'"><input type="checkbox" '+(on?'checked ':'')+'onchange="MI.paso('+id+','+i+',this)">'+
      '<span class="mi-paso-n">'+(i+1)+'</span><span class="mi-paso-t">'+ps[i]+'</span></label>';
  }
  return h + '</div>';
};
MI.paso = function(id, i, cb){
  cb.parentNode.classList.toggle('hecho', cb.checked);
  var k = clavePrivada(id); if(!k) return;
  var n = notas(), arr = n[k] || []; var p = arr.indexOf(i);
  if(cb.checked && p < 0) arr.push(i); if(!cb.checked && p >= 0) arr.splice(p,1);
  n[k] = arr; guardar();
  if(arr.length === MI.reg[id].pasos.length) marcarResuelto(id);
};

/* ---- reflexion (respuesta abierta que se guarda) ---- */
P.reflexion = function(b, id){
  var k = clavePrivada(id), previo = (k && notas()[k]) || '';
  return '<div class="bloque mi mi-reflexion">'+cab(b,'Aplícalo a tu vida','✍')+
    '<div class="mi-p" style="margin-bottom:10px">'+b.pregunta+'</div>'+
    '<textarea class="mi-ta" rows="4" placeholder="'+e(b.ayuda||'Escribe aquí tu respuesta…')+'" oninput="MI.nota('+id+',this.value)">'+e(previo)+'</textarea>'+
    '<div class="mi-ta-pie" id="mi-'+id+'-g">'+(k?'Tu respuesta se guarda sola y solo tú la ves.':'')+'</div></div>';
};
MI.nota = function(id, v){
  var k = clavePrivada(id); if(!k) return;
  notas()[k] = v; guardar();
  var g = $i('mi-'+id+'-g'); if(g) g.textContent = 'Guardado ✓';
};

/* ---- excel (hoja de cálculo de práctica) ----
   b.datos: matriz de filas; la primera fila son encabezados de columna (texto).
   b.retos: [{celda:'B7', esperado:150 | 'texto', formula, requiere, pista, explica}]
   Fórmulas admitidas: + - * / ^ & ( ), comparaciones, referencias (B2, $B$2), rangos (B2:B6), textos
   entre comillas y estas funciones (en español o inglés):
     SUMA SUM · PROMEDIO AVERAGE · MIN · MAX · CONTAR COUNT · CONTARA COUNTA · REDONDEAR ROUND
     ENTERO INT · ABS · SI IF · Y AND · O OR · NO NOT · SI.ERROR IFERROR
     SUMAR.SI SUMIF · CONTAR.SI COUNTIF · PROMEDIO.SI AVERAGEIF
     SUMAR.SI.CONJUNTO SUMIFS · CONTAR.SI.CONJUNTO COUNTIFS
     BUSCARV VLOOKUP · BUSCARX XLOOKUP · INDICE INDEX · COINCIDIR MATCH
     CONCATENAR CONCAT · IZQUIERDA LEFT · DERECHA RIGHT · EXTRAE MID · LARGO LEN
     MAYUSC UPPER · MINUSC LOWER · ESPACIOS TRIM
   VERDADERO/FALSO (TRUE/FALSE) valen 1/0.                                                   */
function colNum(L){ var n=0; for(var i=0;i<L.length;i++) n = n*26 + (L.charCodeAt(i)-64); return n-1; }
function colLetra(n){ var s=''; n++; while(n>0){ var m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26); } return s; }
function parsearCelda(ref){ var m = /^([A-Z]+)(\d+)$/.exec(ref); return m ? { c:colNum(m[1]), f:parseInt(m[2],10)-1 } : null; }
var XL_NA = { error:'#N/A' };
function xlNum(v){ if(typeof v === 'number') return v; if(v === '' || v == null) return NaN; return parseFloat(String(v).replace(/[$,\s]/g,'')); }
function xlEsNum(v){ return typeof v === 'number' || (v !== '' && v != null && !isNaN(xlNum(v)) && /^[\s$\-+]*[\d.,]+\s*$/.test(String(v))); }
function xlIgual(a, b){
  if(xlEsNum(a) && xlEsNum(b)) return Math.abs(xlNum(a) - xlNum(b)) < 1e-9;
  return String(a == null ? '' : a).trim().toUpperCase() === String(b == null ? '' : b).trim().toUpperCase();
}
MI.evaluarFormula = function(formula, hoja){
  var f = String(formula).trim();
  if(f.charAt(0) !== '=') throw new Error('La fórmula debe empezar con el signo =');
  f = f.slice(1);
  var partes = f.split('"');
  if(partes.length % 2 === 0) throw new Error('Te falta cerrar unas comillas');

  function valor(ref){
    var p = parsearCelda(ref); if(!p) throw new Error('No entiendo la celda '+ref);
    var fila = hoja[p.f]; var v = fila ? fila[p.c] : undefined;
    if(v === '' || v == null) return 0;
    if(typeof v === 'number') return v;
    return xlEsNum(v) ? xlNum(v) : String(v);
  }
  function rango(a, b){
    var p = parsearCelda(a), q = parsearCelda(b), out = []; out.todos = [];
    var f0 = Math.min(p.f,q.f), f1 = Math.max(p.f,q.f), c0 = Math.min(p.c,q.c), c1 = Math.max(p.c,q.c);
    out.nf = f1 - f0 + 1; out.nc = c1 - c0 + 1;
    for(var r=f0; r<=f1; r++)
      for(var c=c0; c<=c1; c++){
        var v = hoja[r] ? hoja[r][c] : undefined;
        out.todos.push(v == null ? '' : v);
        if(typeof v === 'number') out.push(v);
        else if(xlEsNum(v)) out.push(xlNum(v));
      }
    out.celda = function(fi, ci){ if(fi < 0 || ci < 0 || fi >= out.nf || ci >= out.nc) return XL_NA; var v = out.todos[fi*out.nc + ci]; return xlEsNum(v) ? xlNum(v) : v; };
    return out;
  }
  var nombres = {
    'SUMA':'S','SUM':'S','PROMEDIO':'P','AVERAGE':'P','MIN':'MN','MAX':'MX','CONTAR':'C','COUNT':'C',
    'CONTARA':'CA','COUNTA':'CA','REDONDEAR':'R','ROUND':'R','ENTERO':'ENT','INT':'ENT','ABS':'ABS_',
    'SI':'IF_','IF':'IF_','Y':'Y_','AND':'Y_','O':'O_','OR':'O_','NO':'NO_','NOT':'NO_',
    'SI.ERROR':'SIE','IFERROR':'SIE',
    'SUMAR.SI':'SSI','SUMIF':'SSI','CONTAR.SI':'CSI','COUNTIF':'CSI','PROMEDIO.SI':'PSI','AVERAGEIF':'PSI',
    'SUMAR.SI.CONJUNTO':'SSIC','SUMIFS':'SSIC','CONTAR.SI.CONJUNTO':'CSIC','COUNTIFS':'CSIC',
    'BUSCARV':'BV','VLOOKUP':'BV','BUSCARX':'BX','XLOOKUP':'BX','INDICE':'IDX','INDEX':'IDX','COINCIDIR':'CO','MATCH':'CO',
    'CONCATENAR':'CC','CONCAT':'CC','IZQUIERDA':'IZQ','LEFT':'IZQ','DERECHA':'DER','RIGHT':'DER','EXTRAE':'EXT','MID':'EXT',
    'LARGO':'LAR','LEN':'LAR','MAYUSC':'MAY','UPPER':'MAY','MINUSC':'MINU','LOWER':'MINU','ESPACIOS':'ESP','TRIM':'ESP'
  };
  for(var k=0; k<partes.length; k+=2){
    var t = partes[k].toUpperCase().replace(/\s+/g,'').replace(/;/g, ',')
                     .replace(/\$?([A-Z]{1,2})\$?(\d+)/g, '$1$2');       /* $E$2 se evalúa igual que E2 */
    t = t.replace(/\b(VERDADERO|TRUE)\b(?!\()/g,'1').replace(/\b(FALSO|FALSE)\b(?!\()/g,'0');
    t = t.replace(/&/g, '+""+');                                         /* unir textos */
    t = t.replace(/<>/g,'!=').replace(/(^|[^<>!=])=(?!=)/g,'$1==');      /* comparaciones */
    t = t.replace(/([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ.]*)\(/g, function(_,n){
          if(!nombres[n]) throw new Error('Excel no reconoce la función '+n+' (#¿NOMBRE?)');
          return nombres[n]+'('; })
         .replace(/([A-Z]{1,2}\d+):([A-Z]{1,2}\d+)/g, function(_,a,b){ return 'RG("'+a+'","'+b+'")'; })
         .replace(/(^|[^"A-Z_])([A-Z]{1,2}\d+)(?![A-Z_(])/g, function(_,pre,r){ return pre+'V("'+r+'")'; })
         .replace(/\^/g,'**');
    if(/[^0-9+\-*/().,"A-Z_<>=!\s]/.test(t)) throw new Error('La fórmula tiene caracteres que no reconozco');
    partes[k] = t;
  }
  for(var j=1; j<partes.length; j+=2) partes[j] = partes[j].replace(/\\/g,'\\\\');
  var js = partes.join('"');

  var planos = function(args){ var o=[]; for(var i=0;i<args.length;i++){ if(Array.isArray(args[i])) o = o.concat(args[i]); else o.push(args[i]); } return o; };
  var esErr = function(x){ return x === XL_NA || (typeof x === 'number' && !isFinite(x)); };
  function cumple(v, crit){
    if(typeof crit === 'number') return xlIgual(v, crit);
    var m = /^(>=|<=|<>|>|<|=)?(.*)$/.exec(String(crit)), op = m[1] || '=', ref = m[2];
    var nv = xlNum(v), nr = parseFloat(ref);
    if(!isNaN(nr) && !isNaN(nv) && /^[\d.\-]+$/.test(ref)){ return op==='='?nv===nr: op==='<>'?nv!==nr: op==='>'?nv>nr: op==='<'?nv<nr: op==='>='?nv>=nr: nv<=nr; }
    var a = String(v).toUpperCase().trim(), b = String(ref).toUpperCase().trim();
    return op === '<>' ? a !== b : a === b;
  }
  function todos(r){ return (r && r.todos) ? r.todos : [r]; }
  function aproximada(lista, v){ var pos = -1; for(var i=0;i<lista.length;i++){ if(xlEsNum(lista[i]) && xlNum(lista[i]) <= xlNum(v)) pos = i; } return pos; }
  var F = {
    V: valor, RG: rango,
    S: function(){ return planos(arguments).reduce(function(a,b){return a+(xlEsNum(b)?xlNum(b):0);},0); },
    P: function(){ var x = planos(arguments).filter(xlEsNum); if(!x.length) throw new Error('#¡DIV/0!'); return x.reduce(function(a,b){return a+xlNum(b);},0)/x.length; },
    MN: function(){ return Math.min.apply(null, planos(arguments).filter(xlEsNum).map(xlNum)); },
    MX: function(){ return Math.max.apply(null, planos(arguments).filter(xlEsNum).map(xlNum)); },
    C: function(){ return planos(arguments).filter(xlEsNum).length; },
    CA: function(){ var n=0; for(var i=0;i<arguments.length;i++) n += todos(arguments[i]).filter(function(v){ return v !== '' && v != null; }).length; return n; },
    R: function(x,d){ var k = Math.pow(10, d||0); return Math.round(x*k)/k; },
    ENT: function(x){ return Math.floor(x); }, ABS_: function(x){ return Math.abs(x); },
    IF_: function(c,a,b){ return c ? a : (b === undefined ? 0 : b); },
    Y_: function(){ for(var i=0;i<arguments.length;i++) if(!arguments[i]) return 0; return 1; },
    O_: function(){ for(var i=0;i<arguments.length;i++) if(arguments[i]) return 1; return 0; },
    NO_: function(x){ return x ? 0 : 1; },
    SIE: function(x, alt){ return esErr(x) ? alt : x; },
    SSI: function(rg, crit, rs){ var t = rg.todos, u = (rs||rg).todos, s = 0; for(var i=0;i<t.length;i++) if(cumple(t[i],crit) && xlEsNum(u[i])) s += xlNum(u[i]); return s; },
    CSI: function(rg, crit){ var t = rg.todos, n = 0; for(var i=0;i<t.length;i++) if(cumple(t[i],crit)) n++; return n; },
    PSI: function(rg, crit, rp){ var t = rg.todos, u = (rp||rg).todos, s = 0, n = 0; for(var i=0;i<t.length;i++) if(cumple(t[i],crit) && xlEsNum(u[i])){ s += xlNum(u[i]); n++; } if(!n) throw new Error('#¡DIV/0!'); return s/n; },
    SSIC: function(rs){ var args = arguments, u = rs.todos, s = 0;
      for(var i=0;i<u.length;i++){ var ok = true; for(var a=1;a<args.length;a+=2) if(!cumple(args[a].todos[i], args[a+1])){ ok = false; break; } if(ok && xlEsNum(u[i])) s += xlNum(u[i]); } return s; },
    CSIC: function(){ var args = arguments, n = 0, L = args[0].todos.length;
      for(var i=0;i<L;i++){ var ok = true; for(var a=0;a<args.length;a+=2) if(!cumple(args[a].todos[i], args[a+1])){ ok = false; break; } if(ok) n++; } return n; },
    BV: function(v, rg, col, ord){
      var primera = []; for(var r=0;r<rg.nf;r++) primera.push(rg.celda(r,0));
      var exacta = (ord === 0 || ord === false), pos = -1;
      if(exacta){ for(var i=0;i<primera.length;i++) if(xlIgual(primera[i], v)){ pos = i; break; } }
      else pos = aproximada(primera, v);
      return pos < 0 ? XL_NA : rg.celda(pos, col-1);
    },
    BX: function(v, rb, rr, sino){ var a = rb.todos, b = rr.todos; for(var i=0;i<a.length;i++) if(xlIgual(a[i], v)){ var x = b[i]; return xlEsNum(x) ? xlNum(x) : x; } return sino === undefined ? XL_NA : sino; },
    IDX: function(rg, fi, ci){ if(rg.nc === 1 && ci === undefined) return rg.celda(fi-1, 0); if(rg.nf === 1 && ci === undefined) return rg.celda(0, fi-1); return rg.celda(fi-1, (ci||1)-1); },
    CO: function(v, rg, tipo){ var t = rg.todos; if(tipo === 0){ for(var i=0;i<t.length;i++) if(xlIgual(t[i], v)) return i+1; return XL_NA; } var p = aproximada(t, v); return p < 0 ? XL_NA : p+1; },
    CC: function(){ var o = ''; for(var i=0;i<arguments.length;i++) o += todos(arguments[i]).join(''); return o; },
    IZQ: function(t,n){ return String(t).slice(0, n === undefined ? 1 : n); },
    DER: function(t,n){ n = (n === undefined ? 1 : n); return n ? String(t).slice(-n) : ''; },
    EXT: function(t,i,n){ return String(t).substr(i-1, n); },
    LAR: function(t){ return String(t).length; },
    MAY: function(t){ return String(t).toUpperCase(); }, MINU: function(t){ return String(t).toLowerCase(); },
    ESP: function(t){ return String(t).replace(/\s+/g,' ').trim(); }
  };
  var claves = Object.keys(F);
  var fn = new Function(claves.join(','), 'return ('+js+');');
  var r = fn.apply(null, claves.map(function(c){ return F[c]; }));
  if(r === XL_NA) throw new Error('#N/A (no se encontró el valor que buscas)');
  if(typeof r === 'number' && !isFinite(r)) throw new Error('#¡DIV/0! (estás dividiendo entre cero)');
  if(typeof r === 'boolean') r = r ? 1 : 0;
  return r;
};
function fmtNum(v){
  if(typeof v !== 'number') return e(v);
  return (Math.round(v*100)/100).toLocaleString('es-MX', { maximumFractionDigits:2 });
}
P.excel = function(b, id){
  var hoja = JSON.parse(JSON.stringify(b.datos || []));
  MI.estado[id] = { hoja:hoja, ok:{}, n:(b.retos||[]).length, sel:null };
  var retos = b.retos || [];
  var h = '<div class="bloque mi mi-excel" id="mi-'+id+'">'+cab(b,'Practica en la hoja de cálculo','⊞')+
    '<div class="mi-ins" style="margin:-4px 0 12px">Toca una celda amarilla, escribe la fórmula en la barra (empieza con <b>=</b>) y presiona <b>Enter</b> o <b>Revisar</b>.</div>'+
    '<div class="mi-xl-barra"><span class="mi-xl-ref" id="mi-'+id+'-ref">—</span><span class="mi-xl-fx">fx</span>'+
    '<input type="text" id="mi-'+id+'-fx" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Toca una celda amarilla" '+
    'onkeydown="if(event.key===\'Enter\'){MI.xlRevisar('+id+')}"><button type="button" class="mi-rev" onclick="MI.xlRevisar('+id+')">Revisar</button></div>'+
    '<div class="mi-xl-scroll"><table class="mi-xl" id="mi-'+id+'-t">'+xlTabla(id)+'</table></div>'+
    '<div id="mi-'+id+'-fb"></div><div class="mi-xl-retos">';
  for(var i=0;i<retos.length;i++)
    h += '<div class="mi-xl-reto" id="mi-'+id+'-r'+i+'" onclick="MI.xlSel('+id+',\''+retos[i].celda+'\')"><span class="mi-n">'+(i+1)+'</span><span>'+retos[i].texto+'</span></div>';
  return h + '</div><div class="mi-marcador" id="mi-'+id+'-tot"></div></div>';
};
function xlTabla(id){
  var st = MI.estado[id], b = MI.reg[id], hoja = st.hoja, retos = b.retos || [];
  var cols = 0; for(var r=0;r<hoja.length;r++) cols = Math.max(cols, hoja[r].length);
  for(var k=0;k<retos.length;k++){ var p = parsearCelda(retos[k].celda); cols = Math.max(cols, p.c+1); }
  var filas = hoja.length; for(var k2=0;k2<retos.length;k2++){ var p2 = parsearCelda(retos[k2].celda); filas = Math.max(filas, p2.f+1); }
  var h = '<thead><tr><th class="esq"></th>';
  for(var c=0;c<cols;c++) h += '<th>'+colLetra(c)+'</th>';
  h += '</tr></thead><tbody>';
  for(var f=0; f<filas; f++){
    h += '<tr><th>'+(f+1)+'</th>';
    for(var c2=0;c2<cols;c2++){
      var ref = colLetra(c2)+(f+1), v = hoja[f] ? hoja[f][c2] : '';
      var esReto = -1; for(var z=0;z<retos.length;z++) if(retos[z].celda === ref) esReto = z;
      var cls = esReto >= 0 ? (st.ok[esReto] ? 'reto ok' : 'reto') : (f===0 ? 'enc' : '');
      if(st.sel === ref) cls += ' sel';
      h += '<td class="'+cls+'"'+(esReto>=0?' onclick="MI.xlSel('+id+',\''+ref+'\')"':'')+'>'+
        (v === undefined || v === null ? '' : (typeof v === 'number' ? fmtNum(v) : e(v)))+'</td>';
    }
    h += '</tr>';
  }
  return h + '</tbody>';
}
MI.xlSel = function(id, ref){
  var st = MI.estado[id]; st.sel = ref;
  $i('mi-'+id+'-ref').textContent = ref;
  $i('mi-'+id+'-t').innerHTML = xlTabla(id);
  var inp = $i('mi-'+id+'-fx'); inp.placeholder = 'Escribe la fórmula para '+ref+', p. ej. =SUMA(…)';
  var retos = MI.reg[id].retos;
  for(var i=0;i<retos.length;i++){ var el = $i('mi-'+id+'-r'+i); if(el) el.classList.toggle('activo', retos[i].celda === ref); }
  inp.focus();
};
MI.xlRevisar = function(id){
  var st = MI.estado[id], b = MI.reg[id], fb = $i('mi-'+id+'-fb'), inp = $i('mi-'+id+'-fx');
  if(!st.sel){ fb.innerHTML = mal('Primero toca una celda amarilla.'); return; }
  var idx = -1; for(var i=0;i<b.retos.length;i++) if(b.retos[i].celda === st.sel) idx = i;
  var reto = b.retos[idx], txt = inp.value.trim();
  if(!txt){ fb.innerHTML = mal('Escribe una fórmula en la barra.'); return; }
  if(txt.charAt(0) !== '='){ fb.innerHTML = mal('<b>Casi.</b> En Excel toda fórmula empieza con el signo <b>=</b>. Sin él, Excel lo toma como texto.'); return; }
  var r;
  try{ r = MI.evaluarFormula(txt, st.hoja); }
  catch(err){
    st.fallos = st.fallos || {}; st.fallos[idx] = (st.fallos[idx]||0) + 1;
    fb.innerHTML = mal('<b>Excel marcaría error:</b> '+e(err.message)+'. '+(reto.pista||'')+
      (reto.formula && st.fallos[idx] >= 2 ? ' <button type="button" class="mi-ver" onclick="MI.xlVer('+id+','+idx+')">Ver respuesta</button>' : ''));
    return;
  }
  if(reto.requiere && txt.toUpperCase().replace(/\s/g,'').indexOf(reto.requiere) < 0){
    fb.innerHTML = mal('El resultado sería '+fmtNum(r)+', pero en este ejercicio usa la función <b>'+e(reto.requiere.replace('(',''))+'</b>. '+(reto.pista||'')); return;
  }
  var correcto = (typeof reto.esperado === 'number')
    ? (typeof r === 'number' && Math.abs(r - reto.esperado) < 0.005)
    : (String(r).trim().toUpperCase() === String(reto.esperado).trim().toUpperCase());
  if(correcto){
    var p = parsearCelda(st.sel); if(!st.hoja[p.f]) st.hoja[p.f] = []; st.hoja[p.f][p.c] = r;
    st.ok[idx] = true; inp.value = '';
    fb.innerHTML = bien('<b>¡Correcto!</b> '+st.sel+' = '+fmtNum(r)+'. '+(reto.explica||''));
    var el = $i('mi-'+id+'-r'+idx); if(el) el.classList.add('ok');
    st.sel = null; $i('mi-'+id+'-ref').textContent = '—';
    $i('mi-'+id+'-t').innerHTML = xlTabla(id);
    if(Object.keys(st.ok).length === st.n){ $i('mi-'+id+'-tot').innerHTML = '<div class="mi-listo">✓ Hoja terminada. Así se hace en Excel de verdad.</div>'; marcarResuelto(id); }
  }else{
    st.fallos = st.fallos || {}; st.fallos[idx] = (st.fallos[idx]||0) + 1;
    fb.innerHTML = mal('<b>Tu fórmula da '+fmtNum(r)+'</b>, pero se esperaba otro resultado. '+(reto.pista||'Revisa que el rango incluya todas las celdas.')+
      (reto.formula && st.fallos[idx] >= 2 ? ' <button type="button" class="mi-ver" onclick="MI.xlVer('+id+','+idx+')">Ver respuesta</button>' : ''));
  }
};
MI.xlVer = function(id, idx){
  var reto = MI.reg[id].retos[idx], inp = $i('mi-'+id+'-fx');
  MI.estado[id].sel = reto.celda; inp.value = reto.formula;
  $i('mi-'+id+'-fb').innerHTML = bien('La fórmula es <code>'+e(reto.formula)+'</code>. Presiona <b>Revisar</b> para aplicarla y fíjate en cómo está escrita.');
};

/* ---- clave (lo que te llevas) ---- */
P.clave = function(b, id){
  var its = b.items || [], h = '<div class="bloque mi-clave"><div class="mi-clave-tit">'+e(b.titulo||'Lo que te llevas de esta lección')+'</div><ul>';
  for(var i=0;i<its.length;i++) h += '<li>'+its[i]+'</li>';
  return h + '</ul></div>';
};

/* ---------------- Tiempo estimado de una lección ---------------- */
MI.minutos = function(lec){
  var palabras = 0, ejercicios = 0;
  function cuenta(x){
    if(x == null) return;
    if(typeof x === 'string'){ palabras += x.replace(/<[^>]+>/g,' ').split(/\s+/).length; return; }
    if(Array.isArray(x)){ for(var i=0;i<x.length;i++) cuenta(x[i]); return; }
    if(typeof x === 'object') for(var k in x) if(k !== 'tipo' && k !== 'url') cuenta(x[k]);
  }
  for(var i=0;i<(lec.bloques||[]).length;i++){
    var b = lec.bloques[i]; cuenta(b);
    if(MI.esInteractivo(b.tipo)){
      var n = (b.preguntas||b.items||b.pares||b.tarjetas||b.frases||b.retos||[]).length;
      if(b.tipo === 'excel') n = n * 2;
      ejercicios += Math.max(1, n);
    }
    if(b.tipo === 'escuchar' || b.tipo === 'dialogo') ejercicios += 2;
    if(b.tipo === 'plantilla') ejercicios += 4;           /* probarla en la herramienta */
    if(b.tipo === 'reflexion' || b.tipo === 'actividad') ejercicios += 4;
    if(b.tipo === 'pasos') ejercicios += 2 + (b.pasos||[]).length * 2;   /* se hacen en la computadora */
  }
  return Math.max(5, Math.round((palabras/150 + ejercicios*0.6)/5)*5);
};
MI.contarEjercicios = function(lec){
  var n = 0; for(var i=0;i<(lec.bloques||[]).length;i++) if(MI.esInteractivo(lec.bloques[i].tipo) || lec.bloques[i].tipo==='pasos') n++; return n;
};

/* ---------------- Estilos ---------------- */
var css = ''+
'.mi{background:#fff;border:1px solid var(--linea);border-radius:var(--r);padding:20px 22px}'+
'.mi-cab{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}'+
'.mi-ico{width:34px;height:34px;border-radius:10px;background:var(--lavanda);color:var(--morado);display:grid;place-items:center;font-weight:800;flex:none;font-size:1rem}'+
'.mi-rot{font-weight:700;color:var(--tinta);font-size:1rem;line-height:1.35;padding-top:5px}'+
'.mi-ins{font-size:.9rem;color:var(--gris);line-height:1.55;margin-top:2px}'+
'.mi-n{display:inline-grid;place-items:center;min-width:22px;height:22px;border-radius:50%;background:var(--lavanda);color:var(--morado);font-size:.75rem;font-weight:800;margin-right:8px;flex:none}'+
'.mi-es{display:block;color:var(--gris);font-size:.88rem;font-style:italic}'+
'.mi-pron{display:block;color:var(--turquesa-osc);font-size:.85rem;font-weight:600}'+
'.mi-fb{margin-top:10px;padding:10px 14px;border-radius:10px;font-size:.92rem;line-height:1.55}'+
'.mi-fb.ok{background:#ECFDF5;color:#065F46;border:1px solid #A7F3D0}'+
'.mi-fb.no{background:#FFF7ED;color:#9A3412;border:1px solid #FED7AA}'+
'.mi-listo{margin-top:14px;padding:11px 14px;border-radius:10px;background:linear-gradient(90deg,#ECFDF5,#F0FDFA);color:#065F46;font-weight:700;font-size:.93rem}'+
'.mi-rev,.mi-ver,.mi-mic,.mi-copiar{border:0;border-radius:10px;padding:9px 16px;font-weight:600;font-size:.88rem;cursor:pointer;transition:.15s}'+
'.mi-rev{background:var(--morado);color:#fff}.mi-rev:hover{background:var(--morado-osc)}'+
'.mi-ver{background:var(--lavanda);color:var(--morado)}.mi-ver:hover{background:var(--lila)}'+
/* voz */
'.mi-voz{display:inline-flex;gap:5px;flex:none;vertical-align:middle}'+
'.mi-voz button{width:36px;height:36px;border-radius:50%;border:0;background:var(--morado);color:#fff;display:grid;place-items:center;cursor:pointer;transition:.15s}'+
'.mi-voz button.lento{background:var(--lavanda);color:var(--morado)}'+
'.mi-voz button:hover{transform:scale(1.08)}'+
'.mi-voz.chico button{width:28px;height:28px}'+
'.mi-dialogo-audio{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px dashed var(--linea)}'+
'.mi-frase{display:flex;gap:14px;align-items:center;padding:11px 0;border-top:1px solid var(--linea)}'+
'.mi-frase:first-of-type{border-top:0}'+
'.mi-frase-t b{color:var(--tinta);font-size:1.02rem}'+
'.mi-oir{display:flex;gap:10px;align-items:center;margin-top:8px;font-size:.88rem;color:var(--gris)}'+
/* practica */
'.mi-preg{padding:14px 0;border-top:1px solid var(--linea)}.mi-preg:first-of-type{border-top:0;padding-top:0}'+
'.mi-p{font-weight:600;color:var(--tinta);line-height:1.5;margin-bottom:10px;display:flex;align-items:center;flex-wrap:wrap;gap:4px}'+
'.mi-ops{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}'+
'.mi-op{text-align:left;padding:11px 14px;border:1.5px solid var(--linea);border-radius:11px;background:#fff;cursor:pointer;transition:.13s;line-height:1.4;font-size:.95rem}'+
'.mi-op:hover:not(:disabled){border-color:var(--lila);background:var(--nube)}'+
'.mi-op.ok{border-color:var(--ok);background:#ECFDF5;color:#065F46;font-weight:600}'+
'.mi-op.no{border-color:#FDBA74;background:#FFF7ED;color:#9A3412;text-decoration:line-through}'+
'.mi-op:disabled{cursor:default}'+
/* completar */
'.mi-comp{padding:12px 0;border-top:1px solid var(--linea)}.mi-comp:first-of-type{border-top:0;padding-top:0}'+
'.mi-comp-f{display:flex;align-items:center;flex-wrap:wrap;gap:8px;font-size:1.02rem;line-height:2}'+
'.mi-hueco{border:0;border-bottom:2.5px solid var(--morado);background:var(--nube);padding:3px 8px;margin:0 6px;border-radius:6px 6px 0 0;font-weight:600;color:var(--tinta);text-align:center;outline:none;min-width:5ch}'+
'.mi-hueco:focus{background:var(--lavanda)}'+
'.mi-hueco.ok{border-color:var(--ok);background:#ECFDF5;color:#065F46}'+
'.mi-hueco.no{border-color:var(--error);animation:mi-sacude .4s}'+
'@keyframes mi-sacude{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}'+
'.mi-comp .mi-rev{padding:6px 13px;font-size:.82rem}'+
/* relacionar */
'.mi-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}'+
'.mi-col{display:flex;flex-direction:column;gap:8px}'+
'.mi-ficha{padding:12px 14px;border:1.5px solid var(--linea);border-radius:11px;background:#fff;cursor:pointer;text-align:left;font-size:.93rem;line-height:1.35;transition:.13s;min-height:48px}'+
'.mi-ficha:hover:not(:disabled){border-color:var(--lila);background:var(--nube)}'+
'.mi-ficha.sel{border-color:var(--morado);background:var(--lavanda);box-shadow:0 0 0 3px rgba(109,40,217,.15)}'+
'.mi-ficha.ok{border-color:var(--ok);background:#ECFDF5;color:#065F46;opacity:.75}'+
'.mi-ficha.no{border-color:var(--error);background:#FEF2F2;animation:mi-sacude .4s}'+
/* ordenar */
'.mi-ord{padding:14px 0;border-top:1px solid var(--linea)}.mi-ord:first-of-type{border-top:0;padding-top:0}'+
'.mi-armado{min-height:52px;border:2px dashed var(--lila);border-radius:12px;padding:8px;display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin-bottom:10px;background:var(--nube)}'+
'.mi-armado.ok{border-style:solid;border-color:var(--ok);background:#ECFDF5}'+
'.mi-vacio{color:#9CA3AF;font-size:.88rem;padding:0 6px}'+
'.mi-banco{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px}'+
'.mi-pal{padding:8px 14px;border-radius:10px;border:1.5px solid var(--lila);background:#fff;font-weight:600;color:var(--tinta);cursor:pointer;font-size:.95rem;transition:.12s}'+
'.mi-pal:hover:not(:disabled){background:var(--lavanda)}'+
'.mi-pal.usada{opacity:.25;cursor:default}'+
'.mi-pal.puesta{background:var(--morado);color:#fff;border-color:var(--morado)}'+
'.mi-ord-acc{display:flex;gap:8px;flex-wrap:wrap}'+
/* tarjetas */
'.mi-tj-pos{font-size:.8rem;color:var(--gris);font-weight:600;text-align:center;margin-bottom:8px}'+
'.mi-tj-ronda{font-size:.85rem;color:var(--morado);font-weight:600;text-align:center;margin-bottom:8px}'+
'.mi-tj{perspective:900px;cursor:pointer;height:190px;max-width:440px;margin:0 auto}'+
'.mi-tj-in{position:relative;width:100%;height:100%;transition:transform .5s;transform-style:preserve-3d}'+
'.mi-tj.vuelta .mi-tj-in{transform:rotateY(180deg)}'+
'.mi-tj-cara{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;text-align:center}'+
'.mi-tj-cara.frente{background:linear-gradient(135deg,var(--tinta),var(--morado));color:#fff}'+
'.mi-tj-cara.dorso{background:#fff;border:2px solid var(--turquesa);transform:rotateY(180deg);color:var(--tinta)}'+
'.mi-tj-txt{font-size:1.45rem;font-weight:800;letter-spacing:-.4px;line-height:1.25}'+
'.mi-tj-pista{font-size:.78rem;opacity:.7;margin-top:12px}'+
'.mi-tj-ej{font-size:.88rem;color:var(--gris);font-style:italic;margin-top:10px}'+
'.mi-tj-acc{display:flex;gap:10px;justify-content:center;align-items:center;margin-top:14px;flex-wrap:wrap}'+
/* pronunciar */
'.mi-pr{padding:12px 0;border-top:1px solid var(--linea)}.mi-pr:first-of-type{border-top:0;padding-top:0}'+
'.mi-pr .mi-frase{border:0;padding:0 0 8px}'+
'.mi-pr-acc{padding-left:0}'+
'.mi-mic{background:var(--turquesa);color:#fff}.mi-mic:hover{background:var(--turquesa-osc)}'+
'.mi-mic.grabando{background:var(--error);animation:mi-pulso 1s infinite}'+
'@keyframes mi-pulso{50%{opacity:.7}}'+
/* tabla */
'.mi-tabla-caja{background:#fff;border:1px solid var(--linea);border-radius:var(--r);overflow:hidden}'+
'.mi-tabla-tit{font-weight:700;color:var(--tinta);padding:14px 18px;background:var(--nube);font-size:.95rem}'+
'.mi-tabla-scroll{overflow-x:auto}'+
'.mi-tabla{width:100%;border-collapse:collapse;font-size:.93rem;min-width:0}'+
'.mi-tabla th{background:var(--lavanda);color:var(--tinta);text-align:left;padding:10px 14px;font-weight:700;font-size:.85rem;text-transform:none;letter-spacing:0}'+
'.mi-tabla td{padding:10px 14px;border-top:1px solid var(--linea);border-bottom:0;vertical-align:middle;line-height:1.5}.mi-tabla tbody tr:hover{background:transparent}'+
'.mi-tabla td .mi-voz{margin-left:6px}'+
'.mi-tabla-nota{font-size:.85rem;color:var(--gris);padding:11px 18px;border-top:1px solid var(--linea);line-height:1.55}'+
/* comparar */
'.mi-comparar{background:#fff;border:1px solid var(--linea);border-radius:var(--r);overflow:hidden}'+
'.mi-comp-grid{display:grid;grid-template-columns:1fr 1fr}'+
'.mi-comp-lado{padding:16px 18px}'+
'.mi-comp-lado.mal{background:#FFF7ED;border-right:1px solid var(--linea)}'+
'.mi-comp-lado.bien{background:#F0FDF4}'+
'.mi-comp-et{font-weight:800;font-size:.8rem;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px}'+
'.mi-comp-lado.mal .mi-comp-et{color:#C2410C}.mi-comp-lado.bien .mi-comp-et{color:#047857}'+
'.mi-comp-tx{font-size:.93rem;line-height:1.6;color:#374151}'+
/* plantilla */
'.mi-plantilla{border-radius:var(--r);overflow:hidden;border:1px solid #1E1B4B}'+
'.mi-pl-cab{display:flex;justify-content:space-between;align-items:center;gap:10px;background:#1E1B4B;color:#C4B5FD;padding:10px 14px;font-size:.85rem;font-weight:600}'+
'.mi-copiar{background:var(--turquesa);color:#fff;padding:6px 14px;font-size:.82rem}.mi-copiar.ok{background:var(--ok)}'+
'.mi-pl-tx{background:#2E1065;color:#F5F3FF;padding:16px 18px;margin:0;white-space:pre-wrap;word-wrap:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.86rem;line-height:1.65}'+
'.mi-pl-nota{background:var(--nube);padding:10px 16px;font-size:.85rem;color:var(--gris);line-height:1.55}'+
/* pasos */
'.mi-paso{display:flex;gap:12px;align-items:flex-start;padding:11px 12px;border-radius:11px;cursor:pointer;transition:.12s;line-height:1.55}'+
'.mi-paso:hover{background:var(--nube)}'+
'.mi-paso input{margin-top:5px;width:18px;height:18px;accent-color:var(--turquesa);flex:none}'+
'.mi-paso-n{width:24px;height:24px;border-radius:50%;background:var(--lavanda);color:var(--morado);font-size:.78rem;font-weight:800;display:grid;place-items:center;flex:none}'+
'.mi-paso.hecho .mi-paso-t{color:var(--gris);text-decoration:line-through}'+
'.mi-paso.hecho .mi-paso-n{background:var(--turquesa);color:#fff}'+
/* reflexion */
'.mi-ta{width:100%;border:1.5px solid var(--linea);border-radius:11px;padding:12px 14px;line-height:1.6;resize:vertical;outline:none}'+
'.mi-ta:focus{border-color:var(--morado)}'+
'.mi-ta-pie{font-size:.78rem;color:var(--gris);margin-top:6px}'+
/* clave */
'.mi-clave{background:linear-gradient(135deg,#F0FDFA,var(--lavanda));border-radius:var(--r);padding:20px 22px;border:1px solid var(--lila)}'+
'.mi-clave-tit{font-weight:800;color:var(--tinta);margin-bottom:10px;font-size:1rem}'+
'.mi-clave ul{margin:0;padding-left:20px}.mi-clave li{margin-bottom:6px;line-height:1.6}'+
/* excel */
'.mi-xl-barra{display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap}'+
'.mi-xl-ref{min-width:44px;padding:8px 6px;border:1px solid var(--linea);border-radius:8px;text-align:center;font-weight:700;font-size:.85rem;color:var(--tinta);background:var(--nube)}'+
'.mi-xl-fx{font-style:italic;color:var(--gris);font-weight:700;font-family:Georgia,serif}'+
'.mi-xl-barra input{flex:1;min-width:150px;padding:9px 11px;border:1.5px solid var(--lila);border-radius:8px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.92rem;outline:none}'+
'.mi-xl-barra input:focus{border-color:#107C41}'+
'.mi-xl-scroll{overflow-x:auto;border:1px solid #D1D5DB;border-radius:8px}'+
'.mi-xl{border-collapse:collapse;font-size:.86rem;min-width:0;width:auto}'+
'.mi-xl th{background:#F3F4F6;color:#4B5563;font-weight:600;padding:5px 9px;border:1px solid #E5E7EB;text-align:center;font-size:.76rem;text-transform:none;letter-spacing:0;white-space:nowrap}'+
'.mi-xl td{border:1px solid #E5E7EB;padding:6px 10px;min-width:76px;height:32px;text-align:right;white-space:nowrap;background:#fff}'+
'.mi-xl td.enc{font-weight:700;text-align:left;background:#F0FDF4;color:#14532D}'+
'.mi-xl td.reto{background:#FEF9C3;cursor:pointer;box-shadow:inset 0 0 0 2px #FACC15}'+
'.mi-xl td.reto.sel{box-shadow:inset 0 0 0 2.5px #107C41;background:#FEFCE8}'+
'.mi-xl td.reto.ok{background:#DCFCE7;box-shadow:none;font-weight:700;color:#14532D;cursor:default}'+
'.mi-xl tbody tr:hover{background:transparent}'+
'.mi-xl-retos{margin-top:12px;display:flex;flex-direction:column;gap:6px}'+
'.mi-xl-reto>span:last-child{min-width:0;overflow-wrap:anywhere}.mi-xl-reto{display:flex;gap:8px;align-items:flex-start;padding:9px 11px;border-radius:10px;border:1.5px solid var(--linea);cursor:pointer;font-size:.92rem;line-height:1.5}'+
'.mi-xl-reto.activo{border-color:#107C41;background:#F0FDF4}'+
'.mi-xl-reto.ok{opacity:.6;text-decoration:line-through}'+
/* cabecera de lección */
'.lec-meta{display:flex;gap:16px;flex-wrap:wrap;font-size:.85rem;color:var(--gris);margin:-16px 0 24px;font-weight:500}'+
'.lec-meta span{display:inline-flex;gap:6px;align-items:center}'+
'.lec-obj{background:#fff;border:1px solid var(--linea);border-left:4px solid var(--turquesa);border-radius:0 var(--r) var(--r) 0;padding:14px 18px;margin-bottom:26px;font-size:.95rem;line-height:1.6}'+
'.lec-obj b{color:var(--tinta)}'+
'.lec-progreso{font-size:.85rem;color:var(--gris);display:flex;align-items:center;gap:8px}'+
'@media(max-width:640px){.mi-tabla{font-size:.84rem}.mi-tabla th{white-space:normal;padding:8px 9px}.mi-tabla td{padding:8px 9px}.mi-tabla td .mi-voz{display:flex;margin:4px 0 0}.mi{padding:16px}.mi-cols{gap:8px}.mi-ficha{padding:10px;font-size:.87rem}.mi-comp-grid{grid-template-columns:1fr}.mi-comp-lado.mal{border-right:0;border-bottom:1px solid var(--linea)}.mi-ops{grid-template-columns:1fr}.mi-tj{height:170px}.mi-tj-txt{font-size:1.2rem}}';
var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
})();
