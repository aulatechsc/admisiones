/**
 * Tests de las funciones puras de apps-script/ingesta.gs.
 *
 *     npm test
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { cargar } = require('./helpers');

// Mismo orden de carga que en Apps Script: config, después lo que lo usa.
const I = cargar('util.gs', 'config.gs', 'plantillas.gs', 'ingesta.gs');

/**
 * Encabezados exactos de cada solapa de "Admisiones - Respuestas Sitio Web",
 * copiados de SHEETS_CONFIG en legacy/sitio-web.gs. Si el formulario del
 * sitio cambia sus columnas, estos tests son los que avisan.
 */
const HEADERS_SITIO = {
  Inicial: [
    'Fecha de envío', 'Email', 'Celular de contacto',
    'Padre/Madre/Tutor 1', 'Profesión Tutor 1',
    'Padre/Madre/Tutor 2', 'Profesión Tutor 2',
    'Nombre del/la postulante', 'Fecha de nacimiento',
    'Sala actual', 'Jardín actual', 'Motivo del cambio',
    'Trayectoria escolar actual', 'Año de vacante solicitada',
    'Sala solicitada', 'Cómo llegó', 'Comentarios adicionales'
  ],
  Primaria: [
    'Fecha de envío', 'Email', 'Celular de contacto',
    'Padre/Madre/Tutor 1', 'Profesión Tutor 1',
    'Padre/Madre/Tutor 2', 'Profesión Tutor 2',
    'Nombre del/la postulante', 'Fecha de nacimiento',
    'Grado actual', 'Colegio actual', 'Bilingüe inglés',
    'Motivo del cambio', 'Trayectoria escolar actual',
    'Año de vacante solicitada', 'Grado solicitado', 'Cómo llegó'
  ],
  Secundaria: [
    'Fecha de envío', 'Email', 'Celular de contacto',
    'Padre/Madre/Tutor 1', 'Padre/Madre/Tutor 2',
    'Nombre del/la estudiante', 'Fecha de nacimiento',
    'Curso actual', 'Colegio actual', 'Bilingüe inglés',
    'Motivo del cambio', 'Solicita proyecto de inclusión',
    'Año de vacante solicitada', 'Curso solicitado', 'Cómo llegó'
  ]
};

const ENVIO = new Date('2026-09-20T14:30:00.000Z');

// ───────────────────────────────────────────────────────────────────
// Fechas
// ───────────────────────────────────────────────────────────────────

test('normalizarFecha convierte Date a ISO', () => {
  assert.strictEqual(I.normalizarFecha(ENVIO), '2026-09-20T14:30:00.000Z');
});

test('normalizarFecha deja el texto como está', () => {
  assert.strictEqual(I.normalizarFecha('20/09/2026'), '20/09/2026');
  assert.strictEqual(I.normalizarFecha('  20/09/2026  '), '20/09/2026');
});

test('normalizarFecha tolera vacíos y fechas inválidas', () => {
  assert.strictEqual(I.normalizarFecha(''), '');
  assert.strictEqual(I.normalizarFecha(null), '');
  assert.strictEqual(I.normalizarFecha(undefined), '');
  assert.strictEqual(I.normalizarFecha(new Date('no es fecha')), '');
});

// ───────────────────────────────────────────────────────────────────
// Huella
// ───────────────────────────────────────────────────────────────────

test('la huella es estable para la misma solicitud', () => {
  const a = { fecha_alta: ENVIO, email: 'ana@ejemplo.com', alumno_nombre: 'Sofía Pérez' };
  assert.strictEqual(I.calcularHuella('Inicial', a), I.calcularHuella('Inicial', a));
});

test('la huella ignora mayúsculas y espacios', () => {
  const a = { fecha_alta: ENVIO, email: 'ana@ejemplo.com', alumno_nombre: 'Sofía Pérez' };
  const b = { fecha_alta: ENVIO, email: '  ANA@Ejemplo.com ', alumno_nombre: ' sofía pérez ' };
  assert.strictEqual(I.calcularHuella('Inicial', a), I.calcularHuella('Inicial', b));
});

