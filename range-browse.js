(function () {
  var ranges = window.GinRanges;
  if (!ranges) return;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatPrice(amount) {
    var pence = Math.round(Number(amount) * 100);
    if (pence % 100 === 0) return "£" + pence / 100;
    return "£" + (pence / 100).toFixed(2);
  }

  function brandsIn(group) {
    return ranges.brands.filter(function (brand) {
      return brand.groups.indexOf(group) !== -1;
    });
  }

  function groupHref(id) {
    if (id === "chocolate") return "range.html?brand=cambridge-confectionery&from=chocolate";
    if (ranges[id]) return id + ".html";
    return "cards.html";
  }

  function groupNoun(id) {
    if (id === "gifts") return "gift";
    if (id === "chocolate") return "chocolate";
    return "card";
  }

  function brandCopy(brand, group) {
    var extra = (brand.byGroup && brand.byGroup[group]) || {};
    return {
      note: extra.note || brand.note,
      blurb: extra.blurb || brand.blurb || "",
      image: extra.image || brand.image,
      imageAlt: extra.imageAlt || brand.imageAlt || brand.name,
    };
  }

  function brandCard(brand, group) {
    var copy = brandCopy(brand, group);
    return (
      '<li>' +
      '<a class="browse-card" href="range.html?brand=' +
      encodeURIComponent(brand.id) +
      "&from=" +
      encodeURIComponent(group) +
      '">' +
      '<span class="browse-card-visual">' +
      (copy.image
        ? '<img src="' +
          escapeHtml(copy.image) +
          '" alt="' +
          escapeHtml(copy.imageAlt) +
          '" width="900" height="675" loading="lazy" decoding="async">'
        : escapeHtml(brand.name)) +
      "</span>" +
      '<span class="browse-card-body">' +
      '<span class="browse-card-name">' +
      escapeHtml(brand.name) +
      "</span>" +
      '<span class="browse-card-note">' +
      escapeHtml(copy.note) +
      "</span>" +
      '<span class="browse-card-meta">' +
      escapeHtml(copy.blurb) +
      "</span>" +
      '<span class="browse-card-action">Browse</span>' +
      "</span>" +
      "</a>" +
      "</li>"
    );
  }

  function viewAllCard(group) {
    return (
      '<li>' +
      '<a class="browse-card browse-card--view-all" href="view-all.html?group=' +
      encodeURIComponent(group) +
      '">' +
      '<span class="browse-card-visual" aria-hidden="true">' +
      '<span class="browse-grid-icon"><span></span><span></span><span></span><span></span></span>' +
      "</span>" +
      '<span class="browse-card-body">' +
      '<span class="browse-card-name">View All</span>' +
      '<span class="browse-card-action">Browse</span>' +
      "</span>" +
      "</a>" +
      "</li>"
    );
  }

  document.querySelectorAll("[data-range-index]").forEach(function (list) {
    var group = list.getAttribute("data-range-index");
    list.innerHTML =
      viewAllCard(group) +
      brandsIn(group)
        .map(function (brand) {
          return brandCard(brand, group);
        })
        .join("");
  });

  function bindProductShop(scope, catalogue, noun, searchLabel) {
    var filterRoot = scope.querySelector("[data-products-filters]");
    var grid = scope.querySelector("[data-products-grid]");
    var countEl = scope.querySelector("[data-products-count]");
    var emptyEl = scope.querySelector("[data-products-empty]");
    var resetBtn = scope.querySelector("[data-products-reset]");
    var searchForm = scope.querySelector("[data-products-search-form]");
    var searchEl = scope.querySelector("[data-products-search]");
    var productShop = scope.matches("[data-products-shop]")
      ? scope
      : scope.querySelector("[data-products-shop]");

    if (productShop) productShop.hidden = false;
    if (searchEl) {
      searchEl.placeholder = searchLabel;
      var label = searchEl.previousElementSibling;
      if (label) label.textContent = searchLabel;
    }
    if (emptyEl) emptyEl.textContent = "No " + noun + "s match that search.";

    function uniqueField(key) {
      var seen = {};
      var values = [];
      catalogue.forEach(function (card) {
        var list = key === "styles" ? card.styles || [] : [card[key]];
        list.forEach(function (value) {
          if (value && !seen[value]) {
            seen[value] = true;
            values.push(value);
          }
        });
      });
      values.sort(function (a, b) {
        return a.localeCompare(b);
      });
      return values;
    }

    function filterGroup(title, key, values) {
      if (!values.length) return "";
      var options = values
        .map(function (value) {
          return (
            '<label class="filter-option"><input type="checkbox" data-filter-key="' +
            key +
            '" value="' +
            escapeHtml(value) +
            '"> <span>' +
            escapeHtml(value) +
            "</span></label>"
          );
        })
        .join("");
      return (
        '<div class="filter-group">' +
        '<button type="button" class="filter-toggle" aria-expanded="false">' +
        "<span>" +
        escapeHtml(title) +
        "</span>" +
        '<span class="filter-plus" aria-hidden="true">+</span>' +
        "</button>" +
        '<div class="filter-options" hidden>' +
        options +
        "</div>" +
        "</div>"
      );
    }

    if (filterRoot) {
      var brandPage = scope.matches("[data-brand-products]");
      filterRoot.innerHTML =
        filterGroup("Brand", "brand", brandPage ? [] : uniqueField("brand")) +
        filterGroup("Product", "product", uniqueField("product")) +
        filterGroup(
          catalogue.some(function (card) {
            return card.group === "cards";
          })
            ? "Card Occasion"
            : "Occasion",
          "occasion",
          uniqueField("occasion")
        ) +
        filterGroup("Style", "styles", uniqueField("styles"));
      filterRoot.querySelectorAll(".filter-toggle").forEach(function (button) {
        var panel = button.nextElementSibling;
        var plus = button.querySelector(".filter-plus");
        button.addEventListener("click", function () {
          var open = button.getAttribute("aria-expanded") === "true";
          button.setAttribute("aria-expanded", open ? "false" : "true");
          panel.hidden = open;
          if (plus) plus.textContent = open ? "+" : "−";
        });
      });
      filterRoot.addEventListener("change", applyProductFilters);
    }

    function selected(key) {
      if (!filterRoot) return [];
      return Array.prototype.map.call(
        filterRoot.querySelectorAll('input[data-filter-key="' + key + '"]:checked'),
        function (input) {
          return input.value;
        }
      );
    }

    function applyProductFilters() {
      var products = selected("product");
      var brands = selected("brand");
      var occasions = selected("occasion");
      var styles = selected("styles");
      var query = searchEl ? searchEl.value.trim().toLowerCase() : "";
      var words = query.split(/\s+/).filter(Boolean);
      var shown = 0;
      if (!grid) return;
      Array.prototype.forEach.call(grid.children, function (item) {
        var productOk = !products.length || products.indexOf(item.getAttribute("data-product")) !== -1;
        var brandOk = !brands.length || brands.indexOf(item.getAttribute("data-range")) !== -1;
        var occasionOk = !occasions.length || occasions.indexOf(item.getAttribute("data-occasion")) !== -1;
        var itemStyles = (item.getAttribute("data-styles") || "").split("|").filter(Boolean);
        var styleOk =
          !styles.length ||
          styles.some(function (style) {
            return itemStyles.indexOf(style) !== -1;
          });
        var haystack = item.getAttribute("data-search") || "";
        var searchOk =
          !words.length ||
          words.every(function (word) {
            return haystack.indexOf(word) !== -1;
          });
        var listed = !(window.GinStock && window.GinStock.deleted(item.id));
        var match = listed && productOk && brandOk && occasionOk && styleOk && searchOk;
        item.hidden = !match;
        if (match) shown += 1;
      });
      if (countEl) {
        countEl.textContent = shown + " " + (shown === 1 ? noun : noun + "s");
      }
      if (emptyEl) emptyEl.hidden = shown !== 0;
      if (resetBtn) {
        resetBtn.classList.toggle(
          "is-active",
          products.length + brands.length + occasions.length + styles.length === 0 && !query
        );
      }
    }

    function priceMarkup(card) {
      var pricing = window.GinStock && window.GinStock.pricing(card.id);
      if (pricing && pricing.onSale) {
        return (
          '<span class="browse-card-price browse-card-price--sale">' +
          '<span class="browse-card-sale">Sale</span> ' +
          formatPrice(pricing.pence / 100) +
          ' <s class="browse-card-was">' +
          formatPrice(pricing.regularPence / 100) +
          "</s></span>"
        );
      }
      return (
        '<span class="browse-card-price">' +
        formatPrice(pricing ? pricing.pence / 100 : card.price) +
        "</span>"
      );
    }

    function ribbonMarkup(card, blocked) {
      if (blocked) {
        return '<span class="browse-card-ribbon browse-card-ribbon--out">Out of stock</span>';
      }
      var pricing = window.GinStock && window.GinStock.pricing(card.id);
      if (pricing && pricing.onSale) {
        return '<span class="browse-card-ribbon browse-card-ribbon--sale">Sale</span>';
      }
      return "";
    }

    function cardMarkup(card) {
      var blocked = Boolean(window.GinStock && window.GinStock.blocked(card.id));
      return (
        '<li id="' +
        escapeHtml(card.id) +
        '" data-product="' +
        escapeHtml(card.product) +
        '" data-range="' +
        escapeHtml(card.brand) +
        '" data-occasion="' +
        escapeHtml(card.occasion) +
        '" data-styles="' +
        escapeHtml((card.styles || []).join("|")) +
        '" data-search="' +
        escapeHtml(
          [card.name, card.blurb, card.occasion, card.product, card.brand, card.sku]
            .join(" ")
            .toLowerCase()
        ) +
        '">' +
        '<article class="browse-card browse-card--product' +
        (blocked ? " is-out-of-stock" : "") +
        '">' +
        '<span class="browse-card-visual">' +
        ribbonMarkup(card, blocked) +
        (card.image
          ? '<img src="' +
            escapeHtml(card.image) +
            '" alt="' +
            escapeHtml(card.imageAlt || card.name) +
            '" width="800" height="800" loading="lazy" decoding="async">'
          : escapeHtml(card.name)) +
        '<span class="browse-card-peek" aria-hidden="true">View details</span>' +
        "</span>" +
        '<span class="browse-card-body">' +
        '<a class="browse-card-name browse-card-link" href="#' +
        escapeHtml(card.id) +
        '" data-open-product="' +
        escapeHtml(card.id) +
        '">' +
        escapeHtml(card.name) +
        "</a>" +
        '<span class="browse-card-note">' +
        escapeHtml(card.occasion || card.product) +
        "</span>" +
        '<span class="browse-card-meta">' +
        escapeHtml(card.blurb) +
        "</span>" +
        priceMarkup(card) +
        (blocked
          ? '<button type="button" class="browse-card-action" data-add-card="' +
            escapeHtml(card.id) +
            '" disabled>Out of stock</button>'
          : '<button type="button" class="browse-card-action" data-add-card="' +
            escapeHtml(card.id) +
            '">Add to basket</button>') +
        "</span>" +
        "</article>" +
        "</li>"
      );
    }

    var gridMarkup = catalogue.map(cardMarkup).join("");
    if (grid) {
      grid.innerHTML = gridMarkup;
      grid.addEventListener("click", function (event) {
        var opener = event.target.closest("[data-open-product]");
        if (opener) {
          event.preventDefault();
          openProduct(opener.getAttribute("data-open-product"));
          return;
        }
        var button = event.target.closest("[data-add-card]");
        if (!button) return;
        var card = catalogue.filter(function (item) {
          return item.id === button.getAttribute("data-add-card");
        })[0];
        if (!card) return;
        if (!addCardToBasket(card)) {
          var left = window.GinStock ? window.GinStock.available(card.id) : 0;
          button.textContent = left === 0 ? "Out of stock" : "Only " + left + " left";
          if (left === 0) button.disabled = true;
          else {
            window.setTimeout(function () {
              button.textContent = "Add to basket";
            }, 1200);
          }
          return;
        }
        button.textContent = "Added";
        window.setTimeout(function () {
          button.textContent = "Add to basket";
        }, 1200);
      });
    }

    var dialog = null;
    var dialogCard = null;
    var returnFocus = null;
    var icons = {
      close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
      prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    };

    function cardById(id) {
      return catalogue.filter(function (item) {
        return item.id === id;
      })[0];
    }

    function shownIds() {
      if (!grid) return [];
      return Array.prototype.filter
        .call(grid.children, function (item) {
          return !item.hidden;
        })
        .map(function (item) {
          return item.id;
        });
    }

    function ensureDialog() {
      if (dialog) return dialog;
      dialog = document.createElement("dialog");
      dialog.className = "product-dialog";
      dialog.setAttribute("aria-labelledby", "product-dialog-title");
      dialog.innerHTML =
        '<div class="product-dialog-panel">' +
        '<button type="button" class="product-dialog-btn product-dialog-close" data-product-close aria-label="Close">' +
        icons.close +
        "</button>" +
        '<div class="product-dialog-media">' +
        '<button type="button" class="product-dialog-zoom" data-product-zoom>' +
        '<img alt="" width="800" height="800" decoding="async" data-product-image>' +
        '<span class="product-dialog-zoom-hint">' +
        icons.expand +
        "<span>View full size</span></span>" +
        "</button>" +
        "</div>" +
        '<div class="product-dialog-body" data-product-body></div>' +
        '<div class="product-dialog-nav">' +
        '<button type="button" class="product-dialog-btn" data-product-step="-1" aria-label="Previous product">' +
        icons.prev +
        "</button>" +
        '<p class="product-dialog-count" data-product-count></p>' +
        '<button type="button" class="product-dialog-btn" data-product-step="1" aria-label="Next product">' +
        icons.next +
        "</button>" +
        "</div>" +
        "</div>" +
        '<div class="product-dialog-full" data-product-full hidden>' +
        '<img alt="" data-product-full-image>' +
        '<button type="button" class="product-dialog-btn product-dialog-close" data-product-full-close aria-label="Close full size image">' +
        icons.close +
        "</button>" +
        "</div>";
      document.body.appendChild(dialog);

      dialog.addEventListener("click", function (event) {
        var target = event.target;
        if (target === dialog || target.closest("[data-product-close]")) {
          closeProduct();
          return;
        }
        if (target.closest("[data-product-zoom]")) {
          openFull();
          return;
        }
        if (target.closest("[data-product-full]")) {
          closeFull();
          return;
        }
        var step = target.closest("[data-product-step]");
        if (step) {
          stepProduct(Number(step.getAttribute("data-product-step")));
          return;
        }
        var qtyBtn = target.closest("[data-product-qty]");
        if (qtyBtn) {
          var input = dialog.querySelector("[data-product-qty-input]");
          var max = Number(input.max) || 99;
          var next = (Number(input.value) || 1) + Number(qtyBtn.getAttribute("data-product-qty"));
          input.value = String(Math.max(1, Math.min(max, next)));
          return;
        }
        if (target.closest("[data-product-add]")) addFromDialog();
      });

      dialog.addEventListener("cancel", function (event) {
        var full = dialog.querySelector("[data-product-full]");
        if (!full.hidden) {
          event.preventDefault();
          closeFull();
        }
      });

      dialog.addEventListener("close", function () {
        closeFull();
        document.documentElement.classList.remove("has-product-dialog");
        if (location.hash) history.replaceState(null, "", location.pathname + location.search);
        dialogCard = null;
        if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
      });

      dialog.addEventListener("keydown", function (event) {
        var fullOpen = !dialog.querySelector("[data-product-full]").hidden;
        if (event.key === "Escape") {
          event.preventDefault();
          if (fullOpen) closeFull();
          else closeProduct();
          return;
        }
        if (fullOpen) return;
        if (event.target.closest && event.target.closest("input")) return;
        if (event.key === "ArrowLeft") stepProduct(-1);
        if (event.key === "ArrowRight") stepProduct(1);
      });

      return dialog;
    }

    function detailRow(label, value) {
      if (!value) return "";
      return "<div><dt>" + escapeHtml(label) + "</dt><dd>" + escapeHtml(value) + "</dd></div>";
    }

    function deliveryNote(card) {
      if (card.group === "cards" || card.group === "gifts") {
        return "Collect from our shop at 11 High Street, Histon, choose local delivery, or have it posted anywhere in the UK for £3.99.";
      }
      return "Collect from our shop at 11 High Street, Histon, or choose local delivery within 10 miles.";
    }

    function renderProduct(card) {
      var body = dialog.querySelector("[data-product-body]");
      var image = dialog.querySelector("[data-product-image]");
      var zoom = dialog.querySelector("[data-product-zoom]");
      var left = window.GinStock ? window.GinStock.available(card.id) : null;
      var blocked = left === 0;
      var max = left == null ? 99 : Math.max(1, Math.min(99, left));

      if (card.image) {
        image.src = card.image;
        image.alt = card.imageAlt || card.name;
        zoom.hidden = false;
        zoom.setAttribute("aria-label", "View full size image of " + card.name);
      } else {
        image.removeAttribute("src");
        zoom.hidden = true;
      }

      body.innerHTML =
        '<p class="eyebrow">' +
        escapeHtml(card.brand) +
        "</p>" +
        '<h2 class="product-dialog-title" id="product-dialog-title">' +
        escapeHtml(card.name) +
        "</h2>" +
        '<p class="product-dialog-price">' +
        priceMarkup(card) +
        "</p>" +
        (card.blurb ? '<p class="product-dialog-blurb">' + escapeHtml(card.blurb) + "</p>" : "") +
        '<dl class="product-dialog-details">' +
        detailRow("Brand", card.brand) +
        detailRow("Type", card.product) +
        detailRow("Occasion", card.occasion) +
        detailRow("Style", (card.styles || []).join(", ")) +
        detailRow("Product code", card.sku) +
        "</dl>" +
        (blocked
          ? '<p class="product-dialog-stock product-dialog-stock--out">Out of stock online. Call 01223 656670 and we will check the shop for you.</p>'
          : left != null && left <= 5
            ? '<p class="product-dialog-stock">Only ' + left + " left online.</p>"
            : "") +
        '<div class="product-dialog-buy">' +
        '<div class="product-dialog-qty">' +
        '<button type="button" data-product-qty="-1" aria-label="One fewer"' +
        (blocked ? " disabled" : "") +
        ">−</button>" +
        '<label><span class="visually-hidden">Quantity</span>' +
        '<input type="number" inputmode="numeric" min="1" max="' +
        max +
        '" value="1" data-product-qty-input' +
        (blocked ? " disabled" : "") +
        "></label>" +
        '<button type="button" data-product-qty="1" aria-label="One more"' +
        (blocked ? " disabled" : "") +
        ">+</button>" +
        "</div>" +
        '<button type="button" class="btn btn-primary product-dialog-add" data-product-add' +
        (blocked ? " disabled" : "") +
        ">" +
        (blocked ? "Out of stock" : "Add to basket") +
        "</button>" +
        "</div>" +
        '<p class="product-dialog-status" data-product-status role="status" aria-live="polite"></p>' +
        '<p class="product-dialog-note">' +
        escapeHtml(deliveryNote(card)) +
        "</p>";

      var ids = shownIds();
      var index = ids.indexOf(card.id);
      var nav = dialog.querySelector(".product-dialog-nav");
      nav.hidden = ids.length < 2 || index === -1;
      dialog.querySelector("[data-product-count]").textContent =
        index === -1 ? "" : index + 1 + " of " + ids.length;
    }

    function openProduct(id, fromLink) {
      var card = cardById(id);
      if (!card || (window.GinStock && window.GinStock.deleted(card.id))) return;
      ensureDialog();
      dialogCard = card;
      renderProduct(card);
      dialog.querySelector(".product-dialog-panel").scrollTop = 0;
      if (location.hash !== "#" + card.id) {
        history.replaceState(null, "", location.pathname + location.search + "#" + card.id);
      }
      if (!dialog.open) {
        returnFocus = fromLink ? null : document.activeElement;
        document.documentElement.classList.add("has-product-dialog");
        dialog.showModal();
        dialog.querySelector("[data-product-close]").focus();
      }
    }

    function closeProduct() {
      if (dialog && dialog.open) dialog.close();
    }

    function stepProduct(direction) {
      if (!dialogCard) return;
      var ids = shownIds();
      var index = ids.indexOf(dialogCard.id);
      if (index === -1 || ids.length < 2) return;
      var nextId = ids[(index + direction + ids.length) % ids.length];
      var nextItem = document.getElementById(nextId);
      var nextLink = nextItem && nextItem.querySelector("[data-open-product]");
      if (nextLink) returnFocus = nextLink;
      openProduct(nextId);
    }

    function openFull() {
      if (!dialogCard || !dialogCard.image) return;
      var full = dialog.querySelector("[data-product-full]");
      var img = full.querySelector("[data-product-full-image]");
      img.src = dialogCard.image;
      img.alt = dialogCard.imageAlt || dialogCard.name;
      full.hidden = false;
      full.querySelector("[data-product-full-close]").focus();
    }

    function closeFull() {
      if (!dialog) return;
      var full = dialog.querySelector("[data-product-full]");
      if (full.hidden) return;
      full.hidden = true;
      var zoom = dialog.querySelector("[data-product-zoom]");
      if (zoom && !zoom.hidden) zoom.focus();
    }

    function addFromDialog() {
      if (!dialogCard) return;
      var input = dialog.querySelector("[data-product-qty-input]");
      var button = dialog.querySelector("[data-product-add]");
      var status = dialog.querySelector("[data-product-status]");
      var qty = Math.max(1, Math.floor(Number(input.value) || 1));
      if (!addCardToBasket(dialogCard, qty)) {
        var left = window.GinStock ? window.GinStock.available(dialogCard.id) : 0;
        status.textContent =
          left === 0 ? "This is out of stock online." : "Only " + left + " left online, including any already in your basket.";
        return;
      }
      button.textContent = "Added";
      status.innerHTML =
        "Added to your basket. " +
        '<a href="basket.html">View basket</a> or <button type="button" class="product-dialog-link" data-product-close>keep shopping</button>.';
      window.setTimeout(function () {
        if (button.isConnected) button.textContent = "Add to basket";
      }, 1600);
    }

    function openFromHash() {
      var id = decodeURIComponent(location.hash.slice(1));
      if (!id) {
        closeProduct();
        return;
      }
      if (cardById(id)) openProduct(id, true);
    }

    window.addEventListener("hashchange", openFromHash);

    window.addEventListener("ginhouse:stock", function () {
      if (!grid) return;
      var nextMarkup = catalogue.map(cardMarkup).join("");
      if (nextMarkup !== gridMarkup) {
        gridMarkup = nextMarkup;
        grid.innerHTML = gridMarkup;
      }
      applyProductFilters();
      if (dialog && dialog.open && dialogCard) renderProduct(dialogCard);
    });

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (filterRoot) {
          filterRoot.querySelectorAll("input").forEach(function (input) {
            input.checked = false;
          });
        }
        if (searchEl) searchEl.value = "";
        applyProductFilters();
      });
    }
    if (searchEl) searchEl.addEventListener("input", applyProductFilters);
    if (searchForm) {
      searchForm.addEventListener("submit", function (event) {
        event.preventDefault();
        applyProductFilters();
      });
    }
    applyProductFilters();
    openFromHash();
  }

  function shopCatalogue() {
    return []
      .concat(window.GinOhhDeerCards || [])
      .concat(window.GinMandGProducts || [])
      .concat(window.GinPaperSalad || [])
      .concat(window.GinCambridgeConfectionery || [])
      .concat(window.GinCustomProducts || []);
  }

  var productsPage = document.querySelector("[data-products]");
  if (productsPage) {
    var productGroupId = new URLSearchParams(location.search).get("group");
    var productGroup = ranges[productGroupId] || ranges.cards;
    var productHero = productsPage.querySelector("[data-products-hero]");
    var backHref = groupHref(productGroup.id);
    var catalogue = shopCatalogue().filter(function (card) {
      return card.group === productGroup.id;
    });
    document.title = productGroup.title + " — Gin House Flowers";

    if (!catalogue.length) {
      if (productHero) {
        productHero.innerHTML =
          '<p class="eyebrow">Shop online</p>' +
          "<h1>" +
          escapeHtml(productGroup.title) +
          "</h1>" +
          '<p class="lede">No products for now.</p>' +
          '<p class="browse-back"><a href="' +
          backHref +
          '">Back to ' +
          escapeHtml(productGroup.title.toLowerCase()) +
          "</a></p>";
      }
    } else {
      var noun = groupNoun(productGroup.id);
      var brands = [];
      catalogue.forEach(function (card) {
        if (brands.indexOf(card.brand) === -1) brands.push(card.brand);
      });
      var samePrice = catalogue.every(function (card) {
        return card.price === catalogue[0].price;
      });
      var lede;
      if (brands.length === 1 && samePrice) {
        lede =
          brands[0] +
          " " +
          noun +
          "s, " +
          formatPrice(catalogue[0].price) +
          " each. Add one to your basket for collection from Histon or local delivery.";
      } else {
        lede =
          productGroup.title +
          " from " +
          brands.join(" and ") +
          ". Add one to your basket for collection from Histon or local delivery.";
      }
      if (productHero) {
        productHero.innerHTML =
          '<p class="eyebrow">Shop online</p>' +
          "<h1>" +
          escapeHtml(productGroup.title) +
          "</h1>" +
          '<p class="lede">' +
          escapeHtml(lede) +
          "</p>" +
          '<p class="browse-back"><a href="' +
          backHref +
          '">Back to ' +
          escapeHtml(productGroup.title.toLowerCase()) +
          "</a></p>";
      }
      bindProductShop(productsPage, catalogue, noun, "Search " + productGroup.title.toLowerCase());
    }
  }

  function addCardToBasket(card, qty) {
    var adding = Math.max(1, Math.min(99, Math.floor(Number(qty) || 1)));
    var storageKey = "ginhouseflowers-basket";
    var items = [];
    try {
      var parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
      items = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      items = [];
    }
    var existing = items.filter(function (item) {
      return item.productId === card.id;
    })[0];
    var nextQty = (existing ? Number(existing.quantity || 1) : 0) + adding;
    if (window.GinStock && !window.GinStock.allows(card.id, nextQty)) {
      return false;
    }
    if (existing) {
      existing.quantity = Math.min(99, nextQty);
    } else {
      items.push({
        lineId: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 9),
        productId: card.id,
        name: card.name,
        value: (function () {
          var pricing = window.GinStock && window.GinStock.pricing(card.id);
          return pricing ? pricing.pence / 100 : card.price;
        })(),
        colour: "none",
        colourOther: "",
        quantity: Math.min(99, adding),
        waterBubbleBag: false,
      });
    }
    localStorage.setItem(storageKey, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("ginhouse:basket", { detail: { reason: "add" } }));
    return true;
  }

  var detail = document.querySelector("[data-range-detail]");
  if (!detail) return;

  var params = new URLSearchParams(location.search);
  var brand = ranges.brands.filter(function (item) {
    return item.id === params.get("brand");
  })[0];
  var from = params.get("from");
  if (!brand || !ranges[from] || brand.groups.indexOf(from) === -1) {
    from = brand && brand.groups[0] ? brand.groups[0] : "gifts";
  }
  var group = ranges[from] || ranges.gifts;

  if (!brand) {
    detail.innerHTML =
      '<p class="eyebrow">Shop online</p>' +
      "<h1>Cards and gifts</h1>" +
      '<p class="lede">Choose a range from the cards or gifts we stock in Histon.</p>' +
      '<p class="browse-back"><a href="cards.html">Cards</a> · <a href="gifts.html">Gifts</a> · <a href="range.html?brand=cambridge-confectionery&from=chocolate">Chocolate</a></p>';
    return;
  }

  document.title = brand.name + " — Gin House Flowers";
  var brandCatalogue = shopCatalogue().filter(function (card) {
    return card.brand === brand.name && card.group === from;
  });
  var backHref = groupHref(from);
  var showGroupLink = brandsIn(from).length > 1;
  var samePrice =
    brandCatalogue.length > 0 &&
    brandCatalogue.every(function (card) {
      return card.price === brandCatalogue[0].price;
    });
  var copy = brandCopy(brand, from);
  var lede = copy.blurb || copy.note;
  if (brandCatalogue.length && samePrice) {
    lede = lede + " " + formatPrice(brandCatalogue[0].price) + " each.";
  }
  detail.innerHTML =
    '<p class="eyebrow">Shop online · ' +
    escapeHtml(group.title) +
    "</p>" +
    "<h1>" +
    escapeHtml(brand.name) +
    "</h1>" +
    '<p class="lede">' +
    escapeHtml(lede) +
    "</p>" +
    (showGroupLink
      ? '<p class="browse-back"><a href="' +
        backHref +
        '">All ' +
        escapeHtml(group.title.toLowerCase()) +
        "</a></p>"
      : "") +
    (brandCatalogue.length
      ? ""
      : (copy.image
          ? '<figure class="browse-range-photo"><img src="' +
            escapeHtml(copy.image) +
            '" alt="' +
            escapeHtml(copy.imageAlt) +
            '" width="900" height="675" decoding="async"></figure>'
          : "") +
        '<div class="browse-order">' +
        "<h2>Order from this range</h2>" +
        "<p>Call <a href=\"tel:+441223656670\">01223 656670</a> and we will put a piece aside for collection during shop hours, or deliver within 10 miles.</p>" +
        "<p>Tuesday–Friday 9:30am–5pm · Saturday 9am–1pm</p>" +
        "</div>");

  var brandShop = document.querySelector("[data-brand-products]");
  if (brandCatalogue.length && brandShop) {
    bindProductShop(
      brandShop,
      brandCatalogue,
      groupNoun(from),
      "Search " + brand.name
    );
  }
})();
