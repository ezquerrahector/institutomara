-- Diplomado en Marketing Digital y Redes Sociales para Negocios: ampliado a 30 horas reales (opción B).
BEGIN;
UPDATE cursos SET horas=30, descripcion='Arma la estrategia digital de tu negocio paso a paso: cliente ideal, WhatsApp Business y perfil de Google, contenido para redes, anuncios pagados y medición en hoja de cálculo. Incluye 20 casos de negocios mexicanos con decisiones guiadas, 4 laboratorios de simulación y un proyecto final en el que armas el plan de marketing digital de 90 días de un negocio real. Es práctico y con ejemplos mexicanos; no promete ventas garantizadas: te enseña a probar, medir y decidir con datos.' WHERE id='d-marketing-digital';
UPDATE cursos SET horas=73 WHERE id='r-emprende';
UPDATE cursos SET horas=55 WHERE id='r-vende';
COMMIT;
