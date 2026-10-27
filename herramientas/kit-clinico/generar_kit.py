from reportlab.lib.pagesizes import letter, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

MORADO = HexColor("#6D28D9")
MORADO_CLARO = HexColor("#EDE9FE")
GRIS = HexColor("#5F6170")
TINTA = HexColor("#1F1D2B")
CAMPO = HexColor("#FBFAFE")
BORDE = HexColor("#C9BEDF")

TITULO_KIT = "Kit de formatos clínicos para tu consulta"
PIE = "Instituto Mara · institutomara.com · Elaborado por el equipo académico de Instituto Mara · Uso profesional"

st_txt = ParagraphStyle("t", fontName="Helvetica", fontSize=9.2, leading=12.4, textColor=TINTA)
st_txt_s = ParagraphStyle("ts", fontName="Helvetica", fontSize=8.2, leading=10.6, textColor=GRIS)

c = canvas.Canvas("kit/Kit-formatos-clinicos-Instituto-Mara.pdf", pagesize=letter)
c.setTitle("Kit de formatos clínicos · Instituto Mara")
c.setAuthor("Instituto Mara")
c.setSubject("Formatos editables para la práctica psicológica")

pagina = [0]
fid = [0]


def nid(p):
    fid[0] += 1
    return f"{p}_{fid[0]}"


def encabezado(seccion, w, h):
    pagina[0] += 1
    c.setFillColor(MORADO)
    c.rect(0, h - 54, w, 54, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, h - 24, "INSTITUTO MARA")
    c.setFont("Helvetica", 8.5)
    c.drawString(40, h - 38, TITULO_KIT)
    c.setFont("Helvetica-Bold", 13)
    c.drawRightString(w - 40, h - 32, seccion)
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 7.2)
    c.drawString(40, 24, PIE)
    c.drawRightString(w - 40, 24, f"{pagina[0]}")
    c.setStrokeColor(BORDE)
    c.setLineWidth(0.5)
    c.line(40, 36, w - 40, 36)


def subt(texto, x, y, w):
    c.setFillColor(MORADO_CLARO)
    c.rect(x, y - 4, w, 17, stroke=0, fill=1)
    c.setFillColor(MORADO)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(x + 6, y + 1, texto.upper())
    return y - 22


def campo(etiqueta, x, y, w, h=18, multi=False, nombre=None):
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 7.6)
    c.drawString(x, y, etiqueta)
    c.acroForm.textfield(
        name=nombre or nid("campo"), tooltip=etiqueta, x=x, y=y - h - 3, width=w, height=h,
        borderColor=BORDE, fillColor=CAMPO, textColor=TINTA, borderWidth=0.6,
        fontName="Helvetica", fontSize=0 if multi else 9,
        fieldFlags="multiline" if multi else "", forceBorder=True,
    )
    return y - h - 14


def fila(etiquetas_anchos, x, y, h=18):
    xx = x
    for et, an in etiquetas_anchos:
        campo(et, xx, y, an - 8, h)
        xx += an
    return y - h - 14


def casillas(pregunta, opciones, x, y):
    c.setFillColor(TINTA)
    c.setFont("Helvetica", 8.4)
    c.drawString(x, y, pregunta)
    xx = x + c.stringWidth(pregunta, "Helvetica", 8.4) + 10
    for op in opciones:
        c.acroForm.checkbox(name=nid("cas"), tooltip=f"{pregunta} {op}", x=xx, y=y - 2.5, size=10,
                            borderColor=BORDE, fillColor=CAMPO, buttonStyle="check", borderWidth=0.6, forceBorder=True)
        c.setFillColor(TINTA)
        c.drawString(xx + 13, y, op)
        xx += 13 + c.stringWidth(op, "Helvetica", 8.4) + 14
    return y - 16


def parrafo(texto, x, y, w, estilo=st_txt):
    p = Paragraph(texto, estilo)
    _, ph = p.wrap(w, 1000)
    p.drawOn(c, x, y - ph)
    return y - ph - 6


# ---------------- Portada ----------------
W, H = letter
pagina[0] += 1
c.setFillColor(MORADO)
c.rect(0, 0, W, H, stroke=0, fill=1)
c.setFillColor(HexColor("#7C3AED"))
c.circle(W - 60, H - 40, 170, stroke=0, fill=1)
c.setFillColor(HexColor("#5B21B6"))
c.circle(70, 120, 120, stroke=0, fill=1)
c.setFillColor(white)
c.setFont("Helvetica-Bold", 13)
c.drawString(56, H - 70, "INSTITUTO MARA")
c.setFont("Helvetica", 10)
c.drawString(56, H - 86, "Educación en línea con constancia verificable")
c.setFont("Helvetica-Bold", 34)
c.drawString(56, H - 230, "Kit de formatos")
c.drawString(56, H - 270, "clínicos para tu consulta")
c.setFont("Helvetica", 13)
c.drawString(56, H - 302, "4 formatos editables para psicólogos y estudiantes de psicología")

