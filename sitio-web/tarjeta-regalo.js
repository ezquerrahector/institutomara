/* Instituto Mara — tarjeta de regalo descargable (2 nov 2026).
   18 carátulas (6 ocasiones × 3 diseños) dibujadas en el navegador con <canvas>: sin servidor ni costo.
   Uso: TarjetaRegalo.montar(elemento, { para, de, programa, cursoId, mensaje, codigo, liga, tel })
   Necesita vendor/qrcode.js (qrcode-generator, MIT) cargado antes para el QR de activación. */
(function(){
  'use strict';
  var W = 1080, H = 1350;
  var OCASIONES = [
    { id:'cumple', n:'Cumpleaños', e:'🎂' }, { id:'navidad', n:'Navidad', e:'🎄' }, { id:'grad', n:'Graduación', e:'🎓' },
    { id:'gracias', n:'Gracias', e:'💐' }, { id:'maestro', n:'Día del Maestro', e:'🍎' }, { id:'aprender', n:'Para aprender', e:'✨' }
  ];
  var ISO = 'M25 95 L25 35 C25 26 34 23 39 30 L60 56 L81 30 C86 23 95 26 95 35 L95 95';

  /* ---------- utilidades de dibujo ---------- */
  function azar(sem){ return function(){ sem |= 0; sem = sem + 0x6D2B79F5 | 0; var t = Math.imul(sem ^ sem >>> 15, 1 | sem); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function grad(c, y0, y1, a, b){ var g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function fondo(c, a, b){ c.fillStyle = b ? grad(c, 0, H, a, b) : a; c.fillRect(0, 0, W, H); }
  function rr(c, x, y, w, h, r){ c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function estrella(c, x, y, r, puntas, interior){
    c.beginPath();
    for(var i = 0; i < puntas * 2; i++){ var rad = i % 2 ? r * (interior || .45) : r, a = Math.PI * i / puntas - Math.PI / 2; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
    c.closePath();
  }
  function chispa(c, x, y, r, color){ c.fillStyle = color; estrella(c, x, y, r, 4, .22); c.fill(); }
  function corazon(c, x, y, s, color){
    c.save(); c.translate(x, y); c.scale(s / 100, s / 100); c.fillStyle = color; c.beginPath();
    c.moveTo(0, 30); c.bezierCurveTo(0, 0, -50, 0, -50, 30); c.bezierCurveTo(-50, 60, -20, 75, 0, 100); c.bezierCurveTo(20, 75, 50, 60, 50, 30); c.bezierCurveTo(50, 0, 0, 0, 0, 30);
    c.fill(); c.restore();
  }
  function copo(c, x, y, r, color, ancho){
    c.save(); c.translate(x, y); c.strokeStyle = color; c.lineWidth = ancho || Math.max(2, r / 8); c.lineCap = 'round';
    for(var i = 0; i < 6; i++){
      c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -r);
      c.moveTo(0, -r * .55); c.lineTo(-r * .25, -r * .78); c.moveTo(0, -r * .55); c.lineTo(r * .25, -r * .78); c.stroke();
    }
    c.restore();
  }
  function globo(c, x, y, r, color){
    c.strokeStyle = 'rgba(80,60,90,.45)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y + r * 1.2);
    c.bezierCurveTo(x - 20, y + r * 1.8, x + 20, y + r * 2.3, x - 5, y + r * 3.2); c.stroke();
    c.fillStyle = color; c.beginPath(); c.ellipse(x, y, r, r * 1.2, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(x - 10, y + r * 1.28); c.lineTo(x + 10, y + r * 1.28); c.lineTo(x, y + r * 1.15); c.fill();
    c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(x - r * .38, y - r * .45, r * .16, r * .3, -.5, 0, Math.PI * 2); c.fill();
  }
  function pino(c, x, base, alto, color){
    c.fillStyle = color;
    for(var i = 0; i < 3; i++){ var w = alto * (.62 - i * .14), y = base - alto * (i * .26); c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); c.lineTo(x, y - alto * .45); c.closePath(); c.fill(); }
    c.fillRect(x - alto * .04, base, alto * .08, alto * .1);
  }
  function esfera(c, x, y, r, color, hilo){
    c.strokeStyle = 'rgba(120,90,40,.55)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, hilo); c.stroke();
    c.fillStyle = '#C9A227'; rr(c, x - r * .22, hilo, r * .44, r * .3, 4); c.fill();
    var g = c.createRadialGradient(x - r * .35, y - r * .35, r * .1, x, y, r); g.addColorStop(0, '#fff'); g.addColorStop(.18, color); g.addColorStop(1, color);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 4; c.beginPath(); c.ellipse(x, y, r, r * .28, 0, 0, Math.PI * 2); c.stroke();
  }
  function birrete(c, x, y, s, color, borla){
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = color; c.beginPath(); c.moveTo(-60, 20); c.lineTo(60, 20); c.lineTo(55, 70); c.quadraticCurveTo(0, 90, -55, 70); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0, -40); c.lineTo(130, 10); c.lineTo(0, 60); c.lineTo(-130, 10); c.closePath(); c.fill();
    c.strokeStyle = borla; c.lineWidth = 6; c.beginPath(); c.moveTo(0, 10); c.lineTo(95, 30); c.lineTo(95, 95); c.stroke();
    c.fillStyle = borla; c.beginPath(); c.moveTo(85, 95); c.lineTo(105, 95); c.lineTo(110, 135); c.lineTo(80, 135); c.closePath(); c.fill();
    c.beginPath(); c.arc(0, 10, 9, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  function hoja(c, x, y, l, ang, color){ c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = color; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(l * .5, -l * .32, l, 0); c.quadraticCurveTo(l * .5, l * .32, 0, 0); c.fill(); c.restore(); }
  // Dos ramas de laurel en elipse que abrazan el título por los lados (abiertas arriba y abajo al centro).
  function laurel(c, cx, cy, rx, ry, color){
    c.strokeStyle = color; c.lineWidth = 5;
    for(var lado = -1; lado <= 1; lado += 2){
      c.beginPath();
      for(var k = 0; k <= 40; k++){ var a = Math.PI / 2 + lado * (.45 + k * 2.0 / 40); c.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); }
      c.stroke();
      for(var i = 0; i < 12; i++){
        var a2 = Math.PI / 2 + lado * (.55 + i * .16), x = cx + Math.cos(a2) * rx, y = cy + Math.sin(a2) * ry;
        var tx = -Math.sin(a2) * rx * lado, ty = Math.cos(a2) * ry * lado, t = Math.atan2(ty, tx);
        hoja(c, x, y, 50, t - .6, color); hoja(c, x, y, 44, t + .6, color);
      }
    }
  }
  function flor(c, x, y, r, petalo, centro){
    c.save(); c.translate(x, y);
    for(var i = 0; i < 6; i++){ c.rotate(Math.PI / 3); c.fillStyle = petalo; c.beginPath(); c.ellipse(0, -r * .55, r * .32, r * .55, 0, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = centro; c.beginPath(); c.arc(0, 0, r * .3, 0, Math.PI * 2); c.fill(); c.restore();
  }
  function manzana(c, x, y, s){
    c.save(); c.translate(x, y); c.scale(s, s);
    var g = c.createRadialGradient(-30, -20, 10, 0, 10, 110); g.addColorStop(0, '#F87171'); g.addColorStop(1, '#B91C1C');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, -55);
    c.bezierCurveTo(40, -85, 105, -55, 95, 15); c.bezierCurveTo(88, 75, 45, 105, 0, 85); c.bezierCurveTo(-45, 105, -88, 75, -95, 15); c.bezierCurveTo(-105, -55, -40, -85, 0, -55); c.fill();
    c.strokeStyle = '#78350F'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -55); c.quadraticCurveTo(5, -85, 18, -100); c.stroke();
    hoja(c, 12, -82, 70, -.5, '#15803D');
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-48, -20, 14, 30, .4, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  function lapiz(c, x, y, l, ang, color){
    c.save(); c.translate(x, y); c.rotate(ang);
    c.fillStyle = color; c.fillRect(0, -22, l, 44);
    c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(0, 7, l, 15);
    c.fillStyle = '#F9A8D4'; rr(c, -46, -22, 40, 44, 8); c.fill();
    c.fillStyle = '#9CA3AF'; c.fillRect(-10, -22, 14, 44);
    c.fillStyle = '#FDE7C4'; c.beginPath(); c.moveTo(l, -22); c.lineTo(l + 70, 0); c.lineTo(l, 22); c.closePath(); c.fill();
    c.fillStyle = '#1F2937'; c.beginPath(); c.moveTo(l + 48, -7); c.lineTo(l + 70, 0); c.lineTo(l + 48, 7); c.closePath(); c.fill();
    c.restore();
  }
  function libro(c, x, y, s, hojaColor, linea){
    c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = hojaColor; c.strokeStyle = linea; c.lineWidth = 4;
    for(var lado = -1; lado <= 1; lado += 2){
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(lado * 70, -25, lado * 150, -5); c.lineTo(lado * 150, 85); c.quadraticCurveTo(lado * 70, 65, 0, 90); c.closePath(); c.fill(); c.stroke();
      for(var i = 0; i < 4; i++){ c.beginPath(); c.moveTo(lado * 25, 18 + i * 16); c.quadraticCurveTo(lado * 75, 2 + i * 16, lado * 125, 14 + i * 16); c.stroke(); }
    }
    c.restore();
  }
  function confeti(c, n, sem, colores, y0, y1){
    var r = azar(sem);
    for(var i = 0; i < n; i++){
      var x = r() * W, y = y0 + r() * (y1 - y0), col = colores[i % colores.length];
      c.save(); c.translate(x, y); c.rotate(r() * Math.PI); c.fillStyle = col;
      var t = r(); if(t < .45) c.fillRect(-9, -4, 18, 8); else if(t < .8){ c.beginPath(); c.arc(0, 0, 6, 0, Math.PI * 2); c.fill(); }
      else { c.strokeStyle = col; c.lineWidth = 5; c.beginPath(); c.moveTo(-14, 0); c.quadraticCurveTo(-5, -10, 3, 0); c.quadraticCurveTo(10, 10, 16, 0); c.stroke(); }
      c.restore();
    }
  }
  function bokeh(c, n, sem, color){
    var r = azar(sem);
    for(var i = 0; i < n; i++){ c.globalAlpha = .08 + r() * .22; c.fillStyle = color; c.beginPath(); c.arc(r() * W, r() * H, 10 + r() * 60, 0, Math.PI * 2); c.fill(); }
    c.globalAlpha = 1;
  }
  function puntos(c, n, sem, color, y1){
    var r = azar(sem); c.fillStyle = color;
    for(var i = 0; i < n; i++){ c.globalAlpha = .4 + r() * .6; c.beginPath(); c.arc(r() * W, r() * (y1 || H), 1.5 + r() * 2.5, 0, Math.PI * 2); c.fill(); }
    c.globalAlpha = 1;
  }

  /* ---------- las 18 carátulas ----------
     t: título · f: fuente del título (serif, cursiva o gis) · tc: color del título · lc: color del logo · ac: acento del panel */
  var DISENOS = [
    { id:'cumple-confeti', oc:'cumple', n:'Confeti', t:'¡Feliz cumpleaños!', f:'serif', tc:'#fff', lc:'#fff', ac:'#7C3AED',
      fondo:function(c){ fondo(c, '#4C1D95', '#7C3AED'); confeti(c, 140, 11, ['#FDE68A','#F9A8D4','#A7F3D0','#FFFFFF','#C4B5FD','#FCA5A5'], 0, H); } },
    { id:'cumple-globos', oc:'cumple', n:'Globos', t:'¡Feliz cumpleaños!', f:'serif', tc:'#9D174D', lc:'#9D174D', ac:'#DB2777',
      fondo:function(c){ fondo(c, '#FFF1F2', '#FBCFE8');
        globo(c, 110, 170, 70, '#F472B6'); globo(c, 230, 110, 58, '#A78BFA'); globo(c, 960, 160, 72, '#FBBF24'); globo(c, 850, 100, 52, '#34D399');
        confeti(c, 40, 7, ['#F472B6','#A78BFA','#FBBF24','#34D399'], 520, H); } , tw:720 },
    { id:'cumple-dorado', oc:'cumple', n:'Noche dorada', t:'Feliz cumple', f:'cursiva', tc:'#FCD34D', lc:'#FDE68A', ac:'#B45309',
      fondo:function(c){ fondo(c, '#0F172A', '#1E1B4B'); bokeh(c, 45, 3, '#FBBF24'); var r = azar(5);
        for(var i = 0; i < 26; i++) chispa(c, r() * W, r() * 560, 8 + r() * 18, '#FDE68A'); } },

    { id:'navidad-nochebuena', oc:'navidad', n:'Nochebuena', t:'Feliz Navidad', f:'cursiva', tc:'#fff', lc:'#fff', ac:'#B91C1C',
      fondo:function(c){ fondo(c, '#7F1D1D', '#B91C1C'); var r = azar(21);
        for(var i = 0; i < 34; i++){ var rad = 10 + r() * 28; c.globalAlpha = .35 + r() * .55; copo(c, r() * W, r() * H, rad, '#fff'); } c.globalAlpha = 1; } },
    { id:'navidad-bosque', oc:'navidad', n:'Bosque', t:'Felices fiestas', f:'serif', tc:'#FDE68A', lc:'#FDE68A', ac:'#047857',
      fondo:function(c){ fondo(c, '#022C22', '#065F46'); puntos(c, 90, 4, '#FDE68A', 520); chispa(c, 160, 110, 26, '#FDE68A'); chispa(c, 930, 90, 20, '#FDE68A');
        var xs = [20, 105, 180, 900, 975, 1060], al = [230, 300, 190, 190, 300, 230];
        for(var i = 0; i < xs.length; i++) pino(c, xs[i], 540, al[i], i % 2 ? '#10B981' : '#047857'); } , tw:640 },
    { id:'navidad-esferas', oc:'navidad', n:'Esferas', t:'Feliz Navidad', f:'serif', tc:'#991B1B', lc:'#991B1B', ac:'#B91C1C',
      fondo:function(c){ fondo(c, '#FFFBEB', '#FEF3C7'); esfera(c, 120, 230, 62, '#DC2626', 150); esfera(c, 260, 150, 44, '#15803D', 95);
        esfera(c, 820, 140, 46, '#CA8A04', 85); esfera(c, 960, 240, 64, '#DC2626', 160); confeti(c, 30, 9, ['#DC2626','#15803D','#CA8A04'], 560, H); } },

    { id:'grad-birrete', oc:'grad', n:'Birrete', t:'¡Felicidades por tu logro!', f:'serif', tc:'#fff', lc:'#fff', ac:'#1D4ED8',
      fondo:function(c){ fondo(c, '#172554', '#1E3A8A'); puntos(c, 70, 8, '#BFDBFE');
        birrete(c, 540, 150, .78, '#0B1220', '#FBBF24'); } , ilus:true },
    { id:'grad-laureles', oc:'grad', n:'Laureles', t:'¡Lo lograste!', f:'serif', tc:'#14532D', lc:'#14532D', ac:'#15803D',
      fondo:function(c){ fondo(c, '#FFFBEB', '#FEF3C7'); laurel(c, 540, 300, 470, 170, '#4D7C0F'); } , ts:84 },
    { id:'grad-oro', oc:'grad', n:'Negro y oro', t:'Por un nuevo comienzo', f:'serif', tc:'#FCD34D', lc:'#FDE68A', ac:'#B45309',
      fondo:function(c){ fondo(c, '#0B0B0F', '#1F2937'); c.save(); c.translate(540, 320);
        for(var i = 0; i < 36; i++){ c.rotate(Math.PI / 18); c.fillStyle = i % 2 ? 'rgba(252,211,77,.10)' : 'rgba(252,211,77,.04)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-60, -900); c.lineTo(60, -900); c.closePath(); c.fill(); }
        c.restore(); confeti(c, 70, 13, ['#FCD34D','#FDE68A','#D97706'], 0, H); } },

    { id:'gracias-flores', oc:'gracias', n:'Flores', t:'¡Gracias!', f:'cursiva', tc:'#9A3412', lc:'#9A3412', ac:'#EA580C',
      fondo:function(c){ fondo(c, '#FFF7ED', '#FED7AA');
        var fl = [[90,110,70,'#FB923C'],[200,60,46,'#F9A8D4'],[60,260,50,'#FDBA74'],[990,120,72,'#F472B6'],[880,60,44,'#FB923C'],[1020,280,52,'#FDBA74']];
        fl.forEach(function(f, i){ hoja(c, f[0], f[1], f[2] * 1.4, i * 1.3, '#65A30D'); flor(c, f[0], f[1], f[2], f[3], '#FDE68A'); }); } },
    { id:'gracias-corazones', oc:'gracias', n:'Corazones', t:'Gracias de corazón', f:'serif', tc:'#BE123C', lc:'#BE123C', ac:'#E11D48',
      fondo:function(c){ fondo(c, '#FFF1F2', '#FFE4E6'); var r = azar(17), cols = ['#FB7185','#F43F5E','#FDA4AF','#E11D48'];
        for(var i = 0, n = 0; n < 30 && i < 300; i++){ var x = r() * W, y = r() * H, t = 26 + r() * 50, a = .5 + r() * .5;
          if((y > 150 && y < 470 && x > 60 && x < 1020) || (y < 150 && x > 180 && x < 900)) continue; n++; c.globalAlpha = a; corazon(c, x, y, t, cols[n % 4]); } c.globalAlpha = 1; } },
    { id:'gracias-minimal', oc:'gracias', n:'Minimal', t:'Gracias', f:'cursiva', tc:'#5B21B6', lc:'#6D28D9', ac:'#6D28D9',
      fondo:function(c){ fondo(c, '#FFFFFF'); c.strokeStyle = '#C4B5FD'; c.lineWidth = 3;
        c.beginPath(); c.arc(140, 120, 180, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(960, 470, 120, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = '#DDD6FE'; c.beginPath(); c.arc(170, 150, 120, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#EDE9FE'; c.beginPath(); c.arc(920, 120, 60, 0, Math.PI * 2); c.fill(); chispa(c, 820, 230, 20, '#A78BFA'); } },

    { id:'maestro-pizarron', oc:'maestro', n:'Pizarrón', t:'¡Feliz Día del Maestro!', f:'gis', tc:'#F8FAFC', lc:'#F8FAFC', ac:'#166534',
      fondo:function(c){ fondo(c, '#7C4A1E'); c.fillStyle = grad(c, 0, H, '#1F3D2B', '#2D5A3D'); c.fillRect(28, 28, W - 56, H - 56);
        var r = azar(31); for(var i = 0; i < 160; i++){ c.fillStyle = 'rgba(255,255,255,' + (r() * .05) + ')'; c.fillRect(r() * W, r() * H, 40 + r() * 120, 2); }
        c.fillStyle = 'rgba(248,250,252,.55)'; c.font = '700 54px Caveat, cursive'; c.fillText('A B C', 80, 120); c.fillText('2 + 2 = 4', 760, 120);
        c.strokeStyle = 'rgba(248,250,252,.5)'; c.lineWidth = 4; estrella(c, 140, 470, 34, 5); c.stroke(); estrella(c, 950, 470, 26, 5); c.stroke(); } },
    { id:'maestro-manzana', oc:'maestro', n:'Manzana', t:'Gracias por enseñarme', f:'serif', tc:'#7C2D12', lc:'#7C2D12', ac:'#B91C1C',
      fondo:function(c){ fondo(c, '#FEFCE8', '#FEF9C3'); c.strokeStyle = 'rgba(37,99,235,.18)'; c.lineWidth = 2;
        for(var y = 60; y < H; y += 48){ c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
        c.strokeStyle = 'rgba(220,38,38,.35)'; c.beginPath(); c.moveTo(110, 0); c.lineTo(110, H); c.stroke();
        manzana(c, 540, 225, .8); } , ilus:true },
    { id:'maestro-lapices', oc:'maestro', n:'Lápices', t:'Feliz Día del Maestro', f:'serif', tc:'#1F2937', lc:'#1F2937', ac:'#CA8A04',
      fondo:function(c){ fondo(c, '#FDE047', '#FACC15'); lapiz(c, -60, 50, 280, .2, '#2563EB'); lapiz(c, 1140, 40, 280, Math.PI - .22, '#DC2626');
        lapiz(c, -40, 480, 230, -.12, '#16A34A'); lapiz(c, 1120, 485, 230, Math.PI + .15, '#7C3AED'); } , tw:760 },

    { id:'aprender-mara', oc:'aprender', n:'Mara', t:'Te regalo aprendizaje', f:'serif', tc:'#fff', lc:'#fff', ac:'#6D28D9',
      fondo:function(c){ fondo(c, '#2E1065', '#6D28D9'); c.save(); c.translate(600, -60); c.scale(8, 8); c.globalAlpha = .09;
        c.strokeStyle = '#fff'; c.lineWidth = 17; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(new Path2D(ISO)); c.restore(); c.globalAlpha = 1;
        var r = azar(41); for(var i = 0; i < 14; i++) chispa(c, r() * W, r() * 540, 6 + r() * 14, '#C4B5FD'); } },
    { id:'aprender-geometrico', oc:'aprender', n:'Geométrico', t:'Un regalo para crecer', f:'serif', tc:'#2E1065', lc:'#6D28D9', ac:'#6D28D9',
      fondo:function(c){ fondo(c, '#F5F3FF', '#EDE9FE');
        c.fillStyle = '#C4B5FD'; c.beginPath(); c.arc(80, 90, 150, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#8B5CF6'; c.beginPath(); c.moveTo(860, 40); c.lineTo(1040, 40); c.lineTo(950, 200); c.closePath(); c.fill();
        c.fillStyle = '#FDE68A'; c.fillRect(930, 330, 110, 110);
        c.strokeStyle = '#7C3AED'; c.lineWidth = 8; c.beginPath(); c.arc(170, 470, 50, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#A78BFA'; for(var i = 0; i < 5; i++) for(var j = 0; j < 4; j++){ c.beginPath(); c.arc(760 + i * 26, 470 + j * 26, 5, 0, Math.PI * 2); c.fill(); } } },
    { id:'aprender-estrellas', oc:'aprender', n:'Noche de estrellas', t:'Aprender es el mejor regalo', f:'serif', tc:'#EDE9FE', lc:'#EDE9FE', ac:'#4338CA',
      fondo:function(c){ fondo(c, '#1E1B4B', '#312E81'); puntos(c, 160, 23, '#fff'); var r = azar(29);
        for(var i = 0; i < 10; i++) chispa(c, r() * W, r() * 560, 10 + r() * 16, '#FDE68A');
        c.fillStyle = '#FDE68A'; c.beginPath(); c.arc(930, 120, 60, 0, Math.PI * 2); c.fill(); c.fillStyle = '#1E1B4B'; c.beginPath(); c.arc(955, 100, 52, 0, Math.PI * 2); c.fill();
        libro(c, 540, 140, .9, '#F5F3FF', '#A5B4FC'); } , ilus:true }
  ];

  /* ---------- texto ---------- */
  var FUENTE = { serif:'700 {s}px Fraunces, Georgia, serif', cursiva:'italic 600 {s}px Fraunces, Georgia, serif', gis:'700 {s}px Caveat, cursive' };
  function fuente(tipo, s){ return FUENTE[tipo].replace('{s}', s); }
  function partir(c, texto, ancho, maxLineas){
    var palabras = String(texto || '').split(/\s+/).filter(Boolean), lineas = [], l = '';
    for(var i = 0; i < palabras.length; i++){
      var prueba = l ? l + ' ' + palabras[i] : palabras[i];
      if(c.measureText(prueba).width > ancho && l){ lineas.push(l); l = palabras[i]; } else l = prueba;
    }
    if(l) lineas.push(l);
    if(lineas.length > maxLineas){
      lineas = lineas.slice(0, maxLineas); var u = lineas[maxLineas - 1];
      while(u.length > 1 && c.measureText(u + '…').width > ancho) u = u.slice(0, -1);
      lineas[maxLineas - 1] = u.replace(/[\s,.;:]+$/, '') + '…';
    }
    return lineas;
  }
  function articulo(id){ return /^d-/.test(id) ? 'el diplomado' : /^r-/.test(id) ? 'la ruta' : 'el curso'; }

  function qr(c, texto, x, y, lado, color){
    if(typeof window.qrcode !== 'function' || !texto) return false;
    var q = window.qrcode(0, 'M'); q.addData(texto); q.make();
    var n = q.getModuleCount(), m = lado / n;
    c.fillStyle = '#fff'; c.fillRect(x - 10, y - 10, lado + 20, lado + 20); c.fillStyle = color;
    for(var f = 0; f < n; f++) for(var k = 0; k < n; k++) if(q.isDark(f, k)) c.fillRect(Math.floor(x + k * m), Math.floor(y + f * m), Math.ceil(m), Math.ceil(m));
    return true;
  }

  function dibujar(canvas, d, datos){
    canvas.width = W; canvas.height = H;
    var c = canvas.getContext('2d');
    c.save(); d.fondo(c); c.restore();
    c.textBaseline = 'alphabetic';
    // Logo arriba al centro
    c.save(); c.font = '800 34px Inter, Arial, sans-serif'; var tl = c.measureText('Instituto Mara').width, lx = (W - (48 + 14 + tl)) / 2;
    c.translate(lx, 42); c.scale(.4, .4); c.strokeStyle = d.lc; c.lineWidth = 17; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(new Path2D(ISO)); c.restore();
    c.fillStyle = d.lc; c.font = '800 34px Inter, Arial, sans-serif'; c.textAlign = 'left'; c.fillText('Instituto Mara', lx + 62, 82);
    // Título (hasta 2 renglones, centrado sobre el panel)
    c.textAlign = 'center'; c.fillStyle = d.tc;
    var tw = d.tw || 900, s = d.ts || (d.f === 'gis' ? 112 : 96), lin;
    do { c.font = fuente(d.f, s); lin = partir(c, d.t, tw, 2); s -= 4; } while(lin.some(function(l){ return c.measureText(l).width > tw; }) && s > 50);
    s += 4; var alto = s * 1.06, centro = d.ilus ? 410 : 300, y0 = centro - (s + (lin.length - 1) * alto) / 2 + s * .78;
    c.save(); if(/^#(fff|F8FAFC|EDE9FE|FCD34D|FDE68A)/i.test(d.tc)){ c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 18; c.shadowOffsetY = 4; }
    lin.forEach(function(l, i){ c.fillText(l, W / 2, y0 + i * alto); }); c.restore();

    // Panel blanco con los datos del regalo
    var px = 70, py = 530, pw = W - 140, ph = 740;
    c.save(); c.shadowColor = 'rgba(15,10,40,.28)'; c.shadowBlur = 50; c.shadowOffsetY = 16; c.fillStyle = '#FFFFFF'; rr(c, px, py, pw, ph, 44); c.fill(); c.restore();
    c.fillStyle = d.ac; rr(c, px, py, pw, 14, 7); c.fill(); c.fillRect(px + 7, py + 7, pw - 14, 7);
    c.textAlign = 'left'; var x = px + 60, ancho = pw - 120, y = py + 72;
    c.fillStyle = d.ac; c.font = '800 23px Inter, Arial, sans-serif'; c.fillText('PARA', x, y);
    c.fillStyle = '#1F1535'; c.font = '700 52px Fraunces, Georgia, serif'; c.fillText(partir(c, datos.para || 'Ti', ancho, 1)[0], x, y + 56);
    y += 106;
    c.fillStyle = d.ac; c.font = '800 23px Inter, Arial, sans-serif'; c.fillText('TE REGALO', x, y);
    c.fillStyle = '#1F1535'; c.font = '700 44px Fraunces, Georgia, serif';
    var prog = partir(c, datos.programa || '', ancho, 2); prog.forEach(function(l, i){ c.fillText(l, x, y + 52 + i * 52); });
    y += 52 + (prog.length - 1) * 52;
    var by = py + ph - 205, tope = by - 26;  // by: donde empieza el bloque del código
    if(datos.mensaje){
      c.fillStyle = '#4B4366'; c.font = 'italic 500 29px Fraunces, Georgia, serif';
      var caben = Math.max(0, Math.min(3, Math.floor((tope - y - (datos.de ? 46 : 0) - 8) / 39))), msj = caben ? partir(c, '«' + datos.mensaje + '»', ancho, caben) : [];
      msj.forEach(function(l, i){ c.fillText(l, x, y + 52 + i * 39); }); y += 13 + msj.length * 39;
    }
    if(datos.de){ c.fillStyle = '#6B6280'; c.font = '600 27px Inter, Arial, sans-serif'; c.fillText(partir(c, 'Con cariño, ' + datos.de, ancho, 1)[0], x, Math.min(y + 50, tope)); }
    // Bloque del código + QR
    var ladoQr = 160, qx = px + pw - 60 - ladoQr;
    c.save(); c.setLineDash([12, 9]); c.strokeStyle = d.ac; c.lineWidth = 3; rr(c, x, by, qx - x - 40, 160, 22); c.stroke(); c.restore();
    c.fillStyle = '#6B6280'; c.font = '700 22px Inter, Arial, sans-serif'; c.fillText('TU CÓDIGO', x + 30, by + 42);
    c.fillStyle = '#1F1535'; var cod = datos.codigo || 'REGALO-••••••', sc = 44;
    do { c.font = '800 ' + sc + 'px ui-monospace, Menlo, Consolas, monospace'; sc -= 2; } while(c.measureText(cod).width > qx - x - 100 && sc > 24);
    c.fillText(cod, x + 30, by + 94);
    c.fillStyle = '#6B6280'; c.font = '500 21px Inter, Arial, sans-serif'; c.fillText('Actívalo en institutomara.com', x + 30, by + 132);
    if(!qr(c, datos.liga, qx, by, ladoQr, '#1F1535')){ c.fillStyle = '#F3F0FF'; rr(c, qx, by, ladoQr, ladoQr, 16); c.fill(); }
    // Pie
    c.textAlign = 'center'; c.fillStyle = d.lc; c.globalAlpha = .9; c.font = '600 22px Inter, Arial, sans-serif';
    c.fillText('Válido 12 meses · Código de un solo uso · 100 % en línea', W / 2, H - 38); c.globalAlpha = 1;
    return canvas;
  }

  var fuentesListas = null;
  function cargarFuentes(){
    if(fuentesListas) return fuentesListas;
    var lista = ['700 40px Fraunces', 'italic 600 40px Fraunces', 'italic 500 40px Fraunces', '700 40px Caveat', '800 40px Inter', '600 40px Inter', '500 40px Inter'];
    fuentesListas = !document.fonts ? Promise.resolve() : Promise.race([
      Promise.all(lista.map(function(f){ return document.fonts.load(f).catch(function(){}); })),
      new Promise(function(r){ setTimeout(r, 2500); })
    ]);
    return fuentesListas;
  }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]; }); }

  function textoWhats(datos){
    return '🎁 *¡' + (datos.para || '') + ', tienes un regalo!* ' + (datos.de ? datos.de + ' te regaló ' : 'Te regalaron ') + articulo(datos.cursoId || '') + ' *' + datos.programa + '* en Instituto Mara: 100 % en línea, a tu ritmo y con constancia al terminar.\n\n' +
      (datos.mensaje ? '💌 «' + datos.mensaje + '»\n\n' : '') + '🎟 Tu código: *' + datos.codigo + '* (válido 12 meses)\n👉 Actívalo aquí: ' + datos.liga;
  }
  function telWhats(t){ t = String(t || '').replace(/\D/g, ''); return t.length === 10 ? '52' + t : t; }

  var CSS = '.tr{display:grid;gap:14px;text-align:left}' +
    '.tr-oc{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}.tr-oc::-webkit-scrollbar{display:none}' +
    '.tr-oc button{flex:none;border:1.5px solid #E9E6F7;background:#fff;border-radius:999px;padding:8px 14px;font:inherit;font-size:14px;font-weight:600;color:#2E1065;cursor:pointer;white-space:nowrap}' +
    '.tr-oc button[aria-selected=true]{background:#6D28D9;border-color:#6D28D9;color:#fff}' +
    '.tr-mini{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}' +
    '.tr-mini button{border:2.5px solid transparent;border-radius:14px;padding:0;background:none;cursor:pointer;overflow:hidden;line-height:0;position:relative}' +
    '.tr-mini button[aria-pressed=true]{border-color:#6D28D9;box-shadow:0 0 0 3px #EDE9FE}' +
    '.tr-mini canvas{width:100%;height:auto;display:block}' +
    '.tr-mini span{position:absolute;left:0;right:0;bottom:0;background:rgba(17,12,40,.62);color:#fff;font-size:11.5px;font-weight:600;line-height:1.3;padding:4px 2px;text-align:center}' +
    '.tr-vista{width:100%;max-width:380px;height:auto;margin:0 auto;display:block;border-radius:18px;box-shadow:0 10px 30px rgba(46,16,101,.18)}' +
    '.tr-btns{display:grid;gap:10px}' +
    '.tr-btn{display:flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:999px;font:inherit;font-weight:700;font-size:15.5px;padding:13px 20px;cursor:pointer;text-decoration:none}' +
    '.tr-wa{background:#25D366;color:#fff}.tr-pri{background:#6D28D9;color:#fff}.tr-sec{background:#fff;color:#6D28D9;box-shadow:inset 0 0 0 2px #D9D6F7}' +
    '.tr-ayuda{color:#6B7280;font-size:13px;line-height:1.5;margin:0;text-align:center}' +
    '.tr-copiado{color:#059669;font-weight:600}';

  function montar(el, datos){
    if(!document.getElementById('tr-css')){ var st = document.createElement('style'); st.id = 'tr-css'; st.textContent = CSS; document.head.appendChild(st); }
    var mes = new Date().getMonth(), oc = mes === 11 ? 'navidad' : (mes === 4 ? 'maestro' : 'aprender'), elegido = null;
    try{ var g = localStorage.getItem('im-tarjeta'); if(g && DISENOS.some(function(d){ return d.id === g; })){ elegido = g; oc = g.split('-')[0]; } }catch(x){}
    var puedeArchivos = false;
    try{ puedeArchivos = !!(navigator.canShare && window.File && navigator.canShare({ files:[new File([new Blob(['x'], { type:'image/png' })], 'a.png', { type:'image/png' })] })); }catch(x){}
    var tel = telWhats(datos.tel);
    el.innerHTML = '<div class="tr">' +
      '<div class="tr-oc" role="tablist" aria-label="Ocasión">' + OCASIONES.map(function(o){ return '<button type="button" role="tab" data-oc="' + o.id + '">' + o.e + ' ' + esc(o.n) + '</button>'; }).join('') + '</div>' +
      '<div class="tr-mini" aria-label="Diseños"></div>' +
      '<canvas class="tr-vista" role="img" aria-label="Vista previa de la tarjeta de regalo"></canvas>' +
      '<div class="tr-btns">' +
        (puedeArchivos ? '<button type="button" class="tr-btn tr-wa" data-acc="compartir">📲 Enviar tarjeta (WhatsApp y más)</button>' : '') +
        '<a class="tr-btn ' + (puedeArchivos ? 'tr-sec' : 'tr-wa') + '" data-acc="whats" target="_blank" rel="noopener" href="https://wa.me/' + tel + '?text=' + encodeURIComponent(textoWhats(datos)) + '">💬 ' + (puedeArchivos ? 'Solo el mensaje por WhatsApp' : 'Enviar mensaje por WhatsApp') + '</a>' +
        '<button type="button" class="tr-btn ' + (puedeArchivos ? 'tr-sec' : 'tr-pri') + '" data-acc="descargar">⬇️ Descargar imagen</button>' +
        '<button type="button" class="tr-btn tr-sec" data-acc="copiar">📋 Copiar mensaje</button>' +
      '</div>' +
      '<p class="tr-ayuda" aria-live="polite">' + (puedeArchivos ? 'Con «Enviar tarjeta» eliges WhatsApp y la imagen se adjunta sola.' : 'Descarga la imagen y adjúntala en su chat junto con el mensaje.') + ' El código es de un solo uso: compártelo solo con ' + esc(datos.para || 'quien lo recibe') + '.</p>' +
    '</div>';
    var tabs = el.querySelectorAll('.tr-oc button'), mini = el.querySelector('.tr-mini'), vista = el.querySelector('.tr-vista'), ayuda = el.querySelector('.tr-ayuda');
    var lienzo = document.createElement('canvas');
    function diseno(id){ return DISENOS.filter(function(d){ return d.id === id; })[0]; }
    function pintarVista(){ dibujar(vista, diseno(elegido), datos); [].forEach.call(mini.querySelectorAll('button'), function(b){ b.setAttribute('aria-pressed', String(b.getAttribute('data-d') === elegido)); }); }
    function elegir(id){ elegido = id; try{ localStorage.setItem('im-tarjeta', id); }catch(x){} pintarVista(); }
    function ocasion(id){
      oc = id; [].forEach.call(tabs, function(t){ t.setAttribute('aria-selected', String(t.getAttribute('data-oc') === id)); });
      var ds = DISENOS.filter(function(d){ return d.oc === id; });
      if(!elegido || diseno(elegido).oc !== id) elegido = ds[0].id;
      mini.innerHTML = ds.map(function(d){ return '<button type="button" data-d="' + d.id + '" aria-label="Diseño ' + esc(d.n) + '"><canvas width="216" height="270"></canvas><span>' + esc(d.n) + '</span></button>'; }).join('');
      ds.forEach(function(d){ dibujar(lienzo, d, datos); mini.querySelector('[data-d="' + d.id + '"] canvas').getContext('2d').drawImage(lienzo, 0, 0, 216, 270); });
      elegir(elegido);
    }
    function blob(){ return new Promise(function(ok){ vista.toBlob(function(b){ ok(b); }, 'image/png'); }); }
    var nombre = 'tarjeta-regalo-' + String(datos.para || 'instituto-mara').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') + '.png';
    el.addEventListener('click', function(e){
      var t = e.target.closest('[data-oc]'); if(t){ ocasion(t.getAttribute('data-oc')); return; }
      var m = e.target.closest('[data-d]'); if(m){ elegir(m.getAttribute('data-d')); return; }
      var a = e.target.closest('[data-acc]'); if(!a) return;
      var acc = a.getAttribute('data-acc');
      if(acc === 'descargar'){
        blob().then(function(b){ var u = URL.createObjectURL(b), l = document.createElement('a'); l.href = u; l.download = nombre; document.body.appendChild(l); l.click(); l.remove(); setTimeout(function(){ URL.revokeObjectURL(u); }, 4000); });
      } else if(acc === 'compartir'){
        blob().then(function(b){ return navigator.share({ files:[new File([b], nombre, { type:'image/png' })], text:textoWhats(datos) }); }).catch(function(){});
      } else if(acc === 'copiar'){
        var txt = textoWhats(datos);
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function(){ ayuda.innerHTML = '<span class="tr-copiado">Mensaje copiado. Pégalo en su chat.</span>'; })
          .catch(function(){ window.prompt('Copia el mensaje:', txt); });
      }
    });
    vista.width = W; vista.height = H;
    cargarFuentes().then(function(){ ocasion(oc); });
  }

  window.TarjetaRegalo = { montar:montar, dibujar:dibujar, disenos:DISENOS, ocasiones:OCASIONES, cargarFuentes:cargarFuentes, textoWhats:textoWhats };
})();
