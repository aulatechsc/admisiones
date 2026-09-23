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
function extraerFuncion(nombre) {
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
  return HTML.slice(i, j + 1);
}

/**
 * Evalúa una o varias funciones del sitio juntas y devuelve la última.
 * Varias porque algunas se apoyan en otras: fechaCorta usa aFecha, y
 * extraerla sola tira ReferenceError.
 */
function funcionDelSitio(...nombres) {
  const codigo = nombres.map(extraerFuncion).join('\n');
  const contexto = {};
  new Function('ctx', codigo + '\n;ctx.f = ' + nombres[nombres.length - 1] + ';')(contexto);
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

// ───────────────────────────────────────────────────────────────────
// Fechas hacia el sitio
// ───────────────────────────────────────────────────────────────────

test('la fecha de nacimiento se normaliza antes de salir al sitio', () => {
  // Cuando la columna tiene formato de fecha, getValues() devuelve un Date y
  // al serializarlo hacia el sitio llegaba como
  // "Tue Sep 10 2024 00:00:00 GMT-0300 (Argentina Standard Time)".
  const datos = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'datos.gs'), 'utf8');
  assert.ok(datos.includes('CAMPOS_FECHA_CORTA'), 'falta la normalización de fechas');
  assert.ok(datos.includes("'dd/MM/yyyy'"), 'no formatea a dd/mm/aaaa');
  assert.ok(datos.includes('normalizarFechasVisibles_'), 'no se aplica al leer');
});

test('el sitio muestra la fecha de nacimiento, no un Date crudo', () => {
  // Si alguna vez llega un Date sin normalizar, fechaCorta lo muestra igual
  // en dd/mm/aaaa en vez de volcar el toString() del navegador.
  const fechaCorta = funcionDelSitio('aFecha', 'fechaCorta');
  assert.strictEqual(fechaCorta('10/09/2024'), '10/09/2024');
  assert.strictEqual(fechaCorta('2024-09-10T00:00:00.000Z').length, 10);
  assert.strictEqual(fechaCorta(''), '—');
  assert.strictEqual(fechaCorta(null), '—');
  assert.ok(!fechaCorta('2024-09-10T00:00:00.000Z').includes('GMT'));
});

// ───────────────────────────────────────────────────────────────────
// Colores por nivel
// ───────────────────────────────────────────────────────────────────

test('el color de la tarjeta refleja la situación, no el nivel', () => {
  // Cada persona ve sólo su nivel, así que colorear por nivel no agrega
  // información. El color se reserva para en qué punto está la admisión.
  ['verde', 'amarillo', 'rojo', 'gris'].forEach((c) => {
    assert.ok(HTML.includes('.tarjeta.s-' + c), `falta la franja ${c}`);
  });
  assert.ok(HTML.includes("'<article class=\"tarjeta s-' + colorSituacion(a)"));
});

test('colorSituacion mapea cada caso', () => {
  const colorSituacion = funcionDelSitio('urgencia', 'colorSituacion');
  const tranquila = { tipo: 'esperando', dias: 1 };

  assert.strictEqual(colorSituacion({ estado: 'matriculada', espera: { tipo: 'cerrada' } }), 'verde');
  assert.strictEqual(colorSituacion({ estado: 'desistio', espera: { tipo: 'cerrada' } }), 'gris');
  assert.strictEqual(colorSituacion({ estado: 'sin_vacante', espera: { tipo: 'cerrada' } }), 'gris');

  // Sin contactar es rojo aunque recién haya entrado
  assert.strictEqual(colorSituacion({ estado: 'nueva', espera: { tipo: 'sin_contactar', dias: 0 } }), 'rojo');

  assert.strictEqual(colorSituacion({ estado: 'entrevista_agendada', espera: tranquila }), 'amarillo');
  assert.strictEqual(colorSituacion({ estado: 'contactada', espera: tranquila }), 'amarillo');
});

test('la urgencia gana sobre la etapa', () => {
  // Una entrevista agendada hace tres semanas sin respuesta no es "en
  // proceso", es un problema.
  const colorSituacion = funcionDelSitio('urgencia', 'colorSituacion');
  assert.strictEqual(
    colorSituacion({ estado: 'entrevista_agendada', espera: { tipo: 'esperando', dias: 21 } }),
    'rojo'
  );
  assert.strictEqual(
    colorSituacion({ estado: 'visita', espera: { tipo: 'nos_responden', dias: 2 } }),
    'rojo'
  );
});

