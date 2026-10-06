const crypto = require("crypto");

function keysMatch(given) {
  const expected = process.env.PREVIEW_KEY || "";
  const attempt = String(given || "");
  if (!expected || !attempt || expected.length !== attempt.length) return false;
  return crypto.timingSafeEqual(Buffer.from(attempt), Buffer.from(expected));
}

function previewCookie(secure, clear) {
  const secureFlag = secure ? "; Secure" : "";
  if (clear) {
    return "ghf_preview=; Path=/; Max-Age=0; SameSite=Lax" + secureFlag;
  }
  return "ghf_preview=1; Path=/; Max-Age=2592000; SameSite=Lax" + secureFlag;
}

module.exports = { keysMatch, previewCookie };
