/**
 * Admisiones — Colegio San Carlos Diálogos
 *
 * ARCHIVO GENERADO. No editar acá: los cambios se pisan en el próximo
 * build. El código vive en apps-script/, un archivo por módulo.
 *
 *     https://github.com/aulatechsc/admisiones
 *
 * Para regenerarlo: npm run bundle
 */

// ====================================================================
// util.gs
// ====================================================================

/**
 * Utilidades compartidas.
 *
 * Todo lo que usan varios módulos vive acá, y este archivo no depende de
 * ninguno de ellos. Antes estas funciones estaban repartidas — `leerHoja_` en
 * ingesta.gs, `aBooleano` en plantillas.gs — y eso hacía que la capa de datos
 * dependiera de la de ingesta, que es al revés de lo que corresponde. Si
 * ingesta.gs no cargaba, se caía todo el sitio con un ReferenceError.
 *
 * En Apps Script todos los .gs comparten el mismo scope global, así que el
 * orden de los archivos no importa para que esto funcione; lo que importa es
 * que la dependencia sea legible y que ningún módulo base dependa de uno de
 * arriba.
 */

// ───────────────────────────────────────────────────────────────────
// Normalización de valores
// ───────────────────────────────────────────────────────────────────

/**
 * Lleva a booleano los muchos formatos que conviven en las planillas.
 * Relevados: TRUE/FALSE (checkbox), "Sí"/"No" (formulario), "true"/"false".
 * Devuelve null si el valor no representa un booleano.
 */
function aBooleano(valor) {
  if (valor === true || valor === false) return valor;
  if (valor === null || valor === undefined) return null;

  var t = valor.toString().trim().toLowerCase();
  if (t === 'true' || t === 'sí' || t === 'si' || t === 'x') return true;
  if (t === 'false' || t === 'no' || t === '') return false;
  return null;
}

/** Devuelve el valor como número, o null si no es numérico. */
function aNumero(valor) {
  if (typeof valor === 'number') return isNaN(valor) ? null : valor;
  if (valor === null || valor === undefined) return null;

  var t = valor.toString().trim();
  if (t === '') return null;
  var n = Number(t);
  return isNaN(n) ? null : n;
}

/**
 * Lleva una fecha a texto ISO estable.
 *
 * La planilla del sitio guarda `Fecha de envío` con `new Date()`, así que
 * vuelve como Date; el resto de los campos vienen como texto ya formateado.
 * La huella de la ingesta depende de esto, así que tiene que dar siempre lo
 * mismo para el mismo instante.
 */
function normalizarFecha(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  if (valor instanceof Date) {
    return isNaN(valor.getTime()) ? '' : valor.toISOString();
  }
  return valor.toString().trim();
}

