const { catalogueScript } = require("../shared/stock-api");

module.exports = async function (req, res) {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=30, stale-while-revalidate=30");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).send("");
    return;
  }
  try {
    res.status(200).send(await catalogueScript());
  } catch (err) {
    console.error(err);
    res.status(200).send('window.GinCustomProducts = [];\nwindow.GinNotice = null;\nwindow.GinClosedDates = [];\nwindow.GinAnalyticsId = "";\n');
  }
};
