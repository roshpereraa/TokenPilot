/* ==========================================================================
   TokenPilot — marketing site interactions
   ========================================================================== */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };

  /* ---------- Nav ---------- */
  var nav = document.getElementById("nav");
  var burger = document.getElementById("burger");
  var sheet = document.getElementById("sheet");
  if (burger) {
    burger.addEventListener("click", function () {
      var open = burger.getAttribute("aria-expanded") === "true";
      burger.setAttribute("aria-expanded", String(!open));
      sheet.hidden = open;
    });
    sheet.addEventListener("click", function (e) {
      if (e.target.closest("a")) { sheet.hidden = true; burger.setAttribute("aria-expanded", "false"); }
    });
  }

  /* ---------- Reveal on scroll ---------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
        e.target.querySelectorAll("[data-count]").forEach(countUp);
      }
    });
  }, { threshold: 0.14, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll("[data-reveal]").forEach(function (el) { io.observe(el); });

  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var dec = parseInt(el.getAttribute("data-dec") || "0", 10);
    var suffix = el.getAttribute("data-suffix") || "";
    if (reduce) { el.textContent = target.toFixed(dec) + suffix; return; }
    var start = performance.now(), dur = 1600;
    (function tick(now) {
      var t = clamp((now - start) / dur, 0, 1);
      el.textContent = (target * ease(t)).toFixed(dec) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    })(start);
  }

  /* ---------- Statement: words light up with scroll ---------- */
  var statement = document.querySelector("[data-words]");
  var words = [];
  if (statement) {
    var hl = /^(story,|timing|community\.|yours\.)$/;
    var html = statement.textContent.trim().split(/\s+/).map(function (w) {
      return '<span class="w' + (hl.test(w) ? " hl" : "") + '">' + w + "</span>";
    }).join(" ");
    statement.innerHTML = html;
    words = Array.prototype.slice.call(statement.querySelectorAll(".w"));
  }

  /* ---------- Lifecycle sticky ---------- */
  var lcSteps = Array.prototype.slice.call(document.querySelectorAll(".lc-step"));
  var lcPanels = document.querySelectorAll(".lc-panel");
  var lcLabels = document.querySelectorAll(".lc-rail span");
  var lcFill = document.getElementById("lcFill");
  var lcActive = -1;
  function setLifecycle(i) {
    if (i === lcActive) return;
    lcActive = i;
    lcPanels.forEach(function (p, k) { p.classList.toggle("is-on", k === i); });
    lcLabels.forEach(function (s, k) { s.classList.toggle("on", k <= i); });
    lcSteps.forEach(function (s, k) { s.classList.toggle("on", k === i); });
    if (lcFill) lcFill.style.width = (i / 4) * 100 + "%";
  }
  setLifecycle(0);

  /* ---------- Scroll loop ---------- */
  var preview = document.getElementById("preview");
  var stage = document.getElementById("stage");
  var ticking = false;

  function onScroll() {
    var y = window.scrollY;
    var vh = window.innerHeight;
    if (nav) nav.classList.toggle("scrolled", y > 24);

    // Dashboard tilt: lies back at load, rises to face the viewer as you scroll
    if (preview && stage) {
      var r = stage.getBoundingClientRect();
      var t = clamp(1 - (r.top - vh * 0.18) / (vh * 0.62), 0, 1);
      if (reduce) t = 1;
      var e = ease(t);
      preview.style.setProperty("--tilt", lerp(26, 0, e).toFixed(2) + "deg");
      preview.style.setProperty("--scale", lerp(0.9, 1, e).toFixed(4));
      preview.style.setProperty("--op", lerp(0.55, 1, e).toFixed(3));
    }

    // Statement words
    if (words.length) {
      var sr = statement.getBoundingClientRect();
      var p = clamp((vh * 0.82 - sr.top) / (sr.height + vh * 0.3), 0, 1);
      var lit = Math.round(p * words.length * 1.08);
      for (var i = 0; i < words.length; i++) words[i].classList.toggle("on", i < lit);
    }

    // Lifecycle — the step closest to the viewport centre wins
    if (lcSteps.length) {
      var best = 0, bestD = Infinity;
      lcSteps.forEach(function (s, k) {
        var b = s.getBoundingClientRect();
        var d = Math.abs(b.top + b.height / 2 - vh * 0.55);
        if (d < bestD) { bestD = d; best = k; }
      });
      setLifecycle(best);
    }

    // Orb drift
    orbScroll = y;
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener("resize", onScroll);

  /* ---------- Glass pointer sheen ---------- */
  document.addEventListener("pointermove", function (e) {
    var g = e.target.closest && e.target.closest(".glass");
    if (!g) return;
    var b = g.getBoundingClientRect();
    g.style.setProperty("--mx", ((e.clientX - b.left) / b.width) * 100 + "%");
    g.style.setProperty("--my", ((e.clientY - b.top) / b.height) * 100 + "%");
  }, { passive: true });

  /* ---------- Hero orb: a rotating star-field sphere with an orbit ring ---------- */
  var orbScroll = 0;
  var canvas = document.getElementById("orb");
  if (canvas) {
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, R = 0, cx = 0, cy = 0;
    var pts = [], ring = [];
    var N = window.innerWidth < 760 ? 900 : 1700;
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var k = 0; k < N; k++) {
      var yy = 1 - (k / (N - 1)) * 2;
      var rad = Math.sqrt(1 - yy * yy);
      var th = golden * k;
      var jitter = 1 + (Math.random() - 0.5) * 0.04;
      pts.push([Math.cos(th) * rad * jitter, yy * jitter, Math.sin(th) * rad * jitter, Math.random()]);
    }
    for (var m = 0; m < 260; m++) {
      var a = (m / 260) * Math.PI * 2;
      ring.push([a, 1.42 + (Math.random() - 0.5) * 0.08, Math.random()]);
    }

    var size = function () {
      var b = canvas.getBoundingClientRect();
      W = b.width; H = b.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      R = Math.min(W * 0.2, 290);
      if (window.innerWidth < 760) R = Math.min(W * 0.36, 200);
      cx = W / 2; cy = H * 0.42;
    };
    size();
    window.addEventListener("resize", size);

    var mx = 0, my = 0, tmx = 0, tmy = 0;
    window.addEventListener("pointermove", function (e) {
      tmx = (e.clientX / window.innerWidth - 0.5);
      tmy = (e.clientY / window.innerHeight - 0.5);
    }, { passive: true });

    var visible = true;
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(canvas);

    var rot = 0;
    var draw = function () {
      ctx.clearRect(0, 0, W, H);
      mx += (tmx - mx) * 0.04; my += (tmy - my) * 0.04;
      var ry = rot + mx * 0.6;
      var rx = -0.32 + my * 0.3 + orbScroll * 0.0004;
      var cyy = cy - orbScroll * 0.25;
      var fade = clamp(1 - orbScroll / 900, 0, 1);
      if (fade <= 0) return;
      var cY = Math.cos(ry), sY = Math.sin(ry), cX = Math.cos(rx), sX = Math.sin(rx);
      var fov = 3.2;

      // Back glow
      var g = ctx.createRadialGradient(cx, cyy, R * 0.2, cx, cyy, R * 1.6);
      g.addColorStop(0, "rgba(110,91,255," + 0.16 * fade + ")");
      g.addColorStop(1, "rgba(110,91,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        var x = p[0] * cY + p[2] * sY;
        var z = -p[0] * sY + p[2] * cY;
        var y = p[1] * cX - z * sX;
        z = p[1] * sX + z * cX;
        var s = fov / (fov - z);
        var depth = (z + 1) / 2; // 0 back → 1 front
        var tw = 0.65 + 0.35 * Math.sin(p[3] * 40 + rot * 6);
        var alpha = (0.06 + depth * 0.6) * tw * fade;
        var r = (0.5 + depth * 1.1) * (p[3] > 0.97 ? 1.8 : 1);
        ctx.fillStyle = depth > 0.55
          ? "rgba(" + (190 + depth * 50 | 0) + "," + (180 + depth * 50 | 0) + ",255," + alpha + ")"
          : "rgba(124,108,255," + alpha + ")";
        ctx.beginPath();
        ctx.arc(cx + x * R * s, cyy + y * R * s, r, 0, 6.2832);
        ctx.fill();
      }

      // Orbit ring (tilted like the logo)
      var tilt = -0.52, cT = Math.cos(tilt), sT = Math.sin(tilt);
      for (var j = 0; j < ring.length; j++) {
        var q = ring[j];
        var ang = q[0] + rot * 1.8;
        var ox = Math.cos(ang) * q[1];
        var oz = Math.sin(ang) * q[1];
        var oy = oz * 0.32;
        var px = ox * cT - oy * sT, py = ox * sT + oy * cT;
        var d2 = (oz / q[1] + 1) / 2;
        var sc = fov / (fov - oz * 0.6);
        var al = (0.15 + d2 * 0.7) * fade * (0.5 + q[2] * 0.5);
        ctx.fillStyle = d2 > 0.5 ? "rgba(59,232,200," + al + ")" : "rgba(139,123,255," + al * 0.7 + ")";
        ctx.beginPath();
        ctx.arc(cx + px * R * sc, cyy + py * R * sc, 0.6 + d2 * 1.2, 0, 6.2832);
        ctx.fill();
      }
    };

    var loop = function () {
      if (visible) { rot += 0.0016; draw(); }
      requestAnimationFrame(loop);
    };
    if (reduce) draw(); else requestAnimationFrame(loop);
  }

  /* ---------- Launch film ---------- */
  var film = document.getElementById("filmVideo"), filmPlay = document.getElementById("filmPlay");
  if (film && filmPlay) {
    var startFilm = function () {
      filmPlay.hidden = true;
      film.controls = true;
      var pr = film.play();
      if (pr && pr.catch) pr.catch(function () { filmPlay.hidden = false; film.controls = false; });
    };
    filmPlay.addEventListener("click", startFilm);
    film.addEventListener("play", function () { filmPlay.hidden = true; });
    film.addEventListener("ended", function () { filmPlay.hidden = false; film.controls = false; film.load(); });
    document.querySelectorAll("[data-play-film]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        document.getElementById("film").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
        setTimeout(startFilm, reduce ? 0 : 650);
      });
    });
    // Pause when scrolled away
    new IntersectionObserver(function (en) { if (!en[0].isIntersecting && !film.paused) film.pause(); }, { threshold: 0.2 }).observe(film);
  }

  /* ---------- Pricing (Monthly / Annual) ---------- */
  if (window.TPPricing) {
    window.TPPricing.render(document, "monthly");
    var pricing = document.getElementById("pricing");
    if (pricing) window.TPPricing.bindToggle(pricing, "monthly");
  }

  onScroll();
})();