test('la huella distingue solicitudes distintas', () => {
  const base = { fecha_alta: ENVIO, email: 'ana@ejemplo.com', alumno_nombre: 'Sofía Pérez' };
  const otroNivel = I.calcularHuella('Primaria', base);
  const otroAlumno = I.calcularHuella('Inicial', Object.assign({}, base, { alumno_nombre: 'Juan Pérez' }));
  const otraFecha = I.calcularHuella('Inicial', Object.assign({}, base, {
    fecha_alta: new Date('2026-09-21T14:30:00.000Z')
  }));

  const todas = [I.calcularHuella('Inicial', base), otroNivel, otroAlumno, otraFecha];
  assert.strictEqual(new Set(todas).size, 4);
});

test('dos hermanos de la misma familia no colisionan', () => {
  // Mismo mail de contacto, misma fecha de envío al minuto: lo que los
  // distingue es el nombre del postulante.
  const h1 = I.calcularHuella('Inicial', {
    fecha_alta: ENVIO, email: 'ana@ejemplo.com', alumno_nombre: 'Sofía Pérez'
  });
  const h2 = I.calcularHuella('Inicial', {
    fecha_alta: ENVIO, email: 'ana@ejemplo.com', alumno_nombre: 'Mateo Pérez'
  });
  assert.notStrictEqual(h1, h2);
});

// ───────────────────────────────────────────────────────────────────
// Mapeo por nivel
// ───────────────────────────────────────────────────────────────────

test('mapea una solicitud de Inicial', () => {
  const fila = [
    ENVIO, 'ana@ejemplo.com', '1141611054',
    'Ana Pérez', 'Contadora',
    'Luis Pérez', 'Arquitecto',
    'Sofía Pérez', '03/07/2021',
    'Sala de 3 años', 'Jardín Diálogos', 'Ubicación',
    'No', '2027',
    'Sala de 4 años', 'Instagram', 'Sin comentarios'
  ];

  const { admision, ignorados } = I.mapearFilaSitio('Inicial', HEADERS_SITIO.Inicial, fila);

  assert.deepStrictEqual(ignorados, []);
  assert.strictEqual(admision.nivel, 'Inicial');
  assert.strictEqual(admision.estado, 'nueva');
  assert.strictEqual(admision.origen, 'form_web');
  assert.strictEqual(admision.alumno_nombre, 'Sofía Pérez');
  assert.strictEqual(admision.grado_actual, 'Sala de 3 años');
  assert.strictEqual(admision.grado_solicitado, 'Sala de 4 años');
  assert.strictEqual(admision.escuela_actual, 'Jardín Diálogos');
  assert.strictEqual(admision.anio_vacante, '2027');
  assert.strictEqual(admision.tutor1_nombre, 'Ana Pérez');
  assert.strictEqual(admision.tutor2_profesion, 'Arquitecto');
  assert.strictEqual(admision.comentarios, 'Sin comentarios');
  assert.ok(admision.huella);
});

test('mapea una solicitud de Primaria', () => {
  const fila = [
    ENVIO, 'carlos@ejemplo.com', '1131035491',
    'Carlos Cortés', 'Empleado',
    'Noelia Ezio', 'Docente',
    'Juan Cortés', '05/06/2018',
    '2do grado', 'Jardín Estrellita', 'Sí',
    'Buscamos colegio con secundaria', 'Sin apoyos',
    '2027', '3er grado', 'Recomendación'
  ];

  const { admision, ignorados } = I.mapearFilaSitio('Primaria', HEADERS_SITIO.Primaria, fila);

  assert.deepStrictEqual(ignorados, []);
  assert.strictEqual(admision.nivel, 'Primaria');
  assert.strictEqual(admision.grado_actual, '2do grado');
  assert.strictEqual(admision.grado_solicitado, '3er grado');
  assert.strictEqual(admision.escuela_actual, 'Jardín Estrellita');
  assert.strictEqual(admision.bilingue, true);
  assert.strictEqual(admision.trayectoria_texto, 'Sin apoyos');
});

test('mapea una solicitud de Secundaria', () => {
  const fila = [
    ENVIO, 'micaela@ejemplo.com', '15-5509-0107',
    'Micaela Beltrán', 'Jorge Giardulli',
    'Felicitas Giardulli', '27/11/2009',
    '3er Año', 'La Salle', 'Sí',
    'Quiere más inglés', 'No',
    '2027', '4to Año', 'Recomendación'
  ];

  const { admision, ignorados } = I.mapearFilaSitio('Secundaria', HEADERS_SITIO.Secundaria, fila);

  assert.deepStrictEqual(ignorados, []);
  assert.strictEqual(admision.nivel, 'Secundaria');
  assert.strictEqual(admision.alumno_nombre, 'Felicitas Giardulli');
  assert.strictEqual(admision.grado_solicitado, '4to Año');
  assert.strictEqual(admision.bilingue, true);
  assert.strictEqual(admision.inclusion_solicitada, false);
  // Secundaria no pide profesiones en el formulario del sitio
  assert.strictEqual(admision.tutor1_profesion, undefined);
});

