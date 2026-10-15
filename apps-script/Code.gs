/**
 * Clinic Booking System 1 — Google Apps Script backend.
 * Configure Script Properties: SPREADSHEET_ID, ADMIN_EMAIL, CLINIC_NAME.
 * Optional confirmation settings are documented in README.md.
 * Never put credentials or patient data in public frontend files.
 */
const HEADERS = {
  Appointments: ["Booking ID","Created At","Updated At","Patient Name","Phone","Email","Appointment Type","Requested Date","Requested Time","Appointment Duration","Optional Note","Status","Confirmation Token Hash","Cancellation Token Hash","Last Notification Status","Admin Notes","Client Request ID","Confirmed Start At"],
  Settings: ["Key","Value"],
  AuditLog: ["Timestamp","Booking ID","Action","Details"]
};
const DEFAULTS = {
  CLINIC_NAME:"Clinic Booking System 1", CLINIC_TIMEZONE:"Africa/Algiers", ADMIN_EMAIL:"",
  OPEN_DAYS:"Monday,Tuesday,Wednesday,Thursday,Friday,Saturday", OPEN_TIME:"09:00",
  CLOSE_TIME:"18:00", APPOINTMENT_DURATION_MINUTES:"30", BUFFER_MINUTES:"0",
  BOOKING_POLICY:"PENDING", RESCHEDULING_CUTOFF_HOURS:"24"
};

function setup() {
  const id=PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if(!id) throw new Error("Set SPREADSHEET_ID in Apps Script project settings first.");
  const ss=SpreadsheetApp.openById(id);
  Object.keys(HEADERS).forEach(name=>{
    const sheet=ss.getSheetByName(name)||ss.insertSheet(name), headers=HEADERS[name];
    headers.forEach((value,index)=>{
      if(sheet.getRange(1,index+1).getValue()!==value) sheet.getRange(1,index+1).setValue(value);
    });
    sheet.setFrozenRows(1);
  });
  const settings=ss.getSheetByName("Settings");
  const rows=settings.getLastRow()>1?settings.getRange(2,1,settings.getLastRow()-1,2).getValues():[];
  const known=new Set(rows.map(row=>String(row[0])));
  Object.keys(DEFAULTS).forEach(key=>{if(!known.has(key))settings.appendRow([key,DEFAULTS[key]]);});
  return {ok:true,message:"Setup complete"};
}

function doGet() {
  return output_({ok:true,service:"Clinic Booking System 1",message:"Service reachable. This does not prove spreadsheet setup or email delivery."});
}

function doPost(e) {
  try {
    const raw=e&&e.postData&&e.postData.contents;
    if(!raw||raw.length>12000) return output_({ok:false,message:"Requête invalide."});
    const data=JSON.parse(raw);
    if(data.action!=="submitBooking") return output_({ok:false,message:"Action non prise en charge."});
    return output_(submit_(data));
  } catch(err) {
    console.error("Booking submission failed: "+String(err&&err.message||err).slice(0,120));
    return output_({ok:false,message:publicError_(err)});
  }
}

function submit_(data) {
  const x=validate_(data);
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  let id,rowNumber,status="PENDING";
  try {
    const sheet=spreadsheet_().getSheetByName("Appointments");
    const last=sheet.getLastRow();
    if(last>1&&x.requestId) {
      const ids=sheet.getRange(2,17,last-1,1).getDisplayValues().flat();
      const index=ids.indexOf(x.requestId);
      if(index>=0) {
        const existing=sheet.getRange(index+2,1,1,HEADERS.Appointments.length).getDisplayValues()[0];
        return {ok:true,bookingId:existing[0],status:existing[11],duplicate:true};
      }
    }
    id="CBS1-"+Utilities.getUuid().replace(/-/g,"").slice(0,12).toUpperCase();
    const now=new Date();
    rowNumber=sheet.getLastRow()+1;
    sheet.getRange(rowNumber,1,1,HEADERS.Appointments.length).setValues([[
      id,now,now,x.name,x.phone,x.email,x.type,x.date,x.time,
      Number(setting_("APPOINTMENT_DURATION_MINUTES","30")),x.note,status,"","","PENDING_EMAIL_NOT_ATTEMPTED","",x.requestId,""
    ]]);
    sheet.getRange(rowNumber,2,1,2).setNumberFormat("yyyy-mm-dd hh:mm:ss");
    audit_(id,"REQUEST_CREATED","Status=PENDING");
  } finally {
    lock.releaseLock();
  }
  const notificationStatus=notify_(id,x);
  try { spreadsheet_().getSheetByName("Appointments").getRange(rowNumber,15).setValue(notificationStatus); }
  catch(err) { console.error("Could not update notification status."); }
  return {ok:true,bookingId:id,status:status,notificationStatus:notificationStatus};
}

