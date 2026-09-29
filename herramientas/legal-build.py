# Genera las páginas legales del sitio (aviso de privacidad, términos y reembolsos).
import os
D=os.path.join(os.path.dirname(__file__),'..','sitio-web','legal')
FECHA='29 de septiembre de 2026'
BASE='''<!DOCTYPE html>
<html lang="es-MX"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titulo} · Instituto Mara</title><meta name="description" content="{desc}">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
:root{{--morado:#6D28D9;--tinta:#2E1065;--lavanda:#EDE9FE;--texto:#1F2937;--gris:#6B7280;--linea:#E9E6F7}}
*{{box-sizing:border-box}}body{{margin:0;font-family:Inter,-apple-system,Segoe UI,Arial,sans-serif;color:var(--texto);background:#fff;font-size:17px;line-height:1.7}}
header{{background:var(--tinta);color:#fff;padding:18px 16px}}header a{{color:#fff;text-decoration:none;font-weight:800}}
main{{max-width:820px;margin:0 auto;padding:32px 16px 64px}}h1{{color:var(--tinta);font-size:1.9rem;line-height:1.25;margin:0 0 6px}}
h2{{color:var(--morado);font-size:1.15rem;margin:32px 0 8px}}.fecha{{color:var(--gris);font-size:.9rem;margin-bottom:24px}}
.caja{{background:var(--lavanda);border-radius:14px;padding:16px 18px;margin:18px 0}}ul{{padding-left:22px}}li{{margin:4px 0}}
a{{color:var(--morado)}}nav.legal{{margin-top:40px;padding-top:16px;border-top:1px solid var(--linea);font-size:.95rem}}nav.legal a{{margin-right:16px}}
table{{border-collapse:collapse;width:100%;font-size:.95rem}}td,th{{border:1px solid var(--linea);padding:8px;text-align:left;vertical-align:top}}
</style></head><body>
<header><a href="../index.html">← Instituto Mara</a></header>
<main><h1>{titulo}</h1><div class="fecha">Última actualización: {fecha}</div>
{cuerpo}
<nav class="legal"><a href="privacidad.html">Aviso de privacidad</a><a href="terminos.html">Términos y condiciones</a><a href="reembolsos.html">Política de reembolsos</a><a href="../index.html">Volver al sitio</a></nav>
</main></body></html>'''