/** Saca tildes y pasa a minúsculas, para comparar texto sin depender de cómo se tipeó. */
function normalizarParaComparar(texto) {
  if (texto === null || texto === undefined) return '';
  return texto.toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// ───────────────────────────────────────────────────────────────────
// Acceso a planillas
// ───────────────────────────────────────────────────────────────────

/** Devuelve la solapa por nombre, con un error claro si falta. */
function hoja_(nombre) {
  var h = SpreadsheetApp.getActive().getSheetByName(nombre);
  if (!h) throw new Error('Falta la solapa "' + nombre + '". Corré setup() primero.');
  return h;
}

/** Lee una solapa entera como { encabezados, filas }. */
function leerHoja_(hoja) {
  var valores = hoja.getDataRange().getValues();
  if (valores.length === 0) return { encabezados: [], filas: [] };
  return {
    encabezados: valores[0].map(function (e) {
      return (e === null || e === undefined) ? '' : e.toString().trim();
    }),
    filas: valores.slice(1)
  };
}

/**
 * Mapa nombre de columna → número de columna real en la solapa (base 1).
 *
 * Toda escritura tiene que pasar por acá. Usar la posición dentro de
 * COLUMNAS_* parece equivalente y no lo es: migrarEsquema() agrega las
 * columnas nuevas al final de la solapa, mientras que en la lista del código
 * van en su lugar lógico. En cuanto los dos órdenes dejan de coincidir, cada
 * campo posterior se escribe una columna corrida — que fue justo el problema
 * de los scripts viejos, con sus columnas fijas C/T/Y.
 *
 * Una columna que está en el código pero todavía no en la solapa queda fuera
 * del mapa, y quien escribe la saltea en vez de pisar la de al lado.
 */
function indicesDe_(hoja) {
  var encabezados = hoja.getRange(1, 1, 1, Math.max(hoja.getLastColumn(), 1))
    .getValues()[0];

  var mapa = {};
  encabezados.forEach(function (e, i) {
    var nombre = (e === null || e === undefined) ? '' : e.toString().trim();
    if (nombre && !(nombre in mapa)) mapa[nombre] = i + 1;
  });
  return mapa;
}

/** Convierte las filas de una solapa en objetos usando sus encabezados. */
function filasAObjetos_(encabezados, filas) {
  return filas.map(function (fila) {
    var o = {};
    encabezados.forEach(function (nombre, i) {
      if (nombre) o[nombre] = fila[i];
    });
    return o;
  });
}

// ───────────────────────────────────────────────────────────────────
// Fechas
// ───────────────────────────────────────────────────────────────────

/**
 * Interpreta las fechas que guardan las planillas: Date, dd/mm/aaaa (lo que
 * escribe el formulario del sitio) o ISO. Devuelve null si no es ninguna.
 */
function aFecha(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;

  var t = valor.toString().trim();
  if (t === '') return null;

  var m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    var d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  var iso = new Date(t);
  return isNaN(iso.getTime()) ? null : iso;
}

/**
 * Formatea una fecha como dd/mm/aaaa.
 *
 * Es lo que se guarda en la planilla para las fechas de nacimiento. Sin esto,
 * una columna con formato de fecha vuelve como Date y `toString()` la escribe
 * como "Wed Dec 04 2024 00:00:00 GMT-0300 (Argentina Standard Time)" — que es
 * lo que quedaba grabado y se veía en la planilla.
 *
 * Se arma a mano en vez de con Utilities.formatDate para poder testearlo sin
 * Apps Script. Lo que no es fecha vuelve como texto, tal cual vino.
 */
function formatearFechaCorta(valor) {
  var d = aFecha(valor);
  if (!d) return (valor === null || valor === undefined) ? '' : valor.toString().trim();

  var dia = d.getDate();
  var mes = d.getMonth() + 1;
  return (dia < 10 ? '0' : '') + dia + '/' + (mes < 10 ? '0' : '') + mes + '/' + d.getFullYear();
}

/** Días enteros entre dos fechas, ignorando la hora. */
function diasEntre(desde, hasta) {
  var a = aFecha(desde);
  if (!a) return null;
  var b = hasta || new Date();

  var ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  var ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

// ====================================================================
// config.gs
// ====================================================================

/**
 * Configuración y esquema de la planilla única de Admisiones.
 *
 * Este archivo define las solapas y sus columnas en un solo lugar: el setup
 * las crea desde acá y la ingesta escribe usando los mismos nombres, así que
 * agregar un campo es tocar una sola lista.
 *
 * Nada acá toca SpreadsheetApp — se testea con node.
 */

/**
 * ID de la planilla "Admisiones - Respuestas Sitio Web", de donde entran las
 * solicitudes nuevas. Es la que ya reciben los 3 formularios del sitio.
 */
var ID_PLANILLA_SITIO = '1tC32nHKkFDbQTjtBwRkI3zWUVy_D9rVfgMA35O0k9t8';

var NIVELES = ['Inicial', 'Primaria', 'Secundaria'];

var HOJAS = {
  ADMISIONES: 'Admisiones',
  EVENTOS: 'Eventos',
  USUARIOS: 'Usuarios',
  PLANTILLAS: 'Plantillas',
  ESTADOS: 'Estados'
};

/**
 * Columnas de `Admisiones`. Una fila por postulante, con `nivel` como columna
 * en vez de una solapa por nivel.
 *
 * `huella` es lo que vuelve idempotente a la ingesta: identifica la solicitud
 * de origen para no volver a importarla en cada corrida. No se edita a mano.
 */
var COLUMNAS_ADMISIONES = [
  'id',
  'nivel',
  'estado',
  'fecha_alta',
  'origen',
  'huella',
  'alumno_nombre',
  'alumno_fecha_nac',
  'alumno_dni',
  'grado_solicitado',
  'grado_actual',
  'anio_vacante',
  'escuela_actual',
  'motivo_cambio',
  'bilingue',
  'inclusion_solicitada',
  'trayectoria_texto',
  'tutor1_nombre',
  'tutor1_profesion',
  'tutor2_nombre',
  'tutor2_profesion',
  'celular',
  'email',
  'como_conocio',
  'comentarios',
  'motivo_no_matriculacion',
  'lista_espera',
  'estado_previo',
  'responsable',
  'thread_id',
  'pdf_url',
  'actualizado'
];

/**
 * Columnas de `Eventos`. Log append-only: nada se edita ni se borra, sólo se
 * agrega. Es lo que permite ver el recorrido completo de una admisión.
 */
var COLUMNAS_EVENTOS = [
  'id',
  'id_admision',
  'timestamp',
  'tipo',
  'usuario',
  'asunto',
  'detalle',
  'thread_id',
  'message_id',
  'anulado'
];

/**
 * `llamada` está porque Secundaria hace el primer contacto por teléfono. Sin
 * ese tipo de evento su recorrido queda vacío y el sistema no le sirve.
 */
var TIPOS_EVENTO = [
  'alta',
  'mail_enviado',
  'mail_recibido',
  'llamada',
  'cambio_estado',
  'nota',
  'pdf_generado'
];

var COLUMNAS_USUARIOS = ['email', 'nombre', 'niveles', 'rol', 'activo'];

var COLUMNAS_ESTADOS = ['id', 'nombre', 'orden', 'terminal', 'color'];

/**
 * Pipeline de admisión. Replica el que las tres planillas ya usan de hecho
 * con las columnas Agendó entrevista / Asistió entrevista / Visita / Matriculó,
 * pero como un estado único: así no pueden convivir combinaciones imposibles
 * (matriculado sin entrevista) y cada transición queda fechada en `Eventos`.
 */
var ESTADOS_INICIALES = [
  { id: 'nueva',              nombre: 'Nueva',                orden: 10, terminal: false, color: '#e6effe' },
  { id: 'contactada',         nombre: 'Contactada',           orden: 20, terminal: false, color: '#ddeef5' },
  { id: 'entrevista_agendada',nombre: 'Entrevista agendada',  orden: 30, terminal: false, color: '#fff3cd' },
  { id: 'entrevista_hecha',   nombre: 'Entrevista realizada', orden: 40, terminal: false, color: '#fff3cd' },
  { id: 'visita',             nombre: 'Visita',               orden: 50, terminal: false, color: '#fce8b2' },
  { id: 'matriculada',        nombre: 'Matriculada',          orden: 60, terminal: true,  color: '#d9ead3' },
  { id: 'lista_espera',       nombre: 'Lista de espera',      orden: 70, terminal: false, color: '#f4f4f4' },
  { id: 'sin_vacante',        nombre: 'Sin vacante',          orden: 80, terminal: true,  color: '#f4cccc' },
  { id: 'desistio',           nombre: 'Desistió',             orden: 90, terminal: true,  color: '#f4f4f4' }
];

var ESTADO_INICIAL = 'nueva';

/**
 * Mapeo de la planilla del sitio al esquema unificado.
 *
 * Las claves son los encabezados exactos de cada solapa de "Admisiones -
 * Respuestas Sitio Web" (ver SHEETS_CONFIG en legacy/sitio-web.gs); los
 * valores, la columna destino en `Admisiones`.
 *
 * Los tres niveles piden cosas distintas, así que cada uno tiene su mapeo.
 * `comun` junta lo que comparten.
 */
var MAPEO_SITIO = {
  comun: {
    'Fecha de envío': 'fecha_alta',
    'Email': 'email',
    'Celular de contacto': 'celular',
    'Padre/Madre/Tutor 1': 'tutor1_nombre',
    'Padre/Madre/Tutor 2': 'tutor2_nombre',
    'Fecha de nacimiento': 'alumno_fecha_nac',
    'Motivo del cambio': 'motivo_cambio',
    'Año de vacante solicitada': 'anio_vacante',
    'Cómo llegó': 'como_conocio'
  },
  Inicial: {
    'Profesión Tutor 1': 'tutor1_profesion',
    'Profesión Tutor 2': 'tutor2_profesion',
    'Nombre del/la postulante': 'alumno_nombre',
    'Sala actual': 'grado_actual',
    'Jardín actual': 'escuela_actual',
    'Trayectoria escolar actual': 'trayectoria_texto',
    'Sala solicitada': 'grado_solicitado',
    'Comentarios adicionales': 'comentarios'
  },
  Primaria: {
    'Profesión Tutor 1': 'tutor1_profesion',
    'Profesión Tutor 2': 'tutor2_profesion',
    'Nombre del/la postulante': 'alumno_nombre',
    'Grado actual': 'grado_actual',
    'Colegio actual': 'escuela_actual',
    'Bilingüe inglés': 'bilingue',
    'Trayectoria escolar actual': 'trayectoria_texto',
    'Grado solicitado': 'grado_solicitado'
  },
  Secundaria: {
    'Nombre del/la estudiante': 'alumno_nombre',
    'Curso actual': 'grado_actual',
    'Colegio actual': 'escuela_actual',
    'Bilingüe inglés': 'bilingue',
    'Solicita proyecto de inclusión': 'inclusion_solicitada',
    'Curso solicitado': 'grado_solicitado'
  }
};


/**
 * Remitente de todos los mails a las familias.
 *
 * `admision@sancarlos.edu.ar` tiene que estar configurado como alias de envío
 * de la cuenta que corre el script (Gmail > Configuración > Cuentas > "Enviar
 * como"). Si no, Gmail rechaza el From y el envío falla.
 */
var REMITENTE = {
  email: 'admision@sancarlos.edu.ar',
  nombre: 'Admisiones - Colegio San Carlos Diálogos'
};

/**
 * Interruptor del aviso automático a las directoras cuando entra una
 * admisión nueva.
 *
 * En false mientras el sistema se termina de armar: hasta entonces las
 * importaciones son de prueba y no tiene sentido que cada una dispare mails
 * al equipo. El aviso ya está escrito y probado — pasar esto a true lo
 * enciende, sin tocar nada más.
 *
 * Los mails a las familias NO dependen de esto: ésos salen sólo cuando
 * alguien toca "Enviar" en el sitio.
 */
var AVISAR_NUEVAS_ADMISIONES = false;

/**
 * Quién recibe copia de cada mail, por nivel, y sigue la conversación con la
 * familia desde su propia bandeja.
 *
 * Estas direcciones van en Cc y también en Reply-To junto con el remitente.
 * El Reply-To con dos destinos es lo que hace que funcione: cuando la familia
 * toca "Responder", la respuesta llega a la directora (que sigue desde ahí) y
 * a admision@ (que la registra en Eventos). Con un solo Reply-To hay que
 * elegir entre una cosa o la otra.
 */
var COPIAS_POR_NIVEL = {
  Inicial: ['elianawaichman@sancarlos.edu.ar'],
  Primaria: ['rhalperin@sancarlos.edu.ar'],
  Secundaria: [
    'andreapandolfo@sancarlos.edu.ar',
    'karina_d@sancarlos.edu.ar',
    'secretariasecundaria@sancarlos.edu.ar'
  ]
};

/** Campos que se guardan como booleano, vengan como "Sí"/"No" o TRUE/FALSE. */
var CAMPOS_BOOLEANOS = ['bilingue', 'inclusion_solicitada', 'lista_espera'];

/**
 * Campos que se guardan y se muestran como dd/mm/aaaa.
 *
 * Cuando la columna de origen tiene formato de fecha, getValues() devuelve un
 * Date y toString() lo escribe como "Wed Dec 04 2024 00:00:00 GMT-0300
 * (Argentina Standard Time)". La ingesta los formatea al escribir y la lectura
 * los normaliza otra vez, por si quedó alguno viejo sin limpiar.
 */
var CAMPOS_FECHA_CORTA = ['alumno_fecha_nac'];

/**
 * Opciones del campo "Trayectoria escolar actual" en los formularios de
 * Inicial y Primaria.
 *
 * Esos dos niveles no tienen una pregunta directa de inclusión: la respuesta
 * está acá. Sólo la primera opción cuenta como proyecto de inclusión.
 * Secundaria sí pregunta directo ("Solicita proyecto de inclusión").
 *
 * OJO: la opción del medio contiene la frase "proyecto de inclusión" dentro de
 * una negación. Buscar "inclusión" por substring da un falso positivo y manda
 * la negativa de vacante a una familia que declaró exactamente lo contrario.
 * Por eso derivarInclusion() descarta la negación antes de buscar nada más.
 */
var TRAYECTORIAS = {
  CON_INCLUSION: 'Mi hijo/a cuenta con un proyecto de inclusión y equipo de apoyo (MAI/AP/AE).',
  TERAPIAS_EXTERNAS: 'Mi hijo/a no tiene proyecto de inclusión, pero recibe terapias externas (fonoaudiología, psicopedagogía, etc.).',
  SIN_APOYOS: 'Mi hijo/a realiza una trayectoria escolar de nivel sin apoyos externos.'
};

// ====================================================================
// plantillas.gs
// ====================================================================

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

// ====================================================================
// datos.gs
// ====================================================================

/**
 * Acceso a la planilla: leer y escribir admisiones, eventos y usuarios.
 *
 * Todo lo que toca SpreadsheetApp pasa por acá, así el resto del código
 * trabaja con objetos y no con índices de columna — que es justamente lo que
 * hace frágiles a los scripts viejos.
 *
 * Los helpers genéricos (hoja_, leerHoja_, filasAObjetos_) están en util.gs.
 */
// ───────────────────────────────────────────────────────────────────
// Admisiones
// ───────────────────────────────────────────────────────────────────

/** Pasa a texto dd/mm/aaaa los campos de fecha de una admisión. */
function normalizarFechasVisibles_(a) {
  CAMPOS_FECHA_CORTA.forEach(function (campo) {
    var d = aFecha(a[campo]);
    if (d) a[campo] = Utilities.formatDate(d, 'GMT-3', 'dd/MM/yyyy');
  });

  // fecha_alta viaja en ISO: el sitio la formatea y además ordena por ella.
  var alta = aFecha(a.fecha_alta);
  if (alta) a.fecha_alta = alta.toISOString();

  return a;
}

/** Todas las admisiones, opcionalmente filtradas por nivel y estado. */
function leerAdmisiones(filtros) {
  filtros = filtros || {};
  var datos = leerHoja_(hoja_(HOJAS.ADMISIONES));
  var todas = filasAObjetos_(datos.encabezados, datos.filas)
    .filter(function (a) { return a.id; })
    .map(normalizarFechasVisibles_);

  if (filtros.niveles && filtros.niveles.length) {
    todas = todas.filter(function (a) { return filtros.niveles.indexOf(a.nivel) !== -1; });
  }
  if (filtros.estado) {
    todas = todas.filter(function (a) { return a.estado === filtros.estado; });
  }
  if (filtros.anio) {
    todas = todas.filter(function (a) { return a.anio_vacante.toString() === filtros.anio.toString(); });
  }
  if (filtros.texto) {
    var q = normalizarParaComparar(filtros.texto);
    todas = todas.filter(function (a) {
      return normalizarParaComparar(a.alumno_nombre).indexOf(q) !== -1 ||
             normalizarParaComparar(a.tutor1_nombre).indexOf(q) !== -1 ||
             normalizarParaComparar(a.email).indexOf(q) !== -1;
    });
  }

  // Las más nuevas arriba: es el orden en que se trabaja, porque lo que entró
  // hoy es lo que todavía no contestó nadie.
  todas.sort(function (x, y) {
    var fx = aFecha(x.fecha_alta), fy = aFecha(y.fecha_alta);
    if (!fx && !fy) return 0;
    if (!fx) return 1;
    if (!fy) return -1;
    return fy.getTime() - fx.getTime();
  });

  return todas;
}

/**
 * Hace cuánto que una admisión está esperando algo, y de quién.
 *
 * No alcanza con "días desde el alta": una familia a la que le escribimos
 * ayer y otra que nos respondió hace una semana necesitan cosas distintas.
 * Distingue tres situaciones:
 *
 *   sin_contactar  — entró y todavía nadie le escribió
 *   esperando      — le escribimos y no contestó
 *   nos_responden  — contestó y la pelota está de nuestro lado
 *
 * Una admisión en estado terminal (matriculada, sin vacante, desistió) no
 * espera nada, así que no muestra contador.
 */
function calcularEspera(admision, eventos, ahora) {
  var terminales = { matriculada: 1, sin_vacante: 1, desistio: 1 };
  if (terminales[admision.estado]) return { tipo: 'cerrada', dias: null };

  var ultimoNuestro = null;
  var ultimoDeEllos = null;

  (eventos || []).forEach(function (e) {
    if (aBooleano(e.anulado) === true) return;
    var f = aFecha(e.timestamp);
    if (!f) return;
    if (e.tipo === 'mail_enviado') {
      if (!ultimoNuestro || f > ultimoNuestro) ultimoNuestro = f;
    } else if (e.tipo === 'mail_recibido') {
      if (!ultimoDeEllos || f > ultimoDeEllos) ultimoDeEllos = f;
    }
  });

  if (!ultimoNuestro && !ultimoDeEllos) {
    return { tipo: 'sin_contactar', dias: diasEntre(admision.fecha_alta, ahora) };
  }
  if (ultimoDeEllos && (!ultimoNuestro || ultimoDeEllos > ultimoNuestro)) {
    return { tipo: 'nos_responden', dias: diasEntre(ultimoDeEllos, ahora) };
  }
  return { tipo: 'esperando', dias: diasEntre(ultimoNuestro, ahora) };
}

/** Todos los eventos agrupados por admisión, en una sola lectura. */
function eventosPorAdmision() {
  var datos = leerHoja_(hoja_(HOJAS.EVENTOS));
  var mapa = {};
  filasAObjetos_(datos.encabezados, datos.filas).forEach(function (e) {
    if (!e.id_admision) return;
    if (!mapa[e.id_admision]) mapa[e.id_admision] = [];
    mapa[e.id_admision].push(e);
  });
  return mapa;
}

function obtenerAdmision(id) {
  var todas = leerAdmisiones();
  for (var i = 0; i < todas.length; i++) {
    if (todas[i].id === id) return todas[i];
  }
  return null;
}

/** Fila de una admisión en la planilla, o -1. Fila 1 son los encabezados. */
function filaDeAdmision_(hoja, id) {
  var colId = indicesDe_(hoja)['id'];
  if (!colId) throw new Error('La solapa ' + HOJAS.ADMISIONES + ' no tiene columna "id".');

  var ids = hoja.getRange(2, colId, Math.max(hoja.getLastRow() - 1, 1), 1)
    .getValues()
    .map(function (f) { return f[0].toString(); });
  var i = ids.indexOf(id.toString());
  return i === -1 ? -1 : i + 2;
}

/**
 * Actualiza sólo los campos indicados de una admisión.
 *
 * Escribe celda por celda y no la fila entera a propósito: si dos personas
 * editan la misma admisión desde el sitio, cada una pisa su campo en vez de
 * revertir los del otro con una copia vieja de la fila.
 */
function actualizarAdmision(id, cambios) {
  var hoja = hoja_(HOJAS.ADMISIONES);
  var fila = filaDeAdmision_(hoja, id);
  if (fila === -1) throw new Error('No existe la admisión ' + id);

  var cols = indicesDe_(hoja);

  Object.keys(cambios).forEach(function (campo) {
    if (!cols[campo]) return;
    hoja.getRange(fila, cols[campo]).setValue(cambios[campo]);
  });

  if (cols.actualizado) hoja.getRange(fila, cols.actualizado).setValue(new Date().toISOString());

  return obtenerAdmision(id);
}

/** Estados de los que no se vuelve: cierran el proceso. */
var ESTADOS_TERMINALES = ['matriculada', 'sin_vacante', 'desistio'];

/**
 * Cambia el estado y lo deja asentado en Eventos.
 *
 * Al pasar a un estado terminal guarda de dónde venía en `estado_previo`:
 * saber que una familia desistió sirve poco, saber que desistió *después de
 * la entrevista* dice algo muy distinto que si desistió sin que la
 * contactaran.
 */
function cambiarEstado(id, nuevoEstado, nota) {
  var estados = leerEstados();
  var valido = estados.some(function (e) { return e.id === nuevoEstado; });
  if (!valido) throw new Error('Estado desconocido: ' + nuevoEstado);

  var antes = obtenerAdmision(id);
  if (!antes) throw new Error('No existe la admisión ' + id);
  if (antes.estado === nuevoEstado) return antes;

  var cambios = { estado: nuevoEstado };
  if (ESTADOS_TERMINALES.indexOf(nuevoEstado) !== -1) {
    cambios.estado_previo = antes.estado;
  } else {
    // Al salir de un estado terminal el dato deja de tener sentido.
    cambios.estado_previo = '';
  }
  actualizarAdmision(id, cambios);

  registrarEvento({
    id_admision: id,
    tipo: 'cambio_estado',
    usuario: usuarioActual(),
    asunto: antes.estado + ' → ' + nuevoEstado,
    detalle: nota || ''
  });

  return obtenerAdmision(id);
}

/**
 * Deshace un cambio de estado mal hecho.
 *
 * Vuelve la admisión al estado anterior y marca el evento como anulado, pero
 * no borra la fila: el log de Eventos es el registro de qué pasó con cada
 * familia, y ante un reclamo importa poder reconstruirlo. El sitio oculta lo
 * anulado, así que en la práctica desaparece de la vista.
 *
 * El estado anterior sale del asunto del propio evento ("nueva → contactada"),
 * que es el que se escribió al hacer el cambio.
 */
function deshacerCambioEstado(idEvento) {
  var hoja = hoja_(HOJAS.EVENTOS);
  var datos = leerHoja_(hoja);
  var eventos = filasAObjetos_(datos.encabezados, datos.filas);

  var fila = -1;
  var evento = null;
  for (var i = 0; i < eventos.length; i++) {
    if (eventos[i].id === idEvento) {
      evento = eventos[i];
      fila = i + 2; // +1 por el encabezado, +1 porque las filas arrancan en 1
      break;
    }
  }

  if (!evento) throw new Error('No existe el evento ' + idEvento);
  if (evento.tipo !== 'cambio_estado') {
    throw new Error('Sólo se pueden deshacer los cambios de estado.');
  }
  if (aBooleano(evento.anulado) === true) {
    throw new Error('Ese cambio ya estaba deshecho.');
  }

  var partes = (evento.asunto || '').split('→');
  if (partes.length !== 2) {
    throw new Error('No se puede saber a qué estado volver: "' + evento.asunto + '"');
  }
  var estadoAnterior = partes[0].trim();

  var estados = leerEstados();
  if (!estados.some(function (e) { return e.id === estadoAnterior; })) {
    throw new Error('El estado anterior "' + estadoAnterior + '" ya no existe.');
  }

  var colAnulado = indicesDe_(hoja)['anulado'];
  if (!colAnulado) {
    throw new Error('Falta la columna "anulado" en Eventos. Corré migrarEsquema().');
  }
  hoja.getRange(fila, colAnulado).setValue(true);

  var admision = obtenerAdmision(evento.id_admision);
  if (admision) {
    var cambios = { estado: estadoAnterior };
    if (ESTADOS_TERMINALES.indexOf(estadoAnterior) === -1) cambios.estado_previo = '';
    actualizarAdmision(evento.id_admision, cambios);
  }

  return { ok: true, estado: estadoAnterior };
}

// ───────────────────────────────────────────────────────────────────
// Eventos
// ───────────────────────────────────────────────────────────────────

/**
 * Eventos de una admisión, del más nuevo al más viejo.
 * Los anulados quedan en la planilla pero no se muestran.
 */
function leerEventos(idAdmision) {
  var datos = leerHoja_(hoja_(HOJAS.EVENTOS));
  return filasAObjetos_(datos.encabezados, datos.filas)
    .filter(function (e) {
      return e.id_admision === idAdmision && aBooleano(e.anulado) !== true;
    })
    .sort(function (a, b) {
      return (b.timestamp || '').toString().localeCompare((a.timestamp || '').toString());
    });
}

/**
 * Agrega un evento al log. Nunca lanza: perder un evento es malo, pero que
 * una falla de log haga fallar el envío de un mail o una importación es peor.
 */
function registrarEvento(evento) {
  try {
    var hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.EVENTOS);
    if (!hoja) return;

    // Se arma según los encabezados reales, no según COLUMNAS_EVENTOS: si la
    // solapa tiene otro orden, appendRow escribiría cada valor corrido.
    var encabezados = hoja.getRange(1, 1, 1, Math.max(hoja.getLastColumn(), 1))
      .getValues()[0]
      .map(function (e) { return (e === null || e === undefined) ? '' : e.toString().trim(); });

    var fila = encabezados.map(function (c) {
      if (c === 'id') return Utilities.getUuid();
      if (c === 'timestamp') return evento.timestamp || new Date().toISOString();
      var v = evento[c];
      return (v === undefined || v === null) ? '' : v;
    });
    hoja.appendRow(fila);
  } catch (err) {
    console.error('No se pudo registrar el evento: ' + err);
  }
}

/** Deja registrada una llamada telefónica. Es el primer contacto en Secundaria. */
function registrarLlamada(idAdmision, detalle) {
  if (!obtenerAdmision(idAdmision)) throw new Error('No existe la admisión ' + idAdmision);

  registrarEvento({
    id_admision: idAdmision,
    tipo: 'llamada',
    usuario: usuarioActual(),
    asunto: 'Llamada telefónica',
    detalle: detalle || ''
  });

  var a = obtenerAdmision(idAdmision);
  if (a.estado === ESTADO_INICIAL) {
    cambiarEstado(idAdmision, 'contactada', 'Cambio automático al registrar la llamada');
  }
  return { ok: true };
}

function agregarNota(idAdmision, texto) {
  if (!texto || !texto.toString().trim()) throw new Error('La nota está vacía.');
  if (!obtenerAdmision(idAdmision)) throw new Error('No existe la admisión ' + idAdmision);

  registrarEvento({
    id_admision: idAdmision,
    tipo: 'nota',
    usuario: usuarioActual(),
    asunto: 'Nota interna',
    detalle: texto
  });
  return { ok: true };
}

// ───────────────────────────────────────────────────────────────────
// Estados y usuarios
// ───────────────────────────────────────────────────────────────────

function leerEstados() {
  var datos = leerHoja_(hoja_(HOJAS.ESTADOS));
  return filasAObjetos_(datos.encabezados, datos.filas)
    .filter(function (e) { return e.id; })
    .sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
}

function leerUsuarios() {
  var datos = leerHoja_(hoja_(HOJAS.USUARIOS));
  return filasAObjetos_(datos.encabezados, datos.filas)
    .filter(function (u) { return u.email; })
    .map(function (u) {
      return {
        email: u.email.toString().trim().toLowerCase(),
        nombre: u.nombre,
        niveles: (u.niveles || '').toString().split(',')
          .map(function (n) { return n.trim(); })
          .filter(function (n) { return n; }),
        rol: (u.rol || 'editor').toString().trim(),
        activo: aBooleano(u.activo) !== false
      };
    });
}

/**
 * Quién está usando el sistema en esta ejecución.
 *
 * Lo fija `ejecutar()` con el mail ya verificado, y es lo que hace que el
 * recorrido diga quién hizo cada cosa.
 *
 * Servido por Apps Script, Session.getActiveUser() alcanzaría. Desde Vercel
 * no: no hay sesión de Google en la llamada, así que devolvería vacío o la
 * cuenta dueña del script y todos los eventos quedarían firmados por
 * admision@ en lugar de por la persona.
 *
 * Cada ejecución de Apps Script es un scope aislado, así que esta variable
 * nunca se mezcla entre dos personas usando el sitio a la vez.
 */
var USUARIO_EN_CURSO = '';

function fijarUsuarioActual(email) {
  USUARIO_EN_CURSO = email || '';
}

/** Mail de quien está usando el sistema. */
function usuarioActual() {
  if (USUARIO_EN_CURSO) return USUARIO_EN_CURSO;
  try {
    return Session.getActiveUser().getEmail() || 'sistema';
  } catch (err) {
    return 'sistema';
  }
}

/**
 * Devuelve el usuario si está habilitado, o null.
 *
 * Es el único control de acceso del sistema: si devuelve null, el sitio no
 * muestra nada. Por eso no alcanza con tener cuenta del colegio — hay que
 * estar cargado en la solapa `Usuarios` y con `activo` en TRUE.
 */
function autorizar(email) {
  if (!email) return null;
  var buscado = email.toString().trim().toLowerCase();
  var encontrados = leerUsuarios().filter(function (u) {
    return u.email === buscado && u.activo;
  });
  return encontrados.length ? encontrados[0] : null;
}

// ====================================================================
// fichas.gs
// ====================================================================

/**
 * Ficha de admisión en PDF.
 *
 * Réplica exacta de la ficha que generaba el script de Inicial, parametrizada
 * por nivel sólo en las etiquetas: "sala" contra "grado" contra "curso",
 * "jardín anterior" contra "colegio anterior".
 *
 * Sin campos de más. Una versión anterior sumaba edad, inclusión, trayectoria
 * y bilingüe, y eso desarmaba el layout: la ficha se imprime y se completa a
 * mano en la entrevista, así que el orden y el espacio en blanco son parte
 * del diseño, no un detalle estético.
 *
 * Los PDF van a una carpeta de Drive y el link queda guardado en la admisión.
 */

var CARPETA_FICHAS = 'Fichas de admisión';

var AZUL = '#00476c';
var AZUL_CLARO = '#ddeef5';
var BORDE = '#aac8d8';
var BLANCO = '#ffffff';

var ID_LOGO = '1IB4CJ_4RANoRyca47bVEMdsvzvzzx_CD';

/** Lo único que cambia entre niveles. El resto del layout es idéntico. */
var FICHA_POR_NIVEL = {
  Inicial: {
    titulo: 'DATOS DEL NIÑO / A',
    etiquetaGrado: 'SALA SOLICITADA',
    etiquetaEscuela: 'JARDÍN ANTERIOR',
    pie: 'Jardín San Carlos Diálogos  ·  Ficha confidencial de uso interno  ·  www.sancarlos.edu.ar'
  },
  Primaria: {
    titulo: 'DATOS DEL ALUMNO / A',
    etiquetaGrado: 'GRADO SOLICITADO',
    etiquetaEscuela: 'COLEGIO ANTERIOR',
    pie: 'Colegio San Carlos Diálogos  ·  Ficha confidencial de uso interno  ·  www.sancarlos.edu.ar'
  },
  Secundaria: {
    titulo: 'DATOS DEL / DE LA ESTUDIANTE',
    etiquetaGrado: 'CURSO SOLICITADO',
    etiquetaEscuela: 'COLEGIO ANTERIOR',
    pie: 'Colegio San Carlos Diálogos  ·  Ficha confidencial de uso interno  ·  www.sancarlos.edu.ar'
  }
};


function estiloCelda_(celda, bg, color, tam, negrita, italica, texto, alineacion) {
  celda.setBackgroundColor(bg);
  celda.setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(5).setPaddingRight(5);

  var p = celda.getChild(0).asParagraph();
  p.setAlignment(alineacion || DocumentApp.HorizontalAlignment.LEFT);
  p.setSpacingBefore(0).setSpacingAfter(0);

  var t = celda.editAsText();
  t.setText(texto || '');
  t.setFontFamily('Arial');
  t.setFontSize(tam);
  t.setBold(negrita || false);
  t.setItalic(italica || false);
  t.setForegroundColor(color);
  t.setBackgroundColor(null);
}

function carpetaFichas_() {
  var it = DriveApp.getFoldersByName(CARPETA_FICHAS);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA_FICHAS);
}