function validate_(data) {
  const clean=value=>String(value==null?"":value).replace(/[\u0000-\u001f\u007f]/g," ").trim();
  const name=clean(data.patientName).slice(0,100), phone=clean(data.phone).slice(0,25);
  const email=clean(data.email).slice(0,254), type=clean(data.appointmentType);
  const date=clean(data.requestedDate), time=clean(data.requestedTime);
  const note=clean(data.note).slice(0,300), requestId=clean(data.clientRequestId).slice(0,80);
  if(data.consent!==true) throw new Error("Votre accord est nécessaire pour transmettre la demande.");
  if(name.length<2) throw new Error("Veuillez saisir votre nom complet.");
  if(phone.replace(/[^0-9+]/g,"").length<7) throw new Error("Veuillez saisir un numéro de téléphone valide.");
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Veuillez saisir une adresse e-mail valide.");
  if(!["Consultation","Follow-up appointment","Other"].includes(type)) throw new Error("Veuillez choisir un motif de rendez-vous.");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Veuillez choisir une date valide.");
  const parts=date.split("-").map(Number), parsed=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]));
  if(parsed.getUTCFullYear()!==parts[0]||parsed.getUTCMonth()!==parts[1]-1||parsed.getUTCDate()!==parts[2]) throw new Error("Veuillez choisir une date valide.");
  const today=Utilities.formatDate(new Date(),setting_("CLINIC_TIMEZONE","Africa/Algiers"),"yyyy-MM-dd");
  const max=new Date();max.setDate(max.getDate()+Math.max(1,Number(setting_("MAXIMUM_DAYS_AHEAD","180"))||180));
  const maxDate=Utilities.formatDate(max,setting_("CLINIC_TIMEZONE","Africa/Algiers"),"yyyy-MM-dd");
  if(date<today||date>maxDate) throw new Error("La date choisie doit se situer dans les 180 prochains jours.");
  if(!["ANY","MORNING","AFTERNOON"].includes(time)) throw new Error("Veuillez choisir une préférence horaire.");
  return {name:sheetCell_(name),phone:sheetCell_(phone),email:sheetCell_(email),type:type,date:date,time:time,note:sheetCell_(note),requestId:requestId};
}

function notify_(id,x) {
  const properties=PropertiesService.getScriptProperties();
  const admin=properties.getProperty("ADMIN_EMAIL")||setting_("ADMIN_EMAIL","");
  const clinic=properties.getProperty("CLINIC_NAME")||setting_("CLINIC_NAME","Clinic Booking System 1");
  if(!admin||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin)) return "SKIPPED_ADMIN_EMAIL_NOT_CONFIGURED";
  try {
    MailApp.sendEmail({to:admin,subject:"Nouvelle demande de rendez-vous — "+id,body:
      "Une demande est en attente d’examen et n’est pas confirmée.\nRéférence : "+id+
      "\nNom : "+x.name+"\nTéléphone : "+x.phone+"\nE-mail : "+(x.email||"Non renseigné")+
      "\nMotif : "+x.type+"\nDate souhaitée : "+x.date+"\nHoraire préféré : "+x.time+"\nMessage : "+(x.note||"Aucun")});
  } catch(err) { return "ADMIN_EMAIL_FAILED"; }
  if(x.email) {
    try {
      MailApp.sendEmail({to:x.email,subject:"Demande reçue — "+clinic,body:
        "Bonjour "+x.name+",\n\nLa clinique a reçu votre demande. Elle est en attente de validation et n’est PAS confirmée.\nRéférence : "+id+
        "\nDate souhaitée : "+x.date+"\nHoraire préféré : "+x.time+"\nLa clinique vous contactera après examen."});
    } catch(err) { return "ADMIN_SENT_PATIENT_EMAIL_FAILED"; }
  }
  return "SENT";
}

/**
 * Owner-only manual confirmation workflow.
 * Before running, set Script Properties PENDING_BOOKING_ID and PENDING_START_ISO.
 * PENDING_START_ISO must be local clinic time in yyyy-MM-ddTHH:mm format.
 * Then run confirmPendingBooking() from the Apps Script editor. Never expose this
 * workflow or its properties in public JavaScript. Conflicts are checked under a lock.
 */
