/* ====== State ====== */
let allSymptoms = [];      // current age's full list
let filteredSymptoms = []; // after text + category filters
let selected = new Set();
let donut = null;

const palette = ['#0b73b5','#18a6c8','#1e8d6d','#d7891f','#c53939','#6e8596','#095f95','#4aa3a0','#5f79a0','#8a98a5'];

/* ====== Elements ====== */
const ageEl = document.getElementById('age');
const symBox = document.getElementById('symptomBox');
const symSearch = document.getElementById('symSearch');
const categories = document.getElementById('categories');
const predictBtn = document.getElementById('predictBtn');
const resetBtn = document.getElementById('resetBtn');
const pdfBtn = document.getElementById('pdfBtn');

const statusLine = document.getElementById('statusLine');
const selCount = document.getElementById('selCount');
const ageGroupK = document.getElementById('ageGroupK');
const symCountK = document.getElementById('symCountK');
const modelNameK = document.getElementById('modelNameK');

const severityCard = document.getElementById('severityCard');
const sevBadge = document.getElementById('sevBadge');
const sevTitle = document.getElementById('sevTitle');
const sevDetail = document.getElementById('sevDetail');
const tableBody = document.querySelector('#resultTable tbody');

document.getElementById("age").addEventListener("input", function () {
  let value = parseInt(this.value, 10);
  if (value < 1) this.value = 1;
  if (value > 100) this.value = 100;
});

/* ====== Helpers ====== */
function setStatus(text, level=''){
  statusLine.textContent = text;
  statusLine.style.color = level==='ok' ? '#1e8d6d' : level==='warn' ? '#d7891f' : level==='danger' ? '#c53939' : 'var(--muted)';
}
function debounce(fn, wait=350){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; }
function groupFromAge(a){ if (a<13) return 'child'; if (a<60) return 'adult'; return 'elder'; }
function updateCounters(){
  selCount.textContent = `${selected.size} selected`;
  symCountK.textContent = selected.size;
  const g = Number(ageEl.value||0); const grp = groupFromAge(g);
  ageGroupK.textContent = grp.charAt(0).toUpperCase()+grp.slice(1);
  modelNameK.textContent = grp==='child'?'Pediatrics':(grp==='adult'?'General Medicine':'Geriatrics');
}

// Client-side category tagging (UX only)
function tagCat(sym){
  const s = sym.toLowerCase();
  if (/(fever|pyrex|inflammation|chills)/.test(s)) return 'fever';
  if (/(cough|breath|wheeze|sputum|throat|nose|cold|congestion)/.test(s)) return 'resp';
  if (/(nausea|vomit|diarrhea|abdomen|stomach|constipation|gastric|appetite)/.test(s)) return 'gi';
  if (/(headache|dizziness|seizure|confusion|syncope|tingling|numb)/.test(s)) return 'neuro';
  if (/(pain|ache|fatigue|weakness|malaise|cramp)/.test(s)) return 'pain';
  if (/(rash|itch|lesion|skin|eruption|hive)/.test(s)) return 'skin';
  return 'general';
}

function renderSymptoms(list){
  symBox.innerHTML = '';
  list.slice(0,40).forEach(sym=>{
    const row = document.createElement('label');
    row.className = 'sym';
    const cb = document.createElement('input'); cb.type='checkbox'; cb.value=sym; cb.checked = selected.has(sym);
    cb.onchange = (e)=>{ if(e.target.checked) selected.add(sym); else selected.delete(sym); updateCounters(); };
    const t = document.createElement('span'); t.textContent = sym;
    row.appendChild(cb); row.appendChild(t);
    symBox.appendChild(row);
  });
}

function applyFilters(){
  const q = symSearch.value.trim().toLowerCase();
  const active = categories.querySelector('[aria-pressed="true"]')?.dataset.cat || 'all';
  filteredSymptoms = allSymptoms.filter(s=>{
    const textOK = !q || s.toLowerCase().includes(q);
    const catOK  = active==='all' || tagCat(s)===active;
    return textOK && catOK;
  });
  renderSymptoms(filteredSymptoms);
}

function severityFromPercent(p){
  if (p >= 70) return {label:'Severe', cls:'sev-severe'};
  if (p >= 40) return {label:'Moderate', cls:'sev-moderate'};
  return {label:'Mild', cls:'sev-mild'};
}
function updateSeverity(top){
  if (!top){ severityCard.style.display='none'; return; }
  const sev = severityFromPercent(top.probability);
  severityCard.style.display = 'flex';
  sevBadge.textContent = sev.label;
  sevBadge.className = 'sev-badge ' + sev.cls;
  sevTitle.textContent = `Top Disease: ${top.disease}`;
  sevDetail.textContent = `Probability: ${top.probability.toFixed(2)}%`;
}