// ───────────────────────────────────────────────────────────────────
// Ficha automática
// ───────────────────────────────────────────────────────────────────

test('la generación de fichas tiene tope por corrida', () => {
  // Cada ficha tarda entre 3 y 5 segundos y Apps Script corta a los 6
  // minutos: sin tope, importar 50 admisiones de una abortaría a mitad.
  const ficha = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'fichas.gs'), 'utf8');
  assert.ok(ficha.includes('TOPE_FICHAS_POR_CORRIDA'));
  assert.ok(ficha.includes('PRESUPUESTO_MS'));
  assert.ok(/Date\.now\(\) - arranque > PRESUPUESTO_MS/.test(ficha), 'no corta por tiempo');
});

test('una ficha que falla no tumba la importación', () => {
  // La admisión ya está guardada: perder la importación entera por un PDF
  // sería peor que quedarse sin la ficha, que se puede regenerar a mano.
  const ficha = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'fichas.gs'), 'utf8');
  const cuerpo = ficha.slice(ficha.indexOf('function generarFichasPendientes'));
  assert.ok(cuerpo.includes('try {') && cuerpo.includes('catch'), 'no protege cada ficha');

  const ingesta = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'ingesta.gs'), 'utf8');
  // La llamada real, no la mención en un comentario
  const i = ingesta.indexOf('= generarFichasPendientes(');
  assert.ok(i !== -1, 'la ingesta no llama a generarFichasPendientes');
  assert.ok(ingesta.slice(i - 120, i).includes('try'), 'la ingesta no protege la llamada');
});

test('no se regenera la ficha de una admisión que ya la tiene', () => {
  const ficha = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'fichas.gs'), 'utf8');
  assert.ok(ficha.includes('a.pdf_url'), 'no chequea si ya tiene ficha');
});

test('el barrido automático sólo toma admisiones nuevas', () => {
  // Sin ventana, el trigger tomaría todo el histórico sin ficha y generaría
  // cientos de PDF de familias que ya pasaron por admisión hace años.
  const ficha = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'fichas.gs'), 'utf8');
  assert.ok(ficha.includes('VENTANA_FICHAS_HORAS'), 'falta la ventana');

  const cuerpo = ficha.slice(ficha.indexOf('function generarFichasPendientes'));
  assert.ok(cuerpo.includes('corte'), 'el barrido no filtra por fecha');
  assert.ok(/alta >= corte/.test(cuerpo), 'no compara contra el corte');
});

test('con ids explícitos no aplica la ventana', () => {
  // La ingesta pasa las que acaba de importar: ésas se generan sí o sí,
  // sin depender de cómo quedó la fecha de alta.
  const ficha = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'fichas.gs'), 'utf8');
  const cuerpo = ficha.slice(ficha.indexOf('function generarFichasPendientes'));
  const rama = cuerpo.slice(0, cuerpo.indexOf('} else {'));
  assert.ok(rama.includes('pendientes = ids'), 'no respeta los ids explícitos');
  assert.ok(!rama.includes('corte'), 'aplica la ventana a los ids explícitos');
});

// ───────────────────────────────────────────────────────────────────
// Deshacer un cambio de estado
// ───────────────────────────────────────────────────────────────────

const DATOS = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'datos.gs'), 'utf8');

test('deshacer marca como anulado en vez de borrar la fila', () => {
  // El log de Eventos es el registro de qué pasó con cada familia. Ante un
  // reclamo importa poder reconstruirlo, así que un error de tipeo no puede
  // borrar historia: se oculta, no se elimina.
  const cuerpo = DATOS.slice(DATOS.indexOf('function deshacerCambioEstado'));
  assert.ok(cuerpo.includes("setValue(true)"), 'no marca anulado');
  assert.ok(!/deleteRow/.test(cuerpo), 'borra la fila del log');
});

test('sólo se deshacen cambios de estado', () => {
  const cuerpo = DATOS.slice(DATOS.indexOf('function deshacerCambioEstado'));
  assert.ok(cuerpo.includes("evento.tipo !== 'cambio_estado'"),
    'deja deshacer eventos que no son cambios de estado');
});

test('no se deshace dos veces el mismo cambio', () => {
  const cuerpo = DATOS.slice(DATOS.indexOf('function deshacerCambioEstado'));
  assert.ok(/anulado\) === true/.test(cuerpo), 'no chequea si ya estaba deshecho');
});

