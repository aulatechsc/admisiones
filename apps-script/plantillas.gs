/**
 * Plantillas de mail — motor de selección y renderizado.
 *
 * Saca de código los cuerpos de mail que hoy están hardcodeados en los scripts
 * de Inicial y Primaria, y los mueve a la solapa `Plantillas` para que cada
 * dirección pueda editarlos desde el sitio sin tocar el script.
 *
 * Las funciones puras (renderizar, evaluarCondicion, elegirPlantilla) no tocan
 * SpreadsheetApp y se testean con node — ver test/plantillas.test.js.
 *
 * La normalización de valores (aBooleano, aNumero) vive en util.gs.
 */

/** Nombre de la solapa que guarda las plantillas. */
var HOJA_PLANTILLAS = 'Plantillas';

/**
 * Campos que una plantilla puede interpolar con {{campo}}.
 * El editor del sitio los muestra como lista clickeable para no tener que
 * recordarlos de memoria. Son los mismos nombres del esquema unificado, para
 * manejar un solo vocabulario en todo el sistema.
 */
var CAMPOS_DISPONIBLES = [
  'alumno_nombre',
  'grado_solicitado',
  'grado_actual',
  'anio_vacante',
  'escuela_actual',
  'tutor1_nombre',
  'tutor2_nombre',
  'nivel'
];

/** Link a los aranceles vigentes, disponible como {{url_aranceles}}. */
var URL_ARANCELES = 'https://docs.google.com/spreadsheets/d/1O9gDK1i3PJIeMTrAtGhnNaYAp6PzNCzjUYGTX5uw-qM/edit?usp=sharing';

// ───────────────────────────────────────────────────────────────────
// Condiciones
// ───────────────────────────────────────────────────────────────────

/**
 * Evalúa la condición que decide si una plantilla aplica a una admisión.
 *
 * Deliberadamente NO usa eval(): las condiciones se editan desde el sitio, y
 * evaluar texto arbitrario escrito en una planilla sería ejecutar código
 * ajeno con los permisos del script. El formato es `campo operador valor`:
 *
 *     *                              siempre aplica (plantilla por defecto)
 *     anio_vacante >= 2028           entrevistas grupales en Inicial
 *     inclusion_solicitada == true   circuito de inclusión en Primaria
 *
 * Operadores: == != >= <= > <
 * Un campo ausente o una condición mal escrita devuelven false — nunca lanzan,
 * para que una plantilla rota no bloquee el envío de las demás.
 */