function renderTable(top){
  tableBody.innerHTML = '';
  top.forEach((row, i)=>{
    const tr = document.createElement('tr');
    if (i===0) tr.classList.add('highlight');
    tr.innerHTML = `<td>${row.disease}</td><td>${row.probability.toFixed(2)}%</td>`;
    tableBody.appendChild(tr);
  });
}

function renderChart(top){
  if (donut) donut.destroy();
  const labels = top.map(x=>x.disease);
  const values = top.map(x=>x.probability);
  const colors = labels.map((_,i)=> palette[i % palette.length]);
  const ctx = document.getElementById('donutChart').getContext('2d');
  donut = new Chart(ctx, {
    type:'doughnut',
    data:{ labels, datasets:[{ data:values, backgroundColor:colors }] },
    options:{
      responsive:true, maintainAspectRatio:false,
      animation:{ animateRotate:true, animateScale:true, duration:900 },
      plugins:{ legend:{ display:true, position:'bottom' },
        tooltip:{ callbacks:{ label:(c)=> `${c.label}: ${c.parsed}%` } } },
      cutout:'58%'
    }
  });
}

/* ====== API ====== */
async function fetchSymptomsByAge(age){
  setStatus('Fetching symptoms…');
  try{
    const res = await fetch(`/get_symptoms?age=${age}`);
    const data = await res.json();
    if (data.symptoms && data.symptoms.length){
      allSymptoms = data.symptoms.slice();
      selected.clear();
      applyFilters();
      updateCounters();
      setStatus(`Loaded ${allSymptoms.length} symptoms.`, 'ok');
    }else{
      allSymptoms = [];
      symBox.innerHTML = '<div class="sub" style="color:var(--muted)">No symptoms available for this age.</div>';
      setStatus('No symptoms found.', 'warn');
    }
  }catch(e){
    console.error(e);
    setStatus('Error fetching symptoms.', 'danger');
  }
}

// UPDATED: consumes { top_prediction, other_predictions }, shows only 4 others, and renders top description
async function requestPrediction(){
  const age = Number(ageEl.value);
  if ((!age && age !== 0) || isNaN(age)){ setStatus('Enter a valid age.', 'warn'); return; }
  if (!allSymptoms.length){ setStatus('Load symptoms by entering age first.', 'warn'); return; }
  if (selected.size===0){ setStatus('Select at least one symptom.', 'warn'); return; }

  setStatus('Predicting…');
  try{
    const res = await fetch('/predict', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ age, symptoms: Array.from(selected) })
    });
    const data = await res.json();
    if (data.error){ setStatus(data.error, 'danger'); return; }

    const top = data.top_prediction;
    const others = (data.other_predictions || []).slice(0,4);

    // Update severity UI
    updateSeverity(top);

    // Insert top disease description
    const descBox = document.getElementById('diseaseDescription');
    if (descBox){
      descBox.innerHTML = top && top.description
        ? `<p style="margin:8px 0; font-size:.95rem; line-height:1.4;">${top.description}</p>`
        : '';
      pdfBtn.style.display = "inline-block";
    }

    // Render table and chart
    renderTable(others);
    renderChart([top, ...others]);

    // NEW: Update Care Guidance
    updateCareGuidance(top);
    updateRecoverySection(top, age);

    setStatus('', '');
  }catch(e){
    console.error(e);
    setStatus('Prediction failed.', 'danger');
  }
}

