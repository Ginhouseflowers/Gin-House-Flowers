const { catalogueScript } = require("../../shared/stock-api");

exports.handler = async function () {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    },
    body: await catalogueScript(),
  };
};
