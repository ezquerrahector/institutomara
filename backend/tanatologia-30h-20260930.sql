-- Tanatología ampliada a 30 horas reales (opción B). Ejecutado el 28/09/2026.
BEGIN;
UPDATE cursos SET horas=30, descripcion='Aprende a acompañar con respeto a personas que enfrentan la muerte y el duelo: qué decir y qué no, cómo apoyar a familias y a niños, cuándo canalizar y cómo cuidarte tú. Con 24 casos prácticos, 5 laboratorios de simulación, plantillas listas para usar y un proyecto final en el que armas tu propio protocolo de acompañamiento. Diplomado libre con constancia de Instituto Mara; no habilita para dar psicoterapia.' WHERE id='d-tanatologia';
UPDATE cursos SET horas=44 WHERE id='r-cuidador';
COMMIT;
SELECT id,horas,left(descripcion,60) FROM cursos WHERE id IN ('d-tanatologia','r-cuidador');
