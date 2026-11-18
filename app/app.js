'use strict';
const $ = id => document.getElementById(id);
const fmt = (n, d = 2) => n.toLocaleString('de-CH', { maximumFractionDigits: d });
const cm = n => fmt(n / 100);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MAX_PARTS = 500;
let current = null;
let cutDone = new Set();

/* ---------- Toast with optional action (e.g. "Rückgängig") ---------- */
let toastTimer;
function showToast(text, actionLabel, action) {
  const box = $('toast');
  box.querySelector('p').textContent = text;
  const button = $('toast-action');
  button.hidden = !actionLabel;
  if (actionLabel) {
    button.textContent = actionLabel;
    button.onclick = () => { box.classList.remove('show'); action(); };
  }
  box.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('show'), actionLabel ? 7000 : 3200);
}
window.showToast = showToast;

/* ---------- Number parsing: accepts 60,5 and 60.5 ---------- */
function parseNumber(value) {
  const text = String(value ?? '').trim().replace(/\s|'/g, '').replace(',', '.');
  if (!text || !/^-?\d*\.?\d+$/.test(text)) return NaN;
  return Number(text);
}
window.parseNumber = parseNumber;

function invalid(el, message) {
  el.classList.add('invalid');
  el.focus();
  el.select?.();
  throw Error(message);
}
function numeric(el, title, allowZero = false) {
  const v = parseNumber(el.value);
  if (!Number.isFinite(v) || (allowZero ? v < 0 : v <= 0) || Math.abs(v * 100 - Math.round(v * 100)) > 0.00001)
    invalid(el, title + ': Bitte eine gültige Zahl mit höchstens zwei Nachkommastellen eingeben (z. B. 60,5).');
  return v;
}

/* ---------- Results become stale when inputs change ---------- */
function stale() {
  if (!current) return;
  $('status').textContent = 'Eingaben geändert · neu berechnen';
  $('status').classList.add('stale');
  $('results').hidden = true;
  $('empty').hidden = false;
  $('empty').querySelector('h2').textContent = 'Eingaben geändert.';
  $('empty').querySelector('p').textContent = 'Bitte neu berechnen, um den aktuellen Plan zu sehen.';
}

/* ---------- Rows ---------- */
// Row data is always [Bezeichnung, Breite, Länge, Anzahl, Zugabe] – the
// order used by project files. On screen Zugabe sits before Anzahl.
function rowInputs(tr) { return [...tr.querySelectorAll('input[data-i]')].sort((a, b) => a.dataset.i - b.dataset.i); }
function domInputs(tr) { return [...tr.querySelectorAll('input[data-i]')]; }
const defaultRowAllowance = () => { const a = window.DBToolsPreferences?.rowAllowance; return a === undefined ? '3' : String(a).replace('.', ','); };
function addRow(v = [], before = null, quiet = false) {
  const tr = document.createElement('tr');
  tr.innerHTML =
    '<td><input data-i="0" aria-label="Bezeichnung" maxlength="80" placeholder="z. B. Küchenfront"></td>' +
    '<td><input data-i="1" aria-label="Breite in cm" inputmode="decimal" autocomplete="off" placeholder="cm"></td>' +
    '<td><input data-i="2" aria-label="Länge in cm" inputmode="decimal" autocomplete="off" placeholder="cm"></td>' +
    '<td class="allow-cell"><input data-i="4" aria-label="Zugabe pro Seite in cm" title="Zugabe pro Seite in cm – wird auf jeder Seite addiert" inputmode="decimal" autocomplete="off"></td>' +
    '<td><input data-i="3" aria-label="Anzahl" inputmode="numeric" autocomplete="off" value="1"></td>' +
    '<td class="row-actions"><button class="row-copy" title="Position duplizieren" aria-label="Position duplizieren">⧉</button><button class="row-delete" title="Position löschen" aria-label="Position löschen">×</button></td>';
  const f = rowInputs(tr), order = domInputs(tr);
  v.forEach((x, k) => { if (x !== undefined && x !== null && f[k]) f[k].value = x; });
  if (v[4] === undefined || v[4] === null) f[4].value = defaultRowAllowance();
  tr.querySelector('.row-delete').onclick = () => removeRow(tr);
  tr.querySelector('.row-copy').onclick = () => {
    const copy = addRow([...rowInputs(tr)].map(i => i.value), tr.nextSibling);
    rowInputs(copy)[0].focus();
  };
  tr.addEventListener('input', e => { e.target.classList.remove('invalid'); stale(); save(); });
  tr.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const k = order.indexOf(e.target);
    if (k === order.length - 1) {
      if (!tr.nextElementSibling) addRow();
      rowInputs(tr.nextElementSibling)[0].focus();
    } else if (order[k + 1]) { order[k + 1].focus(); order[k + 1].select?.(); }
  });
  tr.addEventListener('paste', e => pasteRows(e, tr));
  $('rows').insertBefore(tr, before);
  if (!quiet) { stale(); save(); }
  return tr;
}
function removeRow(tr) {
  const values = [...rowInputs(tr)].map(i => i.value), next = tr.nextSibling;
  tr.remove();
  if (!$('rows').children.length) addRow();
  stale(); save();
  if (values.some((x, i) => i < 3 && x.trim())) showToast('Position „' + (values[0] || 'ohne Namen') + '“ gelöscht.', 'Rückgängig', () => {
    const blank = $('rows').children.length === 1 && rowsData()[0].slice(0, 3).every(x => !x.trim());
    if (blank) $('rows').innerHTML = '';
    addRow(values, next && next.parentNode ? next : null);
  });
}

