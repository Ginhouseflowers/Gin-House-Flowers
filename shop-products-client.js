(function () {
  window.GinShopProducts = {
    "florists-choice-bouquet": {
      id: "florists-choice-bouquet",
      name: "Florist\u2019s choice hand tied bouquet",
      minValue: 25,
      maxValue: 150,
      valueStep: 5,
      waterBubbleBagAddon: true,
    },
    "florists-choice-hatbox": {
      id: "florists-choice-hatbox",
      name: "Florist\u2019s choice hat box arrangement",
      minValue: 40,
      maxValue: 100,
      valueStep: 10,
      waterBubbleBagAddon: false,
    },
  };

  function registerFixedPrice(card) {
    var pence = card.pricePence || Math.round(Number(card.price) * 100);
    window.GinShopProducts[card.id] = {
      id: card.id,
      name: card.name,
      minValue: pence / 100,
      maxValue: pence / 100,
      valueStep: 1,
      waterBubbleBagAddon: false,
      fixedPrice: true,
      fixedPricePence: pence,
      saleLabel: card.product,
      group: card.group,
    };
  }

  if (window.GinOhhDeerCards) window.GinOhhDeerCards.forEach(registerFixedPrice);
  if (window.GinMandGProducts) window.GinMandGProducts.forEach(registerFixedPrice);
  if (window.GinPaperSalad) window.GinPaperSalad.forEach(registerFixedPrice);
  if (window.GinCambridgeConfectionery) window.GinCambridgeConfectionery.forEach(registerFixedPrice);
  if (window.GinCustomProducts) window.GinCustomProducts.forEach(registerFixedPrice);
})();
