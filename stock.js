(function () {
  var stock = {
    products: {},
    ready: false,
    record: function (id) {
      return this.products[id] || null;
    },
    available: function (id) {
      var record = this.products[id];
      if (!record) return null;
      if (record.outOfStock || record.available === 0) return 0;
      if (record.available == null) return null;
      return record.available;
    },
    blocked: function (id) {
      return this.available(id) === 0;
    },
    deleted: function (id) {
      var record = this.products[id];
      return Boolean(record && record.deleted);
    },
    pricing: function (id) {
      var base = basePence(id);
      if (base == null) return null;
      var record = this.products[id];
      var regular = (record && record.pricePence) || base;
      if (record && record.onSale && record.salePricePence) {
        return { pence: record.salePricePence, regularPence: regular, onSale: true };
      }
      return { pence: regular, regularPence: regular, onSale: false };
    },
    allows: function (id, qty) {
      if (this.deleted(id)) return false;
      var left = this.available(id);
      if (left === 0) return false;
      if (left == null) return true;
      return Number(qty) <= left;
    },
  };
  window.GinStock = stock;

  var basePrices = null;

  function basePence(id) {
    if (!basePrices) {
      basePrices = {};
      catalogue().forEach(function (item) {
        if (item.pricePence || item.price) {
          basePrices[item.id] = item.pricePence || Math.round(Number(item.price) * 100);
        }
      });
    }
    return basePrices[id] == null ? null : basePrices[id];
  }

  function formatPence(pence) {
    if (pence % 100 === 0) return "£" + pence / 100;
    return "£" + (pence / 100).toFixed(2);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function applyShopStock() {
    document.querySelectorAll("[data-add-card]").forEach(function (button) {
      var id = button.getAttribute("data-add-card");
      if (stock.blocked(id)) {
        button.disabled = true;
        button.textContent = "Out of stock";
      } else if (button.disabled && button.textContent === "Out of stock") {
        button.disabled = false;
        button.textContent = "Add to basket";
      }
    });

    document.querySelectorAll("form[data-product-id]").forEach(function (form) {
      var id = form.getAttribute("data-product-id");
      var submit = form.querySelector("[type='submit']");
      var note = form.querySelector("[data-stock-note]");
      var card = form.closest(".shop-product");
      var frame = card && card.querySelector(".shop-gallery-frame");
      var ribbon = frame && frame.querySelector(".browse-card-ribbon");
      var out = stock.blocked(id) || stock.deleted(id);
      if (card) card.classList.toggle("is-out-of-stock", out);
      if (frame && out && !ribbon) {
        frame.insertAdjacentHTML(
          "afterbegin",
          '<span class="browse-card-ribbon browse-card-ribbon--out">Out of stock</span>'
        );
      } else if (ribbon && !out) {
        ribbon.remove();
      }
      if (out) {
        var removed = stock.deleted(id);
        if (submit) {
          submit.disabled = true;
          submit.textContent = "Out of stock";
        }
        if (!note && submit) {
          note = document.createElement("p");
          note.className = "stock-note";
          note.setAttribute("data-stock-note", "");
          submit.before(note);
        }
        if (note) {
          note.textContent = removed ? "Not available online." : "Out of stock online.";
        }
      } else if (submit && submit.textContent === "Out of stock") {
        submit.disabled = false;
        submit.textContent = "Add to basket";
        if (note) note.remove();
      }
    });
  }

  function repriceBasket() {
    var key = "ginhouseflowers-basket";
    var items;
    try {
      items = JSON.parse(localStorage.getItem(key) || "[]");
    } catch (err) {
      return;
    }
    if (!Array.isArray(items)) return;
    var changed = false;
    items.forEach(function (item) {
      var pricing = stock.pricing(item.productId);
      if (!pricing) return;
      var value = pricing.pence / 100;
      if (Math.round(Number(item.value) * 100) !== pricing.pence) {
        item.value = value;
        changed = true;
      }
    });
    if (!changed) return;
    localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("ginhouse:basket", { detail: { reason: "reprice" } }));
  }

  function publish(products) {
    stock.products = products || {};
    stock.ready = true;
    applyShopStock();
    repriceBasket();
    window.dispatchEvent(new CustomEvent("ginhouse:stock"));
  }

  function loadStock() {
    return fetch("/api/stock", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("Stock unavailable");
        return response.json();
      })
      .then(function (data) {
        stock.notice = data.notice || null;
        shopOpen = data.shopOpen !== false;
        renderShopSwitch();
        publish(data.products || {});
      })
      .catch(function () {
        stock.ready = true;
      });
  }

  function catalogue() {
    return [
      {
        id: "florists-choice-bouquet",
        name: "Florist’s choice hand tied bouquet",
        group: "flowers",
        brand: "Flowers",
      },
      {
        id: "florists-choice-hatbox",
        name: "Florist’s choice hat box arrangement",
        group: "flowers",
        brand: "Flowers",
      },
    ]
      .concat(window.GinOhhDeerCards || [])
      .concat(window.GinMandGProducts || [])
      .concat(window.GinPaperSalad || [])
      .concat(window.GinCambridgeConfectionery || [])
      .concat(window.GinCustomProducts || []);
  }

  function isCustom(id) {
    return (window.GinCustomProducts || []).some(function (item) {
      return item.id === id;
    });
  }

  function uniqueValues(key) {
    var seen = {};
    catalogue().forEach(function (item) {
      var values = key === "styles" ? item.styles || [] : [item[key]];
      values.forEach(function (value) {
        if (value) seen[value] = true;
      });
    });
    return Object.keys(seen).sort(function (a, b) {
      return a.localeCompare(b);
    });
  }

  function optionsHtml(values) {
    return values
      .map(function (value) {
        return '<option value="' + escapeHtml(value) + '"></option>';
      })
      .join("");
  }

  var panel = document.createElement("div");
  panel.className = "stock-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "stock-panel-title");
  panel.innerHTML =
    '<div class="stock-sheet">' +
    '<div class="stock-sheet-head">' +
    '<h2 id="stock-panel-title">Online stock</h2>' +
    '<button type="button" class="stock-close">Close</button>' +
    "</div>" +
    '<form class="stock-login">' +
    '<label class="stock-qty">Password' +
    '<input type="password" data-stock-password autocomplete="current-password" required>' +
    "</label>" +
    '<label class="stock-tick">' +
    '<input type="checkbox" data-stock-save-password> Save password on this browser' +
    "</label>" +
    '<button type="submit" class="stock-unlock">Unlock</button>' +
    '<p class="stock-login-error" role="alert" hidden></p>' +
    "</form>" +
    '<div class="stock-editor" hidden>' +
    '<div class="stock-shop-switch" data-shop-switch-wrap>' +
    '<p class="stock-shop-switch-state" data-shop-switch-state>Online shop is on. Customers can order.</p>' +
    '<button type="button" class="stock-unlock" data-shop-switch>Take the shop offline</button>' +
    "</div>" +
    '<div class="stock-browse">' +
    '<p class="stock-intro">Changes save automatically and go live in the shop straight away. Set how many are available online (blank for no limit), tick out of stock to stop sales, change the price or put an item on sale. Deleted products are hidden from the shop and can be restored from Deleted.</p>' +
    '<div class="stock-toolbar">' +
    '<label class="stock-tick stock-save-live">' +
    '<input type="checkbox" data-stock-save-live> Save password on this browser' +
    "</label>" +
    '<span class="stock-toolbar-actions">' +
    '<button type="button" class="stock-close" data-stock-notice-open>Shop banner</button>' +
    '<button type="button" class="stock-unlock" data-stock-add-open>Add product</button>' +
    "</span>" +
    "</div>" +
    '<input class="stock-search" type="search" placeholder="Search products" aria-label="Search products">' +
    '<div class="stock-filters" role="group" aria-label="Product group">' +
    '<button type="button" class="stock-filter is-active" data-stock-group="all">All</button>' +
    '<button type="button" class="stock-filter" data-stock-group="flowers">Flowers</button>' +
    '<button type="button" class="stock-filter" data-stock-group="cards">Cards</button>' +
    '<button type="button" class="stock-filter" data-stock-group="gifts">Gifts</button>' +
    '<button type="button" class="stock-filter" data-stock-group="chocolate">Chocolate</button>' +
    '<button type="button" class="stock-filter" data-stock-group="deleted">Deleted</button>' +
    "</div>" +
    '<p class="stock-status" aria-live="polite"></p>' +
    '<ul class="stock-list"></ul>' +
    "</div>" +
    '<form class="stock-add" hidden novalidate>' +
    '<h3 class="stock-add-title">Add a product</h3>' +
    '<p class="stock-intro">The product goes live in the shop as soon as you add it.</p>' +
    '<div class="stock-add-grid">' +
    '<label class="stock-qty stock-add-wide">Title' +
    '<input type="text" name="name" maxlength="120" required>' +
    "</label>" +
    '<label class="stock-qty">Brand' +
    '<input type="text" name="brand" maxlength="80" list="stock-brands" required>' +
    "</label>" +
    '<label class="stock-qty">Section' +
    '<select name="group" required>' +
    '<option value="cards">Cards</option>' +
    '<option value="gifts">Gifts</option>' +
    '<option value="chocolate">Chocolate</option>' +
    "</select>" +
    "</label>" +
    '<label class="stock-qty">Product type' +
    '<input type="text" name="productType" maxlength="60" list="stock-types" placeholder="Greeting card" required>' +
    "</label>" +
    '<label class="stock-qty">Occasion' +
    '<input type="text" name="occasion" maxlength="60" list="stock-occasions" placeholder="Everyday">' +
    "</label>" +
    '<label class="stock-qty stock-add-wide">Styles' +
    '<input type="text" name="styles" maxlength="200" placeholder="Funny, Floral">' +
    '<span class="stock-hint">Separate styles with commas. Used for the shop filters.</span>' +
    "</label>" +
    '<label class="stock-qty stock-add-wide">Description' +
    '<textarea name="blurb" rows="3" maxlength="600"></textarea>' +
    "</label>" +
    '<label class="stock-qty">Price £' +
    '<input type="text" name="price" inputmode="decimal" placeholder="3.50" required>' +
    "</label>" +
    '<label class="stock-qty">Available online' +
    '<input type="text" name="available" inputmode="numeric" placeholder="No limit">' +
    "</label>" +
    '<label class="stock-qty stock-add-wide">Photo' +
    '<input type="file" name="photo" accept="image/jpeg,image/png,image/webp">' +
    "</label>" +
    '<img class="stock-add-preview" alt="" hidden>' +
    "</div>" +
    '<p class="stock-login-error stock-add-error" role="alert" hidden></p>' +
    '<div class="stock-add-actions">' +
    '<button type="submit" class="stock-unlock">Add product</button>' +
    '<button type="button" class="stock-close" data-stock-add-cancel>Cancel</button>' +
    "</div>" +
    '<datalist id="stock-brands"></datalist>' +
    '<datalist id="stock-types"></datalist>' +
    '<datalist id="stock-occasions"></datalist>' +
    "</form>" +
    '<form class="stock-add stock-notice" hidden novalidate>' +
    '<h3 class="stock-add-title">Shop banner</h3>' +
    '<p class="stock-intro">A strip across the top of every page, ideal for order-by dates before Valentine’s Day, Mother’s Day or Christmas. It disappears by itself after the end date.</p>' +
    '<div class="stock-add-grid">' +
    '<label class="stock-qty stock-add-wide">Message' +
    '<input type="text" name="message" maxlength="160" placeholder="Order by Thursday 12 March for Mother’s Day delivery">' +
    "</label>" +
    '<label class="stock-qty">Link to' +
    '<select name="link">' +
    '<option value="">No link</option>' +
    '<option value="online-shop.html">Flowers</option>' +
    '<option value="cards.html">Cards</option>' +
    '<option value="gifts.html">Gifts</option>' +
    '<option value="range.html?brand=cambridge-confectionery&from=chocolate">Chocolate</option>' +
    '<option value="contact.html">Contact</option>' +
    "</select>" +
    "</label>" +
    '<label class="stock-qty">Show until' +
    '<input type="date" name="until">' +
    '<span class="stock-hint">Leave blank to keep it showing.</span>' +
    "</label>" +
    '<label class="stock-tick stock-add-wide">' +
    '<input type="checkbox" name="enabled"> Show the banner on the website' +
    "</label>" +
    "</div>" +
    '<p class="stock-login-error stock-notice-error" role="alert" hidden></p>' +
    '<div class="stock-add-actions">' +
    '<button type="submit" class="stock-unlock">Save banner</button>' +
    '<button type="button" class="stock-close" data-stock-notice-cancel>Back</button>' +
    "</div>" +
    "</form>" +
    "</div>" +
    "</div>";
  document.body.appendChild(panel);

  var sheet = panel.querySelector(".stock-sheet");
  var listEl = panel.querySelector(".stock-list");
  var searchEl = panel.querySelector(".stock-search");
  var statusEl = panel.querySelector(".stock-status");
  var closeBtn = panel.querySelector(".stock-close");
  var loginForm = panel.querySelector(".stock-login");
  var passwordInput = panel.querySelector("[data-stock-password]");
  var saveInput = panel.querySelector("[data-stock-save-password]");
  var saveLive = panel.querySelector("[data-stock-save-live]");
  var loginError = panel.querySelector(".stock-login-error");
  var editor = panel.querySelector(".stock-editor");
  var browseView = panel.querySelector(".stock-browse");
  var addForm = panel.querySelector(".stock-add:not(.stock-notice)");
  var noticeForm = panel.querySelector(".stock-notice");
  var noticeError = panel.querySelector(".stock-notice-error");
  var addError = panel.querySelector(".stock-add-error");
  var addPreview = panel.querySelector(".stock-add-preview");
  var addPhoto = null;
  var group = "all";
  var saveTimers = {};
  var stockPassword = "";
  var shopOpen = true;
  var shopSwitchWrap = panel.querySelector("[data-shop-switch-wrap]");
  var shopSwitchState = panel.querySelector("[data-shop-switch-state]");
  var shopSwitchBtn = panel.querySelector("[data-shop-switch]");

  function renderShopSwitch() {
    if (!shopSwitchWrap || !shopSwitchState || !shopSwitchBtn) return;
    shopSwitchWrap.classList.toggle("is-offline", !shopOpen);
    shopSwitchState.textContent = shopOpen
      ? "Online shop is on. Customers can order."
      : "Online shop is offline. Customers see Coming soon and cannot pay.";
    shopSwitchBtn.textContent = shopOpen ? "Take the shop offline" : "Put the shop online";
  }
  var PASSWORD_KEY = "ginhouseflowers-stock-password";

  function setStatus(message) {
    statusEl.textContent = message || "";
  }

  function filteredProducts() {
    var query = searchEl.value.trim().toLowerCase();
    return catalogue().filter(function (item) {
      var removed = stock.deleted(item.id);
      if (group === "deleted") {
        if (!removed) return false;
      } else {
        if (removed) return false;
        if (group !== "all" && item.group !== group) return false;
      }
      if (!query) return true;
      return [item.name, item.brand, item.sku, item.product]
        .join(" ")
        .toLowerCase()
        .indexOf(query) !== -1;
    });
  }

  function poundsValue(pence) {
    return pence == null ? "" : (pence / 100).toFixed(2);
  }

  function renderList() {
    var items = filteredProducts();
    if (!items.length) {
      listEl.innerHTML =
        '<li class="stock-empty">' +
        (group === "deleted" ? "No deleted products." : "No products match.") +
        "</li>";
      return;
    }
    listEl.innerHTML = items
      .map(function (item) {
        var record = stock.record(item.id) || {};
        var available = record.available == null ? "" : String(record.available);
        var ticked = Boolean(record.outOfStock) || record.available === 0;
        var removed = Boolean(record.deleted);
        var base = basePence(item.id);
        var pricing = stock.pricing(item.id);
        var priceFields =
          base == null
            ? ""
            : '<label class="stock-qty">Price £' +
              '<input type="text" inputmode="decimal" placeholder="' +
              escapeHtml(poundsValue(base)) +
              '" value="' +
              escapeHtml(poundsValue(pricing ? pricing.regularPence : base)) +
              '" data-stock-price>' +
              "</label>" +
              '<label class="stock-tick">' +
              '<input type="checkbox" data-stock-sale' +
              (record.onSale ? " checked" : "") +
              "> On sale" +
              "</label>" +
              '<label class="stock-qty stock-sale-price"' +
              (record.onSale ? "" : " hidden") +
              ">Sale price £" +
              '<input type="text" inputmode="decimal" value="' +
              escapeHtml(poundsValue(record.onSale ? record.salePricePence : null)) +
              '" data-stock-sale-price>' +
              "</label>";
        return (
          '<li class="stock-row" data-stock-id="' +
          escapeHtml(item.id) +
          '" data-deleted="' +
          (removed ? "1" : "0") +
          '">' +
          '<div class="stock-row-head">' +
          "<div>" +
          '<p class="stock-name">' +
          escapeHtml(item.name) +
          "</p>" +
          '<p class="stock-meta">' +
          escapeHtml(item.brand || item.group) +
          (base != null ? " · usual price " + escapeHtml(formatPence(base)) : "") +
          (isCustom(item.id) ? " · added here" : "") +
          "</p>" +
          "</div>" +
          '<div class="stock-row-actions">' +
          (removed
            ? '<button type="button" class="stock-restore" data-stock-restore>Restore</button>' +
              (isCustom(item.id)
                ? '<button type="button" class="stock-delete" data-stock-remove>Delete for good</button>'
                : "")
            : '<button type="button" class="stock-delete" data-stock-delete>Delete</button>') +
          "</div>" +
          "</div>" +
          (removed
            ? '<p class="stock-meta">Hidden from the online shop.</p>'
            : '<div class="stock-controls">' +
              '<label class="stock-qty">Available' +
              '<input type="text" inputmode="numeric" maxlength="4" placeholder="No limit" value="' +
              escapeHtml(available) +
              '" data-stock-available>' +
              "</label>" +
              '<label class="stock-tick">' +
              '<input type="checkbox" data-stock-out' +
              (ticked ? " checked" : "") +
              "> Out of stock" +
              "</label>" +
              priceFields +
              "</div>") +
          "</li>"
        );
      })
      .join("");
  }

  function rowPayload(row) {
    var id = row.getAttribute("data-stock-id");
    var record = stock.record(id) || {};
    var availableInput = row.querySelector("[data-stock-available]");
    var outInput = row.querySelector("[data-stock-out]");
    var priceInput = row.querySelector("[data-stock-price]");
    var saleInput = row.querySelector("[data-stock-sale]");
    var salePriceInput = row.querySelector("[data-stock-sale-price]");

    var available = record.available == null ? null : record.available;
    var outOfStock = Boolean(record.outOfStock);
    if (availableInput) {
      var raw = availableInput.value.trim();
      available = raw === "" ? null : raw;
      outOfStock = outInput.checked;
      if (!outOfStock && raw !== "" && Number(raw) === 0) {
        available = null;
        availableInput.value = "";
      }
    }

    var price = record.pricePence ? poundsValue(record.pricePence) : "";
    var onSale = Boolean(record.onSale);
    var salePrice = record.onSale ? poundsValue(record.salePricePence) : "";
    if (priceInput) {
      price = priceInput.value.trim();
      onSale = saleInput.checked;
      salePrice = salePriceInput.value.trim();
    }

    return {
      id: id,
      available: available,
      outOfStock: outOfStock,
      price: price,
      onSale: onSale,
      salePrice: onSale ? salePrice : "",
      deleted: row.getAttribute("data-deleted") === "1",
      password: stockPassword,
    };
  }

  function isDefault(product) {
    return (
      product.available == null &&
      !product.outOfStock &&
      !product.deleted &&
      product.pricePence == null &&
      !product.onSale
    );
  }

  function saveRow(row, rerender) {
    var payload = rowPayload(row);
    var id = payload.id;
    setStatus("Saving…");
    return fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.data && result.ok === false && loginForm) {
          var denied = result.data.error || "";
          if (denied.indexOf("password") !== -1) {
            stockPassword = "";
            showLogin(denied);
            return;
          }
        }
        if (!result.ok) throw new Error((result.data && result.data.error) || "Could not save.");
        var product = result.data.product;
        if (!product || isDefault(product)) {
          delete stock.products[id];
        } else {
          stock.products[id] = product;
        }
        publish(stock.products);
        if (rerender) {
          renderList();
        } else if (product) {
          var outInput = row.querySelector("[data-stock-out]");
          var availableInput = row.querySelector("[data-stock-available]");
          if (outInput) outInput.checked = Boolean(product.outOfStock) || product.available === 0;
          if (availableInput) {
            availableInput.value = product.available == null ? "" : String(product.available);
          }
        }
        setStatus("Saved.");
      })
      .catch(function (err) {
        setStatus(err.message || "Could not save.");
      });
  }

  function scheduleSave(row) {
    var id = row.getAttribute("data-stock-id");
    if (saveTimers[id]) clearTimeout(saveTimers[id]);
    saveTimers[id] = setTimeout(function () {
      saveRow(row, false);
    }, 350);
  }

  listEl.addEventListener("change", function (event) {
    var row = event.target.closest(".stock-row");
    if (!row) return;
    if (event.target.matches("[data-stock-sale]")) {
      var saleField = row.querySelector(".stock-sale-price");
      var salePriceInput = row.querySelector("[data-stock-sale-price]");
      saleField.hidden = !event.target.checked;
      if (event.target.checked && !salePriceInput.value.trim()) {
        salePriceInput.focus();
        setStatus("Enter the sale price to put this on sale.");
        return;
      }
    }
    scheduleSave(row);
  });
  listEl.addEventListener("input", function (event) {
    if (!event.target.matches("[data-stock-available]")) return;
    var row = event.target.closest(".stock-row");
    if (row) scheduleSave(row);
  });
  listEl.addEventListener("click", function (event) {
    var row = event.target.closest(".stock-row");
    if (!row) return;
    var name = row.querySelector(".stock-name").textContent;
    if (event.target.closest("[data-stock-delete]")) {
      if (!window.confirm("Delete " + name + " from the online shop? You can restore it from Deleted.")) {
        return;
      }
      row.setAttribute("data-deleted", "1");
      saveRow(row, true);
    } else if (event.target.closest("[data-stock-restore]")) {
      row.setAttribute("data-deleted", "0");
      saveRow(row, true);
    } else if (event.target.closest("[data-stock-remove]")) {
      if (!window.confirm("Delete " + name + " for good? This removes the product and its photo.")) {
        return;
      }
      removeForGood(row.getAttribute("data-stock-id"), name);
    }
  });

  function postStock(payload) {
    payload.password = stockPassword;
    return fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function (response) {
      return response.json().then(function (data) {
        if (response.status === 401) {
          stockPassword = "";
          showLogin(data.error || "That password is not correct.");
          return null;
        }
        if (!response.ok) throw new Error(data.error || "Could not save.");
        return data;
      });
    });
  }

  function removeForGood(id, name) {
    setStatus("Deleting…");
    postStock({ action: "remove", id: id })
      .then(function (data) {
        if (!data) return;
        window.GinCustomProducts = (window.GinCustomProducts || []).filter(function (item) {
          return item.id !== id;
        });
        delete stock.products[id];
        basePrices = null;
        publish(stock.products);
        renderList();
        setStatus(name + " has been deleted.");
      })
      .catch(function (err) {
        setStatus(err.message || "Could not delete.");
      });
  }

  function showBrowse() {
    addForm.hidden = true;
    noticeForm.hidden = true;
    browseView.hidden = false;
  }

  if (shopSwitchBtn) {
    shopSwitchBtn.addEventListener("click", function () {
      var next = !shopOpen;
      var question = next
        ? "Put the online shop back on?"
        : "Take the online shop offline? Customers will see Coming soon and cannot pay.";
      if (!window.confirm(question)) return;
      shopSwitchBtn.disabled = true;
      postStock({ action: "shop", open: next })
        .then(function (data) {
          shopSwitchBtn.disabled = false;
          if (!data) return;
          shopOpen = data.shopOpen !== false;
          renderShopSwitch();
          setStatus(shopOpen ? "The online shop is on." : "The online shop is offline.");
        })
        .catch(function (err) {
          shopSwitchBtn.disabled = false;
          setStatus(err.message || "Could not save the shop switch.");
        });
    });
  }

  panel.querySelector("[data-stock-notice-open]").addEventListener("click", function () {
    var notice = stock.notice || {};
    noticeForm.elements.message.value = notice.message || "";
    noticeForm.elements.link.value = notice.link || "";
    noticeForm.elements.until.value = notice.until || "";
    noticeForm.elements.enabled.checked = Boolean(notice.enabled);
    noticeError.hidden = true;
    browseView.hidden = true;
    noticeForm.hidden = false;
    noticeForm.elements.message.focus();
  });

  panel.querySelector("[data-stock-notice-cancel]").addEventListener("click", showBrowse);

  noticeForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var fields = noticeForm.elements;
    var submit = noticeForm.querySelector("[type='submit']");
    noticeError.hidden = true;
    submit.disabled = true;
    submit.textContent = "Saving…";
    postStock({
      action: "notice",
      message: fields.message.value,
      link: fields.link.value,
      until: fields.until.value,
      enabled: fields.enabled.checked,
    })
      .then(function (data) {
        if (!data) return;
        stock.notice = data.notice;
        showBrowse();
        setStatus(
          data.notice.enabled
            ? "The banner is saved and showing on the website."
            : "The banner is saved and switched off."
        );
      })
      .catch(function (err) {
        noticeError.textContent = err.message || "Could not save the banner.";
        noticeError.hidden = false;
      })
      .then(function () {
        submit.disabled = false;
        submit.textContent = "Save banner";
      });
  });

  function resetAddForm() {
    addForm.reset();
    addPhoto = null;
    addPreview.hidden = true;
    addPreview.removeAttribute("src");
    addError.hidden = true;
    addError.textContent = "";
  }

  function showAddError(message) {
    addError.textContent = message;
    addError.hidden = false;
  }

  panel.querySelector("[data-stock-add-open]").addEventListener("click", function () {
    resetAddForm();
    panel.querySelector("#stock-brands").innerHTML = optionsHtml(uniqueValues("brand"));
    panel.querySelector("#stock-types").innerHTML = optionsHtml(uniqueValues("product"));
    panel.querySelector("#stock-occasions").innerHTML = optionsHtml(uniqueValues("occasion"));
    browseView.hidden = true;
    addForm.hidden = false;
    addForm.scrollTop = 0;
    addForm.elements.name.focus();
  });

  panel.querySelector("[data-stock-add-cancel]").addEventListener("click", function () {
    resetAddForm();
    showBrowse();
  });

  function shrinkPhoto(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error("The photo could not be read."));
      };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () {
          reject(new Error("The photo could not be read. Please use a JPEG, PNG or WebP image."));
        };
        img.onload = function () {
          var longest = 1200;
          var scale = Math.min(1, longest / Math.max(img.naturalWidth, img.naturalHeight));
          var canvas = document.createElement("canvas");
          canvas.width = Math.round(img.naturalWidth * scale);
          canvas.height = Math.round(img.naturalHeight * scale);
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  addForm.elements.photo.addEventListener("change", function () {
    var file = addForm.elements.photo.files[0];
    addPhoto = null;
    addPreview.hidden = true;
    if (!file) return;
    shrinkPhoto(file)
      .then(function (dataUrl) {
        addPhoto = dataUrl;
        addPreview.src = dataUrl;
        addPreview.hidden = false;
      })
      .catch(function (err) {
        addForm.elements.photo.value = "";
        showAddError(err.message);
      });
  });

  addForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var fields = addForm.elements;
    var submit = addForm.querySelector("[type='submit']");
    addError.hidden = true;
    submit.disabled = true;
    submit.textContent = "Adding…";
    postStock({
      action: "add",
      name: fields.name.value,
      brand: fields.brand.value,
      group: fields.group.value,
      productType: fields.productType.value,
      occasion: fields.occasion.value,
      styles: fields.styles.value,
      blurb: fields.blurb.value,
      price: fields.price.value,
      available: fields.available.value.trim(),
      image: addPhoto || "",
    })
      .then(function (data) {
        if (!data) return;
        var added = data.customProduct;
        window.GinCustomProducts = (window.GinCustomProducts || []).concat([added]);
        if (data.product) stock.products[added.id] = data.product;
        basePrices = null;
        publish(stock.products);
        resetAddForm();
        showBrowse();
        group = "all";
        panel.querySelectorAll(".stock-filter").forEach(function (item) {
          item.classList.toggle("is-active", item.getAttribute("data-stock-group") === "all");
        });
        searchEl.value = added.name;
        renderList();
        setStatus(added.name + " has been added and is live in the shop.");
      })
      .catch(function (err) {
        showAddError(err.message || "Could not add the product.");
      })
      .then(function () {
        submit.disabled = false;
        submit.textContent = "Add product";
      });
  });

  searchEl.addEventListener("input", renderList);
  panel.querySelector(".stock-filters").addEventListener("click", function (event) {
    var button = event.target.closest("[data-stock-group]");
    if (!button) return;
    group = button.getAttribute("data-stock-group");
    panel.querySelectorAll(".stock-filter").forEach(function (item) {
      item.classList.toggle("is-active", item === button);
    });
    renderList();
  });

  function showLogin(message) {
    editor.hidden = true;
    loginForm.hidden = false;
    if (message) {
      loginError.hidden = false;
      loginError.textContent = message;
    } else {
      loginError.hidden = true;
      loginError.textContent = "";
    }
  }

  function showEditor() {
    loginError.hidden = true;
    loginError.textContent = "";
    loginForm.hidden = true;
    editor.hidden = false;
    showBrowse();
    saveLive.checked = Boolean(localStorage.getItem(PASSWORD_KEY));
    setStatus("");
    searchEl.focus();
    loadStock().then(renderList);
  }

  function rememberPassword(password, save) {
    if (save) localStorage.setItem(PASSWORD_KEY, password);
    else localStorage.removeItem(PASSWORD_KEY);
  }

  function unlock(password, save) {
    return fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlock", password: password }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          stockPassword = "";
          try {
            if (localStorage.getItem(PASSWORD_KEY) === password) {
              localStorage.removeItem(PASSWORD_KEY);
            }
          } catch (err) {}
          showLogin((result.data && result.data.error) || "That password is not correct.");
          passwordInput.focus();
          return false;
        }
        stockPassword = password;
        rememberPassword(password, save);
        showEditor();
        return true;
      })
      .catch(function () {
        showLogin("Could not check the password. Please try again.");
        return false;
      });
  }

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    unlock(passwordInput.value, saveInput.checked);
  });

  saveLive.addEventListener("change", function () {
    rememberPassword(stockPassword, saveLive.checked);
    saveInput.checked = saveLive.checked;
  });

  function closePanel() {
    panel.hidden = true;
    document.body.style.overflow = "";
    var logo = document.querySelector(".logo");
    if (logo) logo.focus();
  }

  function openPanel() {
    panel.hidden = false;
    document.body.style.overflow = "hidden";
    setStatus("");
    var saved = "";
    try {
      saved = localStorage.getItem(PASSWORD_KEY) || "";
    } catch (err) {
      saved = "";
    }
    if (saved) {
      passwordInput.value = saved;
      saveInput.checked = true;
      unlock(saved, true);
      return;
    }
    showLogin("");
    passwordInput.focus();
  }

  closeBtn.addEventListener("click", closePanel);
  panel.addEventListener("click", function (event) {
    if (event.target === panel) closePanel();
  });
  sheet.addEventListener("click", function (event) {
    event.stopPropagation();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !panel.hidden) closePanel();
  });

  var logo = document.querySelector(".logo");
  if (logo) {
    var logoClicks = 0;
    var logoTimer = null;
    logo.addEventListener("click", function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      logoClicks += 1;
      if (logoTimer) clearTimeout(logoTimer);
      if (logoClicks >= 3) {
        logoClicks = 0;
        openPanel();
        return;
      }
      logoTimer = setTimeout(function () {
        var count = logoClicks;
        logoClicks = 0;
        if (count === 1) window.location.href = logo.getAttribute("href") || "index.html";
      }, 450);
    });
  }

  loadStock();
})();