// Paste rows straight from Excel, Numbers or a text list.
function pasteRows(event, tr) {
  const text = event.clipboardData?.getData('text/plain') || '';
  if (!/[\t\n]/.test(text.trim())) return;
  const lines = text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean)
    .map(l => l.split(/\t|;/).map(c => c.trim()));
  const rows = [];
  for (const cells of lines) {
    const nums = cells.map(parseNumber);
    let row;
    if (cells.length >= 3 && !Number.isFinite(nums[0]) && Number.isFinite(nums[1]) && Number.isFinite(nums[2]))
      row = [cells[0], cells[1], cells[2], Number.isInteger(nums[3]) && nums[3] > 0 ? cells[3] : '1', nums[4] >= 0 ? cells[4] : defaultRowAllowance()];
    else if (cells.length >= 2 && Number.isFinite(nums[0]) && Number.isFinite(nums[1]))
      row = ['Teil ' + (rows.length + 1), cells[0], cells[1], Number.isInteger(nums[2]) && nums[2] > 0 ? cells[2] : '1', nums[3] >= 0 ? cells[3] : defaultRowAllowance()];
    if (row) rows.push(row.map(String));
  }
  if (!rows.length) return;
  event.preventDefault();
  const empty = [...rowInputs(tr)].slice(0, 3).every(i => !i.value.trim());
  let anchor = tr.nextSibling;
  if (empty) tr.remove();
  rows.forEach(r => addRow(r, anchor, true));
  stale(); save();
  showToast(rows.length + (rows.length === 1 ? ' Position' : ' Positionen') + ' eingefügt.');
}

function rowsData() { return [...$('rows').children].map(tr => rowInputs(tr).map(i => i.value)); }

function updateSummary() {
  let positions = 0, count = 0, area = 0;
  for (const [name, w, h, n, al] of rowsData()) {
    const W = parseNumber(w), H = parseNumber(h), N = parseNumber(n), A = parseNumber(al) >= 0 ? parseNumber(al) : 0;
    if (!(W > 0 && H > 0)) continue;
    const k = Number.isInteger(N) && N > 0 ? N : 1;
    positions++; count += k; area += (W + 2 * A) * (H + 2 * A) * k;
  }
  $('rows-summary').textContent = positions
    ? positions + (positions === 1 ? ' Position' : ' Positionen') + ' · ' + count + (count === 1 ? ' Teil' : ' Teile') + ' · ' + fmt(area / 10000, 2) + ' m² inkl. Zugabe'
    : 'Noch keine Teile erfasst.';
  $('rows-summary').classList.toggle('over', count > MAX_PARTS);
}

