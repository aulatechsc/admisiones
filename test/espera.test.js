/**
 * Días de espera y orden del listado.
 *
 *     npm test
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { cargar } = require('./helpers');

const U = cargar('util.gs');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');

const HOY = new Date(2026, 8, 23); // 23/09/2026

// ───────────────────────────────────────────────────────────────────
// Fechas
// ───────────────────────────────────────────────────────────────────

test('aFecha acepta los formatos que usan las planillas', () => {
  assert.ok(U.aFecha(new Date()) instanceof Date);
  assert.strictEqual(U.aFecha('23/09/2026').getDate(), 23);
  assert.strictEqual(U.aFecha('23/09/2026').getMonth(), 8);
  assert.ok(U.aFecha('2026-09-23T10:00:00Z') instanceof Date);
});

test('aFecha devuelve null para lo que no es fecha', () => {
  assert.strictEqual(U.aFecha(''), null);
  assert.strictEqual(U.aFecha(null), null);
  assert.strictEqual(U.aFecha('cualquier cosa'), null);
  assert.strictEqual(U.aFecha(new Date('no')), null);
});

test('diasEntre cuenta días enteros, no horas', () => {
  // Un mail de ayer a las 23:50 y otro de hoy a las 00:10 son días
  // distintos, aunque pasen 20 minutos.
  assert.strictEqual(U.diasEntre('22/09/2026', HOY), 1);
  assert.strictEqual(U.diasEntre('23/09/2026', HOY), 0);
  assert.strictEqual(U.diasEntre('13/09/2026', HOY), 10);
});

test('diasEntre devuelve null si no hay fecha', () => {
  assert.strictEqual(U.diasEntre('', HOY), null);
  assert.strictEqual(U.diasEntre(null, HOY), null);
});

// ───────────────────────────────────────────────────────────────────
// Urgencia (la lógica vive en el sitio)
// ───────────────────────────────────────────────────────────────────

/**
 * Extrae UNA función del <script> del sitio y la evalúa aislada.
 *
 * Evaluar el script entero no sirve: al final engancha handlers con
 * document.getElementById y explota fuera del navegador. Un intento anterior
 * lo hacía así, caía en un catch y terminaba comprobando nada más que la
 * presencia de unos textos — un test que no ejecutaba la lógica que dice
 * probar.
 */
function funcionDelSitio(nombre) {
  const i = HTML.indexOf('function ' + nombre + '(');
  assert.ok(i !== -1, `no se encontró la función ${nombre} en el sitio`);

  let nivel = 0;
  let j = HTML.indexOf('{', i);
  const inicio = j;
  while (j < HTML.length) {
    if (HTML[j] === '{') nivel++;
    else if (HTML[j] === '}') {
      nivel--;
      if (nivel === 0) break;
    }
    j++;
  }
  assert.ok(nivel === 0, `la función ${nombre} no cierra bien (desde ${inicio})`);

  const codigo = HTML.slice(i, j + 1);
  const contexto = {};
  new Function('ctx', codigo + '\n;ctx.f = ' + nombre + ';')(contexto);
  return contexto.f;
}

test('la urgencia distingue las tres situaciones', () => {
  const urgencia = funcionDelSitio('urgencia');

  // Que nos hayan respondido y no contestemos pesa más que esperar respuesta
  assert.strictEqual(urgencia({ tipo: 'nos_responden', dias: 1 }), 'nuestra');
  assert.strictEqual(urgencia({ tipo: 'nos_responden', dias: 0 }), 'tranquilo');

  assert.strictEqual(urgencia({ tipo: 'sin_contactar', dias: 0 }), 'tranquilo');
  assert.strictEqual(urgencia({ tipo: 'sin_contactar', dias: 1 }), 'atencion');
  assert.strictEqual(urgencia({ tipo: 'sin_contactar', dias: 3 }), 'urgente');

  assert.strictEqual(urgencia({ tipo: 'esperando', dias: 2 }), 'tranquilo');
  assert.strictEqual(urgencia({ tipo: 'esperando', dias: 3 }), 'atencion');
  assert.strictEqual(urgencia({ tipo: 'esperando', dias: 8 }), 'urgente');

  // Una admisión cerrada no espera nada
  assert.strictEqual(urgencia({ tipo: 'cerrada', dias: null }), null);
  assert.strictEqual(urgencia(null), null);
});

// ───────────────────────────────────────────────────────────────────
// El sitio
// ───────────────────────────────────────────────────────────────────

