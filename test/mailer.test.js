/**
 * Tests de la construcción del mensaje y del formato de las fichas.
 *
 *     npm test
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { cargar } = require('./helpers');

const M = cargar('util.gs', 'config.gs', 'plantillas.gs', 'ingesta.gs', 'mailer.gs', 'fichas.gs');

// ───────────────────────────────────────────────────────────────────
// Reply-To: el mecanismo que hace que las directoras reciban las respuestas
// ───────────────────────────────────────────────────────────────────

test('el Reply-To incluye al remitente y a quienes reciben copia', () => {
  // Con un solo Reply-To hay que elegir: o la respuesta llega a la directora
  // (y el sistema no la registra) o llega al sistema (y la directora no se
  // entera). Con los dos, llega a ambos.
  const r = M.armarResponderA('admision@sancarlos.edu.ar', ['elianawaichman@sancarlos.edu.ar']);
  assert.deepStrictEqual(r, ['admision@sancarlos.edu.ar', 'elianawaichman@sancarlos.edu.ar']);
});

test('armarResponderA no repite direcciones', () => {
  const r = M.armarResponderA('admision@sancarlos.edu.ar', [
    'admision@sancarlos.edu.ar',
    'rhalperin@sancarlos.edu.ar'
  ]);
  assert.deepStrictEqual(r, ['admision@sancarlos.edu.ar', 'rhalperin@sancarlos.edu.ar']);
});

test('armarResponderA funciona sin copias', () => {
  assert.deepStrictEqual(M.armarResponderA('admision@sancarlos.edu.ar', []),
    ['admision@sancarlos.edu.ar']);
  assert.deepStrictEqual(M.armarResponderA('admision@sancarlos.edu.ar', null),
    ['admision@sancarlos.edu.ar']);
});

test('cada nivel tiene a quién mandarle copia', () => {
  M.NIVELES.forEach((nivel) => {
    const copias = M.COPIAS_POR_NIVEL[nivel];
    assert.ok(Array.isArray(copias) && copias.length, `${nivel} no tiene copias configuradas`);
    copias.forEach((c) => assert.ok(M.esMailValido(c), `${nivel}: "${c}" no es un mail válido`));
  });
});

// ───────────────────────────────────────────────────────────────────
// MIME
// ───────────────────────────────────────────────────────────────────

function mime(extra) {
  return M.construirMime(Object.assign({
    deNombre: 'Admisiones - Colegio San Carlos Dialogos',
    deEmail: 'admision@sancarlos.edu.ar',
    para: 'familia@ejemplo.com',
    copias: ['elianawaichman@sancarlos.edu.ar'],
    responderA: ['admision@sancarlos.edu.ar', 'elianawaichman@sancarlos.edu.ar'],
    asunto: 'Admision Sofia Perez',
    cuerpo: 'Hola'
  }, extra || {}));
}

test('el MIME lleva From, To, Cc y Reply-To', () => {
  const m = mime();
  assert.ok(m.includes('From: Admisiones - Colegio San Carlos Dialogos <admision@sancarlos.edu.ar>'));
  assert.ok(m.includes('To: familia@ejemplo.com'));
  assert.ok(m.includes('Cc: elianawaichman@sancarlos.edu.ar'));
  assert.ok(m.includes('Reply-To: admision@sancarlos.edu.ar, elianawaichman@sancarlos.edu.ar'));
});

test('el MIME usa CRLF entre headers', () => {
  // Con \n solo, varios servidores rechazan el mensaje.
  assert.ok(mime().includes('\r\n'));
});

test('sin copias no se emite el header Cc', () => {
  const m = mime({ copias: [], responderA: ['admision@sancarlos.edu.ar'] });
  assert.ok(!m.includes('Cc:'));
});

test('los headers con tildes se codifican en RFC 2047', () => {
  // "Diálogos" sin codificar llega con la tilde rota en varios clientes.
  const m = mime({ deNombre: 'Admisiones - Colegio San Carlos Diálogos' });
  assert.ok(m.includes('=?UTF-8?B?'));
  assert.ok(!m.includes('Diálogos <'));
});

test('un asunto con tildes también se codifica', () => {
  const m = mime({ asunto: 'Admisión Sofía Pérez / Sala de 4 años' });
  assert.ok(/Subject: =\?UTF-8\?B\?/.test(m));
});

test('el texto ASCII no se codifica de más', () => {
  assert.strictEqual(M.codificarHeader('Admision Sofia'), 'Admision Sofia');
});

test('el cuerpo va en base64 y declara UTF-8', () => {
  const m = mime({ cuerpo: 'Estimada/o Ana:\n\nSu hijo/a está aceptado/a.' });
  assert.ok(m.includes('Content-Type: text/plain; charset=UTF-8'));
  assert.ok(m.includes('Content-Transfer-Encoding: base64'));

  const b64 = m.split('\r\n\r\n')[1];
  assert.strictEqual(
    Buffer.from(b64, 'base64').toString('utf8'),
    'Estimada/o Ana:\n\nSu hijo/a está aceptado/a.'
  );
});

test('formatearRemitente sin nombre deja sólo la dirección', () => {
  assert.strictEqual(M.formatearRemitente('', 'admision@sancarlos.edu.ar'), 'admision@sancarlos.edu.ar');
});

// ───────────────────────────────────────────────────────────────────
// Validación de direcciones
// ───────────────────────────────────────────────────────────────────

test('esMailValido acepta direcciones reales y rechaza el resto', () => {
  assert.ok(M.esMailValido('ana@ejemplo.com'));
  assert.ok(M.esMailValido('  ana.perez@sancarlos.edu.ar  '));

  assert.ok(!M.esMailValido(''));
  assert.ok(!M.esMailValido(null));
  assert.ok(!M.esMailValido('ana'));
  assert.ok(!M.esMailValido('ana@'));
  assert.ok(!M.esMailValido('ana@sinpunto'));
  assert.ok(!M.esMailValido('con espacio@ejemplo.com'));
});

// ───────────────────────────────────────────────────────────────────
// Fichas
// ───────────────────────────────────────────────────────────────────

test('hay ficha configurada para los tres niveles', () => {
  M.NIVELES.forEach((nivel) => {
    const cfg = M.FICHA_POR_NIVEL[nivel];
    assert.ok(cfg, `falta la ficha de ${nivel}`);
    assert.ok(cfg.titulo && cfg.etiquetaEscuela && cfg.pie);
  });
});

test('cada nivel usa su vocabulario en la ficha', () => {
  assert.match(M.FICHA_POR_NIVEL.Inicial.etiquetaEscuela, /JARDÍN/);
  assert.match(M.FICHA_POR_NIVEL.Primaria.etiquetaEscuela, /COLEGIO/);
  assert.match(M.FICHA_POR_NIVEL.Inicial.etiquetaGrado, /SALA/);
  assert.match(M.FICHA_POR_NIVEL.Primaria.etiquetaGrado, /GRADO/);
  assert.match(M.FICHA_POR_NIVEL.Secundaria.etiquetaGrado, /CURSO/);
});

test('el pie de la ficha no lleva markdown', () => {
  // El script viejo metía [www.sancarlos.edu.ar](https://...) en el texto, y
  // en un Google Doc eso sale literal, con corchetes y todo.
  Object.keys(M.FICHA_POR_NIVEL).forEach((nivel) => {
    const pie = M.FICHA_POR_NIVEL[nivel].pie;
    assert.ok(!pie.includes('['), `${nivel}: el pie tiene markdown`);
    assert.ok(!pie.includes(']('), `${nivel}: el pie tiene markdown`);
  });
});

test('mostrarBooleano distingue Sí, No y sin definir', () => {
  assert.strictEqual(M.mostrarBooleano(true), 'Sí');
  assert.strictEqual(M.mostrarBooleano('TRUE'), 'Sí');
  assert.strictEqual(M.mostrarBooleano(false), 'No');
  assert.strictEqual(M.mostrarBooleano('No'), 'No');
  // Sin dato queda en blanco, no en "No": son cosas distintas en una ficha
  assert.strictEqual(M.mostrarBooleano(null), '');
  assert.strictEqual(M.mostrarBooleano('texto raro'), '');
});

test('calcularEdad usa fechas dd/mm/aaaa', () => {
  const ref = new Date(2026, 8, 22); // 22/09/2026
  assert.strictEqual(M.calcularEdad('03/07/2021', ref), '5');
  assert.strictEqual(M.calcularEdad('27/11/2009', ref), '16');
});

test('calcularEdad no cuenta el cumpleaños que todavía no llegó', () => {
  const ref = new Date(2026, 8, 22); // 22/09/2026
  assert.strictEqual(M.calcularEdad('23/09/2020', ref), '5'); // cumple mañana
  assert.strictEqual(M.calcularEdad('22/09/2020', ref), '6'); // cumple hoy
  assert.strictEqual(M.calcularEdad('21/09/2020', ref), '6');
});

test('calcularEdad tolera lo que no es fecha', () => {
  assert.strictEqual(M.calcularEdad('', new Date()), '');
  assert.strictEqual(M.calcularEdad(null, new Date()), '');
  assert.strictEqual(M.calcularEdad('no es fecha', new Date()), '');
  assert.strictEqual(M.calcularEdad('2021-07-03', new Date()), '');
});

test('mostrarFecha deja pasar el texto ya formateado', () => {
  assert.strictEqual(M.mostrarFecha('03/07/2021'), '03/07/2021');
  assert.strictEqual(M.mostrarFecha(''), '');
  assert.strictEqual(M.mostrarFecha(null), '');
});
