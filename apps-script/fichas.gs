/**
 * Ficha de admisión en PDF.
 *
 * Toma el diseño que ya usaba Inicial y lo parametriza por nivel, así
 * Primaria y Secundaria generan la misma ficha con sus propias etiquetas
 * ("sala" vs "grado" vs "curso", "jardín anterior" vs "colegio anterior").
 *
 * Los PDF van a una carpeta de Drive y no a la raíz, y el link queda guardado
 * en la admisión para poder volver a abrirlo sin regenerarlo.
 */

var CARPETA_FICHAS = 'Fichas de admisión';

var AZUL = '#00476c';
var AZUL_CLARO = '#ddeef5';
var BORDE = '#aac8d8';
var BLANCO = '#ffffff';

var ID_LOGO = '1IB4CJ_4RANoRyca47bVEMdsvzvzzx_CD';

var PIE = 'Colegio San Carlos Diálogos  ·  Ficha confidencial de uso interno  ·  www.sancarlos.edu.ar';

/**
 * Qué cambia en la ficha según el nivel. El resto del layout es común.
 * `extra` son filas propias del nivel que no existen en los otros.
 */
var FICHA_POR_NIVEL = {
  Inicial: {
    titulo: 'DATOS DEL NIÑO / A',
    etiquetaGrado: 'SALA SOLICITADA',
    etiquetaEscuela: 'JARDÍN ANTERIOR',
    pie: 'Jardín San Carlos Diálogos  ·  Ficha confidencial de uso interno  ·  www.sancarlos.edu.ar',
    extra: []
  },
  Primaria: {
    titulo: 'DATOS DEL ALUMNO / A',
    etiquetaGrado: 'GRADO SOLICITADO',
    etiquetaEscuela: 'COLEGIO ANTERIOR',
    pie: PIE,
    extra: [
      { etiq: 'GRADO ACTUAL', campo: 'grado_actual' },
      { etiq: 'COLEGIO BILINGÜE', campo: 'bilingue', tipo: 'booleano' }
    ]
  },
  Secundaria: {
    titulo: 'DATOS DEL / DE LA ESTUDIANTE',
    etiquetaGrado: 'CURSO SOLICITADO',
    etiquetaEscuela: 'COLEGIO ANTERIOR',
    pie: PIE,
    extra: [
      { etiq: 'CURSO ACTUAL', campo: 'grado_actual' },
      { etiq: 'COLEGIO BILINGÜE', campo: 'bilingue', tipo: 'booleano' }
    ]
  }
};

// ───────────────────────────────────────────────────────────────────
// Formato (puro)
// ───────────────────────────────────────────────────────────────────

/** Muestra un booleano como Sí/No, y deja vacío lo que no se sabe. */
function mostrarBooleano(valor) {
  var b = aBooleano(valor);
  if (b === null) return '';
  return b ? 'Sí' : 'No';
}

/** Formatea una fecha para la ficha, venga como Date o como texto. */
function mostrarFecha(valor) {
  if (!valor) return '';
  if (valor instanceof Date) {
    return isNaN(valor.getTime()) ? '' : Utilities.formatDate(valor, 'GMT-3', 'dd/MM/yyyy');
  }
  return valor.toString().trim();
}

/**
 * Edad en años a la fecha de referencia.
 * Se calcula al vuelo en vez de guardarse, porque una edad guardada envejece
 * mal: la planilla vieja tiene una columna "Edad Actual" que ya no es cierta.
 */
function calcularEdad(fechaNac, referencia) {
  if (!fechaNac) return '';

  var d;
  if (fechaNac instanceof Date) {
    d = fechaNac;
  } else {
    var m = fechaNac.toString().trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return '';
    d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  }
  if (isNaN(d.getTime())) return '';

  var hoy = referencia || new Date();
  var edad = hoy.getFullYear() - d.getFullYear();
  var mes = hoy.getMonth() - d.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < d.getDate())) edad--;

  return edad < 0 ? '' : edad.toString();
}

