/* =====================================================================
   Bills — GST Invoice & Quotation Maker
   Plain JS, no build step. Invoice data lives only in localStorage on
   each person's own device; nothing is sent to a server except the
   sign-in itself, which is handled entirely by Firebase.
   ===================================================================== */

/* ---------------------------------------------------------------- */
/* SIGN-IN (Firebase Authentication — email/password + Google)        */
/* Fill in FIREBASE_CONFIG with the values from your own Firebase     */
/* project (Project settings → General → Your apps → SDK setup).     */
/* These values are safe to expose publicly — Firebase is designed    */
/* for this config to be public; access is controlled in the         */
/* Firebase console, not by hiding this object.                      */
/* ---------------------------------------------------------------- */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDrqC9cvjfbO8xSiLaJWr8ZBL23icxKOZU",
  authDomain: "billing-applicationn.firebaseapp.com",
  projectId: "billing-applicationn",
  storageBucket: "billing-applicationn.firebasestorage.app",
  messagingSenderId: "578956932936",
  appId: "1:578956932936:web:d5b720b880939fd4ada57d"
};

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();

let authMode = "signin"; // or "signup"

function friendlyAuthError(e){
  const map = {
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/user-not-found": "No account with that email — try signing up instead.",
    "auth/email-already-in-use": "An account already exists with that email — try signing in instead.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/invalid-email": "That doesn't look like a valid email address.",
    "auth/popup-closed-by-user": "Google sign-in was closed before finishing.",
    "auth/configuration-not-found": "Sign-in isn't set up yet — the site owner needs to add their Firebase config."
  };
  return map[e.code] || e.message;
}

function initAuth(){
  const screen = document.getElementById("lockScreen");
  const emailInput = document.getElementById("authEmail");
  const passwordInput = document.getElementById("authPassword");
  const submitBtn = document.getElementById("authSubmit");
  const googleBtn = document.getElementById("googleSignIn");
  const toggleLink = document.getElementById("authToggleLink");
  const toggleText = document.getElementById("authToggleText");
  const tagline = document.getElementById("authTagline");
  const error = document.getElementById("lockError");

  function setMode(mode){
    authMode = mode;
    submitBtn.textContent = mode === "signin" ? "Sign in" : "Create account";
    tagline.textContent = mode === "signin" ? "Sign in to continue" : "Create your account";
    toggleText.textContent = mode === "signin" ? "Don't have an account?" : "Already have an account?";
    toggleLink.textContent = mode === "signin" ? "Sign up" : "Sign in";
    error.hidden = true;
  }
  setMode("signin");

  toggleLink.addEventListener("click", e=>{
    e.preventDefault();
    setMode(authMode === "signin" ? "signup" : "signin");
  });

  const submitAuth = async ()=>{
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    error.hidden = true;
    if(!email || !password){
      error.textContent = "Enter both email and password.";
      error.hidden = false;
      return;
    }
    submitBtn.disabled = true;
    try{
      if(authMode === "signin"){
        await auth.signInWithEmailAndPassword(email, password);
      }else{
        await auth.createUserWithEmailAndPassword(email, password);
      }
    }catch(e){
      error.textContent = friendlyAuthError(e);
      error.hidden = false;
    }finally{
      submitBtn.disabled = false;
    }
  };

  submitBtn.addEventListener("click", submitAuth);
  passwordInput.addEventListener("keydown", e=>{ if(e.key === "Enter") submitAuth(); });

  googleBtn.addEventListener("click", ()=>{
    error.hidden = true;
    googleBtn.disabled = true;
    googleBtn.textContent = "Redirecting to Google…";
    auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider());
  });

  // Catches errors from the redirect flow above once Google sends the
  // browser back to this page (e.g. wrong config, unauthorized domain).
  auth.getRedirectResult().catch(e=>{
    error.textContent = friendlyAuthError(e);
    error.hidden = false;
    googleBtn.disabled = false;
    googleBtn.textContent = "Continue with Google";
  });

  auth.onAuthStateChanged(user=>{
    if(user){
      screen.hidden = true;
      showUserBadge(user);
    }else{
      screen.hidden = false;
      hideUserBadge();
    }
  });
}

function showUserBadge(user){
  const badge = document.getElementById("userBadge");
  document.getElementById("userBadgeEmail").textContent = user.email || "Signed in";
  badge.hidden = false;
}
function hideUserBadge(){
  document.getElementById("userBadge").hidden = true;
}

