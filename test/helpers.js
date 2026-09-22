/**
 * Carga de archivos .gs para testear con node.
 *
 * En Apps Script todos los .gs comparten un único scope global: ingesta.gs
 * llama a aBooleano() de plantillas.gs sin importar nada. Para que los tests
 * prueben lo mismo que corre en producción, los archivos se concatenan y se
 * evalúan juntos, replicando ese scope.
 *
 * Se usa `new Function` y no `vm.runInNewContext` porque vm crea un realm
 * aparte, con sus propios Array y Object: los valores devueltos tendrían otro
 * prototipo y deepStrictEqual los rechazaría aunque el contenido fuera igual.
 */

const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'apps-script');

/** Doble de SpreadsheetApp y demás globals de Apps Script, para los tests. */
function stubsAppsScript() {
  return {
    console,
    Utilities: {
      getUuid: () => 'uuid-de-prueba',
      formatDate: (d) => d.toISOString()
    }
  };
}

/**
 * Carga los .gs indicados en un scope compartido y devuelve sus exports.
 * El orden importa igual que en Apps Script: config primero, después lo que
 * depende de él.
 */
function cargar(...archivos) {
  const codigo = archivos
    .map((a) => fs.readFileSync(path.join(DIR, a), 'utf8'))
    .join('\n;\n');

  const modulo = { exports: {} };
  const stubs = stubsAppsScript();
  const nombres = Object.keys(stubs);
  const valores = nombres.map((n) => stubs[n]);

  new Function('module', 'exports', ...nombres, codigo)(modulo, modulo.exports, ...valores);
  return modulo.exports;
}

module.exports = { cargar };
