-- Diplomado en Educación Inclusiva y Neurodiversidad (TEA, TDAH y Dificultades de Aprendizaje): ampliado a 30 horas reales (opción B).
BEGIN;
UPDATE cursos SET horas=30, descripcion='Para docentes de preescolar a secundaria, maestras sombra, orientadores, madres, padres y cuidadores. Aprende a reconocer señales de autismo (TEA), TDAH y dificultades específicas del aprendizaje, a adaptar el aula y la casa con apoyos basados en evidencia y a trabajar en equipo con la familia y los especialistas. Incluye 20 casos de aulas y familias mexicanas con decisiones guiadas y ejercicios para aplicar con alumnos reales, 4 laboratorios de simulación y un proyecto final en el que armas el plan de apoyo individual de un alumno. No capacita para diagnosticar: el diagnóstico lo hace un profesional de la salud.' WHERE id='d-neurodiversidad';
UPDATE cursos SET horas=45 WHERE id='r-educadores';
COMMIT;
