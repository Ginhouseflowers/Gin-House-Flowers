(function (root, factory) {
  var products = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { PAPER_SALAD: products };
  }
  if (root && root.window === root) {
    root.GinPaperSalad = products;
  }
})(typeof window !== "undefined" ? window : this, function () {
  // Spring cards (Valentine's, Mother's and Father's Day) stay hidden until this date.
  var SPRING_ON_SALE_FROM = "2027-01-04";

  var everyday = [];
  var spring = [];

  var onSale = Date.now() >= new Date(SPRING_ON_SALE_FROM + "T00:00:00").getTime();
  return everyday.concat(onSale ? spring : []);
});
