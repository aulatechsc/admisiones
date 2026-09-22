/**
 * Tests de las funciones puras de apps-script/plantillas.gs.
 *
 * Apps Script no tiene runner de tests, pero la selección de plantilla y el
 * renderizado son JavaScript plano y no tocan SpreadsheetApp.
 *
 *     npm test
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { cargar } = require('./helpers');

const P = cargar('config.gs', 'plantillas.gs');

// ───────────────────────────────────────────────────────────────────
// Normalización de booleanos
//
// Importa porque las planillas mezclan tres formatos para el mismo dato:
// TRUE/FALSE del checkbox, "Sí"/"No" del formulario del sitio, y texto libre.
// ───────────────────────────────────────────────────────────────────

test('aBooleano acepta los formatos que conviven en las planillas', () => {
  assert.strictEqual(P.aBooleano(true), true);
  assert.strictEqual(P.aBooleano(false), false);
  assert.strictEqual(P.aBooleano('TRUE'), true);
  assert.strictEqual(P.aBooleano('FALSE'), false);
  assert.strictEqual(P.aBooleano('Sí'), true);
  assert.strictEqual(P.aBooleano('No'), false);
  assert.strictEqual(P.aBooleano('si'), true);
  assert.strictEqual(P.aBooleano(''), false);
});

test('aBooleano devuelve null para lo que no es booleano', () => {
  // El caso real: la columna "Inclusión" duplicada, donde una guarda texto
  // libre del formulario en vez del checkbox.
  assert.strictEqual(
    P.aBooleano('Mi hijo/a realiza una trayectoria escolar de nivel sin apoyos externos.'),
    null
  );
  assert.strictEqual(P.aBooleano(null), null);
  assert.strictEqual(P.aBooleano(undefined), null);
});

// ───────────────────────────────────────────────────────────────────
// Condiciones
// ───────────────────────────────────────────────────────────────────

test('la condición * siempre aplica', () => {
  assert.strictEqual(P.evaluarCondicion('*', {}), true);
  assert.strictEqual(P.evaluarCondicion('  *  ', { anio_vacante: 2026 }), true);
});

test('comparación numérica reproduce el corte de entrevista grupal', () => {
  // Regla actual de Inicial: Number(anio) >= 2028
  const cond = 'anio_vacante >= 2028';
  assert.strictEqual(P.evaluarCondicion(cond, { anio_vacante: 2028 }), true);
  assert.strictEqual(P.evaluarCondicion(cond, { anio_vacante: 2029 }), true);
  assert.strictEqual(P.evaluarCondicion(cond, { anio_vacante: 2027 }), false);
  // La planilla puede guardar el año como texto
  assert.strictEqual(P.evaluarCondicion(cond, { anio_vacante: '2028' }), true);
  assert.strictEqual(P.evaluarCondicion(cond, { anio_vacante: '2026' }), false);
});

test('comparación booleana reproduce el circuito de inclusión de Primaria', () => {
  const cond = 'inclusion_solicitada == true';
  assert.strictEqual(P.evaluarCondicion(cond, { inclusion_solicitada: true }), true);
  assert.strictEqual(P.evaluarCondicion(cond, { inclusion_solicitada: 'TRUE' }), true);
  assert.strictEqual(P.evaluarCondicion(cond, { inclusion_solicitada: 'Sí' }), true);
  assert.strictEqual(P.evaluarCondicion(cond, { inclusion_solicitada: false }), false);
  assert.strictEqual(P.evaluarCondicion(cond, { inclusion_solicitada: 'No' }), false);
});

test('un campo ausente no cumple la condición', () => {
  assert.strictEqual(P.evaluarCondicion('anio_vacante >= 2028', {}), false);
  assert.strictEqual(P.evaluarCondicion('inclusion_solicitada == true', { otro: 1 }), false);
});

test('una condición mal escrita devuelve false en vez de lanzar', () => {
  // Las condiciones las edita gente desde el sitio: una plantilla rota no
  // puede tumbar el envío de las demás.
  const datos = { anio_vacante: 2028 };
  assert.strictEqual(P.evaluarCondicion('esto no es una condición', datos), false);
  assert.strictEqual(P.evaluarCondicion('anio_vacante >>> 2028', datos), false);
  assert.strictEqual(P.evaluarCondicion('', datos), true); // vacío = siempre, como *
  assert.strictEqual(P.evaluarCondicion(null, datos), false);
});

test('las condiciones no ejecutan código', () => {
  // El motor no usa eval(). Si alguien escribe una expresión en la planilla,
  // debe tratarse como texto que no parsea, nunca ejecutarse.
  global.__tocado = false;
  assert.strictEqual(
    P.evaluarCondicion('anio_vacante == 2028); global.__tocado = true; (1', { anio_vacante: 2028 }),
    false
  );
  assert.strictEqual(global.__tocado, false);
  delete global.__tocado;
});

// ───────────────────────────────────────────────────────────────────
// Selección
// ───────────────────────────────────────────────────────────────────

test('elegirPlantilla prefiere la específica sobre la de defecto', () => {
  const ps = P.PLANTILLAS_INICIALES;
  const grupal = P.elegirPlantilla(ps, 'Inicial', { anio_vacante: 2028 });
  assert.strictEqual(grupal.id, 'inicial-grupal');

  const individual = P.elegirPlantilla(ps, 'Inicial', { anio_vacante: 2026 });
  assert.strictEqual(individual.id, 'inicial-individual');
});

test('elegirPlantilla no cruza niveles', () => {
  const ps = P.PLANTILLAS_INICIALES;
  const prim = P.elegirPlantilla(ps, 'Primaria', { anio_vacante: 2028, inclusion_solicitada: false });
  assert.strictEqual(prim.id, 'primaria-estandar');

  // Secundaria hoy contacta por teléfono: no hay plantilla y no se debe
  // caer en la de otro nivel.
  const sec = P.elegirPlantilla(ps, 'Secundaria', { anio_vacante: 2027 });
  assert.strictEqual(sec, null);
});

test('elegirPlantilla ignora las inactivas', () => {
  const ps = P.PLANTILLAS_INICIALES.map(p =>
    p.id === 'inicial-grupal' ? Object.assign({}, p, { activa: false }) : p
  );
  const elegida = P.elegirPlantilla(ps, 'Inicial', { anio_vacante: 2028 });
  assert.strictEqual(elegida.id, 'inicial-individual');
});

test('elegirPlantilla respeta la prioridad, no el orden de la planilla', () => {
  const ps = [
    { id: 'defecto', nivel: 'X', condicion: '*', prioridad: 99, activa: true },
    { id: 'especifica', nivel: 'X', condicion: 'anio_vacante >= 2028', prioridad: 10, activa: true }
  ];
  assert.strictEqual(P.elegirPlantilla(ps, 'X', { anio_vacante: 2030 }).id, 'especifica');
});

// ───────────────────────────────────────────────────────────────────
// Renderizado
// ───────────────────────────────────────────────────────────────────

test('renderizar reemplaza los placeholders', () => {
  const r = P.renderizar('Hola {{alumno_nombre}}, sala {{grado_solicitado}}', {
    alumno_nombre: 'Sofía',
    grado_solicitado: 'Sala de 4'
  });
  assert.strictEqual(r.texto, 'Hola Sofía, sala Sala de 4');
  assert.deepStrictEqual(r.faltantes, []);
});

test('renderizar tolera espacios dentro de las llaves', () => {
  const r = P.renderizar('Hola {{ alumno_nombre }}', { alumno_nombre: 'Sofía' });
  assert.strictEqual(r.texto, 'Hola Sofía');
});

test('un campo vacío se reporta como faltante en vez de quedar en blanco', () => {
  // Los scripts actuales concatenan directamente, así que una fila sin
  // Padre/Madre 1 manda un mail que arranca "Estimada/o :". Acá el
  // placeholder queda visible y el faltante se reporta.
  const r = P.renderizar('Estimada/o {{tutor1_nombre}}:', { tutor1_nombre: '' });
  assert.deepStrictEqual(r.faltantes, ['tutor1_nombre']);
  assert.ok(r.texto.includes('{{tutor1_nombre}}'));
  assert.ok(!r.texto.includes('Estimada/o :'));
});

test('un campo ausente también se reporta', () => {
  const r = P.renderizar('Hola {{alumno_nombre}} y {{tutor2_nombre}}', { alumno_nombre: 'Sofía' });
  assert.deepStrictEqual(r.faltantes, ['tutor2_nombre']);
});

test('renderizarPlantilla junta los faltantes de asunto y cuerpo', () => {
  const r = P.renderizarPlantilla(
    { asunto: 'Admisión {{alumno_nombre}}', cuerpo: 'Estimada/o {{tutor1_nombre}}' },
    {}
  );
  assert.deepStrictEqual(r.faltantes.sort(), ['alumno_nombre', 'tutor1_nombre']);
});

test('url_aranceles se inyecta sin tener que pasarla', () => {
  const r = P.renderizarPlantilla({ asunto: 'x', cuerpo: 'Aranceles: {{url_aranceles}}' }, {});
  assert.ok(r.cuerpo.includes('https://docs.google.com/spreadsheets/'));
  assert.deepStrictEqual(r.faltantes, []);
});

// ───────────────────────────────────────────────────────────────────
// Regresión: las plantillas migradas deben producir el mismo texto
// que los scripts que hoy están en producción.
// ───────────────────────────────────────────────────────────────────

const ARANCELES = 'https://docs.google.com/spreadsheets/d/1O9gDK1i3PJIeMTrAtGhnNaYAp6PzNCzjUYGTX5uw-qM/edit?usp=sharing';

test('regresión: Inicial individual coincide con el script actual', () => {
  const datos = {
    alumno_nombre: 'Sofía Pérez',
    tutor1_nombre: 'Ana Pérez',
    grado_solicitado: 'Sala de 4 años',
    anio_vacante: 2026
  };
  const elegida = P.elegirPlantilla(P.PLANTILLAS_INICIALES, 'Inicial', datos);
  const r = P.renderizarPlantilla(elegida, datos);

  // Asunto tal como lo arma enviarMailJardin()
  assert.strictEqual(r.asunto, 'Admisión Sofía Pérez / Sala de 4 años / 2026');

  // Cuerpo: mismo texto que el script, reconstruido por concatenación
  const esperado =
    'Estimada/o Ana Pérez:\n\n' +
    'Nos comunicamos desde el Jardín del Colegio San Carlos Diálogos en relación ' +
    'a su consulta para conocer nuestra propuesta educativa para Sofía Pérez, ' +
    'aspirante a Sala de 4 años en el ciclo lectivo 2026.\n\n' +
    'Le agradecemos el interés en nuestra institución. Será un placer coordinar una ' +
    'entrevista personal para poder compartir nuestro proyecto pedagógico, recorrer ' +
    'las instalaciones y conocer más acerca de su hijo/a y de su familia.\n\n' +
    'Para organizar el encuentro, le pedimos por favor que nos indique su disponibilidad ' +
    'en días y horarios por la mañana, respondiendo a este mismo correo, así podremos ' +
    'acordar una fecha conveniente.\n\n' +
    'Le compartimos el link a los aranceles vigentes:\n' +
    ARANCELES + '\n\n' +
    'Quedamos a disposición para cualquier consulta adicional y esperamos su respuesta ' +
    'para coordinar la visita.\n\n' +
    'Saludos cordiales,\n\n' +
    'Eliana Waichman\n' +
    'Directora\n' +
    'Jardín San Carlos Diálogos';

  assert.strictEqual(r.cuerpo, esperado);
  assert.deepStrictEqual(r.faltantes, []);
});

test('regresión: Inicial grupal coincide con el script actual', () => {
  const datos = {
    alumno_nombre: 'Tomás Díaz',
    tutor1_nombre: 'Laura Díaz',
    grado_solicitado: 'Sala de 3 años',
    anio_vacante: 2028
  };
  const elegida = P.elegirPlantilla(P.PLANTILLAS_INICIALES, 'Inicial', datos);
  assert.strictEqual(elegida.id, 'inicial-grupal');

  const r = P.renderizarPlantilla(elegida, datos);

  // El script actual repite el año en el asunto. Se migra tal cual para no
  // cambiar el comportamiento en la migración; corregirlo es una decisión
  // aparte, y ahora se hace editando la plantilla sin tocar código.
  assert.strictEqual(r.asunto, '2028 - Admisión Tomás Díaz / Sala de 3 años / 2028');

  assert.ok(r.cuerpo.includes('• Viernes 9 de octubre, 10:00 hs'));
  assert.ok(r.cuerpo.includes('• Viernes 6 de noviembre, 10:00 hs'));
  assert.ok(r.cuerpo.includes('las entrevistas informativas se realizan de manera grupal'));
  assert.deepStrictEqual(r.faltantes, []);
});

test('regresión: Primaria inclusión coincide con el script actual', () => {
  const datos = {
    alumno_nombre: 'Martina Gómez',
    tutor1_nombre: 'Pablo Gómez',
    grado_solicitado: '3er grado',
    anio_vacante: 2027,
    inclusion_solicitada: true
  };
  const elegida = P.elegirPlantilla(P.PLANTILLAS_INICIALES, 'Primaria', datos);
  assert.strictEqual(elegida.id, 'primaria-inclusion');

  const r = P.renderizarPlantilla(elegida, datos);
  assert.strictEqual(r.asunto, 'Martina Gómez - 3er grado (2027)');
  assert.ok(r.cuerpo.includes('no contamos con disponibilidad de vacante en 3er grado'));
  assert.ok(r.cuerpo.includes('Rocío Halperin'));
  assert.deepStrictEqual(r.faltantes, []);
});

test('regresión: Primaria estándar coincide con el script actual', () => {
  const datos = {
    alumno_nombre: 'Juan Cortés',
    tutor1_nombre: 'Carlos Cortés',
    grado_solicitado: '1er grado',
    anio_vacante: 2027,
    inclusion_solicitada: false
  };
  const elegida = P.elegirPlantilla(P.PLANTILLAS_INICIALES, 'Primaria', datos);
  assert.strictEqual(elegida.id, 'primaria-estandar');

  const r = P.renderizarPlantilla(elegida, datos);
  assert.strictEqual(r.asunto, 'Juan Cortés - 1er grado (2027)');
  assert.ok(r.cuerpo.includes('la entrevista se realiza únicamente con adultos'));
  assert.deepStrictEqual(r.faltantes, []);
});

test('el texto libre en la columna Inclusión no dispara el circuito de inclusión', () => {
  // Ésta es la trampa del esquema actual: hay dos columnas "Inclusión" y la
  // primera guarda texto libre. Si ese texto llegara al campo booleano, la
  // condición no debe interpretarlo como true y mandar el mail de "sin
  // vacante" a una familia que no lo pidió.
  const datos = {
    alumno_nombre: 'Clara Fernández',
    tutor1_nombre: 'Daniela González',
    grado_solicitado: '2do grado',
    anio_vacante: 2027,
    inclusion_solicitada: 'Mi hijo/a realiza una trayectoria escolar de nivel sin apoyos externos.'
  };
  const elegida = P.elegirPlantilla(P.PLANTILLAS_INICIALES, 'Primaria', datos);
  assert.strictEqual(elegida.id, 'primaria-estandar');
});
