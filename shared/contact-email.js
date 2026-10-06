const { escapeHtml, sendResendEmail } = require("./resend-mail");

const ALLOWED_TOPICS = [
  "General enquiry",
  "Wedding",
  "Funeral",
  "Corporate / event",
  "Flower School",
  "Online order",
  "Mailing list",
  "Other",
];

const EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateContactEnquiry(data) {
  const name = String(data.name || "").trim();
  const email = String(data.email || "").trim().toLowerCase();
  const topic = String(data.topic || "").trim();
  const message = String(data.message || "").trim();
  const honeypot = String(data.website || "").trim();

  if (honeypot) {
    return { ok: false, error: "Unable to send your enquiry. Please try again." };
  }
  if (!name || name.length > 120) {
    return { ok: false, error: "Please enter your name." };
  }
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (!ALLOWED_TOPICS.includes(topic)) {
    return { ok: false, error: "Please select a topic." };
  }
  if (!message || message.length < 10) {
    return { ok: false, error: "Please enter a message of at least 10 characters." };
  }
  if (message.length > 5000) {
    return { ok: false, error: "Your message is too long. Please shorten it or call us." };
  }

  return {
    ok: true,
    enquiry: { name, email, topic, message },
  };
}

function buildContactEmailContent(enquiry) {
  const { name, email, topic, message } = enquiry;
  const subject = "Website enquiry: " + topic + " — " + name;

  const text = [
    "New enquiry from the Gin House Flowers website",
    "",
    "Name: " + name,
    "Email: " + email,
    "Topic: " + topic,
    "",
    "Message:",
    message,
    "",
    "—",
    "Reply directly to this email to respond to the customer.",
  ].join("\n");

  const html =
    "<h2>New website enquiry</h2>" +
    "<p><strong>Name:</strong> " +
    escapeHtml(name) +
    "</p>" +
    "<p><strong>Email:</strong> " +
    escapeHtml(email) +
    "</p>" +
    "<p><strong>Topic:</strong> " +
    escapeHtml(topic) +
    "</p>" +
    "<p><strong>Message:</strong></p>" +
    "<p style=\"white-space:pre-wrap\">" +
    escapeHtml(message) +
    "</p>" +
    "<p><em>Reply to this email to respond to the customer.</em></p>";

  return { subject, text, html, replyTo: email };
}

async function sendContactEnquiryEmail(data) {
  const validation = validateContactEnquiry(data);
  if (!validation.ok) {
    return { ok: false, status: 400, error: validation.error };
  }

  const content = buildContactEmailContent(validation.enquiry);
  const to =
    process.env.CONTACT_NOTIFY_EMAIL ||
    process.env.ORDER_NOTIFY_EMAIL ||
    "info@ginhouseflowers.co.uk";

  const result = await sendResendEmail({
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
    replyTo: content.replyTo,
  });

  if (result.skipped) {
    return {
      ok: false,
      status: 503,
      error:
        "Enquiry emails are not configured yet. Please email us at info@ginhouseflowers.co.uk or call 01223 656670.",
    };
  }

  if (!result.ok) {
    console.error("Contact enquiry email failed:", result.error);
    return {
      ok: false,
      status: 500,
      error: "Unable to send your enquiry. Please try again or email info@ginhouseflowers.co.uk.",
    };
  }

  return { ok: true, status: 200 };
}

module.exports = {
  ALLOWED_TOPICS,
  validateContactEnquiry,
  sendContactEnquiryEmail,
};