function confirmPendingBooking() {
  const props=PropertiesService.getScriptProperties();
  const id=String(props.getProperty("PENDING_BOOKING_ID")||"").trim();
  const iso=String(props.getProperty("PENDING_START_ISO")||"").trim();
  if(!id||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(iso)) throw new Error("Set PENDING_BOOKING_ID and PENDING_START_ISO in Script Properties first.");
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try {
    const sheet=spreadsheet_().getSheetByName("Appointments"),last=sheet.getLastRow();
    if(last<2) throw new Error("No booking requests exist.");
    const data=sheet.getRange(2,1,last-1,HEADERS.Appointments.length).getValues();
    let rowIndex=-1,row;
    for(let i=0;i<data.length;i++) if(String(data[i][0])===id){rowIndex=i+2;row=data[i];break;}
    if(rowIndex<0) throw new Error("Booking reference was not found.");
    if(String(row[11])!=="PENDING") throw new Error("Only pending requests can be confirmed.");
    const start=parseClinicDateTime_(iso), duration=Math.max(1,Number(row[9])||30);
    if(start.getTime()<=Date.now()) throw new Error("A past appointment cannot be confirmed.");
    const end=new Date(start.getTime()+duration*60000), timezone=setting_("CLINIC_TIMEZONE","Africa/Algiers");
    const date=Utilities.formatDate(start,timezone,"yyyy-MM-dd");
    const openDays=setting_("OPEN_DAYS","Monday,Tuesday,Wednesday,Thursday,Friday,Saturday").split(",").map(s=>s.trim());
    const day=Utilities.formatDate(start,timezone,"EEEE");
    if(openDays.indexOf(day)<0) throw new Error("The selected day is not listed as an open day.");
    const hhmm=Utilities.formatDate(start,timezone,"HH:mm"), endHhmm=Utilities.formatDate(end,timezone,"HH:mm");
    if(hhmm<setting_("OPEN_TIME","09:00")||endHhmm>setting_("CLOSE_TIME","18:00")) throw new Error("The appointment must fit within clinic opening hours.");
    const buffer=Math.max(0,Number(setting_("BUFFER_MINUTES","0"))||0);
    for(let i=0;i<data.length;i++) {
      const existing=data[i];
      if(String(existing[11])!=="CONFIRMED"||!existing[17]) continue;
      const otherStart=new Date(existing[17]), otherDuration=Math.max(1,Number(existing[9])||30);
      const otherEnd=new Date(otherStart.getTime()+(otherDuration+buffer)*60000);
      const thisStart=new Date(start.getTime()-buffer*60000);
      if(thisStart<otherEnd&&end>otherStart&&Utilities.formatDate(otherStart,timezone,"yyyy-MM-dd")===date) {
        throw new Error("Conflict: another confirmed appointment overlaps this time.");
      }
    }
    const now=new Date();
    sheet.getRange(rowIndex,3).setValue(now);
    sheet.getRange(rowIndex,12).setValue("CONFIRMED");
    sheet.getRange(rowIndex,18).setValue(start).setNumberFormat("yyyy-mm-dd hh:mm");
    sheet.getRange(rowIndex,15).setValue("CONFIRMED_MANUALLY");
    audit_(id,"APPOINTMENT_CONFIRMED","Start="+iso);
    props.deleteProperty("PENDING_BOOKING_ID");props.deleteProperty("PENDING_START_ISO");
    return {ok:true,bookingId:id,status:"CONFIRMED",start:iso};
  } finally {lock.releaseLock();}
}

function parseClinicDateTime_(iso) {
  const match=iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if(!match) throw new Error("Invalid local date and time.");
  const y=Number(match[1]),m=Number(match[2]),d=Number(match[3]),h=Number(match[4]),min=Number(match[5]);
  if(m<1||m>12||d<1||d>31||h<0||h>23||min<0||min>59) throw new Error("Invalid local date and time.");
  const dt=new Date(y,m-1,d,h,min,0,0);
  if(dt.getFullYear()!==y||dt.getMonth()!==m-1||dt.getDate()!==d||dt.getHours()!==h||dt.getMinutes()!==min) throw new Error("Invalid local date and time.");
  return dt;
}

function spreadsheet_() {
  const id=PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if(!id) throw new Error("Le service n’est pas configuré : identifiant du classeur manquant.");
  return SpreadsheetApp.openById(id);
}
function setting_(key,fallback) {
  const prop=PropertiesService.getScriptProperties().getProperty(key);
  if(prop!==null) return prop;
  try {
    const sheet=spreadsheet_().getSheetByName("Settings");
    if(sheet&&sheet.getLastRow()>1) {
      const rows=sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues();
      for(let i=0;i<rows.length;i++) if(String(rows[i][0])===key) return String(rows[i][1]);
    }
  } catch(err) {}
  return fallback;
}
function sheetCell_(value) { return /^[=+@\-]/.test(value)?"'"+value:value; }
function audit_(id,action,details) {
  try { spreadsheet_().getSheetByName("AuditLog").appendRow([new Date(),id,action,String(details||"").slice(0,200)]); }
  catch(err) { console.error("Audit log write failed."); }
}
function publicError_(err) {
  const message=String(err&&err.message||"");
  if(/consent|nom complet|numéro de téléphone|adresse e-mail|motif|date valide|date choisie|préférence horaire/i.test(message)) return message;
  return "La demande n’a pas pu être enregistrée. Vérifiez la configuration du service ou réessayez plus tard.";
}
function output_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