function evaluarCondicion(condicion, datos) {
  if (condicion === null || condicion === undefined) return false;

  var c = condicion.toString().trim();
  if (c === '' || c === '*') return true;

  var m = c.match(/^([a-z0-9_]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/i);
  if (!m) return false;

  var campo = m[1];
  var op = m[2];
  var esperado = m[3].trim().replace(/^["']|["']$/g, '');

  if (!Object.prototype.hasOwnProperty.call(datos, campo)) return false;
  var actual = datos[campo];

  // Booleanos: sólo tienen sentido con == y !=
  var boolEsperado = aBooleano(esperado);
  if (boolEsperado !== null && (op === '==' || op === '!=')) {
    var boolActual = aBooleano(actual);
    if (boolActual === null) return false;
    return op === '==' ? boolActual === boolEsperado : boolActual !== boolEsperado;
  }

  // Numéricos: comparación ordenada
  var numEsperado = aNumero(esperado);
  var numActual = aNumero(actual);
  if (numEsperado !== null && numActual !== null) {
    switch (op) {
      case '==': return numActual === numEsperado;
      case '!=': return numActual !== numEsperado;
      case '>=': return numActual >= numEsperado;
      case '<=': return numActual <= numEsperado;
      case '>':  return numActual >  numEsperado;
      case '<':  return numActual <  numEsperado;
    }
    return false;
  }

  // Texto: sólo igualdad, sin distinguir mayúsculas ni espacios de borde
  if (op === '==' || op === '!=') {
    var txtActual = (actual === null || actual === undefined) ? '' : actual.toString().trim().toLowerCase();
    var txtEsperado = esperado.toLowerCase();
    return op === '==' ? txtActual === txtEsperado : txtActual !== txtEsperado;
  }

  return false;
}

/**
 * Elige qué plantilla aplica a una admisión.
 *
 * Filtra por nivel y por `activa`, ordena por `prioridad` ascendente y
 * devuelve la primera cuya condición se cumple. La plantilla por defecto
 * (condición `*`) va con la prioridad más alta para que quede última.
 *
 * Devuelve null si ninguna aplica — el llamador decide qué hacer, pero nunca
 * debe enviar nada.
 */
function elegirPlantilla(plantillas, nivel, datos) {
  var candidatas = plantillas
    .filter(function (p) {
      return p.activa !== false && p.nivel === nivel;
    })
    .sort(function (a, b) {
      return (a.prioridad || 0) - (b.prioridad || 0);
    });

  for (var i = 0; i < candidatas.length; i++) {
    if (evaluarCondicion(candidatas[i].condicion, datos)) return candidatas[i];
  }
  return null;
}

// ───────────────────────────────────────────────────────────────────
// Renderizado
// ───────────────────────────────────────────────────────────────────

/**
 * Reemplaza los {{campo}} de una plantilla por los datos de la admisión.
 *
 * Devuelve { texto, faltantes }. Un campo ausente o vacío NO se reemplaza por
 * cadena vacía: se acumula en `faltantes` y el placeholder queda visible, para
 * que quien envía lo vea en la previsualización.
 *
 * Esto corrige un problema real de los scripts actuales: al concatenar
 * directamente, una fila sin `Padre/Madre 1` produce un mail que arranca
 * "Estimada/o :" y se manda igual. Con esto, enviarMail() se niega a enviar
 * mientras haya faltantes.
 */
function renderizar(texto, datos) {
  var faltantes = [];
  if (texto === null || texto === undefined) return { texto: '', faltantes: faltantes };

  var salida = texto.toString().replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, function (match, campo) {
    var valor = datos[campo];
    if (valor === null || valor === undefined || valor.toString().trim() === '') {
      if (faltantes.indexOf(campo) === -1) faltantes.push(campo);
      return match;
    }
    return valor.toString().trim();
  });

  return { texto: salida, faltantes: faltantes };
}

/**
 * Renderiza asunto y cuerpo de una plantilla contra una admisión.
 * `faltantes` junta los de ambos: si tiene algo, no se envía.
 */
function renderizarPlantilla(plantilla, datos) {
  var conAranceles = {};
  for (var k in datos) {
    if (Object.prototype.hasOwnProperty.call(datos, k)) conAranceles[k] = datos[k];
  }
  conAranceles.url_aranceles = URL_ARANCELES;

  var asunto = renderizar(plantilla.asunto, conAranceles);
  var cuerpo = renderizar(plantilla.cuerpo, conAranceles);

  var faltantes = asunto.faltantes.slice();
  cuerpo.faltantes.forEach(function (c) {
    if (faltantes.indexOf(c) === -1) faltantes.push(c);
  });

  return { asunto: asunto.texto, cuerpo: cuerpo.texto, faltantes: faltantes };
}

// ───────────────────────────────────────────────────────────────────
// Acceso a la planilla (no testeable fuera de Apps Script)
// ───────────────────────────────────────────────────────────────────

var COLUMNAS_PLANTILLAS = [
  'id', 'nivel', 'nombre', 'condicion', 'prioridad', 'asunto', 'cuerpo', 'activa'
];

/** Lee todas las plantillas de la solapa. */
function leerPlantillas() {
  var hoja = SpreadsheetApp.getActive().getSheetByName(HOJA_PLANTILLAS);
  if (!hoja) throw new Error('No existe la solapa ' + HOJA_PLANTILLAS + '. Corré setup() primero.');

  var valores = hoja.getDataRange().getValues();
  if (valores.length < 2) return [];

  var encabezados = valores[0].map(function (e) { return e.toString().trim(); });

  return valores.slice(1)
    .filter(function (fila) { return fila[0] !== '' && fila[0] !== null; })
    .map(function (fila) {
      var p = {};
      encabezados.forEach(function (nombre, i) { p[nombre] = fila[i]; });
      p.activa = aBooleano(p.activa) !== false;
      p.prioridad = aNumero(p.prioridad) || 0;
      return p;
    });
}

/**
 * Guarda una plantilla editada desde el sitio. Si el id existe la reemplaza,
 * si no la agrega al final.
 */
function guardarPlantilla(plantilla) {
  var hoja = SpreadsheetApp.getActive().getSheetByName(HOJA_PLANTILLAS);
  if (!hoja) throw new Error('No existe la solapa ' + HOJA_PLANTILLAS + '.');

  if (!plantilla.id) throw new Error('La plantilla necesita un id.');
  if (!plantilla.nivel) throw new Error('La plantilla necesita un nivel.');

  // Una condición que no se puede parsear nunca se cumple: la plantilla
  // quedaría guardada pero muerta. Mejor rechazarla al guardar.
  if (plantilla.condicion && plantilla.condicion.trim() !== '*') {
    if (!/^([a-z0-9_]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/i.test(plantilla.condicion.trim())) {
      throw new Error('Condición inválida: "' + plantilla.condicion +
        '". Se espera "*" o "campo operador valor", por ejemplo "anio_vacante >= 2028".');
    }
  }

  var fila = COLUMNAS_PLANTILLAS.map(function (c) {
    var v = plantilla[c];
    return (v === undefined || v === null) ? '' : v;
  });

  var ids = hoja.getRange(2, 1, Math.max(hoja.getLastRow() - 1, 1), 1).getValues()
    .map(function (f) { return f[0].toString(); });
  var indice = ids.indexOf(plantilla.id.toString());

  if (indice === -1) {
    hoja.appendRow(fila);
  } else {
    hoja.getRange(indice + 2, 1, 1, fila.length).setValues([fila]);
  }
  return { ok: true };
}

// ───────────────────────────────────────────────────────────────────
// Carga inicial
// ───────────────────────────────────────────────────────────────────

var PLANTILLAS_INICIALES = [
  {
    id: 'inicial-grupal',
    nivel: 'Inicial',
    nombre: 'Inicial — entrevista grupal (ciclo 2028 en adelante)',
    condicion: 'anio_vacante >= 2028',
    prioridad: 10,
    activa: true,
    asunto: '{{anio_vacante}} - Admisión {{alumno_nombre}} / {{grado_solicitado}} / {{anio_vacante}}',
    cuerpo: [
      'Estimada/o {{tutor1_nombre}}:',
      '',
      'Nos comunicamos desde el Jardín del Colegio San Carlos Diálogos en relación a su consulta para conocer nuestra propuesta educativa para {{alumno_nombre}}, aspirante a {{grado_solicitado}} en el ciclo lectivo {{anio_vacante}}.',
      '',
      'Le agradecemos el interés en nuestra institución. Para las familias que se inscriben con esta anticipación, las entrevistas informativas se realizan de manera grupal, en alguna de las siguientes fechas:',
      '',
      '• Viernes 9 de octubre, 10:00 hs',
      '• Viernes 6 de noviembre, 10:00 hs',
      '',
      'En ese encuentro compartiremos nuestro proyecto pedagógico, recorreremos las instalaciones y podrá conocer más de cerca nuestra propuesta junto a otras familias interesadas.',
      '',
      'Le pedimos que nos confirme, respondiendo a este mismo correo, qué fecha de las dos le resulta más conveniente, para poder organizar la actividad.',
      '',
      'Le compartimos el link a los aranceles vigentes:',
      '{{url_aranceles}}',
      '',
      'Quedamos a disposición para cualquier consulta adicional y esperamos su confirmación para coordinar el encuentro.',
      '',
      'Saludos cordiales,',
      '',
      'Eliana Waichman',
      'Directora',
      'Jardín San Carlos Diálogos'
    ].join('\n')
  },
  {
    id: 'inicial-individual',
    nivel: 'Inicial',
    nombre: 'Inicial — entrevista individual (por defecto)',
    condicion: '*',
    prioridad: 99,
    activa: true,
    asunto: 'Admisión {{alumno_nombre}} / {{grado_solicitado}} / {{anio_vacante}}',
    cuerpo: [
      'Estimada/o {{tutor1_nombre}}:',
      '',
      'Nos comunicamos desde el Jardín del Colegio San Carlos Diálogos en relación a su consulta para conocer nuestra propuesta educativa para {{alumno_nombre}}, aspirante a {{grado_solicitado}} en el ciclo lectivo {{anio_vacante}}.',
      '',
      'Le agradecemos el interés en nuestra institución. Será un placer coordinar una entrevista personal para poder compartir nuestro proyecto pedagógico, recorrer las instalaciones y conocer más acerca de su hijo/a y de su familia.',
      '',
      'Para organizar el encuentro, le pedimos por favor que nos indique su disponibilidad en días y horarios por la mañana, respondiendo a este mismo correo, así podremos acordar una fecha conveniente.',
      '',
      'Le compartimos el link a los aranceles vigentes:',
      '{{url_aranceles}}',
      '',
      'Quedamos a disposición para cualquier consulta adicional y esperamos su respuesta para coordinar la visita.',
      '',
      'Saludos cordiales,',
      '',
      'Eliana Waichman',
      'Directora',
      'Jardín San Carlos Diálogos'
    ].join('\n')
  },
  {
    id: 'primaria-inclusion',
    nivel: 'Primaria',
    nombre: 'Primaria — sin vacante de inclusión',
    condicion: 'inclusion_solicitada == true',
    prioridad: 10,
    activa: true,
    asunto: '{{alumno_nombre}} - {{grado_solicitado}} ({{anio_vacante}})',
    cuerpo: [
      'Estimado/a {{tutor1_nombre}}:',
      '',
      'Nos comunicamos desde el Colegio San Carlos Diálogos en relación a la postulación de {{alumno_nombre}}.',
      '',
      'Gracias por el interés en nuestra institución y por acercarse a conocer nuestro proyecto. Queremos compartirles que, para el ciclo lectivo {{anio_vacante}}, no contamos con disponibilidad de vacante en {{grado_solicitado}} para alumnos/as con necesidad de un proyecto de inclusión.',
      '',
      'Nuestros grupos son reducidos y se conforman cuidando especialmente la diversidad y el acompañamiento personalizado de cada niño y niña. Para poder sostener una propuesta de inclusión genuina y responsable, las vacantes con proyecto de inclusión son limitadas y, en este grado, ya se encuentran cubiertas.',
      '',
      'De todos modos, si lo desean, queda abierta la posibilidad de mantener una entrevista como espacio de encuentro y conversación. En ese caso, les pedimos que nos respondan a este mail comentándonos sus disponibilidades de días y horarios por la mañana.',
      '',
      'Asimismo, si antes de agendar la entrevista quieren hacer alguna consulta o compartir información, pueden responderme a este correo. Estoy a disposición.',
      '',
      'Les compartimos también el enlace a los aranceles vigentes, para que cuenten con esa información:',
      '{{url_aranceles}}',
      '',
      'Saludos,',
      'Rocío Halperin',
      'Directora General – Nivel Primario',
      'Colegio San Carlos Diálogos'
    ].join('\n')
  },
  {
    id: 'primaria-estandar',
    nivel: 'Primaria',
    nombre: 'Primaria — entrevista inicial (por defecto)',
    condicion: '*',
    prioridad: 99,
    activa: true,
    asunto: '{{alumno_nombre}} - {{grado_solicitado}} ({{anio_vacante}})',
    cuerpo: [
      'Estimado/a {{tutor1_nombre}}:',
      '',
      'Nos comunicamos desde el Colegio San Carlos Diálogos en relación a la postulación de {{alumno_nombre}} para {{grado_solicitado}} del año {{anio_vacante}}.',
      '',
      'Gracias por el interés en nuestra propuesta. Nos gustaría poder coordinar una entrevista inicial, pensada como un primer encuentro para conocernos, escuchar su recorrido familiar y compartirles nuestra mirada y proyecto educativo.',
      '',
      'Para organizarla de manera ágil, les pedimos que nos respondan a este correo indicándonos qué días y horarios tendrían disponibles por la mañana para realizar el encuentro.',
      '',
      'Queremos aclarar que, en esta primera instancia, la entrevista se realiza únicamente con adultos. De todos modos, si antes de agendar necesitan hacer alguna consulta o conversar algo puntual, pueden responderme a este correo. Estoy a disposición.',
      '',
      'También les compartimos el enlace a los aranceles vigentes, para que cuenten con esa información desde el inicio:',
      '{{url_aranceles}}',
      '',
      'Quedo atenta y será un gusto encontrarnos.',
      '',
      'Saludos,',
      'Rocío Halperin',
      'Directora General – Nivel Primario',
      'Colegio San Carlos Diálogos'
    ].join('\n')
  }
];

// Permite testear las funciones puras con node. Apps Script ignora esta línea
// porque `module` no existe en su runtime.
if (typeof module !== 'undefined' && module.exports) {
  Object.assign(module.exports, {
    evaluarCondicion: evaluarCondicion,
    elegirPlantilla: elegirPlantilla,
    renderizar: renderizar,
    renderizarPlantilla: renderizarPlantilla,
    PLANTILLAS_INICIALES: PLANTILLAS_INICIALES
  });
}
