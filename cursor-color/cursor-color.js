/*
 * cursor-color.js
 *
 * Shifts a page's colors with the cursor's horizontal position.
 *   - Cursor on the left edge  -> the section's default colors (unchanged).
 *   - Cursor on the right edge -> colors taken from the dominant hue of the
 *                                 image currently most visible on screen.
 *
 * The lightness of every default color is kept and only the hue and
 * saturation change, so a dark section stays dark and grey text stays the
 * same brightness. Each frame also checks the WCAG contrast ratio and never
 * lets it drop below the section's own default contrast.
 *
 * Usage:
 *   <section data-bg="#f4f1ea" data-fg="#6b6b6b"> ... <img src="..."> ... </section>
 *   <script src="cursor-color.js"></script>
 *
 * Optional attributes on a section:
 *   data-bg / data-fg   default colors (otherwise read from computed styles)
 *   data-accent         fixed right-side color, skipping image sampling
 *
 * The current colors are also exposed as CSS variables on <html>:
 *   --cc-bg, --cc-fg, --cc-accent
 */
(function () {
  'use strict';

  var config = Object.assign({
    sections: '[data-bg], section',  // which elements define color sections
    target: document.body,           // element whose background/color is set
    strength: 1,                     // 0..1, how far the right edge goes
    maxBgChroma: 0.04,               // caps background saturation (OKLCH chroma, ~0-0.37)
    textChroma: 0.35,                // text saturation relative to accent
    smoothing: 0.14                  // 0..1 per frame, 1 = instant
  }, window.CursorColorConfig || {});

  /* ---------- color math (sRGB <-> OKLab, WCAG contrast) ---------- */

  function toLinear(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function fromLinear(c) { c = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return c * 255; }

  function rgbToLab(rgb) {
    var r = toLinear(rgb[0]), g = toLinear(rgb[1]), b = toLinear(rgb[2]);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
  }

  // Returns linear RGB, possibly out of [0,1] (out of gamut).
  function labToLinear(lab) {
    var l = Math.pow(lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2], 3);
    var m = Math.pow(lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2], 3);
    var s = Math.pow(lab[0] - 0.0894841775 * lab[1] - 1.2914855480 * lab[2], 3);
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    ];
  }

  function inGamut(lin) { return lin.every(function (c) { return c >= -1e-4 && c <= 1 + 1e-4; }); }

  function labToRgb(lab) {
    return labToLinear(lab).map(function (c) { return Math.round(fromLinear(Math.min(1, Math.max(0, c)))); });
  }

  // Build an in-gamut OKLab color from lightness, chroma and hue, lowering chroma if needed.
  function lch(L, C, h) {
    var lo = 0, hi = C, lab = [L, C * Math.cos(h), C * Math.sin(h)];
    if (inGamut(labToLinear(lab))) return lab;
    for (var i = 0; i < 14; i++) {
      var mid = (lo + hi) / 2;
      if (inGamut(labToLinear([L, mid * Math.cos(h), mid * Math.sin(h)]))) lo = mid; else hi = mid;
    }
    return [L, lo * Math.cos(h), lo * Math.sin(h)];
  }

  function chroma(lab) { return Math.hypot(lab[1], lab[2]); }
  function hue(lab) { return Math.atan2(lab[2], lab[1]); }
  function distance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  function luminance(lab) {
    var lin = labToLinear(lab).map(function (c) { return Math.min(1, Math.max(0, c)); });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  }
  function contrast(a, b) {
    var x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  // Push the text color's lightness away from the background until the ratio is met.
  function enforceContrast(bg, fg, minRatio, textIsLighter) {
    if (contrast(bg, fg) >= minRatio) return fg;
    var C = chroma(fg), h = hue(fg), L = fg[0];
    for (var i = 0; i < 40 && contrast(bg, fg) < minRatio; i++) {
      L = Math.min(1, Math.max(0, L + (textIsLighter ? 0.01 : -0.01)));
      fg = lch(L, C, h);
    }
    return fg;
  }

  function parseColor(str) {
    var ctx = parseColor.ctx || (parseColor.ctx = document.createElement('canvas').getContext('2d'));
    ctx.fillStyle = '#000';
    ctx.fillStyle = str;
    ctx.fillRect(0, 0, 1, 1);
    var d = ctx.getImageData(0, 0, 1, 1).data;
    return { rgb: [d[0], d[1], d[2]], transparent: /transparent|rgba\(.*,\s*0\)/.test(str) };
  }

  function css(lab) { var c = labToRgb(lab); return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

  /* ---------- dominant color of an image ---------- */

  var accentCache = new WeakMap();

  function dominantColor(img) {
    if (accentCache.has(img)) return accentCache.get(img);
    var result = null;
    try {
      var size = 48, canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      var ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, size, size);
      var data = ctx.getImageData(0, 0, size, size).data;

      // Weighted hue histogram: saturated, mid-light pixels count most.
      var bins = [], all = [0, 0, 0], n = 0;
      for (var i = 0; i < 24; i++) bins.push({ w: 0, lab: [0, 0, 0] });
      for (var p = 0; p < data.length; p += 4) {
        if (data[p + 3] < 200) continue;
        var lab = rgbToLab([data[p], data[p + 1], data[p + 2]]);
        all[0] += lab[0]; all[1] += lab[1]; all[2] += lab[2]; n++;
        var C = chroma(lab);
        if (C < 0.03 || lab[0] < 0.15 || lab[0] > 0.95) continue;
        var bin = bins[Math.floor(((hue(lab) + Math.PI) / (2 * Math.PI)) * 24) % 24];
        var w = C * (1 - Math.abs(lab[0] - 0.6));
        bin.w += w;
        bin.lab[0] += lab[0] * w; bin.lab[1] += lab[1] * w; bin.lab[2] += lab[2] * w;
      }
      // Combine each bin with its neighbours so a hue split across two bins still wins.
      var best = null, bestW = 0;
      bins.forEach(function (b, k) {
        var prev = bins[(k + 23) % 24], next = bins[(k + 1) % 24], w = b.w + 0.5 * (prev.w + next.w);
        if (b.w > 0 && w > bestW) { bestW = w; best = b; }
      });
      if (best) result = best.lab.map(function (v) { return v / best.w; });
      else if (n) result = all.map(function (v) { return v / n; }); // grey image -> grey accent
    } catch (e) {
      // Cross-origin image without CORS headers: canvas is tainted, skip it.
      result = null;
    }
    accentCache.set(img, result);
    return result;
  }

  /* ---------- sections ---------- */

  var sections = [];

  function readSections() {
    var bodyStyle = getComputedStyle(document.body);
    var fallbackBg = parseColor(bodyStyle.backgroundColor);
    var fallbackFg = parseColor(bodyStyle.color);
    sections = Array.prototype.map.call(document.querySelectorAll(config.sections), function (el) {
      var style = getComputedStyle(el);
      var bg = el.dataset.bg ? parseColor(el.dataset.bg) : parseColor(style.backgroundColor);
      if (bg.transparent && !el.dataset.bg) bg = fallbackBg.transparent ? parseColor('#fff') : fallbackBg;
      var fg = el.dataset.fg ? parseColor(el.dataset.fg) : parseColor(style.color || fallbackFg);
      var bgLab = rgbToLab(bg.rgb), fgLab = rgbToLab(fg.rgb);
      return {
        el: el,
        bg: bgLab,
        fg: fgLab,
        ratio: contrast(bgLab, fgLab) + 0.05, // small margin for 8-bit rounding
        accent: el.dataset.accent ? rgbToLab(parseColor(el.dataset.accent).rgb) : null
      };
    });
  }

  // The section that holds the middle of the viewport.
  function activeSection() {
    var mid = window.innerHeight / 2, best = sections[0];
    for (var i = 0; i < sections.length; i++) {
      var r = sections[i].el.getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) return sections[i];
      if (r.top <= mid) best = sections[i];
    }
    return best;
  }

  // The loaded image with the most visible area, preferring the active section's own images.
  function visibleImage(section) {
    function pick(imgs) {
      var best = null, bestArea = 0, vw = window.innerWidth, vh = window.innerHeight;
      Array.prototype.forEach.call(imgs, function (img) {
        if (!img.complete || !img.naturalWidth) return;
        var r = img.getBoundingClientRect();
        var area = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) *
                   Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
        if (area > bestArea) { bestArea = area; best = img; }
      });
      return best;
    }
    return pick(section.el.querySelectorAll('img')) || pick(document.images);
  }

  /* ---------- palette for a given cursor position ---------- */

  function paletteFor(section, t) {
    var accent = section.accent;
    if (!accent) {
      var img = visibleImage(section);
      accent = img && dominantColor(img);
    }
    if (!accent || t <= 0) return { bg: section.bg, fg: section.fg, accent: accent || section.bg };

    // Right edge: the accent's hue at the section's original lightness.
    var h = hue(accent), C = chroma(accent);
    var rightBg = lch(section.bg[0], Math.min(C, config.maxBgChroma), h);
    var rightFg = lch(section.fg[0], Math.max(chroma(section.fg), C * config.textChroma), h);

    var k = t * config.strength;
    var bg = mix(section.bg, rightBg, k);
    var fg = mix(section.fg, rightFg, k);
    fg = enforceContrast(bg, fg, section.ratio, section.fg[0] > section.bg[0]);
    return { bg: bg, fg: fg, accent: accent };
  }

  /* ---------- render loop ---------- */

  var enabled = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cursorT = 0, current = null, frame = 0;

  function apply(p) {
    var root = document.documentElement.style;
    root.setProperty('--cc-bg', css(p.bg));
    root.setProperty('--cc-fg', css(p.fg));
    root.setProperty('--cc-accent', css(p.accent));
    if (config.target) {
      config.target.style.backgroundColor = css(p.bg);
      config.target.style.color = css(p.fg);
    }
  }

  function tick() {
    frame = 0;
    var section = activeSection();
    if (!section) return;
    var want = paletteFor(section, cursorT);
    if (!current) current = want;
    var s = reduceMotion ? 1 : config.smoothing;
    var next = {
      bg: mix(current.bg, want.bg, s),
      fg: mix(current.fg, want.fg, s),
      accent: mix(current.accent, want.accent, s)
    };
    // Keep the in-between frames at the same contrast as the target.
    if (cursorT > 0) next.fg = enforceContrast(next.bg, next.fg, section.ratio, section.fg[0] > section.bg[0]);
    // Snap exactly onto the target once close, so the left edge is the untouched default.
    if (distance(next.bg, want.bg) + distance(next.fg, want.fg) < 1e-3) next = want;
    current = next;
    apply(current);
    if (distance(current.bg, want.bg) + distance(current.fg, want.fg) > 1e-3) schedule();
  }

  function schedule() { if (!frame) frame = requestAnimationFrame(tick); }

  function init() {
    readSections();
    if (!sections.length) return;
    if (enabled) {
      document.addEventListener('pointermove', function (e) {
        cursorT = Math.min(1, Math.max(0, e.clientX / window.innerWidth));
        schedule();
      }, { passive: true });
      document.documentElement.addEventListener('pointerleave', function () { cursorT = 0; schedule(); });
    }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // Images may finish loading after init; recompute when they do.
    Array.prototype.forEach.call(document.images, function (img) {
      if (!img.complete) img.addEventListener('load', schedule, { once: true });
    });
    schedule();
  }

  window.CursorColor = { refresh: function () { readSections(); schedule(); } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
