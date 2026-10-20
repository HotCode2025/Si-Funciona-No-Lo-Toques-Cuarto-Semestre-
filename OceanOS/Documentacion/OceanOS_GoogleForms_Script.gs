// ╔══════════════════════════════════════════════════════════════╗
// ║  🌊 OceanOS — Script de Google Apps Script                  ║
// ║  Crea el formulario completo + Google Sheet como BD         ║
// ║  + Notificaciones automáticas por email                     ║
// ╠══════════════════════════════════════════════════════════════╣
// ║  PASOS PARA USAR:                                           ║
// ║  1. Abrí script.google.com                                  ║
// ║  2. Nuevo proyecto → borrá el contenido vacío               ║
// ║  3. Pegá TODO este script                                   ║
// ║  4. Cambiá TU_EMAIL en la línea de EMAIL_NOTIFICACIONES     ║
// ║  5. Clic en ▶ Ejecutar → elegí "crearTodo"                 ║
// ║  6. Autorizá permisos cuando Google te los pida             ║
// ║  7. Revisá el log (Ver → Registros) para los links          ║
// ╚══════════════════════════════════════════════════════════════╝

// ─── CONFIGURACIÓN ───────────────────────────────────────────
var EMAIL_NOTIFICACIONES = "TU_EMAIL@gmail.com"; // ← CAMBIÁ ESTO
var NOMBRE_FORM  = "🌊 OceanOS — Encuesta de Validación MVP";
var NOMBRE_SHEET = "🌊 OceanOS — Base de Datos Encuestas";

// ─── COLORES ─────────────────────────────────────────────────
var C_NAVY   = "#0A2342";
var C_OCEAN  = "#1565C0";
var C_TEAL   = "#00897B";
var C_SLATE  = "#37474F";
var C_SKY    = "#E3F2FD";
var C_TEAL_L = "#E0F2F1";
var C_MIST   = "#ECEFF1";
var C_WHITE  = "#FFFFFF";
var C_GREEN  = "#E8F5E9";
var C_YELLOW = "#FFF8E1";
var C_RED    = "#FFEBEE";

// ============================================================
//  FUNCIÓN PRINCIPAL — ejecutar esta
// ============================================================
function crearTodo() {
  Logger.log("🌊 Iniciando creación del sistema OceanOS...");

  var form  = crearFormulario();
  var sheet = crearPlanilla(form);
  configurarTrigger(form);
  enviarEmailConfirmacion(form, sheet);

  Logger.log("════════════════════════════════════════════");
  Logger.log("✅ TODO LISTO — guardá estos links:");
  Logger.log("════════════════════════════════════════════");
  Logger.log("📋 ENCUESTA PÚBLICA: " + form.getPublishedUrl());
  Logger.log("✏️  EDITAR FORM:     " + form.getEditUrl());
  Logger.log("📊 BASE DE DATOS:   " + sheet.getUrl());
  Logger.log("════════════════════════════════════════════");
}

