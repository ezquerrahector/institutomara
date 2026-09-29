-- Diplomado en Salud Emocional de Niños y Adolescentes: Detección y Acompañamiento: ampliado a 30 horas reales (opción B).
BEGIN;
UPDATE cursos SET horas=30, descripcion='Para docentes, orientadores, madres, padres y personal que trabaja con niñas, niños y adolescentes. Aprende cómo se desarrollan las emociones, a reconocer señales de alerta (ansiedad, tristeza persistente, acoso, riesgos en línea), a escuchar y poner límites sin violencia, y a canalizar a tiempo con un plan y un directorio. Incluye 20 casos de escuelas y familias mexicanas con decisiones guiadas, 4 laboratorios de simulación y un proyecto final en el que armas el plan de bienestar y canalización de tu escuela, grupo o familia. No capacita para diagnosticar ni dar tratamiento: te prepara para detectar, acompañar y pedir la ayuda correcta.' WHERE id='d-infancia-adolescencia';
UPDATE cursos SET horas=65 WHERE id='r-educadores';
COMMIT;
