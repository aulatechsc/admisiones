/**
 * Ficha de admisión en PDF.
 *
 * Réplica exacta de la ficha que generaba el script de Inicial, parametrizada
 * por nivel sólo en las etiquetas: "sala" contra "grado" contra "curso",
 * "jardín anterior" contra "colegio anterior".
 *
 * Sin campos de más. Una versión anterior sumaba edad, inclusión, trayectoria
 * y bilingüe, y eso desarmaba el layout: la ficha se imprime y se completa a
 * mano en la entrevista, así que el orden y el espacio en blanco son parte
 * del diseño, no un detalle estético.
 *
 * Los PDF van a una carpeta de Drive y el link queda guardado en la admisión.
 */

var CARPETA_FICHAS = 'Fichas de admisión';

var AZUL = '#00476c';
var AZUL_CLARO = '#ddeef5';
var BORDE = '#aac8d8';
var BLANCO = '#ffffff';

var ID_LOGO = '1IB4CJ_4RANoRyca47bVEMdsvzvzzx_CD';

/** Lo único que cambia entre niveles. El resto del layout es idéntico. */
var FICHA_POR_NIVEL = {
  Inicial: {
    titulo: 'DATOS DEL NIÑO / A',
    etiquetaGrado: 'SALA SOLICITADA',
    etiquetaEscuela: 'JARDÍN ANTERIOR',
    pie: 'Jardín San Carlos Diálogos  ·  Ficha confidencial de uso interno  ·  www.sancarlos.edu.ar'
  },
  Primaria: {
    titulo: 'DATOS DEL ALUMNO / A',
    etiquetaGrado: 'GRADO SOLICITADO',
    etiquetaEscuela: 'COLEGIO ANTERIOR',
    pie: 'Colegio San Carlos Diálogos  ·  Ficha confidencial de uso interno  ·  www.sancarlos.edu.ar'
  },
  Secundaria: {
    titulo: 'DATOS DEL / DE LA ESTUDIANTE',
    etiquetaGrado: 'CURSO SOLICITADO',
    etiquetaEscuela: 'COLEGIO ANTERIOR',
    pie: 'Colegio San Carlos Diálogos  ·  Ficha confidencial de uso interno  ·  www.sancarlos.edu.ar'
  }
};


function estiloCelda_(celda, bg, color, tam, negrita, italica, texto, alineacion) {
  celda.setBackgroundColor(bg);
  celda.setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(5).setPaddingRight(5);

  var p = celda.getChild(0).asParagraph();
  p.setAlignment(alineacion || DocumentApp.HorizontalAlignment.LEFT);
  p.setSpacingBefore(0).setSpacingAfter(0);

  var t = celda.editAsText();
  t.setText(texto || '');
  t.setFontFamily('Arial');
  t.setFontSize(tam);
  t.setBold(negrita || false);
  t.setItalic(italica || false);
  t.setForegroundColor(color);
  t.setBackgroundColor(null);
}

function carpetaFichas_() {
  var it = DriveApp.getFoldersByName(CARPETA_FICHAS);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA_FICHAS);
}

/**
 * Genera la ficha de una admisión y devuelve el link al PDF.
 *
 * Crea un Doc temporal, lo exporta y lo borra: es la única forma de armar un
 * PDF con este layout desde Apps Script.
 */