/* ---------- Calculation ---------- */
function calculate() {
  $('error').textContent = '';
  document.querySelectorAll('.invalid').forEach(i => i.classList.remove('invalid'));
  $('calculate').disabled = true;
  setTimeout(() => {
    try {
      const W = Math.round(numeric($('rollW'), 'Rollenbreite') * 100), H = Math.round(numeric($('rollH'), 'Rollenlänge') * 10000);
      if (W > 100000 || H > 1000000) throw Error('DB Tools unterstützt Rollen bis 1.000 cm Breite und 100 m Länge.');
      const gapMm = $('gap').value.trim() ? numeric($('gap'), 'Schnittfuge', true) : 0;
      if (gapMm > 50) invalid($('gap'), 'Die Schnittfuge darf höchstens 50 mm betragen.');
      const price = $('price').value.trim() ? numeric($('price'), 'Preis pro Meter', true) : 0;
      const parts = [];
      [...$('rows').children].forEach((tr, i) => {
        const inputs = rowInputs(tr);
        if (!inputs[0].value.trim() && !inputs[1].value.trim() && !inputs[2].value.trim()) return;
        const name = inputs[0].value.trim() || 'Position ' + (i + 1);
        const fw = Math.round(numeric(inputs[1], 'Breite bei „' + name + '“') * 100);
        const fh = Math.round(numeric(inputs[2], 'Länge bei „' + name + '“') * 100);
        const allowance = inputs[4].value.trim() ? Math.round(numeric(inputs[4], 'Zugabe bei „' + name + '“', true) * 100) : 0;
        if (allowance > 10000) invalid(inputs[4], 'Zugabe bei „' + name + '“: höchstens 100 cm pro Seite.');
        const w = fw + allowance * 2, h = fh + allowance * 2;
        const n = parseNumber(inputs[3].value || '1');
        if (!Number.isInteger(n) || n < 1) invalid(inputs[3], 'Anzahl bei „' + name + '“: Bitte eine ganze Zahl ab 1 eingeben.');
        if (parts.length + n > MAX_PARTS) invalid(inputs[3], 'Höchstens ' + MAX_PARTS + ' Zuschnitte pro Berechnung.');
        for (let j = 0; j < n; j++) parts.push({ id: parts.length, name, w, h, fw, fh, allowance, row: i });
      });
      if (!parts.length) throw Error('Bitte mindestens eine vollständige Position erfassen.');
      const rotate = $('film').value === 'uni';
      current = { ...Packing.optimize(parts, W, H, rotate, { gap: Math.round(gapMm * 10) }), W, H, rotate, price };
      const byId = new Map(parts.map(p => [p.id, p]));
      current.placed.forEach(p => { const o = byId.get(p.id); p.fw = o.fw; p.fh = o.fh; p.allowance = o.allowance; });
      loadCutState();
      $('empty').hidden = true;
      $('results').hidden = false;
      $('status').textContent = '✓ Plan geprüft';
      $('status').classList.remove('stale');
      render();
      document.dispatchEvent(new CustomEvent('dbtools:calculated'));
    } catch (e) {
      $('error').textContent = e.message;
      $('results').hidden = true;
      $('empty').hidden = false;
    } finally { $('calculate').disabled = false; }
  }, 30);
}

/* ---------- Colours: same name, same colour ---------- */
function nameColors(r) {
  const names = [...new Set(r.placed.slice().sort((a, b) => a.id - b.id).map(p => p.name))];
  const map = new Map();
  names.forEach((n, i) => map.set(n, 'hsl(' + Math.round((i * 137.508 + 150) % 360) + ' 45% 82%)'));
  return map;
}
// Cutting order: from the start of the roll, left to right.
function cutOrder(r) { return r.placed.slice().sort((a, b) => a.y - b.y || a.x - b.x); }

