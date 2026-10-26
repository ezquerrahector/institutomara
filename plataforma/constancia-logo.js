/* ============================================================================
   Logo de la empresa en las constancias (20 oct 2026)
   - La empresa decide si su logo sale en las constancias de su personal (abajo,
     como un sello más) y si sale la línea «Capacitación del personal de …».
   - Se configura en «Mi empresa», en la ficha de la empresa (administración) y en
     la ficha del operador. Requiere backend/logo-constancias-20261020.sql.
   - El servidor copia el logo y el nombre en la constancia al emitirla; aquí solo
     se leen y se pintan.
   ========================================================================== */
var MARCA = { cfg:{}, logoNuevo:{}, porFolio:{} };  /* porFolio no se guarda en el navegador: se pide al servidor al abrir la constancia */

/* ---------- Pintar la marca de la empresa en la constancia ---------- */
function marcaConstanciaHTML(rec){
  var mk = (rec && MARCA.porFolio[rec.folio]) || {};
  var sello = mk.logo
    ? '<div class="sello-emp"><img class="logo-emp" src="'+esc(mk.logo)+'" alt="Logo de la empresa"><span>Capacitación<br>de su personal</span></div>' : '';
  var linea = mk.nombre
    ? '<div class="para-empresa">Capacitación del personal de '+esc(mk.nombre)+'</div>' : '';
  return { sello:sello, linea:linea };
}
function pintarMarcaConstancia(rec){
  var m = marcaConstanciaHTML(rec), s = $('emp-sello-'+rec.id), l = $('emp-linea-'+rec.id);
  if(s) s.outerHTML = m.sello ? m.sello.replace('class="sello-emp"', 'class="sello-emp" id="emp-sello-'+rec.id+'"') : '<span id="emp-sello-'+rec.id+'" hidden></span>';
  if(l) l.outerHTML = m.linea ? m.linea.replace('class="para-empresa"', 'class="para-empresa" id="emp-linea-'+rec.id+'"') : '<span id="emp-linea-'+rec.id+'" hidden></span>';
}
var _vistaConstanciaMarca = vistaConstancia;
vistaConstancia = function(){
  var h = _vistaConstanciaMarca();
  var m = h.match(/id="qr-([^"]+)"/); if(!m) return h;
  var id = m[1], rec = BD.constancias.filter(function(r){ return String(r.id) === id; })[0];
  if(!rec) return h;
  var mc = marcaConstanciaHTML(rec);
  var sello = mc.sello ? mc.sello.replace('class="sello-emp"', 'class="sello-emp" id="emp-sello-'+id+'"') : '<span id="emp-sello-'+id+'" hidden></span>';
  var linea = mc.linea ? mc.linea.replace('class="para-empresa"', 'class="para-empresa" id="emp-linea-'+id+'"') : '<span id="emp-linea-'+id+'" hidden></span>';
  return h.replace('<div class="sello-oficial">', sello + '<div class="sello-oficial">')
          .replace('<div class="encabeza">Instituto Mara</div>', '<div class="encabeza">Instituto Mara</div>' + linea);
};
/* Al publicar (o consultar) la constancia en el servidor, se trae la marca que guardó. */
if(typeof Nube !== 'undefined' && Nube.asegurarConstanciaPublicada){
  var _publicarConstanciaMarca = Nube.asegurarConstanciaPublicada;
  Nube.asegurarConstanciaPublicada = function(k){
    return _publicarConstanciaMarca(k).then(function(r){
      return Nube.tabla('constancias?folio=eq.'+encodeURIComponent(k.folio)+'&select=empresa_logo,empresa_nombre').then(function(rows){
        var f = rows && rows[0]; if(!f) return r;
        var antes = MARCA.porFolio[k.folio] || {}, logo = f.empresa_logo || '', nombre = f.empresa_nombre || '';
        MARCA.porFolio[k.folio] = { logo:logo, nombre:nombre };
        if((antes.logo||'') !== logo || (antes.nombre||'') !== nombre) pintarMarcaConstancia(k);
        return r;
      }, function(){ return r; });
    });
  };
}