/**
 * Genera la ficha de una admisión y devuelve el link al PDF.
 *
 * Crea un Doc temporal, lo exporta y lo borra: es la única forma de armar un
 * PDF con este layout desde Apps Script.
 */
function generarFicha(idAdmision) {
  var a = obtenerAdmision(idAdmision);
  if (!a) throw new Error('No existe la admisión ' + idAdmision);
  if (!a.alumno_nombre) throw new Error('La admisión no tiene nombre de alumno.');

  var cfg = FICHA_POR_NIVEL[a.nivel] || FICHA_POR_NIVEL.Primaria;

  var doc = DocumentApp.create('Ficha de admisión - ' + a.alumno_nombre);
  var body = doc.getBody();
  body.setMarginTop(20).setMarginBottom(20).setMarginLeft(36).setMarginRight(36);
  body.clear();

  function espacio(px) {
    var p = body.appendParagraph('');
    p.setSpacingBefore(0).setSpacingAfter(0);
    p.editAsText().setFontSize(px).setBackgroundColor(null);
  }

  function tituloSeccion(texto) {
    var t = body.appendTable([[texto]]);
    t.setBorderColor(AZUL);
    t.setBorderWidth(0);
    var c = t.getRow(0).getCell(0);
    estiloCelda_(c, AZUL_CLARO, AZUL, 9, true, false, texto, DocumentApp.HorizontalAlignment.LEFT);
    c.setPaddingTop(0).setPaddingBottom(2).setPaddingLeft(6).setPaddingRight(6);
    c.editAsText().setBackgroundColor(null);
    t.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });
  }

  function filaCajas(cols) {
    var t = body.appendTable([
      cols.map(function (c) { return c.etiq; }),
      cols.map(function (c) { return c.val || ''; })
    ]);
    t.setBorderColor(BORDE);

    var rowE = t.getRow(0);
    var rowV = t.getRow(1);
    for (var i = 0; i < cols.length; i++) {
      estiloCelda_(rowE.getCell(i), AZUL_CLARO, AZUL, 7, true, false, cols[i].etiq);
      rowE.getCell(i).setPaddingTop(2).setPaddingBottom(2).setPaddingLeft(4).setPaddingRight(4);
      rowE.getCell(i).editAsText().setBackgroundColor(null);

      estiloCelda_(rowV.getCell(i), BLANCO, '#000000', 10, false, false, cols[i].val || '');
      rowV.getCell(i).setPaddingTop(4).setPaddingBottom(4).setPaddingLeft(4).setPaddingRight(4);
      rowV.getCell(i).editAsText().setBackgroundColor(null);
    }
    t.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });
  }

  function cajaObs() {
    var t = body.appendTable([['']]);
    t.setBorderColor(BORDE);
    var c = t.getRow(0).getCell(0);
    c.setBackgroundColor(BLANCO);
    c.setPaddingTop(30).setPaddingBottom(30).setPaddingLeft(4).setPaddingRight(4);
    c.editAsText().setText('').setBackgroundColor(null);
    t.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });
  }

  // ── Logo ── si falla, la ficha sale igual
  try {
    var logoBlob = DriveApp.getFileById(ID_LOGO).getBlob();
    var tLogo = body.appendTable([['']]);
    tLogo.setBorderWidth(0);
    tLogo.setBorderColor(BLANCO);
    var celdaLogo = tLogo.getRow(0).getCell(0);
    celdaLogo.setBackgroundColor(BLANCO);
    celdaLogo.setPaddingTop(0).setPaddingBottom(0).setPaddingLeft(4).setPaddingRight(4);
    var pLogo = celdaLogo.getChild(0).asParagraph();
    pLogo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    pLogo.setSpacingBefore(0).setSpacingAfter(0);
    var img = pLogo.appendInlineImage(logoBlob);
    img.setWidth(140);
    img.setHeight(140);
    tLogo.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });
  } catch (logoErr) {
    // continúa sin logo
  }

  // ── Encabezado: grado (año) ──
  espacio(2);
  var encabezado = a.grado_solicitado + '  (' + a.anio_vacante + ')';
  var tHead = body.appendTable([[encabezado]]);
  tHead.setBorderColor(AZUL);
  tHead.setBorderWidth(0);
  estiloCelda_(tHead.getRow(0).getCell(0), AZUL_CLARO, AZUL, 22, true, false,
    encabezado, DocumentApp.HorizontalAlignment.CENTER);
  tHead.getRow(0).getCell(0).setPaddingTop(0).setPaddingBottom(4);
  tHead.getRow(0).getCell(0).editAsText().setBackgroundColor(null);
  tHead.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });

  // ── Subtítulo ──
  espacio(2);
  var tSub = body.appendTable([['Ficha de Admisión']]);
  tSub.setBorderColor(AZUL);
  tSub.setBorderWidth(0);
  estiloCelda_(tSub.getRow(0).getCell(0), AZUL_CLARO, AZUL, 10, false, true,
    'Ficha de Admisión', DocumentApp.HorizontalAlignment.CENTER);
  tSub.getRow(0).getCell(0).setPaddingTop(5).setPaddingBottom(5);
  tSub.getRow(0).getCell(0).editAsText().setBackgroundColor(null);
  tSub.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });

  // ── Datos del alumno ──
  espacio(4);
  tituloSeccion(cfg.titulo);
  filaCajas([{ etiq: 'NOMBRE Y APELLIDO', val: a.alumno_nombre.toString().toUpperCase() }]);
  filaCajas([
    { etiq: 'FECHA DE NACIMIENTO', val: formatearFechaCorta(a.alumno_fecha_nac) },
    { etiq: 'DNI', val: a.alumno_dni || '' }
  ]);
  filaCajas([{ etiq: 'DIRECCIÓN', val: '' }]);
  filaCajas([{ etiq: cfg.etiquetaEscuela, val: a.escuela_actual || '' }]);

  // ── Responsable 1 ──
  espacio(4);
  tituloSeccion('PADRE · MADRE · TUTOR/A 1');
  filaCajas([{ etiq: 'NOMBRE Y APELLIDO', val: a.tutor1_nombre || '' }]);
  filaCajas([
    { etiq: 'PROFESIÓN', val: a.tutor1_profesion || '' },
    { etiq: 'CELULAR', val: a.celular || '' },
    { etiq: 'MAIL', val: a.email || '' }
  ]);

  // ── Responsable 2 ──
  espacio(4);
  tituloSeccion('PADRE · MADRE · TUTOR/A 2');
  filaCajas([{ etiq: 'NOMBRE Y APELLIDO', val: a.tutor2_nombre || '' }]);
  filaCajas([
    { etiq: 'PROFESIÓN', val: a.tutor2_profesion || '' },
    { etiq: 'CELULAR', val: '' },
    { etiq: 'MAIL', val: '' }
  ]);

  // ── Registro de admisión ──
  espacio(4);
  tituloSeccion('REGISTRO DE ADMISIÓN');
  filaCajas([
    { etiq: 'FECHA DE ADMISIÓN', val: '' },
    { etiq: 'REALIZADA POR', val: '' }
  ]);

  // ── Observaciones ──
  espacio(4);
  tituloSeccion('OBSERVACIONES');
  cajaObs();

  // ── Pie ──
  espacio(1);
  var tPie = body.appendTable([[cfg.pie]]);
  tPie.setBorderColor(AZUL);
  tPie.setBorderWidth(0);
  estiloCelda_(tPie.getRow(0).getCell(0), AZUL_CLARO, AZUL, 7, false, true, cfg.pie,
    DocumentApp.HorizontalAlignment.CENTER);
  tPie.getRow(0).getCell(0).setPaddingTop(4).setPaddingBottom(0);
  tPie.getRow(0).getCell(0).editAsText().setBackgroundColor(null);

  doc.saveAndClose();

  var pdf = DriveApp.getFileById(doc.getId())
    .getAs(MimeType.PDF)
    .setName('Ficha - ' + a.alumno_nombre + '.pdf');

  var archivo = carpetaFichas_().createFile(pdf);
  DriveApp.getFileById(doc.getId()).setTrashed(true);

  // Visible para cualquiera del colegio que tenga el link, no para internet.
  // La ficha lleva nombre, fecha de nacimiento y datos de contacto de un
  // menor: con ANYONE quedaría accesible a cualquiera que reciba o adivine
  // la URL, y sin login. Con DOMAIN alcanza para que la abra quien la
  // necesite dentro de sancarlos.edu.ar.
  try {
    archivo.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    console.warn('No se pudieron ajustar los permisos de la ficha: ' + err);
  }

  actualizarAdmision(idAdmision, { pdf_url: archivo.getUrl() });

  registrarEvento({
    id_admision: idAdmision,
    tipo: 'pdf_generado',
    usuario: usuarioActual(),
    asunto: 'Ficha generada',
    detalle: archivo.getUrl()
  });

  return { ok: true, url: archivo.getUrl(), nombre: archivo.getName() };
}

