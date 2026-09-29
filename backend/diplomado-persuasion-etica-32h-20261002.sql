-- Diplomado en Técnicas de Persuasión y Comunicación Ética: ampliado a 32 horas reales (opción B).
BEGIN;
UPDATE cursos SET horas=32, descripcion='Aprende a convencer sin manipular: escuchar lo que la otra persona necesita, argumentar con datos, manejar objeciones, escribir mensajes claros y presentar con confianza. Con ejemplos de «así no / así sí», frases listas para usar en ventas, trabajo en equipo y atención a clientes, 9 laboratorios de simulación con casos mexicanos, un proyecto final y un cuaderno de práctica en PDF.' WHERE id='diplomado-persuasion-etica';
UPDATE cursos SET horas=45 WHERE id='r-comunicacion-persuasiva';
COMMIT;
