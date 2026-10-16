(function () {
  "use strict";
  const cfg = window.RESERVATION_CONFIG || {};
  const form = document.getElementById("booking-form");
  const steps = [...document.querySelectorAll(".form-step")];
  const next = document.getElementById("next-button");
  const back = document.getElementById("back-button");
  const actions = document.getElementById("form-actions");
  const error = document.getElementById("form-error");
  const progress = document.getElementById("progress-fill");
  const stepPill = document.getElementById("step-pill");
  const summary = document.getElementById("summary");
  const responseFrame = document.getElementById("reservation-response");
  let step = 0, busy = false, submitted = false, timer = null;
  const $ = id => document.getElementById(id);
  $("clinic-name").textContent = cfg.clinicName || cfg.appName || "Reservation System Final 1";
  const minDate = new Date(); minDate.setDate(minDate.getDate() + Math.max(0, Number(cfg.minimumDaysAhead) || 0));
  const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + Math.max(1, Number(cfg.maximumDaysAhead) || 180));
  const iso = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  $("requestedDate").min = iso(minDate); $("requestedDate").max = iso(maxDate);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const picked = name => form.querySelector('input[name="'+name+'"]:checked')?.value || "";
  function validStep(n) {
    if (n === 0) return !!picked("appointmentType") && $("note").value.length <= 300;
    if (n === 1) return !!$("requestedDate").value && $("requestedDate").value >= $("requestedDate").min && $("requestedDate").value <= $("requestedDate").max && !!$("requestedTime").value;
    if (n === 2) return $("patientName").value.trim().length >= 2 && $("patientName").value.trim().length <= 100 && $("phone").value.trim().replace(/[^\d+]/g,"").length >= 7 && $("phone").value.length <= 25 && (!$("email").value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($("email").value));
    if (n === 3) return $("consent").checked;
    return false;
  }
  function render() {
    steps.forEach((el,i) => { el.hidden = i !== step; el.classList.toggle("active",i===step); });
    stepPill.textContent = "Étape " + (step+1) + " / " + steps.length;
    progress.style.width = ((step+1)/steps.length*100) + "%";
    back.hidden = step === 0; next.hidden = false; actions.hidden = false;
    next.textContent = step === steps.length-1 ? "Envoyer la demande →" : "Continuer →";
    next.disabled = !validStep(step) || busy;
    error.hidden = true; error.textContent = "";
    if (step === 3) renderSummary();
  }
  function renderSummary() {
    const values = [
      ["Motif",picked("appointmentType")],
      ["Date souhaitée",$("requestedDate").value],
      ["Moment préféré",({"ANY":"Tous les créneaux disponibles","08_10":"08 h – 10 h","10_12":"10 h – 12 h","13_15":"13 h – 15 h","15_17":"15 h – 17 h","MORNING":"Le matin","AFTERNOON":"L’après-midi"}[$("requestedTime").value] || $("requestedTime").value)],
      ["Nom complet",$("patientName").value.trim()],
      ["Téléphone",$("phone").value.trim()],
      ["E-mail",$("email").value.trim() || "Non renseigné"],
      ["Message",$("note").value.trim() || "Aucun"]
    ];
    summary.innerHTML = values.map(([k,v]) => "<div><dt>"+esc(k)+"</dt><dd>"+esc(v)+"</dd></div>").join("");
  }
  function showError(message) { error.textContent = message; error.hidden = !message; }
  function showSuccess(reference, booked, message) {
    submitted = true; busy = false;
    steps.forEach(el => el.hidden = true);
    actions.hidden = true; error.hidden = true;
    const panel = document.querySelector(".success-panel");
    panel.hidden = false;
    $("success-heading").textContent = booked ? "Rendez-vous confirmé" : "Demande reçue";
    $("success-copy").textContent = booked
      ? (message || "Votre rendez-vous est réservé dans l’agenda de la clinique.")
      : (message || "Aucun créneau ne correspondait à votre préférence. Consultez votre e-mail pour choisir une autre disponibilité.");
    $("booking-reference").textContent = reference ? "Référence : " + reference : "Référence non disponible — contactez la clinique si nécessaire.";
    $("success-next-step").textContent = booked
      ? "Un e-mail récapitulatif sera envoyé si vous avez fourni une adresse e-mail. Vous pouvez utiliser son lien pour annuler ce rendez-vous."
      : "Aucun rendez-vous n’est encore réservé. Si vous avez fourni une adresse e-mail, vérifiez-la pour ouvrir le sélecteur de créneaux.";
    $("form-heading").textContent = booked ? "Votre rendez-vous est confirmé" : "Votre demande a été reçue";
    $("step-pill").textContent = "Terminé";
    progress.style.width = "100%";
    document.querySelector(".card-foot").hidden = true;
  }
  function resetForm() {
    form.reset(); step=0; busy=false; submitted=false;
    document.querySelector(".success-panel").hidden=true;
    $("form-heading").textContent = "Parlons de votre visite";
    $("step-pill").textContent = "Étape 1 / 4";
    document.querySelector(".card-foot").hidden=false;
    render();
  }
  $("new-request").addEventListener("click",resetForm);
  form.addEventListener("input",() => { if (!busy && !submitted) { next.disabled = !validStep(step); if (step===3) renderSummary(); } });
  form.addEventListener("change",() => { if (!busy && !submitted) { next.disabled = !validStep(step); if (step===3) renderSummary(); } });
  back.addEventListener("click",() => { if(step>0 && !busy) {step--;render();} });
  next.addEventListener("click",async() => {
    if (busy || submitted || !validStep(step)) return;
    if (step < steps.length-1) {step++;render();return;}
    await submitRequest();
  });
  function requestId() {
    try { return (crypto.randomUUID ? crypto.randomUUID() : "req-"+Date.now()+"-"+Math.random().toString(36).slice(2)); }
    catch (_) { return "req-"+Date.now()+"-"+Math.random().toString(36).slice(2); }
  }
  async function submitRequest() {
    if (!cfg.endpoint || !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/.test(cfg.endpoint)) {
      showError("Le formulaire n’est pas encore connecté au nouveau service. Aucune demande n’a été envoyée.");
      return;
    }
    busy=true; next.disabled=true; next.textContent="Envoi en cours…"; showError("");
    const payload = {
      action:"submitBooking",
      appointmentType:picked("appointmentType"),
      requestedDate:$("requestedDate").value,
      requestedTime:$("requestedTime").value,
      patientName:$("patientName").value.trim(),
      phone:$("phone").value.trim(),
      email:$("email").value.trim(),
      note:$("note").value.trim(),
      consent:$("consent").checked,
      clientRequestId:requestId(),
      source:"reservation-system-final-1"
    };
    const listener = event => {
      if (event.source !== responseFrame.contentWindow || !event.data || event.data.type !== "reservation-result") return;
      window.removeEventListener("message",listener);
      clearTimeout(timer);
      const result = event.data;
      if (result.ok && result.bookingId) showSuccess(result.bookingId, result.booked === true, result.message || "");
      else { busy=false; next.disabled=!validStep(step); next.textContent="Réessayer →"; showError(result.message || "La demande n’a pas été enregistrée. Vérifiez les informations et réessayez."); }
    };
    window.addEventListener("message",listener);
    const hidden = document.createElement("input");
    hidden.type="hidden"; hidden.name="payload"; hidden.value=JSON.stringify(payload);
    form.appendChild(hidden);
    const oldTarget = form.target, oldMethod = form.method, oldAction = form.action, oldEnctype = form.enctype;
    form.target="reservation-response"; form.method="POST"; form.action=cfg.endpoint; form.enctype="application/x-www-form-urlencoded";
    form.submit();
    hidden.remove();
    form.target=oldTarget; form.method=oldMethod; form.action=oldAction; form.enctype=oldEnctype;
    timer = setTimeout(() => {
      window.removeEventListener("message",listener);
      busy=false; next.disabled=!validStep(step); next.textContent="Réessayer →";
      showError("Nous n’avons pas pu vérifier la réponse du service. La demande n’est pas confirmée. Vérifiez la connexion ou réessayez après avoir contrôlé la feuille de calcul.");
    },20000);
  }
  render();
})();