// ───────────────────────────────────────────────────────────────────
// Generación automática
// ───────────────────────────────────────────────────────────────────

/**
 * Cuántas fichas como mucho por ejecución, y cuánto tiempo pueden ocupar.
 *
 * Cada ficha crea un Doc, lo exporta a PDF y lo borra: entre 3 y 5 segundos.
 * Apps Script corta la ejecución a los 6 minutos, así que importar 50
 * admisiones de golpe y generarles la ficha a todas se pasaría del límite y
 * abortaría a mitad de camino. Con tope, lo que no entra queda pendiente y
 * sale en la corrida siguiente del trigger, 15 minutos después.
 */
var TOPE_FICHAS_POR_CORRIDA = 10;
var PRESUPUESTO_MS = 90000;

/**
 * Cuántas horas atrás mira el barrido automático.
 *
 * La ficha se genera sola sólo para las admisiones nuevas. Sin esta ventana,
 * el trigger tomaría todo el histórico sin ficha y generaría cientos de PDF
 * de familias que ya pasaron por admisión hace años — ruido en Drive y
 * consumo de cuota para nada.
 *
 * Las viejas se generan a demanda, con el botón de la ficha.
 */
var VENTANA_FICHAS_HORAS = 48;

/**
 * Genera las fichas que falten.
 *
 * Con `ids`, procesa esas puntualmente (lo que usa la ingesta con las recién
 * importadas). Sin `ids`, barre sólo las dadas de alta dentro de la ventana.
 *
 * Nunca lanza por una ficha suelta: si una falla, se registra y sigue con las
 * demás. La admisión ya está guardada, y una ficha se puede regenerar a mano
 * desde el sitio — perder la importación entera por un PDF sería peor.
 */
function generarFichasPendientes(ids) {
  var pendientes;

  if (ids && ids.length) {
    pendientes = ids;
  } else {
    var corte = new Date(Date.now() - VENTANA_FICHAS_HORAS * 3600000);
    pendientes = leerAdmisiones()
      .filter(function (a) {
        if (a.pdf_url || !a.alumno_nombre) return false;
        var alta = aFecha(a.fecha_alta);
        return alta && alta >= corte;
      })
      .map(function (a) { return a.id; });
  }

  var arranque = Date.now();
  var hechas = 0;
  var fallidas = 0;

  for (var i = 0; i < pendientes.length; i++) {
    if (hechas >= TOPE_FICHAS_POR_CORRIDA) break;
    if (Date.now() - arranque > PRESUPUESTO_MS) break;

    try {
      var a = obtenerAdmision(pendientes[i]);
      if (!a || a.pdf_url || !a.alumno_nombre) continue;
      generarFicha(pendientes[i]);
      hechas++;
    } catch (err) {
      fallidas++;
      console.error('No se pudo generar la ficha de ' + pendientes[i] + ': ' + err);
    }
  }

  return {
    ok: true,
    generadas: hechas,
    fallidas: fallidas,
    pendientes: Math.max(pendientes.length - hechas - fallidas, 0)
  };
}

