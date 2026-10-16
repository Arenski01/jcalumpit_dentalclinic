/* Admin panel core: icons, navigation, dialogs, small UI builders. Each section lives in its own admin-*.js file. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const ICON_PATHS = {
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  calendar:
    '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users:
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  tooth:
    '<path d="M7 3C4.5 3 3 5 3 8c0 4 2 5 2.6 8 .4 2.5 1.2 5 2.4 5s1.4-3 1.9-5c.3-1.4.6-2 1.1-2s.8.6 1.1 2c.5 2 .7 5 1.9 5s2-2.5 2.4-5C16 13 18 12 18 8c0-3-1.5-5-4-5-1.6 0-2.4 1-3.5 1S8.6 3 7 3z"/>',
  dollar:
    '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  chart:
    '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  sliders:
    '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  search:
    '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  edit: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  trash:
    '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  download:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  clock:
    '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  chevleft: '<polyline points="15 18 9 12 15 6"/>',
  chevright: '<polyline points="9 18 15 12 9 6"/>',
  male: '<circle cx="10" cy="14" r="5"/><line x1="19" y1="5" x2="13.6" y2="10.4"/><polyline points="15 5 19 5 19 9"/>',
  female:
    '<circle cx="12" cy="8" r="5"/><line x1="12" y1="13" x2="12" y2="21"/><line x1="9" y1="18" x2="15" y2="18"/>',
  wallet:
    '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
  alert:
    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
};
function icon(name, size = 18) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ""}</svg>`;
}

const ROLE_LABEL = {
  admin: "Administrator",
  dentist: "Dentist",
  staff: "Staff",
  patient: "Patient",
};
const SERVICES = [
  "Check-up & consultation",
  "Oral prophylaxis (cleaning)",
  "Tooth extraction",
  "Filling (pasta)",
  "Braces / orthodontics",
  "Whitening",
  "Dentures",
];

const App = {
  me: null,
  views: {},
  current: null,
  nextOpts: {},
  _patients: null,
  _dentists: null,
  NAV: [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: "grid",
      title: "Dashboard Overview",
    },
    {
      id: "appointments",
      label: "Appointments",
      icon: "calendar",
      title: "Appointments",
    },
    { id: "patients", label: "Patients", icon: "user", title: "Patients" },
    { id: "records", label: "Records", icon: "file", title: "Records" },
    { id: "treatment", label: "Treatment", icon: "tooth", title: "Treatment" },
    { id: "billing", label: "Billing", icon: "dollar", title: "Billing" },
    { id: "reports", label: "Reports", icon: "chart", title: "Reports" },
    { id: "settings", label: "Settings", icon: "sliders", title: "Settings" },
    { id: "users", label: "Users", icon: "users", title: "Users", admin: true },
  ],
};

/* ---------- small helpers ---------- */
App.toast = (msg, err) => {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast show" + (err ? " error" : "");
  clearTimeout(App.toast.t);
  App.toast.t = setTimeout(() => (el.className = "toast"), 3400);
};
App.fail = (e) => {
  if (e && e.status === 401)
    return location.replace("login.html?next=admin.html");
  App.toast((e && e.message) || "Something went wrong.", true);
};
App.code = (prefix, id) => `${prefix}-${String(id).padStart(4, "0")}`;
App.num = (n) => Number(n || 0).toLocaleString("en-PH");
App.cap = (s) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/[-_]/g, " ") : "";
App.initials = (name) =>
  (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
App.isAdmin = () => App.me && App.me.role === "admin";
App.debounce = (fn, ms = 300) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};
App.todayIso = () => isoDate(new Date());

App.statCards = (items) =>
  items
    .map(
      (c) => `<div class="sc">
        <div class="ico tone-${c.tone || "blue"}">${icon(c.icon, 22)}</div>
        <div><div class="lbl">${esc(c.label)}</div><div class="val">${esc(c.value)}</div>
        ${c.sub ? `<div class="sub ${c.subCls || ""}">${esc(c.sub)}</div>` : ""}
        ${c.go ? `<a class="more" href="#" data-go="${c.go}" ${c.tab ? `data-tab="${c.tab}"` : ""}>${esc(c.more || "View all")} →</a>` : ""}</div></div>`,
    )
    .join("");

App.table = (heads, rows, empty = "Nothing to show.") =>
  rows.length
    ? `<div class="table-wrap"><table><thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`
    : `<div class="empty">${esc(empty)}</div>`;

App.iconBtn = (name, cls, attrs, title) =>
  `<button type="button" class="icon-btn ${cls}" ${attrs} title="${esc(title)}" aria-label="${esc(title)}">${icon(name, 17)}</button>`;

App.searchBox = (id, placeholder, value = "") =>
  `<div class="search">${icon("search", 16)}<input type="search" id="${id}" placeholder="${esc(placeholder)}" value="${esc(value)}" /></div>`;

