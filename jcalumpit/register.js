const registrationform = document.getElementById("registrationform");
const message = document.getElementById("message");
const nextPage = safeNext(new URLSearchParams(location.search).get("next"));

function showError(text) {
  message.textContent = text;
  message.style.color = "red";
}

// Keep ?next when switching to the sign-in page.
if (nextPage) {
  document.querySelectorAll('a[href="login.html"]').forEach((a) => {
    a.href = "login.html?next=" + encodeURIComponent(nextPage);
  });
}

// Already signed in? Nothing to register.
api("session.php")
  .then((r) => {
    if (r.user) {
      location.replace(
        r.user.role === "patient" ? nextPage || "index.html" : "admin.html",
      );
    }
  })
  .catch(() => {});

registrationform.addEventListener("submit", async function (event) {
  event.preventDefault();

  const value = (id) => document.getElementById(id).value.trim();
  const firstName = value("firstName");
  const middleName = value("middleName");
  const lastName = value("lastName");
  const gender = document.getElementById("gender").value;
  const birthDate = document.getElementById("birthDate").value;
  const email = value("regEmail");
  const phone = value("phone");
  const address = value("address");
  const username = value("username");
  const password = document.getElementById("regPassword").value;
  const confirmPassword = document.getElementById("regConfirm").value;

  if (firstName === "") return showError("Please enter your first name.");
  if (middleName === "") return showError("Please enter your middle name.");
  if (lastName === "") return showError("Please enter your last name.");
  if (gender === "") return showError("Please select your gender.");
  if (birthDate === "") return showError("Please enter your birth date.");

  // Age check
  const birthDateObj = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birthDateObj.getFullYear();
  const monthDiff = today.getMonth() - birthDateObj.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDateObj.getDate())
  ) {
    age--;
  }
  if (age < 18)
    return showError("Minors under 18 years old are not allowed to register.");

  if (email === "") return showError("Please enter your email.");
  if (phone === "") return showError("Please enter your phone number.");
  if (!/^(09|\+639)\d{9}$/.test(phone.replace(/[\s-]/g, "")))
    return showError("Use a valid PH mobile number, e.g. 09171234567.");
  if (address === "") return showError("Please enter your address.");
  if (address.length < 5)
    return showError("Please enter your complete address.");

  if (username === "") return showError("Please enter your username.");
  if (!/^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)?$/.test(username))
    return showError(
      "Username may only contain letters, numbers, or a single hyphen — no spaces.",
    );
  if (username.length < 3 || username.length > 30)
    return showError("Username must be 3 to 30 characters long.");

  if (password.length < 8)
    return showError("Password must be at least 8 characters.");
  if (!/[0-9]/.test(password))
    return showError("Password must contain at least one number.");
  if (!/[a-z]/.test(password))
    return showError("Password must contain at least one lowercase letter.");
  if (password !== confirmPassword) return showError("Passwords do not match!");

  const btn = registrationform.querySelector(".submit");
  btn.disabled = true;
  btn.textContent = "Creating account…";
  message.textContent = "";

  try {
    await api("register.php", {
      method: "POST",
      body: {
        firstName,
        middleName,
        lastName,
        gender,
        birthDate,
        email,
        phone,
        address,
        username,
        password,
        confirmPassword,
      },
    });
    message.textContent = "Account created! Signing you in…";
    message.style.color = "green";
    setTimeout(() => (location.href = nextPage || "index.html"), 700);
  } catch (err) {
    showError(err.message);
    btn.disabled = false;
    btn.textContent = "Create account";
  }
});
