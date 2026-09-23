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
    var colHuella = COLUMNAS_ADMISIONES.indexOf('huella');
    var colId = COLUMNAS_ADMISIONES.indexOf('id');

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
      var filas = nuevas.map(function (a) {
        return COLUMNAS_ADMISIONES.map(function (c) {
          var v = a[c];
          return (v === undefined || v === null) ? '' : v;
        });
      });
      destino.getRange(destino.getLastRow() + 1, 1, filas.length, COLUMNAS_ADMISIONES.length)
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

if (typeof module !== 'undefined' && module.exports) {
  Object.assign(module.exports, {
    derivarInclusion: derivarInclusion,
    calcularHuella: calcularHuella,
    mapearFilaSitio: mapearFilaSitio,
    siguienteId: siguienteId
  });
}
