/**
 * Send email through the shop's own mailbox (SMTP), or Resend if only RESEND_API_KEY is set.
 */

const nodemailer = require("nodemailer");

let transporter = null;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function emailConfigured() {
  return smtpConfigured() || Boolean(process.env.RESEND_API_KEY);
}

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 465;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendViaSmtp({ to, subject, text, html, replyTo }) {
  const from =
    process.env.SMTP_FROM || "Gin House Flowers website <" + process.env.SMTP_USER + ">";
  try {
    const info = await getTransporter().sendMail({
      from,
      to,
      subject,
      text,
      html,
      replyTo: replyTo || undefined,
    });
    return { ok: true, id: info.messageId };
  } catch (err) {
    return { ok: false, error: "SMTP error: " + err.message };
  }
}

async function sendViaResend({ to, subject, text, html, replyTo }) {
  const from =
    process.env.CONTACT_FROM_EMAIL ||
    process.env.ORDER_FROM_EMAIL ||
    "Gin House Flowers <onboarding@resend.dev>";

  const body = { from, to, subject, text, html };
  if (replyTo) {
    body.reply_to = replyTo;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.RESEND_API_KEY,
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

async function sendEmail({ to, subject, text, html, replyTo }) {
  const message = {
    to: Array.isArray(to) ? to : [to],
    subject,
    text,
    html,
    replyTo,
  };

  if (smtpConfigured()) {
    return sendViaSmtp(message);
  }
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(message);
  }
  return {
    ok: false,
    skipped: true,
    error: "Email is not configured (set SMTP_HOST, SMTP_USER and SMTP_PASS) — email was not sent.",
  };
}

module.exports = { escapeHtml, emailConfigured, sendEmail };
