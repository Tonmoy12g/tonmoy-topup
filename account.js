/* TONMOY Topup — account page logic. */

let acPayMethod = "bkash";

function showSection(name) {
  ["info", "orders", "txn", "addmoney", "contact"].forEach((s) => {
    const el = $("sec-" + s);
    if (el) el.classList.toggle("hidden", s !== name);
  });
  document.querySelectorAll(".aside-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.sec === name);
  });
  if (name === "orders") loadAcOrders();
  if (name === "txn") loadAcTxns();
}

function renderAcUser() {
  if (!account) return;
  $("ac-name").textContent = account.name;
  $("ac-phone").textContent = account.phone;
  $("info-name").textContent = account.name;
  $("info-phone").textContent = account.phone;
  $("info-balance").textContent = taka(account.balance || 0);
  $("ac-avatar").textContent = (account.name || "👤").trim().charAt(0).toUpperCase();
}

async function loadAcOrders() {
  const box = $("ac-orders");
  box.innerHTML = '<p class="muted center">লোড হচ্ছে…</p>';
  try {
    const { status, data } = await api("/api/orders/mine");
    if (status === 200 && data && data.ok) {
      if (!data.orders.length) { box.innerHTML = '<p class="muted center">কোনো অর্ডার নেই।</p>'; return; }
      box.innerHTML = data.orders.map((o) => {
        const items = (o.items || []).map((i) => `${escapeHtml(i.name)} × ${i.qty}`).join("<br>");
        return `<div class="order-card">` +
          `<div><b>${escapeHtml(o.order_id)}</b><br><small class="muted">${fmtDateBn(o.created_at)}</small><br>${items}</div>` +
          `<div class="right"><b>${taka(o.total)}</b><br><span class="status ${escapeHtml(o.status)}">${STATUS_BN[o.status] || escapeHtml(o.status)}</span><br><small class="muted">UID: ${escapeHtml(o.uid)}</small></div>` +
          `</div>`;
      }).join("");
    }
  } catch (e) {
    box.innerHTML = '<p class="muted center">লোড করা যায়নি।</p>';
  }
}

async function loadAcTxns() {
  const box = $("ac-txns");
  box.innerHTML = '<p class="muted center">লোড হচ্ছে…</p>';
  try {
    const { status, data } = await api("/api/topup/mine");
    if (status === 200 && data && data.ok) {
      if (!data.topups.length) { box.innerHTML = '<p class="muted center">কোনো ট্রানজেকশন নেই।</p>'; return; }
      box.innerHTML = data.topups.map((t) =>
        `<div class="order-card">` +
        `<div><b>${escapeHtml(t.topup_id)}</b><br><small class="muted">${fmtDateBn(t.created_at)}</small><br><small>${PAYMENT_BN[t.payment_method] || escapeHtml(t.payment_method)} • ${escapeHtml(t.trxid)}</small></div>` +
        `<div class="right"><b>${taka(t.amount)}</b><br><span>${TOPUP_STATUS_BN[t.status] || escapeHtml(t.status)}</span></div>` +
        `</div>`
      ).join("");
    }
  } catch (e) {
    box.innerHTML = '<p class="muted center">লোড করা যায়নি।</p>';
  }
}

/* ---------------- Add Money ---------------- */
function acRefreshPay() {
  const m = acPayMethod;
  $("ac-pay-number").textContent = SHOP_PAY_NUMBER;
  $("ac-pay-method").textContent = PAYMENT_BN[m] || m;
  const box = $("ac-pay-box");
  if (box) box.style.borderColor = PAY_COLORS[m] || PAY_COLORS.bkash;
  $("ac-pay-steps").innerHTML = (PAY_STEPS[m] || []).map((t) => `<li>${escapeHtml(t)}</li>`).join("");
  document.querySelectorAll("#sec-addmoney .pay-card").forEach((c) => {
    c.classList.toggle("sel", c.dataset.m === m);
  });
}

async function acSubmitTopup() {
  const errEl = $("ac-error");
  errEl.textContent = "";
  const amount = parseInt($("ac-amount").value, 10);
  const sender = $("ac-sender").value.trim().replace(/[\s\-]/g, "");
  const trxid = $("ac-trxid").value.trim().toUpperCase();
  if (!(amount >= 10 && amount <= 100000)) { errEl.textContent = ERROR_BN.invalid_amount; return; }
  if (!/^01[3-9]\d{8}$/.test(sender)) { errEl.textContent = ERROR_BN.invalid_sender_number; return; }
  if (!/^[A-Z0-9]{6,20}$/.test(trxid)) { errEl.textContent = ERROR_BN.invalid_trxid; return; }
  try {
    const { status, data } = await api("/api/topup", {
      method: "POST",
      body: JSON.stringify({ amount, payment_method: acPayMethod, sender_number: sender, trxid }),
    });
    if (status === 201 && data && data.ok) {
      $("ac-amount").value = ""; $("ac-sender").value = ""; $("ac-trxid").value = "";
      alert("✅ রিকোয়েস্ট পাঠানো হয়েছে! অ্যাডমিন ভেরিফাই করলে ব্যালেন্স যোগ হবে। (ID: " + data.topup_id + ")");
      showSection("txn");
    } else {
      errEl.textContent = ERROR_BN[(data && data.error)] || ERROR_BN.network;
    }
  } catch (e) {
    errEl.textContent = ERROR_BN.network;
  }
}

function onLoginSuccess() { renderAcUser(); }
function onLogout() { location.href = "index.html"; }

document.addEventListener("DOMContentLoaded", async () => {
  wireAuth();
  wireHelpBubble();
  $("ac-wa").href = SHOP_WHATSAPP;
  await restoreSession();
  if (!authToken) {
    afterLoginGo = "account.html";
    openAuth("অ্যাকাউন্ট দেখতে লগইন করুন");
  } else {
    renderAcUser();
  }
  document.querySelectorAll(".aside-btn").forEach((b) => {
    b.onclick = () => showSection(b.dataset.sec);
  });
  // deep link: account.html#addmoney etc.
  const hash = (location.hash || "").replace("#", "");
  if (["info", "orders", "txn", "addmoney", "contact"].includes(hash)) showSection(hash);

  document.querySelectorAll("#sec-addmoney .pay-card").forEach((c) => {
    c.onclick = () => {
      acPayMethod = c.dataset.m;
      $("ac-pay-box").classList.remove("hidden");
      acRefreshPay();
    };
  });
  $("ac-copy").onclick = async () => {
    const btn = $("ac-copy");
    try {
      await navigator.clipboard.writeText(SHOP_PAY_NUMBER);
      btn.textContent = "✅ কপি হয়েছে!";
    } catch (e) { btn.textContent = "👆 নম্বরটি সিলেক্ট করুন"; }
    setTimeout(() => { btn.textContent = "📋 কপি"; }, 2000);
  };
  $("ac-submit").onclick = acSubmitTopup;
  acRefreshPay();
});
