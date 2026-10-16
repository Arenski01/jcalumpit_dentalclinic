/* Tiny dependency-free SVG charts (work offline, scale with their container). */
const Charts = (() => {
  const COLORS = [
    "#8c2b1d",
    "#162b4d",
    "#2c7a9b",
    "#d9822b",
    "#7c5cbf",
    "#94a3b8",
  ];
  const esc2 = (s) =>
    String(s).replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );

  /* Axis maximum that splits into 4 clean steps (1, 2, 5 x 10^n). */
  function niceMax(v, min) {
    const raw = Math.max(v, min) / 4;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p * 4;
  }
  const short = (n) =>
    n >= 1000
      ? +(n / 1000).toFixed(1) + "K"
      : String(Math.round(n * 100) / 100);

  function frame(W, H, m, max, fmt) {
    let g = "";
    for (let i = 0; i <= 4; i++) {
      const y = m.t + ((H - m.t - m.b) * i) / 4;
      g += `<line x1="${m.l}" y1="${y}" x2="${W - m.r}" y2="${y}" stroke="#e5e7eb" stroke-dasharray="3 4"/>`;
      g += `<text x="${m.l - 8}" y="${y + 4}" text-anchor="end" font-size="12" fill="#64748b">${fmt(max - (max * i) / 4)}</text>`;
    }
    return g;
  }

  const W_HINT = { w: 560 };
  function xLabels(labels, xs, H, m) {
    const step = Math.max(
      1,
      Math.ceil(labels.length / (W_HINT.w < 400 ? 4 : 6)),
    );
    return labels
      .map((l, i) =>
        i % step === 0 || i === labels.length - 1
          ? `<text x="${xs[i]}" y="${H - m.b + 18}" text-anchor="middle" font-size="12" fill="#64748b">${esc2(l)}</text>`
          : "",
      )
      .join("");
  }

  /* points: [{label, value}] */
  function line(points, o = {}) {
    const W = o.w || 560,
      H = 240,
      m = { l: 34, r: 26, t: 12, b: 30 };
    W_HINT.w = W;
    const color = o.color || COLORS[0];
    const max = niceMax(Math.max(0, ...points.map((p) => p.value)), 4);
    const n = points.length;
    const xs = points.map((_, i) =>
      n === 1 ? (W + m.l - m.r) / 2 : m.l + ((W - m.l - m.r) * i) / (n - 1),
    );
    const ys = points.map((p) => m.t + (H - m.t - m.b) * (1 - p.value / max));
    let d = "";
    xs.forEach((x, i) => {
      if (i === 0) return (d = `M${x},${ys[i]}`);
      const cx = (xs[i - 1] + x) / 2;
      d += ` C${cx},${ys[i - 1]} ${cx},${ys[i]} ${x},${ys[i]}`;
    });
    const base = H - m.b;
    const area = n > 1 ? `${d} L${xs[n - 1]},${base} L${xs[0]},${base} Z` : "";
    const dots =
      n <= 16
        ? points
            .map(
              (p, i) =>
                `<circle cx="${xs[i]}" cy="${ys[i]}" r="4" fill="#fff" stroke="${color}" stroke-width="2"><title>${esc2(p.label)}: ${p.value}</title></circle>`,
            )
            .join("")
        : "";
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Line chart">
      <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".22"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      ${frame(W, H, m, max, (v) => Math.round(v))}
      ${area ? `<path d="${area}" fill="url(#lg)"/>` : ""}
      ${n > 1 ? `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5"/>` : ""}
      ${dots}${xLabels(
        points.map((p) => p.label),
        xs,
        H,
        m,
      )}</svg>`;
  }

  function bars(points, o = {}) {
    const W = o.w || 560,
      H = 240,
      m = { l: 40, r: 12, t: 12, b: 30 };
    W_HINT.w = W;
    const color = o.color || "#162b4d";
    const max = niceMax(Math.max(0, ...points.map((p) => p.value)), 4);
    const n = points.length;
    const slot = (W - m.l - m.r) / n;
    const bw = Math.min(46, slot * 0.6);
    const xs = points.map((_, i) => m.l + slot * i + slot / 2);
    const rects = points
      .map((p, i) => {
        const h = (H - m.t - m.b) * (p.value / max);
        return `<rect x="${xs[i] - bw / 2}" y="${H - m.b - h}" width="${bw}" height="${h}" rx="4" fill="${color}"><title>${esc2(p.label)}: ${o.money ? "₱" : ""}${p.value.toLocaleString("en-PH")}</title></rect>`;
      })
      .join("");
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart">
      ${frame(W, H, m, max, short)}${rects}${xLabels(
        points.map((p) => p.label),
        xs,
        H,
        m,
      )}</svg>`;
  }

  /* items: [{label, value}] -> {svg, legend} */
  function donut(items, o = {}) {
    const R = 56,
      C = 2 * Math.PI * R,
      total = items.reduce((a, b) => a + b.value, 0);
    let off = 0;
    const segs = total
      ? items
          .map((it, i) => {
            const len = (it.value / total) * C;
            const s = `<circle cx="80" cy="80" r="${R}" fill="none" stroke="${COLORS[i % COLORS.length]}" stroke-width="26" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"><title>${esc2(it.label)}: ${it.value}</title></circle>`;
            off += len;
            return s;
          })
          .join("")
      : `<circle cx="80" cy="80" r="${R}" fill="none" stroke="#e5e7eb" stroke-width="26"/>`;
    const center =
      o.center != null
        ? `<text x="80" y="86" text-anchor="middle" font-size="20" font-weight="700" fill="#162b4d">${esc2(o.center)}</text>`
        : "";
    const legend = items
      .map(
        (it, i) =>
          `<div><i style="background:${COLORS[i % COLORS.length]}"></i>${esc2(it.label)}<b>${total ? Math.round((it.value / total) * 100) : 0}%</b></div>`,
      )
      .join("");
    return {
      svg: `<svg viewBox="0 0 160 160" role="img" aria-label="Donut chart">${segs}${center}</svg>`,
      legend: `<div class="legend">${legend}</div>`,
    };
  }

  return { line, bars, donut, COLORS };
})();
