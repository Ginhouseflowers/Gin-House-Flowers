(function () {
  var STORAGE_KEY = "ginhouseflowers-basket";
  var headerInner = document.querySelector(".header-inner");
  if (!headerInner) return;

  var root = document.createElement("div");
  root.className = "header-basket";
  root.innerHTML =
    '<button type="button" class="header-basket-toggle" aria-expanded="false" aria-controls="header-basket-panel">' +
    '<svg class="header-basket-icon" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M6.5 8h11l-1 12h-9l-1-12z"/>' +
    '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M9 8V6.5a3 3 0 0 1 6 0V8"/>' +
    "</svg>" +
    '<span class="header-basket-count" hidden>0</span>' +
    "</button>" +
    '<div class="header-basket-panel" id="header-basket-panel" hidden>' +
    '<p class="header-basket-empty">Your basket is empty.</p>' +
    '<ul class="header-basket-list"></ul>' +
    '<p class="header-basket-suggest" hidden>Make it extra special with a <a href="cards.html">card</a>, a <a href="gifts.html">gift</a> or some <a href="range.html?brand=cambridge-confectionery&from=chocolate">chocolate</a>.</p>' +
    '<p class="header-basket-total" hidden></p>' +
    '<a class="btn btn-primary" href="basket.html">View basket</a>' +
    "</div>";
  headerInner.appendChild(root);

  var button = root.querySelector(".header-basket-toggle");
  var panel = root.querySelector(".header-basket-panel");
  var countEl = root.querySelector(".header-basket-count");
  var emptyEl = root.querySelector(".header-basket-empty");
  var listEl = root.querySelector(".header-basket-list");
  var suggestEl = root.querySelector(".header-basket-suggest");
  var totalEl = root.querySelector(".header-basket-total");
  var viewLink = root.querySelector(".header-basket-panel .btn");

  function loadItems() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var productThumbs = null;

  function productThumb(productId) {
    if (!productThumbs) {
      productThumbs = {
        "florists-choice-bouquet": {
          src: "images/shop/florists-choice-bouquet.jpg",
          alt: "Florist’s choice hand tied bouquet",
        },
        "florists-choice-hatbox": {
          src: "images/shop/hatbox.jpg",
          alt: "Florist’s choice hat box arrangement",
        },
      };
      [
        window.GinOhhDeerCards,
        window.GinMandGProducts,
        window.GinPaperSalad,
        window.GinCambridgeConfectionery,
        window.GinCustomProducts,
      ].forEach(
        function (list) {
          if (!list) return;
          list.forEach(function (card) {
            if (!card.image) return;
            productThumbs[card.id] = {
              src: card.image,
              alt: card.imageAlt || card.name,
            };
          });
        }
      );
    }
    return productThumbs[productId] || null;
  }

  window.GinProductThumb = productThumb;

  function thumbHtml(productId, className) {
    var thumb = productThumb(productId);
    if (!thumb) {
      return '<span class="' + className + " " + className + '--empty" aria-hidden="true"></span>';
    }
    return (
      '<span class="' +
      className +
      '"><img src="' +
      escapeHtml(thumb.src) +
      '" alt="' +
      escapeHtml(thumb.alt) +
      '" width="96" height="96" loading="lazy" decoding="async"></span>'
    );
  }

  function lineTotal(item) {
    var total = Number(item.value) * Number(item.quantity);
    if (item.waterBubbleBag && item.productId === "florists-choice-bouquet") {
      total += 5 * Number(item.quantity);
    }
    return total;
  }

  function formatMoney(amount) {
    var pence = Math.round(Number(amount) * 100);
    if (!isFinite(pence)) return "£0";
    if (pence % 100 === 0) return "£" + pence / 100;
    return "£" + (pence / 100).toFixed(2);
  }

  function render() {
    var items = loadItems();
    var count = items.reduce(function (sum, item) {
      return sum + (Number(item.quantity) || 0);
    }, 0);
    var goods = items.reduce(function (sum, item) {
      return sum + lineTotal(item);
    }, 0);

    countEl.hidden = count === 0;
    countEl.textContent = String(count);
    button.setAttribute(
      "aria-label",
      count ? "Basket, " + count + (count === 1 ? " item" : " items") : "Basket, empty"
    );
    var hasFlowers = items.some(function (item) {
      return (
        item.productId === "florists-choice-bouquet" ||
        item.productId === "florists-choice-hatbox"
      );
    });

    emptyEl.hidden = count > 0;
    listEl.hidden = count === 0;
    suggestEl.hidden = !hasFlowers;
    totalEl.hidden = count === 0;
    totalEl.textContent = "Total " + formatMoney(goods);
    viewLink.textContent = count ? "View basket" : "Shop online";
    viewLink.href = count ? "basket.html" : "shop-online.html";
    listEl.innerHTML = items
      .map(function (item) {
        return (
          '<li class="header-basket-line">' +
          thumbHtml(item.productId, "header-basket-thumb") +
          '<div class="header-basket-copy">' +
          '<p class="header-basket-name">' +
          escapeHtml(item.name || "Flowers") +
          "</p>" +
          '<p class="header-basket-meta">' +
          formatMoney(item.value) +
          " · Qty " +
          escapeHtml(item.quantity) +
          "</p>" +
          "</div>" +
          '<div class="header-basket-line-end">' +
          '<p class="header-basket-price">' +
          formatMoney(lineTotal(item)) +
          "</p>" +
          '<button type="button" class="header-basket-remove" data-remove-line="' +
          escapeHtml(item.lineId) +
          '">Remove</button>' +
          "</div>" +
          "</li>"
        );
      })
      .join("");
  }

  var mobileBasket = window.matchMedia("(max-width: 940px)");

  function placeOverlay() {
    var header = document.querySelector(".site-header");
    var bottom = header ? header.getBoundingClientRect().bottom : 0;
    panel.style.top = Math.round(bottom + 6) + "px";
  }

  function floatPanel(open) {
    if (open && mobileBasket.matches) {
      document.body.appendChild(panel);
      panel.classList.add("is-overlay");
      placeOverlay();
      return;
    }
    panel.classList.remove("is-overlay");
    panel.style.top = "";
    if (panel.parentElement !== root) root.appendChild(panel);
  }

  function setOpen(open) {
    panel.hidden = !open;
    button.setAttribute("aria-expanded", open ? "true" : "false");
    floatPanel(open);
    if (open) {
      var nav = document.getElementById("site-nav");
      var toggle = document.querySelector("[data-nav-toggle]");
      var searchPanel = document.getElementById("header-search-panel");
      var searchBtn = document.querySelector(".header-search-toggle");
      var header = document.querySelector(".site-header");
      if (nav) nav.classList.remove("is-open");
      if (header) header.classList.remove("nav-open");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
      if (searchPanel) searchPanel.hidden = true;
      if (searchBtn) searchBtn.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }
  }

  var closeTimer = null;

  function cancelClose() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  root.addEventListener("pointerenter", function (event) {
    if (event.pointerType === "touch") return;
    cancelClose();
    setOpen(true);
  });

  root.addEventListener("pointerleave", function (event) {
    if (event.pointerType === "touch") return;
    cancelClose();
    closeTimer = setTimeout(function () {
      setOpen(false);
    }, 160);
  });

  button.addEventListener("focus", function () {
    cancelClose();
    setOpen(true);
  });

  button.addEventListener("click", function () {
    cancelClose();
    setOpen(panel.hidden);
  });

  listEl.addEventListener("click", function (event) {
    var remove = event.target.closest("[data-remove-line]");
    if (!remove) return;
    event.stopPropagation();
    var lineId = remove.getAttribute("data-remove-line");
    var items = loadItems().filter(function (item) {
      return item.lineId !== lineId;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("ginhouse:basket", { detail: { reason: "remove" } }));
  });

  document.addEventListener("click", function (event) {
    if (!root.contains(event.target) && !panel.contains(event.target)) setOpen(false);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setOpen(false);
  });

  window.addEventListener("scroll", function () {
    if (!panel.hidden && panel.classList.contains("is-overlay")) placeOverlay();
  }, { passive: true });

  window.addEventListener("resize", function () {
    if (!panel.hidden) floatPanel(true);
  });

  window.addEventListener("ginhouse:basket", function (event) {
    render();
    if (event.detail && event.detail.reason === "add") setOpen(true);
  });

  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEY) render();
  });

  render();
})();

