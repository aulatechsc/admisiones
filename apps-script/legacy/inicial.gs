/**
 * SISTEMA JARDÍN SAN CARLOS - VERSIÓN FINAL
 *
 * Planilla: Admisión Inicial
 * https://docs.google.com/spreadsheets/d/1QDzeoe4hpJNQecvDPJLZnwK4aCay0c9WFbyNy0JHIfg/edit
 *
 * COPIA DE RESPALDO — la fuente de verdad vive en Google.
 *
 * Único script de los tres que genera la ficha PDF.
 * Ver docs/esquema-unificado.md, sección 4, para los problemas detectados.
 */

// ─────────────────────────────────────────────
// HELPER: obtener valor por nombre de columna
// ─────────────────────────────────────────────
function getValorPorEncabezado(sheet, fila, nombreColumna) {
  const encabezados = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const col = encabezados.findIndex(e => e.toString().trim().toLowerCase() === nombreColumna.trim().toLowerCase());
  if (col === -1) throw new Error("Columna no encontrada: " + nombreColumna);
  return sheet.getRange(fila, col + 1).getValue();
}

function getValorPorEncabezadoDesde(sheet, fila, nombreColumna, desdeColumna) {
  const encabezados = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const col = encabezados.findIndex((e, i) =>
    i >= desdeColumna && e.toString().trim().toLowerCase() === nombreColumna.trim().toLowerCase()
  );
  if (col === -1) throw new Error("Columna no encontrada desde col " + desdeColumna + ": " + nombreColumna);
  return sheet.getRange(fila, col + 1).getValue();
}

// ─────────────────────────────────────────────
// TRIGGER PRINCIPAL
// ─────────────────────────────────────────────
function onEditInstalable(e) {
  if (!e || !e.range) return;
  const range = e.range;
  const sheet = range.getSheet();
  const fila = range.getRow();
  const columna = range.getColumn();
  const valor = range.getValue();

  if (fila <= 1) return;

  if (columna === 1 && valor === true) {
    enviarMailJardin(sheet, fila, range);
  }

  if (columna === 2 && valor === true) {
    generarFichaPDF(fila, sheet, range);
  }
}