items = [
    ("1", "Entrevista clínica inicial", "Datos, motivo de consulta, antecedentes y evaluación de riesgo."),
    ("2", "Registro de pensamientos (TCC)", "Siete columnas para trabajar con tu paciente entre sesiones."),
    ("3", "Consentimiento informado", "Alcance, confidencialidad y sus límites, honorarios y firmas."),
    ("4", "Plan de tratamiento", "Objetivos medibles, intervenciones, indicadores y revisión."),
]
y = H - 370
for n, t, d in items:
    c.setFillColor(white)
    c.circle(70, y + 4, 13, stroke=0, fill=1)
    c.setFillColor(MORADO)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(70, y, n)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 12.5)
    c.drawString(96, y + 4, t)
    c.setFont("Helvetica", 9.5)
    c.drawString(96, y - 10, d)
    y -= 46

c.setFillColor(HexColor("#2E1065"))
c.roundRect(56, 70, W - 112, 100, 8, stroke=0, fill=1)
c.setFillColor(white)
c.setFont("Helvetica-Bold", 10)
c.drawString(72, 150, "Cómo usarlo")
st_portada = ParagraphStyle("p", fontName="Helvetica", fontSize=8.8, leading=11.8, textColor=white)
parrafo("Llena los campos en tu computadora (Adobe Acrobat Reader, Vista Previa de Mac o el navegador) y guarda una copia "
        "por paciente, o imprímelo. Son formatos de apoyo: adáptalos a tu enfoque, a tu institución y a la normativa que "
        "te aplique. No sustituyen tu criterio profesional ni la supervisión clínica.", 72, 142, W - 144, st_portada)
c.showPage()

# ---------------- 1. Entrevista inicial (2 páginas) ----------------
encabezado("1 · Entrevista clínica inicial", W, H)
x0, ancho = 40, W - 80
y = H - 78
y = fila([("Nombre del paciente", 300), ("Fecha", 120), ("No. de expediente", 112)], x0, y)
y = fila([("Edad", 70), ("Sexo", 80), ("Estado civil", 110), ("Escolaridad", 130), ("Ocupación", 142)], x0, y)
y = fila([("Teléfono", 160), ("Correo", 220), ("Modalidad (presencial / en línea)", 152)], x0, y)
y = fila([("Contacto de emergencia (nombre y parentesco)", 330), ("Teléfono de emergencia", 202)], x0, y)
y = fila([("Referido por", 266), ("¿Tratamiento psicológico o psiquiátrico previo? ¿Cuándo y con quién?", 266)], x0, y)
y = subt("Motivo de consulta", x0, y, ancho)
y = campo("En palabras del paciente: ¿qué lo trae hoy?", x0, y, ancho, 46, True)
y = campo("Inicio, duración y evolución del problema. ¿Qué lo empeora y qué lo alivia?", x0, y, ancho, 46, True)
y = campo("Áreas afectadas (trabajo o escuela, pareja, familia, sueño, alimentación, vida social)", x0, y, ancho, 36, True)
y = subt("Antecedentes", x0, y, ancho)
y = campo("Personales (desarrollo, eventos importantes, pérdidas, historia escolar y laboral)", x0, y, ancho, 40, True)
y = campo("Familiares (estructura familiar, relaciones, antecedentes de salud mental en la familia)", x0, y, ancho, 40, True)
y = fila([("Enfermedades y medicamentos actuales", 266), ("Consumo de alcohol, tabaco u otras sustancias", 266)], x0, y, 30)
c.showPage()