test('los tres niveles mapean sin dejar campos sin destino', () => {
  // Si alguien agrega una columna al formulario del sitio y no la mapea,
  // este test la detecta antes de que se empiecen a perder datos.
  ['Inicial', 'Primaria', 'Secundaria'].forEach((nivel) => {
    const headers = HEADERS_SITIO[nivel];
    const fila = headers.map(() => 'x');
    const { ignorados } = I.mapearFilaSitio(nivel, headers, fila);
    assert.deepStrictEqual(ignorados, [], `${nivel} dejó campos sin mapear: ${ignorados}`);
  });
});

test('un campo nuevo del sitio se reporta en vez de perderse', () => {
  const headers = HEADERS_SITIO.Inicial.concat(['Hermanos en el colegio']);
  const fila = headers.map(() => 'x');
  const { ignorados } = I.mapearFilaSitio('Inicial', headers, fila);
  assert.deepStrictEqual(ignorados, ['Hermanos en el colegio']);
});

test('los booleanos aceptan Sí/No y TRUE/FALSE', () => {
  const headers = HEADERS_SITIO.Secundaria;
  const iInclusion = headers.indexOf('Solicita proyecto de inclusión');

  const conSi = headers.map(() => '');
  conSi[iInclusion] = 'Sí';
  assert.strictEqual(I.mapearFilaSitio('Secundaria', headers, conSi).admision.inclusion_solicitada, true);

  const conTrue = headers.map(() => '');
  conTrue[iInclusion] = true;
  assert.strictEqual(I.mapearFilaSitio('Secundaria', headers, conTrue).admision.inclusion_solicitada, true);

  const conNo = headers.map(() => '');
  conNo[iInclusion] = 'No';
  assert.strictEqual(I.mapearFilaSitio('Secundaria', headers, conNo).admision.inclusion_solicitada, false);
});

test('un booleano con texto libre queda vacío, no en true', () => {
  // Las planillas viejas tienen texto largo donde debería haber un booleano.
  // Guardarlo como true mandaría el mail de "sin vacante de inclusión" a una
  // familia que nunca lo pidió.
  const headers = HEADERS_SITIO.Secundaria;
  const fila = headers.map(() => '');
  fila[headers.indexOf('Solicita proyecto de inclusión')] =
    'Mi hijo/a realiza una trayectoria escolar de nivel sin apoyos externos.';

  const { admision } = I.mapearFilaSitio('Secundaria', headers, fila);
  assert.strictEqual(admision.inclusion_solicitada, '');
});

test('una fila con celdas vacías no rompe el mapeo', () => {
  const headers = HEADERS_SITIO.Inicial;
  const fila = [ENVIO, 'ana@ejemplo.com', '', '', '', '', '', 'Sofía Pérez', '', '', '', '', '', '2027', 'Sala de 4', '', ''];
  const { admision } = I.mapearFilaSitio('Inicial', headers, fila);
  assert.strictEqual(admision.alumno_nombre, 'Sofía Pérez');
  assert.strictEqual(admision.tutor1_nombre, '');
  assert.ok(admision.huella);
});

// ───────────────────────────────────────────────────────────────────
// Ids
// ───────────────────────────────────────────────────────────────────

test('siguienteId arranca en A-00001', () => {
  assert.strictEqual(I.siguienteId([]), 'A-00001');
});

test('siguienteId continúa desde el mayor existente', () => {
  assert.strictEqual(I.siguienteId(['A-00001', 'A-00002']), 'A-00003');
  // No asume que vengan ordenados
  assert.strictEqual(I.siguienteId(['A-00007', 'A-00002']), 'A-00008');
});

test('siguienteId ignora ids con otro formato', () => {
  assert.strictEqual(I.siguienteId(['A-00001', '', 'viejo-192', null]), 'A-00002');
});

test('siguienteId no reusa un id al superar los 5 dígitos', () => {
  assert.strictEqual(I.siguienteId(['A-99999']), 'A-100000');
});

// ───────────────────────────────────────────────────────────────────
// Esquema
// ───────────────────────────────────────────────────────────────────