/* ---------- Configuración: «Constancias de su equipo» ---------- */
function cajaMarcaEmpresa(){
  return '<div class="tarjeta no-imprimir" id="marca-emp" style="margin-top:18px"><h3 style="color:var(--tinta);margin-bottom:6px">Constancias de su equipo</h3><div id="marca-cuerpo"><p style="color:var(--gris)">Cargando…</p></div></div>';
}
function cargarMarcaEmpresa(id){
  return Nube.empresaRpc('empresa_constancias_ver', { p_empresa:id }).then(function(c){
    MARCA.cfg[id] = c || {}; delete MARCA.logoNuevo[id]; pintarMarcaEmpresa(id);
  }).catch(function(e){ var b = $('marca-cuerpo'); if(b) b.innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; });
}
function marcaLogoActual(id){ return MARCA.logoNuevo[id] !== undefined ? MARCA.logoNuevo[id] : (MARCA.cfg[id].logo_img || ''); }
function pintarMarcaEmpresa(id){
  var b = $('marca-cuerpo'), c = MARCA.cfg[id]; if(!b || !c) return;
  var logo = marcaLogoActual(id);
  b.innerHTML =
    '<p style="color:var(--gris);font-size:.92rem;margin-bottom:14px">Las constancias de su personal salen como siempre, con la firma, el folio y el QR de Instituto Mara. Si lo desean, pueden agregar el logo de su empresa y una línea con su nombre. Solo aplica a las constancias que se emitan a partir de que lo guarden; las ya emitidas no cambian.</p>'+
    '<div class="fila" style="align-items:flex-start">'+
      '<div class="campo"><label>Logo de la empresa</label>'+
        '<div id="marca-prev" style="background:#fff;border:1px dashed var(--linea);border-radius:12px;padding:12px;text-align:center;min-height:84px;display:grid;place-items:center">'+
          (logo ? '<img src="'+esc(logo)+'" alt="Logo" style="max-height:70px;max-width:100%">' : '<span style="color:var(--gris);font-size:.9rem">Sin logo</span>')+'</div>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'+
          '<label class="btn btn-linea btn-sm" style="cursor:pointer">'+(logo?'Cambiar logo':'Subir logo')+'<input type="file" id="marca-archivo" accept="image/png,image/jpeg,image/webp" hidden onchange="subirLogoEmpresa(\''+id+'\', this)"></label>'+
          (logo ? '<button class="btn btn-fantasma btn-sm" onclick="quitarLogoEmpresa(\''+id+'\')">Quitar logo</button>' : '')+
        '</div><div class="ayuda">PNG con fondo transparente se ve mejor. También sirve JPG.</div></div>'+
      '<div class="campo">'+
        '<label class="casilla" style="display:flex;gap:8px;align-items:flex-start;font-weight:600"><input type="checkbox" style="width:18px;height:18px;padding:0;margin-top:2px;flex:none;accent-color:var(--morado)" id="marca-logo-on"'+(c.logo_en_constancias && logo?' checked':'')+(logo?'':' disabled')+' onchange="marcaVistaPrevia(\''+id+'\')"> ¿Quieren que el logo de su empresa aparezca en las constancias de su personal?</label>'+
        '<label class="casilla" style="display:flex;gap:8px;align-items:flex-start;font-weight:600;margin-top:12px"><input type="checkbox" style="width:18px;height:18px;padding:0;margin-top:2px;flex:none;accent-color:var(--morado)" id="marca-nombre-on"'+(c.nombre_en_constancias?' checked':'')+' onchange="marcaVistaPrevia(\''+id+'\')"> Agregar la línea «Capacitación del personal de …»</label>'+
        '<label for="marca-nombre" style="margin-top:10px">Nombre como aparecerá</label><input id="marca-nombre" maxlength="120" value="'+esc(c.nombre_constancia||c.nombre||'')+'" oninput="marcaVistaPrevia(\''+id+'\')">'+
      '</div>'+
    '</div>'+
    '<div style="margin:6px 0 14px"><b style="font-size:.8rem;text-transform:uppercase;letter-spacing:1px;color:var(--gris)">Así se verá</b><div id="marca-muestra" style="margin-top:8px"></div></div>'+
    '<div id="marca-aviso"></div><button class="btn btn-mor" id="marca-btn" onclick="guardarMarcaEmpresa(\''+id+'\')">Guardar</button>';
  marcaVistaPrevia(id);
}
/* Muestra reducida de la parte baja de la constancia */
function marcaVistaPrevia(id){
  var caja = $('marca-muestra'); if(!caja) return;
  var logo = marcaLogoActual(id), conLogo = $('marca-logo-on') && $('marca-logo-on').checked && logo,
      conNom = $('marca-nombre-on') && $('marca-nombre-on').checked, nom = ($('marca-nombre') && $('marca-nombre').value.trim()) || '';
  var firmaNombre = ajuste('director_nombre', BD.config.directorNombre || ''), firmaPuesto = ajuste('director_puesto', BD.config.directorPuesto || 'Dirección Académica');
  caja.innerHTML = '<div class="constancia" style="padding:24px 22px;border-width:8px;max-width:640px;margin:0">'+
    '<div class="encabeza">Instituto Mara</div>'+
    (conNom && nom ? '<div class="para-empresa">Capacitación del personal de '+esc(nom)+'</div>' : '')+
    '<div style="font-family:Caveat,cursive;font-size:1.8rem;color:var(--tinta)">Constancia</div>'+
    '<div class="constancia-sellos" style="margin-top:14px">'+
      '<div class="sello-firma"><div class="firma-espacio" style="height:26px"></div><div class="linea-firma"></div>'+(firmaNombre?'<b class="firma-quien">'+esc(firmaNombre)+'</b><br>':'')+esc(firmaPuesto)+'<br>Instituto Mara</div>'+
      (conLogo ? '<div class="sello-emp"><img class="logo-emp" src="'+esc(logo)+'" alt="Logo de la empresa"><span>Capacitación<br>de su personal</span></div>' : '')+
      '<div class="sello-oficial"><div class="sello-anillo"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div><span>FOLIO<br>VERIFICABLE</span></div>'+
      '<div class="sello-qr" style="min-width:90px"><div style="width:72px;height:72px;background:repeating-linear-gradient(45deg,#2E1065 0 3px,#fff 3px 6px);opacity:.25"></div><span>Escanea para verificar</span></div>'+
    '</div></div>';
}
function subirLogoEmpresa(id, input){
  var f = input.files && input.files[0]; if(!f) return;
  var av = $('marca-aviso');
  if(!/^image\/(png|jpeg|webp)$/.test(f.type)){ av.innerHTML = '<div class="aviso aviso-error">Usa una imagen PNG, JPG o WEBP.</div>'; return; }
  var lector = new FileReader();
  lector.onload = function(){
    var im = new Image();
    im.onload = function(){
      /* Se reduce a un máximo de 600 × 240 px y se recorta el margen vacío (transparente o blanco). */
      var k = Math.min(1, 600 / im.width, 240 / im.height), w = Math.max(1, Math.round(im.width*k)), h = Math.max(1, Math.round(im.height*k));
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      var cx = cv.getContext('2d'); cx.drawImage(im, 0, 0, w, h);
      var px = cx.getImageData(0, 0, w, h).data, minX = w, minY = h, maxX = -1, maxY = -1;
      for(var i=0;i<px.length;i+=4){
        var vacio = px[i+3] < 16 || (px[i] > 245 && px[i+1] > 245 && px[i+2] > 245);
        if(!vacio){ var p = i/4, x = p % w, y = (p - x) / w; if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; }
      }
      if(maxX < 0){ av.innerHTML = '<div class="aviso aviso-error">La imagen está vacía. Prueba con otro archivo del logo.</div>'; return; }
      var m = 4, x0 = Math.max(0, minX-m), y0 = Math.max(0, minY-m), cw = Math.min(w, maxX+m+1) - x0, ch = Math.min(h, maxY+m+1) - y0;
      var cv2 = document.createElement('canvas'); cv2.width = cw; cv2.height = ch;
      cv2.getContext('2d').drawImage(cv, x0, y0, cw, ch, 0, 0, cw, ch);
      var url = cv2.toDataURL('image/png');
      if(url.length > 380000) url = cv2.toDataURL('image/webp', .9);
      if(url.length > 380000){ av.innerHTML = '<div class="aviso aviso-error">El logo quedó muy pesado. Usa una versión más sencilla o más pequeña.</div>'; return; }
      av.innerHTML = '';
      var on = $('marca-logo-on') ? $('marca-logo-on').checked : false, nOn = $('marca-nombre-on').checked, nom = $('marca-nombre').value;
      MARCA.logoNuevo[id] = url;
      MARCA.cfg[id] = Object.assign({}, MARCA.cfg[id], { logo_en_constancias: on || !MARCA.cfg[id].logo_img, nombre_en_constancias:nOn, nombre_constancia:nom });
      pintarMarcaEmpresa(id);
    };
    im.onerror = function(){ av.innerHTML = '<div class="aviso aviso-error">No pudimos abrir la imagen. Prueba con un PNG o JPG.</div>'; };
    im.src = lector.result;
  };
  lector.readAsDataURL(f);
}
function quitarLogoEmpresa(id){
  MARCA.cfg[id] = Object.assign({}, MARCA.cfg[id], { logo_en_constancias:false, nombre_en_constancias:$('marca-nombre-on').checked, nombre_constancia:$('marca-nombre').value });
  MARCA.logoNuevo[id] = ''; pintarMarcaEmpresa(id);
}
function guardarMarcaEmpresa(id){
  var av = $('marca-aviso'), btn = $('marca-btn');
  var args = { p_empresa:id, p_logo:marcaLogoActual(id) || null, p_logo_on:$('marca-logo-on').checked,
               p_nombre_on:$('marca-nombre-on').checked, p_nombre:$('marca-nombre').value.trim() };
  btn.disabled = true;
  Nube.empresaRpc('empresa_constancias_guardar', args).then(function(c){
    MARCA.cfg[id] = c || {}; delete MARCA.logoNuevo[id]; pintarMarcaEmpresa(id);
    $('marca-aviso').innerHTML = '<div class="aviso aviso-ok">Guardado. Las constancias nuevas de su personal ya salen así.</div>';
  }).catch(function(e){ av.innerHTML = '<div class="aviso aviso-error">'+esc(e.message)+'</div>'; btn.disabled = false; });
}

/* Se agrega la caja en «Mi empresa», en la ficha de administración y en la del operador. */
(function(){
  function insertar(h){
    if(!h || h.indexOf('id="rep-emp"') < 0 || !estado.empresaId) return h;
    var id = estado.empresaId;
    setTimeout(function(){ cargarMarcaEmpresa(id); }, 0);
    return h.replace('<div id="rep-emp"', cajaMarcaEmpresa() + '<div id="rep-emp"');
  }
  var a = vistaPortalEmpresa; vistaPortalEmpresa = function(){ return insertar(a()); };
  var b = vistaAdminEmpresa;  vistaAdminEmpresa  = function(){ return insertar(b()); };
  if(typeof vistaOprEmpresa === 'function'){ var c = vistaOprEmpresa; vistaOprEmpresa = function(){ return insertar(c()); }; }
})();
