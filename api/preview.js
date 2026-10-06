const { keysMatch, previewCookie } = require("../shared/preview-access");

module.exports = function (req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).type("text/plain").send("Method not allowed");
    return;
  }

  const url = new URL(req.url, "https://www.ginhouseflowers.co.uk");
  if (!keysMatch(url.searchParams.get("key"))) {
    res.status(401).type("text/plain").send("This preview link is not valid.");
    return;
  }

  const secure = req.headers["x-forwarded-proto"] === "https";
  const leave = url.searchParams.get("off") === "1";
  res.setHeader("Set-Cookie", previewCookie(secure, leave));
  res.redirect(302, leave ? "/holding.html" : "/");
};
