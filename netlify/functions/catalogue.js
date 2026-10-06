const { catalogueScript } = require("../../shared/stock-api");

exports.handler = async function () {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: await catalogueScript(),
  };
};