/**
 * Instala el trigger que genera las fichas que quedaron pendientes.
 *
 * Ejecutar UNA VEZ. Corre cada hora y levanta lo que el tope de la
 * importación dejó afuera, siempre dentro de la ventana de
 * VENTANA_FICHAS_HORAS: nunca toca el histórico.
 */
function instalarTriggerFichas() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'generarFichasPendientes') ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('generarFichasPendientes')
    .timeBased()
    .everyHours(1)
    .create();

  return { ok: true };
}

// ====================================================================
// mailer.gs
// ====================================================================

/**
 * Envío de mails a las familias.
 *
 * Usa la Gmail API avanzada en vez de GmailApp.sendEmail() por dos razones:
 *
 * 1. Devuelve el threadId. Sin él no hay forma confiable de atar las
 *    respuestas de la familia a la admisión, y "registrar el intercambio"
 *    se cae.
 * 2. Permite armar los headers a mano, en particular un Reply-To con dos
 *    direcciones. GmailApp sólo acepta una.
 *
 * El Reply-To doble es el corazón del diseño: cuando la familia toca
 * "Responder", la respuesta va a la directora del nivel (que continúa la
 * conversación desde su bandeja, como siempre) y a admision@ (que la registra
 * en Eventos). Con un Reply-To simple habría que elegir entre las dos cosas.
 *
 * REQUISITO: activar el servicio avanzado de Gmail en el editor
 * (Servicios > +  > Gmail API), y tener admision@ como alias de envío.
 */

// ───────────────────────────────────────────────────────────────────
// Construcción del mensaje (puro, testeable)
// ───────────────────────────────────────────────────────────────────

/**
 * Codifica un header con caracteres no ASCII según RFC 2047.
 * Sin esto, "Admisiones - Colegio San Carlos Diálogos" llega con la tilde
 * rota en varios clientes, y un asunto con el nombre del alumno también.
 */
function codificarHeader(texto) {
  var t = (texto === null || texto === undefined) ? '' : texto.toString();
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(t)) return t;
  return '=?UTF-8?B?' + Utilities.base64Encode(t, Utilities.Charset.UTF_8) + '?=';
}

/** Formatea "Nombre <mail@dominio>" con el nombre codificado si hace falta. */
function formatearRemitente(nombre, email) {
  if (!nombre) return email;
  return codificarHeader(nombre) + ' <' + email + '>';
}

/**
 * Arma el mensaje MIME completo.
 *
 * Devuelve el texto crudo listo para mandar. Se mantiene puro para poder
 * verificar en los tests que los headers salen bien — sobre todo el Reply-To
 * doble y el Cc, que son los que hacen que la directora reciba las respuestas.
 */
function construirMime(opciones) {
  var destinatario = opciones.para;
  var copias = opciones.copias || [];
  var responderA = opciones.responderA || [];

  var lineas = [
    'From: ' + formatearRemitente(opciones.deNombre, opciones.deEmail),
    'To: ' + destinatario
  ];

  if (copias.length) lineas.push('Cc: ' + copias.join(', '));
  if (responderA.length) lineas.push('Reply-To: ' + responderA.join(', '));

  lineas.push('Subject: ' + codificarHeader(opciones.asunto));
  lineas.push('MIME-Version: 1.0');
  lineas.push('Content-Type: text/plain; charset=UTF-8');
  lineas.push('Content-Transfer-Encoding: base64');
  lineas.push('');
  lineas.push(Utilities.base64Encode(opciones.cuerpo, Utilities.Charset.UTF_8));

  return lineas.join('\r\n');
}

/**
 * Arma la lista de Reply-To: el remitente institucional más quienes reciben
 * copia, sin repetidos.
 */
function armarResponderA(remitente, copias) {
  var lista = [remitente];
  (copias || []).forEach(function (c) {
    if (lista.indexOf(c) === -1) lista.push(c);
  });
  return lista;
}

/** Valida una dirección lo justo para no intentar enviar a algo que no lo es. */
function esMailValido(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.toString().trim());
}

// ───────────────────────────────────────────────────────────────────
// Envío
// ───────────────────────────────────────────────────────────────────

/**
 * Envía el mail que corresponde a una admisión, según las plantillas.
 *
 * No envía y devuelve el motivo cuando:
 *   - la dirección de la familia no es válida
 *   - ninguna plantilla aplica al nivel (Secundaria, que contacta por teléfono)
 *   - la plantilla tiene placeholders sin dato
 *
 * Ese último caso es deliberado: los scripts viejos concatenaban directo y
 * mandaban "Estimada/o :" cuando faltaba el nombre del tutor. Acá se frena y
 * se avisa.
 */
function enviarMailAdmision(idAdmision, opciones) {
  opciones = opciones || {};

  var admision = obtenerAdmision(idAdmision);
  if (!admision) throw new Error('No existe la admisión ' + idAdmision);

  if (!esMailValido(admision.email)) {
    return { ok: false, motivo: 'La admisión no tiene un mail válido: "' + admision.email + '"' };
  }

  var plantilla;
  if (opciones.idPlantilla) {
    plantilla = leerPlantillas().filter(function (p) { return p.id === opciones.idPlantilla; })[0];
    if (!plantilla) return { ok: false, motivo: 'No existe la plantilla ' + opciones.idPlantilla };
  } else {
    plantilla = elegirPlantilla(leerPlantillas(), admision.nivel, admision);
    if (!plantilla) {
      return {
        ok: false,
        motivo: 'No hay ninguna plantilla para ' + admision.nivel +
                '. Secundaria hace el primer contacto por teléfono: usá "Registrar llamada".'
      };
    }
  }

  var render = renderizarPlantilla(plantilla, admision);

  // Permite editar el texto en el sitio antes de mandar.
  if (opciones.asunto) render.asunto = opciones.asunto;
  if (opciones.cuerpo) {
    render.cuerpo = opciones.cuerpo;
    render.faltantes = [];
  }

  if (render.faltantes.length) {
    return {
      ok: false,
      motivo: 'Faltan datos para completar el mail: ' + render.faltantes.join(', ') +
              '. Completalos en la ficha o editá el texto antes de enviar.',
      faltantes: render.faltantes
    };
  }

  var copias = (COPIAS_POR_NIVEL[admision.nivel] || []).slice();
  var mime = construirMime({
    deNombre: REMITENTE.nombre,
    deEmail: REMITENTE.email,
    para: admision.email,
    copias: copias,
    responderA: armarResponderA(REMITENTE.email, copias),
    asunto: render.asunto,
    cuerpo: render.cuerpo
  });

  var enviado = Gmail.Users.Messages.send({
    raw: Utilities.base64EncodeWebSafe(mime, Utilities.Charset.UTF_8)
  }, 'me');

  // El threadId es lo que después permite traer las respuestas de la familia
  // y mostrarlas en la ficha.
  actualizarAdmision(idAdmision, { thread_id: enviado.threadId });

  registrarEvento({
    id_admision: idAdmision,
    tipo: 'mail_enviado',
    usuario: usuarioActual(),
    asunto: render.asunto,
    detalle: render.cuerpo,
    thread_id: enviado.threadId,
    message_id: enviado.id
  });

  if (admision.estado === ESTADO_INICIAL) {
    cambiarEstado(idAdmision, 'contactada', 'Cambio automático al enviar el primer mail');
  }

  return {
    ok: true,
    threadId: enviado.threadId,
    asunto: render.asunto,
    copias: copias,
    plantilla: plantilla.id
  };
}

/**
 * Previsualiza el mail sin enviarlo: qué plantilla saldría, con qué texto y a
 * quién le llega la copia. Es lo que muestra el sitio antes de confirmar.
 */
function previsualizarMailAdmision(idAdmision, idPlantilla) {
  var admision = obtenerAdmision(idAdmision);
  if (!admision) throw new Error('No existe la admisión ' + idAdmision);

  var plantillas = leerPlantillas();
  var plantilla = idPlantilla
    ? plantillas.filter(function (p) { return p.id === idPlantilla; })[0]
    : elegirPlantilla(plantillas, admision.nivel, admision);

  if (!plantilla) {
    return {
      ok: false,
      motivo: 'No hay plantilla para ' + admision.nivel + '.',
      disponibles: plantillas.filter(function (p) { return p.nivel === admision.nivel; })
    };
  }

  var render = renderizarPlantilla(plantilla, admision);
  var copias = COPIAS_POR_NIVEL[admision.nivel] || [];

  return {
    ok: true,
    plantilla: { id: plantilla.id, nombre: plantilla.nombre },
    de: formatearRemitente(REMITENTE.nombre, REMITENTE.email),
    para: admision.email,
    copias: copias,
    responderA: armarResponderA(REMITENTE.email, copias),
    asunto: render.asunto,
    cuerpo: render.cuerpo,
    faltantes: render.faltantes,
    disponibles: plantillas
      .filter(function (p) { return p.nivel === admision.nivel; })
      .map(function (p) { return { id: p.id, nombre: p.nombre }; })
  };
}

/**
 * Trae las respuestas nuevas de los hilos que ya tienen mail enviado y las
 * guarda en Eventos.
 *
 * Corre por trigger. Compara contra los message_id ya registrados, así que
 * puede correr cuantas veces haga falta sin duplicar.
 */
function sincronizarRespuestas() {
  var hojaEventos = SpreadsheetApp.getActive().getSheetByName(HOJAS.EVENTOS);
  if (!hojaEventos) return { ok: false, motivo: 'Falta la solapa Eventos' };

  var admisiones = leerAdmisiones().filter(function (a) { return a.thread_id; });
  if (!admisiones.length) return { ok: true, nuevas: 0 };

  var eventos = leerHoja_(hojaEventos);
  var colMsg = eventos.encabezados.indexOf('message_id');
  var vistos = {};
  if (colMsg !== -1) {
    eventos.filas.forEach(function (f) {
      if (f[colMsg]) vistos[f[colMsg].toString()] = true;
    });
  }

  var nuevas = 0;

  admisiones.forEach(function (a) {
    var hilo;
    try {
      hilo = GmailApp.getThreadById(a.thread_id);
    } catch (err) {
      console.warn('No se pudo leer el hilo ' + a.thread_id + ': ' + err);
      return;
    }
    if (!hilo) return;

    hilo.getMessages().forEach(function (m) {
      if (vistos[m.getId()]) return;

      // Lo que sale del sistema ya quedó registrado al enviarlo.
      var de = m.getFrom();
      if (de.indexOf(REMITENTE.email) !== -1) {
        vistos[m.getId()] = true;
        return;
      }

      registrarEvento({
        id_admision: a.id,
        tipo: 'mail_recibido',
        usuario: de,
        asunto: m.getSubject(),
        detalle: m.getPlainBody(),
        thread_id: a.thread_id,
        message_id: m.getId(),
        timestamp: m.getDate().toISOString()
      });
      vistos[m.getId()] = true;
      nuevas++;
    });
  });

  return { ok: true, nuevas: nuevas };
}

/** Instala el trigger que trae las respuestas cada 15 minutos. Ejecutar UNA VEZ. */
function instalarTriggerRespuestas() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sincronizarRespuestas') ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('sincronizarRespuestas')
    .timeBased()
    .everyMinutes(15)
    .create();

  return { ok: true };
}

// ───────────────────────────────────────────────────────────────────
// Aviso interno de admisiones nuevas
// ───────────────────────────────────────────────────────────────────

/**
 * Arma el texto del aviso que recibe el equipo de un nivel.
 *
 * Puro para poder testearlo: lo que importa es que el mail diga de un vistazo
 * quién entró y lleve el link, no que salga por Gmail.
 */
