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

  var filas = ESTADOS_INICIALES.map(function (e) {
    return COLUMNAS_ESTADOS.map(function (c) { return e[c]; });
  });
  hoja.getRange(2, 1, filas.length, COLUMNAS_ESTADOS.length).setValues(filas);

  // Pinta cada fila con el color del estado, para que la planilla se lea
  // igual que el sitio.
  ESTADOS_INICIALES.forEach(function (e, i) {
    hoja.getRange(i + 2, 1, 1, COLUMNAS_ESTADOS.length).setBackground(e.color);
  });
}

function cargarPlantillas_(ss) {
  var hoja = ss.getSheetByName(HOJA_PLANTILLAS);
  if (hoja.getLastRow() > 1) return;

  var filas = PLANTILLAS_INICIALES.map(function (p) {
    return COLUMNAS_PLANTILLAS.map(function (c) { return p[c]; });
  });
  hoja.getRange(2, 1, filas.length, COLUMNAS_PLANTILLAS.length).setValues(filas);

  hoja.setColumnWidth(COLUMNAS_PLANTILLAS.indexOf('asunto') + 1, 300);
  hoja.setColumnWidth(COLUMNAS_PLANTILLAS.indexOf('cuerpo') + 1, 600);
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