test('los eventos anulados no se muestran ni cuentan para la espera', () => {
  const eventos = DATOS.slice(DATOS.indexOf('function leerEventos'),
                              DATOS.indexOf('function registrarEvento'));
  assert.ok(eventos.includes('anulado'), 'leerEventos muestra los anulados');

  const espera = DATOS.slice(DATOS.indexOf('function calcularEspera'),
                             DATOS.indexOf('function eventosPorAdmision'));
  assert.ok(espera.includes('anulado'), 'calcularEspera cuenta los anulados');
});

test('el sitio sólo ofrece la cruz en cambios de estado', () => {
  const recorrido = HTML.slice(HTML.indexOf('function pintarRecorrido'));
  const hasta = recorrido.indexOf('function nombreTransicion');
  assert.ok(recorrido.slice(0, hasta).includes("e.tipo === 'cambio_estado'"),
    'la cruz aparece en cualquier evento');
});

// ───────────────────────────────────────────────────────────────────
// Dónde se cortó el proceso
// ───────────────────────────────────────────────────────────────────

test('al cerrar una admisión se guarda de qué etapa venía', () => {
  // Que una familia haya desistido dice poco; que haya desistido después de
  // la entrevista dice algo muy distinto que si desistió sin que la
  // contactaran.
  const cuerpo = DATOS.slice(DATOS.indexOf('function cambiarEstado'),
                             DATOS.indexOf('function deshacerCambioEstado'));
  assert.ok(cuerpo.includes('ESTADOS_TERMINALES'), 'no distingue estados terminales');
  assert.ok(cuerpo.includes('cambios.estado_previo = antes.estado'), 'no guarda la etapa previa');
});

test('al reabrir una admisión se limpia la etapa previa', () => {
  const cuerpo = DATOS.slice(DATOS.indexOf('function cambiarEstado'),
                             DATOS.indexOf('function deshacerCambioEstado'));
  assert.ok(/cambios\.estado_previo = ''/.test(cuerpo), 'deja el dato viejo al reabrir');
});

test('estado_previo es columna de Admisiones', () => {
  const cfg = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'config.gs'), 'utf8');
  assert.ok(cfg.includes("'estado_previo'"));
  assert.ok(cfg.includes("'anulado'"));
});

test('el sitio muestra en qué etapa se cortó', () => {
  assert.ok(HTML.includes('a.estado_previo'), 'no muestra la etapa previa');
  assert.ok(HTML.includes('class="corte"'), 'falta el aviso de corte');
});

// ───────────────────────────────────────────────────────────────────
// Ficha desde la lista y DNI
// ───────────────────────────────────────────────────────────────────

test('la lista tiene acceso directo a la ficha', () => {
  assert.ok(HTML.includes('acciones-fila'), 'falta la barra de acciones en la fila');
  assert.ok(HTML.includes('data-pdf='), 'el botón no lleva el link');
});

test('el DNI ya no se pide en el sitio', () => {
  assert.ok(!HTML.includes("campo('DNI'"), 'quedó el campo DNI');
});

test('la ficha PDF conserva el casillero de DNI', () => {
  // En el sitio no se pide, pero en la ficha impresa el casillero sigue para
  // completarlo a mano en la entrevista.
  const ficha = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'fichas.gs'), 'utf8');
  assert.ok(ficha.includes("etiq: 'DNI'"));
});

// ───────────────────────────────────────────────────────────────────
// Migración
// ───────────────────────────────────────────────────────────────────

test('migrarEsquema agrega columnas sin tocar las que hay', () => {
  const setup = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'setup.gs'), 'utf8');
  const cuerpo = setup.slice(setup.indexOf('function migrarEsquema'));

  assert.ok(cuerpo.includes('indexOf(c) === -1'), 'no filtra las que ya existen');
  assert.ok(!/deleteColumn|clear\(\)|setValues\(\[\[/.test(cuerpo.replace(/setValues\(\[faltan\]\)/g, '')),
    'la migración toca datos existentes');
  assert.ok(cuerpo.includes('insertColumnsAfter'), 'no agranda la solapa si hace falta');
});

test('migrarEsquema cubre todas las solapas', () => {
  const setup = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'setup.gs'), 'utf8');
  const cuerpo = setup.slice(setup.indexOf('function migrarEsquema'));
  ['ADMISIONES', 'EVENTOS', 'USUARIOS', 'ESTADOS'].forEach((h) => {
    assert.ok(cuerpo.includes('HOJAS.' + h), `la migración no cubre ${h}`);
  });
  assert.ok(cuerpo.includes('HOJA_PLANTILLAS'));
});