function textoAvisoNuevas(nivel, admisiones, urlSitio) {
  var lineas = [
    admisiones.length === 1
      ? 'Entró una nueva solicitud de admisión para ' + nivel + '.'
      : 'Entraron ' + admisiones.length + ' nuevas solicitudes de admisión para ' + nivel + '.',
    ''
  ];

  admisiones.forEach(function (a) {
    lineas.push('• ' + (a.alumno_nombre || '(sin nombre)') +
      ' — ' + (a.grado_solicitado || 'sin grado') +
      ' — ' + (a.anio_vacante || 'sin año'));

    var familia = [];
    if (a.tutor1_nombre) familia.push(a.tutor1_nombre);
    if (a.email) familia.push(a.email);
    if (a.celular) familia.push(a.celular);
    if (familia.length) lineas.push('  ' + familia.join(' · '));

    if (aBooleano(a.inclusion_solicitada) === true) {
      lineas.push('  Declara proyecto de inclusión.');
    }
    lineas.push('');
  });

  if (urlSitio) {
    lineas.push('Verlas en el sistema:');
    lineas.push(urlSitio);
    lineas.push('');
  }

  lineas.push('Este aviso es automático, no hace falta responderlo.');
  return lineas.join('\n');
}

/** Asunto del aviso, con el nombre cuando es una sola. */
function asuntoAvisoNuevas(nivel, admisiones) {
  if (admisiones.length === 1) {
    var a = admisiones[0];
    return 'Nueva admisión ' + nivel + ' — ' + (a.alumno_nombre || 'sin nombre') +
      ' (' + (a.grado_solicitado || 's/d') + ', ' + (a.anio_vacante || 's/d') + ')';
  }
  return admisiones.length + ' nuevas admisiones — ' + nivel;
}

/**
 * Avisa a cada nivel de las admisiones que acaban de entrar.
 *
 * Un mail por nivel con todas las suyas, no uno por admisión: si entran cinco
 * juntas, cinco mails seguidos se vuelven ruido y se dejan de leer.
 *
 * Nunca lanza. La admisión ya está guardada antes de llegar acá, así que una
 * falla de Gmail no puede hacer perder una inscripción ni abortar la
 * importación.
 */
function avisarNuevasAdmisiones(nuevas) {
  if (!AVISAR_NUEVAS_ADMISIONES) {
    return { ok: true, avisos: 0, motivo: 'AVISAR_NUEVAS_ADMISIONES está en false' };
  }
  if (!nuevas || !nuevas.length) return { ok: true, avisos: 0 };

  var urlSitio = '';
  try {
    urlSitio = ScriptApp.getService().getUrl() || '';
  } catch (err) {
    console.warn('No se pudo obtener la URL del sitio: ' + err);
  }

  var porNivel = {};
  nuevas.forEach(function (a) {
    if (!porNivel[a.nivel]) porNivel[a.nivel] = [];
    porNivel[a.nivel].push(a);
  });

  var enviados = 0;

  Object.keys(porNivel).forEach(function (nivel) {
    var destinatarios = (COPIAS_POR_NIVEL[nivel] || []).filter(esMailValido);
    if (!destinatarios.length) {
      console.warn('Sin destinatarios configurados para ' + nivel + ': no se avisa.');
      return;
    }

    try {
      MailApp.sendEmail({
        to: destinatarios.join(','),
        subject: asuntoAvisoNuevas(nivel, porNivel[nivel]),
        body: textoAvisoNuevas(nivel, porNivel[nivel], urlSitio),
        name: REMITENTE.nombre
      });
      enviados++;
    } catch (err) {
      console.error('No se pudo avisar a ' + nivel + ': ' + err);
    }
  });

  return { ok: true, avisos: enviados };
}

// ====================================================================
// ingesta.gs
// ====================================================================

/**
 * Ingesta: trae las solicitudes nuevas desde "Admisiones - Respuestas Sitio
 * Web" a la planilla única.
 *
 * La planilla del sitio sigue siendo el buzón de entrada de los 3 formularios
 * y no se toca. Esto sólo lee de ahí, normaliza al esquema unificado y escribe
 * en `Admisiones`. Las planillas oficiales de cada nivel siguen operando en
 * paralelo, intactas.
 *
 * Es idempotente: cada solicitud deja una `huella` y las corridas siguientes
 * saltean lo ya importado. Se puede correr a mano o por trigger sin miedo a
 * duplicar.
 *
 * Las funciones puras (calcularHuella, derivarInclusion, mapearFilaSitio) no
 * tocan SpreadsheetApp y se testean con node — ver test/ingesta.test.js.
 * La normalización de valores y el acceso genérico a solapas están en util.gs.
 */

// ───────────────────────────────────────────────────────────────────
// Funciones puras
// ───────────────────────────────────────────────────────────────────

/**
 * Deduce si la familia declaró proyecto de inclusión a partir del campo
 * "Trayectoria escolar actual".
 *
 * Inicial y Primaria no preguntan por inclusión directamente: la respuesta
 * viene acá, entre tres opciones cerradas. Sólo una cuenta como inclusión.
 *
 * El orden de los chequeos importa y no es casual. La opción de terapias
 * externas dice "no tiene proyecto de inclusión": contiene la misma frase que
 * la opción afirmativa. Si se buscara "proyecto de inclusion" primero, esa
 * familia quedaría marcada como inclusión y recibiría la negativa de vacante
 * habiendo declarado justo lo contrario. Por eso la negación se descarta antes
 * que nada.
 *
 * Devuelve true, false, o null cuando el texto no coincide con ninguna opción
 * conocida — null significa "no sé", y el sitio lo muestra para que alguien
 * decida a mano. Nunca se asume false silenciosamente.
 */
function derivarInclusion(trayectoria) {
  var t = normalizarParaComparar(trayectoria);
  if (t === '') return null;

  // Primero la negación, porque contiene la frase de la afirmativa.
  if (t.indexOf('no tiene proyecto de inclusion') !== -1) return false;
  if (t.indexOf('sin apoyos externos') !== -1) return false;
  if (t.indexOf('cuenta con un proyecto de inclusion') !== -1) return true;

  return null;
}

/**
 * Huella de la solicitud de origen. Es lo que evita reimportar.
 *
 * Deliberadamente legible y no un hash: queda a la vista en la planilla, así
 * que si una fila aparece duplicada o falta, se puede ver de dónde salió sin
 * tener que descifrarla. No agrega exposición de datos, porque el mail ya está
 * en su propia columna.
 *
 * Se usa nivel + fecha de envío + mail + alumno porque la planilla del sitio
 * no tiene ID propio. La fecha de envío al milisegundo hace prácticamente
 * imposible la colisión entre dos solicitudes distintas.
 */
function calcularHuella(nivel, admision) {
  return [
    nivel,
    normalizarFecha(admision.fecha_alta),
    (admision.email || '').toString().trim().toLowerCase(),
    (admision.alumno_nombre || '').toString().trim().toLowerCase()
  ].join('|');
}

/**
 * Convierte una fila de la planilla del sitio en una admisión del esquema
 * unificado.
 *
 * Devuelve { admision, ignorados }. `ignorados` lista los encabezados de
 * origen que no tienen destino: si alguien agrega un campo al formulario del
 * sitio, aparece ahí en vez de perderse en silencio.
 */
function mapearFilaSitio(nivel, encabezados, fila) {
  var mapa = {};
  var k;
  for (k in MAPEO_SITIO.comun) {
    if (Object.prototype.hasOwnProperty.call(MAPEO_SITIO.comun, k)) mapa[k] = MAPEO_SITIO.comun[k];
  }
  var propios = MAPEO_SITIO[nivel] || {};
  for (k in propios) {
    if (Object.prototype.hasOwnProperty.call(propios, k)) mapa[k] = propios[k];
  }

  var admision = {};
  var ignorados = [];

  encabezados.forEach(function (encabezado, i) {
    var nombre = (encabezado === null || encabezado === undefined) ? '' : encabezado.toString().trim();
    if (nombre === '') return;

    var destino = mapa[nombre];
    if (!destino) {
      ignorados.push(nombre);
      return;
    }

    var valor = fila[i];
    if (CAMPOS_BOOLEANOS.indexOf(destino) !== -1) {
      var b = aBooleano(valor);
      admision[destino] = (b === null) ? '' : b;
    } else if (destino === 'fecha_alta') {
      admision[destino] = normalizarFecha(valor);
    } else if (CAMPOS_FECHA_CORTA.indexOf(destino) !== -1) {
      // Una columna con formato de fecha vuelve como Date: sin formatear,
      // toString() la graba como "Wed Dec 04 2024 00:00:00 GMT-0300 (…)".
      admision[destino] = formatearFechaCorta(valor);
    } else {
      admision[destino] = (valor === null || valor === undefined) ? '' : valor.toString().trim();
    }
  });

  admision.nivel = nivel;
  admision.estado = ESTADO_INICIAL;
  admision.origen = 'form_web';

  // Inicial y Primaria no preguntan por inclusión: la respuesta está dentro
  // del campo de trayectoria. Secundaria sí la trae directa, así que sólo se
  // deriva cuando no vino ya mapeada.
  if (admision.inclusion_solicitada === undefined || admision.inclusion_solicitada === '') {
    var derivada = derivarInclusion(admision.trayectoria_texto);
    admision.inclusion_solicitada = (derivada === null) ? '' : derivada;
  }

  admision.huella = calcularHuella(nivel, admision);

  return { admision: admision, ignorados: ignorados };
}

/**
 * Arma el próximo id correlativo a partir de los que ya existen.
 * Formato A-00001: corto y ordenable, más fácil de dictar por teléfono que
 * un UUID — que es como se usan en la práctica cuando llama una familia.
 */
