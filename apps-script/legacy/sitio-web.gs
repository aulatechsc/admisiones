/**
 * Code.gs — Admisiones, Respuestas Sitio Web
 * Planilla: https://docs.google.com/spreadsheets/d/1tC32nHKkFDbQTjtBwRkI3zWUVy_D9rVfgMA35O0k9t8/edit
 *
 * Esta planilla es NUEVA e independiente de las planillas oficiales de
 * Inicial/Primaria/Secundaria. Los 3 formularios del sitio (todos viven en
 * admisiones.html, uno por nivel) le pegan a este mismo script, que guarda la
 * respuesta cruda en la solapa que corresponda (Inicial / Primaria /
 * Secundaria) según el campo "nivel". De ahí se deriva manualmente a cada
 * planilla oficial.
 *
 * Al guardar cada respuesta se avisa por mail al equipo del nivel — ver
 * AVISOS y avisarAdmisiones_() al final del archivo.
 *
 * INSTALACIÓN:
 * 1. Abrí la planilla nueva (link arriba).
 * 2. Extensiones > Apps Script.
 * 3. Pegá este código completo.
 * 4. En el desplegable de funciones (arriba, al lado de "Depurar"),
 *    elegí "setup" y tocá Ejecutar (▶). Te va a pedir autorización la
 *    primera vez — aceptá. Esto crea las 3 solapas con sus encabezados.
 *    OJO: si las solapas ya existen y tienen datos, NO hace falta correrlo
 *    de nuevo.
 * 5. Implementar > Nueva implementación > tipo "Aplicación web".
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier usuario
 * 6. Copiá la URL que te da y pegala en ENDPOINTS de admisiones.html
 *    — es LA MISMA URL para los tres niveles.
 *
 * Copia de respaldo del script que vive en Google. Si se edita alla, conviene
 * actualizar este archivo tambien.
 */

const SPREADSHEET_ID = '1tC32nHKkFDbQTjtBwRkI3zWUVy_D9rVfgMA35O0k9t8';

const SHEETS_CONFIG = {
  Inicial: {
    headers: [
      'Fecha de envío', 'Email', 'Celular de contacto',
      'Padre/Madre/Tutor 1', 'Profesión Tutor 1',
      'Padre/Madre/Tutor 2', 'Profesión Tutor 2',
      'Nombre del/la postulante', 'Fecha de nacimiento',
      'Sala actual', 'Jardín actual', 'Motivo del cambio',
      'Trayectoria escolar actual', 'Año de vacante solicitada',
      'Sala solicitada', 'Cómo llegó', 'Comentarios adicionales'
    ],
    fields: [
      'email', 'celular', 'tutor1_nombre', 'tutor1_profesion',
      'tutor2_nombre', 'tutor2_profesion', 'postulante_nombre',
      'postulante_fecha_nacimiento', 'sala_actual', 'jardin_actual',
      'motivo_cambio', 'trayectoria', '_anio', 'sala_solicitada',
      '_conocio', 'comentarios'
    ]
  },
  Primaria: {
    headers: [
      'Fecha de envío', 'Email', 'Celular de contacto',
      'Padre/Madre/Tutor 1', 'Profesión Tutor 1',
      'Padre/Madre/Tutor 2', 'Profesión Tutor 2',
      'Nombre del/la postulante', 'Fecha de nacimiento',
      'Grado actual', 'Colegio actual', 'Bilingüe inglés',
      'Motivo del cambio', 'Trayectoria escolar actual',
      'Año de vacante solicitada', 'Grado solicitado', 'Cómo llegó'
    ],
    fields: [
      'email', 'celular', 'tutor1_nombre', 'tutor1_profesion',
      'tutor2_nombre', 'tutor2_profesion', 'postulante_nombre',
      'postulante_fecha_nacimiento', 'grado_actual', 'colegio_actual',
      'bilingue', 'motivo_cambio', 'trayectoria', '_anio',
      'grado_solicitado', '_conocio'
    ]
  },
  Secundaria: {
    headers: [
      'Fecha de envío', 'Email', 'Celular de contacto',
      'Padre/Madre/Tutor 1', 'Padre/Madre/Tutor 2',
      'Nombre del/la estudiante', 'Fecha de nacimiento',
      'Curso actual', 'Colegio actual', 'Bilingüe inglés',
      'Motivo del cambio', 'Solicita proyecto de inclusión',
      'Año de vacante solicitada', 'Curso solicitado', 'Cómo llegó'
    ],
    fields: [
      'email', 'celular', 'tutor1_nombre', 'tutor2_nombre',
      'postulante_nombre', 'postulante_fecha_nacimiento',
      'curso_actual', 'colegio_actual', 'bilingue', 'motivo_cambio',
      'inclusion', '_anio', 'curso_solicitado', '_conocio'
    ]
  }
};

/* ---------------------------------------------------------------------------
 * Aviso por mail al equipo de admisiones
 *
 * `para`: quienes reciben el aviso de ese nivel (separados por coma).
 * `campoGrado`: cada nivel guarda el grado pedido en un campo distinto.
 * `planillaOficial`: la planilla que gestiona cada equipo, y la UNICA que se
 *   linkea en el mail. La planilla del sitio (SPREADSHEET_ID) es privada y no
 *   se menciona nunca en el aviso: el equipo del nivel no tiene acceso.
 * ------------------------------------------------------------------------- */