// ─────────────────────────────────────────────
// FUNCIONALIDAD A: ENVÍO DE MAIL (MODIFICADO PARA EVITAR SPAM)
// ─────────────────────────────────────────────
function enviarMailJardin(sheet, fila, range) {
  const alumno       = getValorPorEncabezado(sheet, fila, "Nombre del Alumno/a");
  const responsable  = getValorPorEncabezado(sheet, fila, "Padre/Madre 1");
  const emailDestino = getValorPorEncabezadoDesde(sheet, fila, "Mail", 5);
  const sala         = getValorPorEncabezado(sheet, fila, "Sala Solicitada");
  const anio         = getValorPorEncabezado(sheet, fila, "Año de la vacante solicitada");

  if (!emailDestino || emailDestino.toString().indexOf("@") === -1) {
    range.setValue(false);
    return;
  }

  // A partir del ciclo 2028 las entrevistas pasan a ser grupales,
  // en fechas fijas, en lugar de coordinarse individualmente.
  const esEntrevistaGrupal = Number(anio) >= 2028;

  let asunto;
  let cuerpo;

  if (esEntrevistaGrupal) {

    asunto = anio + " - Admisión " + alumno + " / " + sala + " / " + anio;

    cuerpo =
      "Estimada/o " + responsable + ":\n\n" +
      "Nos comunicamos desde el Jardín del Colegio San Carlos Diálogos en relación " +
      "a su consulta para conocer nuestra propuesta educativa para " + alumno + ", " +
      "aspirante a " + sala + " en el ciclo lectivo " + anio + ".\n\n" +
      "Le agradecemos el interés en nuestra institución. Para las familias que se " +
      "inscriben con esta anticipación, las entrevistas informativas se realizan de " +
      "manera grupal, en alguna de las siguientes fechas:\n\n" +
      "• Viernes 9 de octubre, 10:00 hs\n" +
      "• Viernes 6 de noviembre, 10:00 hs\n\n" +
      "En ese encuentro compartiremos nuestro proyecto pedagógico, recorreremos las " +
      "instalaciones y podrá conocer más de cerca nuestra propuesta junto a otras " +
      "familias interesadas.\n\n" +
      "Le pedimos que nos confirme, respondiendo a este mismo correo, qué fecha de " +
      "las dos le resulta más conveniente, para poder organizar la actividad.\n\n" +
      "Le compartimos el link a los aranceles vigentes:\n" +
      "https://docs.google.com/spreadsheets/d/1O9gDK1i3PJIeMTrAtGhnNaYAp6PzNCzjUYGTX5uw-qM/edit?usp=sharing\n\n" +
      "Quedamos a disposición para cualquier consulta adicional y esperamos su " +
      "confirmación para coordinar el encuentro.\n\n" +
      "Saludos cordiales,\n\n" +
      "Eliana Waichman\n" +
      "Directora\n" +
      "Jardín San Carlos Diálogos";

  } else {

    asunto = "Admisión " + alumno + " / " + sala + " / " + anio;

    cuerpo =
      "Estimada/o " + responsable + ":\n\n" +
      "Nos comunicamos desde el Jardín del Colegio San Carlos Diálogos en relación " +
      "a su consulta para conocer nuestra propuesta educativa para " + alumno + ", " +
      "aspirante a " + sala + " en el ciclo lectivo " + anio + ".\n\n" +
      "Le agradecemos el interés en nuestra institución. Será un placer coordinar una " +
      "entrevista personal para poder compartir nuestro proyecto pedagógico, recorrer " +
      "las instalaciones y conocer más acerca de su hijo/a y de su familia.\n\n" +
      "Para organizar el encuentro, le pedimos por favor que nos indique su disponibilidad " +
      "en días y horarios por la mañana, respondiendo a este mismo correo, así podremos " +
      "acordar una fecha conveniente.\n\n" +
      "Le compartimos el link a los aranceles vigentes:\n" +
      "https://docs.google.com/spreadsheets/d/1O9gDK1i3PJIeMTrAtGhnNaYAp6PzNCzjUYGTX5uw-qM/edit?usp=sharing\n\n" +
      "Quedamos a disposición para cualquier consulta adicional y esperamos su respuesta " +
      "para coordinar la visita.\n\n" +
      "Saludos cordiales,\n\n" +
      "Eliana Waichman\n" +
      "Directora\n" +
      "Jardín San Carlos Diálogos";
  }

  try {
    // CAMBIO TÉCNICO CRÍTICO:
    // Pasamos de un envío de texto plano a opciones avanzadas.
    // Esto fuerza a que el servidor de origen firme correctamente con DKIM y asocie el alias.
    GmailApp.sendEmail(emailDestino, asunto, cuerpo, {
      name: "Jardín San Carlos Diálogos",         // Nombre amigable y oficial en la bandeja del receptor
      replyTo: "elianawaichman@sancarlos.edu.ar", // Asegura que si responden va directo a la cuenta humana
      noReply: false                              // Le indica al algoritmo que es una casilla interactiva, no un bot muerto
    });

    range.clearDataValidations();
    range.setValue("✅")
         .setBackground("#d9ead3")
         .setFontWeight("bold")
         .setHorizontalAlignment("center");

    const celdaB = sheet.getRange("B" + fila);
    const formulaB = celdaB.getFormula();
    if (!formulaB || formulaB === "") {
      celdaB.clearDataValidations();
      celdaB.insertCheckboxes();
    }

  } catch(err) {
    range.setValue("Error: " + err.message);
  }
}

