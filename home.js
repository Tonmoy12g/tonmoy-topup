/* TONMOY Topup — homepage logic. */

let products = [];

function isDiamond(p) { return /diamond/i.test(p.id); }
function isMembership(p) { return /weekly|monthly/i.test(p.id); }

function cardHtml(p) {
  const tag = isDiamond(p) ? "💎 " + bn(p.diamonds) + " Diamond" : "🎫 " + p.name;
  return `<a class="pcard" href="product.html?id=${encodeURIComponent(p.id)}">` +
    `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy">` +
    `<div class="pcard-body"><p class="pcard-name">${escapeHtml(tag)}</p>` +
    `<p class="pcard-price">${taka(p.price)}</p></div></a>`;
}

async function loadProducts() {
  try {
    const { data } = await api("/api/products");
    products = Array.isArray(data) ? data : [];
  } catch (e) { products = []; }
  const dg = $("diamond-grid"), mg = $("member-grid");
  if (dg) dg.innerHTML = products.filter(isDiamond).map(cardHtml).join("") || '<p class="muted">শীঘ্রই আসছে…</p>';
  if (mg) mg.innerHTML = products.filter(isMembership).map(cardHtml).join("") || '<p class="muted">শীঘ্রই আসছে…</p>';
}

/* ---------------- Hero carousel ---------------- */
let heroIdx = 0, heroTimer = null;
function heroGo(i) {
  const slides = document.querySelectorAll("#hero-slides .slide");
  const dots = document.querySelectorAll("#hero-dots .dot");
  if (!slides.length) return;
  heroIdx = (i + slides.length) % slides.length;
  slides.forEach((s, k) => s.classList.toggle("active", k === heroIdx));
  dots.forEach((d, k) => d.classList.toggle("active", k === heroIdx));
}
function heroAuto() {
  clearInterval(heroTimer);
  heroTimer = setInterval(() => heroGo(heroIdx + 1), 5000);
}
function initHero() {
  const slides = document.querySelectorAll("#hero-slides .slide");
  const dotsBox = $("hero-dots");
  if (!slides.length || !dotsBox) return;
  dotsBox.innerHTML = "";
  slides.forEach((_, k) => {
    const d = document.createElement("button");
    d.className = "dot" + (k === 0 ? " active" : "");
    d.onclick = () => { heroGo(k); heroAuto(); };
    dotsBox.appendChild(d);
  });
  heroAuto();
}

/* ---------------- Recent orders live feed ---------------- */
const FEED_STATUS_BN = { pending: "⏳ প্রসেসিং", confirmed: "✅ কনফার্মড", delivered: "🎉 ডেলিভার্ড", cancelled: "❌ বাতিল" };

async function loadFeed() {
  const box = $("feed");
  if (!box) return;
  try {
    const { data } = await api("/api/recent-orders");
    const orders = (data && data.orders) || [];
    if (!orders.length) { box.innerHTML = '<p class="muted center">এখনো কোনো অর্ডার নেই।</p>'; return; }
    box.innerHTML = orders.map((o) =>
      `<div class="feed-row">` +
      `<span class="feed-user">👤 ${escapeHtml(o.name)}</span>` +
      `<span class="feed-pkg">${escapeHtml(o.package)} — <b>${taka(o.total)}</b></span>` +
      `<span class="feed-st">${FEED_STATUS_BN[o.status] || escapeHtml(o.status)}</span>` +
      `</div>`
    ).join("");
  } catch (e) {
    box.innerHTML = '<p class="muted center">লোড করা যায়নি।</p>';
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  maybeHideNotice();
  wireAuth();
  wireHelpBubble();
  const wa = $("support-wa"), bw = $("support-banner-wa"), fw = $("foot-wa");
  if (wa) wa.href = SHOP_WHATSAPP;
  if (bw) bw.href = SHOP_WHATSAPP;
  if (fw) fw.href = SHOP_WHATSAPP;
  initHero();
  await restoreSession();
  await loadProducts();
  await loadFeed();
  const fr = $("feed-refresh");
  if (fr) fr.onclick = loadFeed;
  setInterval(loadFeed, 60000); // refresh feed every minute
  // category chips
  document.querySelectorAll("#category-chips .chip").forEach((c) => {
    c.onclick = () => {
      document.querySelectorAll("#category-chips .chip").forEach((x) => x.classList.remove("active"));
      c.classList.add("active");
      const cat = c.dataset.cat;
      $("sec-diamond").style.display = (cat === "all" || cat === "diamond") ? "" : "none";
      $("sec-member").style.display = (cat === "all" || cat === "member") ? "" : "none";
    };
  });
});