// ───────────────────────────────────────────────────────────────────
// Trabajar desde la lista, sin abrir la ficha
// ───────────────────────────────────────────────────────────────────

test('se puede cambiar el estado y mandar mail desde la lista', () => {
  assert.ok(HTML.includes('data-estado-de='), 'falta el disparador del menú de estado');
  assert.ok(HTML.includes('data-mail-de='), 'falta el botón de mail en la fila');
  assert.ok(HTML.includes('function abrirMenuEstado('), 'falta el menú de estado');
});

test('el menú de estado pide la nota en el mismo paso', () => {
  // Preguntarla después, en otra pantalla, es garantía de que nadie la
  // escriba: el motivo se sabe justo cuando se cambia el estado.
  const menu = HTML.slice(HTML.indexOf('function abrirMenuEstado('));
  const hasta = menu.indexOf('\n/* ─');
  assert.ok(menu.slice(0, hasta).includes('notaEstadoRapida'), 'el menú no pide nota');
  assert.ok(menu.slice(0, hasta).includes('nota: nota'), 'la nota no se manda al backend');
});

test('las acciones de la fila no abren también la ficha', () => {
  // Sin frenar la propagación, el click llega a la tarjeta y se abre el panel
  // detrás de lo que se acaba de hacer.
  ['data-pdf', 'data-mail-de', 'data-estado-de'].forEach((attr) => {
    const i = HTML.indexOf("querySelectorAll('[" + attr + "]')");
    assert.ok(i !== -1, `no hay handler para ${attr}`);
    assert.ok(HTML.slice(i, i + 300).includes('stopPropagation'),
      `${attr} deja propagar el click`);
  });
});

test('el menú de estado separa el flujo de los desvíos', () => {
  const menu = HTML.slice(HTML.indexOf('function abrirMenuEstado('));
  assert.ok(menu.slice(0, 2500).includes('ORDEN_MAXIMO_FLUJO'));
});

// ───────────────────────────────────────────────────────────────────
// Claro / oscuro
// ───────────────────────────────────────────────────────────────────

test('hay botón para cambiar de tema', () => {
  assert.ok(HTML.includes('id="btnTema"'));
  assert.ok(HTML.includes('function aplicarTema('));
});

test('la preferencia de tema se guarda por navegador', () => {
  assert.ok(HTML.includes("localStorage.getItem('tema')"));
  assert.ok(HTML.includes("localStorage.setItem('tema'"));
});

test('el tema tolera que localStorage esté bloqueado', () => {
  // En una ventana privada o con las cookies bloqueadas, localStorage tira
  // excepción al leerlo. Sin try/catch, el sitio entero queda en blanco.
  const guardado = HTML.slice(HTML.indexOf('function temaGuardado('));
  assert.ok(guardado.slice(0, 200).includes('catch'), 'temaGuardado no protege la lectura');

  const guardar = HTML.slice(HTML.indexOf('function guardarTema('));
  assert.ok(guardar.slice(0, 250).includes('catch'), 'guardarTema no protege la escritura');
});

test('sin preferencia elegida se sigue al sistema', () => {
  const aplicar = HTML.slice(HTML.indexOf('function aplicarTema('));
  const hasta = aplicar.indexOf('\n}');
  assert.ok(aplicar.slice(0, hasta).includes('removeAttribute'),
    'no vuelve a seguir al sistema cuando no hay preferencia');
});

// ───────────────────────────────────────────────────────────────────
// Ficha: fecha y permisos
// ───────────────────────────────────────────────────────────────────

test('la ficha usa el formateador único de fechas', () => {
  // Tenía su propia mostrarFecha, que devolvía tal cual cualquier cosa que no
  // fuera un Date: una fecha guardada como texto largo salía así en el PDF.
  const ficha = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'fichas.gs'), 'utf8');
  assert.ok(ficha.includes('formatearFechaCorta(a.alumno_fecha_nac)'));
  assert.ok(!ficha.includes('function mostrarFecha('), 'quedó la versión duplicada');
});

test('la ficha se comparte con el dominio, no con internet', () => {
  // Lleva nombre, fecha de nacimiento y contacto de un menor. Con ANYONE
  // quedaría accesible sin login a cualquiera que reciba la URL.
  const ficha = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'fichas.gs'), 'utf8');
  assert.ok(ficha.includes('DOMAIN_WITH_LINK'), 'no se comparte con el dominio');
  assert.ok(!ficha.includes('Access.ANYONE'), 'la ficha queda pública en internet');
});
