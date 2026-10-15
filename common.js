/* TONMOY Topup — shared helpers + auth (loaded on every page).
   Same-origin /api/* calls only. No secrets in this file. */

const TOKEN_KEY = "topupbd_token";

let authToken = localStorage.getItem(TOKEN_KEY) || null;
let account = null; // {name, phone, balance} after login

const $ = (id) => document.getElementById(id);

// Bangla digits for display
const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const bn = (n) => String(n).replace(/\d/g, (d) => BN_DIGITS[d]);
const taka = (n) => "৳" + bn(n);

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fmtDateBn(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("bn-BD", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch (e) { return ""; }
}

const ERROR_BN = {
  login_required: "অর্ডার করতে লগইন করুন।",
  invalid_phone: "সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)।",
  invalid_sender_number: "টাকা পাঠানোর সঠিক নম্বর দিন।",
  invalid_uid: "সঠিক Player ID দিন (৬-২০ অক্ষর/সংখ্যা)।",
  password_too_short: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।",
  name_required: "আপনার নাম লিখুন।",
  phone_exists: "এই নম্বরে ইতিমধ্যে অ্যাকাউন্ট আছে — লগইন করুন।",
  invalid_credentials: "মোবাইল নম্বর বা পাসওয়ার্ড ভুল হয়েছে।",
  invalid_trxid: "সঠিক Transaction ID দিন (টাকা পাঠানোর পর পাওয়া কোড)।",
  invalid_payment_method: "পেমেন্ট মাধ্যম বেছে নিন।",
  invalid_items: "প্যাকেজ বাছাইয়ে সমস্যা — আবার চেষ্টা করুন।",
  insufficient_balance: "ব্যালেন্স কম আছে — Add Money করে ব্যালেন্স যোগ করুন।",
  invalid_amount: "সঠিক টাকার পরিমাণ দিন (৳১০ – ৳১,০০,০০০)।",
  network: "নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।",
};

const PAYMENT_BN = { bkash: "বিকাশ", nagad: "নগদ", qr: "বাংলা QR", wallet: "ওয়ালেট" };
const PAY_COLORS = { bkash: "#e2136e", nagad: "#f6921e", qr: "#d42a1e" };
const SHOP_PAY_NUMBER = "01902461583";
const SHOP_WHATSAPP = "https://wa.me/8801401328940";
const SHOP_EMAIL = "mdtonmoyhossen327@gmail.com";

const PAY_STEPS = {
  bkash: [
    "*247# ডায়াল করুন অথবা বিকাশ অ্যাপে যান",
    '"Send Money" সিলেক্ট করুন',
    "উপরের নম্বরে টাকা পাঠান",
    "PIN দিয়ে কনফার্ম করুন",
    "TrxID টি কপি করে নিচের ফর্মে দিন",
  ],
  nagad: [
    "*167# ডায়াল করুন অথবা নগদ অ্যাপে যান",
    '"Send Money" সিলেক্ট করুন',
    "উপরের নম্বরে টাকা পাঠান",
    "PIN দিয়ে কনফার্ম করুন",
    "TrxID টি কপি করে নিচের ফর্মে দিন",
  ],
  qr: [
    "বিকাশ/নগদ/রকেট অ্যাপে QR স্ক্যানার খুলুন",
    "মার্চেন্ট QR কোডটি স্ক্যান করুন",
    "টাকার পরিমাণ দিয়ে পেমেন্ট করুন",
    "TrxID টি কপি করে নিচের ফর্মে দিন",
  ],
};

const STATUS_BN = { pending: "অপেক্ষমাণ", confirmed: "কনফার্মড", delivered: "ডেলিভার্ড", cancelled: "বাতিল" };
const TOPUP_STATUS_BN = { pending: "অপেক্ষমাণ", approved: "✅ অনুমোদিত", rejected: "❌ বাতিল" };

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = "Bearer " + authToken;
  const res = await fetch(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON */ }
  return { status: res.status, data };
}

/* ---------------- Auth ---------------- */
let afterLoginGo = null; // optional redirect after login

function openAuth(note) {
  if (note) { const n = $("auth-note"); if (n) n.textContent = note; }
  const m = $("auth-modal");
  if (m) m.classList.remove("hidden");
}

function closeAuth() {
  const m = $("auth-modal");
  if (m) m.classList.add("hidden");
}