/* ---------- "Geschnitten" checklist, remembered per plan ---------- */
const CUT_KEY = 'db-tools-cut-v1';
function planSignature(r) {
  let h = 2166136261;
  const s = r.W + '|' + r.length + '|' + r.placed.map(p => p.id + ':' + p.x + ',' + p.y + ',' + p.w + ',' + p.h + ':' + p.name).join(';');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
function loadCutState() {
  cutDone = new Set();
  try { const all = JSON.parse(localStorage.getItem(CUT_KEY)) || {}; (all[planSignature(current)]?.ids || []).forEach(id => cutDone.add(id)); } catch {}
}
function saveCutState() {
  try {
    const all = JSON.parse(localStorage.getItem(CUT_KEY)) || {};
    all[planSignature(current)] = { ids: [...cutDone], at: Date.now() };
    const keys = Object.keys(all).sort((a, b) => all[b].at - all[a].at);
    keys.slice(10).forEach(k => delete all[k]);
    localStorage.setItem(CUT_KEY, JSON.stringify(all));
  } catch {}
}
function toggleCut(id) {
  if (!current) return;
  cutDone.has(id) ? cutDone.delete(id) : cutDone.add(id);
  saveCutState();
  render(true);
}

/* ---------- Render results ---------- */
function render(keepScroll = false) {
  const r = current, restArea = r.rest.reduce((s, p) => s + p.w * p.h, 0), meters = r.length / 10000;
  const stats = [
    ['Benötigte Folienlänge', fmt(meters) + ' m'],
    ['Materialausnutzung', fmt(r.area / (r.W * r.length) * 100, 1) + ' %'],
    ['Anzahl Zuschnitte', r.placed.length],
    ['Zuschnittfläche', fmt(r.area / 1e8, 2) + ' m²'],
    ['Reststücke im Zuschnitt', fmt(restArea / 1e8, 2) + ' m²'],
    ['Verbleibende Rollenlänge', fmt((r.H - r.length) / 10000) + ' m']
  ];
  if (r.price > 0) stats.splice(1, 0, ['Materialkosten', 'CHF ' + (Math.ceil(meters * r.price * 20) / 20).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })]);
  const scrapArea = r.scrap.reduce((s, p) => s + p.w * p.h, 0);
  if (r.gap || scrapArea) stats.push(['Verschnitt (Fuge & Streifen < 1 cm)', fmt((r.kerfArea + scrapArea) / 1e8, 2) + ' m²']);
  $('stats').innerHTML = stats.slice(0, 3).map(([a, b]) => '<div class="stat"><small>' + a + '</small><strong>' + b + '</strong></div>').join('');
  $('stats-more').innerHTML = stats.slice(3).map(([a, b]) => '<span><small>' + a + '</small><b>' + b + '</b></span>').join('');

  const colors = nameColors(r);
  const counts = new Map();
  r.placed.forEach(p => counts.set(p.name, (counts.get(p.name) || 0) + 1));
  $('name-legend').innerHTML = [...colors].map(([n, c]) => '<span><i style="background:' + c + '"></i>' + esc(n) + ' <b>× ' + counts.get(n) + '</b></span>').join('');

  $('restCount').textContent = '(' + r.rest.length + ' im Zuschnittbereich)';
  $('restRows').innerHTML = r.rest.map((p, i) => '<tr><td class="red">R' + (i + 1) + '</td><td>' + cm(p.w) + ' × ' + cm(p.h) + '</td><td>' + cm(p.x) + ' / ' + cm(p.y) + '</td><td>' + fmt(p.w * p.h / 1e8, 4) + '</td></tr>').join('') +
    (r.H > r.length ? '<tr><td class="red">Restrolle</td><td>' + cm(r.W) + ' × ' + cm(r.H - r.length) + '</td><td>0 / ' + cm(r.length) + '</td><td>' + fmt(r.W * (r.H - r.length) / 1e8, 4) + '</td></tr>' : '');

  const order = cutOrder(r);
  $('partRows').innerHTML = order.map((p, i) =>
    '<tr data-part="' + p.id + '" class="' + (cutDone.has(p.id) ? 'done' : '') + '"><td><label class="cut-check"><input type="checkbox" data-cut="' + p.id + '"' + (cutDone.has(p.id) ? ' checked' : '') + ' aria-label="T' + (p.id + 1) + ' geschnitten"></label></td><td>' + (i + 1) + '</td><td><i class="swatch" style="background:' + colors.get(p.name) + '"></i>T' + (p.id + 1) + '</td><td>' + esc(p.name) + '</td><td><b>' + cm(p.w) + ' × ' + cm(p.h) + '</b></td><td>' + cm(p.fw) + ' × ' + cm(p.fh) + (p.allowance ? ' <span class="muted">+ ' + cm(p.allowance) + '</span>' : '') + '</td><td>' + cm(p.x) + ' / ' + cm(p.y) + '</td><td>' + (p.rotated ? '↻ 90°' : '–') + '</td></tr>').join('');
  const done = cutDone.size;
  $('cut-progress').textContent = done ? done + ' von ' + r.placed.length + ' geschnitten' : 'Klicken Sie ein Teil im Plan an, um es als geschnitten abzuhaken.';
  $('cut-bar').style.width = (done / r.placed.length * 100) + '%';
  $('cut-reset').hidden = !done;

  $('tail').textContent = r.H > r.length
    ? 'Unbenutzte Restrolle: ' + cm(r.W) + ' × ' + cm(r.H - r.length) + ' cm · ' + fmt((r.H - r.length) / 10000) + ' m verbleibend. Ab Position ' + cm(r.length) + ' cm. Separat dargestellt, nicht im Planmassstab.'
    : 'Die Rollenlänge ist vollständig belegt. Kein unbenutzter Rollenteil.';
  const scroll = keepScroll ? { l: $('plan').scrollLeft, t: $('plan').scrollTop } : null;
  draw();
  if (scroll) { $('plan').scrollLeft = scroll.l; $('plan').scrollTop = scroll.t; }
  fillPrintHeader();
}