document.addEventListener("DOMContentLoaded", ()=>{
  initAuth();
  document.getElementById("signOutBtn").addEventListener("click", ()=> auth.signOut());
});

const INDIAN_STATES = [
  ["Andhra Pradesh","37"],["Arunachal Pradesh","12"],["Assam","18"],["Bihar","10"],
  ["Chhattisgarh","22"],["Delhi","07"],["Goa","30"],["Gujarat","24"],["Haryana","06"],
  ["Himachal Pradesh","02"],["Jharkhand","20"],["Karnataka","29"],["Kerala","32"],
  ["Madhya Pradesh","23"],["Maharashtra","27"],["Manipur","14"],["Meghalaya","17"],
  ["Mizoram","15"],["Nagaland","13"],["Odisha","21"],["Punjab","03"],["Rajasthan","08"],
  ["Sikkim","11"],["Tamil Nadu","33"],["Telangana","36"],["Tripura","16"],
  ["Uttar Pradesh","09"],["Uttarakhand","05"],["West Bengal","19"],
  ["Andaman and Nicobar Islands","35"],["Chandigarh","04"],
  ["Dadra and Nagar Haveli and Daman and Diu","26"],["Jammu and Kashmir","01"],
  ["Ladakh","38"],["Lakshadweep","31"],["Puducherry","34"]
];

const GST_SLABS = [0, 0.25, 3, 5, 12, 18, 28];

const state = {
  docType: "invoice",
  items: [],
};

let itemSeq = 0;
function newItem(){
  itemSeq += 1;
  return { id: itemSeq, name:"", hsn:"", qty:1, rate:0, gst:18 };
}

/* ---------------------------------------------------------------- */
/* INIT                                                              */
/* ---------------------------------------------------------------- */
function init(){
  populateStateDropdowns();
  state.items = [newItem()];
  renderItemEditors();
  bindStaticEvents();
  document.getElementById("docDate").valueAsDate = new Date();
  const due = new Date(); due.setDate(due.getDate() + 15);
  document.getElementById("dueDate").valueAsDate = due;
  render();
}

function populateStateDropdowns(){
  const sellerSel = document.getElementById("sellerState");
  const buyerSel = document.getElementById("buyerState");
  INDIAN_STATES.forEach(([name, code]) => {
    const o1 = document.createElement("option");
    o1.value = name; o1.textContent = `${code} — ${name}`;
    sellerSel.appendChild(o1);
    const o2 = document.createElement("option");
    o2.value = name; o2.textContent = `${code} — ${name}`;
    buyerSel.appendChild(o2);
  });
  sellerSel.value = "Maharashtra";
  buyerSel.value = "Karnataka";
}

function bindStaticEvents(){
  document.querySelectorAll(".doc-toggle__btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".doc-toggle__btn").forEach(b=>b.classList.remove("is-active"));
      btn.classList.add("is-active");
      state.docType = btn.dataset.doctype;
      updateDocTypeLabels();
      render();
    });
  });

  document.getElementById("panel__scroll")?.addEventListener("input", render);
  document.getElementById("addItem").addEventListener("click", ()=>{
    state.items.push(newItem());
    renderItemEditors();
    render();
  });

  document.getElementById("sellerLogo").addEventListener("change", handleLogoUpload);
  document.getElementById("downloadPdf").addEventListener("click", downloadPdf);
  document.getElementById("saveTemplate").addEventListener("click", saveDraft);
  document.getElementById("loadTemplate").addEventListener("click", loadDraft);
  document.getElementById("sendEmail").addEventListener("click", sendViaEmail);
  document.getElementById("sendWhatsapp").addEventListener("click", sendViaWhatsapp);
  document.getElementById("copyLink").addEventListener("click", copySummary);

  // re-render on any input change anywhere in the panel
  document.querySelector(".panel").addEventListener("input", render);
  document.querySelector(".panel").addEventListener("change", render);
}

function updateDocTypeLabels(){
  const isInvoice = state.docType === "invoice";
  document.getElementById("numberLabel").textContent = isInvoice ? "Invoice no." : "Quotation no.";
  document.getElementById("dateLabel").textContent = isInvoice ? "Invoice date" : "Quotation date";
  document.getElementById("dueDateField").style.display = isInvoice ? "flex" : "none";
  document.getElementById("docNumber").placeholder = isInvoice ? "INV-2026-0001" : "QUO-2026-0001";
}

