/* Shared helpers for every page: talk to the PHP API, escape text, format dates. */
class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function api(path, { method = "GET", body } = {}) {
  const opts = { method, credentials: "same-origin", headers: {} };
  if (method !== "GET") {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body === undefined ? {} : body);
  }
  let res;
  try {
    res = await fetch("api/" + path, opts);
  } catch (_) {
    throw new ApiError(
      "Can't reach the server. Make sure Apache is running in XAMPP and you opened the site at http://localhost/…",
      0,
    );
  }
  let data;
  try {
    data = await res.json();
  } catch (_) {
    throw new ApiError(
      "The server sent an unexpected reply. Open the site through http://localhost/ (not by double-clicking the file) and check that PHP is running.",
      res.status,
    );
  }
  if (!res.ok || data.ok === false) {
    throw new ApiError(data.error || "Request failed.", res.status, data.code);
  }
  return data;
}

/* Only allow redirects to a plain page in this folder (no open redirects). */
function safeNext(value) {
  return value && /^[a-z0-9_-]+\.html$/i.test(value) ? value : null;
}

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

/* Local-time YYYY-MM-DD (toISOString would shift the day in Manila time). */
function isoDate(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fmtDate(iso, long) {
  if (!iso) return "";
  return new Date(iso + "T00:00").toLocaleDateString("en-PH", {
    weekday: long ? "long" : "short",
    month: long ? "long" : "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_LABEL = {
  pending: "Pending",
  approved: "Approved",
  rescheduled: "Rescheduled",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
};

function statusBadge(status) {
  return `<span class="badge badge-${esc(status)}">${esc(STATUS_LABEL[status] || status)}</span>`;
}

function peso(n) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(n) || 0);
}

/* "2026-10-15 14:30:00" (server time) -> "Oct 15, 2026, 2:30 PM" */
function fmtDateTime(s) {
  if (!s) return "";
  return new Date(s.replace(" ", "T")).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const METHOD_LABEL = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  card: "Card",
  bank_transfer: "Bank transfer",
  other: "Other",
};

/* Staff-side roles (everything except a normal patient account). */
function isStaffRole(role) {
  return role === "admin" || role === "staff" || role === "dentist";
}