function renderAuthState() {
  const loggedIn = !!authToken;
  const loginBtn = $("login-btn"), logoutBtn = $("logout-btn");
  const userChip = $("user-chip"), balChip = $("balance-chip");
  const acctLink = $("account-link");
  if (loginBtn) loginBtn.classList.toggle("hidden", loggedIn);
  if (logoutBtn) logoutBtn.classList.toggle("hidden", !loggedIn);
  if (userChip) userChip.classList.toggle("hidden", !loggedIn);
  if (balChip) balChip.classList.toggle("hidden", !loggedIn);
  if (acctLink) acctLink.classList.toggle("hidden", !loggedIn);
  if (loggedIn && account) {
    if (userChip) userChip.textContent = "👤 " + account.name;
    if (balChip) balChip.textContent = "💰 " + taka(account.balance || 0);
  }
}

function setBalance(b) {
  if (account) account.balance = b;
  renderAuthState();
}

async function doAuth(path, body) {
  const errEl = $("auth-error");
  if (errEl) errEl.textContent = "";
  try {
    const { status, data } = await api(path, { method: "POST", body: JSON.stringify(body) });
    if ((status === 200 || status === 201) && data && data.ok) {
      authToken = data.token;
      localStorage.setItem(TOKEN_KEY, authToken);
      account = { name: data.name, phone: data.phone, balance: data.balance || 0 };
      closeAuth();
      renderAuthState();
      if (afterLoginGo) { const go = afterLoginGo; afterLoginGo = null; location.href = go; }
      else if (typeof onLoginSuccess === "function") onLoginSuccess();
    } else if (errEl) {
      errEl.textContent = ERROR_BN[(data && data.error)] || ERROR_BN.network;
    }
  } catch (e) {
    if (errEl) errEl.textContent = ERROR_BN.network;
  }
}

function wireAuth() {
  const modal = $("auth-modal");
  if (!modal) return;
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.classList.contains("modal-close")) closeAuth();
  });
  const showLogin = $("show-login"), showSignup = $("show-signup");
  const loginForm = $("login-form"), signupForm = $("signup-form");
  if (showLogin) showLogin.onclick = () => {
    loginForm.classList.remove("hidden"); signupForm.classList.add("hidden");
    showLogin.classList.add("active"); showSignup.classList.remove("active");
  };
  if (showSignup) showSignup.onclick = () => {
    signupForm.classList.remove("hidden"); loginForm.classList.add("hidden");
    showSignup.classList.add("active"); showLogin.classList.remove("active");
  };
  if (loginForm) loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    doAuth("/api/auth/login", {
      phone: $("login-phone").value.trim(),
      password: $("login-password").value,
    });
  });
  if (signupForm) signupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    doAuth("/api/auth/signup", {
      name: $("signup-name").value.trim(),
      phone: $("signup-phone").value.trim(),
      password: $("signup-password").value,
    });
  });
  const loginBtn = $("login-btn");
  if (loginBtn) loginBtn.onclick = () => openAuth();
  const logoutBtn = $("logout-btn");
  if (logoutBtn) logoutBtn.onclick = async () => {
    try { await api("/api/auth/logout", { method: "POST" }); } catch (e) {}
    authToken = null; account = null;
    localStorage.removeItem(TOKEN_KEY);
    renderAuthState();
    if (typeof onLogout === "function") onLogout();
  };
}

async function restoreSession() {
  if (!authToken) { renderAuthState(); return; }
  try {
    const { status, data } = await api("/api/auth/me");
    if (status === 200 && data && data.ok) {
      account = { name: data.name, phone: data.phone, balance: data.balance || 0 };
    } else {
      authToken = null; account = null;
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (e) {
    authToken = null; account = null;
    localStorage.removeItem(TOKEN_KEY);
  }
  renderAuthState();
}

/* ---------------- Shared page chrome ---------------- */
function wireHelpBubble() {
  const b = $("help-bubble");
  if (b) b.href = SHOP_WHATSAPP;
}

function dismissNotice() {
  const n = $("notice-bar");
  if (n) n.style.display = "none";
  try { localStorage.setItem("topupbd_notice_hide", "1"); } catch (e) {}
}

function maybeHideNotice() {
  try {
    if (localStorage.getItem("topupbd_notice_hide") === "1") {
      const n = $("notice-bar");
      if (n) n.style.display = "none";
    }
  } catch (e) {}
}
