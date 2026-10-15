(function () {
  "use strict";
  const cfg = window.CLINIC_BOOKING_CONFIG || {};
  const steps = ["Motif du rendez-vous","Date souhaitée","Horaire préféré","Votre nom","Votre téléphone","Votre adresse e-mail","Message pour la clinique","Vérification"];
  const state = {step:0,type:"",date:"",time:"ANY",name:"",phone:"",email:"",note:"",consent:false,submitting:false,submitted:false};
  const content = document.getElementById("step-content");
  const count = document.getElementById("step-count");
  const caption = document.getElementById("step-caption");
  const back = document.getElementById("back-button");
  const next = document.getElementById("continue-button");
  const error = document.getElementById("form-error");
  const progress = document.getElementById("progress");
  const fill = document.getElementById("progress-fill");
  document.getElementById("clinic-name").textContent = cfg.clinicName || "Clinic Booking System 1";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function localDate(d) { const x = new Date(d); return [x.getFullYear(),String(x.getMonth()+1).padStart(2,"0"),String(x.getDate()).padStart(2,"0")].join("-"); }
  function minDate() { const d = new Date(); d.setDate(d.getDate() + Math.max(0, Number(cfg.minimumDaysAhead)||0)); return localDate(d); }
  function maxDate() { const d = new Date(); d.setDate(d.getDate() + Math.max(1, Number(cfg.maximumDaysAhead)||180)); return localDate(d); }
  function showError(msg) { error.textContent = msg; error.hidden = !msg; }
  function valid() {
    switch(state.step) {
      case 0: return ["Consultation","Follow-up appointment","Other"].includes(state.type);
      case 1: return !!state.date && state.date >= minDate() && state.date <= maxDate();
      case 2: return ["ANY","MORNING","AFTERNOON"].includes(state.time);
      case 3: return state.name.trim().length >= 2 && state.name.trim().length <= 100;
      case 4: return state.phone.replace(/[^\d+]/g,"").length >= 7 && state.phone.length <= 25;
      case 5: return !state.email || (state.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email));
      case 6: return state.note.length <= 300;
      case 7: return state.consent;
      default: return false;
    }
  }
  function field(label,id,value,type,required,extra) {
    return '<div class="field"><label for="'+id+'">'+label+(required?' <span aria-hidden="true">*</span>':'')+'</label><input id="'+id+'" name="'+id+'" type="'+type+'" value="'+esc(value)+'" '+(required?'required ':'')+(type==="date"?'min="'+minDate()+'" max="'+maxDate()+'" ':'')+(extra||"")+'></div>';
  }
  function row(label,value,step) {
    return '<div class="review-row"><dt>'+label+'</dt><dd>'+esc(value)+'<br><button type="button" class="edit-link" data-edit="'+step+'">Modifier</button></dd></div>';
  }
  function timeLabel(t) { return ({ANY:"Toute heure disponible",MORNING:"Le matin (09 h–12 h)",AFTERNOON:"L’après-midi (12 h–18 h)"})[t] || t; }
  function render() {
    if (state.submitted) return;
    count.textContent = "Étape "+(state.step+1)+" sur "+steps.length;
    caption.textContent = steps[state.step];
    progress.setAttribute("aria-valuemax",steps.length);
    progress.setAttribute("aria-valuenow",state.step+1);
    fill.style.width = ((state.step+1)/steps.length*100)+"%";
    back.hidden = state.step===0;
    next.hidden = false;
    next.textContent = state.step===steps.length-1 ? "Envoyer la demande" : "Continuer";
    showError("");
    let html = "";
    if(state.step===0) html='<h2 id="question-title">Quel est le motif de votre rendez-vous ?</h2><p class="hint">Choisissez l’option qui correspond le mieux à votre visite.</p><div class="option-list">'+[["Consultation","Consultation"],["Rendez-vous de suivi","Follow-up appointment"],["Autre motif","Other"]].map(x=>'<button type="button" class="option" data-type="'+esc(x[1])+'" aria-pressed="'+(state.type===x[1])+'"><span class="radio-dot" aria-hidden="true"></span><span>'+x[0]+'</span></button>').join("")+'</div>';
    if(state.step===1) html='<h2 id="question-title">Quelle date vous conviendrait ?</h2><p class="hint">Il s’agit de votre date préférée. La clinique vérifiera ses disponibilités.</p>'+field("Date souhaitée","date",state.date,"date",true);
    if(state.step===2) html='<h2 id="question-title">À quel moment préférez-vous venir ?</h2><p class="hint">L’horaire exact sera confirmé par la clinique.</p><div class="option-list">'+[["ANY","Toute heure disponible"],["MORNING","Le matin (09 h–12 h)"],["AFTERNOON","L’après-midi (12 h–18 h)"]].map(x=>'<button type="button" class="option" data-time="'+x[0]+'" aria-pressed="'+(state.time===x[0])+'"><span class="radio-dot" aria-hidden="true"></span><span>'+x[1]+'</span></button>').join("")+'</div>';
    if(state.step===3) html='<h2 id="question-title">Quel est votre nom complet ?</h2><p class="hint">Indiquez le nom à utiliser pour votre demande.</p>'+field("Nom complet","name",state.name,"text",true,'autocomplete="name" maxlength="100"');
    if(state.step===4) html='<h2 id="question-title">Quel est votre numéro de téléphone ?</h2><p class="hint">La clinique pourra vous contacter au sujet de votre demande.</p>'+field("Numéro de téléphone","phone",state.phone,"tel",true,'autocomplete="tel" maxlength="25"');
    if(state.step===5) html='<h2 id="question-title">Quelle est votre adresse e-mail ?</h2><p class="hint">Facultatif. Si vous la renseignez, la clinique pourra vous envoyer un accusé de réception.</p>'+field("Adresse e-mail (facultatif)","email",state.email,"email",false,'autocomplete="email" maxlength="254"');
    if(state.step===6) html='<h2 id="question-title">Souhaitez-vous ajouter un message ?</h2><p class="hint">Facultatif. N’indiquez pas d’informations médicales sensibles.</p><div class="field"><label for="note">Message pour la clinique</label><textarea id="note" maxlength="300" placeholder="Votre message (facultatif)">'+esc(state.note)+'</textarea><p class="field-help"><span id="note-count">'+state.note.length+'</span>/300 caractères</p></div>';
    if(state.step===7) html='<h2 id="question-title">Vérifiez votre demande</h2><p class="hint">Vérifiez les informations avant de les envoyer. Vous pouvez modifier chaque section.</p><dl class="review-list">'+row("Motif",({"Consultation":"Consultation","Follow-up appointment":"Rendez-vous de suivi","Other":"Autre motif"})[state.type],0)+row("Date souhaitée",state.date,1)+row("Horaire préféré",timeLabel(state.time),2)+row("Nom complet",state.name,3)+row("Téléphone",state.phone,4)+row("E-mail",state.email||"Non renseigné",5)+row("Message",state.note||"Aucun",6)+'</dl><label class="consent"><input id="consent" type="checkbox" '+(state.consent?'checked':'')+'><span>J’accepte que ces informations soient transmises à la clinique pour traiter ma demande.</span></label>';
    content.innerHTML = html;
    content.querySelectorAll("[data-type]").forEach(b=>b.addEventListener("click",()=>{state.type=b.dataset.type;render();}));
    content.querySelectorAll("[data-time]").forEach(b=>b.addEventListener("click",()=>{state.time=b.dataset.time;render();}));
    ["date","name","phone","email"].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener("input",()=>{state[id]=el.value;next.disabled=!valid();showError("");});});
    const note=document.getElementById("note");
    if(note) note.addEventListener("input",()=>{state.note=note.value;document.getElementById("note-count").textContent=state.note.length;next.disabled=!valid();showError("");});
    const consent=document.getElementById("consent");
    if(consent) consent.addEventListener("change",()=>{state.consent=consent.checked;next.disabled=!valid();});
    content.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>{state.step=Number(b.dataset.edit);render();}));
    next.disabled = !valid() || state.submitting;
  }
  back.addEventListener("click",()=>{if(state.step>0&&!state.submitting){state.step--;render();}});
  next.addEventListener("click",async()=>{if(!valid()||state.submitting)return;if(state.step<steps.length-1){state.step++;render();return;}await submit();});
  document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.tagName!=="TEXTAREA"&&state.step<steps.length-1&&!next.disabled){e.preventDefault();next.click();}});
  function requestId() {
    const key="clinicBookingRequestId";
    try { let id=sessionStorage.getItem(key); if(!id){id=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():"req-"+Date.now()+"-"+Math.random().toString(36).slice(2);sessionStorage.setItem(key,id);} return id; }
    catch(e) { return "req-"+Date.now()+"-"+Math.random().toString(36).slice(2); }
  }
  async function submit() {
    if(!cfg.endpoint || !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/.test(cfg.endpoint)) {
      showError("Le formulaire n’est pas encore connecté au service de la clinique. Aucune demande n’a été envoyée. L’administrateur doit configurer l’adresse du service.");
      return;
    }
    state.submitting=true;next.disabled=true;next.textContent="Envoi en cours…";showError("");
    const payload={action:"submitBooking",appointmentType:state.type,requestedDate:state.date,requestedTime:state.time,patientName:state.name.trim(),phone:state.phone.trim(),email:state.email.trim(),note:state.note.trim(),consent:state.consent,clientRequestId:requestId(),source:"clinic-booking-system-1"};
    try {
      const response=await fetch(cfg.endpoint,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload),redirect:"follow"});
      if(!response.ok) throw new Error("Le service de réservation est temporairement indisponible. Réessayez plus tard.");
      let result;try{result=await response.json();}catch(e){throw new Error("Le service a renvoyé une réponse inattendue. Votre demande n’est pas confirmée.");}
      if(!result||result.ok!==true||!result.bookingId) throw new Error(result&&result.message?result.message:"La demande n’a pas pu être enregistrée. Réessayez.");
      state.submitted=true;count.textContent="Demande reçue";caption.textContent="État de l’envoi";fill.style.width="100%";
      content.innerHTML='<div class="result-box"><h2>Votre demande a été reçue</h2><p>Le service a enregistré votre demande. '+(result.status==="CONFIRMED"?"Votre rendez-vous est confirmé.":"Votre rendez-vous reste en attente de validation par la clinique ; il n’est pas encore confirmé.")+'</p><p>Numéro de référence</p><p class="reference">'+esc(result.bookingId)+'</p><p>Conservez ce numéro. Contactez directement la clinique si vous avez besoin d’aide urgente.</p></div>';
      back.hidden=true;next.hidden=true;document.querySelector(".privacy-note").hidden=true;
    } catch(err) { showError(err.message||"Impossible d’envoyer la demande. Vérifiez votre connexion et réessayez."); }
    finally {state.submitting=false;if(!state.submitted){next.textContent="Envoyer la demande";next.disabled=!valid();}}
  }
  render();
})();