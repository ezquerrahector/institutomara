-- Diplomado en Liderazgo para Mandos Medios: ampliado a 30 horas reales (opción B).
BEGIN;
UPDATE cursos SET horas=30, descripcion='Para supervisores, jefes de turno y coordinadores que acaban de subir de puesto: cómo dar instrucciones claras, retroalimentar, delegar, medir a tu equipo en Excel, manejar conflictos y cumplir tu papel en la NOM-035. Incluye 20 casos de fábricas, tiendas, hospitales y oficinas mexicanas con decisiones guiadas y ejercicios para aplicar con tu propio equipo, 4 laboratorios de simulación y un proyecto final en el que armas tu plan de liderazgo de 90 días. Práctico y con formatos listos; al terminar recibes una constancia de Instituto Mara.' WHERE id='d-liderazgo';
UPDATE cursos SET horas=66 WHERE id='r-lider';
COMMIT;
