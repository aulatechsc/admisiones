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
  var colMsg = COLUMNAS_EVENTOS.indexOf('message_id');
  var vistos = {};
  eventos.filas.forEach(function (f) {
    if (f[colMsg]) vistos[f[colMsg].toString()] = true;
  });

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

if (typeof module !== 'undefined' && module.exports) {
  Object.assign(module.exports, {
    codificarHeader: codificarHeader,
    formatearRemitente: formatearRemitente,
    construirMime: construirMime,
    armarResponderA: armarResponderA,
    esMailValido: esMailValido,
    COPIAS_POR_NIVEL: COPIAS_POR_NIVEL,
    REMITENTE: REMITENTE,
    NIVELES: NIVELES
  });
}