const AVISOS = {
  Inicial: {
    para: 'elianawaichman@sancarlos.edu.ar',
    campoGrado: 'sala_solicitada',
    etiquetaGrado: 'Sala solicitada',
    planillaOficial: 'https://docs.google.com/spreadsheets/d/1QDzeoe4hpJNQecvDPJLZnwK4aCay0c9WFbyNy0JHIfg/edit'
  },
  Primaria: {
    para: 'rhalperin@sancarlos.edu.ar',
    campoGrado: 'grado_solicitado',
    etiquetaGrado: 'Grado solicitado',
    planillaOficial: 'https://docs.google.com/spreadsheets/d/1s-ubjQzjyS_U9tg647y4wbXMzi2WiN2CcDKGVkOti8k/edit'
  },
  Secundaria: {
    para: [
      'andreapandolfo@sancarlos.edu.ar',
      'karina_d@sancarlos.edu.ar',
      'secretariasecundaria@sancarlos.edu.ar',
      'nancyledesma@sancarlos.edu.ar',
      'amandawoitan@sancarlos.edu.ar'
    ].join(','),
    campoGrado: 'curso_solicitado',
    etiquetaGrado: 'Curso solicitado',
    planillaOficial: 'https://docs.google.com/spreadsheets/d/11Er9uLLgPihAt2bR0-tMoAIrgZXpOGdLT9m3nEolS_w/edit?gid=225917477#gid=225917477'
  }
};

/**
 * Avisa por mail al equipo del nivel que entro una solicitud.
 *
 * Nunca lanza: si el mail falla (cuota de Gmail agotada, direccion mal escrita,
 * Google caido) queda registrado en el log y el script sigue. La fila ya se
 * guardo antes de llamar a esta funcion, asi que una falla de mail nunca puede
 * hacer perder una inscripcion.
 */
function avisarAdmisiones_(nivelKey, data) {
  try {
    const cfg = AVISOS[nivelKey];
    if (!cfg) return;

    const alumno = data.postulante_nombre || '(sin nombre)';
    const grado = data[cfg.campoGrado] || '(sin especificar)';
    const anio = data._anio || '(sin especificar)';

    const asunto = 'Nueva Admisión ' + nivelKey + ' — ' + alumno +
      ' (' + grado + ', ' + anio + ')';

    const cuerpo = [
      'Entró una nueva solicitud de admisión desde el sitio web.',
      '',
      'Alumno/a: ' + alumno,
      'Nivel: ' + nivelKey,
      cfg.etiquetaGrado + ': ' + grado,
      'Año de ingreso: ' + anio,
      '',
      'Familia: ' + (data.tutor1_nombre || '(sin dato)'),
      'Email: ' + (data.email || '(sin dato)'),
      'Celular: ' + (data.celular || '(sin dato)'),
      '',
      'Ver la planilla de ' + nivelKey + ':',
      cfg.planillaOficial,
      '',
      'Este aviso es automático, no hace falta responderlo.'
    ].join('\n');

    MailApp.sendEmail({ to: cfg.para, subject: asunto, body: cuerpo });
  } catch (err) {
    console.error('No se pudo enviar el aviso de admisión: ' + err);
  }
}

/** Ejecutar UNA VEZ manualmente desde el editor para crear las 3 solapas. */
function setup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Object.keys(SHEETS_CONFIG).forEach(function (nivel) {
    let sheet = ss.getSheetByName(nivel);
    if (!sheet) sheet = ss.insertSheet(nivel);
    sheet.getRange(1, 1, 1, SHEETS_CONFIG[nivel].headers.length)
      .setValues([SHEETS_CONFIG[nivel].headers])
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  });
  // Borra la solapa por defecto "Hoja 1" si quedó vacía y sin usar.
  const def = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 3) ss.deleteSheet(def);
}

/**
 * Manda un mail de prueba de cada nivel sin tocar las planillas.
 * Elegila en el desplegable del editor y tocá Ejecutar para confirmar que los
 * avisos salen bien antes de esperar a que entre una admisión real.
 */
function probarAvisos() {
  const ejemplo = {
    Inicial: { postulante_nombre: 'PRUEBA - Sofía Pérez', sala_solicitada: 'Sala de 4 años' },
    Primaria: { postulante_nombre: 'PRUEBA - Tomás Díaz', grado_solicitado: '3er grado' },
    Secundaria: { postulante_nombre: 'PRUEBA - Martina Gómez', curso_solicitado: '2do año' }
  };
  Object.keys(ejemplo).forEach(function (nivelKey) {
    const data = ejemplo[nivelKey];
    data._anio = '2027';
    data.tutor1_nombre = 'PRUEBA - no responder';
    data.email = 'prueba@ejemplo.com';
    data.celular = '11 0000-0000';
    avisarAdmisiones_(nivelKey, data);
  });
}

function formatDate_(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d)) return isoDate;
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const nivel = data.nivel; // 'Inicial' | 'Primario' | 'Secundario'
    const nivelKey = nivel === 'Primario' ? 'Primaria'
      : nivel === 'Secundario' ? 'Secundaria'
      : 'Inicial';

    const config = SHEETS_CONFIG[nivelKey];
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(nivelKey);
    if (!sheet) {
      sheet = ss.insertSheet(nivelKey);
      sheet.getRange(1, 1, 1, config.headers.length).setValues([config.headers]).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    // resuelve los campos "Otro" antes de armar la fila
    data._anio = data.anio_vacante === 'Otro' ? data.anio_vacante_otro : data.anio_vacante;
    data._conocio = data.como_conocio === 'Otro' ? data.como_conocio_otro : data.como_conocio;

    const row = [new Date()].concat(config.fields.map(function (f) {
      if (f === 'postulante_fecha_nacimiento') return formatDate_(data[f]);
      return data[f] || '';
    }));

    sheet.appendRow(row);

    // El aviso va DESPUES de guardar y no puede tirar: si falla el mail, la
    // solicitud ya quedo en la planilla igual.
    avisarAdmisiones_(nivelKey, data);

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