encabezado("1 · Entrevista clínica inicial", W, H)
y = H - 78
y = subt("Evaluación de riesgo (obligatoria en la primera sesión)", x0, y, ancho)
op = ["No", "Sí", "No se exploró"]
y = casillas("Ideas de muerte o de quitarse la vida en el último mes:", op, x0, y)
y = casillas("Plan, método o preparativos:", op, x0, y)
y = casillas("Intentos previos:", op, x0, y)
y = casillas("Autolesiones sin intención suicida:", op, x0, y)
y = casillas("Riesgo de dañar a otras personas:", op, x0, y)
y = casillas("Situación de violencia actual (en casa, pareja, trabajo):", op, x0, y)
y = casillas("Nivel de riesgo estimado:", ["Bajo", "Moderado", "Alto"], x0, y)
y = campo("Acciones tomadas (plan de seguridad, red de apoyo avisada, referencia a urgencias o psiquiatría)", x0, y - 4, ancho, 40, True)
y = parrafo("<b>Si hay riesgo inminente</b>, no termines la sesión sin un plan de seguridad y sin activar la red de apoyo o los "
            "servicios de urgencia (911). En México, la Línea de la Vida atiende las 24 horas: 800 911 2000.", x0, y, ancho, st_txt_s)
y = subt("Examen mental breve", x0, y - 12, ancho)
y = fila([("Apariencia y conducta", 178), ("Estado de ánimo y afecto", 178), ("Orientación y atención", 176)], x0, y)
y = fila([("Curso y contenido del pensamiento", 178), ("Percepción", 178), ("Juicio e introspección", 176)], x0, y)
y = subt("Recursos y expectativas", x0, y, ancho)
y = fila([("Fortalezas y red de apoyo", 266), ("¿Qué espera lograr con la terapia?", 266)], x0, y, 34)
y = subt("Cierre del profesional", x0, y, ancho)
y = campo("Impresión clínica inicial e hipótesis de trabajo (sin etiquetar antes de evaluar a fondo)", x0, y, ancho, 44, True)
y = campo("Instrumentos a aplicar (p. ej., PHQ-9, GAD-7, otros) y plan para las siguientes sesiones", x0, y, ancho, 38, True)
y = fila([("Nombre del psicólogo(a)", 266), ("Cédula profesional", 140), ("Firma", 126)], x0, y)
c.showPage()

# ---------------- 2. Registro de pensamientos (horizontal) ----------------
c.setPageSize(landscape(letter))
LW, LH = landscape(letter)
encabezado("2 · Registro de pensamientos (TCC)", LW, LH)
y = LH - 74
y = fila([("Nombre", 330), ("Semana del", 180), ("Objetivo de la semana", 202)], 40, y)
parrafo("<b>Cómo se llena:</b> cuando notes un cambio fuerte en tu estado de ánimo, anota la situación y lo que pasó por tu mente. "
        "Califica la intensidad de 0 a 100. Después busca la evidencia y escribe un pensamiento más equilibrado.",
        40, y + 2, LW - 80, st_txt_s)
cols = [("Situación", "¿Dónde, cuándo, con quién?"), ("Emoción", "¿Qué sentí? (0-100)"),
        ("Pensamiento automático", "¿Qué pasó por mi mente?"), ("Evidencia a favor", "Hechos que lo apoyan"),
        ("Evidencia en contra", "Hechos que no encajan"), ("Pensamiento alternativo", "Más equilibrado (0-100 creo)"),
        ("Resultado", "Emoción ahora (0-100)")]
tw = LW - 80
cw = tw / len(cols)
top = y - 30
c.setFillColor(MORADO)
c.rect(40, top - 30, tw, 30, stroke=0, fill=1)
for i, (t, s) in enumerate(cols):
    cx = 40 + i * cw
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8.4)
    c.drawString(cx + 5, top - 12, t)
    c.setFont("Helvetica", 7)
    c.drawString(cx + 5, top - 24, s)
filas = 5
rh = (top - 30 - 50) / filas
for r in range(filas):
    for i in range(len(cols)):
        cx = 40 + i * cw
        ry = top - 30 - (r + 1) * rh
        c.acroForm.textfield(name=nid("rp"), tooltip=f"{cols[i][0]} fila {r+1}", x=cx + 1, y=ry + 1, width=cw - 2,
                             height=rh - 2, borderColor=BORDE, fillColor=CAMPO, textColor=TINTA, borderWidth=0.6,
                             fontName="Helvetica", fontSize=0, fieldFlags="multiline", forceBorder=True)
c.showPage()
c.setPageSize(letter)

