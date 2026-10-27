/* Píxel de Meta (Facebook e Instagram) — conjunto de datos «Instituto Mara · Sitio web»
   del portafolio Instituto Mara. Mide visitas, registros (Lead) y compras (Purchase)
   para optimizar los anuncios. No se envían datos de salud ni datos personales. */
(function(){
  var ID = '1305517585987606';
  if(window.fbq) return;
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', ID);
  fbq('track', 'PageView');
  /* Ayudante para el resto del sitio: nunca rompe la página si el píxel está bloqueado. */
  window.pixel = function(evento, datos){ try{ fbq('track', evento, datos || {}); }catch(e){} };
})();
