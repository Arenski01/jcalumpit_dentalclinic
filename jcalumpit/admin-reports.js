/* Reports: key numbers vs the previous period, appointment / revenue charts, top services, CSV export. */
(() => {
  const PERIODS = [
    ["this_month", "This Month", "last month"],
    ["last_month", "Last Month", "the month before"],
    ["last_30", "Last 30 Days", "the previous 30 days"],
    ["this_year", "This Year", "last year"],
  ];
  let period = "this_month";
  let data = null;

  const delta = (c, vs) =>
    c == null
      ? `<span class="muted">No data for ${esc(vs)}</span>`
      : `<span class="${c >= 0 ? "up" : "down"}">${c >= 0 ? "↑" : "↓"} ${Math.abs(c)}%</span> <span class="muted">from ${esc(vs)}</span>`;

  function draw() {
    const [, label, vs] = PERIODS.find((p) => p[0] === period);
    const m = data.metrics,
      c = data.change;
    const card = (title, value, key) =>
      `<div class="sc" style="display:block"><div class="lbl">${title}</div><div class="val">${value}</div><div class="sub">${delta(c[key], vs)}</div></div>`;
    const donut = Charts.donut(data.services, {
      center: App.num(data.services.reduce((a, b) => a + b.value, 0)),
    });
    $("#rpBody").innerHTML = `
      <div class="cards">${card("Total Appointments", App.num(m.appointments), "appointments")}${card("New Patients", App.num(m.newPatients), "newPatients")}
        ${card("Total Revenue (payments received)", peso(m.revenue), "revenue")}${card("Treatments Completed", App.num(m.treatments), "treatments")}</div>
      <div class="grid-3">
        <div class="panel"><div class="panel-h"><h3>Appointments Overview</h3></div><div class="chart">${Charts.line(data.appointmentsSeries, { w: 340 })}</div></div>
        <div class="panel"><div class="panel-h"><h3>Revenue Overview</h3></div><div class="chart">${Charts.bars(data.revenueSeries, { money: true, w: 340 })}</div></div>
        <div class="panel"><div class="panel-h"><h3>Top Services</h3></div>${data.services.length ? `<div class="donut-wrap">${donut.svg}${donut.legend}</div>` : '<div class="empty">No appointments in this period.</div>'}</div>
      </div>
      <p class="slot-hint" style="margin-top:12px">Showing ${esc(label)} (${esc(fmtDate(data.from))} – ${esc(fmtDate(data.to))}). Revenue counts payments recorded in Billing.</p>`;
  }

  async function load() {
    $("#rpBody").innerHTML = '<div class="loading">Loading…</div>';
    data = await api("admin_reports.php?period=" + period);
    draw();
  }

  function exportCsv() {
    if (!data) return;
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const m = data.metrics;
    const lines = [
      ["J. Calumpit Dental Clinic report"],
      ["Period", data.period, data.from, data.to],
      [],
      ["Metric", "Value"],
      ["Total appointments", m.appointments],
      ["New patients", m.newPatients],
      ["Revenue (PHP)", m.revenue],
      ["Treatments completed", m.treatments],
      [],
      ["Top services", "Appointments"],
      ...data.services.map((s) => [s.label, s.value]),
      [],
      ["Appointments by day/month", "Count"],
      ...data.appointmentsSeries.map((p) => [p.label, p.value]),
      [],
      ["Revenue by week/month", "PHP"],
      ...data.revenueSeries.map((p) => [p.label, p.value]),
    ];
    const csv = "\ufeff" + lines.map((l) => l.map(q).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    a.download = `report-${data.period}-${data.from}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  App.views.reports = {
    async show(el) {
      el.innerHTML = `<div class="toolbar"><span class="grow"></span>
        <select id="rpPeriod">${PERIODS.map(([k, l]) => `<option value="${k}" ${k === period ? "selected" : ""}>${l}</option>`).join("")}</select>
        <button class="btn btn-ghost" id="rpExport" type="button">${icon("download", 16)} Export Report</button></div><div id="rpBody"></div>`;
      $("#rpPeriod").addEventListener(
        "change",
        (e) => ((period = e.target.value), load().catch(App.fail)),
      );
      $("#rpExport").addEventListener("click", exportCsv);
      await load();
    },
  };
})();
