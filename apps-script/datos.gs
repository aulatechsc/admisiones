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

/**
 * Campos de fecha que se muestran como dd/mm/aaaa.
 *
 * Cuando la columna de la planilla tiene formato de fecha, getValues()
 * devuelve un Date, y al serializarlo hacia el sitio llega como
 * "Tue Sep 10 2024 00:00:00 GMT-0300 (Argentina Standard Time)".
 * Se normaliza acá, del lado del servidor, para que el front no tenga que
 * adivinar qué le llegó.
 */
var CAMPOS_FECHA_CORTA = ['alumno_fecha_nac'];

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
  var ids = hoja.getRange(2, COLUMNAS_ADMISIONES.indexOf('id') + 1, Math.max(hoja.getLastRow() - 1, 1), 1)
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

  Object.keys(cambios).forEach(function (campo) {
    var col = COLUMNAS_ADMISIONES.indexOf(campo);
    if (col === -1) return;
    hoja.getRange(fila, col + 1).setValue(cambios[campo]);
  });

  var colAct = COLUMNAS_ADMISIONES.indexOf('actualizado');
  if (colAct !== -1) hoja.getRange(fila, colAct + 1).setValue(new Date().toISOString());

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

  var colAnulado = COLUMNAS_EVENTOS.indexOf('anulado');
  if (colAnulado === -1) {
    throw new Error('Falta la columna "anulado" en Eventos. Corré migrarEsquema().');
  }
  hoja.getRange(fila, colAnulado + 1).setValue(true);

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

    var fila = COLUMNAS_EVENTOS.map(function (c) {
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

/** Mail de quien está usando el sistema. */
function usuarioActual() {
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