(function () {
  var shopLink = document.querySelector(".nav-shop");
  if (!shopLink || !shopLink.parentElement) return;

  var item = shopLink.parentElement;
  item.classList.add("nav-shop-item");
  shopLink.setAttribute("aria-haspopup", "true");
  shopLink.insertAdjacentHTML(
    "beforeend",
    '<svg class="nav-shop-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  );

  var menu = document.createElement("div");
  menu.className = "nav-shop-menu";
  menu.innerHTML =
    '<div class="nav-shop-menu-inner">' +
    '<a href="online-shop.html" data-shop-choice="flowers">Flowers</a>' +
    '<a href="cards.html" data-shop-choice="cards">Cards</a>' +
    '<a href="gifts.html" data-shop-choice="gifts">Gifts</a>' +
    '<a href="range.html?brand=cambridge-confectionery&from=chocolate" data-shop-choice="chocolate">Chocolate</a>' +
    "</div>";
  item.appendChild(menu);

  var path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  var current = "";
  if (path === "shop-online.html") shopLink.setAttribute("aria-current", "page");
  if (path === "online-shop.html") current = "flowers";
  if (path === "cards.html") current = "cards";
  if (path === "gifts.html") current = "gifts";
  if (path === "chocolate.html") current = "chocolate";
  if (path === "view-all.html") {
    var viewGroup = new URLSearchParams(location.search).get("group");
    current = viewGroup === "gifts" || viewGroup === "chocolate" ? viewGroup : "cards";
  }
  if (path === "range.html") {
    var params = new URLSearchParams(location.search);
    var from = params.get("from");
    if (from === "cards" || from === "gifts" || from === "chocolate") current = from;
  }
  if (current) {
    var active = menu.querySelector('[data-shop-choice="' + current + '"]');
    if (active) active.setAttribute("aria-current", "page");
  }

  function setExpanded(open) {
    item.classList.toggle("is-open", open);
    shopLink.setAttribute("aria-expanded", open ? "true" : "false");
  }

  item.addEventListener("pointerenter", function (event) {
    if (event.pointerType === "touch") return;
    if (!item.classList.contains("is-open")) shopLink.setAttribute("aria-expanded", "true");
  });
  item.addEventListener("pointerleave", function (event) {
    if (event.pointerType === "touch") return;
    if (!item.classList.contains("is-open")) shopLink.setAttribute("aria-expanded", "false");
  });
  item.addEventListener("focusin", function () {
    if (!item.classList.contains("is-open")) shopLink.setAttribute("aria-expanded", "true");
  });
  item.addEventListener("focusout", function (event) {
    if (item.contains(event.relatedTarget)) return;
    if (!item.classList.contains("is-open")) shopLink.setAttribute("aria-expanded", "false");
  });

  document.addEventListener("click", function (event) {
    if (!item.contains(event.target)) setExpanded(false);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setExpanded(false);
  });

  setExpanded(false);
})();

(function () {
  var headerInner = document.querySelector(".header-inner");
  if (!headerInner) return;

  var root = document.createElement("div");
  root.className = "header-search";
  root.innerHTML =
    '<button type="button" class="header-search-toggle" aria-expanded="false" aria-controls="header-search-panel" aria-label="Search products">' +
    '<svg class="header-search-icon" viewBox="0 0 24 24" aria-hidden="true">' +
    '<circle cx="11" cy="11" r="6.25" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<path d="M16 16.5 20 20.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
    "</svg>" +
    "</button>" +
    '<div class="header-search-panel" id="header-search-panel" hidden>' +
    '<form class="header-search-form" role="search">' +
    '<label class="visually-hidden" for="site-search">Search products</label>' +
    '<input id="site-search" type="search" placeholder="Search products" autocomplete="off" />' +
    "</form>" +
    '<p class="header-search-hint">Search flowers, cards, gifts and chocolate.</p>' +
    '<ul class="header-search-results" hidden></ul>' +
    '<p class="header-search-empty" hidden>No products match that search.</p>' +
    "</div>";

  var basket = headerInner.querySelector(".header-basket");
  if (basket) headerInner.insertBefore(root, basket);
  else headerInner.appendChild(root);

  var button = root.querySelector(".header-search-toggle");
  var panel = root.querySelector(".header-search-panel");
  var form = root.querySelector(".header-search-form");
  var input = root.querySelector("#site-search");
  var hint = root.querySelector(".header-search-hint");
  var list = root.querySelector(".header-search-results");
  var empty = root.querySelector(".header-search-empty");

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function catalog() {
    var items = [
      {
        name: "Florist's choice bouquet",
        meta: "Flowers",
        href: "online-shop.html#florists-choice-bouquet",
        text: "florist's choice bouquet flowers hand tied",
      },
      {
        name: "Florist's choice hat box",
        meta: "Flowers",
        href: "online-shop.html#florists-choice-hatbox",
        text: "florist's choice hat box flowers",
      },
      {
        name: "Shop online",
        meta: "Flowers, cards, gifts and chocolate",
        href: "shop-online.html",
        text: "shop online store flowers cards gifts chocolate",
      },
      {
        name: "Flowers",
        meta: "Shop online",
        href: "online-shop.html",
        text: "flowers bouquet hat box shop online",
      },
      {
        name: "Cards",
        meta: "Shop online",
        href: "cards.html",
        text: "cards greeting",
      },
      {
        name: "Gifts",
        meta: "Shop online",
        href: "gifts.html",
        text: "gifts presents",
      },
      {
        name: "Chocolate",
        meta: "Shop online",
        href: "range.html?brand=cambridge-confectionery&from=chocolate",
        text: "chocolate confectionery cambridge",
      },
    ];
    function pushCatalogue(list) {
      (list || []).forEach(function (card) {
        if (window.GinStock && window.GinStock.deleted(card.id)) return;
        var group = card.group === "gifts" || card.group === "chocolate" ? card.group : "cards";
        var label = group === "gifts" ? "Gifts" : group === "chocolate" ? "Chocolate" : "Cards";
        var pricing = window.GinStock && window.GinStock.pricing(card.id);
        var pence = pricing
          ? pricing.pence
          : card.pricePence || Math.round(Number(card.price) * 100);
        var price =
          pence % 100 === 0 ? "£" + pence / 100 : "£" + (pence / 100).toFixed(2);
        items.push({
          name: card.name,
          meta: price + " · " + label,
          href: "view-all.html?group=" + group + "#" + encodeURIComponent(card.id),
          text: [card.name, card.blurb, card.occasion, card.product, card.brand, card.sku, label]
            .join(" ")
            .toLowerCase(),
        });
      });
    }
    pushCatalogue(window.GinOhhDeerCards);
    pushCatalogue(window.GinMandGProducts);
    pushCatalogue(window.GinPaperSalad);
    pushCatalogue(window.GinCambridgeConfectionery);
    pushCatalogue(window.GinCustomProducts);
    var ranges = window.GinRanges;
    if (!ranges) return items;
    ranges.brands.forEach(function (brand) {
      var group = brand.groups[0] || "gifts";
      var groupTitle = brand.groups
        .map(function (id) {
          return ranges[id] ? ranges[id].title : id;
        })
        .join(" and ");
      var extraCopy = brand.byGroup
        ? Object.keys(brand.byGroup)
            .map(function (id) {
              var copy = brand.byGroup[id];
              return [copy.note, copy.blurb].join(" ");
            })
            .join(" ")
        : "";
      items.push({
        name: brand.name,
        meta: groupTitle,
        href:
          "range.html?brand=" +
          encodeURIComponent(brand.id) +
          "&from=" +
          encodeURIComponent(group),
        text: [brand.name, brand.note, brand.blurb, extraCopy, groupTitle].join(" ").toLowerCase(),
      });
    });
    return items;
  }

  function matches(item, words) {
    var haystack = (item.name + " " + item.text).toLowerCase();
    return words.every(function (word) {
      return haystack.indexOf(word) !== -1;
    });
  }

  function rank(item, query) {
    var name = item.name.toLowerCase();
    if (name === query) return 0;
    if (name.indexOf(query) === 0) return 1;
    if (name.indexOf(query) !== -1) return 2;
    return 3;
  }

  function renderResults() {
    var query = input.value.trim().toLowerCase();
    var words = query.split(/\s+/).filter(Boolean);
    hint.hidden = query.length > 0;
    if (query.length < 2) {
      list.hidden = true;
      list.innerHTML = "";
      if (query.length === 0) {
        empty.hidden = true;
        hint.hidden = false;
      } else {
        empty.hidden = false;
        empty.textContent = "Type a little more to search.";
      }
      return;
    }
    var found = catalog()
      .filter(function (item) {
        return matches(item, words);
      })
      .sort(function (a, b) {
        return rank(a, query) - rank(b, query) || a.name.localeCompare(b.name);
      })
      .slice(0, 8);
    empty.textContent = "No products match that search.";
    empty.hidden = found.length !== 0;
    list.hidden = found.length === 0;
    list.innerHTML = found
      .map(function (item) {
        return (
          "<li><a href=\"" +
          escapeHtml(item.href) +
          '"><span class="header-search-name">' +
          escapeHtml(item.name) +
          '</span><span class="header-search-meta">' +
          escapeHtml(item.meta) +
          "</span></a></li>"
        );
      })
      .join("");
  }

  function setOpen(open) {
    panel.hidden = !open;
    button.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) return;
    var basketPanel = document.getElementById("header-basket-panel");
    var basketBtn = document.querySelector(".header-basket-toggle");
    var nav = document.getElementById("site-nav");
    var toggle = document.querySelector("[data-nav-toggle]");
    if (basketPanel) basketPanel.hidden = true;
    if (basketBtn) basketBtn.setAttribute("aria-expanded", "false");
    if (nav) nav.classList.remove("is-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    window.setTimeout(function () {
      input.focus();
    }, 0);
  }

  button.addEventListener("click", function () {
    setOpen(panel.hidden);
  });

  input.addEventListener("input", renderResults);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    renderResults();
    var first = list.querySelector("a");
    if (first && !list.hidden) window.location.href = first.href;
  });

  document.addEventListener("click", function (event) {
    if (!root.contains(event.target)) setOpen(false);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setOpen(false);
  });
})();