function generarFicha(idAdmision) {
  var a = obtenerAdmision(idAdmision);
  if (!a) throw new Error('No existe la admisión ' + idAdmision);
  if (!a.alumno_nombre) throw new Error('La admisión no tiene nombre de alumno.');

  var cfg = FICHA_POR_NIVEL[a.nivel] || FICHA_POR_NIVEL.Primaria;

  var doc = DocumentApp.create('Ficha de admisión - ' + a.alumno_nombre);
  var body = doc.getBody();
  body.setMarginTop(20).setMarginBottom(20).setMarginLeft(36).setMarginRight(36);
  body.clear();

  function espacio(px) {
    var p = body.appendParagraph('');
    p.setSpacingBefore(0).setSpacingAfter(0);
    p.editAsText().setFontSize(px).setBackgroundColor(null);
  }

  function tituloSeccion(texto) {
    var t = body.appendTable([[texto]]);
    t.setBorderColor(AZUL);
    t.setBorderWidth(0);
    var c = t.getRow(0).getCell(0);
    estiloCelda_(c, AZUL_CLARO, AZUL, 9, true, false, texto, DocumentApp.HorizontalAlignment.LEFT);
    c.setPaddingTop(0).setPaddingBottom(2).setPaddingLeft(6).setPaddingRight(6);
    c.editAsText().setBackgroundColor(null);
    t.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });
  }

  function filaCajas(cols) {
    var t = body.appendTable([
      cols.map(function (c) { return c.etiq; }),
      cols.map(function (c) { return c.val || ''; })
    ]);
    t.setBorderColor(BORDE);

    var rowE = t.getRow(0);
    var rowV = t.getRow(1);
    for (var i = 0; i < cols.length; i++) {
      estiloCelda_(rowE.getCell(i), AZUL_CLARO, AZUL, 7, true, false, cols[i].etiq);
      rowE.getCell(i).setPaddingTop(2).setPaddingBottom(2).setPaddingLeft(4).setPaddingRight(4);
      rowE.getCell(i).editAsText().setBackgroundColor(null);

      estiloCelda_(rowV.getCell(i), BLANCO, '#000000', 10, false, false, cols[i].val || '');
      rowV.getCell(i).setPaddingTop(4).setPaddingBottom(4).setPaddingLeft(4).setPaddingRight(4);
      rowV.getCell(i).editAsText().setBackgroundColor(null);
    }
    t.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });
  }

  function cajaObs() {
    var t = body.appendTable([['']]);
    t.setBorderColor(BORDE);
    var c = t.getRow(0).getCell(0);
    c.setBackgroundColor(BLANCO);
    c.setPaddingTop(30).setPaddingBottom(30).setPaddingLeft(4).setPaddingRight(4);
    c.editAsText().setText('').setBackgroundColor(null);
    t.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });
  }

  // ── Logo ── si falla, la ficha sale igual
  try {
    var logoBlob = DriveApp.getFileById(ID_LOGO).getBlob();
    var tLogo = body.appendTable([['']]);
    tLogo.setBorderWidth(0);
    tLogo.setBorderColor(BLANCO);
    var celdaLogo = tLogo.getRow(0).getCell(0);
    celdaLogo.setBackgroundColor(BLANCO);
    celdaLogo.setPaddingTop(0).setPaddingBottom(0).setPaddingLeft(4).setPaddingRight(4);
    var pLogo = celdaLogo.getChild(0).asParagraph();
    pLogo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    pLogo.setSpacingBefore(0).setSpacingAfter(0);
    var img = pLogo.appendInlineImage(logoBlob);
    img.setWidth(140);
    img.setHeight(140);
    tLogo.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });
  } catch (logoErr) {
    // continúa sin logo
  }

  // ── Encabezado: grado (año) ──
  espacio(2);
  var encabezado = a.grado_solicitado + '  (' + a.anio_vacante + ')';
  var tHead = body.appendTable([[encabezado]]);
  tHead.setBorderColor(AZUL);
  tHead.setBorderWidth(0);
  estiloCelda_(tHead.getRow(0).getCell(0), AZUL_CLARO, AZUL, 22, true, false,
    encabezado, DocumentApp.HorizontalAlignment.CENTER);
  tHead.getRow(0).getCell(0).setPaddingTop(0).setPaddingBottom(4);
  tHead.getRow(0).getCell(0).editAsText().setBackgroundColor(null);
  tHead.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });

  // ── Subtítulo ──
  espacio(2);
  var tSub = body.appendTable([['Ficha de Admisión']]);
  tSub.setBorderColor(AZUL);
  tSub.setBorderWidth(0);
  estiloCelda_(tSub.getRow(0).getCell(0), AZUL_CLARO, AZUL, 10, false, true,
    'Ficha de Admisión', DocumentApp.HorizontalAlignment.CENTER);
  tSub.getRow(0).getCell(0).setPaddingTop(5).setPaddingBottom(5);
  tSub.getRow(0).getCell(0).editAsText().setBackgroundColor(null);
  tSub.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });

  // ── Datos del alumno ──
  espacio(4);
  tituloSeccion(cfg.titulo);
  filaCajas([{ etiq: 'NOMBRE Y APELLIDO', val: a.alumno_nombre.toString().toUpperCase() }]);
  filaCajas([
    { etiq: 'FECHA DE NACIMIENTO', val: formatearFechaCorta(a.alumno_fecha_nac) },
    { etiq: 'DNI', val: a.alumno_dni || '' }
  ]);
  filaCajas([{ etiq: 'DIRECCIÓN', val: '' }]);
  filaCajas([{ etiq: cfg.etiquetaEscuela, val: a.escuela_actual || '' }]);

  // ── Responsable 1 ──
  espacio(4);
  tituloSeccion('PADRE · MADRE · TUTOR/A 1');
  filaCajas([{ etiq: 'NOMBRE Y APELLIDO', val: a.tutor1_nombre || '' }]);
  filaCajas([
    { etiq: 'PROFESIÓN', val: a.tutor1_profesion || '' },
    { etiq: 'CELULAR', val: a.celular || '' },
    { etiq: 'MAIL', val: a.email || '' }
  ]);

  // ── Responsable 2 ──
  espacio(4);
  tituloSeccion('PADRE · MADRE · TUTOR/A 2');
  filaCajas([{ etiq: 'NOMBRE Y APELLIDO', val: a.tutor2_nombre || '' }]);
  filaCajas([
    { etiq: 'PROFESIÓN', val: a.tutor2_profesion || '' },
    { etiq: 'CELULAR', val: '' },
    { etiq: 'MAIL', val: '' }
  ]);

  // ── Registro de admisión ──
  espacio(4);
  tituloSeccion('REGISTRO DE ADMISIÓN');
  filaCajas([
    { etiq: 'FECHA DE ADMISIÓN', val: '' },
    { etiq: 'REALIZADA POR', val: '' }
  ]);

  // ── Observaciones ──
  espacio(4);
  tituloSeccion('OBSERVACIONES');
  cajaObs();

  // ── Pie ──
  espacio(1);
  var tPie = body.appendTable([[cfg.pie]]);
  tPie.setBorderColor(AZUL);
  tPie.setBorderWidth(0);
  estiloCelda_(tPie.getRow(0).getCell(0), AZUL_CLARO, AZUL, 7, false, true, cfg.pie,
    DocumentApp.HorizontalAlignment.CENTER);
  tPie.getRow(0).getCell(0).setPaddingTop(4).setPaddingBottom(0);
  tPie.getRow(0).getCell(0).editAsText().setBackgroundColor(null);

  doc.saveAndClose();

  var pdf = DriveApp.getFileById(doc.getId())
    .getAs(MimeType.PDF)
    .setName('Ficha - ' + a.alumno_nombre + '.pdf');

  var archivo = carpetaFichas_().createFile(pdf);
  DriveApp.getFileById(doc.getId()).setTrashed(true);

  // Visible para cualquiera del colegio que tenga el link, no para internet.
  // La ficha lleva nombre, fecha de nacimiento y datos de contacto de un
  // menor: con ANYONE quedaría accesible a cualquiera que reciba o adivine
  // la URL, y sin login. Con DOMAIN alcanza para que la abra quien la
  // necesite dentro de sancarlos.edu.ar.
  try {
    archivo.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    console.warn('No se pudieron ajustar los permisos de la ficha: ' + err);
  }

  actualizarAdmision(idAdmision, { pdf_url: archivo.getUrl() });

  registrarEvento({
    id_admision: idAdmision,
    tipo: 'pdf_generado',
    usuario: usuarioActual(),
    asunto: 'Ficha generada',
    detalle: archivo.getUrl()
  });

  return { ok: true, url: archivo.getUrl(), nombre: archivo.getName() };
}

