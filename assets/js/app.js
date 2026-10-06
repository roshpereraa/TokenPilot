/* ==========================================================================
   PilotPad app — intake → deep analysis → command center
   ========================================================================== */
(function () {
  "use strict";

  var E = window.TPEngine, AI = window.TPAI, PR = window.TPPricing;
  // ?preview=expired shows the end-of-trial screen without waiting 14 days.
  var PREVIEW_EXPIRED = /[?&]preview=expired\b/.test(location.search);
  function trial() {
    var t = PR.trialStatus();
    if (PREVIEW_EXPIRED) { t.started = true; t.expired = true; t.daysLeft = 0; }
    return t;
  }
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function nl(s) { return esc(s).replace(/\n/g, "<br />"); }

  /* ---------- Persistence (browser-only convenience) ---------- */
  var STORE = "tp.state.v1";
  var state = { project: null, salts: {}, checks: {}, log: [], aiDocs: {}, chat: [], page: "overview" };
  function load() {
    try { var s = JSON.parse(localStorage.getItem(STORE)); if (s && s.project) state = Object.assign(state, s); } catch (e) { /* ignore */ }
  }
  function persist() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* storage full or blocked */ }
  }

  /* ---------- Agents ---------- */
  var AGENTS = [
    { id: "strategy", name: "Strategy", full: "Strategy Agent", color: "#c9c2ff", role: "Synthesises every signal into ranked decisions and your daily priorities." },
    { id: "brand", name: "Brand", full: "Brand Agent", color: "#b8aeff", role: "Visual identity, narrative, positioning and messaging." },
    { id: "growth", name: "Growth", full: "Growth Agent", color: "#3be8c8", role: "Community and acquisition strategy, campaigns and KPIs." },
    { id: "social", name: "Social", full: "Social Agent", color: "#7aa8ff", role: "X content, threads, replies, campaigns and viral moments." },
    { id: "launch", name: "Launch", full: "Launch Agent", color: "#ffb547", role: "Pre-launch, launch-day and post-launch playbook." },
    { id: "intel", name: "Intel", full: "Market Intelligence Agent", color: "#ff6b8b", role: "Competitors, trends, narratives, sentiment and opportunities." }
  ];
  var AG = {}; AGENTS.forEach(function (a) { AG[a.id] = a; });

  var out = null;
  function rebuild() {
    out = E.build(state.project, 0);
    Object.keys(state.salts).forEach(function (k) {
      if (state.salts[k]) out[k] = E.build(state.project, state.salts[k])[k];
    });
  }

  /* ---------- Toast ---------- */
  var toastT;
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove("on"); }, 2400);
  }

  function copy(text) {
    var done = function () { toast("Copied to clipboard"); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { toast("Copy failed"); }
      ta.remove();
    }
  }

  /* ---------- Views ---------- */
  function show(id) {
    ["viewIntake", "viewAnalysis", "viewCommand"].forEach(function (v) { $("#" + v).hidden = v !== id; });
    window.scrollTo(0, 0);
  }

  /* =======================================================================
     INTAKE
     ======================================================================= */
  var step = 0;
  var form = $("#brief");
  var steps = $$(".fstep", form);
  var stepper = $$("#stepper li");

  function setStep(i) {
    step = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach(function (s, k) { s.classList.toggle("is-on", k === step); });
    stepper.forEach(function (s, k) { s.classList.toggle("is-on", k === step); s.classList.toggle("is-done", k < step); });
    $("#progressBar").style.width = ((step + 1) / steps.length) * 100 + "%";
    $("#prevStep").style.visibility = step === 0 ? "hidden" : "visible";
    $("#nextStep").innerHTML = step === steps.length - 1 ? 'Analyse my project <svg><use href="#i-spark"/></svg>' : 'Continue <svg><use href="#i-arrow"/></svg>';
    $("#formErr").textContent = "";
    var first = steps[step].querySelector("input:not([type=color]):not([type=file]), textarea");
    if (first && window.innerWidth > 760) setTimeout(function () { first.focus({ preventScroll: true }); }, 60);
  }

  $$(".seg", form).forEach(function (seg) {
    seg.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (seg.classList.contains("seg--multi")) b.classList.toggle("on");
      else { $$("button", seg).forEach(function (x) { x.classList.toggle("on", x === b); }); }
    });
  });

  var logoData = null;
  $("#logoInput").addEventListener("change", function (e) {
    var f = e.target.files[0]; if (!f) return;
    if (f.size > 1024 * 1024) { toast("Logo must be under 1MB"); return; }
    var rd = new FileReader();
    rd.onload = function () { logoData = rd.result; paintLogo(); };
    rd.readAsDataURL(f);
  });
  function paintLogo() {
    $("#logoPreview").innerHTML = logoData ? '<img src="' + esc(logoData) + '" alt="Logo preview" />' : '<svg class="icon"><use href="#i-upload"/></svg>';
  }

  function readForm() {
    var fd = new FormData(form), p = {};
    fd.forEach(function (v, k) { p[k] = typeof v === "string" ? v.trim() : v; });
    $$(".seg", form).forEach(function (seg) {
      var on = $$("button.on", seg).map(function (b) { return b.dataset.v; });
      p[seg.dataset.name] = seg.classList.contains("seg--multi") ? on : on[0];
    });
    p.colors = $$("[data-color]", form).map(function (i) { return i.value; });
    p.logo = logoData;
    return p;
  }

  function fillForm(p) {
    $$("input[name], textarea[name]", form).forEach(function (el) { el.value = p[el.name] != null ? p[el.name] : ""; });
    $$(".seg", form).forEach(function (seg) {
      var v = p[seg.dataset.name];
      $$("button", seg).forEach(function (b) {
        b.classList.toggle("on", Array.isArray(v) ? v.indexOf(b.dataset.v) > -1 : b.dataset.v === v);
      });
    });
    if (p.colors) $$("[data-color]", form).forEach(function (i, k) { if (p.colors[k]) i.value = p.colors[k]; });
    logoData = p.logo || null; paintLogo();
  }

  function validate() {
    if (step === 0) {
      if (!form.name.value.trim()) return "Give your token a name.";
      if (form.concept.value.trim().length < 12) return "Describe the concept in at least a sentence.";
    }
    return "";
  }

  $("#nextStep").addEventListener("click", function () {
    var err = validate();
    if (err) { $("#formErr").textContent = err; return; }
    if (step < steps.length - 1) return setStep(step + 1);
    var p = readForm();
    var isNew = !state.project || state.project.name !== p.name;
    state.project = p;
    if (isNew) { state.salts = {}; state.checks = {}; state.aiDocs = {}; state.chat = []; state.log = []; }
    state.page = "overview";
    persist();
    PR.startTrial();
    runAnalysis();
  });
  $("#prevStep").addEventListener("click", function () { setStep(step - 1); });
  stepper.forEach(function (li, k) {
    li.addEventListener("click", function () { if (k < step || !validate()) setStep(k); });
  });

  function isoIn(days) {
    var d = new Date(); d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
  $("#loadSample").addEventListener("click", function () {
    fillForm({
      name: "Nova", ticker: "NOVA",
      oneLiner: "On-chain AI copilots that trade with you, not for you",
      concept: "Nova gives everyday traders on Solana a personal AI copilot that explains markets, flags risks and suggests moves in plain English — the trader always stays in control. Holders vote on which copilot skills ship next, and every copilot action is verifiable on-chain.",
      category: "ai", website: "https://nova.example", x: "@novaonchain", followers: 4200,
      telegram: "t.me/novaonchain", discord: "discord.gg/nova", communitySize: 1800,
      vibe: "premium", colors: ["#6e5bff", "#3be8c8", "#0b0b14"],
      audience: "Retail traders aged 22-40 who are curious about crypto but overwhelmed by noise. They want to feel smart and in control, fear getting rugged, and trust products that show their work.",
      roadmap: "Q1: Copilot beta for 1,000 Founding Pilots\nQ2: Skill marketplace with holder voting\nQ3: Copilot support for every major Solana DEX\nQ4: Open agent SDK",
      goals: ["community", "narrative", "launch", "creators"],
      launchDate: isoIn(14)
    });
    toast("Sample project loaded — review and continue");
  });

  /* =======================================================================
     ANALYSIS
     ======================================================================= */
  function runAnalysis() {
    show("viewAnalysis");
    rebuild();
    var a = out.analysis;
    $("#scanName").textContent = out.n.name;
    var list = $("#scanDims");
    list.innerHTML = a.dims.map(function (d) {
      return '<li><span>' + esc(d.label) + '</span><i><b style="--w:' + d.score + '%"></b></i><em class="mono">—</em></li>';
    }).join("");
    $("#agentsBoot").innerHTML = "";
    var items = $$("li", list);
    var C = 2 * Math.PI * 92, val = $("#scanVal");
    val.style.strokeDasharray = C; val.style.strokeDashoffset = C;
    var subs = [
      "Reading the narrative and concept…", "Auditing brand assets and identity…", "Mapping the competitive landscape…",
      "Reading market timing on Solana…", "Benchmarking social presence…", "Sizing community and channels…",
      "Modelling audience psychology…", "Synthesising positioning…"
    ];
    var per = reduce ? 60 : 520;
    items.forEach(function (li, k) {
      setTimeout(function () {
        li.classList.add("on");
        $("#scanSub").textContent = subs[k];
        setTimeout(function () {
          li.classList.add("done");
          li.querySelector("em").textContent = a.dims[k].score;
          var pct = Math.round(((k + 1) / items.length) * 100);
          $("#scanPct").textContent = pct + "%";
          val.style.strokeDashoffset = C * (1 - pct / 100);
        }, per * 0.8);
      }, k * per);
    });
    setTimeout(function () {
      $("#scanTitle").innerHTML = 'Assembling your <span class="grad">launch team</span>';
      $("#scanSub").textContent = "Readiness " + a.overall + "/100 · " + a.verdict;
      var boot = $("#agentsBoot");
      boot.innerHTML = AGENTS.map(function (ag, k) {
        return '<div class="boot glass glass--sm" style="--c:' + ag.color + ';--d:' + k + '"><svg class="icon"><use href="#i-' + ag.id + '"/></svg><span>' + ag.name + '</span><i class="live-dot"></i></div>';
      }).join("");
      requestAnimationFrame(function () { $$(".boot", boot).forEach(function (b) { b.classList.add("on"); }); });
    }, items.length * per + 200);
    setTimeout(function () { openCommand(); }, items.length * per + (reduce ? 400 : 2200));
  }

  /* =======================================================================
     COMMAND CENTER
     ======================================================================= */
  var NAV = [
    { id: "overview", label: "Overview", icon: "home" }
  ].concat(AGENTS.map(function (a) { return { id: a.id, label: a.name, icon: a.id, agent: true }; }))
    .concat([
      { id: "simulator", label: "Launch simulator", icon: "sim" },
      { id: "pulse", label: "Performance", icon: "pulse" },
      { id: "plan", label: "Plan & billing", icon: "card" },
      { id: "settings", label: "Settings", icon: "gear" }
    ]);

  function openCommand() {
    rebuild();
    show("viewCommand");
    renderChrome();
    go(state.page || "overview");
    renderChat();
    paywall();
  }

  function renderChrome() {
    var n = out.n;
    var logo = n.logo ? '<img src="' + esc(n.logo) + '" alt="" />' : esc(n.name.charAt(0));
    $("#tokenCard").innerHTML =
      '<div class="token-card__logo" style="--c1:' + esc(out.brand.visual.palette[0]) + ';--c2:' + esc(out.brand.visual.palette[1]) + '">' + logo + "</div>" +
      '<div class="token-card__meta"><strong>' + esc(n.name) + '</strong><span class="mono">$' + esc(n.ticker) + " · " + esc(n.C.label) + "</span></div>";

    var html = "", group = "";
    NAV.forEach(function (it) {
      var g = it.agent ? "Agents" : it.id === "overview" ? "" : "Tools";
      if (g !== group) { group = g; if (g) html += '<span class="side__label mono">' + g + "</span>"; }
      html += '<a href="#' + it.id + '" data-page="' + it.id + '" style="--c:' + (it.agent ? AG[it.id].color : "var(--lavender)") + '"><svg class="icon"><use href="#i-' + it.icon + '"/></svg><span>' + it.label + "</span>" + (it.agent ? '<i class="dot"></i>' : "") + "</a>";
    });
    $("#sideNav").innerHTML = html;

    var days = E.daysToLaunch(n), tr = trial();
    var trialTag = !tr.started ? "" : tr.expired
      ? '<a href="#plan" data-page="plan" class="tag tag--ember trial-tag">Trial ended · Choose a plan</a>'
      : '<a href="#plan" data-page="plan" class="tag ' + (tr.daysLeft <= 3 ? "tag--ember" : "tag--signal") + ' trial-tag">Free trial · ' + tr.daysLeft + (tr.daysLeft === 1 ? " day" : " days") + " left</a>";
    $("#countdown").innerHTML = trialTag + (days === null ? '<span class="tag">No launch date</span>'
      : days > 0 ? '<span class="tag tag--violet">T-' + days + "d · " + esc(out.strategy.phase) + "</span>"
      : days === 0 ? '<span class="tag tag--signal"><i class="live-dot"></i> Launch day</span>'
      : '<span class="tag tag--signal">T+' + Math.abs(days) + "d · Post-launch</span>");

    var on = AI.connected();
    $("#aiStatus").innerHTML = on
      ? '<span class="live-dot"></span><div><b>Claude connected</b><span class="mono">' + esc((AI.load().model || AI.MODELS[0].id)) + "</span></div>"
      : '<span class="dot-off"></span><div><b>Local engine</b><a href="#settings" data-page="settings">Connect Claude →</a></div>';
    $("#chatMode").textContent = on ? "Live · Claude" : "Local engine";
  }

  function go(page) {
    if (!NAV.some(function (n) { return n.id === page; })) page = "overview";
    state.page = page; persist();
    $$("#sideNav a").forEach(function (a) { a.classList.toggle("on", a.dataset.page === page); });
    var nav = NAV.filter(function (n) { return n.id === page; })[0];
    $("#mainTitle").innerHTML = '<span class="mono">' + esc(out.n.name) + " /</span> " + esc(nav.label);
    var c = $("#content");
    c.innerHTML = (PAGES[page] || PAGES.overview)();
    c.classList.remove("enter"); void c.offsetWidth; c.classList.add("enter");
    bindPage(page);
    $("#side").classList.remove("open");
    $("#main").scrollTop = 0; window.scrollTo(0, 0);
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-page]");
    if (a) { e.preventDefault(); go(a.dataset.page); return; }
    var cp = e.target.closest("[data-copy]");
    if (cp) { var src = cp.closest(".card").querySelector("[data-copy-src]"); copy(src ? src.innerText : ""); }
  });
  $("#menuBtn").addEventListener("click", function () { $("#side").classList.toggle("open"); });

  /* ---------- UI helpers ---------- */
  function card(title, body, opts) {
    opts = opts || {};
    return '<article class="card glass glass--sm ' + (opts.cls || "") + '">' +
      '<header class="card__head"><h3>' + title + "</h3>" +
      (opts.copy ? '<button class="iconbtn" data-copy title="Copy"><svg class="icon"><use href="#i-copy"/></svg></button>' : "") +
      (opts.extra || "") + "</header>" +
      '<div class="card__body"' + (opts.copy ? " data-copy-src" : "") + ">" + body + "</div></article>";
  }
  function ring(v, size, color) {
    var r = 34, C = 2 * Math.PI * r;
    return '<div class="ring" style="--s:' + (size || 96) + 'px"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="' + r + '"/><circle cx="40" cy="40" r="' + r + '" class="ring__v" style="stroke:' + (color || "var(--signal)") + ";stroke-dasharray:" + C + ";stroke-dashoffset:" + (C * (1 - v / 100)) + '"/></svg><strong class="mono">' + v + "</strong></div>";
  }
  function bar(label, v) {
    var tone = v >= 75 ? "hi" : v >= 55 ? "mid" : "lo";
    return '<div class="bar bar--' + tone + '"><span>' + esc(label) + '</span><i><b style="--w:' + v + '%"></b></i><em class="mono">' + v + "</em></div>";
  }
  function list(items) { return '<ul class="list">' + items.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul>"; }

  function agentHead(id, extra) {
    var a = AG[id];
    return '<section class="agent-hero glass" style="--c:' + a.color + '">' +
      '<div class="agent-hero__icon"><svg class="icon"><use href="#i-' + id + '"/></svg></div>' +
      '<div class="agent-hero__txt"><span class="mono"><i class="live-dot"></i> Online · shares project memory</span><h2>' + a.full + "</h2><p>" + a.role + "</p></div>" +
      '<div class="agent-hero__act">' +
      '<button class="btn btn--glass btn--sm" data-regen="' + id + '"><svg class="icon"><use href="#i-refresh"/></svg> ' + (AI.connected() ? "Regenerate with Claude" : "Regenerate") + "</button>" +
      '<button class="btn btn--primary btn--sm" data-ask="' + id + '"><svg class="icon"><use href="#i-chat"/></svg> Ask ' + a.name + "</button>" +
      "</div>" + (extra || "") + "</section>" + aiDoc(id);
  }
  function aiDoc(id) {
    var d = state.aiDocs[id];
    if (!d) return "";
    return card('<svg class="icon" style="color:var(--signal)"><use href="#i-spark"/></svg> Live briefing from Claude', '<div class="md">' + md(d.text) + '</div><span class="mono muted">Generated ' + esc(new Date(d.at).toLocaleString()) + "</span>", { copy: true, cls: "card--ai span-2" });
  }

  /* Minimal, safe markdown → HTML */
  function md(src) {
    var lines = esc(src).split(/\n/), html = "", inList = null;
    var inline = function (s) {
      return s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|\W)\*(?!\s)(.+?)\*(?=\W|$)/g, "$1<em>$2</em>").replace(/`([^`]+)`/g, "<code>$1</code>");
    };
    var close = function () { if (inList) { html += "</" + inList + ">"; inList = null; } };
    lines.forEach(function (l) {
      var m;
      if ((m = l.match(/^#{1,6}\s+(.*)/))) { close(); html += "<h4>" + inline(m[1]) + "</h4>"; }
      else if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { if (inList !== "ul") { close(); html += "<ul>"; inList = "ul"; } html += "<li>" + inline(m[1]) + "</li>"; }
      else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (inList !== "ol") { close(); html += "<ol>"; inList = "ol"; } html += "<li>" + inline(m[1]) + "</li>"; }
      else if (/^\s*(---|\*\*\*)\s*$/.test(l)) { close(); html += "<hr />"; }
      else if (!l.trim()) { close(); }
      else { close(); html += "<p>" + inline(l) + "</p>"; }
    });
    close();
    return html;
  }

  /* =======================================================================
     PAGES
     ======================================================================= */
  var PAGES = {};

  PAGES.overview = function () {
    var n = out.n, a = out.analysis, s = out.strategy;
    var hour = new Date().getHours();
    var greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    var recs = E.adapt(state.log, n);

    var prios = s.priorities.map(function (p, i) {
      var k = "p" + i + ":" + p;
      return '<li><label class="check"><input type="checkbox" data-check="' + esc(k) + '"' + (state.checks[k] ? " checked" : "") + '><i><svg class="icon"><use href="#i-check"/></svg></i><span>' + esc(p) + "</span></label></li>";
    }).join("");

    var feed = [
      { id: "brand", t: "Drafted positioning, 3 narrative pillars and " + out.brand.taglines.length + " taglines" },
      { id: "social", t: "Planned a 14-day X calendar and a 5-part launch thread" },
      { id: "growth", t: "Designed the \"" + out.growth.campaigns[0].name + "\" campaign" },
      { id: "launch", t: "Built the T-30 → T+30 playbook and announcement draft" },
      { id: "intel", t: "Flagged \"" + out.intel.trends[0].name + "\" as the top narrative to own" },
      { id: "strategy", t: "Set today's focus: " + s.focus }
    ];

    return '<div class="grid">' +
      '<section class="welcome glass span-2">' +
        '<div class="welcome__txt"><span class="mono muted">' + greet + ", founder</span>" +
        "<h2>" + esc(n.name) + ' — <span class="grad">' + esc(a.verdict) + ".</span></h2>" +
        "<p>" + esc(out.brand.positioning) + "</p>" +
        '<div class="welcome__tags"><span class="tag tag--violet">' + esc(s.phase) + '</span><span class="tag">' + esc(n.C.label) + '</span><span class="tag tag--signal">Strongest: ' + esc(a.strengths[0].label) + "</span></div></div>" +
        '<div class="welcome__score">' + ring(a.overall, 132) + '<span class="mono muted">Launch readiness</span></div>' +
      "</section>" +

      card("Deep analysis", '<div class="bars">' + a.dims.map(function (d) { return bar(d.label, d.score); }).join("") + "</div>") +

      card("Today's priorities", '<ul class="checks">' + prios + "</ul>", { extra: '<span class="tag mono">Strategy</span>' }) +

      card("Agent feed", '<ul class="feed">' + feed.map(function (f) {
        return '<li><a href="#' + f.id + '" data-page="' + f.id + '"><i style="background:' + AG[f.id].color + '"></i><div><b>' + AG[f.id].name + "</b><p>" + esc(f.t) + '</p></div><svg class="icon"><use href="#i-arrow"/></svg></a></li>';
      }).join("") + "</ul>") +

      (recs.length ? card("Adapting to your performance", list(recs.map(function (r) { return "<b>" + AG[r.agent].name + ":</b> " + esc(r.text); })), { extra: '<span class="tag tag--signal">Learning</span>' })
        : card("Unlock sharper analysis", a.gaps.length ? list(a.gaps.map(function (g) { return esc(g.text); })) + '<button class="btn btn--glass btn--sm" data-edit>Edit brief</button>' : '<p class="muted">Your brief is complete. Log performance to start the learning loop.</p><button class="btn btn--glass btn--sm" data-page="pulse">Log performance</button>')) +
    "</div>";
  };

  PAGES.strategy = function () {
    var s = out.strategy;
    return agentHead("strategy") + '<div class="grid">' +
      card("Daily priorities", '<ol class="olist">' + s.priorities.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ol>", { copy: true }) +
      card("Focus this week", '<div class="focus"><span class="mono muted">Weakest dimension</span><strong>' + esc(s.focus) + '</strong><p class="muted">Raising this lifts every other agent\'s output. ' + (s.days !== null ? (s.days > 0 ? s.days + " days to launch." : "") : "Set a launch date to schedule the plan.") + "</p></div>") +
      card("Decision memos", s.decisions.map(function (d) { return '<div class="memo"><b>' + esc(d.q) + "</b><p>" + esc(d.rec) + "</p></div>"; }).join(""), { copy: true, cls: "span-2" }) +
      card("Risk radar", '<div class="table">' + s.risks.map(function (r) { return '<div class="tr"><span class="tag tag--ember">Risk</span><div><b>' + esc(r.r) + "</b><p>" + esc(r.m) + "</p></div></div>"; }).join("") + "</div>", { cls: "span-2" }) +
      "</div>";
  };

  PAGES.brand = function () {
    var b = out.brand;
    return agentHead("brand") + '<div class="grid">' +
      card("Positioning statement", '<p class="quote">' + esc(b.positioning) + "</p>", { copy: true, cls: "span-2" }) +
      card("Narrative pillars", b.pillars.map(function (p, i) { return '<div class="pillar"><span class="mono">0' + (i + 1) + "</span><div><b>" + esc(p.title) + "</b><p>" + esc(p.text) + "</p></div></div>"; }).join(""), { copy: true }) +
      card("Taglines", '<ul class="taglines">' + b.taglines.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>", { copy: true }) +
      card("Voice", '<div class="chips">' + b.voice.traits.map(function (t) { return '<span class="tag tag--violet">' + esc(t) + "</span>"; }).join("") + '</div><div class="dodont"><div><span class="mono ok">Do</span><p>' + esc(b.voice.do) + '</p></div><div><span class="mono no">Don\'t</span><p>' + esc(b.voice.dont) + "</p></div></div>") +
      card("Visual identity", '<div class="palette">' + b.visual.palette.map(function (c) { return '<div><i style="background:' + esc(c) + '"></i><span class="mono">' + esc(c.toUpperCase()) + "</span></div>"; }).join("") + '</div><p class="muted small"><b>Type:</b> ' + esc(b.visual.type) + '</p><p class="muted small"><b>Logo direction:</b> ' + esc(b.visual.logo) + "</p>") +
      card("Website copy", '<div class="site-copy"><span class="mono muted">Hero</span><h4>' + esc(b.website.headline) + "</h4><p>" + esc(b.website.subhead) + '</p><div class="site-copy__f">' + b.website.features.map(function (f) { return "<div><b>" + esc(f.t) + "</b><p>" + esc(f.d) + "</p></div>"; }).join("") + '</div><span class="btn btn--primary btn--sm">' + esc(b.website.cta) + "</span></div>", { copy: true, cls: "span-2" }) +
      "</div>";
  };

  PAGES.growth = function () {
    var g = out.growth;
    return agentHead("growth") + '<div class="grid">' +
      card("Community funnel", '<div class="funnel">' + g.funnel.map(function (f, i) { return '<div class="funnel__s" style="--i:' + i + '"><span class="mono">' + esc(f.stage) + "</span><p>" + esc(f.tactic) + '</p><em class="mono">KPI · ' + esc(f.kpi) + "</em></div>"; }).join("") + "</div>", { cls: "span-2", copy: true }) +
      card("Campaigns", g.campaigns.map(function (c) { return '<div class="memo"><b>' + esc(c.name) + ' <span class="tag mono">' + esc(c.dur) + '</span></b><p>' + esc(c.mech) + '</p><span class="mono signal">Target: ' + esc(c.target) + "</span></div>"; }).join(""), { copy: true }) +
      card("Acquisition channels", '<div class="table">' + g.channels.map(function (c) { return '<div class="tr"><span class="tag ' + (c.pri === "Primary" ? "tag--signal" : c.pri === "High" ? "tag--violet" : "") + '">' + esc(c.pri) + "</span><div><b>" + esc(c.ch) + "</b><p>" + esc(c.why) + "</p></div></div>"; }).join("") + "</div>") +
      card("KPI targets", '<div class="kpis"><div class="kpis__h mono"><span></span><span>Followers</span><span>Community</span><span>Engagement</span></div>' + g.kpis.map(function (k) { return '<div class="kpis__r"><span>' + esc(k.when) + '</span><b class="mono">' + k.followers + '</b><b class="mono">' + k.community + '</b><b class="mono">' + k.engagement + "</b></div>"; }).join("") + "</div>", { cls: "span-2" }) +
      "</div>";
  };

  PAGES.social = function () {
    var s = out.social;
    return agentHead("social") + '<div class="grid">' +
      card("14-day X calendar", '<div class="cal">' + s.calendar.map(function (c) { return '<div class="cal__d"><span class="mono">Day ' + c.day + '</span><span class="tag ' + (c.format === "Thread" ? "tag--violet" : c.format === "Space" ? "tag--signal" : "") + '">' + esc(c.format) + "</span><p>" + esc(c.hook) + '</p><em class="mono">' + esc(c.time) + "</em></div>"; }).join("") + "</div>", { cls: "span-2", copy: true }) +
      card("Launch thread", '<div class="tweets">' + s.thread.map(function (t) { return '<div class="tweet">' + nl(t) + "</div>"; }).join("") + "</div>", { copy: true }) +
      card("Ready-to-post drafts", '<div class="tweets">' + s.posts.map(function (t) { return '<div class="tweet">' + nl(t) + '<span class="mono muted">' + t.length + "/280</span></div>"; }).join("") + "</div>", { copy: true }) +
      card("Reply playbook", '<div class="table">' + s.replies.map(function (r) { return '<div class="tr tr--stack"><b>' + esc(r.trigger) + "</b><p>" + esc(r.reply) + "</p></div>"; }).join("") + "</div>", { copy: true }) +
      card("Viral moments", s.viral.map(function (v) { return '<div class="memo"><b>' + esc(v.idea) + "</b><p>" + esc(v.why) + "</p></div>"; }).join("")) +
      "</div>";
  };

  PAGES.launch = function () {
    var l = out.launch, days = E.daysToLaunch(out.n);
    var cur = days === null ? 0 : days > 7 ? 0 : days > 0 ? 1 : days === 0 ? 2 : 3;
    return agentHead("launch") + '<div class="grid">' +
      card("Launch playbook", '<div class="phases">' + l.phases.map(function (p, i) { return '<div class="phase' + (i === cur ? " is-now" : i < cur ? " is-past" : "") + '"><div class="phase__h"><b>' + esc(p.name) + '</b><span class="mono">' + esc(p.window) + "</span>" + (i === cur ? '<span class="tag tag--signal">Now</span>' : "") + "</div>" + list(p.items.map(esc)) + "</div>"; }).join("") + "</div>", { cls: "span-2", copy: true }) +
      card("Launch announcement", '<div class="tweet tweet--lg">' + nl(l.announcement) + "</div>", { copy: true }) +
      card("Creator & outreach brief", '<div class="brief"><p>' + esc(l.brief.summary) + '</p><span class="mono muted">Audience</span><p>' + esc(l.brief.audience) + '</p><span class="mono muted">Key messages</span>' + list(l.brief.messages.map(esc)) + '<span class="mono muted">Avoid</span>' + list(l.brief.avoid.map(esc)) + '<span class="mono muted">Assets</span><p>' + esc(l.brief.assets) + "</p></div>", { copy: true }) +
      card("Contingency plans", '<div class="table">' + l.risks.map(function (r) { return '<div class="tr"><span class="tag tag--ember">If</span><div><b>' + esc(r.risk) + "</b><p>" + esc(r.plan) + "</p></div></div>"; }).join("") + "</div>", { cls: "span-2" }) +
      "</div>";
  };

  PAGES.intel = function () {
    var it = out.intel;
    return agentHead("intel") + '<div class="grid">' +
      card("Competitive landscape", '<div class="table">' + it.comps.map(function (c) { return '<div class="tr"><span class="tag ' + (c.threat === "High" ? "tag--ember" : c.threat === "Medium" ? "tag--violet" : "") + '">' + esc(c.threat) + "</span><div><b>" + esc(c.name) + "</b><p>" + esc(c.win) + "</p></div></div>"; }).join("") + "</div>", { cls: "span-2", copy: true }) +
      card("Narrative trends", '<div class="bars">' + it.trends.map(function (t) { return bar(t.name, t.momentum); }).join("") + '</div><p class="muted small">Momentum index · fit with ' + esc(out.n.name) + ": " + it.trends.map(function (t) { return esc(t.fit); }).join(" / ") + "</p>") +
      card("Sentiment", it.sentiment.score !== null ? '<div class="senti">' + ring(it.sentiment.score, 96, "var(--lavender)") + '<p class="muted small">' + esc(it.sentiment.note) + "</p></div>" : '<p class="muted">' + esc(it.sentiment.note) + '</p><button class="btn btn--glass btn--sm" data-edit>Add X account</button>') +
      card("Opportunities", list(it.opportunities.map(esc)), { copy: true }) +
      card("Watchlist", list(it.watch.map(esc)) + '<p class="muted small">Modeled from your brief and sector patterns. Connect live data sources for real-time monitoring.</p>') +
      "</div>";
  };

  PAGES.simulator = function () {
    var a = out.analysis;
    var nar = a.dims[0].score;
    return '<section class="page-head"><h2>Launch simulator</h2><p class="muted">Model how community grows over the 30 days around launch. Illustrative — use it to compare plans, not to predict outcomes.</p></section>' +
      '<div class="grid">' +
      card("Inputs", '<div class="sliders">' +
        slider("community", "Community at launch", 100, 20000, Math.max(out.n.community, 500), 100, "") +
        slider("cadence", "Posts per week", 3, 35, 14, 1, "") +
        slider("creators", "Creators briefed", 0, 40, 10, 1, "") +
        slider("narrative", "Narrative strength", 20, 100, nar, 1, "") +
        "</div>") +
      card("Projection · 30 days", '<div id="simChart" class="sim-chart"></div><div class="legend mono"><span><i style="background:var(--signal)"></i>Bull</span><span><i style="background:var(--ultraviolet)"></i>Base</span><span><i style="background:rgba(255,255,255,.4)"></i>Bear</span></div>') +
      card("Outcome at day 30", '<div class="sim-stats" id="simStats"></div>', { cls: "span-2" }) +
      "</div>";
  };
  function slider(id, label, min, max, val, stepv) {
    return '<label class="slider"><div><span>' + label + '</span><b class="mono" id="sv-' + id + '">' + E.fmt(val) + '</b></div><input type="range" data-sim="' + id + '" min="' + min + '" max="' + max + '" step="' + stepv + '" value="' + val + '" /></label>';
  }

  PAGES.pulse = function () {
    var log = state.log;
    var last = log[log.length - 1] || { followers: out.n.followers, engagement: 3, members: out.n.community };
    var recs = E.adapt(log, out.n);
    return '<section class="page-head"><h2>Performance</h2><p class="muted">Log a daily check-in. Your agents compare it with previous days and adapt their recommendations.</p></section>' +
      '<div class="grid">' +
      card("Daily check-in", '<form class="pulse-form" id="pulseForm">' +
        '<label class="input"><span>X followers</span><input name="followers" type="number" min="0" required value="' + last.followers + '" class="mono" /></label>' +
        '<label class="input"><span>Engagement rate %</span><input name="engagement" type="number" min="0" max="100" step="0.1" required value="' + last.engagement + '" class="mono" /></label>' +
        '<label class="input"><span>Community members</span><input name="members" type="number" min="0" required value="' + last.members + '" class="mono" /></label>' +
        '<button class="btn btn--primary">Log check-in</button></form>') +
      card("Trend", log.length ? '<div id="pulseChart" class="sim-chart"></div><div class="legend mono"><span><i style="background:var(--ultraviolet)"></i>Followers</span><span><i style="background:var(--signal)"></i>Members</span></div>' : '<div class="empty"><svg class="icon"><use href="#i-pulse"/></svg><p>No check-ins yet. Log two to start the learning loop.</p></div>', { cls: "span-2" }) +
      card("What your agents learned", recs.length ? list(recs.map(function (r) { return "<b>" + AG[r.agent].name + ":</b> " + esc(r.text); })) : '<p class="muted">Recommendations appear after your second check-in.</p>', { cls: "span-2" }) +
      card("History", log.length ? '<div class="kpis"><div class="kpis__h mono"><span>Date</span><span>Followers</span><span>Engagement</span><span>Members</span></div>' + log.slice().reverse().slice(0, 10).map(function (l) { return '<div class="kpis__r"><span class="mono">' + esc(l.date) + '</span><b class="mono">' + E.fmt(l.followers) + '</b><b class="mono">' + l.engagement + '%</b><b class="mono">' + E.fmt(l.members) + "</b></div>"; }).join("") + '</div><button class="btn btn--ghost btn--sm" id="clearLog">Clear history</button>' : '<p class="muted">Nothing logged yet.</p>') +
      "</div>";
  };

  function planCards() {
    var cfg = PR.config;
    return '<div class="billing-toggle glass glass--sm" role="group" aria-label="Billing cycle">' +
      '<button type="button" data-cycle-btn="monthly" class="on" aria-pressed="true">Monthly</button>' +
      '<button type="button" data-cycle-btn="annual" aria-pressed="false">Annual <em>−<span data-discount></span></em></button></div>' +
      '<div class="yplans">' + PR.all().map(function (y, i) {
        return '<div class="yplan' + (i === 0 ? " yplan--now" : "") + '"><span class="mono">' + esc(y.label) + "</span><b>" + esc(y.note) + "</b>" +
          '<div class="yplan__price" data-cycle="monthly"><strong data-price="y' + i + '.monthly"></strong><span>/ month</span></div>' +
          '<p data-cycle="monthly">Billed monthly · <span data-price="y' + i + '.monthlyYear"></span> a year</p>' +
          '<div class="yplan__price" data-cycle="annual" hidden><strong data-price="y' + i + '.annualPerMonth"></strong><span>/ month</span></div>' +
          '<p data-cycle="annual" hidden>Billed <span data-price="y' + i + '.annual"></span> yearly · <em class="ok">save <span data-price="y' + i + '.saving"></span></em></p></div>';
      }).join("") + "</div>" +
      '<div class="row-btns"><a class="btn btn--primary" data-checkout target="_blank" rel="noopener">Subscribe</a></div>' +
      '<p class="muted small">Prices in USD. Your price steps up on each subscription anniversary; paying annually saves ' + Math.round(cfg.annualDiscount * 100) + "% every year.</p>";
  }

  PAGES.plan = function () {
    var t = trial(), cfg = PR.config;
    var status = !t.started ? "Your " + cfg.trialDays + "-day free trial starts with your first brief."
      : t.expired ? "Your free trial has ended. Choose a plan to keep your launch team working."
      : "You have <b>" + t.daysLeft + (t.daysLeft === 1 ? " day" : " days") + "</b> left in your free trial (ends " + esc(new Date(t.endsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })) + "). Everything is unlocked until then.";
    var pct = t.started ? Math.round((1 - t.daysLeft / cfg.trialDays) * 100) : 0;
    return '<section class="page-head"><h2>Plan &amp; billing</h2><p class="muted">No account needed during the trial. Subscribe any time to keep going after it ends.</p></section><div class="grid">' +
      card("Free trial", '<p>' + status + '</p><div class="trialbar"><i style="width:' + pct + '%"></i></div>', { cls: "span-2" }) +
      card("PilotPad plan", planCards(), { cls: "span-2" }) +
      "</div>";
  };

  function exportProject() {
    var blob = new Blob([JSON.stringify({ brief: state.project, analysis: out.analysis, brand: out.brand, growth: out.growth, social: out.social, launch: out.launch, intel: out.intel, strategy: out.strategy, aiDocs: state.aiDocs, log: state.log }, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (out.n.name || "project").toLowerCase().replace(/\W+/g, "-") + "-pilotpad.json";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* End-of-trial screen: blocks the command center until the visitor subscribes. */
  function paywall() {
    var old = $("#paywall"); if (old) old.remove();
    if (!trial().expired) { document.body.classList.remove("paywalled"); return; }
    document.body.classList.add("paywalled");
    var el = document.createElement("div");
    el.id = "paywall";
    el.className = "paywall";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "pwTitle");
    el.innerHTML = '<div class="paywall__card glass"><img src="assets/img/logo-mark.svg" alt="" width="48" height="48" />' +
      '<h2 id="pwTitle">Your free trial has ended</h2>' +
      '<p class="muted">Your launch team, analysis and everything they made for ' + esc(out.n.name) + ' are saved in this browser. Choose a plan to pick up where you left off.</p>' +
      planCards() +
      '<button type="button" class="btn btn--ghost btn--sm" id="pwExport">Export my project (JSON)</button></div>';
    document.body.appendChild(el);
    PR.bindToggle(el, "monthly");
    $("#pwExport").addEventListener("click", exportProject);
    var first = el.querySelector("[data-cycle-btn]"); if (first) first.focus();
  }

  PAGES.settings = function () {
    var cfg = AI.load();
    return '<section class="page-head"><h2>Settings</h2></section><div class="grid">' +
      card("Connect Claude", '<p class="muted small">PilotPad runs fully on its built-in engine. Connect a Claude API key to give every agent live reasoning in chat and one-click regeneration. Your key is stored only in this browser — for production, route requests through your own backend.</p>' +
        '<form id="aiForm" class="ai-form"><label class="input"><span>API key</span><input name="key" type="password" placeholder="sk-ant-…" value="' + esc(cfg.key || "") + '" class="mono" autocomplete="off" /></label>' +
        '<label class="input"><span>Model</span><select name="model" class="mono">' + AI.MODELS.map(function (m) { return '<option value="' + m.id + '"' + (cfg.model === m.id ? " selected" : "") + ">" + esc(m.label) + "</option>"; }).join("") + "</select></label>" +
        '<div class="row-btns"><button class="btn btn--primary btn--sm">Save</button>' + (cfg.key ? '<button type="button" class="btn btn--ghost btn--sm" id="aiDisconnect">Disconnect</button>' : "") + "</div></form>", { cls: "span-2" }) +
      card("Project", '<p class="muted small">Update your brief at any time — every agent re-plans around the changes.</p><div class="row-btns"><button class="btn btn--glass btn--sm" data-edit>Edit brief</button><button class="btn btn--glass btn--sm" id="exportBtn">Export JSON</button></div>') +
      card("Danger zone", '<p class="muted small">Delete this project and everything your agents generated from this browser.</p><button class="btn btn--ghost btn--sm danger" id="resetBtn">Reset project</button>') +
      "</div>";
  };

  /* ---------- Page bindings ---------- */
  function bindPage(page) {
    var c = $("#content");
    if (page === "plan") PR.bindToggle(c, "monthly");
    $$("[data-check]", c).forEach(function (cb) {
      cb.addEventListener("change", function () { state.checks[cb.dataset.check] = cb.checked; persist(); });
    });
    $$("[data-edit]", c).forEach(function (b) { b.addEventListener("click", editBrief); });
    $$("[data-ask]", c).forEach(function (b) {
      b.addEventListener("click", function () { openChat(b.dataset.ask); });
    });
    $$("[data-regen]", c).forEach(function (b) { b.addEventListener("click", function () { regen(b.dataset.regen, b); }); });

    if (page === "simulator") {
      var inputs = $$("[data-sim]", c);
      var run = function () {
        var o = {};
        inputs.forEach(function (i) { o[i.dataset.sim] = +i.value; $("#sv-" + i.dataset.sim).textContent = E.fmt(+i.value); });
        var r = E.simulate(o);
        $("#simChart").innerHTML = chart([
          { data: r.series.bull, color: "var(--signal)" },
          { data: r.series.base, color: "var(--ultraviolet)", fill: true },
          { data: r.series.bear, color: "rgba(255,255,255,.4)", dash: true }
        ], 30, "Day");
        $("#simStats").innerHTML =
          '<div><span class="mono muted">Community · day 30</span><b class="mono">' + E.fmt(r.community) + "</b></div>" +
          '<div><span class="mono muted">Range</span><b class="mono">' + E.fmt(r.series.bear[30]) + " – " + E.fmt(r.series.bull[30]) + "</b></div>" +
          '<div><span class="mono muted">Est. monthly reach</span><b class="mono">' + E.fmt(r.reach) + "</b></div>";
      };
      inputs.forEach(function (i) { i.addEventListener("input", run); });
      run();
    }

    if (page === "pulse") {
      var f = $("#pulseForm");
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var d = new Date().toISOString().slice(0, 10);
        var entry = { date: d, followers: +f.followers.value || 0, engagement: Math.round((+f.engagement.value || 0) * 10) / 10, members: +f.members.value || 0 };
        if (state.log.length && state.log[state.log.length - 1].date === d) {
          entry.date = d + " #" + (state.log.filter(function (l) { return l.date.indexOf(d) === 0; }).length + 1);
        }
        state.log.push(entry); persist();
        toast("Check-in logged — agents updated");
        go("pulse");
      });
      if (state.log.length) {
        $("#pulseChart").innerHTML = chart([
          { data: state.log.map(function (l) { return l.followers; }), color: "var(--ultraviolet)", fill: true },
          { data: state.log.map(function (l) { return l.members; }), color: "var(--signal)" }
        ], state.log.length - 1, "Check-in");
      }
      var cl = $("#clearLog");
      if (cl) cl.addEventListener("click", function () { if (confirm("Clear all check-ins?")) { state.log = []; persist(); go("pulse"); } });
    }

    if (page === "settings") {
      $("#aiForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var key = e.target.key.value.trim();
        AI.save({ key: key, model: e.target.model.value });
        renderChrome(); go("settings");
        toast(key ? "Claude connected" : "Saved");
      });
      var dc = $("#aiDisconnect");
      if (dc) dc.addEventListener("click", function () { AI.save({}); renderChrome(); go("settings"); toast("Disconnected"); });
      $("#exportBtn").addEventListener("click", exportProject);
      $("#resetBtn").addEventListener("click", function () {
        if (!confirm("Reset this project? This can't be undone.")) return;
        try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ }
        location.reload();
      });
    }
  }

  function editBrief() {
    fillForm(state.project);
    show("viewIntake");
    setStep(0);
  }

  /* SVG line chart */
  function chart(series, maxX, xLabel) {
    var W = 600, H = 220, P = { l: 44, r: 12, t: 12, b: 26 };
    var max = 0;
    series.forEach(function (s) { s.data.forEach(function (v) { if (v > max) max = v; }); });
    max = max * 1.1 || 1;
    var x = function (i) { return P.l + (i / Math.max(maxX, 1)) * (W - P.l - P.r); };
    var y = function (v) { return H - P.b - (v / max) * (H - P.t - P.b); };
    var g = "";
    for (var k = 0; k <= 4; k++) {
      var gy = P.t + (k / 4) * (H - P.t - P.b);
      g += '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + gy + '" y2="' + gy + '" />';
      g += '<text x="' + (P.l - 8) + '" y="' + (gy + 4) + '" text-anchor="end">' + E.fmt(max * (1 - k / 4)) + "</text>";
    }
    var ticks = "";
    var stepX = maxX > 10 ? Math.ceil(maxX / 6) : 1;
    for (var t = 0; t <= maxX; t += stepX) ticks += '<text x="' + x(t) + '" y="' + (H - 6) + '" text-anchor="middle">' + (xLabel === "Day" ? "D" + t : "#" + (t + 1)) + "</text>";
    var paths = series.map(function (s, si) {
      var d = s.data.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); }).join(" ");
      var area = s.fill ? '<path d="' + d + " L" + x(s.data.length - 1) + " " + (H - P.b) + " L" + x(0) + " " + (H - P.b) + 'Z" fill="url(#cf' + si + ')" />' : "";
      return '<defs><linearGradient id="cf' + si + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6e5bff" stop-opacity=".45"/><stop offset="1" stop-color="#6e5bff" stop-opacity="0"/></linearGradient></defs>' + area +
        '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2.2" stroke-linejoin="round"' + (s.dash ? ' stroke-dasharray="5 5"' : "") + " />";
    }).join("");
    return '<svg viewBox="0 0 ' + W + " " + H + '" class="chart" role="img" aria-label="Chart"><g class="chart__grid">' + g + "</g>" + paths + '<g class="chart__x">' + ticks + "</g></svg>";
  }

  /* ---------- Regenerate ---------- */
  function regen(id, btn) {
    if (!AI.connected()) {
      state.salts[id] = (state.salts[id] || 0) + 1; persist();
      rebuild(); go(id); toast(AG[id].name + " generated a fresh set");
      return;
    }
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Working…';
    var prompts = {
      strategy: "Write today's strategy briefing: the 5 highest-leverage priorities (with why), 3 key decisions with your recommendation, and the top risks.",
      brand: "Produce a full brand brief: positioning statement, 3 narrative pillars, voice traits with do/don't, 5 taglines, and website hero copy with 3 feature blocks.",
      growth: "Produce a growth plan: community funnel, 3 campaigns with mechanics and targets, prioritized acquisition channels, and KPI targets for pre-launch, launch day and T+30.",
      social: "Produce a 7-day X content plan with ready-to-post copy for each day, a 5-post launch thread, and a reply playbook for common situations.",
      launch: "Produce the launch playbook: pre-launch (T-30→T-8), final week, an hour-by-hour launch-day runbook, post-launch (T+1→T+30), a launch announcement post, and a creator/outreach brief.",
      intel: "Produce a market intelligence briefing: competitor archetypes and how to win against each, narrative trends to ride or avoid, likely audience sentiment and objections, and 3 emerging opportunities."
    };
    AI.ask(id, out, [{ role: "user", content: prompts[id] }]).then(function (text) {
      state.aiDocs[id] = { text: text, at: Date.now() }; persist();
      go(id); toast(AG[id].name + " updated with Claude");
    }).catch(function (err) {
      btn.disabled = false;
      btn.innerHTML = '<svg class="icon"><use href="#i-refresh"/></svg> Regenerate with Claude';
      toast("Claude error: " + err.message);
    });
  }

  /* =======================================================================
     CHAT
     ======================================================================= */
  var chatEl = $("#chat");
  function openChat(agent) {
    chatEl.classList.add("open");
    document.body.classList.add("chat-open");
    if (agent) $("#chatAgent").value = agent;
    setTimeout(function () { $("#chatInput").focus(); }, 200);
  }
  $("#chatToggle").addEventListener("click", function () {
    if (chatEl.classList.contains("open")) closeChat(); else openChat();
  });
  $("#chatClose").addEventListener("click", closeChat);
  function closeChat() { chatEl.classList.remove("open"); document.body.classList.remove("chat-open"); }

  var SUGG = ["What should I focus on today?", "Draft a teaser thread", "How do we grow our Discord?", "Who are our competitors?", "Plan launch day", "Sharpen our positioning"];

  function renderChat() {
    var log = $("#chatLog");
    if (!state.chat.length) {
      log.innerHTML = '<div class="chat__intro"><img src="assets/img/logo-mark.svg" alt="" width="40" height="40" /><b>Your team is listening.</b><p>Ask anything — questions route to the right agent automatically, with the full context of ' + esc(out.n.name) + ".</p></div>";
    } else {
      log.innerHTML = state.chat.map(bubble).join("");
    }
    $("#chatSugg").innerHTML = SUGG.map(function (s) { return '<button type="button" class="tag">' + esc(s) + "</button>"; }).join("");
    log.scrollTop = log.scrollHeight;
  }
  function bubble(m) {
    if (m.role === "user") return '<div class="bubble bubble--me">' + nl(m.content) + "</div>";
    var a = AG[m.agent] || AG.strategy;
    return '<div class="bubble bubble--ai' + (m.error ? " bubble--err" : "") + '"><span class="bubble__who mono" style="--c:' + a.color + '"><svg class="icon"><use href="#i-' + a.id + '"/></svg>' + a.name + (m.live ? " · Claude" : "") + '</span><div class="md">' + md(m.content) + "</div></div>";
  }

  $("#chatSugg").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    send(b.textContent);
  });
  var input = $("#chatInput");
  input.addEventListener("input", function () { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 140) + "px"; });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#chatForm").requestSubmit(); }
  });
  $("#chatForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = input.value.trim(); if (!v) return;
    input.value = ""; input.style.height = "auto";
    send(v);
  });

  function route(q) {
    var s = q.toLowerCase();
    var rules = [
      ["intel", /compet|rival|trend|market|sentiment|landscape|opportunit|intel/],
      ["launch", /launch|announce|runbook|influencer|creator|kol|outreach|day one|go live|t-\d/],
      ["social", /tweet|thread|post|\bx\b|twitter|content|reply|replies|viral|calendar|meme/],
      ["growth", /grow|community|discord|telegram|referral|campaign|acquisi|kpi|member|quest|partner/],
      ["brand", /brand|logo|name|position|narrative|tagline|website|copy|voice|colou?r|identity|story/]
    ];
    for (var i = 0; i < rules.length; i++) if (rules[i][1].test(s)) return rules[i][0];
    return "strategy";
  }

  function localAnswer(agent, q) {
    var n = out.n;
    var bullets = function (arr) { return arr.map(function (x) { return "- " + x; }).join("\n"); };
    switch (agent) {
      case "brand":
        return "**Positioning**\n" + out.brand.positioning + "\n\n**Lead tagline:** " + out.brand.taglines[0] + "\n\n**Narrative pillars**\n" + bullets(out.brand.pillars.map(function (p) { return "**" + p.title + "** — " + p.text; })) + "\n\nVoice: " + out.brand.voice.traits.join(", ") + ". Full brand kit is in the Brand workspace.";
      case "growth":
        var c = out.growth.campaigns[0];
        return "Start with **" + c.name + "** (" + c.dur + "): " + c.mech + " Target: " + c.target + ".\n\n**Funnel**\n" + bullets(out.growth.funnel.map(function (f) { return "**" + f.stage + ":** " + f.tactic; })) + "\n\nLaunch-day target: " + out.growth.kpis[1].community + " community members.";
      case "social":
        if (/reply|fud|rug/.test(q.toLowerCase())) return "**Reply playbook**\n" + bullets(out.social.replies.map(function (r) { return "**" + r.trigger + "** → " + r.reply; }));
        return "Here's a teaser thread draft:\n\n" + out.social.thread.map(function (t) { return t.replace(/\n/g, " "); }).join("\n\n") + "\n\nThe full 14-day calendar is in the Social workspace.";
      case "launch":
        var l = out.launch, days = E.daysToLaunch(n);
        return (days !== null ? "You're **" + (days > 0 ? "T-" + days + " days" : days === 0 ? "on launch day" : "T+" + Math.abs(days) + " days") + "** out.\n\n" : "") + "**Launch-day runbook**\n" + bullets(l.phases[2].items) + "\n\n**Announcement draft**\n" + l.announcement.replace(/\n+/g, " ");
      case "intel":
        return "**Competitive landscape**\n" + bullets(out.intel.comps.map(function (c) { return "**" + c.name + "** (" + c.threat + " threat) — " + c.win; })) + "\n\n**Top narrative to own:** " + out.intel.trends[0].name + ".\n\n**Opportunity:** " + out.intel.opportunities[0];
      default:
        return "**Today's priorities for " + n.name + "**\n" + out.strategy.priorities.map(function (p, i) { return (i + 1) + ". " + p; }).join("\n") + "\n\nFocus area this week: **" + out.strategy.focus + "** — it's your weakest dimension and caps everything else.";
    }
  }

  function send(q) {
    var sel = $("#chatAgent").value;
    var agent = sel === "auto" ? route(q) : sel;
    state.chat.push({ role: "user", content: q });
    renderChat();
    var log = $("#chatLog");
    var typing = document.createElement("div");
    typing.className = "bubble bubble--ai bubble--typing";
    typing.innerHTML = '<span class="bubble__who mono" style="--c:' + AG[agent].color + '"><svg class="icon"><use href="#i-' + agent + '"/></svg>' + AG[agent].name + '</span><div class="typing"><i></i><i></i><i></i></div>';
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    var finish = function (msg) {
      state.chat.push(msg);
      state.chat = state.chat.slice(-40);
      persist(); renderChat();
    };

    if (AI.connected()) {
      var history = state.chat.slice(-12).filter(function (m) { return !m.error; }).map(function (m) { return { role: m.role, content: m.content }; });
      AI.ask(agent, out, history).then(function (text) {
        finish({ role: "assistant", agent: agent, content: text, live: true });
      }).catch(function (err) {
        finish({ role: "assistant", agent: agent, content: localAnswer(agent, q) + "\n\n*Claude unavailable (" + err.message + ") — answered with the local engine.*", error: false });
      });
    } else {
      setTimeout(function () { finish({ role: "assistant", agent: agent, content: localAnswer(agent, q) }); }, reduce ? 50 : 700 + Math.random() * 500);
    }
  }

  /* =======================================================================
     BOOT
     ======================================================================= */
  load();
  if (state.project && location.hash !== "#new") {
    openCommand();
  } else {
    show("viewIntake");
    setStep(0);
  }
  window.addEventListener("hashchange", function () {
    var h = location.hash.slice(1);
    if (h === "new") { state.project = null; show("viewIntake"); setStep(0); }
  });
})();
