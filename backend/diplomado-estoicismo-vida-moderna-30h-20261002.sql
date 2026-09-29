-- Diplomado en Estoicismo para la Vida Moderna: ampliado a 30 horas reales (opción B).
BEGIN;
UPDATE cursos SET horas=30, descripcion='Aprende a usar las ideas de Epicteto, Séneca y Marco Aurelio en tu vida diaria: distinguir lo que depende de ti, manejar la frustración, responder a críticas, poner límites y tomar mejores decisiones. Con lecturas de los textos originales explicadas con ejemplos cotidianos, 24 casos de la vida en México con decisiones guiadas, 5 laboratorios de práctica, un proyecto final y un cuaderno de práctica en PDF.' WHERE id='diplomado-estoicismo-vida-moderna';
COMMIT;