function handleLogoUpload(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = document.getElementById("logoPreview");
    img.src = ev.target.result;
    img.hidden = false;
    render();
  };
  reader.readAsDataURL(file);
}

/* ---------------------------------------------------------------- */
/* ITEM EDITOR (left panel rows)                                     */
/* ---------------------------------------------------------------- */
function renderItemEditors(){
  const wrap = document.getElementById("itemsEditor");
  wrap.innerHTML = "";
  state.items.forEach((item, idx)=>{
    const row = document.createElement("div");
    row.className = "item-row";
    row.dataset.id = item.id;
    row.innerHTML = `
      <button type="button" class="item-row__remove" title="Remove line">✕</button>
      <div class="item-row__grid">
        <div class="item-row__desc">
          <span class="item-row__label">Description</span>
          <input type="text" class="f-name" placeholder="Item / service name" value="${escapeAttr(item.name)}">
        </div>
        <div>
          <span class="item-row__label">HSN/SAC</span>
          <input type="text" class="f-hsn" placeholder="e.g. 6109" value="${escapeAttr(item.hsn)}">
        </div>
        <div>
          <span class="item-row__label">GST rate</span>
          <select class="f-gst">
            ${GST_SLABS.map(g=>`<option value="${g}" ${g===item.gst?"selected":""}>${g}%</option>`).join("")}
          </select>
        </div>
        <div>
          <span class="item-row__label">Qty</span>
          <input type="number" class="f-qty" min="0" step="1" value="${item.qty}">
        </div>
        <div>
          <span class="item-row__label">Rate</span>
          <input type="number" class="f-rate" min="0" step="0.01" value="${item.rate}">
        </div>
      </div>
    `;
    wrap.appendChild(row);

    row.querySelector(".f-name").addEventListener("input", e=> item.name = e.target.value);
    row.querySelector(".f-hsn").addEventListener("input", e=> item.hsn = e.target.value);
    row.querySelector(".f-gst").addEventListener("change", e=> item.gst = parseFloat(e.target.value));
    row.querySelector(".f-qty").addEventListener("input", e=> item.qty = parseFloat(e.target.value)||0);
    row.querySelector(".f-rate").addEventListener("input", e=> item.rate = parseFloat(e.target.value)||0);
    row.querySelector(".item-row__remove").addEventListener("click", ()=>{
      state.items = state.items.filter(i=>i.id !== item.id);
      if(state.items.length===0) state.items.push(newItem());
      renderItemEditors();
      render();
    });
  });
}