PRIV='''<p>Este aviso explica qué datos personales recabamos en Instituto Mara, para qué los usamos y cómo puedes ejercer tus derechos, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (DOF, 20 de marzo de 2025).</p>
<h2>1. Quién es responsable de tus datos</h2>
<p><strong>Héctor Ezquerra</strong>, persona física que opera la marca <strong>Instituto Mara</strong>, con domicilio en León, Guanajuato, México. Contacto para temas de privacidad: <a href="mailto:contacto@institutomara.com">contacto@institutomara.com</a> · WhatsApp <a href="https://wa.me/528120282120">81 2028 2120</a>.</p>
<h2>2. Qué datos recabamos</h2>
<ul>
<li><strong>Identificación y contacto:</strong> nombre, nombre para tu constancia, correo electrónico y, si nos lo das, número de WhatsApp.</li>
<li><strong>Cuenta:</strong> contraseña (se guarda cifrada; nadie en Instituto Mara puede verla) o, si entras con Google, tu nombre, correo y foto de perfil de Google.</li>
<li><strong>Estudio:</strong> cursos inscritos, avance, resultados de evaluaciones, respuestas a ejercicios y reflexiones que escribas en la plataforma, constancias emitidas y fecha de último acceso.</li>
<li><strong>Pago:</strong> monto, curso, fecha, estado y número de operación. <strong>No recibimos ni guardamos datos de tu tarjeta ni de tu cuenta bancaria</strong>: los captura y procesa directamente Mercado Pago.</li>
<li><strong>Facturación</strong> (solo si pides factura): RFC, nombre o razón social, régimen fiscal, código postal y uso del CFDI.</li>
</ul>
<p><strong>Datos sensibles.</strong> No te pedimos datos sensibles (salud, creencias, origen, preferencias, etc.). Algunos cursos incluyen reflexiones escritas; te pedimos no escribir en ellas datos sensibles tuyos ni de otras personas. Los casos que se usan en los cursos son ficticios.</p>
<h2>3. Para qué usamos tus datos</h2>
<p><strong>Finalidades necesarias</strong> (sin ellas no podemos darte el servicio):</p>
<ul><li>Crear y administrar tu cuenta y darte acceso a los cursos que compraste.</li><li>Registrar tu avance y calificaciones y emitir tu constancia con folio y código QR verificable.</li><li>Procesar pagos, cupones, reembolsos y facturas.</li><li>Enviarte avisos sobre tu cuenta, tus pagos y tu curso (confirmación de correo, recuperación de contraseña, recordatorios de avance).</li><li>Atender tus dudas y solicitudes.</li></ul>
<p><strong>Finalidades adicionales</strong> (puedes negarte sin perder el servicio):</p>
<ul><li>Enviarte información de cursos nuevos, promociones y cupones.</li><li>Pedirte tu opinión o reseña de un curso y publicarla con tu nombre de pila, solo si tú la escribes y aceptas publicarla.</li><li>Elaborar estadísticas generales sin identificarte, para mejorar los cursos.</li></ul>
<p>Para negarte a las finalidades adicionales escribe a <a href="mailto:contacto@institutomara.com">contacto@institutomara.com</a> con el asunto «No publicidad». Cada correo promocional incluye además la opción de darte de baja.</p>
<h2>4. Con quién compartimos tus datos</h2>
<p>Usamos proveedores que tratan tus datos solo por encargo nuestro y para prestar el servicio:</p>
<table><tr><th>Proveedor</th><th>Para qué</th></tr>
<tr><td>Supabase (servidores en la nube, EE. UU.)</td><td>Guardar tu cuenta, avance, pagos y constancias</td></tr>
<tr><td>Mercado Pago</td><td>Procesar tu pago</td></tr>
<tr><td>Brevo y Zoho</td><td>Enviar y recibir correos</td></tr>
<tr><td>Google</td><td>Inicio de sesión con Google, si lo eliges</td></tr>
<tr><td>GitHub Pages y Cloudflare</td><td>Publicar el sitio y la plataforma</td></tr></table>
<p>No vendemos ni rentamos tus datos. Solo los compartiríamos con autoridades cuando una ley o una orden de autoridad competente lo exija.</p>
<h2>5. Tus derechos ARCO y cómo ejercerlos</h2>
<p>Puedes <strong>acceder</strong> a tus datos, <strong>rectificarlos</strong>, <strong>cancelarlos</strong> u <strong>oponerte</strong> a su uso, así como revocar tu consentimiento. Envía un correo a <a href="mailto:contacto@institutomara.com">contacto@institutomara.com</a> con: tu nombre, el correo de tu cuenta, qué derecho quieres ejercer y sobre qué datos, y una forma de acreditar tu identidad (por ejemplo, escribir desde el correo registrado). Te respondemos en un máximo de 20 días hábiles y, si procede, lo aplicamos dentro de los 15 días hábiles siguientes.</p>
<p>Cancelar tu cuenta borra tu acceso y tus datos de estudio; conservamos solo lo que la ley nos obliga (por ejemplo, datos fiscales de pagos facturados) y el folio de las constancias ya emitidas para que sigan siendo verificables.</p>
<h2>6. Cookies y almacenamiento en tu navegador</h2>
<p>La plataforma guarda en tu navegador tu sesión y preferencias (almacenamiento local) para que no tengas que entrar cada vez. No usamos cookies de publicidad de terceros. Puedes borrar estos datos desde la configuración de tu navegador; tendrás que volver a iniciar sesión.</p>
<h2>7. Seguridad</h2>
<p>Usamos conexiones cifradas (https), contraseñas cifradas, acceso restringido a la información y el cobro se realiza en la plataforma segura de Mercado Pago.</p>
<h2>8. Cambios a este aviso</h2>
<p>Publicaremos cualquier cambio en esta misma página, con su fecha de actualización, y te avisaremos por correo si el cambio es importante.</p>
<div class="caja">Si consideras que tu derecho a la protección de datos fue vulnerado, puedes acudir a la autoridad competente en la materia, que conforme a la ley vigente es la Secretaría Anticorrupción y Buen Gobierno.</div>'''

