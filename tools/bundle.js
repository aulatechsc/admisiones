/**
 * Genera dist/Codigo.gs juntando todos los módulos en un archivo.
 *
 *     npm run bundle
 *
 * El repo se mantiene en módulos chicos, pero pegar nueve archivos a mano en
 * el editor de Apps Script es lento y propenso a que alguno quede cortado o
 * sin pegar — y como todos comparten el scope global, un archivo faltante se
 * manifiesta como un ReferenceError en otro que sí está.
 *
 * Un solo archivo elimina esa clase de error. Para quien use clasp, esto es
 * innecesario: `clasp push` sube los módulos tal cual.
 */

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const ORIGEN = path.join(RAIZ, 'apps-script');
const DESTINO = path.join(RAIZ, 'dist');

/**
 * Orden de capas. Cada archivo sólo puede usar símbolos de los anteriores.
 * En Apps Script el orden no afecta la ejecución — todo comparte scope — pero
 * mantenerlo hace que las dependencias sean legibles y que el test de capas
 * pueda detectar una referencia hacia arriba.
 */
const MODULOS = [
  'util.gs',        // sin dependencias
  'config.gs',      // sin dependencias
  'plantillas.gs',  // util, config
  'datos.gs',       // util, config
  'fichas.gs',      // util, config, datos
  'mailer.gs',      // util, config, plantillas, datos
  'ingesta.gs',     // util, config, datos, fichas, mailer — al dar de alta
                    //   genera la ficha y avisa al equipo del nivel
  'api.gs',         // todos
  'setup.gs'        // todos
];

/**
 * Saca el bloque de exports para node, que en Apps Script no hace nada.
 *
 * Cuenta llaves en vez de usar un regex hasta el final del archivo: con `$`,
 * cualquier función escrita después del bloque de exports desaparecía del
 * bundle sin aviso.
 */
function limpiar(codigo) {
  const marca = "if (typeof module !== 'undefined' && module.exports) {";
  const i = codigo.indexOf(marca);
  if (i === -1) return codigo.trimEnd();

  let nivel = 0;
  let j = codigo.indexOf('{', i);
  const inicioLlaves = j;

  while (j < codigo.length) {
    if (codigo[j] === '{') nivel++;
    else if (codigo[j] === '}') {
      nivel--;
      if (nivel === 0) break;
    }
    j++;
  }

  if (nivel !== 0) {
    throw new Error('El bloque de exports no cierra bien (desde ' + inicioLlaves + ')');
  }

  return (codigo.slice(0, i) + codigo.slice(j + 1)).trimEnd();
}

function construir() {
  const partes = MODULOS.map((nombre) => {
    const codigo = fs.readFileSync(path.join(ORIGEN, nombre), 'utf8');
    return [
      '// ' + '='.repeat(68),
      '// ' + nombre,
      '// ' + '='.repeat(68),
      '',
      limpiar(codigo)
    ].join('\n');
  });

  const cabecera = [
    '/**',
    ' * Admisiones — Colegio San Carlos Diálogos',
    ' *',
    ' * ARCHIVO GENERADO. No editar acá: los cambios se pisan en el próximo',
    ' * build. El código vive en apps-script/, un archivo por módulo.',
    ' *',
    ' *     https://github.com/aulatechsc/admisiones',
    ' *',
    ' * Para regenerarlo: npm run bundle',
    ' */',
    ''
  ].join('\n');

  if (!fs.existsSync(DESTINO)) fs.mkdirSync(DESTINO, { recursive: true });

  const salida = cabecera + '\n' + partes.join('\n\n') + '\n';
  fs.writeFileSync(path.join(DESTINO, 'Codigo.gs'), salida, 'utf8');

  fs.copyFileSync(path.join(RAIZ, 'web', 'index.html'), path.join(DESTINO, 'index.html'));

  return {
    lineas: salida.split('\n').length,
    modulos: MODULOS.length
  };
}

if (require.main === module) {
  const r = construir();
  console.log(`dist/Codigo.gs — ${r.modulos} módulos, ${r.lineas} líneas`);
  console.log('dist/index.html');
}

module.exports = { construir, MODULOS, limpiar };