// ───────────────────────────────────────────────────────────────────
// Generación automática
// ───────────────────────────────────────────────────────────────────

/**
 * Cuántas fichas como mucho por ejecución, y cuánto tiempo pueden ocupar.
 *
 * Cada ficha crea un Doc, lo exporta a PDF y lo borra: entre 3 y 5 segundos.
 * Apps Script corta la ejecución a los 6 minutos, así que importar 50
 * admisiones de golpe y generarles la ficha a todas se pasaría del límite y
 * abortaría a mitad de camino. Con tope, lo que no entra queda pendiente y
 * sale en la corrida siguiente del trigger, 15 minutos después.
 */
var TOPE_FICHAS_POR_CORRIDA = 10;
var PRESUPUESTO_MS = 90000;

/**
 * Cuántas horas atrás mira el barrido automático.
 *
 * La ficha se genera sola sólo para las admisiones nuevas. Sin esta ventana,
 * el trigger tomaría todo el histórico sin ficha y generaría cientos de PDF
 * de familias que ya pasaron por admisión hace años — ruido en Drive y
 * consumo de cuota para nada.
 *
 * Las viejas se generan a demanda, con el botón de la ficha.
 */
var VENTANA_FICHAS_HORAS = 48;

/**
 * Genera las fichas que falten.
 *
 * Con `ids`, procesa esas puntualmente (lo que usa la ingesta con las recién
 * importadas). Sin `ids`, barre sólo las dadas de alta dentro de la ventana.
 *
 * Nunca lanza por una ficha suelta: si una falla, se registra y sigue con las
 * demás. La admisión ya está guardada, y una ficha se puede regenerar a mano
 * desde el sitio — perder la importación entera por un PDF sería peor.
 */
