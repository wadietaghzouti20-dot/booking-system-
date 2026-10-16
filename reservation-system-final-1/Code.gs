/**
 * Reservation System Final 1 — fresh Google Apps Script backend.
 * Run setup() once; it creates a NEW private spreadsheet automatically.
 * Deploy as Web app: Execute as you; access: Anyone (if available).
 * Website sends a normal form to a hidden iframe to avoid fetch/CORS failures.
 */
const APP_NAME = "Reservation System Final 1";
const SHEET_ID_PROPERTY = "SPREADSHEET_ID";
const HEADERS = ["Booking ID","Created At","Status","Appointment Type","Requested Date","Requested Time","Patient Name","Phone","Email","Message","Consent","Client Request ID","Source","Notification Status"];

function setup() {
  const props = PropertiesService.getScriptProperties();
  let ss, id = props.getProperty(SHEET_ID_PROPERTY);
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (_) {} }
  if (!ss) {
    ss = SpreadsheetApp.create(APP_NAME + " — Booking Records");
    props.setProperty(SHEET_ID_PROPERTY, ss.getId());
  }
  ss.setSpreadsheetTimeZone("Africa/Algiers");
  let bookings = ss.getSheetByName("Appointments");
  if (!bookings) bookings = ss.insertSheet("Appointments");
  if (bookings.getLastRow() === 0) {
    bookings.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
    bookings.setFrozenRows(1);
    bookings.getRange(1,1,1,HEADERS.length).setFontWeight("bold").setBackground("#145b52").setFontColor("#ffffff");
    bookings.autoResizeColumns(1, HEADERS.length);
  }
  let settings = ss.getSheetByName("Settings");
  if (!settings) settings = ss.insertSheet("Settings");
  if (settings.getLastRow() === 0) {
    settings.getRange(1,1,4,2).setValues([
      ["Setting","Value"],
      ["Clinic Name",APP_NAME],
      ["Admin Email",Session.getEffectiveUser().getEmail() || ""],
      ["Timezone","Africa/Algiers"]
    ]);
    settings.setFrozenRows(1);
    settings.getRange(1,1,1,2).setFontWeight("bold").setBackground("#145b52").setFontColor("#ffffff");
    settings.autoResizeColumns(1,2);
  }
  let audit = ss.getSheetByName("AuditLog");
  if (!audit) {
    audit = ss.insertSheet("AuditLog");
    audit.getRange(1,1,1,4).setValues([["Timestamp","Event","Booking ID","Details"]]);
    audit.setFrozenRows(1);
    audit.getRange(1,1,1,4).setFontWeight("bold").setBackground("#145b52").setFontColor("#ffffff");
    audit.autoResizeColumns(1,4);
  }
  ss.setActiveSheet(bookings);
  console.log("Setup complete. Spreadsheet: " + ss.getUrl());
  return ss.getUrl();
}

function doGet() {
  const configured = !!PropertiesService.getScriptProperties().getProperty(SHEET_ID_PROPERTY);
  const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font:16px Arial,sans-serif;padding:24px;color:#183a35"><h2>' + APP_NAME + ' service</h2><p>Service is reachable.</p><p>Spreadsheet setup: ' + (configured ? "configured" : "not configured — run setup()") + '</p></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(APP_NAME + " service").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  let result;
  try {
    const raw = e && e.parameter && e.parameter.payload ? e.parameter.payload : (e && e.postData && e.postData.contents ? e.postData.contents : "");
    result = processBooking_(JSON.parse(raw));
  } catch (err) {
    result = {ok:false, message:safeMessage_(err)};
  }
  return responsePage_(result);
}

