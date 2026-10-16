/* Dashboard overview: stat cards, appointment calendar, today's schedule, charts, quick actions. */
App.views.dashboard = {
  async show(el) {
    const today = App.todayIso();
    const [s, t] = await Promise.all([
      api("admin_stats.php"),
      api(
        `admin_appointments.php?date=${today}&status=pending,approved,rescheduled,completed`,
      ),
    ]);
    const st = s.stats;
    App.refreshBell();

    const sched = t.appointments.length
      ? t.appointments
          .map((a) => {
            const [time, ap] = a.timeLabel.split(" ");
            return `<div class="sched-row"><div class="tbox">${esc(time)}<br />${esc(ap || "")}</div>
              <div class="who2"><strong>${esc(a.patientName)}</strong><span>${esc(a.service)}</span></div>${statusBadge(a.status)}</div>`;
          })
          .join("")
      : '<div class="empty">No appointments today.</div>';

    const weekly = st.weekly.map((v, i) => ({
      label: "Week " + (i + 1),
      value: v,
    }));
    const ps = st.patientStats;
    const donut = Charts.donut(
      [
        { label: "New Patients", value: ps.new },
        { label: "Returning Patients", value: ps.returning },
        { label: "Inactive Patients", value: ps.inactive },
      ],
      { center: App.num(st.patients) },
    );

    el.innerHTML = `
      <div class="sub-head"><h2>Dashboard Overview</h2><span class="muted">${icon("calendar", 16)} ${esc(fmtDate(today, true))}</span></div>
      <div class="cards five">${App.statCards([
        {
          icon: "users",
          tone: "blue",
          label: "Total Patients",
          value: App.num(st.patients),
          go: "patients",
          more: "View all patients",
        },
        {
          icon: "calendar",
          tone: "green",
          label: "Today's Appointments",
          value: App.num(st.today),
          go: "appointments",
          more: "View schedule",
        },
        {
          icon: "clock",
          tone: "orange",
          label: "Pending Appointments",
          value: App.num(st.pending),
          go: "appointments",
          tab: "pending",
          more: "View pending",
        },
        {
          icon: "tooth",
          tone: "violet",
          label: "Active Treatments",
          value: App.num(st.activeTreatments),
          go: "treatment",
          more: "View all",
        },
        {
          icon: "file",
          tone: "teal",
          label: "Total Records",
          value: App.num(st.records),
          go: "records",
          more: "View records",
        },
      ])}</div>

      <div class="grid-2">
        <div class="panel"><div class="panel-h"><h3>Appointment Calendar</h3>
          <div class="seg" id="calMode"><button data-m="day">Day</button><button data-m="week">Week</button><button data-m="month" class="active">Month</button></div></div>
          <div id="calBody"></div></div>
        <div class="panel"><div class="panel-h"><h3>Today's Schedule</h3><a href="#" data-go="appointments">View all →</a></div>
          <div class="sched-scroll">${sched}</div></div>
      </div>

      <div class="grid-3">
        <div class="panel"><div class="panel-h"><h3>Appointments Summary <small>(This Month)</small></h3></div><div class="chart">${Charts.line(weekly, { w: 340 })}</div></div>
        <div class="panel"><div class="panel-h"><h3>Patient Statistics</h3></div>
          <div class="donut-wrap">${donut.svg}${donut.legend}</div>
          <p class="slot-hint" style="margin-top:10px">New = joined in the last 30 days. Returning = visited in the last 6 months. Inactive = everyone else.</p></div>
        <div class="panel"><div class="panel-h"><h3>Quick Actions</h3></div>
          <div class="quick">
            <button type="button" data-q="appt">${icon("plus", 22)}New Appointment</button>
            <button type="button" data-q="patient">${icon("user", 22)}Add New Patient</button>
            <button type="button" data-q="record">${icon("file", 22)}Add Patient Record</button>
            <button type="button" data-q="report">${icon("chart", 22)}Generate Report</button>
          </div></div>
      </div>`;

    el.querySelector(".quick").addEventListener("click", (e) => {
      const b = e.target.closest("[data-q]");
      if (!b) return;
      const q = b.dataset.q;
      if (q === "appt") App.newAppointment();
      if (q === "patient") App.newPatient();
      if (q === "record") App.newRecord();
      if (q === "report") App.go("reports");
    });
    Calendar.init($("#calBody"), $("#calMode"));
  },
};