function draw() {
  if (!current) return;
  const r = current, z = Number($('zoom').value) / 100, s = Math.min(480 / r.W, 4000 / r.length) * z, left = 65, top = 50, rw = r.W * s, rh = r.length * s, callouts = [];
  $('zoomValue').textContent = Math.round(z * 100) + ' %';
  const colors = nameColors(r), order = cutOrder(r), step = new Map(order.map((p, i) => [p.id, i + 1]));
  let body = '<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#ececec"/><line x1="0" y1="0" x2="0" y2="6" stroke="#c4c4c4" stroke-width="2"/></pattern></defs>';
  body += '<rect x="' + left + '" y="' + top + '" width="' + rw + '" height="' + rh + '" fill="#fff" stroke="#3a3a3a"/>';
  function rect(p, label, detail, color, rest, id) {
    const x = left + p.x * s, y = top + p.y * s, w = p.w * s, h = p.h * s, cut = !rest && cutDone.has(id);
    body += '<g' + (rest ? '' : ' class="part' + (cut ? ' cut' : '') + '" data-part="' + id + '"') + '><title>' + esc(label + ' · ' + detail) + '; X ' + cm(p.x) + ' / Y ' + cm(p.y) + ' cm' + (rest ? '' : ' – klicken zum Abhaken') + '</title>';
    body += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + (cut ? 'url(#hatch)' : color) + '" stroke="' + (rest ? '#9e283c' : '#4a4a4a') + '" stroke-width="0.6"/>';
    const fits = w > Math.max(label.length * 6.6, detail.length * 6.3) + 14 && h > 52;
    if (fits) {
      body += '<text x="' + (x + w / 2) + '" y="' + (y + h / 2 - 5) + '" text-anchor="middle" fill="' + (rest ? '#8f2236' : cut ? '#8a8a8a' : '#262626') + '" font-size="12"' + (cut ? ' text-decoration="line-through"' : '') + '><tspan x="' + (x + w / 2) + '">' + esc(label) + '</tspan><tspan x="' + (x + w / 2) + '" dy="18">' + esc(detail) + '</tspan></text>';
      if (!r.rotate && !rest && h > 85) body += '<text x="' + (x + w / 2) + '" y="' + (y + h - 12) + '" text-anchor="middle" fill="#3a3a3a">↓</text>';
    } else callouts.push({ x: x + w / 2, y: y + h / 2, label, detail, rest, cut });
    if (!rest && w > 22 && h > 22) body += '<circle cx="' + (x + 12) + '" cy="' + (y + 12) + '" r="8" fill="' + (cut ? '#3a3a3a' : '#ffffffcc') + '"/><text x="' + (x + 12) + '" y="' + (y + 15.5) + '" text-anchor="middle" font-size="9" font-weight="700" fill="' + (cut ? '#fff' : '#3a3a3a') + '">' + (cut ? '✓' : step.get(id)) + '</text>';
    body += '</g>';
  }
  r.scrap.forEach(p => { body += '<rect x="' + (left + p.x * s) + '" y="' + (top + p.y * s) + '" width="' + p.w * s + '" height="' + p.h * s + '" fill="#d9d9d9"/>'; });
  r.rest.forEach((p, i) => rect(p, 'R' + (i + 1), cm(p.w) + ' × ' + cm(p.h) + ' cm', '#f6dfe2', true));
  r.placed.forEach(p => rect(p, 'T' + (p.id + 1) + ' · ' + p.name, cm(p.w) + ' × ' + cm(p.h) + ' cm' + (p.rotated ? ' ↻' : ''), colors.get(p.name), false, p.id));
  callouts.sort((a, b) => a.y - b.y);
  let last = top - 48;
  const cx = left + rw + 50, labelWidth = Math.max(330, ...callouts.map(c => c.label.length * 9 + 24));
  for (const c of callouts) {
    const yy = Math.max(c.y - 18, last + 48); last = yy;
    const fill = c.rest ? '#f6dfe2' : c.cut ? '#f0f0f0' : '#ececec', ink = c.rest ? '#8f2236' : c.cut ? '#8a8a8a' : '#262626';
    body += '<path d="M ' + c.x + ' ' + c.y + ' L ' + (cx - 14) + ' ' + (yy + 18) + ' H ' + cx + '" stroke="' + (c.rest ? '#b8374b' : '#8a8a8a') + '" fill="none" stroke-width="0.8"/><rect x="' + cx + '" y="' + yy + '" width="' + labelWidth + '" height="40" rx="4" fill="' + fill + '"/><text x="' + (cx + 10) + '" y="' + (yy + 15) + '" fill="' + ink + '" font-size="11">' + (c.cut ? '✓ ' : '') + esc(c.label) + '</text><text x="' + (cx + 10) + '" y="' + (yy + 31) + '" fill="' + ink + '" font-size="11">' + esc(c.detail) + (!r.rotate && !c.rest ? ' ↓' : '') + '</text>';
  }
  body += '<text x="' + (left + rw / 2) + '" y="26" text-anchor="middle" font-size="12" fill="#4a4a4a">← ' + cm(r.W) + ' cm →</text><text x="15" y="' + top + '" font-size="11" fill="#4a4a4a">0</text><text x="15" y="' + (top + rh + 18) + '" font-size="11" fill="#4a4a4a">' + cm(r.length) + '</text><text x="15" y="' + (top + rh / 2) + '" font-size="12" fill="#4a4a4a">↓ cm</text>';
  const width = Math.max(550, cx + (callouts.length ? labelWidth + 20 : 0)), height = Math.max(top + rh + 40, last + 60);
  $('plan').innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Massstabsgetreuer Zuschnittplan mit Reststücken" viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height + '" style="font-family:-apple-system,Helvetica,Arial,sans-serif">' + body + '</svg>';
}

