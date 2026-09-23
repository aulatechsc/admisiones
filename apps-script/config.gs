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

if (typeof module !== 'undefined' && module.exports) {
  Object.assign(module.exports, {
    ID_PLANILLA_SITIO: ID_PLANILLA_SITIO,
    NIVELES: NIVELES,
    HOJAS: HOJAS,
    COLUMNAS_ADMISIONES: COLUMNAS_ADMISIONES,
    COLUMNAS_EVENTOS: COLUMNAS_EVENTOS,
    COLUMNAS_USUARIOS: COLUMNAS_USUARIOS,
    COLUMNAS_ESTADOS: COLUMNAS_ESTADOS,
    TIPOS_EVENTO: TIPOS_EVENTO,
    ESTADOS_INICIALES: ESTADOS_INICIALES,
    ESTADO_INICIAL: ESTADO_INICIAL,
    MAPEO_SITIO: MAPEO_SITIO,
    CAMPOS_BOOLEANOS: CAMPOS_BOOLEANOS,
    CAMPOS_FECHA_CORTA: CAMPOS_FECHA_CORTA,
    TRAYECTORIAS: TRAYECTORIAS,
    REMITENTE: REMITENTE,
    COPIAS_POR_NIVEL: COPIAS_POR_NIVEL,
    AVISAR_NUEVAS_ADMISIONES: AVISAR_NUEVAS_ADMISIONES
  });
}
