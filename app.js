(function () {
  "use strict";
  const cfg = window.CLINIC_BOOKING_CONFIG || {};
  const state = { step: 0, type: "", date: "", time: "ANY", name: "", phone: "", email: "", note: "", consent: false, submitting: false, submitted: false };
  const steps = ["Appointment type", "Preferred date", "Preferred time", "Your details", "A note for the clinic", "Review request"];
  const content = document.getElementById("step-content"), count = document.getElementById("step-count"), caption = document.getElementById("step-caption");
  const back = document.getElementById("back-button"), next = document.getElementById("continue-button"), error = document.getElementById("form-error"), progress = document.getElementById("progress"), fill = document.getElementById("progress-fill");
  document.getElementById("clinic-name").textContent = cfg.clinicName || "Clinic Booking System 1";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function localDate(d) { const x = new Date(d); return [x.getFullYear(),String(x.getMonth()+1).padStart(2,"0"),String(x.getDate()).padStart(2,"0")].join("-"); }
  function minDate() { const d = new Date(); d.setDate(d.getDate() + Math.max(0, Number(cfg.minimumDaysAhead)||0)); return localDate(d); }
  function showError(msg) { error.textContent = msg; error.hidden = !msg; }
  function valid() {
    if (state.step===0) return !!state.type;
    if (state.step===1) return !!state.date && state.date >= minDate() && state.date <= maxDate();
    if (state.step===2) return !!state.time;
    if (state.step===3) return state.name.trim().length>=2 && state.phone.replace(/[^\d+]/g,"").length>=7 && (!state.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email));
    if (state.step===4) return state.note.length<=300;
    if (state.step===5) return state.consent;
    return false;
  }
  function maxDate(){const d=new Date();d.setDate(d.getDate()+Math.max(1,Number(cfg.maximumDaysAhead)||180));return localDate(d);}
  function field(label,id,value,type,required,extra) { return '<div class="field"><label for="'+id+'">'+label+(required?' <span aria-hidden="true">*</span>':'')+'</label><input id="'+id+'" name="'+id+'" type="'+type+'" value="'+esc(value)+'" '+(required?'required ':'')+(type==="date"?'min="'+minDate()+'" max="'+maxDate()+'" ':'')+(extra||"")+'></div>'; }
  function render() {
    if(state.submitted) return;
    count.textContent="Step "+(state.step+1)+" of 6"; caption.textContent=steps[state.step]; progress.setAttribute("aria-valuenow",state.step+1); fill.style.width=((state.step+1)/6*100)+"%";
    back.hidden=state.step===0; next.textContent=state.step===5?"Request appointment":"Continue"; next.disabled=!valid()||state.submitting; showError("");
    let html="";
    if(state.step===0) html='<h2 id="question-title">What do you need help with?</h2><p class="hint">Choose the type that best fits your visit.</p><div class="option-list">'+[["Consultation","Consultation"],["Follow-up appointment","Follow-up appointment"],["Other","Other"]].map(x=>'<button type="button" class="option" data-type="'+esc(x[1])+'" aria-pressed="'+(state.type===x[1])+'"><span class="radio-dot" aria-hidden="true"></span><span>'+x[0]+'</span></button>').join("")+'</div>';
    if(state.step===1) html='<h2 id="question-title">Which date works for you?</h2><p class="hint">This is your preferred date. The clinic will check its schedule.</p>'+field("Preferred date","date",state.date,"date",true);
    if(state.step===2) html='<h2 id="question-title">What time works best for you?</h2><p class="hint">Choose a preference. The clinic will confirm availability before your appointment is booked.</p><div class="option-list">'+[['ANY','Any available time'],['MORNING','Morning (09:00–12:00)'],['AFTERNOON','Afternoon (12:00–18:00)']].map(x=>'<button type="button" class="option" data-time="'+x[0]+'" aria-pressed="'+(state.time===x[0])+'"><span class="radio-dot" aria-hidden="true"></span><span>'+x[1]+'</span></button>').join("")+'</div>';
    if(state.step===3) html='<h2 id="question-title">How can the clinic contact you?</h2><p class="hint">Please provide your name and phone number.</p>'+field("Full name","name",state.name,"text",true,'autocomplete="name" maxlength="100"')+field("Phone number","phone",state.phone,"tel",true,'autocomplete="tel" maxlength="25"')+field("Email address","email",state.email,"email",false,'autocomplete="email" maxlength="254"');
    if(state.step===4) html='<h2 id="question-title">Anything the clinic should know?</h2><p class="hint">Optional. Please do not include sensitive medical details.</p><div class="field"><label for="note">Note for the clinic</label><textarea id="note" maxlength="300" placeholder="A short note (optional)">'+esc(state.note)+'</textarea><p class="field-help"><span id="note-count">'+state.note.length+'</span>/300 characters</p></div>';
    if(state.step===5) html='<h2 id="question-title">Review your request</h2><p class="hint">Check your details before sending. You can edit any section.</p><dl class="review-list">'+reviewRow("Appointment type",state.type,0)+reviewRow("Preferred date",state.date,1)+reviewRow("Preferred time",timeLabel(state.time),2)+reviewRow("Full name",state.name,3)+reviewRow("Phone number",state.phone,3)+reviewRow("Email",state.email||"Not provided",3)+reviewRow("Note",state.note||"None",4)+'</dl><label class="consent"><input id="consent" type="checkbox" '+(state.consent?'checked':'')+'><span>I agree that my information can be sent to the clinic to handle this appointment request.</span></label>';
    content.innerHTML=html;
    content.querySelectorAll("[data-type]").forEach(b=>b.addEventListener("click",()=>{state.type=b.dataset.type;render();}));
    content.querySelectorAll("[data-time]").forEach(b=>b.addEventListener("click",()=>{state.time=b.dataset.time;render();}));
    ["date","name","phone","email"].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener("input",()=>{state[id]=el.value;next.disabled=!valid();showError("");});});
    const note=document.getElementById("note");if(note)note.addEventListener("input",()=>{state.note=note.value;document.getElementById("note-count").textContent=state.note.length;next.disabled=!valid();});
    const consent=document.getElementById("consent");if(consent)consent.addEventListener("change",()=>{state.consent=consent.checked;next.disabled=!valid();});
    content.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>{state.step=Number(b.dataset.edit);render();}));
    next.disabled=!valid()||state.submitting;
  }
  function reviewRow(label,value,step){return '<div class="review-row"><dt>'+label+'</dt><dd>'+esc(value)+'<br><button type="button" class="edit-link" data-edit="'+step+'">Edit</button></dd></div>';}
  function timeLabel(t){return ({ANY:"Any available time",MORNING:"Morning (09:00–12:00)",AFTERNOON:"Afternoon (12:00–18:00)"})[t]||t;}
  back.addEventListener("click",()=>{if(state.step>0){state.step--;render();}});
  next.addEventListener("click",async()=>{if(!valid())return;if(state.step<5){state.step++;render();return;}await submit();});
  document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.tagName!=="TEXTAREA"&&state.step<5&&!next.disabled){e.preventDefault();next.click();}});
  async function submit(){
    if(!cfg.endpoint){showError("Booking is not connected yet. The clinic administrator must configure the secure booking service before requests can be sent.");return;}
    state.submitting=true;next.disabled=true;next.textContent="Sending request…";showError("");
    const payload={action:"submitBooking",appointmentType:state.type,requestedDate:state.date,requestedTime:state.time,patientName:state.name.trim(),phone:state.phone.trim(),email:state.email.trim(),note:state.note.trim(),consent:state.consent,source:"clinic-booking-system-1"};
    try{
      const response=await fetch(cfg.endpoint,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload),redirect:"follow"});
      if(!response.ok)throw new Error("The booking service could not be reached. Please try again.");
      const result=await response.json();
      if(!result||result.ok!==true||!result.bookingId)throw new Error(result&&result.message?result.message:"The clinic could not save this request. Please try again.");
      state.submitted=true;count.textContent="Request received";caption.textContent="Submission status";fill.style.width="100%";content.innerHTML='<div class="result-box"><h2>Request received</h2><p>Your request was saved by the clinic booking service. '+(result.status==="CONFIRMED"?"Your appointment is confirmed.":"Your appointment is <strong>pending clinic approval</strong> and is not yet confirmed.")+'</p><p>Reference number</p><p class="reference">'+esc(result.bookingId)+'</p><p>Keep this reference for your records. Contact the clinic directly if you need urgent help.</p></div>';back.hidden=true;next.hidden=true;document.querySelector(".privacy-note").hidden=true;
    }catch(err){showError(err.message||"We could not send your request. Check your connection and try again.");}
    finally{state.submitting=false;if(!state.submitted){next.textContent="Request appointment";next.disabled=!valid();}}
  }
  render();
})();