test('todo destino del mapeo existe como columna de Admisiones', () => {
  // Un typo en MAPEO_SITIO escribiría en una columna inexistente y el dato
  // se perdería sin error.
  const columnas = I.COLUMNAS_ADMISIONES;
  Object.keys(I.MAPEO_SITIO).forEach((seccion) => {
    const mapa = I.MAPEO_SITIO[seccion];
    Object.keys(mapa).forEach((origen) => {
      assert.ok(
        columnas.indexOf(mapa[origen]) !== -1,
        `${seccion}: "${origen}" apunta a "${mapa[origen]}", que no es columna de Admisiones`
      );
    });
  });
});

test('Admisiones no repite nombres de columna', () => {
  // El problema que tienen las planillas actuales: dos columnas "Inclusión",
  // dos "Mail", dos "Fecha". Buscar por nombre devuelve la primera y calla.
  const cols = I.COLUMNAS_ADMISIONES;
  assert.strictEqual(new Set(cols).size, cols.length);
});

test('ninguna solapa repite nombres de columna', () => {
  [I.COLUMNAS_EVENTOS, I.COLUMNAS_USUARIOS, I.COLUMNAS_ESTADOS].forEach((cols) => {
    assert.strictEqual(new Set(cols).size, cols.length);
  });
});

test('el estado inicial existe en el catálogo de estados', () => {
  const ids = I.ESTADOS_INICIALES.map((e) => e.id);
  assert.ok(ids.indexOf(I.ESTADO_INICIAL) !== -1);
});

test('los estados no repiten id ni orden', () => {
  const ids = I.ESTADOS_INICIALES.map((e) => e.id);
  const ordenes = I.ESTADOS_INICIALES.map((e) => e.orden);
  assert.strictEqual(new Set(ids).size, ids.length);
  assert.strictEqual(new Set(ordenes).size, ordenes.length);
});

test('las plantillas iniciales cubren los niveles que mandan mail', () => {
  const { PLANTILLAS_INICIALES } = I;
  const niveles = new Set(PLANTILLAS_INICIALES.map((p) => p.nivel));
  assert.ok(niveles.has('Inicial'));
  assert.ok(niveles.has('Primaria'));
  // Secundaria contacta por teléfono: no debe tener plantilla todavía
  assert.ok(!niveles.has('Secundaria'));
});

test('cada nivel con plantillas tiene una por defecto', () => {
  // Sin una plantilla `*`, una admisión que no cumple ninguna condición se
  // queda sin mail y nadie se entera.
  ['Inicial', 'Primaria'].forEach((nivel) => {
    const delNivel = I.PLANTILLAS_INICIALES.filter((p) => p.nivel === nivel);
    assert.ok(
      delNivel.some((p) => p.condicion === '*'),
      `${nivel} no tiene plantilla por defecto`
    );
  });
});

// ───────────────────────────────────────────────────────────────────
// Inclusión derivada de la trayectoria
//
// Inicial y Primaria no preguntan por inclusión: la respuesta está dentro
// del campo "Trayectoria escolar actual", entre tres opciones cerradas.
// ───────────────────────────────────────────────────────────────────

test('sólo la opción de proyecto de inclusión cuenta como inclusión', () => {
  assert.strictEqual(I.derivarInclusion(I.TRAYECTORIAS.CON_INCLUSION), true);
});

test('las otras dos opciones no son inclusión', () => {
  assert.strictEqual(I.derivarInclusion(I.TRAYECTORIAS.TERAPIAS_EXTERNAS), false);
  assert.strictEqual(I.derivarInclusion(I.TRAYECTORIAS.SIN_APOYOS), false);
});

test('la opción de terapias externas no da falso positivo', () => {
  // Dice "no tiene proyecto de inclusión": contiene la misma frase que la
  // opción afirmativa. Un match por substring marcaría inclusión y le
  // mandaría la negativa de vacante a una familia que declaró lo contrario.
  const t = I.TRAYECTORIAS.TERAPIAS_EXTERNAS;
  assert.ok(t.toLowerCase().includes('proyecto de inclusión'));
  assert.strictEqual(I.derivarInclusion(t), false);
});

test('derivarInclusion tolera tildes, mayúsculas y espacios', () => {
  assert.strictEqual(
    I.derivarInclusion('MI HIJO/A CUENTA CON UN PROYECTO DE INCLUSION Y EQUIPO DE APOYO (MAI/AP/AE).'),
    true
  );
  assert.strictEqual(
    I.derivarInclusion('  Mi hijo/a  realiza una  trayectoria escolar de nivel sin apoyos externos.  '),
    false
  );
});