# ---------------- 3. Consentimiento informado (2 páginas) ----------------
encabezado("3 · Consentimiento informado", W, H)
y = H - 78
y = fila([("Nombre del consultorio o profesional", 330), ("Lugar y fecha", 202)], x0, y)
textos = [
    ("1. El servicio.", "Recibiré atención psicológica (evaluación y psicoterapia) con el enfoque que el profesional me explicó. "
     "La duración de cada sesión, su frecuencia y la duración aproximada del proceso se acuerdan al inicio y se revisan a lo largo del tratamiento."),
    ("2. Beneficios y molestias.", "La psicoterapia suele ayudar, pero no se pueden garantizar resultados. Al hablar de temas difíciles puedo "
     "sentir incomodidad pasajera. Puedo preguntar sobre mi tratamiento cuando quiera y terminarlo en cualquier momento."),
    ("3. Confidencialidad.", "Lo que comparta en sesión es confidencial. <b>Sus límites</b> son: riesgo grave para mi vida o la de otras "
     "personas; sospecha de maltrato o abuso a menores de edad, personas adultas mayores o con discapacidad; una orden de autoridad "
     "competente; y la supervisión clínica, en la que el caso se comenta sin datos que me identifiquen."),
    ("4. Registros.", "El profesional lleva notas y un expediente de mi atención, que guarda de forma segura. "
     "Mis datos personales se tratan conforme a su aviso de privacidad y a la legislación de protección de datos aplicable."),
    ("5. Sesiones en línea.", "Si son en línea, me conectaré desde un lugar privado. Ninguna de las partes grabará la sesión sin "
     "autorización por escrito de la otra. Si se corta la conexión, acordamos cómo continuar."),
    ("6. Honorarios y cancelaciones.", "Los acuerdos de pago y cancelación se anotan abajo."),
    ("7. Urgencias.", "El consultorio no es un servicio de urgencias. En una crisis llamaré al 911 o a la Línea de la Vida (800 911 2000) y avisaré al profesional."),
]
for t, d in textos:
    y = parrafo(f"<b>{t}</b> {d}", x0, y, ancho)
y = subt("Acuerdos", x0, y - 14, ancho)
y = fila([("Enfoque o modalidad de tratamiento", 266), ("Frecuencia y duración de cada sesión", 266)], x0, y)
y = fila([("Honorarios por sesión", 160), ("Forma de pago", 170), ("Aviso para cancelar sin costo (horas)", 202)], x0, y)
c.showPage()

encabezado("3 · Consentimiento informado", W, H)
y = H - 78
y = campo("Otros acuerdos (p. ej., contacto entre sesiones, participación de familiares, tareas entre sesiones)", x0, y, ancho, 50, True)
y = subt("Declaración", x0, y, ancho)
y = parrafo("Leí este documento, me explicaron su contenido, resolví mis dudas y acepto de forma libre e informada recibir la atención "
            "psicológica descrita. Sé que puedo retirar este consentimiento cuando lo decida.", x0, y, ancho)
y = fila([("Nombre del paciente", 266), ("Firma", 140), ("Fecha", 126)], x0, y - 4, 26)
y = subt("Si el paciente es menor de edad o requiere representante", x0, y, ancho)
y = fila([("Nombre del padre, madre o tutor", 266), ("Parentesco", 140), ("Firma", 126)], x0, y, 26)
y = casillas("El menor fue informado según su edad y da su asentimiento:", ["Sí", "No"], x0, y)
y = subt("Profesional", x0, y - 4, ancho)
y = fila([("Nombre del psicólogo(a)", 266), ("Cédula profesional", 140), ("Firma", 126)], x0, y, 26)
y = parrafo("<b>Nota para el profesional:</b> este formato es una base. Ajústalo al Código Ético de tu gremio, a tu aviso de privacidad, "
            "a la normativa del expediente clínico que aplique a tu servicio (por ejemplo, si trabajas en un establecimiento de salud) "
            "y a las reglas de tu institución. Si tienes dudas legales, consúltalo con un abogado.", x0, y - 6, ancho, st_txt_s)
c.showPage()

# ---------------- 4. Plan de tratamiento ----------------
encabezado("4 · Plan de tratamiento", W, H)
y = H - 78
y = fila([("Paciente", 266), ("Fecha de elaboración", 140), ("Fecha de revisión", 126)], x0, y)
y = campo("Formulación breve del caso (problema principal, factores que lo mantienen, fortalezas)", x0, y, ancho, 46, True)
y = subt("Objetivos", x0, y, ancho)
parrafo("Escribe objetivos específicos y medibles. Ejemplo: «Reducir el puntaje del GAD-7 de 15 a menos de 10 en 8 semanas» "
        "o «Volver a salir con amigos al menos una vez por semana».", x0, y + 2, ancho, st_txt_s)
y -= 24
hdr = [("Objetivo", 190), ("Intervenciones", 150), ("Indicador y meta", 110), ("Plazo", 82)]
c.setFillColor(MORADO)
c.rect(x0, y - 16, ancho, 18, stroke=0, fill=1)
xx = x0
for t, an in hdr:
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8.4)
    c.drawString(xx + 5, y - 10, t)
    xx += an
