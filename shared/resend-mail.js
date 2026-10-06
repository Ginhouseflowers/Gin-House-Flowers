/**
 * Send email via Resend (https://resend.com).
 */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendResendEmail({ to, subject, text, html, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.CONTACT_FROM_EMAIL ||
    process.env.ORDER_FROM_EMAIL ||
    "Gin House Flowers <onboarding@resend.dev>";
  const recipients = Array.isArray(to) ? to : [to];

  if (!apiKey) {
    return {
      ok: false,
      skipped: true,
      error: "RESEND_API_KEY is not set — email was not sent.",
    };
  }

  const body = {
    from,
    to: recipients,
    subject,
    text,
    html,
  };
  if (replyTo) {
    body.reply_to = replyTo;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  let payload;
  try {
    payload = await response.json();
  } catch (e) {
    payload = {};
  }

  if (!response.ok) {
    return {
      ok: false,
      error: (payload && payload.message) || "Resend API error (" + response.status + ")",
    };
  }

  return { ok: true, id: payload.id };
}

module.exports = { escapeHtml, sendResendEmail };