test('un texto desconocido devuelve null, no false', () => {
  // null es "no sé": el sitio lo muestra para que alguien decida. Asumir
  // false escondería el caso.
  assert.strictEqual(I.derivarInclusion('cualquier otra cosa'), null);
  assert.strictEqual(I.derivarInclusion(''), null);
  assert.strictEqual(I.derivarInclusion(null), null);
});

test('Inicial deriva inclusión desde la trayectoria al mapear', () => {
  const headers = HEADERS_SITIO.Inicial;
  const fila = headers.map(() => '');
  fila[headers.indexOf('Nombre del/la postulante')] = 'Sofía Pérez';
  fila[headers.indexOf('Trayectoria escolar actual')] = I.TRAYECTORIAS.CON_INCLUSION;

  const { admision } = I.mapearFilaSitio('Inicial', headers, fila);
  assert.strictEqual(admision.inclusion_solicitada, true);
  assert.strictEqual(admision.trayectoria_texto, I.TRAYECTORIAS.CON_INCLUSION);
});

test('Primaria deriva inclusión desde la trayectoria al mapear', () => {
  const headers = HEADERS_SITIO.Primaria;
  const fila = headers.map(() => '');
  fila[headers.indexOf('Nombre del/la postulante')] = 'Juan Cortés';
  fila[headers.indexOf('Trayectoria escolar actual')] = I.TRAYECTORIAS.CON_INCLUSION;

  const { admision } = I.mapearFilaSitio('Primaria', headers, fila);
  assert.strictEqual(admision.inclusion_solicitada, true);
});

test('la trayectoria de terapias externas no marca inclusión al mapear', () => {
  ['Inicial', 'Primaria'].forEach((nivel) => {
    const headers = HEADERS_SITIO[nivel];
    const fila = headers.map(() => '');
    fila[headers.indexOf('Nombre del/la postulante')] = 'Alguien';
    fila[headers.indexOf('Trayectoria escolar actual')] = I.TRAYECTORIAS.TERAPIAS_EXTERNAS;

    const { admision } = I.mapearFilaSitio(nivel, headers, fila);
    assert.strictEqual(admision.inclusion_solicitada, false, `${nivel} dio falso positivo`);
  });
});

test('Secundaria usa su campo directo, no la derivación', () => {
  const headers = HEADERS_SITIO.Secundaria;
  const fila = headers.map(() => '');
  fila[headers.indexOf('Nombre del/la estudiante')] = 'Martina Gómez';
  fila[headers.indexOf('Solicita proyecto de inclusión')] = 'Sí';

  const { admision } = I.mapearFilaSitio('Secundaria', headers, fila);
  assert.strictEqual(admision.inclusion_solicitada, true);
});

test('una trayectoria desconocida deja el campo vacío para decidir a mano', () => {
  const headers = HEADERS_SITIO.Inicial;
  const fila = headers.map(() => '');
  fila[headers.indexOf('Nombre del/la postulante')] = 'Sofía Pérez';
  fila[headers.indexOf('Trayectoria escolar actual')] = 'Texto que nadie previó';

  const { admision } = I.mapearFilaSitio('Inicial', headers, fila);
  assert.strictEqual(admision.inclusion_solicitada, '');
});

test('la plantilla de inclusión de Primaria ahora se dispara sola', () => {
  // Antes de derivar desde la trayectoria, inclusion_solicitada llegaba
  // siempre vacío en Primaria y el circuito nunca se activaba.
  const headers = HEADERS_SITIO.Primaria;
  const fila = headers.map(() => '');
  fila[headers.indexOf('Nombre del/la postulante')] = 'Juan Cortés';
  fila[headers.indexOf('Grado solicitado')] = '3er grado';
  fila[headers.indexOf('Año de vacante solicitada')] = '2027';
  fila[headers.indexOf('Padre/Madre/Tutor 1')] = 'Carlos Cortés';
  fila[headers.indexOf('Trayectoria escolar actual')] = I.TRAYECTORIAS.CON_INCLUSION;

  const { admision } = I.mapearFilaSitio('Primaria', headers, fila);
  const elegida = I.elegirPlantilla(I.PLANTILLAS_INICIALES, 'Primaria', admision);
  assert.strictEqual(elegida.id, 'primaria-inclusion');
});