function processBooking_(data) {
  if (!data || data.action !== "submitBooking") throw new Error("La demande n’a pas pu être comprise. Actualisez la page et réessayez.");
  const appointmentType = clean_(data.appointmentType,40);
  const requestedDate = clean_(data.requestedDate,10);
  const requestedTime = clean_(data.requestedTime,20);
  const patientName = clean_(data.patientName,100);
  const phone = clean_(data.phone,25);
  const email = clean_(data.email,254);
  const note = clean_(data.note,300);
  const requestId = clean_(data.clientRequestId,100);
  const source = clean_(data.source,80);
  if (!["Consultation","Suivi","Autre"].includes(appointmentType)) throw new Error("Choisissez un motif de rendez-vous valide.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) throw new Error("Choisissez une date valide.");
  const todayText = Utilities.formatDate(new Date(),"Africa/Algiers","yyyy-MM-dd");
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate()+180);
  const maxText = Utilities.formatDate(maxDate,"Africa/Algiers","yyyy-MM-dd");
  if (requestedDate < todayText || requestedDate > maxText) throw new Error("La date doit se situer entre aujourd’hui et les 180 prochains jours.");
  if (!["ANY","MORNING","AFTERNOON"].includes(requestedTime)) throw new Error("Choisissez un moment préféré valide.");
  if (patientName.length < 2) throw new Error("Saisissez votre nom complet.");
  if (phone.replace(/[^\d+]/g,"").length < 7) throw new Error("Saisissez un numéro de téléphone valide.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("L’adresse e-mail n’est pas valide.");
  if (data.consent !== true) throw new Error("Votre accord est nécessaire pour transmettre la demande.");

  const id = PropertiesService.getScriptProperties().getProperty(SHEET_ID_PROPERTY);
  if (!id) throw new Error("Le service n’est pas configuré. L’administrateur doit exécuter setup().");
  const ss = SpreadsheetApp.openById(id);
  const sheet = ss.getSheetByName("Appointments");
  if (!sheet) throw new Error("L’onglet Appointments est introuvable. Relancez setup().");
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let bookingId, rowNumber, duplicate = false;
  try {
    if (requestId && sheet.getLastRow() > 1) {
      const ids = sheet.getRange(2,12,sheet.getLastRow()-1,1).getDisplayValues().flat();
      const found = ids.indexOf(requestId);
      if (found >= 0) {
        bookingId = sheet.getRange(found+2,1).getDisplayValue();
        duplicate = true;
      }
    }
    if (!duplicate) {
      bookingId = "RS-" + Utilities.formatDate(new Date(),"Africa/Algiers","yyyyMMdd-HHmmss") + "-" + Math.random().toString(36).slice(2,6).toUpperCase();
      sheet.appendRow([bookingId,new Date(),"PENDING",appointmentType,requestedDate,requestedTime,patientName,phone,email,note,true,requestId,source,"PENDING"]);
      rowNumber = sheet.getLastRow();
    }
  } finally {
    lock.releaseLock();
  }
  if (duplicate) return {ok:true,bookingId:bookingId,duplicate:true};

  let notificationStatus = "NOT_SENT";
  try {
    const settings = ss.getSheetByName("Settings");
    const values = settings ? settings.getDataRange().getDisplayValues() : [];
    const config = {};
    values.slice(1).forEach(row => { if (row[0]) config[row[0]] = row[1]; });
    const clinicName = clean_(config["Clinic Name"] || APP_NAME,100);
    const adminEmail = clean_(config["Admin Email"] || Session.getEffectiveUser().getEmail(),254);
    const timeLabel = ({ANY:"Toute heure disponible",MORNING:"Le matin (09 h–12 h)",AFTERNOON:"L’après-midi (12 h–18 h)"})[requestedTime] || requestedTime;
    const body = "Nouvelle demande de rendez-vous\n\nRéférence : " + bookingId + "\nStatut : EN ATTENTE\nMotif : " + appointmentType + "\nDate souhaitée : " + requestedDate + "\nMoment : " + timeLabel + "\nNom : " + patientName + "\nTéléphone : " + phone + "\nE-mail : " + (email || "Non renseigné") + "\nMessage : " + (note || "Aucun") + "\n\nAucune réservation n’est confirmée automatiquement. Vérifiez les disponibilités et contactez le patient.";
    if (adminEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      MailApp.sendEmail({to:adminEmail,subject:"["+clinicName+"] Nouvelle demande "+bookingId,body:body});
      notificationStatus = "ADMIN_SENT";
    }
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      MailApp.sendEmail({to:email,subject:"Demande reçue — "+clinicName+" ("+bookingId+")",body:"Bonjour "+patientName+",\n\nNous avons reçu votre demande de rendez-vous auprès de "+clinicName+".\nRéférence : "+bookingId+"\nDate souhaitée : "+requestedDate+"\nVotre demande est en attente : ce message n’est pas une confirmation de rendez-vous. La clinique vous contactera.\n\nMerci."});
      notificationStatus += "+PATIENT_SENT";
    }
  } catch (mailError) {
    notificationStatus = "EMAIL_ERROR: " + String(mailError.message || mailError).slice(0,150);
  }
  try {
    sheet.getRange(rowNumber,14).setValue(notificationStatus);
    const audit = ss.getSheetByName("AuditLog");
    if (audit) audit.appendRow([new Date(),"BOOKING_CREATED",bookingId,notificationStatus]);
  } catch (_) {}
  return {ok:true,bookingId:bookingId};
}

function responsePage_(result) {
  const json = JSON.stringify(result).replace(/</g,"\\u003c").replace(/>/g,"\\u003e").replace(/&/g,"\\u0026");
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body><script>try{window.parent.postMessage({type:"reservation-result",result:' + json + ',ok:' + (result.ok ? "true" : "false") + ',bookingId:' + JSON.stringify(result.bookingId || "") + ',message:' + JSON.stringify(result.message || "") + '}, "*");}catch(e){}<\/script><p style="font:14px Arial,sans-serif;color:#34554d">Réponse traitée. Vous pouvez revenir à la page de réservation.</p></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(APP_NAME).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function clean_(value,maxLength) {
  return String(value == null ? "" : value).replace(/[\u0000-\u001F\u007F]/g," ").trim().slice(0,maxLength);
}
function safeMessage_(err) {
  return String(err && err.message ? err.message : "Une erreur inattendue est survenue.").slice(0,220);
}
