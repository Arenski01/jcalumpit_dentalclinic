const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const params = new URLSearchParams(location.search);
const nextPage = safeNext(params.get("next"));

function setMessage(text, kind) {
  loginMessage.textContent = text;
  loginMessage.className = "form-message " + (kind || "");
}

function goAfterLogin(user) {
  const staff = isStaffRole(user.role);
  location.href = staff ? "admin.html" : nextPage || "index.html";
}

// Keep ?next when switching to the register page.
if (nextPage) {
  document.querySelectorAll('a[href="register.html"]').forEach((a) => {
    a.href = "register.html?next=" + encodeURIComponent(nextPage);
  });
}
if (params.get("notice") === "book") {
  setMessage(
    "Please sign in or create an account to book an appointment.",
    "info",
  );
}

// Already signed in? Skip the form.
api("session.php")
  .then((r) => r.user && goAfterLogin(r.user))
  .catch(() => {});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = loginForm.querySelector(".submit");
  const identifier = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const remember = document.getElementById("rememberMe").checked;

  setMessage("", "");
  btn.disabled = true;
  btn.textContent = "Signing in…";
  try {
    const r = await api("login.php", {
      method: "POST",
      body: { identifier, password, remember },
    });
    goAfterLogin(r.user);
  } catch (err) {
    setMessage(err.message, "error");
    btn.disabled = false;
    btn.textContent = "Sign In";
  }
});