function updateCareGuidance(top){
  const careSection = document.getElementById("care-guidance");
  const remediesBtn = document.getElementById("remedies-btn");
  const suggestionBtn = document.getElementById("suggestion-btn");
  const careOutput = document.getElementById("care-output");

  if(!top || !top.disease){ careSection.style.display = "none"; return; }

  careSection.style.display = "block";
  careOutput.style.display = "none"; // always hide at first

  const severity = (top.severity || "mild").toLowerCase();
  const remedies = top.remedies || [];
  const suggestion = top.suggestion || "No suggestion available.";

  if(severity === "mild" || severity === "moderate"){
    remediesBtn.style.display = "inline-block";
    suggestionBtn.style.display = "inline-block";
  }else{
    remediesBtn.style.display = "none";
    suggestionBtn.style.display = "inline-block";
  }

  remediesBtn.onclick = () => {
    if(remedies.length){
      careOutput.innerHTML =`<ol style= "font-weight: 600;">${remedies.map(r=>`<li>${r}</li>`).join('')}</ol>`;
    }else{
      careOutput.innerHTML = `<em>No home remedies available.</em>`;
    }
    careOutput.style.display = "block"; // show when clicked
  };

  suggestionBtn.onclick = () => {
    careOutput.innerHTML = `<p style="font-weight: 600;">${suggestion}</p>`;
    careOutput.style.display = "block"; // show when clicked
  };
}
let recoveryData = null;

// Load recovery JSON from Flask route
async function loadRecoveryData(){
  if(!recoveryData){
    try{
      const res = await fetch("/get_recovery"); // Flask must serve this
      recoveryData = await res.json();
    }catch(e){
      console.error("Failed to load recovery data", e);
    }
  }
  return recoveryData;
}
function updateRecoverySection(top, age){
  const card = document.getElementById("recovery-card");
  const btn = document.getElementById("recoveryBtn");
  const out = document.getElementById("recoveryOutput");

  if(!top || !top.disease){
    card.style.display="none";
    return;
  }

  card.style.display = "block";   // 👈 makes the button visible
  out.style.display = "none";

  btn.onclick = async () =>{
    const data = await loadRecoveryData();
    const grp = groupFromAge(age).charAt(0).toUpperCase()+groupFromAge(age).slice(1);
    const sev = (top.severity || "mild").toLowerCase();

    try{
      const rec = data[grp][top.disease][sev].recovery;
      out.innerHTML = `
      <p style="margin:6px 0; font-size:1rem; line-height:1.6; font-weight:500; color:#0c2d3d;">
        For <strong>${top.disease}</strong> in a
        <strong>${grp}</strong> patient with
        <strong>${sev.charAt(0).toUpperCase() + sev.slice(1)}</strong> severity,
        the expected recovery period is typically
        <strong style="color:#1e8d6d;">${rec.min_days} to ${rec.max_days} days</strong>.
      </p>
    `;
    }catch(err){
      out.textContent = "Recovery info not available.";
    }
    out.style.display = "block";
  };
}

/* ====== Events ====== */
function onAgeInput(){
  const a = Number(ageEl.value||0);
  if ((!a && a!==0) || isNaN(a)) return;
  fetchSymptomsByAge(a);
  updateCounters();
}
ageEl.addEventListener('input', debounce(onAgeInput, 350));
symSearch.addEventListener('input', applyFilters);

categories.addEventListener('click', (e)=>{
  if (!e.target.classList.contains('chip')) return;
  [...categories.querySelectorAll('.chip')].forEach(b=> b.setAttribute('aria-pressed','false'));
  e.target.setAttribute('aria-pressed','true');
  applyFilters();
});

predictBtn.addEventListener('click', requestPrediction);
resetBtn.addEventListener('click', () => {
  // Clear selected symptoms
  selected.clear();
  symBox.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
  updateCounters();

  // Reset status line
  setStatus('', '');

  // Clear disease description
  const descBox = document.getElementById('diseaseDescription');
  if (descBox) descBox.innerHTML = '';

  // Hide severity card
  const severityCard = document.getElementById('severityCard');
  severityCard.style.display = "none";

  // Reset summary metrics
  document.getElementById('ageGroupK').textContent = '—';
  document.getElementById('symCountK').textContent = '0';
  document.getElementById('modelNameK').textContent = '—';

  // Reset results table
  const tableBody = document.querySelector('#resultTable tbody');
  tableBody.innerHTML = '<tr><td colspan="2" class="sub" style="color:var(--muted)">No results yet.</td></tr>';

  // Destroy or clear the chart
  if (donut) {
    donut.destroy();
    donut = null;
  }
  const chartCanvas = document.getElementById('donutChart');
  const ctx = chartCanvas.getContext('2d');
  ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);

  // Hide Care Guidance section
  const careSection = document.getElementById("care-guidance");
  if (careSection) careSection.style.display = "none";

  // Hide Recovery section
  const recoveryCard = document.getElementById("recovery-card");
  if (recoveryCard) recoveryCard.style.display = "none";

  // Hide PDF button again
  pdfBtn.style.display = "none";
});

pdfBtn.addEventListener('click', ()=> window.print());
