/* ==========================================================================
   Liquid glass — real backdrop refraction for elements marked `.lg`.

   For each element we render a displacement map of its rounded-rect shape
   (strong bend near the bezel, flat in the middle) and feed it to an SVG
   feDisplacementMap used as a backdrop-filter. Chromium supports SVG
   filters in backdrop-filter; other browsers keep the CSS frosted glass.
   ========================================================================== */
(function () {
  "use strict";

  var isChromium = !!(window.chrome || (navigator.userAgentData && navigator.userAgentData.brands &&
    navigator.userAgentData.brands.some(function (b) { return /Chromium/.test(b.brand); })));
  if (!isChromium) return;
  if (window.matchMedia("(prefers-reduced-transparency: reduce)").matches) return;

  var SVG_NS = "http://www.w3.org/2000/svg";
  var defs = document.createElementNS(SVG_NS, "svg");
  defs.setAttribute("class", "lg-defs");
  defs.setAttribute("aria-hidden", "true");
  document.body.appendChild(defs);

  var uid = 0;

  function sdfRoundRect(px, py, hw, hh, r) {
    var qx = Math.abs(px) - (hw - r);
    var qy = Math.abs(py) - (hh - r);
    var ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
  }

  function normalRoundRect(px, py, hw, hh, r) {
    var qx = Math.abs(px) - (hw - r);
    var qy = Math.abs(py) - (hh - r);
    var sx = px < 0 ? -1 : 1, sy = py < 0 ? -1 : 1;
    if (qx > 0 && qy > 0) {
      var l = Math.hypot(qx, qy) || 1;
      return [sx * qx / l, sy * qy / l];
    }
    return qx > qy ? [sx, 0] : [0, sy];
  }

  function buildMap(w, h, radius, bezel) {
    // Render at reduced resolution; the filter scales it back up smoothly.
    var s = Math.min(1, 320 / Math.max(w, h));
    var cw = Math.max(8, Math.round(w * s)), ch = Math.max(8, Math.round(h * s));
    var c = document.createElement("canvas");
    c.width = cw; c.height = ch;
    var ctx = c.getContext("2d");
    var img = ctx.createImageData(cw, ch);
    var d = img.data;
    var hw = w / 2, hh = h / 2;
    var r = Math.min(radius, hw, hh);
    for (var y = 0; y < ch; y++) {
      for (var x = 0; x < cw; x++) {
        var px = (x + 0.5) / s - hw;
        var py = (y + 0.5) / s - hh;
        var dist = -sdfRoundRect(px, py, hw, hh, r); // distance inside edge
        var dx = 0, dy = 0;
        if (dist > 0 && dist < bezel) {
          var t = 1 - dist / bezel;           // 1 at edge → 0 at bezel end
          var mag = t * t * (3 - 2 * t);      // smooth convex lens falloff
          var n = normalRoundRect(px, py, hw, hh, r);
          dx = -n[0] * mag; dy = -n[1] * mag;
        }
        var i = (y * cw + x) * 4;
        d[i] = 128 + dx * 127;
        d[i + 1] = 128 + dy * 127;
        d[i + 2] = 128;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  function apply(el) {
    var id = "lg-" + (++uid);
    var filter = document.createElementNS(SVG_NS, "filter");
    filter.setAttribute("id", id);
    filter.setAttribute("color-interpolation-filters", "sRGB");
    filter.setAttribute("filterUnits", "userSpaceOnUse");
    filter.setAttribute("primitiveUnits", "userSpaceOnUse");
    var feImage = document.createElementNS(SVG_NS, "feImage");
    feImage.setAttribute("result", "map");
    feImage.setAttribute("preserveAspectRatio", "none");
    var disp = document.createElementNS(SVG_NS, "feDisplacementMap");
    disp.setAttribute("in", "SourceGraphic");
    disp.setAttribute("in2", "map");
    disp.setAttribute("xChannelSelector", "R");
    disp.setAttribute("yChannelSelector", "G");
    filter.appendChild(feImage);
    filter.appendChild(disp);
    defs.appendChild(filter);

    var last = "";
    function update() {
      var w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      if (!w || !h) return;
      var key = w + "x" + h;
      if (key === last) return;
      last = key;
      var radiusAttr = parseFloat(el.getAttribute("data-lg-radius") || "24");
      var radius = Math.min(radiusAttr, h / 2, w / 2);
      var bezel = Math.min(h / 2, w / 2, parseFloat(el.getAttribute("data-lg-bezel") || "22"));
      var strength = parseFloat(el.getAttribute("data-lg-strength") || "34");
      [filter].forEach(function (f) {
        f.setAttribute("x", 0); f.setAttribute("y", 0);
        f.setAttribute("width", w); f.setAttribute("height", h);
      });
      feImage.setAttribute("x", 0); feImage.setAttribute("y", 0);
      feImage.setAttribute("width", w); feImage.setAttribute("height", h);
      feImage.setAttribute("href", buildMap(w, h, radius, bezel));
      disp.setAttribute("scale", strength);
    }

    update();
    var blur = el.getAttribute("data-lg-blur") || "6";
    var value = "blur(" + blur + "px) url(#" + id + ") saturate(175%) brightness(1.06)";
    el.style.webkitBackdropFilter = value;
    el.style.backdropFilter = value;
    el.classList.add("lg--on");

    if ("ResizeObserver" in window) new ResizeObserver(update).observe(el);
  }

  function init() {
    document.querySelectorAll(".lg").forEach(apply);
  }

  window.LiquidGlass = { apply: apply };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