/* ---------- calendar (month / week / day) ---------- */
const Calendar = {
  mode: "month",
  cursor: new Date(),
  sel: App.todayIso(),
  async data(from, to) {
    const r = await api(
      `admin_appointments.php?from=${from}&to=${to}&status=pending,approved,rescheduled,completed`,
    );
    const map = {};
    r.appointments.forEach((a) => (map[a.date] = map[a.date] || []).push(a));
    return map;
  },
  init(body, modeEl) {
    this.body = body;
    this.cursor = new Date();
    this.sel = App.todayIso();
    this.mode = "month";
    modeEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-m]");
      if (!b) return;
      this.mode = b.dataset.m;
      $$("button", modeEl).forEach((x) =>
        x.classList.toggle("active", x === b),
      );
      this.render();
    });
    body.addEventListener("click", (e) => {
      const nav = e.target.closest("[data-nav]");
      if (nav) {
        const d = nav.dataset.nav;
        if (d === "today") this.cursor = new Date();
        else {
          const step = d === "prev" ? -1 : 1;
          if (this.mode === "month")
            this.cursor.setMonth(this.cursor.getMonth() + step, 1);
          else
            this.cursor.setDate(
              this.cursor.getDate() + step * (this.mode === "week" ? 7 : 1),
            );
        }
        return this.render();
      }
      const cell = e.target.closest("[data-day]");
      if (cell) {
        this.sel = cell.dataset.day;
        this.cursor = new Date(this.sel + "T00:00");
        this.mode = "day";
        $$("#calMode button").forEach((x) =>
          x.classList.toggle("active", x.dataset.m === "day"),
        );
        this.render();
      }
    });
    this.render();
  },
  item(a) {
    return `<div class="sched-row"><div class="tbox">${esc(a.timeLabel)}</div>
      <div class="who2"><strong>${esc(a.patientName)}</strong><span>${esc(a.service)}</span></div>${statusBadge(a.status)}</div>`;
  },
  async render() {
    const c = new Date(
      this.cursor.getFullYear(),
      this.cursor.getMonth(),
      this.cursor.getDate(),
    );
    const nav = (
      title,
    ) => `<div class="cal-nav"><button data-nav="prev" aria-label="Previous">${icon("chevleft", 16)}</button>
      <span class="ttl">${esc(title)}</span><button data-nav="next" aria-label="Next">${icon("chevright", 16)}</button><button data-nav="today">Today</button></div>`;
    try {
      if (this.mode === "month") {
        const first = new Date(c.getFullYear(), c.getMonth(), 1);
        const start = new Date(first);
        start.setDate(1 - first.getDay());
        const rows = Math.ceil(
          (first.getDay() +
            new Date(c.getFullYear(), c.getMonth() + 1, 0).getDate()) /
            7,
        );
        const end = new Date(start);
        end.setDate(start.getDate() + rows * 7 - 1);
        const map = await this.data(isoDate(start), isoDate(end));
        let cells = "";
        for (let i = 0; i < rows * 7; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          const iso = isoDate(d);
          const n = (map[iso] || []).length;
          cells += `<div class="cal-cell ${d.getMonth() !== c.getMonth() ? "other" : ""} ${iso === App.todayIso() ? "today" : ""}" data-day="${iso}">${d.getDate()}${n ? `<br /><span class="n">${n}</span>` : ""}</div>`;
        }
        const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
          .map((x) => `<div class="cal-dow">${x}</div>`)
          .join("");
        this.body.innerHTML =
          nav(
            c.toLocaleDateString("en-PH", { month: "long", year: "numeric" }),
          ) + `<div class="cal-grid">${dows}${cells}</div>`;
      } else if (this.mode === "week") {
        const start = new Date(c);
        start.setDate(c.getDate() - c.getDay());
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const map = await this.data(isoDate(start), isoDate(end));
        let html = "";
        for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          const iso = isoDate(d);
          html +=
            `<div class="agenda-day">${esc(fmtDate(iso, true))}</div>` +
            ((map[iso] || []).map((a) => this.item(a)).join("") ||
              '<div class="muted mini">No appointments</div>');
        }
        const t = `${start.toLocaleDateString("en-PH", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;
        this.body.innerHTML =
          nav(t) + `<div class="agenda sched-scroll">${html}</div>`;
      } else {
        const iso = isoDate(c);
        const map = await this.data(iso, iso);
        this.body.innerHTML =
          nav(fmtDate(iso, true)) +
          `<div class="agenda sched-scroll">${(map[iso] || []).map((a) => this.item(a)).join("") || '<div class="empty">No appointments on this day.</div>'}</div>`;
      }
    } catch (e) {
      this.body.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    }
  },
};