// ============================================================
//  CREAR EL FORMULARIO
// ============================================================
function crearFormulario() {

  var form = FormApp.create(NOMBRE_FORM);
  form.setTitle(NOMBRE_FORM);
  form.setDescription(
    "Gracias por tomarte 7-10 minutos para ayudarnos a validar OceanOS.\n\n" +
    "OceanOS es una app gratuita donde reportás avistamientos de tiburones y bosques de " +
    "algas desde tu celular, y ganás tokens OKN canjeables por experiencias de ecoturismo " +
    "en Patagonia. Necesitamos tu opinión para saber si el producto resuelve un problema " +
    "real en tu comunidad.\n\n" +
    "🔒 Tus respuestas son anónimas.\n" +
    "🎁 Si dejás tu email, recibís 50 tokens OKN al lanzamiento."
  );
  form.setConfirmationMessage(
    "✅ ¡Muchas gracias!\n\n" +
    "Tus respuestas quedaron guardadas. Si dejaste tu email, te avisamos cuando lancemos " +
    "el beta en Puerto Madryn.\n\n🎁 50 tokens OKN reservados para vos.\n\n— El equipo OceanOS 🌊"
  );
  form.setProgressBar(true);
  form.setIsQuiz(false);
  form.setShuffleQuestions(false);

  // ── BLOQUE 0 — Clasificación ─────────────────────────────
  form.addSectionHeaderItem()
    .setTitle("BLOQUE 0 — Clasificación del respondente")
    .setHelpText("Contanos quién sos para analizar las respuestas por tipo de usuario.");

  form.addCheckboxItem()
    .setTitle("1. ¿Cuál de estas actividades realizás en la costa patagónica?")
    .setHelpText("Podés seleccionar más de una.")
    .setChoiceValues([
      "Buceo recreativo o deportivo",
      "Pesca artesanal o deportiva",
      "Ecoturismo / avistamiento de fauna",
      "Investigación científica o estudio universitario",
      "Ninguna de las anteriores"
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("2. ¿Con qué frecuencia realizás esta actividad durante la temporada (oct–abr)?")
    .setChoiceValues([
      "Todos los días o casi todos los días",
      "2-3 veces por semana",
      "1 vez por semana",
      "1-2 veces por mes",
      "Menos de una vez por mes"
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("3. ¿En qué zona de la costa operás principalmente?")
    .setChoiceValues([
      "Puerto Madryn / Golfo Nuevo",
      "Península Valdés",
      "Puerto Deseado / Santa Cruz",
      "Tierra del Fuego",
      "Otra zona patagónica"
    ])
    .setRequired(true);

  // ── BLOQUE 1 — Comportamiento actual ─────────────────────
  form.addPageBreakItem()
    .setTitle("BLOQUE 1 — Comportamiento actual")
    .setHelpText("Contanos cómo es tu relación con el registro de fauna marina.");

  form.addMultipleChoiceItem()
    .setTitle("4. ¿Alguna vez fotografiaste avistamientos de fauna marina durante tu actividad?")
    .setChoiceValues([
      "Sí, siempre o casi siempre",
      "Sí, a veces",
      "Raramente",
      "No, nunca"
    ])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle("5. ¿Qué hacés con esas fotos o datos?")
    .setHelpText("Podés seleccionar más de una.")
    .setChoiceValues([
      "Las subo a redes sociales (Instagram, Facebook, etc.)",
      "Las comparto en grupos de WhatsApp",
      "Las guardo para uso personal",
      "Las reporto a alguna ONG o institución científica",
      "No suelo documentar avistamientos"
    ])
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle("6. ¿Conocés alguna app para reportar avistamientos de fauna marina en Argentina?")
    .setChoiceValues(["Sí", "No"])
    .setRequired(false);

  form.addTextItem()
    .setTitle("6b. Si respondiste Sí, ¿cuál app conocés?")
    .setHelpText("Opcional.")
    .setRequired(false);

  // ── BLOQUE 2 — Propuesta de valor ───────────────────────
  form.addPageBreakItem()
    .setTitle("BLOQUE 2 — Propuesta de valor OceanOS")
    .setHelpText(
      "📱 OceanOS es una app gratuita donde reportás avistamientos de tiburones y el estado " +
      "de los bosques de algas desde tu celular. Subís una foto con GPS y la IA clasifica la " +
      "especie en segundos. Por cada reporte verificado ganás tokens OKN canjeables por " +
      "descuentos en tours de buceo y experiencias de ecoturismo en Patagonia."
    );

  form.addScaleItem()
    .setTitle("7. ¿Cuán probable es que uses OceanOS en tu actividad habitual?")
    .setHelpText("1 = Nada probable   ·   10 = Muy probable")
    .setBounds(1, 10)
    .setLabels("Nada probable", "Muy probable")
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("8. ¿Cuántos reportes podrías enviar por semana usando OceanOS?")
    .setChoiceValues([
      "0 (no creo que la use)",
      "1-2 reportes por semana",
      "3-5 reportes por semana",
      "Más de 5 reportes por semana"
    ])
    .setRequired(true);

  form.addGridItem()
    .setTitle("9. ¿Qué te motivaría más para reportar? Indicá tu nivel de motivación (1=poco · 5=mucho)")
    .setRows([
      "Tokens OKN canjeables por ecoturismo",
      "Ver mi contribución en el mapa en tiempo real",
      "Ser parte de una comunidad científica ciudadana",
      "Ayudar a conservar la fauna y ecosistemas que uso",
      "Ranking e insignias de gamificación"
    ])
    .setColumns(["1","2","3","4","5"])
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle("10. ¿Con qué tipo de datos te sentirías cómodo/a?")
    .setHelpText("Podés seleccionar más de una.")
    .setChoiceValues([
      "Foto del avistamiento",
      "Ubicación GPS aproximada (±500 metros)",
      "Ubicación GPS exacta",
      "Fecha y hora",
      "Observaciones de texto libre"
    ])
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle("11. ¿Cuáles de estas funciones de la app valorás más?")
    .setHelpText("Elegí hasta 2 opciones.")
    .setChoiceValues([
      "Mapa en tiempo real con avistamientos",
      "Clasificación automática de especies por IA",
      "Wallet de tokens con historial y canje",
      "Ranking y comparación con otros reportadores",
      "Notificaciones de avistamientos cercanos",
      "Dashboard de salud del ecosistema en tu zona"
    ])
    .setRequired(false);

  // ── BLOQUE 3 y 4 — Barreras y tokens ────────────────────
  form.addPageBreakItem()
    .setTitle("BLOQUE 3 y 4 — Barreras y sistema de recompensas")
    .setHelpText("Necesitamos entender qué podría frenarte y si el sistema de tokens es incentivo suficiente.");

  form.addCheckboxItem()
    .setTitle("12. ¿Qué podría impedirte usar OceanOS regularmente?")
    .setHelpText("Podés seleccionar más de una.")
    .setChoiceValues([
      "No tengo conectividad / señal cuando hago mi actividad",
      "No quiero compartir mi ubicación GPS",
      "Me parece complicado de usar",
      "No creo que mis reportes sean útiles para la ciencia",
      "Los tokens no me resultan un incentivo suficiente",
      "Ya uso otra app similar",
      "No veo barreras significativas"
    ])
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle("13. ¿Con qué frecuencia tenés señal de celular durante tu actividad costera?")
    .setChoiceValues([
      "Siempre o casi siempre",
      "Aproximadamente la mitad del tiempo",
      "Raramente",
      "Nunca (actividad off-shore)"
    ])
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle("14. ¿Con qué te gustaría canjear tus tokens OKN?")
    .setHelpText("Elegí las 3 opciones más interesantes.")
    .setChoiceValues([
      "Descuentos en tours de buceo y ecoturismo en Patagonia",
      "Entradas a áreas protegidas y reservas naturales",
      "Merchandising de OceanOS o marcas de buceo/pesca",
      "Donación de tokens a proyectos de restauración marina",
      "Acceso a reportes científicos del ecosistema",
      "Descuentos en equipamiento de pesca o buceo",
      "Participación en campañas científicas como voluntario/a"
    ])
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle("15. ¿Te parece justo recibir 25 tokens OKN por una foto verificada de tiburón?")
    .setHelpText("El sistema paga 25 OKN por foto con >80% de confianza en la IA.")
    .setChoiceValues([
      "Sí, me parece justo",
      "Sí, aunque podría ser más",
      "No, debería ser bastante más",
      "No puedo evaluarlo sin probar la app"
    ])
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle("16. Si 100 tokens OKN = 10% de descuento en un tour de buceo de $50.000 ARS, ¿es incentivo suficiente?")
    .setChoiceValues([
      "Sí, definitivamente",
      "Sí, aunque podría mejorar",
      "No, el incentivo no es suficiente",
      "No puedo evaluarlo sin probar la app"
    ])
    .setRequired(false);

  // ── BLOQUE 5 — Acción y contacto ────────────────────────
  form.addPageBreakItem()
    .setTitle("BLOQUE 5 — ¡Última sección! Acción y contacto")
    .setHelpText("Estas son las preguntas más importantes. 🙏");

  form.addMultipleChoiceItem()
    .setTitle("17. ¿Querés ser parte de los primeros 50 usuarios beta de OceanOS en Puerto Madryn?")
    .setChoiceValues([
      "Sí, me interesa mucho",
      "Sí, pero quiero informarme más primero",
      "Tal vez",
      "No por ahora"
    ])
    .setRequired(true);

  form.addTextItem()
    .setTitle("17b. Si querés unirte al beta, dejanos tu email")
    .setHelpText("Opcional. Solo para avisarte del lanzamiento. Jamás enviamos spam.")
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle("18. ¿Conocés organizaciones (pesqueras, ONGs, áreas protegidas) que podrían usar los datos de OceanOS?")
    .setHelpText("Opcional. Nombre y contacto si tenés.")
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle("19. ¿Tenés comentarios, sugerencias o preguntas sobre el proyecto?")
    .setHelpText("Opcional. Todo el feedback nos ayuda.")
    .setRequired(false);

  Logger.log("✅ Formulario creado: " + form.getPublishedUrl());
  return form;
}

// ============================================================
//  CREAR PLANILLA / BASE DE DATOS
// ============================================================
function crearPlanilla(form) {
  var ss = SpreadsheetApp.create(NOMBRE_SHEET);

  // Vincular el form a la sheet (las respuestas van acá automáticamente)
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  Utilities.sleep(3000); // esperar que Google cree la hoja

  // ── Formatear hoja de Respuestas ──
  var hojaResp = ss.getSheets()[0];
  hojaResp.setName("📋 Respuestas");

  // Banner superior
  var totalCols = hojaResp.getLastColumn() || 25;
  hojaResp.getRange(1, 1, 1, Math.max(totalCols, 5))
    .setBackground(C_NAVY)
    .setFontColor(C_WHITE)
    .setFontWeight("bold")
    .setFontSize(11);

  // ── Crear hoja Dashboard ──
  var dash = ss.insertSheet("📊 Dashboard");
  crearDashboard(dash, hojaResp);

  // ── Crear hoja Emails Beta ──
  var emailSheet = ss.insertSheet("📧 Emails Beta");
  emailSheet.getRange("A1:C1")
    .setValues([["Email","Fecha","Quiere beta"]])
    .setBackground(C_NAVY).setFontColor(C_WHITE).setFontWeight("bold");

  // ── Crear hoja Instrucciones ──
  var instrSheet = ss.insertSheet("📖 Instrucciones");
  crearInstrucciones(instrSheet, form, ss);

  Logger.log("✅ Planilla creada: " + ss.getUrl());
  return ss;
}

function crearDashboard(dash, hojaResp) {
  dash.getRange("A1:F1").merge()
    .setValue("🌊 OceanOS — Dashboard de Validación MVP")
    .setBackground(C_NAVY).setFontColor(C_WHITE)
    .setFontWeight("bold").setFontSize(16);

  dash.getRange("A2:F2").merge()
    .setValue("Las métricas se actualizan automáticamente con cada nueva respuesta.")
    .setBackground(C_SKY).setFontColor(C_SLATE).setFontSize(11).setFontStyle("italic");

  // Headers de métricas
  dash.getRange("A4:D4").setValues([["MÉTRICA","VALOR ACTUAL","UMBRAL VERDE","ESTADO"]])
    .setBackground(C_OCEAN).setFontColor(C_WHITE).setFontWeight("bold");

  // Filas de métricas con fórmulas
  var metricas = [
    ["Total de respuestas",
     "=MAX(0,COUNTA('📋 Respuestas'!A:A)-1)",
     "200 respuestas",
     ""],
    ["Score promedio intención (P7)",
     "=IFERROR(AVERAGEIF('📋 Respuestas'!J:J,\"<>\",'📋 Respuestas'!J:J),\"Sin datos\")",
     "≥ 7 / 10",
     ""],
    ["% que reportan 3+ veces/semana (P8)",
     "=IFERROR(TEXT(COUNTIF('📋 Respuestas'!K:K,\"*3-5*\")/MAX(1,COUNTA('📋 Respuestas'!K:K)-1),\"0%\"),\"Sin datos\")",
     "≥ 30%",
     ""],
    ["Emails beta capturados",
     "=IFERROR(COUNTIF('📋 Respuestas'!U:U,\"*@*\"),0)",
     "≥ 80 emails",
     ""],
    ["Quieren unirse al beta (P17)",
     "=IFERROR(TEXT(COUNTIF('📋 Respuestas'!T:T,\"*mucho*\")/MAX(1,COUNTA('📋 Respuestas'!T:T)-1),\"0%\"),\"Sin datos\")",
     "≥ 40%",
     ""],
    ["Sin barreras de conectividad (P12)",
     "=IFERROR(TEXT(COUNTIF('📋 Respuestas'!Q:Q,\"*No veo barreras*\")/MAX(1,COUNTA('📋 Respuestas'!Q:Q)-1),\"0%\"),\"Sin datos\")",
     "≥ 50%",
     ""]
  ];

  metricas.forEach(function(m, i) {
    var row = i + 5;
    var bg = i % 2 === 0 ? C_WHITE : C_MIST;
    dash.getRange(row, 1).setValue(m[0]).setBackground(bg);
    dash.getRange(row, 2).setFormula(m[1]).setBackground(bg).setFontWeight("bold");
    dash.getRange(row, 3).setValue(m[2]).setBackground(bg).setFontColor("#666666");
    // Fórmula de estado semáforo
    dash.getRange(row, 4).setFormula(
      "=IF(B" + row + "=\"Sin datos\",\"⏳ Sin datos\",IF(B" + row + ">=C" + row + ",\"✅ Verde\",\"⚠️ Revisar\"))"
    ).setBackground(bg).setFontWeight("bold");
  });

  // Formato de columnas
  dash.setColumnWidth(1, 280);
  dash.setColumnWidth(2, 160);
  dash.setColumnWidth(3, 180);
  dash.setColumnWidth(4, 140);
}

function crearInstrucciones(sheet, form, ss) {
  sheet.getRange("A1:D1").merge()
    .setValue("📖 OceanOS — Instrucciones del Sistema")
    .setBackground(C_NAVY).setFontColor(C_WHITE).setFontWeight("bold").setFontSize(14);

  var instrucciones = [
    ["","","",""],
    ["LINKS IMPORTANTES","","",""],
    ["📋 Encuesta pública (para compartir):", form.getPublishedUrl(),"",""],
    ["✏️  Editar formulario:", form.getEditUrl(),"",""],
    ["📊 Esta planilla:", ss.getUrl(),"",""],
    ["","","",""],
    ["¿QUÉ HACE EL SISTEMA AUTOMÁTICAMENTE?","","",""],
    ["• Cada nueva respuesta se guarda en la hoja '📋 Respuestas'","","",""],
    ["• Recibís un email de notificación con el resumen de cada respuesta","","",""],
    ["• Si el respondente deja su email, recibe un email de bienvenida al beta","","",""],
    ["• El '📊 Dashboard' actualiza las métricas de validación en tiempo real","","",""],
    ["• La hoja '📧 Emails Beta' acumula todos los emails capturados","","",""],
    ["","","",""],
    ["¿CÓMO COMPARTIR LA ENCUESTA?","","",""],
    ["• Mandá el link público por WhatsApp a grupos de buceo y pesca","","",""],
    ["• Postealo en Instagram, Facebook y LinkedIn con el hashtag #OceanOS","","",""],
    ["• Envialo por email a operadores turísticos de Puerto Madryn","","",""],
    ["• Pedile a los instructores PADI que lo reenvíen a sus alumnos","","",""],
    ["","","",""],
    ["FUNCIONES EXTRA DEL SCRIPT (ejecutar en script.google.com)","","",""],
    ["• exportarEmailsBeta() — exporta todos los emails a la hoja 📧","","",""],
    ["• verResumen() — muestra estadísticas en el log del script","","",""],
    ["• reenviarBienvenida(email) — reenvía el email de bienvenida beta","","",""],
  ];

  instrucciones.forEach(function(row, i) {
    var r = i + 2;
    sheet.getRange(r, 1, 1, 4).setValues([row]);
    if (row[0].startsWith("LINKS") || row[0].startsWith("¿QUÉ") || row[0].startsWith("¿CÓMO") || row[0].startsWith("FUNCIONES")) {
      sheet.getRange(r, 1).setBackground(C_TEAL_L).setFontWeight("bold").setFontColor(C_NAVY);
    }
  });

  sheet.setColumnWidth(1, 400);
  sheet.setColumnWidth(2, 500);
}

// ============================================================
//  TRIGGER — ejecuta onFormSubmit al recibir respuestas
// ============================================================
function configurarTrigger(form) {
  // Eliminar triggers previos para evitar duplicados
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === "onFormSubmit") ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger("onFormSubmit")
    .forForm(form)
    .onFormSubmit()
    .create();

  Logger.log("✅ Trigger de notificaciones configurado.");
}

// ============================================================
//  SE EJECUTA AUTOMÁTICAMENTE CADA VEZ QUE ALGUIEN RESPONDE
// ============================================================
function onFormSubmit(e) {
  try {
    var resp      = e.response;
    var items     = resp.getItemResponses();
    var timestamp = resp.getTimestamp();
    var fecha     = Utilities.formatDate(timestamp, "America/Argentina/Buenos_Aires", "dd/MM/yyyy HH:mm");

    var resumen   = "";
    var emailBeta = "";
    var quereBeta = "";
    var score     = "";
    var segmento  = "";

    items.forEach(function(item) {
      var pregunta = item.getItem().getTitle();
      var respuesta = item.getResponse();
      if (Array.isArray(respuesta)) respuesta = respuesta.join(", ");
      resumen += "▸ " + pregunta + "\n   " + respuesta + "\n\n";

      // Capturar datos clave
      if (pregunta.match(/17b|email/i)) emailBeta = respuesta;
      if (pregunta.match(/^17\./)) quereBeta = respuesta;
      if (pregunta.match(/^7\./)) score = respuesta;
      if (pregunta.match(/^1\./)) segmento = Array.isArray(item.getResponse()) ? item.getResponse()[0] : respuesta;
    });

    // ── Guardar email beta en hoja dedicada ──
    if (emailBeta && emailBeta.indexOf("@") !== -1) {
      guardarEmailBeta(emailBeta, fecha, quereBeta);
    }

    // ── Asunto dinámico ──
    var asunto = "🌊 Nueva respuesta OceanOS — " + fecha;
    if (quereBeta.indexOf("mucho") !== -1) asunto = "🎯 ¡BETA INTERESADO! — " + fecha;
    if (emailBeta && emailBeta.indexOf("@") !== -1) asunto = "📧 Email beta capturado — " + fecha;

    // ── Email al dueño ──
    var cuerpo =
      "════════════════════════════════\n" +
      "🌊 NUEVA RESPUESTA — OceanOS MVP\n" +
      "════════════════════════════════\n\n" +
      "📅 " + fecha + "\n" +
      "🏄 Segmento: " + (segmento||"N/D") + "\n" +
      "⭐ Score intención: " + (score||"N/D") + "/10\n" +
      "🎯 Quiere beta: " + (quereBeta||"N/D") + "\n" +
      (emailBeta ? "📧 Email: " + emailBeta + "\n" : "") +
      "\n── RESPUESTAS ──\n\n" + resumen;

    MailApp.sendEmail({ to: EMAIL_NOTIFICACIONES, subject: asunto, body: cuerpo });

    // ── Email de bienvenida al usuario si dejó email ──
    if (emailBeta && emailBeta.indexOf("@") !== -1 && emailBeta.length > 5) {
      enviarBienvenidaBeta(emailBeta);
    }

  } catch (err) {
    Logger.log("Error en onFormSubmit: " + err.toString());
  }
}

function guardarEmailBeta(email, fecha, quereBeta) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet() ||
             SpreadsheetApp.openByUrl(PropertiesService.getScriptProperties().getProperty("SHEET_URL"));
    var hoja = ss.getSheetByName("📧 Emails Beta");
    if (hoja) hoja.appendRow([email, fecha, quereBeta]);
  } catch(e) { Logger.log("Error guardando email: " + e); }
}

// ============================================================
//  EMAIL DE BIENVENIDA AL USUARIO BETA
// ============================================================
function enviarBienvenidaBeta(emailDestino) {
  var asunto = "🌊 OceanOS — ¡Tu lugar en el beta está reservado!";
  var cuerpo =
    "¡Hola!\n\n" +
    "Gracias por completar la encuesta de OceanOS y por querer ser parte del beta.\n\n" +
    "Tu lugar está reservado. Cuando lancemos la app en Puerto Madryn " +
    "vas a ser de los primeros en acceder.\n\n" +
    "🎁 50 tokens OKN te esperan al momento del lanzamiento.\n\n" +
    "¿Qué sigue?\n" +
    "━━━━━━━━\n" +
    "• Te avisamos por este email cuando la beta esté lista (en ~90 días)\n" +
    "• Si tenés preguntas o sugerencias, respondé este email directamente\n" +
    "• Si conocés buceadores, pescadores o científicos en Patagonia, " +
    "compartiles la encuesta — tu red nos ayuda a construir algo mejor\n\n" +
    "Gracias de verdad.\n\n" +
    "— El equipo OceanOS 🌊\n" +
    "Puerto Deseado, Santa Cruz · Argentina · 2026";

  MailApp.sendEmail({
    to: emailDestino, subject: asunto, body: cuerpo,
    replyTo: EMAIL_NOTIFICACIONES
  });
}

// ============================================================
//  EMAIL DE CONFIRMACIÓN AL DUEÑO (al crear el sistema)
// ============================================================
function enviarEmailConfirmacion(form, ss) {
  var asunto = "✅ OceanOS — Sistema de encuestas creado correctamente";
  var cuerpo =
    "¡Todo listo! Tu sistema de validación MVP de OceanOS está funcionando.\n\n" +
    "════════════════════\nLINKS IMPORTANTES\n════════════════════\n\n" +
    "📋 ENCUESTA PÚBLICA (compartir):\n" + form.getPublishedUrl() + "\n\n" +
    "✏️  EDITAR EL FORMULARIO:\n" + form.getEditUrl() + "\n\n" +
    "📊 BASE DE DATOS / PLANILLA:\n" + ss.getUrl() + "\n\n" +
    "════════════════════\nQUÉ PASA AUTOMÁTICAMENTE\n════════════════════\n\n" +
    "✅ Cada respuesta → email de notificación a vos\n" +
    "✅ Si dejan email → email de bienvenida beta automático\n" +
    "✅ Todas las respuestas → guardadas en '📋 Respuestas'\n" +
    "✅ Emails capturados → guardados en '📧 Emails Beta'\n" +
    "✅ Métricas de validación → actualizadas en '📊 Dashboard'\n\n" +
    "CÓMO COMPARTIR LA ENCUESTA:\n" +
    "• WhatsApp a grupos de buceo, pesca y ecoturismo de Puerto Madryn\n" +
    "• Instagram/Facebook con #OceanOS #Patagonia #CienciaCiudadana\n" +
    "• Email directo a instructores PADI y operadores turísticos\n\n" +
    "— Script OceanOS 🌊 · Puerto Deseado, Santa Cruz · 2026";

  MailApp.sendEmail({ to: EMAIL_NOTIFICACIONES, subject: asunto, body: cuerpo });
  Logger.log("✅ Email de confirmación enviado a: " + EMAIL_NOTIFICACIONES);
}

// ============================================================
//  FUNCIONES AUXILIARES
// ============================================================

// Ver estadísticas en el log
function verResumen() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName("📋 Respuestas");
  if (!hoja) { Logger.log("No se encontró la hoja."); return; }
  var total = Math.max(0, hoja.getLastRow() - 1);
  var emails = ss.getSheetByName("📧 Emails Beta");
  var totalEmails = emails ? Math.max(0, emails.getLastRow() - 1) : 0;
  Logger.log("════════════════════════════");
  Logger.log("📊 OceanOS — Resumen actual");
  Logger.log("════════════════════════════");
  Logger.log("Total respuestas: " + total);
  Logger.log("Emails beta:      " + totalEmails);
  Logger.log("Última respuesta: " + (hoja.getLastRow()>1 ? hoja.getRange(hoja.getLastRow(),1).getValue() : "ninguna"));
}