TERM='''<p>Al crear una cuenta o inscribirte a un curso de <strong>Instituto Mara</strong> aceptas estos términos. Instituto Mara es operado por Héctor Ezquerra, persona física, con domicilio en León, Guanajuato, México. Contacto: <a href="mailto:contacto@institutomara.com">contacto@institutomara.com</a> · WhatsApp 81 2028 2120.</p>
<h2>1. Qué ofrecemos</h2>
<p>Cursos, diplomados y rutas de capacitación <strong>libres</strong>, 100% en línea, con lecciones, ejercicios interactivos, evaluaciones y una <strong>constancia de Instituto Mara</strong> con folio y código QR al terminar.</p>
<div class="caja"><strong>Validez.</strong> Son cursos libres de formación para el trabajo. <strong>No cuentan con Reconocimiento de Validez Oficial de Estudios (RVOE) de la SEP</strong> ni con registro ante el CONOCER. La constancia acredita la capacitación y las horas cursadas; no es un certificado, título ni grado académico. Los diplomados de psicología y salud no habilitan para ejercer la psicoterapia ni para diagnosticar; los de temas legales, laborales o fiscales no sustituyen la asesoría de un profesional.</div>
<h2>2. Tu cuenta</h2>
<ul><li>Debes dar datos verdaderos y ser mayor de edad, o inscribirte con autorización de tu madre, padre o tutor.</li><li>Tu cuenta es personal: no la compartas ni revendas el acceso. Podemos suspender cuentas usadas por varias personas.</li><li>Cuida tu contraseña; eres responsable de lo que se haga con tu cuenta.</li></ul>
<h2>3. Precios, pagos y facturas</h2>
<ul><li>Los precios se muestran en pesos mexicanos e incluyen impuestos. El precio que aplica es el que aparece al momento de pagar.</li><li>El pago se procesa con Mercado Pago (tarjeta, meses sin intereses según tu banco, SPEI o efectivo en tiendas). Con tarjeta o SPEI el acceso se abre el mismo día; con efectivo, cuando la tienda reporta el pago, normalmente en 24 horas.</li><li>Si necesitas factura, solicítala con tu constancia de situación fiscal dentro del mismo mes del pago.</li><li>Los cupones tienen las condiciones que se indiquen en cada uno (vigencia, cursos y usos).</li></ul>
<h2>4. Acceso</h2>
<p>Tienes acceso a cada curso durante <strong>12 meses</strong> a partir de tu inscripción. Podemos actualizar y mejorar el contenido; conservarás el avance que ya tengas.</p>
<h2>5. Constancias</h2>
<p>La constancia se emite al completar todas las lecciones y aprobar las evaluaciones requeridas. Cualquier persona puede verificarla en <a href="https://institutomara.com/verificar.html">institutomara.com/verificar.html</a> con su folio o código QR. Emitirla con datos falsos o alterarla es motivo de cancelación.</p>
<h2>6. Propiedad intelectual</h2>
<p>El contenido de los cursos (textos, ejercicios, plantillas, imágenes y cuadernos) es de Instituto Mara o se usa con permiso. Puedes usar las plantillas en tu trabajo, pero no copiar, revender ni publicar los cursos.</p>
<h2>7. Uso aceptable</h2>
<p>No uses la plataforma para molestar a otras personas, subir contenido ilegal, intentar vulnerar su seguridad ni automatizar el acceso. Podemos suspender cuentas que lo hagan.</p>
<h2>8. Reembolsos</h2>
<p>Consulta la <a href="reembolsos.html">Política de reembolsos</a>.</p>
<h2>9. Responsabilidad</h2>
<p>Hacemos nuestro mejor esfuerzo para que la información sea correcta y esté actualizada, pero las leyes, normas y tasas cambian: verifica siempre la versión vigente en las fuentes oficiales antes de aplicarla. No garantizamos resultados específicos (empleo, ventas, aprobación de trámites). La plataforma puede tener interrupciones breves por mantenimiento.</p>
<h2>10. Cambios, dudas y quejas</h2>
<p>Publicaremos los cambios a estos términos en esta página. Para cualquier duda o queja escríbenos; buscaremos resolverla en un máximo de 5 días hábiles. También puedes acudir a la Procuraduría Federal del Consumidor (Profeco). Estos términos se rigen por las leyes de México.</p>'''

REEM='''<p>Queremos que el curso te sirva. Si no es para ti, te devolvemos tu dinero en estos casos:</p>
<div class="caja"><strong>Garantía de 7 días.</strong> Si dentro de los primeros <strong>7 días naturales</strong> desde tu pago y <strong>antes de completar el segundo módulo</strong> del curso decides que no es para ti, te devolvemos el <strong>100% de tu pago</strong>. No te pediremos explicaciones.</div>
<h2>Cómo pedirlo</h2>
<p>Escríbenos por WhatsApp al <a href="https://wa.me/528120282120">81 2028 2120</a> o a <a href="mailto:contacto@institutomara.com">contacto@institutomara.com</a> desde el correo de tu cuenta, con el nombre del curso. Al aprobar el reembolso se retira tu acceso a ese curso.</p>
<h2>Cómo y cuándo recibes tu dinero</h2>
<ul><li>Se devuelve por el mismo medio de pago, a través de Mercado Pago.</li><li>Lo solicitamos dentro de los 5 días hábiles siguientes a tu petición. El tiempo en que se refleja depende de tu banco (en tarjeta suele tardar de 5 a 10 días hábiles). Los pagos en efectivo se devuelven a una cuenta de Mercado Pago o por transferencia a la cuenta que nos indiques a tu nombre.</li></ul>
<h2>Rutas y paquetes</h2>
<p>La garantía aplica igual: dentro de los 7 días y sin haber completado el segundo módulo de ninguno de los cursos incluidos.</p>
<h2>Casos que no aplican</h2>
<ul><li>Cursos obtenidos con un cupón del 100%.</li><li>Cuando ya pasaron los 7 días o ya completaste el segundo módulo, salvo que el curso tenga una falla que no podamos corregir; en ese caso te devolvemos tu dinero o te damos otro curso, como prefieras.</li><li>Cuentas suspendidas por compartir el acceso o por mal uso.</li></ul>
<h2>Cobros duplicados o errores</h2>
<p>Si se te cobró dos veces o un monto equivocado, te devolvemos la diferencia completa, sin importar el plazo.</p>'''

for f,t,d,c in [('privacidad.html','Aviso de privacidad','Aviso de privacidad integral de Instituto Mara.',PRIV),('terminos.html','Términos y condiciones','Términos y condiciones de uso de Instituto Mara.',TERM),('reembolsos.html','Política de reembolsos','Política de reembolsos de Instituto Mara.',REEM)]:
    open(os.path.join(D,f),'w').write(BASE.format(titulo=t,desc=d,fecha=FECHA,cuerpo=c))
print('ok')
