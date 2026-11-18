(function (root) {
  'use strict';
  // Rectangle packing for film rolls (MaxRects with several heuristics and a
  // deterministic improvement phase). All values are integers (1/100 cm).

  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function subtract(f, p) {
    if (!overlap(f, p)) return [f];
    const x = Math.max(f.x, p.x), y = Math.max(f.y, p.y), r = Math.min(f.x + f.w, p.x + p.w), b = Math.min(f.y + f.h, p.y + p.h);
    return [
      { x: f.x, y: f.y, w: f.w, h: y - f.y },
      { x: f.x, y: b, w: f.w, h: f.y + f.h - b },
      { x: f.x, y, w: x - f.x, h: b - y },
      { x: r, y, w: f.x + f.w - r, h: b - y }
    ].filter(q => q.w > 0 && q.h > 0);
  }

  // Deterministic PRNG so the same input always produces the same plan.
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Free-rectangle choice heuristics. Lower tuple wins.
  const HEURISTICS = [
    (f, w, h) => [f.y + h, f.x],                                                // bottom-left
    (f, w, h) => [Math.min(f.w - w, f.h - h), Math.max(f.w - w, f.h - h), f.y], // best short side
    (f, w, h) => [Math.max(f.w - w, f.h - h), Math.min(f.w - w, f.h - h), f.y], // best long side
    (f, w, h) => [f.w * f.h - w * h, Math.min(f.w - w, f.h - h), f.y],          // best area
    (f, w, h) => [f.y, f.x, f.w * f.h - w * h]                                  // top-left first
  ];

  const better = (a, b) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
    return false;
  };

  function pruneFree(list) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      let contained = false;
      for (let j = 0; j < list.length && !contained; j++) {
        if (i === j) continue;
        const b = list[j];
        if (a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h) {
          // identical rectangles: keep only the first one
          contained = !(a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h) || j < i;
        }
      }
      if (!contained) out.push(a);
    }
    return out;
  }

  // parts: inflated sizes (w,h include the cut gap). order: array of parts.
  function pack(order, W, H, rotate, heuristic, flipFirst, limit) {
    let free = [{ x: 0, y: 0, w: W, h: H }];
    const placed = [];
    let length = 0;
    for (const p of order) {
      let best = null;
      const turns = rotate && p.w !== p.h ? (flipFirst ? [true, false] : [false, true]) : [false];
      for (const f of free) {
        for (const turn of turns) {
          const w = turn ? p.h : p.w, h = turn ? p.w : p.h;
          if (w > f.w || h > f.h) continue;
          const score = heuristic(f, w, h);
          if (!best || better(score, best.score)) best = { p, x: f.x, y: f.y, w, h, rotated: turn, score };
        }
      }
      if (!best) return null;
      if (best.y + best.h > length) { length = best.y + best.h; if (length >= limit) return null; }
      placed.push(best);
      const next = [];
      for (const f of free) {
        if (!overlap(f, best)) { next.push(f); continue; }
        if (best.x > f.x) next.push({ x: f.x, y: f.y, w: best.x - f.x, h: f.h });
        if (best.x + best.w < f.x + f.w) next.push({ x: best.x + best.w, y: f.y, w: f.x + f.w - best.x - best.w, h: f.h });
        if (best.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: best.y - f.y });
        if (best.y + best.h < f.y + f.h) next.push({ x: f.x, y: best.y + best.h, w: f.w, h: f.y + f.h - best.y - best.h });
      }
      free = pruneFree(next);
    }
    // Secondary objective: keep the plan compact towards the start of the roll.
    let spread = 0;
    for (const q of placed) spread += q.y + q.h;
    return { placed, length, spread };
  }

  function validate(result, parts, W, H, rotate, gap = 0) {
    if (result.placed.length !== parts.length) throw Error('Unvollständiger Plan.');
    const ids = new Set();
    for (const p of result.placed) {
      const original = parts.find(a => a.id === p.id);
      if (!original || ids.has(p.id)) throw Error('Doppelte oder unbekannte Teile.');
      ids.add(p.id);
      if (p.x < 0 || p.y < 0 || p.x + p.w > W || p.y + p.h > H) throw Error('Teil ausserhalb der Rolle.');
      if (!((p.w === original.w && p.h === original.h) || (rotate && p.w === original.h && p.h === original.w))) throw Error('Falsche Masse oder Strukturrichtung.');
    }
    const grow = p => ({ x: p.x, y: p.y, w: p.w + gap, h: p.h + gap });
    for (let i = 0; i < result.placed.length; i++)
      for (let j = i + 1; j < result.placed.length; j++)
        if (overlap(grow(result.placed[i]), grow(result.placed[j]))) throw Error(gap ? 'Teile unterschreiten die Schnittfuge.' : 'Überlappende Teile.');
  }

  // Join neighbouring leftover rectangles so the rest list shows larger,
  // more useful offcuts instead of many slivers.
  function mergeRest(list) {
    let rects = list.map(r => ({ ...r }));
    let changed = true;
    while (changed) {
      changed = false;
      outer: for (let i = 0; i < rects.length; i++) {
        for (let j = 0; j < rects.length; j++) {
          if (i === j) continue;
          const a = rects[i], b = rects[j];
          let m = null;
          if (a.x === b.x && a.w === b.w && a.y + a.h === b.y) m = { x: a.x, y: a.y, w: a.w, h: a.h + b.h };
          else if (a.y === b.y && a.h === b.h && a.x + a.w === b.x) m = { x: a.x, y: a.y, w: a.w + b.w, h: a.h };
          if (m) { rects = rects.filter((_, k) => k !== i && k !== j); rects.push(m); changed = true; break outer; }
        }
      }
    }
    return rects;
  }

  function optimize(parts, W, H, rotate, options = {}) {
    const gap = Math.max(0, Math.round(Number(options.gap) || 0));
    if (!parts.length || !Number.isSafeInteger(W * H) || W <= 0 || H <= 0) throw Error('Bitte gültige Rollenmasse und mindestens ein Teil eingeben.');
    for (const p of parts) if (!Number.isInteger(p.w) || !Number.isInteger(p.h) || p.w <= 0 || p.h <= 0) throw Error('Ungültige Teilmasse.');
    const tooBig = parts.find(p => !(p.w <= W && p.h <= H) && !(rotate && p.h <= W && p.w <= H));
    if (tooBig) throw Error('„' + (tooBig.name || 'Ein Teil') + '“ passt nicht auf die Rolle (' + (tooBig.w / 100) + ' × ' + (tooBig.h / 100) + ' cm). Bitte Masse und Folientyp prüfen.');
    if (parts.reduce((s, p) => s + p.w * p.h, 0) > W * H) throw Error('Die Zuschnittfläche ist grösser als die gesamte Rolle.');

    // Pack inflated parts on an inflated roll: every part keeps `gap` free
    // space to its right and below; the last column/row needs no gap.
    const inflated = parts.map(p => ({ ...p, w: p.w + gap, h: p.h + gap }));
    const Wi = W + gap, Hi = H + gap;
    const sorts = [
      p => p.w * p.h, p => Math.max(p.w, p.h), p => p.h, p => p.w, p => Math.min(p.w, p.h), p => p.w + p.h,
      p => Math.max(p.w, p.h) / Math.min(p.w, p.h)
    ];
    let best = null;
    const consider = r => {
      if (r && (!best || r.length < best.length || (r.length === best.length && r.spread < best.spread))) best = r;
    };
    const ordered = sorts.map(sort => [...inflated].sort((a, b) => sort(b) - sort(a) || a.id - b.id));
    for (const order of ordered)
      for (const h of HEURISTICS)
        for (const flip of rotate ? [false, true] : [false]) consider(pack(order, Wi, Hi, rotate, h, flip, Infinity));

    // Improvement phase: perturb the best orders slightly and retry.
    const budget = options.iterations !== undefined ? options.iterations : Math.max(40, Math.min(400, Math.round(60000 / (parts.length + 10))));
    const deadline = Date.now() + (options.timeLimit || 1500);
    const random = rng(parts.length * 7919 + W * 31 + H);
    for (let i = 0; i < budget && best && Date.now() < deadline; i++) {
      const base = ordered[Math.floor(random() * ordered.length)].slice();
      const swaps = 1 + Math.floor(random() * Math.max(1, base.length / 6));
      for (let s = 0; s < swaps; s++) {
        const a = Math.floor(random() * base.length), b = Math.min(base.length - 1, a + 1 + Math.floor(random() * 3));
        [base[a], base[b]] = [base[b], base[a]];
      }
      consider(pack(base, Wi, Hi, rotate, HEURISTICS[Math.floor(random() * HEURISTICS.length)], random() < 0.5, best.length + 1));
    }
    if (!best) throw Error('Für diese Rollenlänge wurde keine passende Anordnung gefunden. Bitte eine längere Rolle versuchen.');

    const placed = best.placed.map(q => {
      const original = q.p;
      return { id: original.id, name: original.name, x: q.x, y: q.y, w: q.w - gap, h: q.h - gap, rotated: q.rotated };
    });
    const length = Math.max(...placed.map(p => p.y + p.h));
    const result = { placed, length, gap };
    validate(result, parts, W, H, rotate, gap);
    let rest = [{ x: 0, y: 0, w: W, h: length }];
    for (const p of placed) {
      const cutZone = { x: p.x, y: p.y, w: Math.min(p.w + gap, W - p.x), h: Math.min(p.h + gap, length - p.y) };
      rest = rest.flatMap(f => subtract(f, cutZone));
    }
    // Strips narrower than 1 cm are unusable: list them as scrap, not as offcuts.
    const merged = mergeRest(rest).sort((a, b) => a.y - b.y || a.x - b.x);
    const minRest = options.minRest !== undefined ? options.minRest : 100;
    result.rest = merged.filter(r => Math.min(r.w, r.h) >= minRest);
    result.scrap = merged.filter(r => Math.min(r.w, r.h) < minRest);
    result.area = parts.reduce((s, p) => s + p.w * p.h, 0);
    const restArea = merged.reduce((s, p) => s + p.w * p.h, 0);
    result.kerfArea = W * length - result.area - restArea;
    if (result.kerfArea < 0 || (!gap && result.kerfArea !== 0)) throw Error('Fehler in der Flächenprüfung.');
    return result;
  }

  const api = { optimize, validate, subtract, overlap, mergeRest };
  if (typeof module !== 'undefined') module.exports = api; else root.Packing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