/* ---------- Print / PDF header ---------- */
function fillPrintHeader() {
  if (!current) return;
  const r = current, name = $('projectName').value.trim() || 'Zuschnittplan';
  $('print-title').textContent = name;
  $('print-meta').textContent = new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' · Rolle ' + cm(r.W) + ' cm × ' + fmt(r.H / 10000) + ' m · ' + (r.rotate ? 'Unifolie (Drehung erlaubt)' : 'Strukturfolie (keine Drehung)') +
    ' · Zuschnittmasse inkl. Zugabe' + (r.gap ? ' · Schnittfuge ' + fmt(r.gap / 10, 1) + ' mm' : '');
}
const openedForPrint = [];
function preparePrint() {
  fillPrintHeader();
  document.querySelectorAll('.result-details.printable:not([open])').forEach(d => { d.open = true; openedForPrint.push(d); });
}
function finishPrint() { while (openedForPrint.length) openedForPrint.pop().open = false; }
window.addEventListener('beforeprint', preparePrint);
window.addEventListener('afterprint', finishPrint);

/* ---------- Events ---------- */
$('add').onclick = () => { const tr = addRow(); rowInputs(tr)[0].focus(); };
$('calculate').onclick = calculate;
$('zoom').oninput = draw;
const FIELDS = ['rollW', 'rollH', 'film', 'gap', 'price', 'projectName'];
for (const id of FIELDS) $(id).addEventListener('input', () => { $(id).classList.remove('invalid'); if (id !== 'projectName') stale(); save(); });
$('film').onchange = () => {
  $('direction').textContent = $('film').value === 'uni'
    ? 'Unifolie: Teile dürfen zur Materialersparnis um 90° gedreht werden.'
    : 'Strukturfolie: Die eingegebene Länge folgt der Struktur (↓). Teile werden nicht gedreht.';
};
$('plan').addEventListener('click', e => { const g = e.target.closest('[data-part]'); if (g) toggleCut(Number(g.dataset.part)); });
$('partRows').addEventListener('change', e => { if (e.target.dataset.cut !== undefined) toggleCut(Number(e.target.dataset.cut)); });
$('cut-reset').onclick = () => { const before = [...cutDone]; cutDone.clear(); saveCutState(); render(true); showToast('Alle Haken entfernt.', 'Rückgängig', () => { before.forEach(id => cutDone.add(id)); saveCutState(); render(true); }); };

