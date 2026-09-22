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

if (typeof module !== 'undefined' && module.exports) {
  Object.assign(module.exports, {
    aBooleano: aBooleano,
    aNumero: aNumero,
    normalizarFecha: normalizarFecha,
    normalizarParaComparar: normalizarParaComparar
  });
}