// Exportar emails a la hoja dedicada (si no se guardaron automáticamente)
function exportarEmailsBeta() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var hoja  = ss.getSheetByName("📋 Respuestas");
  if (!hoja) { Logger.log("No se encontró la hoja."); return; }
  var datos = hoja.getDataRange().getValues();
  var headers = datos[0];
  var emailCol = -1;
  headers.forEach(function(h,i){ if(String(h).toLowerCase().indexOf("17b")!==-1||String(h).toLowerCase().indexOf("email")!==-1) emailCol=i; });
  if (emailCol===-1) { Logger.log("No se encontró columna de email."); return; }
  var emailSheet = ss.getSheetByName("📧 Emails Beta") || ss.insertSheet("📧 Emails Beta");
  var existing = emailSheet.getDataRange().getValues().slice(1).map(r=>r[0]);
  var nuevos = 0;
  for (var r=1;r<datos.length;r++) {
    var email = String(datos[r][emailCol]||"").trim();
    if (email && email.indexOf("@")!==-1 && !existing.includes(email)) {
      emailSheet.appendRow([email, datos[r][0], ""]);
      nuevos++;
    }
  }
  Logger.log("✅ " + nuevos + " emails nuevos exportados.");
}

// Reenviar email de bienvenida manualmente
function reenviarBienvenida(email) {
  if (!email || email.indexOf("@")===-1) { Logger.log("Email inválido."); return; }
  enviarBienvenidaBeta(email);
  Logger.log("✅ Email de bienvenida reenviado a: " + email);
}