(function () {
  var toggle = document.querySelector("[data-nav-toggle]");
  var nav = document.getElementById("site-nav");
  var header = document.querySelector(".site-header");
  var yearEl = document.querySelector("[data-year]");

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  if (!toggle || !nav) return;

  function setOpen(open) {
    nav.classList.toggle("is-open", open);
    if (header) header.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.style.overflow = open ? "hidden" : "";
  }

  toggle.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(!nav.classList.contains("is-open"));
  });

  nav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      if (link.classList.contains("nav-shop")) return;
      setOpen(false);
    });
  });

  var desktopNav = window.matchMedia("(min-width: 941px)");
  function closeOnDesktop(event) {
    if (event.matches) setOpen(false);
  }
  if (desktopNav.addEventListener) desktopNav.addEventListener("change", closeOnDesktop);
  else if (desktopNav.addListener) desktopNav.addListener(closeOnDesktop);
})();

(function () {
  document.querySelectorAll("[data-shop-gallery]").forEach(function (gallery) {
    var photo = gallery.querySelector(".shop-gallery-photo");
    var count = gallery.querySelector(".shop-gallery-count");
    var tabs = Array.prototype.slice.call(gallery.querySelectorAll("[role='tab']"));
    var index = 0;

    if (!photo || !tabs.length) return;

    function show(next) {
      index = (next + tabs.length) % tabs.length;
      var thumb = tabs[index].querySelector("img");
      photo.src = thumb.currentSrc || thumb.src;
      photo.alt = thumb.alt;
      tabs.forEach(function (tab, i) {
        tab.setAttribute("aria-selected", i === index ? "true" : "false");
      });
      if (count) count.textContent = index + 1 + " / " + tabs.length;
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () {
        show(i);
      });
    });

    gallery.querySelector(".shop-gallery-prev").addEventListener("click", function () {
      show(index - 1);
    });
    gallery.querySelector(".shop-gallery-next").addEventListener("click", function () {
      show(index + 1);
    });
  });

  var picker = document.querySelector("[data-shop-picker]");
  if (picker) {
    var choices = Array.prototype.slice.call(picker.querySelectorAll("[aria-controls]"));
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var selectProduct = function (id, scroll) {
      var panel = null;
      choices.forEach(function (choice) {
        var target = document.getElementById(choice.getAttribute("aria-controls"));
        var on = target && target.id === id;
        choice.setAttribute("aria-expanded", on ? "true" : "false");
        choice.querySelector(".shop-choice-cta").textContent = on ? "Selected" : "Choose";
        if (target) target.hidden = !on;
        if (on) panel = target;
      });
      if (panel && scroll) {
        panel.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      }
      return panel;
    };

    choices.forEach(function (choice) {
      choice.addEventListener("click", function () {
        var id = choice.getAttribute("aria-controls");
        selectProduct(id, true);
        history.replaceState(null, "", "#" + id);
      });
    });

    var fromHash = function () {
      var id = decodeURIComponent(location.hash.slice(1));
      if (!id) return;
      var known = choices.some(function (choice) {
        return choice.getAttribute("aria-controls") === id;
      });
      if (known) {
        requestAnimationFrame(function () {
          selectProduct(id, true);
        });
      }
    };

    window.addEventListener("hashchange", fromHash);
    fromHash();
  }

  var icon = function (path) {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="' +
      path +
      '" /></svg>'
    );
  };

  document.querySelectorAll("[data-lightbox]").forEach(function (gallery) {
    var buttons = Array.prototype.slice.call(gallery.querySelectorAll("button"));
    if (!buttons.length || typeof HTMLDialogElement !== "function") return;

    var index = 0;
    var dialog = document.createElement("dialog");
    dialog.className = "sv-lightbox";
    dialog.setAttribute("aria-label", gallery.getAttribute("aria-label") || "Photo viewer");
    dialog.innerHTML =
      '<div class="sv-lightbox-stage"><img alt="" /></div>' +
      '<button type="button" class="sv-lightbox-btn sv-lightbox-close" aria-label="Close">' +
      icon("M6 6l12 12M18 6L6 18") +
      "</button>" +
      '<button type="button" class="sv-lightbox-btn sv-lightbox-prev" aria-label="Previous photo">' +
      icon("M15 5l-7 7 7 7") +
      "</button>" +
      '<button type="button" class="sv-lightbox-btn sv-lightbox-next" aria-label="Next photo">' +
      icon("M9 5l7 7-7 7") +
      "</button>" +
      '<p class="sv-lightbox-count" aria-live="polite"></p>';
    document.body.appendChild(dialog);

    var photo = dialog.querySelector("img");
    var count = dialog.querySelector(".sv-lightbox-count");

    function show(next) {
      index = (next + buttons.length) % buttons.length;
      var thumb = buttons[index].querySelector("img");
      photo.src = buttons[index].getAttribute("data-full") || thumb.currentSrc || thumb.src;
      photo.alt = thumb.alt;
      count.textContent = index + 1 + " / " + buttons.length;
    }

    buttons.forEach(function (button, i) {
      var thumb = button.querySelector("img");
      if (!button.hasAttribute("aria-label") && thumb && thumb.alt) {
        button.setAttribute("aria-label", "Enlarge photo: " + thumb.alt);
      }
      button.addEventListener("click", function () {
        show(i);
        dialog.showModal();
      });
    });

    dialog.querySelector(".sv-lightbox-close").addEventListener("click", function () {
      dialog.close();
    });
    dialog.querySelector(".sv-lightbox-prev").addEventListener("click", function () {
      show(index - 1);
    });
    dialog.querySelector(".sv-lightbox-next").addEventListener("click", function () {
      show(index + 1);
    });
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog || event.target.classList.contains("sv-lightbox-stage")) {
        dialog.close();
      }
    });
    dialog.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") show(index - 1);
      if (event.key === "ArrowRight") show(index + 1);
    });
    dialog.addEventListener("close", function () {
      buttons[index].focus();
    });
  });
})();