function escapeAttr(str){
  return String(str||"").replace(/"/g,"&quot;");
}
function escapeHtml(str){
  return String(str||"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* Lightweight, non-cryptographic checksum used purely as a printed
   "verification ID" on the document — a quick way for a recipient to
   quote a code back to the issuer to confirm a document matches what
   they actually sent. This is NOT tamper-proof: anyone with the source
   can recompute it. It deters casual forgery, it doesn't prevent it. */
function simpleHash(str){
  let hash = 0;
  for(let i=0;i<str.length;i++){
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8,"0");
}

/* ---------------------------------------------------------------- */
/* CALCULATIONS                                                       */
/* ---------------------------------------------------------------- */
function currency(){ return document.getElementById("currency").value; }

function fmt(n){
  const v = isFinite(n) ? n : 0;
  return v.toLocaleString("en-IN", {minimumFractionDigits:2, maximumFractionDigits:2});
}

function computeTotals(){
  const items = state.items;
  const lineResults = items.map(it=>{
    const base = (it.qty||0) * (it.rate||0);
    const gstAmt = base * (it.gst||0) / 100;
    return { ...it, base, gstAmt };
  });

  const subtotal = lineResults.reduce((s,i)=>s+i.base,0);

  const discType = document.getElementById("discountType").value;
  const discInput = parseFloat(document.getElementById("globalDiscount").value)||0;
  const discount = discType === "pct" ? subtotal * discInput/100 : discInput;

  const taxableBase = Math.max(subtotal - discount, 0);
  // scale each line's tax proportionally to the discount applied
  const discountFactor = subtotal > 0 ? taxableBase/subtotal : 1;
  const totalGst = lineResults.reduce((s,i)=> s + i.gstAmt, 0) * discountFactor;

  const sameState = document.getElementById("sellerState").value === document.getElementById("buyerState").value;
  const cgst = sameState ? totalGst/2 : 0;
  const sgst = sameState ? totalGst/2 : 0;
  const igst = sameState ? 0 : totalGst;

  const shipping = parseFloat(document.getElementById("shipping").value)||0;
  const total = taxableBase + totalGst + shipping;

  return { lineResults, subtotal, discount, cgst, sgst, igst, totalGst, shipping, total, sameState, discountFactor };
}

/* number to words (Indian numbering) for the total amount */
const ONES = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten",
  "Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
const TENS = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];

function twoDigits(n){
  if(n<20) return ONES[n];
  return TENS[Math.floor(n/10)] + (n%10 ? " " + ONES[n%10] : "");
}
function threeDigits(n){
  if(n<100) return twoDigits(n);
  return ONES[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + twoDigits(n%100) : "");
}
function numberToWordsIndian(num){
  num = Math.round(num);
  if(num === 0) return "Zero";
  let str = "";
  const crore = Math.floor(num/10000000); num %= 10000000;
  const lakh = Math.floor(num/100000); num %= 100000;
  const thousand = Math.floor(num/1000); num %= 1000;
  const rest = num;
  if(crore) str += threeDigits(crore) + " Crore ";
  if(lakh) str += threeDigits(lakh) + " Lakh ";
  if(thousand) str += threeDigits(thousand) + " Thousand ";
  if(rest) str += threeDigits(rest);
  return str.trim();
}

/* ---------------------------------------------------------------- */
/* RENDER PREVIEW                                                     */
/* ---------------------------------------------------------------- */
function render(){
  const cur = currency();

  document.getElementById("pv-sellerName").textContent = document.getElementById("sellerName").value || "Your Business Name";
  document.getElementById("pv-sellerAddress").textContent = document.getElementById("sellerAddress").value || "Business address will appear here";

  const email = document.getElementById("sellerEmail").value;
  const phone = document.getElementById("sellerPhone").value;
  document.getElementById("pv-sellerContact").textContent = [email, phone].filter(Boolean).join("  ·  ");

  const sellerGstin = document.getElementById("sellerGstin").value;
  document.getElementById("pv-sellerGstin").textContent = sellerGstin ? `GSTIN: ${sellerGstin.toUpperCase()}` : "";

  const isInvoice = state.docType === "invoice";
  document.getElementById("pv-docTypeLabel").textContent = isInvoice ? "Tax Invoice" : "Quotation";
  document.getElementById("pv-docNumber").textContent = document.getElementById("docNumber").value || (isInvoice ? "INV-2026-0001" : "QUO-2026-0001");
  document.getElementById("pv-docDate").textContent = formatDate(document.getElementById("docDate").value);
  document.getElementById("pv-dueDateRow").hidden = !isInvoice;
  document.getElementById("pv-dueDate").textContent = formatDate(document.getElementById("dueDate").value);
  document.getElementById("draftStamp").textContent = isInvoice ? "DRAFT" : "QUOTE";

  document.getElementById("pv-buyerName").textContent = document.getElementById("buyerName").value || "Customer name";
  document.getElementById("pv-buyerAddress").textContent = document.getElementById("buyerAddress").value || "Customer address";
  const buyerGstin = document.getElementById("buyerGstin").value;
  document.getElementById("pv-buyerGstin").textContent = buyerGstin ? `GSTIN: ${buyerGstin.toUpperCase()}` : "";
  document.getElementById("pv-placeOfSupply").textContent = document.getElementById("buyerState").value || "—";

  const totals = computeTotals();
  document.getElementById("pv-taxNature").textContent = totals.sameState ? "Intra-state (CGST + SGST)" : "Inter-state (IGST)";

  const verifySource = [
    document.getElementById("sellerName").value,
    document.getElementById("buyerName").value,
    document.getElementById("docNumber").value,
    document.getElementById("docDate").value,
    totals.total.toFixed(2)
  ].join("|");
  document.getElementById("pv-verifyId").textContent = simpleHash(verifySource);

  // items table
  const tbody = document.getElementById("pv-items");
  tbody.innerHTML = "";
  totals.lineResults.forEach((it, idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td><div class="item-desc-name">${escapeHtml(it.name)||"—"}</div></td>
      <td>${escapeHtml(it.hsn)}</td>
      <td class="num">${it.qty||0}</td>
      <td class="num">${fmt(it.rate)}</td>
      <td class="num">${it.gst}%</td>
      <td class="num">${cur}${fmt(it.base)}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("pv-subtotal").textContent = `${cur}${fmt(totals.subtotal)}`;

  const discRow = document.getElementById("pv-discountRow");
  discRow.hidden = totals.discount <= 0;
  document.getElementById("pv-discount").textContent = `- ${cur}${fmt(totals.discount)}`;

  document.getElementById("pv-cgstRow").hidden = totals.cgst <= 0;
  document.getElementById("pv-cgst").textContent = `${cur}${fmt(totals.cgst)}`;
  document.getElementById("pv-sgstRow").hidden = totals.sgst <= 0;
  document.getElementById("pv-sgst").textContent = `${cur}${fmt(totals.sgst)}`;
  document.getElementById("pv-igstRow").hidden = totals.igst <= 0;
  document.getElementById("pv-igst").textContent = `${cur}${fmt(totals.igst)}`;

  document.getElementById("pv-shippingRow").hidden = totals.shipping <= 0;
  document.getElementById("pv-shipping").textContent = `${cur}${fmt(totals.shipping)}`;

  document.getElementById("pv-total").textContent = `${cur}${fmt(totals.total)}`;
  document.getElementById("pv-amountWords").textContent = cur === "₹"
    ? `Rupees ${numberToWordsIndian(totals.total)} Only`
    : `${numberToWordsIndian(totals.total)} Only`;

  const notes = document.getElementById("notes").value;
  document.getElementById("pv-notesBlock").hidden = !notes;
  document.getElementById("pv-notes").textContent = notes;

  const bank = document.getElementById("bankDetails").value;
  document.getElementById("pv-bankBlock").hidden = !bank;
  document.getElementById("pv-bankDetails").textContent = bank;

  const terms = document.getElementById("terms").value;
  document.getElementById("pv-termsBlock").hidden = !terms;
  document.getElementById("pv-terms").textContent = terms;
}

function formatDate(iso){
  if(!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if(isNaN(d)) return "—";
  return d.toLocaleDateString("en-IN", {day:"2-digit", month:"short", year:"numeric"});
}

/* ---------------------------------------------------------------- */
/* SAVE / LOAD DRAFT (localStorage)                                   */
/* ---------------------------------------------------------------- */
const FIELD_IDS = [
  "sellerName","sellerAddress","sellerGstin","sellerState","sellerEmail","sellerPhone",
  "buyerName","buyerAddress","buyerGstin","buyerState",
  "docNumber","docDate","dueDate","currency",
  "globalDiscount","discountType","shipping","notes","terms","bankDetails"
];

function saveDraft(){
  const data = { docType: state.docType, items: state.items, fields: {} };
  FIELD_IDS.forEach(id=>{
    data.fields[id] = document.getElementById(id).value;
  });
  const logo = document.getElementById("logoPreview");
  data.logo = logo.hidden ? null : logo.src;

  try{
    localStorage.setItem("bills_draft_v1", JSON.stringify(data));
    flashButton("saveTemplate", "Saved ✓");
  }catch(e){
    alert("Could not save draft: " + e.message);
  }
}

function loadDraft(){
  const raw = localStorage.getItem("bills_draft_v1");
  if(!raw){ flashButton("loadTemplate", "No draft found"); return; }
  const data = JSON.parse(raw);

  state.docType = data.docType || "invoice";
  document.querySelectorAll(".doc-toggle__btn").forEach(b=>{
    b.classList.toggle("is-active", b.dataset.doctype === state.docType);
  });
  updateDocTypeLabels();

  FIELD_IDS.forEach(id=>{
    if(data.fields[id] !== undefined) document.getElementById(id).value = data.fields[id];
  });

  if(data.logo){
    const img = document.getElementById("logoPreview");
    img.src = data.logo; img.hidden = false;
  }

  state.items = (data.items && data.items.length) ? data.items : [newItem()];
  itemSeq = Math.max(0, ...state.items.map(i=>i.id||0));
  renderItemEditors();
  render();
  flashButton("loadTemplate", "Loaded ✓");
}

function flashButton(id, msg){
  const btn = document.getElementById(id);
  const original = btn.textContent;
  btn.textContent = msg;
  setTimeout(()=> btn.textContent = original, 1400);
}

/* ---------------------------------------------------------------- */
/* PDF EXPORT                                                         */
/* ---------------------------------------------------------------- */
async function downloadPdf(){
  const btn = document.getElementById("downloadPdf");
  const original = btn.textContent;
  btn.textContent = "Generating…";
  btn.disabled = true;

  try{
    const paper = document.getElementById("paper");
    const canvas = await html2canvas(paper, { scale: 2, backgroundColor: "#FBF7EE", useCORS: true });
    const imgData = canvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit:"pt", format:"a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = canvas.height * (imgWidth / canvas.width);

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while(heightLeft > 0){
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const docNo = document.getElementById("docNumber").value || (state.docType==="invoice"?"invoice":"quotation");
    pdf.save(`${docNo.replace(/[^a-z0-9-_]/gi,"_")}.pdf`);
  }catch(e){
    alert("Could not generate PDF: " + e.message);
  }finally{
    btn.textContent = original;
    btn.disabled = false;
  }
}

/* ---------------------------------------------------------------- */
/* SEND: email / whatsapp / copy summary                              */
/* ---------------------------------------------------------------- */
function buildGreeting(){
  const buyerName = document.getElementById("buyerName").value.trim();
  return buyerName ? `Hi ${buyerName},` : "Hi,";
}

function buildSummaryText(){
  const cur = currency();
  const totals = computeTotals();
  const isInvoice = state.docType === "invoice";
  const docLabel = isInvoice ? "Invoice" : "Quotation";
  const docNo = document.getElementById("docNumber").value || (isInvoice ? "INV-2026-0001" : "QUO-2026-0001");
  const sellerName = document.getElementById("sellerName").value || "Our business";
  const buyerName = document.getElementById("buyerName").value || "Customer";
  const date = formatDate(document.getElementById("docDate").value);

  let lines = [];
  lines.push(`${docLabel} ${docNo} from ${sellerName}`);
  lines.push(`Date: ${date}`);
  lines.push(`To: ${buyerName}`);
  lines.push("");
  totals.lineResults.forEach((it, idx)=>{
    if(!it.name) return;
    lines.push(`${idx+1}. ${it.name} — Qty ${it.qty||0} x ${cur}${fmt(it.rate)} = ${cur}${fmt(it.base)}`);
  });
  lines.push("");
  lines.push(`Total: ${cur}${fmt(totals.total)}`);
  return lines.join("\n");
}

function sendViaEmail(){
  const to = document.getElementById("sendToEmail").value.trim();
  const isInvoice = state.docType === "invoice";
  const docNo = document.getElementById("docNumber").value || (isInvoice ? "INV-2026-0001" : "QUO-2026-0001");
  const sellerName = document.getElementById("sellerName").value || "our business";
  const subject = `${isInvoice ? "Invoice" : "Quotation"} ${docNo} from ${sellerName}`;
  const body = `${buildGreeting()}\n\n${buildSummaryText()}\n\n(Full ${isInvoice ? "invoice" : "quotation"} PDF is attached — this download starts now, just drag it into this email.)\n\nThank you,\n${sellerName}`;

  // Kick off the PDF download first so it's ready to drag into the email client.
  downloadPdf();

  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
}

function sendViaWhatsapp(){
  const sellerName = document.getElementById("sellerName").value || "our business";
  const text = `${buildGreeting()}\n\n${buildSummaryText()}\n\n(PDF downloading separately — I'll attach it here.)\n\nThank you,\n${sellerName}`;
  downloadPdf();

  const rawPhone = document.getElementById("sendToPhone").value.trim().replace(/[^0-9]/g, "");
  const url = rawPhone
    ? `https://wa.me/${rawPhone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener");
}

async function copySummary(){
  const text = `${buildGreeting()}\n\n${buildSummaryText()}`;
  try{
    await navigator.clipboard.writeText(text);
    flashButton("copyLink", "Copied ✓");
  }catch(e){
    // fallback for browsers without clipboard API permission
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    flashButton("copyLink", "Copied ✓");
  }
}

document.addEventListener("DOMContentLoaded", init);