function generarFichasPendientes(ids) {
  var pendientes;

  if (ids && ids.length) {
    pendientes = ids;
  } else {
    var corte = new Date(Date.now() - VENTANA_FICHAS_HORAS * 3600000);
    pendientes = leerAdmisiones()
      .filter(function (a) {
        if (a.pdf_url || !a.alumno_nombre) return false;
        var alta = aFecha(a.fecha_alta);
        return alta && alta >= corte;
      })
      .map(function (a) { return a.id; });
  }

  var arranque = Date.now();
  var hechas = 0;
  var fallidas = 0;

  for (var i = 0; i < pendientes.length; i++) {
    if (hechas >= TOPE_FICHAS_POR_CORRIDA) break;
    if (Date.now() - arranque > PRESUPUESTO_MS) break;

    try {
      var a = obtenerAdmision(pendientes[i]);
      if (!a || a.pdf_url || !a.alumno_nombre) continue;
      generarFicha(pendientes[i]);
      hechas++;
    } catch (err) {
      fallidas++;
      console.error('No se pudo generar la ficha de ' + pendientes[i] + ': ' + err);
    }
  }

  return {
    ok: true,
    generadas: hechas,
    fallidas: fallidas,
    pendientes: Math.max(pendientes.length - hechas - fallidas, 0)
  };
}

/**
 * Instala el trigger que genera las fichas que quedaron pendientes.
 *
 * Ejecutar UNA VEZ. Corre cada hora y levanta lo que el tope de la
 * importación dejó afuera, siempre dentro de la ventana de
 * VENTANA_FICHAS_HORAS: nunca toca el histórico.
 */
function instalarTriggerFichas() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'generarFichasPendientes') ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('generarFichasPendientes')
    .timeBased()
    .everyHours(1)
    .create();

  return { ok: true };
}

if (typeof module !== 'undefined' && module.exports) {
  Object.assign(module.exports, {
    FICHA_POR_NIVEL: FICHA_POR_NIVEL,
    TOPE_FICHAS_POR_CORRIDA: TOPE_FICHAS_POR_CORRIDA,
    VENTANA_FICHAS_HORAS: VENTANA_FICHAS_HORAS
  });
}