(function () {
  var notice = window.GinNotice;
  var header = document.querySelector(".site-header");
  if (!notice || !notice.message || !header) return;

  var today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  if (notice.until && notice.until < today) return;

  var hiddenKey = "ginhouseflowers-notice-hidden";
  try {
    if (sessionStorage.getItem(hiddenKey) === notice.message) return;
  } catch (e) {}

  var bar = document.createElement("div");
  bar.className = "site-notice";
  bar.setAttribute("role", "region");
  bar.setAttribute("aria-label", "Shop notice");

  var text = document.createElement(notice.link ? "a" : "p");
  text.className = "site-notice-text";
  text.textContent = notice.message;
  if (notice.link) text.href = notice.link;

  var close = document.createElement("button");
  close.type = "button";
  close.className = "site-notice-close";
  close.setAttribute("aria-label", "Hide this notice");
  close.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  close.addEventListener("click", function () {
    bar.remove();
    try {
      sessionStorage.setItem(hiddenKey, notice.message);
    } catch (e) {}
  });

  bar.appendChild(text);
  bar.appendChild(close);
  header.parentNode.insertBefore(bar, header);
})();

(function () {
  var id = window.GinAnalyticsId;
  var settingsButtons = document.querySelectorAll("[data-cookie-settings]");
  if (!id) {
    settingsButtons.forEach(function (button) {
      button.hidden = true;
    });
    return;
  }

  var CHOICE_KEY = "ginhouseflowers-consent";
  var loaded = false;
  var banner = null;

  function readChoice() {
    try {
      return localStorage.getItem(CHOICE_KEY);
    } catch (e) {
      return null;
    }
  }

  function saveChoice(choice) {
    try {
      localStorage.setItem(CHOICE_KEY, choice);
    } catch (e) {}
  }

  function loadAnalytics() {
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", id);
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.appendChild(script);
  }

  function clearAnalyticsCookies() {
    document.cookie.split(";").forEach(function (part) {
      var name = part.split("=")[0].trim();
      if (name === "_ga" || name.indexOf("_ga_") === 0) {
        var domain = location.hostname.replace(/^www\./, "");
        ["", "; domain=" + location.hostname, "; domain=." + domain].forEach(function (scope) {
          document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + scope;
        });
      }
    });
  }

  function choose(choice) {
    var wasGranted = readChoice() === "granted";
    saveChoice(choice);
    hideBanner();
    if (choice === "granted") {
      loadAnalytics();
    } else if (wasGranted) {
      clearAnalyticsCookies();
      location.reload();
    }
  }

  function hideBanner() {
    if (banner) banner.hidden = true;
  }

  function showBanner() {
    if (!banner) {
      banner = document.createElement("div");
      banner.className = "cookie-banner";
      banner.setAttribute("role", "region");
      banner.setAttribute("aria-label", "Cookie choice");
      banner.innerHTML =
        '<p class="cookie-banner-text">We would like to use Google Analytics cookies to see how visitors use our website, so we can improve it. ' +
        'They are only set if you accept. <a href="privacy.html">Privacy notice</a></p>' +
        '<div class="cookie-banner-actions">' +
        '<button type="button" class="btn btn-primary" data-cookie-choice="granted">Accept</button>' +
        '<button type="button" class="btn btn-ghost" data-cookie-choice="denied">Reject</button>' +
        "</div>";
      banner.addEventListener("click", function (event) {
        var button = event.target.closest("[data-cookie-choice]");
        if (button) choose(button.getAttribute("data-cookie-choice"));
      });
      document.body.appendChild(banner);
    }
    banner.hidden = false;
  }

  settingsButtons.forEach(function (button) {
    button.addEventListener("click", showBanner);
  });

  var choice = readChoice();
  if (choice === "granted") loadAnalytics();
  else if (choice !== "denied") showBanner();
})();

