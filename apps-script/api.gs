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

if (typeof module !== 'undefined' && module.exports) {
  Object.assign(module.exports, {
    CAMPOS_EDITABLES: CAMPOS_EDITABLES,
    camposEditables: camposEditables,
    nivelesDe: nivelesDe
  });
}