// ─────────────────────────────────────────────
// FUNCIONALIDAD B: GENERAR FICHA PDF
// ─────────────────────────────────────────────
function generarFichaPDF(fila, sheet, range) {
  try {
    range.clearDataValidations();
    range.setValue("⏳")
         .setBackground("#fff3cd")
         .setFontWeight("bold")
         .setHorizontalAlignment("center");
    SpreadsheetApp.flush();

    const nombre  = getValorPorEncabezado(sheet, fila, "Nombre del Alumno/a");
    const fNac    = getValorPorEncabezado(sheet, fila, "Fecha de Nacimiento");
    const sala    = getValorPorEncabezado(sheet, fila, "Sala Solicitada");
    const jardAnt = getValorPorEncabezado(sheet, fila, "Jardín Actual");
    const anio    = getValorPorEncabezado(sheet, fila, "Año de la vacante solicitada");
    const p1Nom   = getValorPorEncabezado(sheet, fila, "Padre/Madre 1");
    const p1Prof  = getValorPorEncabezado(sheet, fila, "Profesión 1");
    const p1Cel   = getValorPorEncabezado(sheet, fila, "Celular");
    const p1Mail  = getValorPorEncabezadoDesde(sheet, fila, "Mail", 5);
    const p2Nom   = getValorPorEncabezado(sheet, fila, "Padre/Madre 2");
    const p2Prof  = getValorPorEncabezado(sheet, fila, "Profesión 2");

    if (!nombre) { range.setValue(false); return; }

    const fechaTxt = fNac instanceof Date
      ? Utilities.formatDate(fNac, "GMT-3", "dd/MM/yyyy")
      : (fNac || "");

    const AZUL       = "#00476c";
    const AZUL_CLARO = "#ddeef5";
    const BORDE      = "#aac8d8";
    const BLANCO     = "#ffffff";

    const doc  = DocumentApp.create("Ficha de admisión - " + nombre);
    const body = doc.getBody();
    body.setMarginTop(20).setMarginBottom(20).setMarginLeft(36).setMarginRight(36);
    body.clear();

    function estiloCelda(celda, bgColor, textColor, fontSize, bold, italic, texto, alineacion) {
      celda.setBackgroundColor(bgColor);
      celda.setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(5).setPaddingRight(5);
      const p = celda.getChild(0).asParagraph();
      p.setAlignment(alineacion || DocumentApp.HorizontalAlignment.LEFT);
      p.setSpacingBefore(0).setSpacingAfter(0);
      const t = celda.editAsText();
      t.setText(texto || "");
      t.setFontFamily("Arial");
      t.setFontSize(fontSize);
      t.setBold(bold || false);
      t.setItalic(italic || false);
      t.setForegroundColor(textColor);
      t.setBackgroundColor(null);
    }

    function tituloSeccion(texto) {
      const t = body.appendTable([[texto]]);
      t.setBorderColor(AZUL);
      t.setBorderWidth(0);
      const c = t.getRow(0).getCell(0);
      estiloCelda(c, AZUL_CLARO, AZUL, 9, true, false, texto,
                  DocumentApp.HorizontalAlignment.LEFT);
      c.setPaddingTop(0).setPaddingBottom(2).setPaddingLeft(6).setPaddingRight(6);
      c.editAsText().setBackgroundColor(null);
      t.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });
    }

    function filaCajas(cols) {
      const filaEtiq  = cols.map(c => c.etiq);
      const filaValor = cols.map(c => c.val || "");
      const t = body.appendTable([filaEtiq, filaValor]);
      t.setBorderColor(BORDE);

      const rowE = t.getRow(0);
      for (let i = 0; i < cols.length; i++) {
        estiloCelda(rowE.getCell(i), AZUL_CLARO, AZUL, 7, true, false, cols[i].etiq);
        rowE.getCell(i).setPaddingTop(2).setPaddingBottom(2).setPaddingLeft(4).setPaddingRight(4);
        rowE.getCell(i).editAsText().setBackgroundColor(null);
      }

      const rowV = t.getRow(1);
      for (let i = 0; i < cols.length; i++) {
        estiloCelda(rowV.getCell(i), BLANCO, "#000000", 10, false, false, cols[i].val || "");
        rowV.getCell(i).setPaddingTop(4).setPaddingBottom(4).setPaddingLeft(4).setPaddingRight(4);
        rowV.getCell(i).editAsText().setBackgroundColor(null);
      }

      t.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });
    }

    function espacio(px) {
      const p = body.appendParagraph("");
      p.setSpacingBefore(0).setSpacingAfter(0);
      p.editAsText().setFontSize(px).setBackgroundColor(null);
    }

    function cajaObs() {
      const t = body.appendTable([[""]]);
      t.setBorderColor(BORDE);
      const c = t.getRow(0).getCell(0);
      c.setBackgroundColor(BLANCO);
      c.setPaddingTop(30).setPaddingBottom(30).setPaddingLeft(4).setPaddingRight(4);
      c.editAsText().setText("").setBackgroundColor(null);
      t.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });
    }

    // ════════════════════════════════════════════════════════════
    // LOGO
    // ════════════════════════════════════════════════════════════
    try {
      const logoBlob = DriveApp.getFileById("1IB4CJ_4RANoRyca47bVEMdsvzvzzx_CD").getBlob();
      const tLogo = body.appendTable([[""]]);
      tLogo.setBorderWidth(0);
      tLogo.setBorderColor(BLANCO);
      const celdaLogo = tLogo.getRow(0).getCell(0);
      celdaLogo.setBackgroundColor(BLANCO);
      celdaLogo.setPaddingTop(0).setPaddingBottom(0).setPaddingLeft(4).setPaddingRight(4);
      const pLogo = celdaLogo.getChild(0).asParagraph();
      pLogo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      pLogo.setSpacingBefore(0).setSpacingAfter(0);
      const img = pLogo.appendInlineImage(logoBlob);
      img.setWidth(140);
      img.setHeight(140);
      tLogo.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });
    } catch(logoErr) {
      // continúa sin logo
    }

    // ════════════════════════════════════════════════════════════
    // ENCABEZADO — Sala (año) azul sobre azul claro
    // ════════════════════════════════════════════════════════════
    espacio(2);
    const tHead = body.appendTable([[sala + "  (" + anio + ")"]]);
    tHead.setBorderColor(AZUL);
    tHead.setBorderWidth(0);
    estiloCelda(tHead.getRow(0).getCell(0), AZUL_CLARO, AZUL, 22, true, false,
      sala + "  (" + anio + ")", DocumentApp.HorizontalAlignment.CENTER);
    tHead.getRow(0).getCell(0).setPaddingTop(0).setPaddingBottom(4);
    tHead.getRow(0).getCell(0).editAsText().setBackgroundColor(null);
    tHead.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });

    // ════════════════════════════════════════════════════════════
    // SUBTÍTULO: Ficha de Admisión
    // ════════════════════════════════════════════════════════════
    espacio(2);
    const tSub = body.appendTable([["Ficha de Admisión"]]);
    tSub.setBorderColor(AZUL);
    tSub.setBorderWidth(0);
    estiloCelda(tSub.getRow(0).getCell(0), AZUL_CLARO, AZUL, 10, false, true,
      "Ficha de Admisión", DocumentApp.HorizontalAlignment.CENTER);
    tSub.getRow(0).getCell(0).setPaddingTop(5).setPaddingBottom(5);
    tSub.getRow(0).getCell(0).editAsText().setBackgroundColor(null);
    tSub.setAttributes({ [DocumentApp.Attribute.SPACING_AFTER]: 0 });

    // ════════════════════════════════════════════════════════════
    // DATOS DEL NIÑO/A
    // ════════════════════════════════════════════════════════════
    espacio(4);
    tituloSeccion("DATOS DEL NIÑO / A");
    filaCajas([{ etiq: "NOMBRE Y APELLIDO", val: nombre.toString().toUpperCase() }]);
    filaCajas([{ etiq: "FECHA DE NACIMIENTO", val: fechaTxt }, { etiq: "DNI", val: "" }]);
    filaCajas([{ etiq: "DIRECCIÓN", val: "" }]);
    filaCajas([{ etiq: "JARDÍN ANTERIOR", val: jardAnt || "" }]);

    // ════════════════════════════════════════════════════════════
    // RESPONSABLE 1
    // ════════════════════════════════════════════════════════════
    espacio(4);
    tituloSeccion("PADRE · MADRE · TUTOR/A 1");
    filaCajas([{ etiq: "NOMBRE Y APELLIDO", val: p1Nom }]);
    filaCajas([
      { etiq: "PROFESIÓN", val: p1Prof },
      { etiq: "CELULAR",   val: p1Cel  },
      { etiq: "MAIL",      val: p1Mail }
    ]);

    // ════════════════════════════════════════════════════════════
    // RESPONSABLE 2
    // ════════════════════════════════════════════════════════════
    espacio(4);
    tituloSeccion("PADRE · MADRE · TUTOR/A 2");
    filaCajas([{ etiq: "NOMBRE Y APELLIDO", val: p2Nom }]);
    filaCajas([
      { etiq: "PROFESIÓN", val: p2Prof },
      { etiq: "CELULAR",   val: ""     },
      { etiq: "MAIL",      val: ""     }
    ]);

    // ════════════════════════════════════════════════════════════
    // REGISTRO DE ADMISIÓN
    // ════════════════════════════════════════════════════════════
    espacio(4);
    tituloSeccion("REGISTRO DE ADMISIÓN");
    filaCajas([
      { etiq: "FECHA DE ADMISIÓN", val: "" },
      { etiq: "REALIZADA POR",     val: "" }
    ]);

    // ════════════════════════════════════════════════════════════
    // OBSERVACIONES
    // ════════════════════════════════════════════════════════════
    espacio(4);
    tituloSeccion("OBSERVACIONES");
    cajaObs();

    // ════════════════════════════════════════════════════════════
    // PIE
    // ════════════════════════════════════════════════════════════
    espacio(1);
    const tPie = body.appendTable([["Jardín San Carlos Diálogos  ·  Ficha confidencial de uso interno  ·  [www.sancarlos.edu.ar](https://www.sancarlos.edu.ar)"]]);
    tPie.setBorderColor(AZUL);
    tPie.setBorderWidth(0);
    estiloCelda(tPie.getRow(0).getCell(0), AZUL_CLARO, AZUL, 7, false, true,
      "Jardín San Carlos Diálogos  ·  Ficha confidencial de uso interno  ·  [www.sancarlos.edu.ar](https://www.sancarlos.edu.ar)",
      DocumentApp.HorizontalAlignment.CENTER);
    tPie.getRow(0).getCell(0).setPaddingTop(4).setPaddingBottom(0);
    tPie.getRow(0).getCell(0).editAsText().setBackgroundColor(null);

    // ════════════════════════════════════════════════════════════
    // EXPORTAR PDF
    // ════════════════════════════════════════════════════════════

    doc.saveAndClose();

    const pdfBlob = DriveApp.getFileById(doc.getId())
      .getAs(MimeType.PDF)
      .setName("Ficha - " + nombre + ".pdf");

    const pdfFile = DriveApp.createFile(pdfBlob);
    DriveApp.getFileById(doc.getId()).setTrashed(true);

    range.clearDataValidations();
    range.setFormula('=HYPERLINK("' + pdfFile.getUrl() + '"; "Ficha 📄")')
         .setBackground("#e6effe")
         .setFontColor("#1155cc")
         .setFontWeight("bold")
         .setHorizontalAlignment("center");

  } catch (err) {
    range.setValue("Error: " + err.message);
  }
}

// ─────────────────────────────────────────────
// INSTALACIÓN DEL TRIGGER (ejecutar UNA VEZ)
// ─────────────────────────────────────────────
function instalarTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger("onEditInstalable")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  Logger.log("✅ Trigger instalado correctamente.");
}