(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var header = document.querySelector(".site-header");
  var progress = null;

  if (header) {
    progress = document.createElement("div");
    progress.className = "scroll-progress";
    progress.setAttribute("aria-hidden", "true");
    header.appendChild(progress);
  }

  var heroImage = reduceMotion ? null : document.querySelector(".sv-hero-media img");
  var hero = heroImage ? heroImage.closest(".sv-hero") : null;
  var ticking = false;

  function update() {
    ticking = false;
    var y = window.scrollY;
    if (header) {
      header.classList.toggle("is-scrolled", y > 8);
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.setProperty("--progress", max > 0 ? Math.min(1, y / max).toFixed(4) : "0");
    }
    if (hero && y < hero.offsetTop + hero.offsetHeight) {
      heroImage.style.translate = "0 " + (y * 0.3).toFixed(1) + "px";
    }
  }

  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  update();

  if (reduceMotion || !("IntersectionObserver" in window)) return;

  var revealSelector = [
    ".sv-head",
    ".sv-intro",
    ".sv-row",
    ".sv-step",
    ".sv-steps-note",
    ".sv-menu-item",
    ".sv-gallery-head",
    ".sv-gallery > li",
    ".sv-class",
    ".sv-faq > header",
    ".sv-faq-list details",
    ".sv-quote-feature",
    ".sv-quote-card",
    ".sv-enquire-intro",
    ".sv-form",
    ".section-header",
    ".seller-card",
    ".home-gallery-item",
    ".home-reviews-inner",
    ".split-text",
    ".split-media",
    ".contact-copy",
    ".contact-form-column",
    ".browse-grid > li",
  ].join(",");
  var staggerParents =
    ".sv-steps, .sv-gallery, .sv-classes, .sv-menu, .sv-quote-pair, .sv-faq-list, .seller-grid, .home-gallery-grid, .browse-grid";
  var skipInside = ".sv-hero, .site-header, .site-footer, dialog, .stock-panel";
  var seen = typeof WeakSet === "function" ? new WeakSet() : null;
  if (!seen) return;

  document.documentElement.classList.add("js-motion");

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        observer.unobserve(el);
        el.classList.add("is-visible");
        var delay = parseFloat(el.style.getPropertyValue("--reveal-delay")) || 0;
        window.setTimeout(function () {
          el.classList.remove("reveal", "is-visible");
          el.style.removeProperty("--reveal-delay");
        }, delay * 1000 + 2000);
      });
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.08 }
  );

  function scan() {
    var viewport = window.innerHeight;
    document.querySelectorAll(revealSelector).forEach(function (el) {
      if (seen.has(el)) return;
      seen.add(el);
      if (el.closest(skipInside)) return;
      var rect = el.getBoundingClientRect();
      if (rect.top < viewport) return;
      el.classList.add("reveal");
      var parent = el.parentElement;
      if (parent && parent.matches(staggerParents)) {
        var index = Array.prototype.indexOf.call(parent.children, el);
        el.style.setProperty("--reveal-delay", (index % 4) * 0.08 + "s");
      }
      observer.observe(el);
    });
  }

  scan();

  var pending = false;
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(function () {
      pending = false;
      scan();
    });
  }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
})();

