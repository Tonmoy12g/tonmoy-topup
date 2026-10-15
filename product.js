/* TONMOY Topup — product detail wizard (package → UID → wallet pay). */

let products = [];
let selected = null;

function isDiamondId(id) { return /diamond/i.test(id); }
function isMembershipId(id) { return /weekly|monthly/i.test(id); }

function categoryOf(p) {
  if (isDiamondId(p.id)) return "diamond";
  if (isMembershipId(p.id)) return "member";
  return "other";
}

function pkgLabel(p) {
  return isDiamondId(p.id) ? "💎 " + bn(p.diamonds) + " Diamond" : "🎫 " + p.name;
}

function renderPackages() {
  const box = $("pkg-list");
  if (!selected) return;
  const cat = categoryOf(selected);
  const list = products.filter((p) => categoryOf(p) === cat);
  box.innerHTML = list.map((p) =>
    `<button type="button" class="pkg-pill${p.id === selected.id ? " sel" : ""}" data-id="${escapeHtml(p.id)}">` +
    `<span>${escapeHtml(pkgLabel(p))}</span><b>${taka(p.price)}</b></button>`
  ).join("");
  box.querySelectorAll(".pkg-pill").forEach((b) => {
    b.onclick = () => {
      selected = products.find((p) => p.id === b.dataset.id);
      renderPackages();
      updateNeed();
    };
  });
}

function updateNeed() {
  if (!selected) return;
  $("p-need").textContent = taka(selected.price);
  $("p-balance").textContent = taka(account ? account.balance || 0 : 0);
  document.title = selected.name + " — TONMOY Topup";
}

function renderHeader() {
  if (!selected) return;
  $("p-img").src = selected.image;
  $("p-img").alt = selected.name;
  $("p-name").textContent = categoryOf(selected) === "diamond" ? "💎 Free Fire Diamond Topup" : "🎫 " + selected.name;
}

async function submitBuy() {
  const errEl = $("p-error");
  errEl.textContent = "";
  if (!selected) { errEl.textContent = ERROR_BN.invalid_items; return; }
  if (!authToken) { openAuth("অর্ডার করতে লগইন করুন"); return; }
  const uid = $("p-uid").value.trim();
  if (!/^[A-Za-z0-9]{6,20}$/.test(uid)) { errEl.textContent = ERROR_BN.invalid_uid; return; }
  const bal = account ? account.balance || 0 : 0;
  if (bal < selected.price) { errEl.textContent = ERROR_BN.insufficient_balance; return; }
  const btn = $("p-buy");
  btn.disabled = true;
  try {
    const { status, data } = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({ uid, items: [{ id: selected.id, qty: 1 }] }),
    });
    if (status === 201 && data && data.ok) {
      setBalance(data.balance);
      updateNeed();
      $("done-id").textContent = data.order_id;
      $("done-total").textContent = "সর্বমোট: " + taka(data.total);
      $("done-modal").classList.remove("hidden");
    } else if (status === 402) {
      errEl.textContent = ERROR_BN.insufficient_balance;
    } else if (status === 401) {
      openAuth("অর্ডার করতে লগইন করুন");
    } else {
      errEl.textContent = ERROR_BN[(data && data.error)] || ERROR_BN.network;
    }
  } catch (e) {
    errEl.textContent = ERROR_BN.network;
  }
  btn.disabled = false;
}

function onLoginSuccess() { updateGate(); updateNeed(); }
function onLogout() { updateGate(); updateNeed(); }

function updateGate() {
  const loggedIn = !!authToken;
  $("p-buy").classList.toggle("hidden", !loggedIn);
  $("p-login-gate").classList.toggle("hidden", loggedIn);
}

document.addEventListener("DOMContentLoaded", async () => {
  wireAuth();
  wireHelpBubble();
  updateGate();
  const q = new URLSearchParams(location.search);
  const wantId = q.get("id") || "";
  try {
    const { data } = await api("/api/products");
    products = Array.isArray(data) ? data : [];
  } catch (e) { products = []; }
  selected = products.find((p) => p.id === wantId) || products[0] || null;
  if (!selected) {
    $("p-name").textContent = "প্যাকেজ পাওয়া যায়নি";
    $("pkg-list").innerHTML = '<p class="muted">শীঘ্রই আসছে…</p>';
    return;
  }
  renderHeader();
  renderPackages();
  await restoreSession();
  updateGate();
  updateNeed();
  $("p-buy").onclick = submitBuy;
  $("done-modal").addEventListener("click", (e) => {
    if (e.target.id === "done-modal") e.target.classList.add("hidden");
  });
});