function siguienteId(idsExistentes) {
  var max = 0;
  idsExistentes.forEach(function (id) {
    var m = (id || '').toString().match(/^A-(\d+)$/);
    if (m) {
      var n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  });
  var siguiente = max + 1;
  var relleno = siguiente.toString();
  while (relleno.length < 5) relleno = '0' + relleno;
  return 'A-' + relleno;
}

/**
 * Importa las solicitudes nuevas de los 3 niveles.
 *
 * Toma un lock porque puede correr por trigger mientras alguien la ejecuta a
 * mano: sin eso, dos corridas simultáneas asignarían el mismo id.
 *
 * Devuelve un resumen por nivel con lo importado, lo salteado y los campos de
 * origen sin mapear.
 */
function importarDesdeSitio() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('Hay otra importación en curso. Probá de nuevo en un minuto.');
  }

  try {
    var destino = SpreadsheetApp.getActive().getSheetByName(HOJAS.ADMISIONES);
    if (!destino) {
      throw new Error('No existe la solapa ' + HOJAS.ADMISIONES + '. Corré setup() primero.');
    }

    var origen = SpreadsheetApp.openById(ID_PLANILLA_SITIO);
    var actual = leerHoja_(destino);
    var colHuella = actual.encabezados.indexOf('huella');
    var colId = actual.encabezados.indexOf('id');
    if (colHuella === -1 || colId === -1) {
      throw new Error('La solapa ' + HOJAS.ADMISIONES +
        ' no tiene las columnas "id" y "huella". Corré migrarEsquema().');
    }

    var huellasExistentes = {};
    actual.filas.forEach(function (f) {
      var h = f[colHuella];
      if (h) huellasExistentes[h.toString()] = true;
    });
    var idsExistentes = actual.filas.map(function (f) { return f[colId]; });

    var resumen = { importadas: 0, salteadas: 0, porNivel: {}, ignorados: {} };
    var nuevas = [];

    NIVELES.forEach(function (nivel) {
      var hoja = origen.getSheetByName(nivel);
      if (!hoja) {
        resumen.porNivel[nivel] = { importadas: 0, salteadas: 0, error: 'no existe la solapa' };
        return;
      }

      var datos = leerHoja_(hoja);
      var importadas = 0;
      var salteadas = 0;
      var ignoradosNivel = {};

      datos.filas.forEach(function (fila) {
        // Una fila sin nada en las primeras celdas es relleno de la planilla
        var vacia = fila.every(function (c) {
          return c === '' || c === null || c === undefined;
        });
        if (vacia) return;

        var r = mapearFilaSitio(nivel, datos.encabezados, fila);
        r.ignorados.forEach(function (c) { ignoradosNivel[c] = true; });

        // Sin nombre no hay admisión que gestionar
        if (!r.admision.alumno_nombre) {
          salteadas++;
          return;
        }

        if (huellasExistentes[r.admision.huella]) {
          salteadas++;
          return;
        }

        var id = siguienteId(idsExistentes);
        idsExistentes.push(id);
        r.admision.id = id;
        r.admision.actualizado = new Date().toISOString();

        huellasExistentes[r.admision.huella] = true;
        nuevas.push(r.admision);
        importadas++;
      });

      resumen.porNivel[nivel] = { importadas: importadas, salteadas: salteadas };
      resumen.importadas += importadas;
      resumen.salteadas += salteadas;

      var lista = Object.keys(ignoradosNivel);
      if (lista.length) resumen.ignorados[nivel] = lista;
    });

    if (nuevas.length) {
      // Según los encabezados reales de la solapa, no según COLUMNAS_ADMISIONES:
      // migrarEsquema() agrega las columnas nuevas al final, así que los dos
      // órdenes no tienen por qué coincidir.
      var filas = nuevas.map(function (a) {
        return actual.encabezados.map(function (c) {
          var v = a[c];
          return (v === undefined || v === null) ? '' : v;
        });
      });
      destino.getRange(destino.getLastRow() + 1, 1, filas.length, actual.encabezados.length)
        .setValues(filas);

      nuevas.forEach(function (a) {
        registrarEvento({
          id_admision: a.id,
          tipo: 'alta',
          usuario: 'sistema',
          asunto: 'Alta desde el formulario del sitio',
          detalle: a.nivel + ' · ' + a.grado_solicitado + ' · ' + a.anio_vacante
        });
      });

      // La ficha sale sola apenas entra la admisión, para que esté lista
      // cuando alguien abra la ficha sin tener que esperarla.
      //
      // Va al final y no puede tumbar la importación: las filas ya están
      // escritas, y generarFichasPendientes() se traga los errores de cada
      // ficha. Lo que no entre por tope de tiempo sale en la corrida
      // siguiente o desde el botón del sitio.
      SpreadsheetApp.flush();
      try {
        resumen.fichas = generarFichasPendientes(nuevas.map(function (a) { return a.id; }));
      } catch (err) {
        console.error('No se pudieron generar las fichas nuevas: ' + err);
      }

      // Aviso al equipo de cada nivel. Va al final y tampoco puede tumbar la
      // importación: las filas ya están escritas.
      try {
        resumen.avisos = avisarNuevasAdmisiones(nuevas);
      } catch (err) {
        console.error('No se pudo avisar de las admisiones nuevas: ' + err);
      }
    }

    // Un campo nuevo en el formulario del sitio que nadie mapeó se pierde en
    // silencio. Que quede en el log permite notarlo antes de perder datos.
    if (Object.keys(resumen.ignorados).length) {
      console.warn('Campos del sitio sin mapear: ' + JSON.stringify(resumen.ignorados));
    }

    return resumen;

  } finally {
    lock.releaseLock();
  }
}

/** Instala el trigger que importa cada 15 minutos. Ejecutar UNA VEZ. */
function instalarTriggerIngesta() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'importarDesdeSitio') ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('importarDesdeSitio')
    .timeBased()
    .everyMinutes(15)
    .create();

  return { ok: true };
}

// ====================================================================
// api.gs
// ====================================================================

/**
 * API del sitio de gestión.
 *
 * Funciona de dos maneras, con el mismo código:
 *
 * 1. Servida por Apps Script (doGet devuelve el HTML). Google autentica antes
 *    de entregar la página, así que Session.getActiveUser() ya dice quién es.
 *    Es el modo más simple y el que conviene para probar.
 *
 * 2. Servida desde Vercel, pegándole por fetch a doPost. Ahí no hay sesión de
 *    Google, así que el sitio manda el ID token de Google Identity Services y
 *    acá se verifica antes de responder.
 *
 * En los dos casos la autorización es la misma: hay que estar en la solapa
 * `Usuarios`, activo, y sólo se ven las admisiones de los niveles asignados.
 * Ese filtro se aplica acá y no en el front, porque el front es público.
 */

/**
 * Client ID de OAuth, necesario sólo para el modo Vercel.
 *
 * Se crea en Google Cloud Console > Credenciales > ID de cliente de OAuth >
 * Aplicación web, con el dominio de Vercel en "Orígenes autorizados".
 * Dejarlo vacío deshabilita el modo Vercel: doPost rechaza todo.
 */
var OAUTH_CLIENT_ID = '';

/** Sólo se aceptan cuentas de este dominio. */
var DOMINIO = 'sancarlos.edu.ar';

// ───────────────────────────────────────────────────────────────────
// Entradas HTTP
// ───────────────────────────────────────────────────────────────────

/** Sirve el sitio desde Apps Script. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Admisiones - San Carlos Diálogos')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Endpoint JSON para el sitio alojado afuera.
 *
 * Se usa text/plain en el Content-Type del lado del cliente para que el
 * navegador lo trate como "simple request" y no dispare el preflight OPTIONS,
 * que las web apps de Apps Script no saben contestar.
 */