y -= 16
for r in range(4):
    xx = x0
    for t, an in hdr:
        c.acroForm.textfield(name=nid("pt"), tooltip=f"{t} {r+1}", x=xx + 1, y=y - 44, width=an - 2, height=42,
                             borderColor=BORDE, fillColor=CAMPO, textColor=TINTA, borderWidth=0.6, fontName="Helvetica",
                             fontSize=0, fieldFlags="multiline", forceBorder=True)
        xx += an
    y -= 44
y -= 14
y = fila([("Frecuencia de sesiones", 178), ("Número estimado de sesiones", 178), ("Instrumentos de seguimiento", 176)], x0, y)
y = campo("Tareas entre sesiones y participación de la red de apoyo", x0, y, ancho, 36, True)
y = campo("Criterios de alta y prevención de recaídas", x0, y, ancho, 36, True)
y = fila([("Referencias o interconsultas (psiquiatría, medicina, otros)", 532)], x0, y)
c.showPage()

# ---------------- Cierre ----------------
encabezado("Sigue aprendiendo", W, H)
y = H - 100
c.setFillColor(TINTA)
c.setFont("Helvetica-Bold", 20)
c.drawString(x0, y, "Lleva estas herramientas al siguiente nivel")
y = parrafo("Estos formatos son el punto de partida. En Instituto Mara aprendes a usarlos con casos prácticos, a tu ritmo, "
            "desde el celular y con constancia con folio y QR verificable.", x0, y - 12, ancho)
prog = [
    ("Diplomado en Terapia Cognitivo-Conductual", "33 h · Fundamentos y técnicas, con registro de pensamientos y casos.", "$2,490", "$996"),
    ("Diplomado en Terapias Contextuales: ACT, DBT y Activación Conductual", "32 h · Herramientas de tercera generación.", "$2,490", "$996"),
    ("Diplomado en Evaluación Psicológica y Formulación de Casos", "30 h · Entrevista, instrumentos y formulación clínica.", "$1,790", "$716"),
    ("Primeros Auxilios Psicológicos", "5 h · Cómo intervenir en una crisis y armar un plan de seguridad.", "$690", "$276"),
    ("IA para Psicólogos y Consultorios de Salud Mental", "8 h · Notas, materiales y administración, cuidando la confidencialidad.", "$590", "$236"),
]
y -= 4
c.setFillColor(MORADO)
c.roundRect(x0, y - 74, ancho, 74, 10, stroke=0, fill=1)
c.setFillColor(white)
c.setFont("Helvetica-Bold", 17)
c.drawString(x0 + 18, y - 28, "Oferta para quien descargó el kit: 60 % de descuento")
c.setFont("Helvetica", 10.5)
c.drawString(x0 + 18, y - 47, "Todos los programas clínicos por menos de $1,000 con el cupón KITCLINICO.")
c.setFont("Helvetica-Bold", 10.5)
c.drawString(x0 + 18, y - 63, "Vigente al 30 de noviembre de 2026 · Inscríbete en institutomara.com  →")
c.linkURL("https://institutomara.com/plataforma/index.html?cupon=KITCLINICO", (x0, y - 74, x0 + ancho, y), relative=0)
y -= 88
for t, d, antes, ahora in prog:
    c.setFillColor(MORADO_CLARO)
    c.roundRect(x0, y - 44, ancho, 40, 6, stroke=0, fill=1)
    c.setFillColor(MORADO)
    c.setFont("Helvetica-Bold", 10.2)
    c.drawString(x0 + 12, y - 19, t)
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 8.4)
    c.drawString(x0 + 12, y - 33, d)
    c.setFont("Helvetica", 9)
    wa = c.stringWidth(antes, "Helvetica", 9)
    xa = x0 + ancho - 74 - wa
    c.drawString(xa, y - 20, antes)
    c.setStrokeColor(GRIS); c.setLineWidth(0.8)
    c.line(xa - 1, y - 17, xa + wa + 1, y - 17)
    c.setFillColor(MORADO)
    c.setFont("Helvetica-Bold", 15)
    c.drawRightString(x0 + ancho - 12, y - 24, ahora)
    y -= 48
y -= 4
parrafo("Precios en pesos mexicanos, IVA incluido. Pago único con Mercado Pago, acceso inmediato y constancia con folio y QR al terminar. "
        "El cupón aplica a un programa por compra; puedes usarlo en cada programa que elijas.", x0, y, ancho, st_txt_s)
c.showPage()

c.save()
print("ok", pagina[0], "páginas")
