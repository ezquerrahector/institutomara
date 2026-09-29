-- Adulto Mayor ampliado a 31 horas reales (opción B).
BEGIN;
UPDATE cursos SET horas=31, descripcion='Aprende a cuidar a una persona mayor con dignidad y seguridad: higiene, movilidad, prevención de caídas, alimentación, organización de medicamentos y señales de alarma. Incluye 20 casos de cuidado en casa con prácticas paso a paso, 8 laboratorios y un proyecto final en el que armas el plan de cuidado completo de una persona mayor. Pensado para familiares y personas que quieren trabajar como cuidadoras; no sustituye la atención médica ni de enfermería.' WHERE id='d-adulto-mayor';
UPDATE cursos SET horas=66 WHERE id='r-cuidador';
COMMIT;
