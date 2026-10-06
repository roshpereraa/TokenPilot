/* ==========================================================================
   PilotPad pricing — single source of truth for the site and the app.

   One plan, priced by subscription year. Paying annually takes 30% off
   that year's twelve monthly payments.
   ========================================================================== */
(function (global) {
  "use strict";

  var PRICING = {
    trialDays: 14,
    annualDiscount: 0.30,
    currency: "USD",
    // Monthly price for subscription year 1, 2 and 3 (year 3 onward).
    years: [
      { label: "Year 1", monthly: 99, note: "Launch pricing" },
      { label: "Year 2", monthly: 120, note: "Growth" },
      { label: "Year 3+", monthly: 199, note: "Scale" }
    ],
    // Where "Subscribe" buttons send people. Replace with your Stripe
    // Checkout / payment link when billing is live.
    checkoutUrl: "mailto:hello@pilotpad.ai?subject=PilotPad%20subscription"
  };

  function round2(n) { return Math.round(n * 100) / 100; }

  function money(n) {
    var whole = Math.abs(n - Math.round(n)) < 0.005;
    return "$" + (whole ? Math.round(n).toLocaleString("en-US") : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }

  // Figures for one subscription year.
  function year(i) {
    var y = PRICING.years[i];
    var monthlyYear = y.monthly * 12;
    var annual = round2(monthlyYear * (1 - PRICING.annualDiscount));
    return {
      label: y.label,
      note: y.note,
      monthly: y.monthly,
      monthlyYear: monthlyYear,           // 12 monthly payments
      annual: annual,                     // one upfront annual payment
      annualPerMonth: round2(annual / 12),
      saving: round2(monthlyYear - annual)
    };
  }

  function all() { return PRICING.years.map(function (_, i) { return year(i); }); }

  // Totals across the first three years.
  function threeYear() {
    var ys = all();
    var m = ys.reduce(function (a, y) { return a + y.monthlyYear; }, 0);
    var a = round2(ys.reduce(function (s, y) { return s + y.annual; }, 0));
    return { monthly: m, annual: a, saving: round2(m - a) };
  }

  /* ---------- Trial (tracked in this browser — no account needed) ---------- */
  var TRIAL_KEY = "tp.trial.v1";
  var DAY = 86400000;

  function readTrial() {
    try { return JSON.parse(localStorage.getItem(TRIAL_KEY)) || null; } catch (e) { return null; }
  }
  function startTrial() {
    var t = readTrial();
    if (t && t.startedAt) return t;
    t = { startedAt: Date.now() };
    try { localStorage.setItem(TRIAL_KEY, JSON.stringify(t)); } catch (e) { /* storage blocked: trial lasts this session */ }
    return t;
  }
  function trialStatus(now) {
    var t = readTrial();
    if (!t || !t.startedAt) return { started: false, daysLeft: PRICING.trialDays, expired: false };
    var elapsed = (now || Date.now()) - t.startedAt;
    var left = Math.max(0, Math.ceil((PRICING.trialDays * DAY - elapsed) / DAY));
    return { started: true, daysLeft: left, expired: elapsed >= PRICING.trialDays * DAY, endsAt: t.startedAt + PRICING.trialDays * DAY };
  }

  /* ---------- Fill any [data-price] element on the page ---------- */
  // data-price="y{0|1|2}.{field}" or "total.{field}", field from year()/threeYear().
  // data-price-cycle switches between monthly and annual views.
  function render(root, cycle) {
    root = root || document;
    var ys = all(), tot = threeYear();
    root.querySelectorAll("[data-price]").forEach(function (el) {
      var parts = el.getAttribute("data-price").split(".");
      var src = parts[0] === "total" ? tot : ys[+parts[0].slice(1)];
      var v = src && src[parts[1]];
      if (typeof v === "number") el.textContent = money(v);
    });
    root.querySelectorAll("[data-trial-days]").forEach(function (el) { el.textContent = PRICING.trialDays; });
    root.querySelectorAll("[data-discount]").forEach(function (el) { el.textContent = Math.round(PRICING.annualDiscount * 100) + "%"; });
    root.querySelectorAll("[data-cycle]").forEach(function (el) {
      el.hidden = el.getAttribute("data-cycle") !== cycle;
    });
    root.querySelectorAll("[data-cycle-btn]").forEach(function (b) {
      var on = b.getAttribute("data-cycle-btn") === cycle;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    root.querySelectorAll("[data-checkout]").forEach(function (a) { a.setAttribute("href", PRICING.checkoutUrl); });
  }

  // Wire up a Monthly / Annual toggle inside `root`.
  function bindToggle(root, initial) {
    var cycle = initial || "monthly";
    render(root, cycle);
    root.querySelectorAll("[data-cycle-btn]").forEach(function (b) {
      b.addEventListener("click", function () { cycle = b.getAttribute("data-cycle-btn"); render(root, cycle); });
    });
  }

  global.TPPricing = {
    config: PRICING, year: year, all: all, threeYear: threeYear, money: money,
    startTrial: startTrial, trialStatus: trialStatus, render: render, bindToggle: bindToggle
  };
})(window);
