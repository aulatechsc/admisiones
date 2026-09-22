/**
 * Planilla: Admisiones Primaria
 * https://docs.google.com/spreadsheets/d/1s-ubjQzjyS_U9tg647y4wbXMzi2WiN2CcDKGVkOti8k/edit
 *
 * COPIA DE RESPALDO — la fuente de verdad vive en Google.
 *
 * Lee las columnas por letra fija (C, T, Y, M, K, F). Verificado el 2026-09-22:
 * el mapeo es correcto hoy, pero insertar una columna lo rompe en silencio.
 * Ver docs/esquema-unificado.md, sección 4.
 */

function instalarTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === "enviarMailConCheck") {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  ScriptApp.newTrigger("enviarMailConCheck")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
}

function enviarMailConCheck(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const fila = range.getRow();
  const columna = range.getColumn();

  const valor = range.getValue();
  const esMarcado = (valor === true || valor === "TRUE" || valor === 1);

  // Ejecutar solo si es la columna 1 (A), fila mayor a 1 y el checkbox de envío está marcado
  if (columna === 1 && fila > 1 && esMarcado) {

    const C = sheet.getRange("C" + fila).getValue(); // Nombre del alumno/a
    const T = sheet.getRange("T" + fila).getValue(); // Padre/Madre 1
    const Y = sheet.getRange("Y" + fila).getValue(); // Email
    const M = sheet.getRange("M" + fila).getValue(); // Checkbox de Inclusión (TRUE/FALSE)
    const K = sheet.getRange("K" + fila).getValue(); // Año vacante
    const F = sheet.getRange("F" + fila).getValue(); // Grado solicitado

    // Validación de correo electrónico
    if (!Y || Y.toString().indexOf("@") === -1) {
      range.setValue(false);
      SpreadsheetApp.getUi().alert("❌ No hay un correo válido en la columna Y.");
      return;
    }

    const urlAranceles = "https://docs.google.com/spreadsheets/d/1O9gDK1i3PJIeMTrAtGhnNaYAp6PzNCzjUYGTX5uw-qM/edit?usp=sharing";
    const asuntoUnificado = C + " - " + F + " (" + K + ")";
    let cuerpo = "";

    // LÓGICA BASADA EN COLUMNA M
    // Si M está marcado (True), envía el mail de "Sin vacante por inclusión"
    if (M === true || M === "TRUE") {
      cuerpo = "Estimado/a " + T + ":\n\n" +
               "Nos comunicamos desde el Colegio San Carlos Diálogos en relación a la postulación de " + C + ".\n\n" +
               "Gracias por el interés en nuestra institución y por acercarse a conocer nuestro proyecto. Queremos compartirles que, para el ciclo lectivo " + K + ", no contamos con disponibilidad de vacante en " + F + " para alumnos/as con necesidad de un proyecto de inclusión.\n\n" +
               "Nuestros grupos son reducidos y se conforman cuidando especialmente la diversidad y el acompañamiento personalizado de cada niño y niña. Para poder sostener una propuesta de inclusión genuina y responsable, las vacantes con proyecto de inclusión son limitadas y, en este grado, ya se encuentran cubiertas.\n\n" +
               "De todos modos, si lo desean, queda abierta la posibilidad de mantener una entrevista como espacio de encuentro y conversación. En ese caso, les pedimos que nos respondan a este mail comentándonos sus disponibilidades de días y horarios por la mañana.\n\n" +
               "Asimismo, si antes de agendar la entrevista quieren hacer alguna consulta o compartir información, pueden responderme a este correo. Estoy a disposición.\n\n" +
               "Les compartimos también el enlace a los aranceles vigentes, para que cuenten con esa información:\n" +
               urlAranceles + "\n\n" +
               "Saludos,\n" +
               "Rocío Halperin\n" +
               "Directora General – Nivel Primario\n" +
               "Colegio San Carlos Diálogos";
    }
    // Si M NO está marcado (False), envía el mail estándar "Sin proyecto de inclusión"
    else {
      cuerpo = "Estimado/a " + T + ":\n\n" +
               "Nos comunicamos desde el Colegio San Carlos Diálogos en relación a la postulación de " + C + " para " + F + " del año " + K + ".\n\n" +
               "Gracias por el interés en nuestra propuesta. Nos gustaría poder coordinar una entrevista inicial, pensada como un primer encuentro para conocernos, escuchar su recorrido familiar y compartirles nuestra mirada y proyecto educativo.\n\n" +
               "Para organizarla de manera ágil, les pedimos que nos respondan a este correo indicándonos qué días y horarios tendrían disponibles por la mañana para realizar el encuentro.\n\n" +
               "Queremos aclarar que, en esta primera instancia, la entrevista se realiza únicamente con adultos. De todos modos, si antes de agendar necesitan hacer alguna consulta o conversar algo puntual, pueden responderme a este correo. Estoy a disposición.\n\n" +
               "También les compartimos el enlace a los aranceles vigentes, para que cuenten con esa información desde el inicio:\n" +
               urlAranceles + "\n\n" +
               "Quedo atenta y será un gusto encontrarnos.\n\n" +
               "Saludos,\n" +
               "Rocío Halperin\n" +
               "Directora General – Nivel Primario\n" +
               "Colegio San Carlos Diálogos";
    }

    try {
      GmailApp.sendEmail(Y, asuntoUnificado, cuerpo);

      // Obtener fecha y hora actual formateada
      const ahora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM HH:mm");
      const mensajeConfirmacion = "✅ Enviado el " + ahora;

      // Reemplazar el checkbox por la confirmación
      range.clearDataValidations();
      range.setValue(mensajeConfirmacion)
           .setBackground("#d9ead3")
           .setFontWeight("bold")
           .setFontSize(9)
           .setHorizontalAlignment("center");

    } catch(err) {
      range.setValue("Error: " + err.message);
    }
  }
}