/* Pager: returns html; call App.bindPager(container, cb) after inserting it. */
App.pagerHtml = (total, page, per, noun = "records") => {
  const pages = Math.max(1, Math.ceil(total / per));
  const from = total ? (page - 1) * per + 1 : 0;
  const to = Math.min(total, page * per);
  const nums = new Set([1, pages, page - 1, page, page + 1]);
  const list = [...nums]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  let btns = "";
  list.forEach((n, i) => {
    if (i && n - list[i - 1] > 1)
      btns += `<button class="pg" disabled>…</button>`;
    btns += `<button class="pg ${n === page ? "active" : ""}" data-page="${n}">${n}</button>`;
  });
  return `<div class="pager"><span>Showing ${App.num(from)} to ${App.num(to)} of ${App.num(total)} ${noun}</span>
    <div class="pager-btns"><button class="pg" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>‹</button>${btns}<button class="pg" data-page="${page + 1}" ${page >= pages ? "disabled" : ""}>›</button></div></div>`;
};
App.bindPager = (el, cb) =>
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-page]");
    if (b && !b.disabled) cb(+b.dataset.page);
  });

/* ---------- cached lookups ---------- */
App.patients = async (force) => {
  if (!App._patients || force)
    App._patients = (await api("admin_patients.php?brief=1")).patients;
  return App._patients;
};
App.dentists = async () => {
  if (!App._dentists) App._dentists = (await api("dentists.php")).dentists;
  return App._dentists;
};

/* ---------- dialogs ---------- */
App.dialog = function ({
  title,
  sub = "",
  html = "",
  wide = false,
  buttons = [],
  onOpen,
}) {
  const dlg = $("#appDlg");
  App._afterClose = null;
  if (dlg.open) dlg.close();
  dlg.classList.toggle("wide", wide);
  $("#dlgTitle").textContent = title;
  $("#dlgSub").textContent = sub;
  $("#dlgSub").hidden = !sub;
  $("#dlgBody").innerHTML = html;
  $("#dlgErr").textContent = "";
  const act = $("#dlgActions");
  act.innerHTML = "";
  buttons.forEach((b) => {
    const el = document.createElement("button");
    el.type = b.submit ? "submit" : "button";
    el.className = "btn " + (b.cls || "btn-ghost");
    el.textContent = b.label;
    if (b.id) el.id = b.id;
    if (!b.submit)
      el.addEventListener("click", () => b.onClick && b.onClick(el));
    act.appendChild(el);
  });
  App._onSubmit = null;
  dlg.showModal();
  if (onOpen) onOpen(dlg);
  return dlg;
};
App.close = () => {
  const d = $("#appDlg");
  if (d.open) d.close();
};
/* Runs once when the dialog is really closed (ignores the close that happens while swapping content). */
$("#appDlg").addEventListener("close", () => {
  if ($("#appDlg").open) return;
  const f = App._afterClose;
  App._afterClose = null;
  if (f) f();
});
$("#dlgForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (App._onSubmit) App._onSubmit();
});

function fieldHtml(f, val) {
  const v = val ?? f.value ?? "";
  const id = "f_" + f.name;
  const cls = "f-row" + (f.full || f.type === "textarea" ? " full" : "");
  let input;
  if (f.type === "select") {
    input = `<select id="${id}">${(f.options || [])
      .map(
        ([k, l]) =>
          `<option value="${esc(k)}" ${String(k) === String(v) ? "selected" : ""}>${esc(l)}</option>`,
      )
      .join("")}</select>`;
  } else if (f.type === "textarea") {
    input = `<textarea id="${id}" rows="${f.rows || 3}" maxlength="${f.maxlength || 5000}" placeholder="${esc(f.placeholder || "")}">${esc(v)}</textarea>`;
  } else if (f.type === "file") {
    input = `<input type="file" id="${id}" accept="${esc(f.accept || "")}" />`;
  } else {
    input = `<input type="${f.type || "text"}" id="${id}" value="${esc(v)}" placeholder="${esc(f.placeholder || "")}" ${f.min != null ? `min="${esc(f.min)}"` : ""} ${f.max != null ? `max="${esc(f.max)}"` : ""} ${f.step ? `step="${esc(f.step)}"` : ""} ${f.readonly ? "readonly" : ""} autocomplete="off" />`;
  }
  return `<div class="${cls}"><label for="${id}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ""}</label>${input}${f.hint ? `<span class="slot-hint">${esc(f.hint)}</span>` : ""}</div>`;
}

App.readFile = (input) =>
  new Promise((resolve, reject) => {
    const f = input.files && input.files[0];
    if (!f) return resolve(null);
    if (f.size > 5 * 1024 * 1024)
      return reject(new Error("The file is too large (5 MB max)."));
    const r = new FileReader();
    r.onload = () =>
      resolve({ name: f.name, data: String(r.result).split(",")[1] });
    r.onerror = () => reject(new Error("Couldn't read the file."));
    r.readAsDataURL(f);
  });

