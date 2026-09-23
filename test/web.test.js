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
const A = cargar('util.gs', 'config.gs', 'plantillas.gs', 'mailer.gs', 'ingesta.gs', 'api.gs');

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

  // Sólo los `#` que están en un valor de propiedad. Buscarlos en todo el CSS
  // tomaría los selectores de id (#botonGoogle) por colores rotos.
  const colores = [];
  (css.match(/:[^;{}]+[;}]/g) || []).forEach((declaracion) => {
    (declaracion.match(/#[0-9a-zA-Z]+/g) || []).forEach((c) => colores.push(c));
  });

  assert.ok(colores.length > 10, 'no se encontraron colores: el test no está mirando nada');

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

  // Marca sólo lo que termina dentro de marcado: un literal con `<` o `>`
  // pegado a la interpolación. Un valor concatenado en un mensaje de texto
  // que después pasa por aviso() o flotante() ya se escapa ahí, y contarlo
  // haría que el test diera falsos positivos y terminara ignorándose.
  //
  // Los nombres de variable van sin la bandera `i` y anclados con \b: son las
  // que llevan datos de la planilla (a = admisión, e = evento, p = previsua-
  // lización, r = respuesta). Sin eso, ICO.cerrar — iconos fijos del propio
  // código — se contaba como dato de usuario.
  const enHtml = [
    /<[^'"]*'\s*\+\s*\b[aeprdu]\.[a-z0-9_]+/g,   // …<span>' + a.campo
    /\b[aeprdu]\.[a-z0-9_]+\s*\+\s*'[^'"]*[<>]/g // a.campo + '</span>…
  ];

  const hallazgos = [];
  enHtml.forEach((patron) => {
    (codigo.match(patron) || []).forEach((m) => {
      if (!/\besc\(/.test(m)) hallazgos.push(m.trim());
    });
  });

  assert.deepStrictEqual(
    hallazgos, [],
    'datos insertados en HTML sin pasar por esc():\n  ' + hallazgos.join('\n  ')
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

// ───────────────────────────────────────────────────────────────────
// Identidad de quien opera
// ───────────────────────────────────────────────────────────────────

test('el usuario en curso se fija con el mail verificado', () => {
  // Servido por Apps Script, Session.getActiveUser() alcanza. Desde Vercel no
  // hay sesión de Google en la llamada: sin esto, todos los eventos quedarían
  // firmados por la cuenta dueña del script en vez de por la persona.
  const api = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'api.gs'), 'utf8');
  const cuerpo = api.slice(api.indexOf('function ejecutar('));
  assert.ok(cuerpo.slice(0, 400).includes('fijarUsuarioActual(email)'),
    'ejecutar() no fija el usuario antes de operar');
});

test('usuarioActual prefiere el mail verificado sobre la sesión', () => {
  const datos = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'datos.gs'), 'utf8');
  const cuerpo = datos.slice(datos.indexOf('function usuarioActual('));
  const hasta = cuerpo.indexOf('\n}');
  assert.ok(cuerpo.slice(0, hasta).indexOf('USUARIO_EN_CURSO') <
            cuerpo.slice(0, hasta).indexOf('getActiveUser'),
    'consulta la sesión antes que el mail verificado');
});
