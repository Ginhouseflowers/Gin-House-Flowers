const fs = require("fs");
const path = require("path");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WELCOME_CODE = "GINWELCOME10";
const STORE_PATH = path.join(__dirname, "..", "data", "newsletter.json");

function welcomeBody() {
  return {
    ok: true,
    code: WELCOME_CODE,
    message:
      "You're on the list. Use code " +
      WELCOME_CODE +
      " at checkout for 10% off your first online order.",
  };
}

function validateEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return "";
  return email;
}

async function addToBrevo(email) {
  const listId = String(process.env.BREVO_LIST_ID || "").trim();
  const payload = { email: email, updateEnabled: true };
  if (listId && /^\d+$/.test(listId)) payload.listIds = [Number(listId)];

  const response = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) return { ok: true };
  let detail = "";
  try {
    const data = await response.json();
    detail = data.code || data.message || "";
  } catch (e) {
    detail = "";
  }
  if (response.status === 400 && String(detail).toLowerCase().indexOf("duplicate") !== -1) {
    return { ok: true };
  }
  return { ok: false };
}

function addToFile(email) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  let current = [];
  if (fs.existsSync(STORE_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
      if (Array.isArray(parsed)) current = parsed;
    } catch (e) {
      current = [];
    }
  }
  if (!current.some(function (row) { return row && row.email === email; })) {
    current.push({ email: email, signedUpAt: new Date().toISOString() });
    fs.writeFileSync(STORE_PATH, JSON.stringify(current, null, 2));
  }
  return { ok: true };
}

async function subscribeNewsletter(data) {
  if (data && String(data.company || "").trim()) {
    return { status: 200, body: welcomeBody() };
  }

  const email = validateEmail(data && data.email);
  if (!email) {
    return { status: 400, body: { error: "Please enter a valid email address." } };
  }

  let listed = false;
  try {
    if (process.env.BREVO_API_KEY) {
      const added = await addToBrevo(email);
      if (!added.ok) {
        return {
          status: 502,
          body: { error: "We couldn't add you to the list. Please try again in a moment." },
        };
      }
      listed = true;
    } else {
      addToFile(email);
      listed = true;
    }
  } catch (err) {
    console.error(err);
  }

  const body = welcomeBody();
  body.listed = listed;
  if (!listed) {
    body.message =
      "Your welcome code is " +
      WELCOME_CODE +
      ". Enter it at checkout for 10% off your first online order.";
  }
  return { status: 200, body: body };
}

module.exports = { subscribeNewsletter, WELCOME_CODE };
