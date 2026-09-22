/**
 * Chequeos del sitio y de los permisos de la API.
 *
 *     npm test
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { cargar } = require('./helpers');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
const A = cargar('config.gs', 'plantillas.gs', 'ingesta.gs', 'api.gs');

// ───────────────────────────────────────────────────────────────────
// El sitio
// ───────────────────────────────────────────────────────────────────

test('el JavaScript del sitio compila', () => {
  const bloques = HTML.match(/<script>([\s\S]*?)<\/script>/g) || [];
  assert.ok(bloques.length, 'no se encontró ningún bloque <script>');

  bloques.forEach((b, i) => {
    const codigo = b.replace(/^<script>/, '').replace(/<\/script>$/, '');
    assert.doesNotThrow(() => new Function(codigo), `el bloque ${i} no compila`);
  });
});

test('el CSS no tiene colores inválidos', () => {
  const css = (HTML.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
  const colores = css.match(/#[0-9a-zA-Z]+/g) || [];
  colores.forEach((c) => {
    assert.match(c, /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, `color inválido: ${c}`);
  });
});

test('el sitio declara viewport y charset', () => {
  assert.match(HTML, /<meta charset="UTF-8">/i);
  assert.match(HTML, /name="viewport"/i);
});

test('el sitio funciona servido por Apps Script y desde afuera', () => {
  // La misma página se sirve de las dos formas: bajo Apps Script existe
  // google.script.run, desde Vercel se usa fetch con el ID token.
  assert.ok(HTML.includes('google.script.run'));
  assert.ok(HTML.includes('id_token'));
});

test('el fetch usa text/plain para evitar el preflight', () => {
  // Las web apps de Apps Script no contestan OPTIONS. Con application/json
  // el navegador haría preflight y la llamada fallaría desde otro origen.
  assert.ok(HTML.includes("'Content-Type': 'text/plain;charset=utf-8'"));
});

test('el login restringe el dominio', () => {
  assert.ok(HTML.includes("hd: 'sancarlos.edu.ar'"));
});

test('el sitio escapa lo que viene de la planilla', () => {
  // Los datos los tipean las familias en un formulario público: si se
  // interpolaran crudos, un nombre con <script> se ejecutaría en el navegador
  // de la directora.
  assert.ok(/function esc\(/.test(HTML));
  assert.ok(HTML.includes("replace(/</g, '&lt;')"));

  const bloques = HTML.match(/<script>([\s\S]*?)<\/script>/g) || [];
  const codigo = bloques.join('\n');
  const interpolaciones = codigo.match(/'\s*\+\s*(a|e|p|d|r)\.[a-z_]+\s*\+\s*'/g) || [];
  assert.deepStrictEqual(
    interpolaciones, [],
    'hay datos insertados en el HTML sin pasar por esc(): ' + interpolaciones.join(', ')
  );
});

test('la configuración para Vercel está vacía y documentada', () => {
  // Se completan al desplegar. Si vinieran con algo, sería un valor de
  // prueba filtrado al repo.
  assert.match(HTML, /var URL_API = '';/);
  assert.match(HTML, /var CLIENT_ID = '';/);
  assert.ok(HTML.includes('docs/sitio.md'));
});

// ───────────────────────────────────────────────────────────────────
// Campos editables: lista blanca
// ───────────────────────────────────────────────────────────────────

test('sólo pasan los campos de la lista blanca', () => {
  const r = A.camposEditables({ alumno_nombre: 'Sofía', celular: '11' });
  assert.deepStrictEqual(r, { alumno_nombre: 'Sofía', celular: '11' });
});

test('los campos internos no se pueden editar desde el sitio', () => {
  // `huella` sostiene la deduplicación de la ingesta y `estado` tiene que
  // pasar por cambiarEstado() para quedar registrado en Eventos. Si el front
  // pudiera mandarlos, se reimportarían admisiones y se perderían cambios
  // de estado sin rastro.
  ['huella', 'id', 'estado', 'thread_id', 'origen', 'fecha_alta', 'actualizado'].forEach((campo) => {
    assert.throws(
      () => A.camposEditables({ [campo]: 'lo que sea' }),
      /No hay campos editables/,
      `${campo} no debería ser editable`
    );
  });
});

test('los campos internos se descartan sin bloquear a los válidos', () => {
  const r = A.camposEditables({ alumno_nombre: 'Sofía', huella: 'intento', estado: 'matriculada' });
  assert.deepStrictEqual(r, { alumno_nombre: 'Sofía' });
});

test('un pedido sin campos editables falla en vez de pasar vacío', () => {
  assert.throws(() => A.camposEditables({}), /No hay campos editables/);
  assert.throws(() => A.camposEditables(null), /No hay campos editables/);
});

test('todo campo editable existe en Admisiones', () => {
  A.CAMPOS_EDITABLES.forEach((c) => {
    assert.ok(
      A.COLUMNAS_ADMISIONES.indexOf(c) !== -1,
      `${c} es editable pero no es columna de Admisiones`
    );
  });
});

// ───────────────────────────────────────────────────────────────────
// Alcance por nivel
// ───────────────────────────────────────────────────────────────────

test('un editor sólo alcanza sus niveles', () => {
  assert.deepStrictEqual(
    A.nivelesDe({ rol: 'editor', niveles: ['Primaria'] }),
    ['Primaria']
  );
});

test('un admin alcanza todos los niveles', () => {
  assert.deepStrictEqual(
    A.nivelesDe({ rol: 'admin', niveles: ['Inicial'] }),
    A.NIVELES
  );
});

test('un editor sin niveles no alcanza nada', () => {
  assert.deepStrictEqual(A.nivelesDe({ rol: 'editor', niveles: [] }), []);
});