// ───────────────────────────────────────────────────────────────────
// Generación
// ───────────────────────────────────────────────────────────────────

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

  function banda(texto, tam, negrita, italica, padTop, padBottom) {
    var t = body.appendTable([[texto]]);
    t.setBorderColor(AZUL);
    t.setBorderWidth(0);
    var c = t.getRow(0).getCell(0);
    estiloCelda_(c, AZUL_CLARO, AZUL, tam, negrita, italica, texto,
      DocumentApp.HorizontalAlignment.CENTER);
    c.setPaddingTop(padTop).setPaddingBottom(padBottom);
    c.editAsText().setBackgroundColor(null);
    t.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });
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

  function cajaLibre(alto) {
    var t = body.appendTable([['']]);
    t.setBorderColor(BORDE);
    var c = t.getRow(0).getCell(0);
    c.setBackgroundColor(BLANCO);
    c.setPaddingTop(alto).setPaddingBottom(alto).setPaddingLeft(4).setPaddingRight(4);
    c.editAsText().setText('').setBackgroundColor(null);
    t.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });
  }

  // Logo — si falla, la ficha sale igual
  try {
    var logo = DriveApp.getFileById(ID_LOGO).getBlob();
    var tLogo = body.appendTable([['']]);
    tLogo.setBorderWidth(0);
    tLogo.setBorderColor(BLANCO);
    var cLogo = tLogo.getRow(0).getCell(0);
    cLogo.setBackgroundColor(BLANCO);
    cLogo.setPaddingTop(0).setPaddingBottom(0).setPaddingLeft(4).setPaddingRight(4);
    var pLogo = cLogo.getChild(0).asParagraph();
    pLogo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    pLogo.setSpacingBefore(0).setSpacingAfter(0);
    var img = pLogo.appendInlineImage(logo);
    img.setWidth(140);
    img.setHeight(140);
    tLogo.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });
  } catch (err) {
    console.warn('No se pudo insertar el logo: ' + err);
  }

  espacio(2);
  banda(a.grado_solicitado + '  (' + a.anio_vacante + ')', 22, true, false, 0, 4);

  espacio(2);
  banda('Ficha de Admisión', 10, false, true, 5, 5);

  espacio(4);
  tituloSeccion(cfg.titulo);
  filaCajas([{ etiq: 'NOMBRE Y APELLIDO', val: a.alumno_nombre.toString().toUpperCase() }]);
  filaCajas([
    { etiq: 'FECHA DE NACIMIENTO', val: mostrarFecha(a.alumno_fecha_nac) },
    { etiq: 'EDAD', val: calcularEdad(a.alumno_fecha_nac) },
    { etiq: 'DNI', val: a.alumno_dni || '' }
  ]);
  filaCajas([{ etiq: 'DIRECCIÓN', val: '' }]);
  filaCajas([{ etiq: cfg.etiquetaEscuela, val: a.escuela_actual || '' }]);

  if (cfg.extra.length) {
    filaCajas(cfg.extra.map(function (e) {
      var v = a[e.campo];
      return { etiq: e.etiq, val: e.tipo === 'booleano' ? mostrarBooleano(v) : (v || '') };
    }));
  }

  // La inclusión define el circuito de admisión, así que va en la ficha.
  filaCajas([{ etiq: 'PROYECTO DE INCLUSIÓN', val: mostrarBooleano(a.inclusion_solicitada) }]);
  if (a.trayectoria_texto) {
    filaCajas([{ etiq: 'TRAYECTORIA ESCOLAR DECLARADA', val: a.trayectoria_texto }]);
  }

  espacio(4);
  tituloSeccion('PADRE · MADRE · TUTOR/A 1');
  filaCajas([{ etiq: 'NOMBRE Y APELLIDO', val: a.tutor1_nombre || '' }]);
  filaCajas([
    { etiq: 'PROFESIÓN', val: a.tutor1_profesion || '' },
    { etiq: 'CELULAR', val: a.celular || '' },
    { etiq: 'MAIL', val: a.email || '' }
  ]);

  espacio(4);
  tituloSeccion('PADRE · MADRE · TUTOR/A 2');
  filaCajas([{ etiq: 'NOMBRE Y APELLIDO', val: a.tutor2_nombre || '' }]);
  filaCajas([
    { etiq: 'PROFESIÓN', val: a.tutor2_profesion || '' },
    { etiq: 'CELULAR', val: '' },
    { etiq: 'MAIL', val: '' }
  ]);

  espacio(4);
  tituloSeccion('REGISTRO DE ADMISIÓN');
  filaCajas([
    { etiq: 'FECHA DE ADMISIÓN', val: '' },
    { etiq: 'REALIZADA POR', val: '' }
  ]);
  if (a.motivo_cambio) {
    filaCajas([{ etiq: 'MOTIVO DEL CAMBIO', val: a.motivo_cambio }]);
  }

  espacio(4);
  tituloSeccion('OBSERVACIONES');
  cajaLibre(30);

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
    .setName('Ficha - ' + a.alumno_nombre + ' (' + a.nivel + ').pdf');

  var archivo = carpetaFichas_().createFile(pdf);
  DriveApp.getFileById(doc.getId()).setTrashed(true);

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

if (typeof module !== 'undefined' && module.exports) {
  Object.assign(module.exports, {
    mostrarBooleano: mostrarBooleano,
    mostrarFecha: mostrarFecha,
    calcularEdad: calcularEdad,
    FICHA_POR_NIVEL: FICHA_POR_NIVEL
  });
}