(function () {
  var form = document.getElementById("mailing-form");
  if (!form) return;
  var message = form.querySelector("[data-mailing-message]");
  var button = form.querySelector("button[type='submit']");

  function showMessage(text, code) {
    if (!message) return;
    message.hidden = false;
    message.textContent = "";
    if (!code) {
      message.textContent = text;
      return;
    }
    var before = text.split(code);
    message.appendChild(document.createTextNode(before[0] || ""));
    var strong = document.createElement("strong");
    strong.textContent = code;
    message.appendChild(strong);
    message.appendChild(document.createTextNode(before[1] || ""));
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var emailInput = form.querySelector("input[type='email']");
    var trap = form.querySelector("input[name='company']");
    var email = emailInput ? emailInput.value.trim() : "";
    if (message) message.hidden = true;
    if (button) button.disabled = true;

    fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, company: trap ? trap.value : "" }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data || {} };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          showMessage(result.data.error || "We couldn't add you to the list. Please try again.");
          return;
        }
        showMessage(result.data.message || "You're signed up.", result.data.code || "");
        if (emailInput) emailInput.value = "";
      })
      .catch(function () {
        showMessage("We couldn't add you to the list. Please try again.");
      })
      .then(function () {
        if (button) button.disabled = false;
      });
  });
})();