$('apply-allowance').onclick = () => {
  const el = $('bulk-allowance'), v = parseNumber(el.value);
  if (!Number.isFinite(v) || v < 0 || v > 100) { el.classList.add('invalid'); el.focus(); showToast('Bitte eine Zugabe zwischen 0 und 100 cm eingeben.'); return; }
  el.classList.remove('invalid');
  const before = rowsData();
  [...$('rows').children].forEach(tr => { rowInputs(tr)[4].value = el.value.trim(); });
  stale(); save();
  showToast('Zugabe ' + el.value.trim() + ' cm für alle Positionen übernommen.', 'Rückgängig', () => { [...$('rows').children].forEach((tr, i) => { if (before[i]) rowInputs(tr)[4].value = before[i][4]; }); stale(); save(); });
};
$('bulk-allowance').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('apply-allowance').click(); } });

/* ---------- Persistence ---------- */
const KEY = 'dbs-zuschnitt-v2';
function save() {
  updateSummary();
  if (window.DBToolsPreferences && window.DBToolsPreferences.autosave === false) return;
  try { const s = { rows: rowsData() }; FIELDS.forEach(id => s[id] = $(id).value); localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
}
function sync() { $('film').onchange(); updateSummary(); }
// Before 1.3.0 there was one global allowance (only when "Zugabe pro Seite"
// was chosen). Old rows keep exactly the result they had.
function migrateRow(r, s) {
  if (!Array.isArray(r) || r.length >= 5) return r;
  return [...r, s && s.measure === 'component' ? String(s.allowance ?? '0') : '0'];
}
window.migrateRow = migrateRow;
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (!s || !Array.isArray(s.rows) || !s.rows.length) return false;
    FIELDS.forEach(id => { if (s[id] !== undefined) $(id).value = s[id]; });
    $('rows').innerHTML = '';
    s.rows.forEach(r => addRow(migrateRow(r, s), null, true));
    sync();
    return true;
  } catch (e) { return false; }
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function fileBase() {
  const name = $('projectName').value.trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60);
  return (name || 'Zuschnittplan') + '-' + new Date().toISOString().slice(0, 10);
}
function snapshotRows() { return { rows: rowsData(), fields: Object.fromEntries(FIELDS.map(id => [id, $(id).value])) }; }
function restoreRows(snap) {
  FIELDS.forEach(id => { $(id).value = snap.fields[id] ?? ''; });
  $('rows').innerHTML = '';
  snap.rows.forEach(r => addRow(r, null, true));
  sync(); stale(); save();
}
$('example').onclick = () => {
  const before = snapshotRows();
  $('rollW').value = 122; $('rollH').value = 50; $('film').value = 'uni';
  $('rows').innerHTML = '';
  [['Küchenfront oben', 60, 72, 4], ['Seitenwand', 58, 210, 2], ['Schubladenblende', 90, 18, 3], ['Tischplatte', 120, 80, 1]].forEach(r => addRow(r, null, true));
  sync(); stale(); save();
  if (before.rows.some(r => r.slice(0, 3).some(x => String(x).trim()))) showToast('Beispiel geladen.', 'Rückgängig', () => restoreRows(before));
};
$('clear').onclick = () => {
  const before = snapshotRows();
  $('rows').innerHTML = ''; addRow();
  showToast('Alle Positionen gelöscht.', 'Rückgängig', () => restoreRows(before));
};
$('csv').onclick = () => {
  if (!current) return;
  const r = current, q = s => '"' + String(s).replace(/"/g, '""') + '"', L = ['Schritt;Teil;Bezeichnung;Zuschnitt Breite (cm);Zuschnitt Länge (cm);Fertig Breite (cm);Fertig Länge (cm);Zugabe pro Seite (cm);X (cm);Y (cm);Drehung;Geschnitten'];
  cutOrder(r).forEach((p, i) => L.push([i + 1, 'T' + (p.id + 1), q(p.name), cm(p.w), cm(p.h), cm(p.fw), cm(p.fh), cm(p.allowance), cm(p.x), cm(p.y), p.rotated ? '90°' : '0°', cutDone.has(p.id) ? 'ja' : ''].join(';')));
  L.push('', 'Reststück;;;Breite (cm);Länge (cm);;;;X (cm);Y (cm);Fläche (m²)');
  r.rest.forEach((p, i) => L.push(['R' + (i + 1), '', '', cm(p.w), cm(p.h), '', '', '', cm(p.x), cm(p.y), fmt(p.w * p.h / 1e8, 6)].join(';')));
  L.push('', 'Benötigte Folienlänge (m);' + fmt(r.length / 10000), 'Ausnutzung (%);' + fmt(r.area / (r.W * r.length) * 100, 1));
  if (r.price > 0) L.push('Materialkosten (CHF);' + fmt(r.length / 10000 * r.price, 2));
  download(fileBase() + '.csv', '﻿' + L.join('\r\n'), 'text/csv;charset=utf-8');
};
$('svg').onclick = () => { const s = $('plan').innerHTML; if (s) download(fileBase() + '.svg', s, 'image/svg+xml'); };
$('print').onclick = () => window.print();
$('pdf').onclick = async () => {
  if (!current) return;
  if (!window.desktop?.savePdf) { window.print(); return; }
  preparePrint();
  try {
    const result = await window.desktop.savePdf(fileBase() + '.pdf');
    if (result?.saved) showToast('PDF gespeichert.');
  } catch { showToast('Das PDF konnte nicht gespeichert werden.'); }
  finally { finishPrint(); }
};

if (!load()) {
  const p = window.DBToolsPreferences;
  if (p) {
    $('rollW').value = p.defaultRollW; $('rollH').value = p.defaultRollH; $('film').value = p.defaultFilm;
    if (p.defaultGap !== undefined) $('gap').value = p.defaultGap || '';
    if (p.defaultPrice) $('price').value = p.defaultPrice;
    sync();
  }
  addRow();
}
updateSummary();