function doPost(e) {
  var salida = function (obj) {
    return ContentService.createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
  };

  try {
    var payload = JSON.parse(e.postData.contents);
    var email = verificarIdToken(payload.id_token);
    if (!email) return salida({ ok: false, error: 'No se pudo verificar la identidad.' });

    return salida(ejecutar(payload.accion, payload.params || {}, email));
  } catch (err) {
    return salida({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/**
 * Verifica el ID token de Google y devuelve el mail, o null.
 *
 * Chequea firma (delegada en el endpoint de Google), destinatario, dominio,
 * verificación del mail y vencimiento. Sin el chequeo de `aud`, un token
 * emitido para otra aplicación serviría para entrar acá.
 */
function verificarIdToken(idToken) {
  if (!idToken || !OAUTH_CLIENT_ID) return null;

  try {
    var res = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) return null;

    var info = JSON.parse(res.getContentText());

    if (info.aud !== OAUTH_CLIENT_ID) return null;
    if (info.email_verified !== true && info.email_verified !== 'true') return null;
    if (info.hd !== DOMINIO) return null;
    if (Number(info.exp) * 1000 < Date.now()) return null;

    return info.email;
  } catch (err) {
    console.error('Fallo la verificación del token: ' + err);
    return null;
  }
}

/** Llamada desde el HTML servido por Apps Script (google.script.run). */
function llamar(accion, params) {
  return ejecutar(accion, params || {}, usuarioActual());
}

// ───────────────────────────────────────────────────────────────────
// Ruteo
// ───────────────────────────────────────────────────────────────────

/**
 * Ejecuta una acción en nombre de un usuario ya identificado.
 *
 * Toda acción pasa por `autorizar`: tener cuenta del colegio no alcanza, hay
 * que estar cargado y activo en la solapa `Usuarios`.
 */
function ejecutar(accion, params, email) {
  // Deja registrado quién hace cada cosa. Desde Vercel no hay sesión de
  // Google en la llamada, así que este es el único dato de identidad.
  fijarUsuarioActual(email);

  var usuario = autorizar(email);
  if (!usuario) {
    return {
      ok: false,
      error: 'La cuenta ' + email + ' no está habilitada. Pedile a un administrador ' +
             'que la agregue en la solapa Usuarios.'
    };
  }

  try {
    switch (accion) {
      case 'sesion':
        return { ok: true, usuario: usuario, estados: leerEstados(), niveles: usuario.niveles };

      case 'listar':
        return { ok: true, admisiones: listarPara(usuario, params) };

      case 'detalle':
        return { ok: true, admision: detallePara(usuario, params.id), eventos: leerEventos(params.id) };

      case 'cambiarEstado':
        exigirAcceso(usuario, params.id);
        return { ok: true, admision: cambiarEstado(params.id, params.estado, params.nota) };

      case 'actualizar':
        exigirAcceso(usuario, params.id);
        return { ok: true, admision: actualizarAdmision(params.id, camposEditables(params.cambios)) };

      case 'previsualizarMail':
        exigirAcceso(usuario, params.id);
        return { ok: true, previsualizacion: previsualizarMailAdmision(params.id, params.idPlantilla) };

      case 'enviarMail':
        exigirAcceso(usuario, params.id);
        return { ok: true, resultado: enviarMailAdmision(params.id, params) };

      // Sin botón en el sitio por ahora. Se deja expuesta porque Secundaria
      // hace el primer contacto por teléfono y va a necesitarla.
      case 'registrarLlamada':
        exigirAcceso(usuario, params.id);
        return { ok: true, resultado: registrarLlamada(params.id, params.detalle) };

      case 'deshacerEstado':
        exigirAcceso(usuario, params.id);
        return { ok: true, resultado: deshacerCambioEstado(params.idEvento) };

      case 'agregarNota':
        exigirAcceso(usuario, params.id);
        return { ok: true, resultado: agregarNota(params.id, params.texto) };

      case 'generarFicha':
        exigirAcceso(usuario, params.id);
        return { ok: true, resultado: generarFicha(params.id) };

      case 'plantillas':
        return { ok: true, plantillas: plantillasPara(usuario), campos: CAMPOS_DISPONIBLES.concat(['url_aranceles']) };

      case 'guardarPlantilla':
        exigirPlantilla(usuario, params.plantilla);
        return { ok: true, resultado: guardarPlantilla(params.plantilla) };

      case 'importar':
        return { ok: true, resumen: importarDesdeSitio() };

      default:
        return { ok: false, error: 'Acción desconocida: ' + accion };
    }
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

// ───────────────────────────────────────────────────────────────────
// Permisos
// ───────────────────────────────────────────────────────────────────

/** Un admin ve todos los niveles; el resto, sólo los suyos. */
function nivelesDe(usuario) {
  return usuario.rol === 'admin' ? NIVELES : usuario.niveles;
}

/**
 * Lista las admisiones del usuario con el contador de espera ya calculado.
 *
 * Los eventos se leen una sola vez y se agrupan en memoria: pedirlos por
 * admisión sería una lectura de planilla por fila, y con 300 admisiones eso
 * agota el tiempo de ejecución de Apps Script.
 */
function listarPara(usuario, filtros) {
  filtros = filtros || {};

  var lista = leerAdmisiones({
    niveles: nivelesDe(usuario),
    estado: filtros.estado,
    anio: filtros.anio,
    texto: filtros.texto
  });

  var porAdmision = eventosPorAdmision();
  var ahora = new Date();

  return lista.map(function (a) {
    a.espera = calcularEspera(a, porAdmision[a.id] || [], ahora);
    return a;
  });
}

function detallePara(usuario, id) {
  var a = obtenerAdmision(id);
  if (!a) throw new Error('No existe la admisión ' + id);
  if (nivelesDe(usuario).indexOf(a.nivel) === -1) {
    throw new Error('No tenés acceso a las admisiones de ' + a.nivel + '.');
  }
  return a;
}

/** Corta cualquier acción sobre una admisión de un nivel ajeno. */
function exigirAcceso(usuario, id) {
  detallePara(usuario, id);
}

function plantillasPara(usuario) {
  var permitidos = nivelesDe(usuario);
  return leerPlantillas().filter(function (p) { return permitidos.indexOf(p.nivel) !== -1; });
}

function exigirPlantilla(usuario, plantilla) {
  if (!plantilla || !plantilla.nivel) throw new Error('La plantilla necesita un nivel.');
  if (nivelesDe(usuario).indexOf(plantilla.nivel) === -1) {
    throw new Error('No podés editar plantillas de ' + plantilla.nivel + '.');
  }
}

/**
 * Deja pasar sólo los campos que el sitio puede editar.
 *
 * Sin esta lista blanca, el front podría mandar `huella` o `id` y romper la
 * deduplicación de la ingesta, o pisar el `estado` sin dejar registro del
 * cambio en Eventos.
 */
var CAMPOS_EDITABLES = [
  'alumno_nombre', 'alumno_fecha_nac', 'alumno_dni',
  'grado_solicitado', 'grado_actual', 'anio_vacante', 'escuela_actual',
  'motivo_cambio', 'bilingue', 'inclusion_solicitada',
  'tutor1_nombre', 'tutor1_profesion', 'tutor2_nombre', 'tutor2_profesion',
  'celular', 'email', 'comentarios',
  'motivo_no_matriculacion', 'lista_espera', 'responsable'
];

function camposEditables(cambios) {
  var limpio = {};
  Object.keys(cambios || {}).forEach(function (c) {
    if (CAMPOS_EDITABLES.indexOf(c) !== -1) limpio[c] = cambios[c];
  });
  if (!Object.keys(limpio).length) throw new Error('No hay campos editables en el pedido.');
  return limpio;
}

// ====================================================================
// setup.gs
// ====================================================================

/**
 * Setup de la planilla única de Admisiones.
 *
 * Crea las 5 solapas con sus encabezados y carga los datos iniciales
 * (estados, plantillas, primer usuario). Ejecutar UNA VEZ desde el editor.
 *
 * Es seguro correrlo de nuevo: no pisa solapas que ya tengan datos.
 */

/**
 * Punto de entrada. Elegilo en el desplegable del editor y tocá Ejecutar.
 *
 * Después de correrlo:
 *   1. Revisá la solapa `Usuarios` y agregá al equipo de cada nivel.
 *   2. Corré `importarDesdeSitio()` una vez a mano para traer lo que ya hay.
 *   3. Corré `instalarTriggerIngesta()` para que importe cada 15 minutos.
 */
function setup() {
  var ss = SpreadsheetApp.getActive();
  var hecho = [];

  hecho.push(crearHoja_(ss, HOJAS.ADMISIONES, COLUMNAS_ADMISIONES));
  hecho.push(crearHoja_(ss, HOJAS.EVENTOS, COLUMNAS_EVENTOS));
  hecho.push(crearHoja_(ss, HOJAS.USUARIOS, COLUMNAS_USUARIOS));
  hecho.push(crearHoja_(ss, HOJAS.ESTADOS, COLUMNAS_ESTADOS));
  hecho.push(crearHoja_(ss, HOJA_PLANTILLAS, COLUMNAS_PLANTILLAS));

  cargarEstados_(ss);
  cargarPlantillas_(ss);
  cargarPrimerUsuario_(ss);
  limpiarHojaPorDefecto_(ss);

  var resumen = hecho.join('\n');
  console.log(resumen);
  return resumen;
}

/**
 * Crea la solapa con sus encabezados si no existe.
 * Si ya tiene datos la deja como está: correr setup() dos veces no puede
 * borrar admisiones cargadas.
 */
function crearHoja_(ss, nombre, columnas) {
  var hoja = ss.getSheetByName(nombre);

  if (hoja && hoja.getLastRow() > 1) {
    return nombre + ': ya tenía datos, no se tocó.';
  }

  if (!hoja) hoja = ss.insertSheet(nombre);

  hoja.getRange(1, 1, 1, columnas.length)
    .setValues([columnas])
    .setFontWeight('bold')
    .setBackground('#ddeef5')
    .setFontColor('#00476c');

  hoja.setFrozenRows(1);
  if (hoja.getMaxColumns() > columnas.length) {
    hoja.deleteColumns(columnas.length + 1, hoja.getMaxColumns() - columnas.length);
  }
  hoja.autoResizeColumns(1, columnas.length);

  return nombre + ': creada con ' + columnas.length + ' columnas.';
}

function cargarEstados_(ss) {
  var hoja = ss.getSheetByName(HOJAS.ESTADOS);
  if (hoja.getLastRow() > 1) return;

  // Según los encabezados reales, como en el resto del código: acá coinciden
  // con la lista porque la solapa se acaba de crear, pero mantener una sola
  // regla evita que mañana sea la excepción que desalinea todo.
  var encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0]
    .map(function (e) { return e.toString().trim(); });

  var filas = ESTADOS_INICIALES.map(function (e) {
    return encabezados.map(function (c) {
      return (e[c] === undefined || e[c] === null) ? '' : e[c];
    });
  });
  hoja.getRange(2, 1, filas.length, encabezados.length).setValues(filas);

  // Pinta cada fila con el color del estado, para que la planilla se lea
  // igual que el sitio.
  ESTADOS_INICIALES.forEach(function (e, i) {
    hoja.getRange(i + 2, 1, 1, COLUMNAS_ESTADOS.length).setBackground(e.color);
  });
}

function cargarPlantillas_(ss) {
  var hoja = ss.getSheetByName(HOJA_PLANTILLAS);
  if (hoja.getLastRow() > 1) return;

  var encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0]
    .map(function (e) { return e.toString().trim(); });

  var filas = PLANTILLAS_INICIALES.map(function (p) {
    return encabezados.map(function (c) {
      return (p[c] === undefined || p[c] === null) ? '' : p[c];
    });
  });
  hoja.getRange(2, 1, filas.length, encabezados.length).setValues(filas);

  // Ancho cómodo para los dos campos largos, ubicados por encabezado real
  var anchos = { asunto: 300, cuerpo: 600 };
  encabezados.forEach(function (c, i) {
    if (anchos[c]) hoja.setColumnWidth(i + 1, anchos[c]);
  });
}

/**
 * Deja cargado a quien corre el setup, con rol admin sobre los 3 niveles.
 * Sin esto, nadie podría entrar al sitio: la solapa arrancaría vacía y el
 * login por cuenta Google rechazaría a todos, incluido quien lo instaló.
 */
function cargarPrimerUsuario_(ss) {
  var hoja = ss.getSheetByName(HOJAS.USUARIOS);
  if (hoja.getLastRow() > 1) return;

  var email = Session.getEffectiveUser().getEmail();
  hoja.appendRow([email, email, NIVELES.join(','), 'admin', true]);
}

/** Saca la "Hoja 1" vacía que trae toda planilla nueva. */
function limpiarHojaPorDefecto_(ss) {
  var def = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1') || ss.getSheetByName('Hoja1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) {
    ss.deleteSheet(def);
  }
}

/**
 * Agrega a las solapas existentes las columnas que falten.
 *
 * `setup()` no sirve para esto: si una solapa ya tiene datos la deja intacta,
 * justamente para no pisar admisiones cargadas. Cuando el esquema crece, esta
 * función pone las columnas nuevas al final de cada solapa, sin tocar ni
 * mover lo que ya hay.
 *
 * Se puede correr las veces que haga falta: lo que ya existe no se duplica.
 */
function migrarEsquema() {
  var ss = SpreadsheetApp.getActive();
  var cambios = [];

  [
    { hoja: HOJAS.ADMISIONES, columnas: COLUMNAS_ADMISIONES },
    { hoja: HOJAS.EVENTOS, columnas: COLUMNAS_EVENTOS },
    { hoja: HOJAS.USUARIOS, columnas: COLUMNAS_USUARIOS },
    { hoja: HOJAS.ESTADOS, columnas: COLUMNAS_ESTADOS },
    { hoja: HOJA_PLANTILLAS, columnas: COLUMNAS_PLANTILLAS }
  ].forEach(function (cfg) {
    var hoja = ss.getSheetByName(cfg.hoja);
    if (!hoja) {
      cambios.push(cfg.hoja + ': no existe, corré setup() primero.');
      return;
    }

    var actuales = hoja.getRange(1, 1, 1, Math.max(hoja.getLastColumn(), 1))
      .getValues()[0]
      .map(function (e) { return e.toString().trim(); });

    var faltan = cfg.columnas.filter(function (c) { return actuales.indexOf(c) === -1; });
    if (!faltan.length) {
      cambios.push(cfg.hoja + ': al día.');
      return;
    }

    // Asegura espacio antes de escribir: una solapa recortada al ancho
    // exacto no tiene columnas libres donde poner las nuevas.
    var desde = actuales.length + 1;
    var necesarias = desde + faltan.length - 1;
    if (hoja.getMaxColumns() < necesarias) {
      hoja.insertColumnsAfter(hoja.getMaxColumns(), necesarias - hoja.getMaxColumns());
    }

    hoja.getRange(1, desde, 1, faltan.length)
      .setValues([faltan])
      .setFontWeight('bold')
      .setBackground('#ddeef5')
      .setFontColor('#00476c');

    cambios.push(cfg.hoja + ': + ' + faltan.join(', '));
  });

  var resumen = cambios.join('\n');
  console.log(resumen);
  return resumen;
}

/**
 * Arregla las fechas que quedaron guardadas como texto largo.
 *
 * Antes de que la ingesta formateara al escribir, una columna con formato de
 * fecha se grababa con toString() y quedaba como
 * "Wed Dec 04 2024 00:00:00 GMT-0300 (Argentina Standard Time)".
 *
 * Esto recorre las admisiones ya cargadas y reescribe esos campos en
 * dd/mm/aaaa. Es seguro correrlo de nuevo: lo que ya está bien no se toca.
 */
function limpiarFechas() {
  var hoja = hoja_(HOJAS.ADMISIONES);
  var datos = leerHoja_(hoja);
  var arregladas = 0;

  CAMPOS_FECHA_CORTA.forEach(function (campo) {
    var col = datos.encabezados.indexOf(campo);
    if (col === -1) return;

    datos.filas.forEach(function (fila, i) {
      var valor = fila[col];
      if (valor === '' || valor === null || valor === undefined) return;

      var formateada = formatearFechaCorta(valor);
      if (formateada === valor.toString()) return;

      hoja.getRange(i + 2, col + 1).setValue(formateada);
      arregladas++;
    });
  });

  var resumen = arregladas
    ? arregladas + ' fecha(s) reescritas en dd/mm/aaaa.'
    : 'No había fechas para arreglar.';
  console.log(resumen);
  return resumen;
}

/**
 * Repara los valores que quedaron en la columna equivocada.
 *
 * Hasta esta versión, las escrituras resolvían la columna por la posición del
 * campo dentro de COLUMNAS_ADMISIONES, mientras que migrarEsquema() agrega
 * las columnas nuevas al final de la solapa. En cuanto los dos órdenes
 * dejaron de coincidir, cada campo posterior se escribió una columna corrida:
 * el timestamp de `actualizado` terminó en `estado_previo`, y el estado
 * anterior en `responsable`.
 *
 * Limpia sólo lo que es reconociblemente del tipo equivocado, para no tocar
 * nada que alguien haya cargado a mano:
 *
 *   estado_previo con pinta de fecha  → se vacía
 *   responsable con un id de estado   → se vacía
 *
 * Se puede correr las veces que haga falta.
 */
function repararColumnas() {
  var hoja = hoja_(HOJAS.ADMISIONES);
  var datos = leerHoja_(hoja);
  var cols = indicesDe_(hoja);

  var idsEstado = {};
  leerEstados().forEach(function (e) { idsEstado[e.id] = true; });

  var limpiados = { estado_previo: 0, responsable: 0 };

  datos.filas.forEach(function (fila, i) {
    var n = i + 2;

    if (cols.estado_previo) {
      var prev = fila[cols.estado_previo - 1];
      var texto = (prev === null || prev === undefined) ? '' : prev.toString().trim();
      // Un estado_previo válido es un id de estado, nunca una fecha
      if (texto && !idsEstado[texto]) {
        hoja.getRange(n, cols.estado_previo).setValue('');
        limpiados.estado_previo++;
      }
    }

    if (cols.responsable) {
      var resp = fila[cols.responsable - 1];
      var t = (resp === null || resp === undefined) ? '' : resp.toString().trim();
      // Un responsable es una persona; si dice "contactada" es basura corrida
      if (t && idsEstado[t]) {
        hoja.getRange(n, cols.responsable).setValue('');
        limpiados.responsable++;
      }
    }
  });

  var resumen = 'estado_previo: ' + limpiados.estado_previo + ' limpiados · ' +
                'responsable: ' + limpiados.responsable + ' limpiados.';
  console.log(resumen);
  return resumen;
}
