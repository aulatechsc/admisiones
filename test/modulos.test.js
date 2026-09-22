/**
 * Integridad entre módulos.
 *
 * Estos tests existen por un error concreto: `leerHoja_` vivía en ingesta.gs
 * y la usaba datos.gs. En Apps Script eso "funciona" porque todos los .gs
 * comparten scope global — hasta que un archivo no se pega, o se pega
 * cortado, y el sitio se cae con un ReferenceError en un módulo que sí está.
 *
 * Acá se verifica que cada módulo use sólo símbolos de los módulos anteriores
 * en la cadena, así una dependencia hacia arriba falla en el test y no en
 * producción.
 *
 *     npm test
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { MODULOS, limpiar, construir } = require('../tools/bundle');

const ORIGEN = path.join(__dirname, '..', 'apps-script');

const fuente = {};
MODULOS.forEach((m) => {
  fuente[m] = fs.readFileSync(path.join(ORIGEN, m), 'utf8');
});

/** Funciones de nivel superior que define un archivo. */
function definidas(codigo) {
  return (codigo.match(/^function ([a-zA-Z_][a-zA-Z0-9_]*)/gm) || [])
    .map((f) => f.replace('function ', ''));
}

/** Constantes globales (var a nivel superior) que define un archivo. */
function constantes(codigo) {
  return (codigo.match(/^var ([a-zA-Z_][a-zA-Z0-9_]*)/gm) || [])
    .map((v) => v.replace('var ', ''));
}

const simbolos = {};
MODULOS.forEach((m) => {
  simbolos[m] = definidas(fuente[m]).concat(constantes(fuente[m]));
});

const TODOS = MODULOS.reduce((acc, m) => acc.concat(simbolos[m]), []);

/**
 * Deja sólo el código ejecutable: sin comentarios y sin literales de texto.
 *
 * Hace falta porque los comentarios mencionan funciones por su nombre y los
 * mensajes de error dicen cosas como "Corré setup() primero". Sin esta
 * limpieza, cualquiera de esas menciones se contaría como una dependencia
 * real y el test reportaría problemas que no existen.
 */
function soloCodigo(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // comentarios de bloque
    .replace(/\/\/[^\n]*/g, ' ')          // comentarios de línea
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")  // strings simples
    .replace(/"(?:[^"\\]|\\.)*"/g, '""'); // strings dobles
}

/**
 * Usos de símbolos del proyecto dentro de un archivo, descartando los que él
 * mismo define. Sólo se buscan nombres que algún módulo define, así no hay
 * que distinguir built-ins ni métodos de objetos.
 *
 * Las funciones se buscan como llamada — `nombre(` — y las constantes como
 * identificador suelto.
 */
function usados(archivo) {
  const codigo = soloCodigo(limpiar(fuente[archivo]));
  const propios = simbolos[archivo];
  const funciones = definidas(fuente[archivo]);

  return TODOS.filter((s) => {
    if (propios.indexOf(s) !== -1) return false;

    const esFuncion = MODULOS.some((m) => definidas(fuente[m]).indexOf(s) !== -1);
    const patron = esFuncion
      ? new RegExp('\\b' + s + '\\s*\\(')
      : new RegExp('\\b' + s + '\\b');

    return patron.test(codigo) && funciones.indexOf(s) === -1;
  });
}

// ───────────────────────────────────────────────────────────────────

test('ningún módulo depende de uno posterior en la cadena', () => {
  const problemas = [];

  MODULOS.forEach((archivo, i) => {
    const anteriores = MODULOS.slice(0, i);
    const disponibles = anteriores.reduce((acc, m) => acc.concat(simbolos[m]), []);

    usados(archivo).forEach((s) => {
      if (disponibles.indexOf(s) === -1) {
        const donde = MODULOS.filter((m) => simbolos[m].indexOf(s) !== -1)[0];
        problemas.push(`${archivo} usa "${s}", que está en ${donde} (posterior)`);
      }
    });
  });

  assert.deepStrictEqual(problemas, [], '\n  ' + problemas.join('\n  '));
});

test('no hay símbolos definidos dos veces', () => {
  // En Apps Script el último gana en silencio: dos funciones con el mismo
  // nombre en archivos distintos hacen que una desaparezca sin aviso.
  const vistos = {};
  const repetidos = [];

  MODULOS.forEach((m) => {
    simbolos[m].forEach((s) => {
      if (vistos[s]) repetidos.push(`"${s}" está en ${vistos[s]} y en ${m}`);
      else vistos[s] = m;
    });
  });

  assert.deepStrictEqual(repetidos, [], '\n  ' + repetidos.join('\n  '));
});

test('util.gs no depende de nadie', () => {
  assert.deepStrictEqual(usados('util.gs'), []);
});

test('config.gs no depende de nadie', () => {
  assert.deepStrictEqual(usados('config.gs'), []);
});

test('los puntos de entrada del sitio están definidos', () => {
  // Si falta doGet, la web app devuelve un error en blanco difícil de
  // diagnosticar.
  ['doGet', 'doPost', 'llamar'].forEach((f) => {
    assert.ok(TODOS.indexOf(f) !== -1, `falta ${f}`);
  });
});

test('las funciones que se corren a mano existen', () => {
  ['setup', 'importarDesdeSitio', 'instalarTriggerIngesta',
   'instalarTriggerRespuestas', 'sincronizarRespuestas'].forEach((f) => {
    assert.ok(TODOS.indexOf(f) !== -1, `falta ${f}`);
  });
});

// ───────────────────────────────────────────────────────────────────
// Bundle
// ───────────────────────────────────────────────────────────────────

test('el bundle incluye todos los módulos y compila', () => {
  construir();
  const dist = fs.readFileSync(path.join(__dirname, '..', 'dist', 'Codigo.gs'), 'utf8');

  MODULOS.forEach((m) => {
    assert.ok(dist.includes('// ' + m), `el bundle no incluye ${m}`);
  });

  assert.doesNotThrow(() => new Function(dist), 'el bundle no compila');
});

test('el bundle define todas las funciones de los módulos', () => {
  construir();
  const dist = fs.readFileSync(path.join(__dirname, '..', 'dist', 'Codigo.gs'), 'utf8');
  const enBundle = definidas(dist);

  MODULOS.forEach((m) => {
    definidas(fuente[m]).forEach((f) => {
      assert.ok(enBundle.indexOf(f) !== -1, `el bundle perdió ${f} de ${m}`);
    });
  });
});

test('el bundle no arrastra el bloque de exports de node', () => {
  construir();
  const dist = fs.readFileSync(path.join(__dirname, '..', 'dist', 'Codigo.gs'), 'utf8');
  assert.ok(!dist.includes('module.exports'), 'quedó código de node en el bundle');
});

test('el bundle avisa que es generado', () => {
  construir();
  const dist = fs.readFileSync(path.join(__dirname, '..', 'dist', 'Codigo.gs'), 'utf8');
  assert.match(dist, /ARCHIVO GENERADO/);
});