/* Form dialog. onSubmit(values) may throw (message shown) or return "keep" to leave the dialog open. */
App.form = function (o) {
  const vals = o.values || {};
  const html = `<div class="fgrid">${o.fields.map((f) => fieldHtml(f, vals[f.name])).join("")}</div>${o.extra || ""}`;
  App.dialog({
    title: o.title,
    sub: o.sub,
    html,
    wide: o.wide,
    buttons: [
      { label: "Cancel", onClick: App.close },
      {
        label: o.submit || "Save",
        cls: "btn-primary",
        submit: true,
        id: "dlgSubmit",
      },
    ],
    onOpen: (dlg) => o.onOpen && o.onOpen(dlg),
  });
  App._onSubmit = async () => {
    const btn = $("#dlgSubmit"),
      err = $("#dlgErr");
    err.textContent = "";
    const values = {};
    try {
      for (const f of o.fields) {
        const el = $("#f_" + f.name);
        if (!el) continue;
        values[f.name] =
          f.type === "file"
            ? await App.readFile(el)
            : f.type === "password"
              ? el.value
              : el.value.trim();
      }
    } catch (e) {
      err.textContent = e.message;
      return;
    }
    for (const f of o.fields) {
      if (f.required && !values[f.name]) {
        err.textContent = `${f.label} is required.`;
        return;
      }
    }
    btn.disabled = true;
    try {
      const r = await o.onSubmit(values);
      if (r !== "keep") App.close();
    } catch (e) {
      if (e.status === 401) return App.fail(e);
      err.textContent = e.message;
      btn.disabled = false;
    }
  };
};

App.confirm = ({ title, text, confirmText = "Confirm" }) =>
  new Promise((resolve) => {
    App.dialog({
      title,
      sub: text,
      buttons: [
        { label: "Cancel", onClick: () => (App.close(), resolve(false)) },
        {
          label: confirmText,
          cls: "btn-primary",
          onClick: () => (App.close(), resolve(true)),
        },
      ],
    });
  });

/* One-time credentials (temporary passwords) */
App.secret = ({ title, sub, username, password }) =>
  App.dialog({
    title,
    sub,
    html: `<div class="secret">Username: <code>${esc(username)}</code><br />Temporary password: <code>${esc(password)}</code></div>
           <p class="slot-hint" style="margin-top:10px">Write this down or send it to them now. It is not shown again. They can change it under Settings.</p>`,
    buttons: [{ label: "Done", cls: "btn-primary", onClick: App.close }],
  });

/* Fills a <select> with the open time slots of a date (staff can use today onwards). */
App.loadSlots = async (dateVal, selectEl, hintEl, excludeId) => {
  selectEl.innerHTML = '<option value="">Pick a date first</option>';
  if (hintEl) hintEl.textContent = "";
  if (!dateVal) return;
  try {
    const r = await api(
      `slots.php?date=${encodeURIComponent(dateVal)}${excludeId ? "&exclude=" + excludeId : ""}`,
    );
    if (!r.open) {
      selectEl.innerHTML = '<option value="">No times available</option>';
      if (hintEl) hintEl.textContent = r.message || "";
      return;
    }
    selectEl.innerHTML =
      '<option value="">Select a time</option>' +
      r.slots
        .map(
          (s) =>
            `<option value="${esc(s.time)}" ${s.taken ? "disabled" : ""}>${esc(s.label)}${s.taken ? " — taken" : ""}</option>`,
        )
        .join("");
  } catch (e) {
    if (hintEl) hintEl.textContent = e.message;
  }
};

/* ---------- navigation ---------- */
App.go = function (id, opts) {
  const nav = App.NAV.find((n) => n.id === id && (!n.admin || App.isAdmin()));
  if (!nav || !App.views[id]) id = "dashboard";
  const n = App.NAV.find((x) => x.id === id);
  App.current = id;
  App.nextOpts = opts || {};
  history.replaceState(null, "", "#" + id);
  $$(".sb-item[data-view]").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === id),
  );
  $("#pageTitle").textContent = n.title;
  $("#app").classList.remove("sb-open");
  $("#userMenu").classList.add("hidden");
  const el = $("#view");
  el.innerHTML = '<div class="loading">Loading…</div>';
  window.scrollTo(0, 0);
  Promise.resolve(App.views[id].show(el)).catch((e) => {
    el.innerHTML = `<div class="panel empty">${esc(e.message || "Couldn't load this page.")}</div>`;
    App.fail(e);
  });
};
App.refresh = () => App.go(App.current, App.nextOpts);

App.refreshBell = async () => {
  try {
    const s = (await api("admin_stats.php")).stats;
    const btn = $("#bellBtn");
    btn.innerHTML =
      icon("bell", 20) +
      (s.pending ? `<span class="count-dot">${s.pending}</span>` : "");
    const pill = $("#pendingPill");
    if (pill) {
      pill.textContent = s.pending;
      pill.classList.toggle("hidden", !s.pending);
    }
  } catch (_) {}
};

document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-go]");
  if (g) {
    e.preventDefault();
    App.go(g.dataset.go, { tab: g.dataset.tab });
  }
  if (!e.target.closest(".userbox")) $("#userMenu").classList.add("hidden");
});