test('la tarjeta muestra fecha, alumno, grado y año', () => {
  assert.ok(HTML.includes('fechaCorta(a.fecha_alta)'), 'falta la fecha del formulario');
  assert.ok(HTML.includes('esc(a.alumno_nombre)'));
  assert.ok(HTML.includes('esc(a.grado_solicitado'));
  assert.ok(HTML.includes('esc(a.anio_vacante'));
});

test('los checkpoints separan el flujo de los desvíos', () => {
  // Lista de espera, sin vacante y desistió no son pasos de una secuencia:
  // dibujarlos como paso siguiente daría a entender que hay que pasar por
  // ahí para llegar a matriculada.
  assert.ok(HTML.includes('ORDEN_MAXIMO_FLUJO'));
  assert.ok(HTML.includes('function pintarPasos('));
  assert.ok(HTML.includes('class="ramas"'));
});

test('el estado se cambia desde los checkpoints', () => {
  assert.ok(HTML.includes('data-ir-a='));
  assert.ok(HTML.includes("accion('cambiarEstado'"));
});

test('ya no está el botón de registrar llamada', () => {
  assert.ok(!HTML.includes('bLlamada'), 'quedó el botón de llamada');
  assert.ok(!HTML.includes("registrarLlamada'"), 'quedó la llamada a registrarLlamada');
});

test('ya no están los filtros de estado y año', () => {
  assert.ok(!HTML.includes('chipsEstado'), 'quedaron los chips de estado');
  assert.ok(!HTML.includes('filtroAnio'), 'quedó el filtro de año');
});

test('el buscador sigue estando', () => {
  // Se sacaron los filtros, no la búsqueda: con cientos de admisiones es la
  // única forma de encontrar una familia puntual.
  assert.ok(HTML.includes("getElementById('buscar')"));
});

test('no quedaron referencias a elementos que ya no existen', () => {
  // Un getElementById sobre algo borrado tira TypeError y corta el script
  // entero, así que la página queda en blanco sin decir por qué.
  const bloques = (HTML.match(/<script>([\s\S]*?)<\/script>/g) || []).join('\n');
  const usados = (bloques.match(/getElementById\('([a-zA-Z]+)'\)/g) || [])
    .map((m) => m.replace(/getElementById\('|'\)/g, ''));

  const definidos = (HTML.match(/id="([a-zA-Z]+)"/g) || [])
    .map((m) => m.replace(/id="|"/g, ''));

  // Los que se crean dinámicamente dentro del panel o los modales
  const dinamicos = [
    'avisoPanel', 'avisoMail', 'avisoPlantilla', 'bEstado', 'bGuardar', 'bMail',
    'bNota', 'bFicha', 'bEnviar', 'bGuardarP', 'selPlantilla', 'asunto', 'cuerpo',
    'pCond', 'pAsunto', 'pCuerpo', 'notaEstado', 'selEstado'
  ];

  const huerfanos = usados.filter(function (u) {
    return definidos.indexOf(u) === -1 && dinamicos.indexOf(u) === -1;
  });

  assert.deepStrictEqual(huerfanos, [], 'getElementById sobre ids inexistentes: ' + huerfanos.join(', '));
});

// ───────────────────────────────────────────────────────────────────
// La ficha vuelve al diseño original
// ───────────────────────────────────────────────────────────────────

test('la ficha no suma campos al layout original', () => {
  const ficha = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'fichas.gs'), 'utf8');

  // La ficha se imprime y se completa a mano en la entrevista: el orden y el
  // espacio en blanco son parte del diseño. Una versión anterior agregó edad,
  // inclusión, trayectoria y bilingüe, y lo desarmó.
  ['EDAD', 'PROYECTO DE INCLUSIÓN', 'TRAYECTORIA ESCOLAR', 'COLEGIO BILINGÜE', 'MOTIVO DEL CAMBIO']
    .forEach((campo) => {
      assert.ok(!ficha.includes(campo), `la ficha volvió a sumar "${campo}"`);
    });
});

test('la ficha conserva las secciones del original', () => {
  const ficha = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'fichas.gs'), 'utf8');
  ['NOMBRE Y APELLIDO', 'FECHA DE NACIMIENTO', 'DNI', 'DIRECCIÓN',
   'PADRE · MADRE · TUTOR/A 1', 'PADRE · MADRE · TUTOR/A 2',
   'REGISTRO DE ADMISIÓN', 'OBSERVACIONES', 'Ficha de Admisión']
    .forEach((parte) => {
      assert.ok(ficha.includes(parte), `la ficha perdió "${parte}"`);
    });
});
