-- TCC ampliada a 33 horas reales (opción B).
BEGIN;
UPDATE cursos SET horas=33, descripcion='Aprende el modelo cognitivo-conductual y sus técnicas con base en la evidencia: formulación de casos, registro de pensamientos, cuestionamiento socrático, activación conductual, exposición gradual, estructura de sesión, prevención de recaídas y ética profesional, con casos ficticios y hojas de cálculo para dar seguimiento. Incluye 24 casos de consulta con decisiones guiadas, 5 sesiones simuladas y un proyecto final en el que formulas un caso completo y su plan de tratamiento. Es para estudiantes y profesionales de psicología y para quienes trabajan en salud, educación o recursos humanos. Da fundamentos y técnicas; no habilita para ejercer la psicoterapia, que en México requiere formación profesional en psicología y cédula.' WHERE id='d-tcc';
UPDATE cursos SET horas=55 WHERE id='r-psicologia';
COMMIT;
SELECT id,horas,left(descripcion,60) AS inicio FROM cursos WHERE id IN ('d-tcc','r-psicologia');
