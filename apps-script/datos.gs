/**
 * Acceso a la planilla: leer y escribir admisiones, eventos y usuarios.
 *
 * Todo lo que toca SpreadsheetApp pasa por acá, así el resto del código
 * trabaja con objetos y no con índices de columna — que es justamente lo que
 * hace frágiles a los scripts viejos.
 */

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

function hoja_(nombre) {
  var h = SpreadsheetApp.getActive().getSheetByName(nombre);
  if (!h) throw new Error('Falta la solapa "' + nombre + '". Corré setup() primero.');
  return h;
}

// ───────────────────────────────────────────────────────────────────
// Admisiones
// ───────────────────────────────────────────────────────────────────

/** Todas las admisiones, opcionalmente filtradas por nivel y estado. */
function leerAdmisiones(filtros) {
  filtros = filtros || {};
  var datos = leerHoja_(hoja_(HOJAS.ADMISIONES));
  var todas = filasAObjetos_(datos.encabezados, datos.filas)
    .filter(function (a) { return a.id; });

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

  return todas;
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

/** Cambia el estado y lo deja asentado en Eventos. */
function cambiarEstado(id, nuevoEstado, nota) {
  var estados = leerEstados();
  var valido = estados.some(function (e) { return e.id === nuevoEstado; });
  if (!valido) throw new Error('Estado desconocido: ' + nuevoEstado);

  var antes = obtenerAdmision(id);
  if (!antes) throw new Error('No existe la admisión ' + id);
  if (antes.estado === nuevoEstado) return antes;

  actualizarAdmision(id, { estado: nuevoEstado });

  registrarEvento({
    id_admision: id,
    tipo: 'cambio_estado',
    usuario: usuarioActual(),
    asunto: antes.estado + ' → ' + nuevoEstado,
    detalle: nota || ''
  });

  return obtenerAdmision(id);
}

// ───────────────────────────────────────────────────────────────────
// Eventos
// ───────────────────────────────────────────────────────────────────

/** Eventos de una admisión, del más nuevo al más viejo. */
function leerEventos(idAdmision) {
  var datos = leerHoja_(hoja_(HOJAS.EVENTOS));
  return filasAObjetos_(datos.encabezados, datos.filas)
    .filter(function (e) { return e.id_admision === idAdmision; })
    .sort(function (a, b) {
      return (b.timestamp || '').toString().localeCompare((a.timestamp || '').toString());
    });
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
