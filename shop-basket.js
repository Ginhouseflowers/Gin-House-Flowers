(function () {
  var STORAGE_KEY = "ginhouseflowers-basket";
  var root = document.querySelector("[data-shop]");
  if (!root) return;

  var checkoutApi =
    (window.GIN_SHOP_CONFIG && window.GIN_SHOP_CONFIG.checkoutApi) ||
    "/api/create-checkout-session";

  var listEl = root.querySelector("[data-basket-list]");
  var addonsEl = root.querySelector("[data-basket-addons]");
  var addonsList = root.querySelector("[data-basket-addons-list]");
  var ADDON_PICKS = ["ccc-cp000435", "ccc-cp000303", "ccc-cp000494", "ccc-cp000703", "ccc-cp000903"];
  var emptyEl = root.querySelector("[data-basket-empty]");
  var itemsWrap = root.querySelector("[data-basket-items-wrap]");
  var totalEl = root.querySelector("[data-basket-total]");
  var deliveryFeeEl = root.querySelector("[data-basket-delivery-fee]");
  var clearBtn = root.querySelector("[data-basket-clear]");
  var checkoutBtn = root.querySelector("[data-basket-checkout]");
  var checkoutError = root.querySelector("[data-basket-checkout-error]");
  var emailFallback = root.querySelector("[data-basket-email-fallback]");
  var statusEl = root.querySelector("[data-basket-status]");
  var fulfilmentInputs = root.querySelectorAll("[data-basket-fulfilment-input]");
  var collectionDetailsField = root.querySelector("[data-collection-details]");
  var collectionDateInput = root.querySelector("[data-collection-date]");
  var collectionTimeSelect = root.querySelector("[data-collection-time]");
  var collectionError = root.querySelector("[data-collection-error]");
  var collectionDateField =
    collectionDateInput && collectionDateInput.closest(".basket-collection-date");
  var deliveryDetailsField = root.querySelector("[data-delivery-details]");
  var deliveryPostcodeInput = root.querySelector("[data-delivery-postcode]");
  var deliveryPostcodeError = root.querySelector("[data-delivery-postcode-error]");
  var deliveryNameInput = root.querySelector("[data-delivery-name]");
  var deliveryDateInput = root.querySelector("[data-delivery-date]");
  var deliveryDateError = root.querySelector("[data-delivery-date-error]");
  var deliveryDateField = deliveryDateInput && deliveryDateInput.closest(".basket-delivery-date");
  var WATER_BUBBLE_BAG_GBP = 5;
  var UK_POSTAGE_GBP = 3.99;
  var postageOption = root.querySelector("[data-uk-postage-option]");
  var noteField = root.querySelector("[data-basket-note]");
  var noteMessageWrap = root.querySelector("[data-basket-note-message]");
  var noteMessageInput = root.querySelector("[data-basket-card-message]");
  var noteChoices = root.querySelectorAll("[data-basket-note-choice]");

  function getProductConfig(productId) {
    return window.GinShopProducts && window.GinShopProducts[productId];
  }

  function productAllowsAddon(productId) {
    var product = getProductConfig(productId);
    return Boolean(product && product.waterBubbleBagAddon);
  }

  var collectionDateValid = false;
  var collectionTimeValid = false;
  var collectionPrompt = false;
  var deliveryPostcodeValid = false;
  var deliveryPostcodeChecking = false;
  var deliveryDateValid = false;
  var deliveryFeeGbp = 0;
  var lastCheckedPostcode = "";
  var postcodeCheckTimer = null;

  function loadBasket() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveBasket(items, reason) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(
      new CustomEvent("ginhouse:basket", { detail: { reason: reason || "" } })
    );
  }

  function formatMoney(amount) {
    var pence = Math.round(Number(amount) * 100);
    if (!isFinite(pence)) return "£0";
    if (pence % 100 === 0) return "£" + pence / 100;
    return "£" + (pence / 100).toFixed(2);
  }

  function colourLabel(item) {
    if (item.colour === "other" && item.colourOther) {
      return "Other — " + item.colourOther;
    }
    var labels = {
      bright: "Bright",
      pastel: "Pastel",
      none: "No preference",
      seasonal: "Seasonal",
      other: "Other",
    };
    return labels[item.colour] || item.colour;
  }

  function lineItemTotal(item) {
    var total = item.value * item.quantity;
    if (item.waterBubbleBag && productAllowsAddon(item.productId)) {
      total += WATER_BUBBLE_BAG_GBP * item.quantity;
    }
    return total;
  }

  function basketTotal(items) {
    return items.reduce(function (sum, item) {
      return sum + lineItemTotal(item);
    }, 0);
  }

  function addonLabel(item) {
    if (!item.waterBubbleBag || !productAllowsAddon(item.productId)) {
      return "";
    }
    return " · Water bubble & bag (+£5 each)";
  }

  function isValidProductValue(productId, value) {
    var product = getProductConfig(productId);
    if (!product) return false;
    if (product.fixedPrice) {
      return Math.round(Number(value) * 100) === product.fixedPricePence;
    }
    if (!Number.isInteger(value)) return false;
    return (
      value >= product.minValue &&
      value <= product.maxValue &&
      value % product.valueStep === 0
    );
  }

  function selectedFulfilment() {
    var selected = root.querySelector('[data-basket-fulfilment-input]:checked');
    return selected ? selected.value : "collection";
  }

  function isCardsAndGiftsOnly(items) {
    if (!items.length) return false;
    return items.every(function (item) {
      var product = getProductConfig(item.productId);
      return product && (product.group === "cards" || product.group === "gifts");
    });
  }

  function syncPostageOption() {
    var allowed = isCardsAndGiftsOnly(loadBasket());
    if (postageOption) postageOption.hidden = !allowed;
    if (!allowed && selectedFulfilment() === "postage") {
      var collectionInput = root.querySelector(
        '[data-basket-fulfilment-input][value="collection"]'
      );
      if (collectionInput) collectionInput.checked = true;
      toggleFulfilmentDetails();
    }
  }

  function clearDeliveryFeeNotice() {
    if (statusEl && /^Delivery charge of /.test(statusEl.textContent)) {
      statusEl.textContent = "";
    }
  }

  function showPostcodeError(message) {
    if (message) clearDeliveryFeeNotice();
    if (!deliveryPostcodeError) return;
    if (message) {
      deliveryPostcodeError.textContent = message;
      deliveryPostcodeError.hidden = false;
    } else {
      deliveryPostcodeError.textContent = "";
      deliveryPostcodeError.hidden = true;
    }
    var postcodeWrap =
      deliveryPostcodeInput && deliveryPostcodeInput.closest(".basket-delivery-postcode");
    if (postcodeWrap) {
      postcodeWrap.classList.toggle("basket-delivery-postcode--invalid", Boolean(message));
      postcodeWrap.classList.toggle(
        "basket-delivery-postcode--valid",
        !message && deliveryPostcodeValid
      );
    }
  }

  function showDateError(message) {
    if (!deliveryDateError) return;
    if (message) {
      deliveryDateError.textContent = message;
      deliveryDateError.hidden = false;
    } else {
      deliveryDateError.textContent = "";
      deliveryDateError.hidden = true;
    }
    if (deliveryDateField) {
      deliveryDateField.classList.toggle("basket-delivery-date--invalid", Boolean(message));
    }
  }

  function checkDeliveryDate() {
    if (selectedFulfilment() !== "delivery") {
      deliveryDateValid = false;
      showDateError("");
      return false;
    }

    var dateValue = deliveryDateInput ? deliveryDateInput.value : "";
    if (!window.GinDeliverySchedule || !window.GinDeliverySchedule.validateDeliveryDate) {
      deliveryDateValid = false;
      showDateError("Delivery date check is unavailable. Please refresh the page.");
      return false;
    }

    var result = window.GinDeliverySchedule.validateDeliveryDate(dateValue);
    if (result.ok) {
      deliveryDateValid = true;
      showDateError("");
      return true;
    }

    deliveryDateValid = false;
    showDateError(result.error);
    return false;
  }

  function resetDeliveryDetailsState() {
    deliveryPostcodeValid = false;
    deliveryPostcodeChecking = false;
    deliveryDateValid = false;
    deliveryFeeGbp = 0;
    lastCheckedPostcode = "";
    clearDeliveryFeeNotice();
    showPostcodeError("");
    showDateError("");
    if (deliveryDateInput) deliveryDateInput.value = "";
    renderDeliveryCalendar();
    updateBasketTotals();
    syncCheckoutAvailability();
  }

  var renderDeliveryCalendar = function () {};

  function setupDeliveryDateInput() {
    if (!deliveryDateInput || !window.GinDeliverySchedule) return;
    var calendar = root.querySelector("[data-delivery-calendar]");
    if (!calendar) return;

    function parseIso(iso) {
      var parts = String(iso || "").split("-").map(Number);
      if (parts.length !== 3) return null;
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    function toIso(date) {
      var m = String(date.getMonth() + 1).padStart(2, "0");
      var d = String(date.getDate()).padStart(2, "0");
      return date.getFullYear() + "-" + m + "-" + d;
    }

    var earliest = parseIso(window.GinDeliverySchedule.getEarliestDeliveryDate());
    var latest = new Date(earliest.getFullYear(), earliest.getMonth() + 6, earliest.getDate());
    var view = new Date(earliest.getFullYear(), earliest.getMonth(), 1);

    function dayAvailable(date) {
      if (date < earliest || date > latest) return false;
      var day = date.getDay();
      return day >= 2 && day <= 6;
    }

    renderDeliveryCalendar = function () {
      var selected = deliveryDateInput.value;
      var monthName = new Intl.DateTimeFormat("en-GB", {
        month: "long",
        year: "numeric",
      }).format(view);
      var prevMonth = new Date(view.getFullYear(), view.getMonth() - 1, 1);
      var nextMonth = new Date(view.getFullYear(), view.getMonth() + 1, 1);
      var prevDisabled = prevMonth < new Date(earliest.getFullYear(), earliest.getMonth(), 1);
      var nextDisabled = nextMonth > new Date(latest.getFullYear(), latest.getMonth(), 1);
      var html =
        '<div class="delivery-calendar-head">' +
        '<button type="button" class="delivery-calendar-nav" data-cal-prev' +
        (prevDisabled ? " disabled" : "") +
        ' aria-label="Previous month">‹</button>' +
        '<p class="delivery-calendar-month">' +
        monthName +
        "</p>" +
        '<button type="button" class="delivery-calendar-nav" data-cal-next' +
        (nextDisabled ? " disabled" : "") +
        ' aria-label="Next month">›</button>' +
        "</div>" +
        '<div class="delivery-calendar-grid" role="grid">' +
        ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
          .map(function (label) {
            return '<span class="delivery-calendar-dow">' + label + "</span>";
          })
          .join("");

      var first = new Date(view.getFullYear(), view.getMonth(), 1);
      var lead = (first.getDay() + 6) % 7;
      var i;
      for (i = 0; i < lead; i += 1) {
        html += '<span class="delivery-calendar-empty"></span>';
      }
      var daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      for (i = 1; i <= daysInMonth; i += 1) {
        var date = new Date(view.getFullYear(), view.getMonth(), i);
        var iso = toIso(date);
        var available = dayAvailable(date);
        var closed = date.getDay() === 0 || date.getDay() === 1;
        var label = new Intl.DateTimeFormat("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(date);
        if (!available) {
          html +=
            '<button type="button" class="delivery-calendar-day' +
            (closed ? " is-closed" : "") +
            '" disabled aria-label="' +
            label +
            ', unavailable">' +
            i +
            "</button>";
        } else {
          html +=
            '<button type="button" class="delivery-calendar-day" data-cal-day="' +
            iso +
            '" aria-pressed="' +
            (selected === iso ? "true" : "false") +
            '" aria-label="' +
            label +
            '">' +
            i +
            "</button>";
        }
      }
      html += "</div>";
      calendar.innerHTML = html;
    };

    calendar.addEventListener("click", function (event) {
      var prev = event.target.closest("[data-cal-prev]");
      var next = event.target.closest("[data-cal-next]");
      var day = event.target.closest("[data-cal-day]");
      if (prev && !prev.disabled) {
        view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
        renderDeliveryCalendar();
        return;
      }
      if (next && !next.disabled) {
        view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
        renderDeliveryCalendar();
        return;
      }
      if (!day) return;
      deliveryDateInput.value = day.getAttribute("data-cal-day");
      deliveryDateInput.dispatchEvent(new Event("change", { bubbles: true }));
      renderDeliveryCalendar();
    });

    renderDeliveryCalendar();
  }

  function showCollectionError(message) {
    if (!collectionError) return;
    if (message) {
      collectionError.textContent = message;
      collectionError.hidden = false;
    } else {
      collectionError.textContent = "";
      collectionError.hidden = true;
    }
    if (collectionDateField) {
      collectionDateField.classList.toggle("basket-collection-date--invalid", Boolean(message));
    }
    if (collectionTimeSelect && collectionTimeSelect.closest(".basket-collection-time")) {
      collectionTimeSelect
        .closest(".basket-collection-time")
        .classList.toggle("basket-collection-time--invalid", Boolean(message));
    }
  }

  function populateCollectionTimes() {
    if (!collectionTimeSelect || !window.GinCollectionSchedule) return;

    var dateValue = collectionDateInput ? collectionDateInput.value : "";
    var previous = collectionTimeSelect.value;
    collectionTimeSelect.innerHTML = '<option value="">Choose a time</option>';

    if (!dateValue) {
      collectionTimeValid = false;
      return;
    }

    var slots = window.GinCollectionSchedule.getSlotsForDate(dateValue);
    slots.forEach(function (slot) {
      var option = document.createElement("option");
      option.value = slot.value;
      option.textContent = slot.label;
      collectionTimeSelect.appendChild(option);
    });

    if (previous && slots.some(function (s) { return s.value === previous; })) {
      collectionTimeSelect.value = previous;
    }
  }

  function checkCollectionSchedule() {
    if (selectedFulfilment() !== "collection") {
      collectionDateValid = false;
      collectionTimeValid = false;
      showCollectionError("");
      return false;
    }

    if (!window.GinCollectionSchedule) {
      showCollectionError("Collection scheduling is unavailable. Please refresh the page.");
      return false;
    }

    var dateValue = collectionDateInput ? collectionDateInput.value : "";
    var timeValue = collectionTimeSelect ? collectionTimeSelect.value : "";

    if (!dateValue) {
      collectionDateValid = false;
      collectionTimeValid = false;
      showCollectionError("Please choose a collection date.");
      return false;
    }

    populateCollectionTimes();
    timeValue = collectionTimeSelect ? collectionTimeSelect.value : "";

    var result = window.GinCollectionSchedule.validateCollectionDateTime(
      dateValue,
      timeValue
    );

    if (result.ok) {
      collectionDateValid = true;
      collectionTimeValid = true;
      showCollectionError("");
      return true;
    }

    collectionDateValid = Boolean(dateValue);
    collectionTimeValid = false;
    showCollectionError(!timeValue && !collectionPrompt ? "" : result.error);
    return false;
  }

  function resetCollectionDetailsState() {
    collectionDateValid = false;
    collectionTimeValid = false;
    showCollectionError("");
    if (collectionTimeSelect) {
      collectionTimeSelect.innerHTML = '<option value="">Choose a time</option>';
    }
    syncCheckoutAvailability();
  }

  function setupCollectionDateInput() {
    if (!collectionDateInput || !window.GinCollectionSchedule) return;
    collectionDateInput.min = window.GinCollectionSchedule.getEarliestCollectionDate();
    if (!collectionDateInput.value) {
      collectionDateInput.value = collectionDateInput.min;
      populateCollectionTimes();
    }
  }

  function updateBasketTotals() {
    var items = loadBasket();
    var subtotal = basketTotal(items);
    var postageSelected = selectedFulfilment() === "postage";
    var feeGbp = postageSelected ? UK_POSTAGE_GBP : deliveryFeeGbp;
    var showDeliveryFee =
      postageSelected ||
      (selectedFulfilment() === "delivery" && deliveryPostcodeValid && deliveryFeeGbp > 0);

    if (deliveryFeeEl) {
      if (showDeliveryFee) {
        deliveryFeeEl.hidden = false;
        deliveryFeeEl.textContent = "Delivery: " + formatMoney(feeGbp);
      } else {
        deliveryFeeEl.hidden = true;
        deliveryFeeEl.textContent = "";
      }
    }

    if (totalEl && items.length > 0) {
      var grandTotal = subtotal + (showDeliveryFee ? feeGbp : 0);
      totalEl.textContent = "Total: " + formatMoney(grandTotal);
    }
  }

  function stockCap(productId) {
    if (!window.GinStock) return null;
    return window.GinStock.available(productId);
  }

  function basketStockProblem(items) {
    var totals = {};
    items.forEach(function (item) {
      totals[item.productId] = (totals[item.productId] || 0) + Number(item.quantity || 0);
    });
    var ids = Object.keys(totals);
    for (var i = 0; i < ids.length; i += 1) {
      if (window.GinStock && window.GinStock.deleted(ids[i])) {
        return "An item in your basket is no longer available online.";
      }
      if (window.GinStock && !window.GinStock.allows(ids[i], totals[ids[i]])) {
        var cap = stockCap(ids[i]);
        if (cap === 0) return "An item in your basket is out of stock online.";
        return "An item in your basket has only " + cap + " available online.";
      }
    }
    return "";
  }

  function showCheckoutError(message) {
    if (!checkoutError) return;
    if (message) {
      checkoutError.textContent = message;
      checkoutError.hidden = false;
      checkoutError.scrollIntoView({ block: "nearest" });
      return;
    }
    checkoutError.textContent = "";
    checkoutError.hidden = true;
  }

  function syncCheckoutAvailability() {
    if (!checkoutBtn || checkoutBtn.hidden) return;
    if (checkoutBtn.textContent === "Redirecting…") return;
    checkoutBtn.disabled = false;
    checkoutBtn.title = "";
  }

  function deliveryAddressValue() {
    return deliveryPostcodeInput ? deliveryPostcodeInput.value.trim() : "";
  }

  function deliveryPostcodeValue() {
    if (!window.GinAddressSearch) return deliveryAddressValue();
    return window.GinAddressSearch.extractPostcode(deliveryAddressValue());
  }

  function deliveryNameValue() {
    return deliveryNameInput ? deliveryNameInput.value.trim() : "";
  }

  function validateDeliveryPostcodeNow(postcode) {
    if (!window.GinDelivery || !window.GinDelivery.validatePostcode) {
      return Promise.resolve({
        ok: false,
        error: "Delivery check is unavailable. Please refresh the page and try again.",
      });
    }
    return window.GinDelivery.validatePostcode(postcode);
  }

  function checkDeliveryPostcode() {
    if (selectedFulfilment() !== "delivery") {
      resetDeliveryDetailsState();
      return Promise.resolve({ ok: true });
    }

    if (!deliveryAddressValue()) {
      deliveryPostcodeValid = false;
      showPostcodeError("Please enter the delivery address.");
      syncCheckoutAvailability();
      return Promise.resolve({ ok: false });
    }
    var postcode = deliveryPostcodeValue();
    if (!postcode) {
      deliveryPostcodeValid = false;
      showPostcodeError("Please include the postcode, or choose the address from the suggestions.");
      syncCheckoutAvailability();
      return Promise.resolve({ ok: false });
    }

    if (
      deliveryPostcodeValid &&
      lastCheckedPostcode &&
      window.GinDelivery &&
      window.GinDelivery.normalizePostcode(lastCheckedPostcode) ===
        window.GinDelivery.normalizePostcode(postcode)
    ) {
      showPostcodeError("");
      syncCheckoutAvailability();
      return Promise.resolve({ ok: true });
    }

    deliveryPostcodeChecking = true;
    deliveryPostcodeValid = false;
    syncCheckoutAvailability();

    return validateDeliveryPostcodeNow(postcode).then(function (result) {
      deliveryPostcodeChecking = false;
      lastCheckedPostcode = postcode;

      if (result.ok) {
        deliveryPostcodeValid = true;
        deliveryFeeGbp = Number(result.deliveryFeeGbp) || 0;
        showPostcodeError("");
        announce(
          deliveryFeeGbp > 0
            ? "Delivery charge of " + formatMoney(deliveryFeeGbp) + " will be added at checkout."
            : ""
        );
      } else {
        deliveryPostcodeValid = false;
        deliveryFeeGbp = 0;
        showPostcodeError(result.error || "This postcode is outside our delivery area.");
      }

      updateBasketTotals();
      syncCheckoutAvailability();
      return result;
    });
  }

  function schedulePostcodeCheck() {
    deliveryPostcodeValid = false;
    lastCheckedPostcode = "";
    clearDeliveryFeeNotice();
    syncCheckoutAvailability();
    if (postcodeCheckTimer) clearTimeout(postcodeCheckTimer);
    postcodeCheckTimer = setTimeout(function () {
      checkDeliveryPostcode();
    }, 400);
  }

  function toggleFulfilmentDetails() {
    var fulfilment = selectedFulfilment();
    var isDelivery = fulfilment === "delivery";
    var isCollection = fulfilment === "collection";

    if (collectionDetailsField) {
      collectionDetailsField.hidden = !isCollection;
    }
    if (collectionDateInput) {
      collectionDateInput.required = isCollection;
    }
    if (collectionTimeSelect) {
      collectionTimeSelect.required = isCollection;
    }

    if (deliveryDetailsField) {
      deliveryDetailsField.hidden = !isDelivery;
    }
    if (deliveryPostcodeInput) {
      deliveryPostcodeInput.required = isDelivery;
    }
    if (deliveryNameInput) {
      deliveryNameInput.required = isDelivery;
    }
    if (deliveryDateInput) {
      deliveryDateInput.required = isDelivery;
    }

    if (isCollection) {
      if (deliveryPostcodeInput) deliveryPostcodeInput.value = "";
      resetDeliveryDetailsState();
      setupCollectionDateInput();
      checkCollectionSchedule();
    } else if (isDelivery) {
      resetCollectionDetailsState();
      if (collectionDateInput) collectionDateInput.value = "";
      setupDeliveryDateInput();
      resetDeliveryDetailsState();
      if (deliveryPostcodeInput && deliveryPostcodeInput.value.trim()) {
        schedulePostcodeCheck();
      }
    } else {
      if (collectionDetailsField) collectionDetailsField.hidden = true;
      if (deliveryDetailsField) deliveryDetailsField.hidden = true;
      if (collectionDateInput) collectionDateInput.required = false;
      if (collectionTimeSelect) collectionTimeSelect.required = false;
      if (deliveryPostcodeInput) {
        deliveryPostcodeInput.required = false;
        deliveryPostcodeInput.value = "";
      }
      if (deliveryDateInput) deliveryDateInput.required = false;
      resetCollectionDetailsState();
      resetDeliveryDetailsState();
    }

    syncCheckoutAvailability();
  }

  function renderBasket() {
    var items = loadBasket();
    if (!listEl) return;

    listEl.innerHTML = "";

    if (items.length === 0) {
      if (emptyEl) emptyEl.hidden = false;
      if (itemsWrap) itemsWrap.hidden = true;
      if (addonsEl) addonsEl.hidden = true;
      if (totalEl) totalEl.hidden = true;
      if (clearBtn) clearBtn.hidden = true;
      if (checkoutBtn) checkoutBtn.hidden = true;
      if (emailFallback) emailFallback.hidden = true;
      syncPostageOption();
      syncCardNote();
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (itemsWrap) itemsWrap.hidden = false;
    renderAddons(items);
    if (clearBtn) clearBtn.hidden = false;
    if (checkoutBtn) {
      checkoutBtn.hidden = false;
      checkoutBtn.textContent = "Pay securely";
    }
    if (emailFallback) {
      emailFallback.hidden = false;
      emailFallback.href = buildCheckoutMailto(items, basketTotal(items));
    }

    items.forEach(function (item) {
      var lineTotal = lineItemTotal(item);

      var li = document.createElement("li");
      li.className = "basket-line";
      li.innerHTML =
        (window.GinProductThumb
          ? (function () {
              var thumb = window.GinProductThumb(item.productId);
              if (!thumb) {
                return '<span class="basket-line-thumb basket-line-thumb--empty" aria-hidden="true"></span>';
              }
              return (
                '<span class="basket-line-thumb"><img src="' +
                escapeHtml(thumb.src) +
                '" alt="' +
                escapeHtml(thumb.alt) +
                '" width="96" height="96" loading="lazy" decoding="async"></span>'
              );
            })()
          : "") +
        '<div class="basket-line-details">' +
        '<p class="basket-line-title">' +
        escapeHtml(item.name) +
        "</p>" +
        '<p class="basket-line-meta">' +
        escapeHtml(formatMoney(item.value)) +
        " each" +
        (function () {
          var product = getProductConfig(item.productId);
          if (product && product.fixedPrice) return "";
          return " · " + escapeHtml(colourLabel(item));
        })() +
        escapeHtml(addonLabel(item)) +
        (window.GinStock && window.GinStock.deleted(item.productId)
          ? " · No longer available"
          : window.GinStock && window.GinStock.blocked(item.productId)
            ? " · Out of stock"
            : window.GinStock &&
                window.GinStock.pricing(item.productId) &&
                window.GinStock.pricing(item.productId).onSale
              ? " · Sale"
              : "") +
        "</p>" +
        '<div class="basket-line-qty">' +
        '<label class="visually-hidden" for="qty-' +
        item.lineId +
        '">Quantity</label>' +
        '<input type="number" id="qty-' +
        item.lineId +
        '" min="1" max="' +
        (function () {
          var cap = stockCap(item.productId);
          return cap == null ? 99 : Math.max(1, cap);
        })() +
        '" value="' +
        item.quantity +
        '" data-qty-input data-line-id="' +
        item.lineId +
        '" />' +
        "</div>" +
        "</div>" +
        '<div class="basket-line-end">' +
        '<p class="basket-line-price">' +
        escapeHtml(formatMoney(lineTotal)) +
        "</p>" +
        '<button type="button" class="basket-remove" data-remove-line data-line-id="' +
        item.lineId +
        '">Remove</button>' +
        "</div>";

      listEl.appendChild(li);
    });

    if (totalEl) {
      totalEl.hidden = false;
    }

    updateBasketTotals();
    syncPostageOption();
    syncCardNote();
    syncCheckoutAvailability();
  }

  function hasFlowers(items) {
    return items.some(function (item) {
      var product = getProductConfig(item.productId);
      return product && !product.fixedPrice;
    });
  }

  function selectedCardNote() {
    var selected = root.querySelector("[data-basket-note-choice]:checked");
    return selected ? selected.value : "";
  }

  function syncCardNote() {
    var show = hasFlowers(loadBasket());
    if (noteField) noteField.hidden = !show;
    var wantsNote = show && selectedCardNote() === "yes";
    if (noteMessageWrap) noteMessageWrap.hidden = !wantsNote;
    if (noteMessageInput) noteMessageInput.required = wantsNote;
    if (
      checkoutError &&
      !checkoutError.hidden &&
      /note/i.test(checkoutError.textContent || "")
    ) {
      showCheckoutError("");
    }
    if (emailFallback && !emailFallback.hidden) {
      emailFallback.href = buildCheckoutMailto(loadBasket(), basketTotal(loadBasket()));
    }
  }

  function flowerNoteForOrder(items) {
    if (!hasFlowers(items)) return { cardNote: "", cardMessage: "" };
    var cardNote = selectedCardNote();
    var cardMessage =
      cardNote === "yes" && noteMessageInput ? noteMessageInput.value.replace(/\s+/g, " ").trim() : "";
    return { cardNote: cardNote, cardMessage: cardMessage.slice(0, 200) };
  }

  function addonPrice(product) {
    var pricing = window.GinStock && window.GinStock.pricing(product.id);
    return pricing ? pricing.pence / 100 : product.fixedPricePence / 100;
  }

  function cheapestCardPrice() {
    var cheapest = null;
    []
      .concat(window.GinOhhDeerCards || [])
      .concat(window.GinMandGProducts || [])
      .concat(window.GinPaperSalad || [])
      .concat(window.GinCustomProducts || [])
      .forEach(function (card) {
        if (card.group !== "cards") return;
        var pricing = window.GinStock && window.GinStock.pricing(card.id);
        var price = pricing ? pricing.pence / 100 : card.pricePence ? card.pricePence / 100 : Number(card.price);
        if (isFinite(price) && price > 0 && (cheapest === null || price < cheapest)) cheapest = price;
      });
    return cheapest;
  }

  function addonChoices(items) {
    var inBasket = {};
    items.forEach(function (item) {
      inBasket[item.productId] = true;
    });
    var chocolates = window.GinCambridgeConfectionery || [];
    return ADDON_PICKS.map(function (id) {
      return chocolates.filter(function (choc) {
        return choc.id === id && choc.image;
      })[0];
    })
      .filter(function (choc) {
        if (!choc || inBasket[choc.id] || !getProductConfig(choc.id)) return false;
        if (window.GinStock && !window.GinStock.allows(choc.id, 1)) return false;
        return true;
      })
      .slice(0, 3);
  }

  function renderAddons(items) {
    if (!addonsEl || !addonsList) return;
    var choices = hasFlowers(items) ? addonChoices(items) : [];
    if (!choices.length) {
      addonsEl.hidden = true;
      addonsList.innerHTML = "";
      return;
    }
    var cardFrom = cheapestCardPrice();
    addonsList.innerHTML =
      choices
        .map(function (choc) {
          var product = getProductConfig(choc.id);
          return (
            '<li class="basket-addon">' +
            '<img src="' +
            escapeHtml(choc.image) +
            '" alt="' +
            escapeHtml(choc.imageAlt || choc.name) +
            '" width="160" height="160" loading="lazy" decoding="async">' +
            '<p class="basket-addon-name">' +
            escapeHtml(choc.name) +
            "</p>" +
            '<p class="basket-addon-price">' +
            escapeHtml(formatMoney(addonPrice(product))) +
            "</p>" +
            '<button type="button" class="btn btn-ghost basket-addon-add" data-addon-add="' +
            escapeHtml(choc.id) +
            '">Add</button>' +
            "</li>"
          );
        })
        .join("") +
      '<li class="basket-addon basket-addon--card">' +
      '<span class="basket-addon-card-icon" aria-hidden="true">' +
      '<svg viewBox="0 0 48 48"><rect x="8" y="10" width="32" height="28" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 12l16 13 16-13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
      "</span>" +
      '<p class="basket-addon-name">Choose a card</p>' +
      (cardFrom ? '<p class="basket-addon-price">From ' + escapeHtml(formatMoney(cardFrom)) + "</p>" : "") +
      '<a class="btn btn-ghost basket-addon-add" href="cards.html">Browse cards</a>' +
      "</li>";
    addonsEl.hidden = false;
  }

  function addAddon(productId) {
    var product = getProductConfig(productId);
    if (!product) return;
    var items = loadBasket();
    if (window.GinStock && !window.GinStock.allows(productId, 1)) {
      announce("This is out of stock online.");
      return;
    }
    items.push({
      lineId: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 9),
      productId: productId,
      name: product.name,
      value: addonPrice(product),
      colour: "none",
      colourOther: "",
      quantity: 1,
      waterBubbleBag: false,
    });
    saveBasket(items, "add");
    renderBasket();
    announce(product.name + " added to your basket.");
  }

  if (addonsList) {
    addonsList.addEventListener("click", function (event) {
      var button = event.target.closest("[data-addon-add]");
      if (button) addAddon(button.getAttribute("data-addon-add"));
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildCheckoutMailto(items, total) {
    var lines = ["Online shop order from ginhouseflowers.co.uk", ""];
    items.forEach(function (item, index) {
      lines.push(
        index +
          1 +
          ". " +
          item.name +
          "\n   Value: " +
          formatMoney(item.value) +
          "\n   Quantity: " +
          item.quantity +
          (function () {
            var product = getProductConfig(item.productId);
            if (product && product.fixedPrice) return "";
            return "\n   Colour: " + colourLabel(item);
          })() +
          (item.waterBubbleBag ? "\n   Water bubble & bouquet bag: yes" : "") +
          "\n   Line total: " +
          formatMoney(lineItemTotal(item))
      );
    });
    lines.push("", "Basket total: " + formatMoney(total));
    if (hasFlowers(items)) {
      var note = flowerNoteForOrder(items);
      lines.push(
        "",
        note.cardNote === "yes" && note.cardMessage
          ? "Note with the flowers: " + note.cardMessage
          : note.cardNote === "no"
            ? "Note with the flowers: none"
            : "Note with the flowers: not chosen yet"
      );
    }
    lines.push("", "Please include delivery details and your contact information in your email.");

    return (
      "mailto:info@ginhouseflowers.co.uk?subject=" +
      encodeURIComponent("Online shop order") +
      "&body=" +
      encodeURIComponent(lines.join("\n"))
    );
  }

  function announce(message) {
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

  function addToBasket(data) {
    var product = getProductConfig(data.productId);
    if (!product) {
      announce("This product is unavailable. Please refresh the page.");
      return;
    }
    var items = loadBasket();
    items.push({
      lineId: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 9),
      productId: data.productId,
      name: product.name,
      value: data.value,
      colour: data.colour,
      colourOther: data.colourOther,
      quantity: data.quantity,
      waterBubbleBag: product.waterBubbleBagAddon && Boolean(data.waterBubbleBag),
    });
    saveBasket(items, "add");
    renderBasket();
    announce("Added to your basket.");
  }

  function startStripeCheckout() {
    var items = loadBasket();
    fetch("/api/shop-status", { cache: "no-store" })
      .then(function (response) {
        return response.ok ? response.json() : { open: true };
      })
      .then(function (data) {
        if (data && data.open === false) {
          showCheckoutError("Online ordering is coming soon. Please call us on 01223 656670.");
          return;
        }
        startStripeCheckoutNow();
      })
      .catch(function () {
        startStripeCheckoutNow();
      });
  }

  function startStripeCheckoutNow() {
    var items = loadBasket();
    if (items.length === 0) {
      announce("Your basket is empty.");
      showCheckoutError("Your basket is empty.");
      return;
    }

    var stockProblem = basketStockProblem(items);
    if (stockProblem) {
      announce(stockProblem);
      showCheckoutError(stockProblem);
      return;
    }

    var fulfilment = selectedFulfilment();
    var deliveryPostcode = deliveryPostcodeValue();

    if (fulfilment === "postage") {
      if (!isCardsAndGiftsOnly(items)) {
        announce("Delivery anywhere for £3.99 is only available when the basket is cards and gifts.");
        showCheckoutError("Delivery anywhere for £3.99 is only available when the basket is cards and gifts.");
        syncPostageOption();
        return;
      }
    }

    if (fulfilment === "collection") {
      collectionPrompt = true;
      if (!checkCollectionSchedule()) {
        showCheckoutError(collectionError ? collectionError.textContent : "Please choose a collection date and time.");
        if (collectionDateInput && !collectionDateInput.value) {
          collectionDateInput.focus();
        } else if (collectionTimeSelect) {
          collectionTimeSelect.focus();
        }
        return;
      }
    }

    if (fulfilment === "delivery") {
      if (!deliveryNameValue()) {
        announce("Please enter the recipient’s name.");
        showCheckoutError("Please enter the recipient’s name.");
        if (deliveryNameInput) deliveryNameInput.focus();
        return;
      }

      if (!deliveryPostcode) {
        showPostcodeError(
          deliveryAddressValue()
            ? "Please include the postcode, or choose the address from the suggestions."
            : "Please enter the delivery address."
        );
        if (deliveryPostcodeInput) deliveryPostcodeInput.focus();
        return;
      }

      if (!checkDeliveryDate()) {
        var deliveryDay = root.querySelector(".delivery-calendar-day:not(:disabled)");
        if (deliveryDay) deliveryDay.focus();
        else if (deliveryDateInput) deliveryDateInput.focus();
        return;
      }

      if (!deliveryPostcodeValid || deliveryPostcodeChecking) {
        announce("Please wait while we check the delivery address.");
        showCheckoutError("Please wait while we check the delivery address.");
        checkDeliveryPostcode().then(function (result) {
          if (result.ok && checkDeliveryDate()) {
            startStripeCheckout();
          }
        });
        return;
      }
    }

    var flowerNote = flowerNoteForOrder(items);
    if (hasFlowers(items)) {
      if (flowerNote.cardNote !== "yes" && flowerNote.cardNote !== "no") {
        showCheckoutError("Please say whether you would like a note with your flowers.");
        if (noteField) noteField.scrollIntoView({ block: "nearest" });
        return;
      }
      if (flowerNote.cardNote === "yes" && !flowerNote.cardMessage) {
        showCheckoutError("Please write the message for the note.");
        if (noteMessageInput) noteMessageInput.focus();
        return;
      }
    }

    showCheckoutError("");

    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.textContent = "Redirecting…";
    }
    announce("Opening secure checkout…");

    var deliveryDate =
      fulfilment === "delivery" && deliveryDateInput ? deliveryDateInput.value : "";
    var collectionDate =
      fulfilment === "collection" && collectionDateInput ? collectionDateInput.value : "";
    var collectionTime =
      fulfilment === "collection" && collectionTimeSelect ? collectionTimeSelect.value : "";

    fetch(checkoutApi, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items,
        fulfilment: fulfilment,
        deliveryPostcode: fulfilment === "delivery" ? deliveryPostcode : "",
        deliveryAddress: fulfilment === "delivery" ? deliveryAddressValue() : "",
        deliveryName: fulfilment === "delivery" ? deliveryNameValue() : "",
        deliveryDate: deliveryDate,
        collectionDate: collectionDate,
        collectionTime: collectionTime,
        cardNote: flowerNote.cardNote,
        cardMessage: flowerNote.cardMessage,
      }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data.url) {
          window.location.href = result.data.url;
          return;
        }
        throw new Error(
          (result.data && result.data.error) ||
            "Checkout is unavailable. Please try again or email your order."
        );
      })
      .catch(function (err) {
        var message = err.message || "Checkout failed. Please try again.";
        if (fulfilment === "delivery" && message.indexOf("10 miles") !== -1) {
          deliveryPostcodeValid = false;
          showPostcodeError(message);
        } else if (
          fulfilment === "delivery" &&
          (message.indexOf("Tuesday") !== -1 ||
            message.indexOf("delivery date") !== -1 ||
            message.indexOf("same day delivery") !== -1 ||
            message.indexOf("enquire about same day") !== -1)
        ) {
          deliveryDateValid = false;
          showDateError(message);
        } else if (
          fulfilment === "collection" &&
          (message.indexOf("collection") !== -1 ||
            message.indexOf("opening hours") !== -1 ||
            message.indexOf("closed") !== -1)
        ) {
          collectionDateValid = false;
          collectionTimeValid = false;
          showCollectionError(message);
        }
        announce("");
        showCheckoutError(message);
        syncCheckoutAvailability();
        if (checkoutBtn) {
          checkoutBtn.disabled = false;
          checkoutBtn.textContent = "Pay securely";
        }
      });
  }

  function showColourOtherError(colourOtherField, colourOtherError, message) {
    if (!colourOtherError) return;
    if (message) {
      colourOtherError.textContent = message;
      colourOtherError.hidden = false;
    } else {
      colourOtherError.textContent = "";
      colourOtherError.hidden = true;
    }
    if (colourOtherField) {
      colourOtherField.classList.toggle("basket-colour-other--invalid", Boolean(message));
    }
  }

  function validateColourOtherForForm(form) {
    var colourSelect = form.querySelector('[name="colour"]');
    var colourOtherInput = form.querySelector('[name="colourOther"]');
    var colourOtherField = form.querySelector("[data-colour-other-field]");
    var colourOtherError = form.querySelector("[data-colour-other-error]");

    if (!colourSelect || colourSelect.value !== "other") {
      showColourOtherError(colourOtherField, colourOtherError, "");
      return { ok: true, colourOther: "" };
    }
    if (!window.GinShopColour || !window.GinShopColour.validateColourOther) {
      return {
        ok: false,
        error: "Colour preference check is unavailable. Please refresh the page.",
      };
    }
    var result = window.GinShopColour.validateColourOther(
      "other",
      colourOtherInput ? colourOtherInput.value : ""
    );
    if (!result.ok) {
      showColourOtherError(colourOtherField, colourOtherError, result.error);
      return result;
    }
    showColourOtherError(colourOtherField, colourOtherError, "");
    if (colourOtherInput) {
      colourOtherInput.value = result.colourOther;
    }
    return result;
  }

  function bindProductForm(form) {
    var productId = form.getAttribute("data-product-id") || "florists-choice-bouquet";
    var colourSelect = form.querySelector('[name="colour"]');
    var colourOtherField = form.querySelector("[data-colour-other-field]");
    var colourOtherInput = form.querySelector('[name="colourOther"]');
    var colourOtherError = form.querySelector("[data-colour-other-error]");

    if (colourSelect && colourOtherField) {
      function toggleColourOther() {
        var show = colourSelect.value === "other";
        colourOtherField.hidden = !show;
        if (colourOtherInput) {
          colourOtherInput.required = show;
          if (!show) {
            colourOtherInput.value = "";
            showColourOtherError(colourOtherField, colourOtherError, "");
          }
        }
      }
      colourSelect.addEventListener("change", toggleColourOther);
      toggleColourOther();

      if (colourOtherInput) {
        colourOtherInput.addEventListener("blur", function () {
          validateColourOtherForForm(form);
        });
        colourOtherInput.addEventListener("input", function () {
          if (
            window.GinShopColour &&
            window.GinShopColour.colourOtherWordCount(colourOtherInput.value) <= 3
          ) {
            showColourOtherError(colourOtherField, colourOtherError, "");
          }
        });
      }
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var product = getProductConfig(productId);
      if (!product) {
        announce("This product is unavailable. Please refresh the page.");
        return;
      }

      var value = parseInt(form.elements.value.value, 10);
      var quantity = parseInt(form.elements.quantity.value, 10);
      var colour = form.elements.colour.value;
      var colourOther = form.elements.colourOther
        ? form.elements.colourOther.value.trim()
        : "";
      var waterBubbleBag = Boolean(
        form.elements.waterBubbleBag && form.elements.waterBubbleBag.checked
      );

      if (!isValidProductValue(productId, value)) {
        announce("Please choose a valid value for this product.");
        return;
      }
      if (!quantity || quantity < 1) {
        announce("Please enter a quantity of at least 1.");
        return;
      }
      var alreadyInBasket = loadBasket().reduce(function (sum, item) {
        return item.productId === productId ? sum + Number(item.quantity || 0) : sum;
      }, 0);
      if (window.GinStock && !window.GinStock.allows(productId, alreadyInBasket + quantity)) {
        var cap = stockCap(productId);
        announce(
          window.GinStock.deleted(productId)
            ? "This is not available online."
            : cap === 0
              ? "This is out of stock online."
              : "Only " + cap + " available online."
        );
        return;
      }
      if (colour === "other") {
        var colourCheck = validateColourOtherForForm(form);
        if (!colourCheck.ok) {
          announce(colourCheck.error);
          if (colourOtherInput) colourOtherInput.focus();
          return;
        }
        colourOther = colourCheck.colourOther;
      }

      addToBasket({
        productId: productId,
        value: value,
        colour: colour,
        colourOther: colourOther,
        quantity: quantity,
        waterBubbleBag: waterBubbleBag,
      });

      form.elements.quantity.value = "1";
      if (form.elements.waterBubbleBag) {
        form.elements.waterBubbleBag.checked = false;
      }
    });
  }

  root.querySelectorAll("[data-add-to-basket]").forEach(bindProductForm);

  if (listEl) {
    listEl.addEventListener("click", function (event) {
      var removeBtn = event.target.closest("[data-remove-line]");
      if (removeBtn) {
        var lineId = removeBtn.getAttribute("data-line-id");
        var items = loadBasket().filter(function (item) {
          return item.lineId !== lineId;
        });
        saveBasket(items);
        renderBasket();
        announce("Item removed from basket.");
        return;
      }
    });

    listEl.addEventListener("change", function (event) {
      var qtyInput = event.target.closest("[data-qty-input]");
      if (!qtyInput) return;
      var lineId = qtyInput.getAttribute("data-line-id");
      var qty = parseInt(qtyInput.value, 10);
      if (!qty || qty < 1) {
        qty = 1;
        qtyInput.value = "1";
      }
      var items = loadBasket().map(function (item) {
        if (item.lineId === lineId) {
          item.quantity = qty;
        }
        return item;
      });
      var changed = items.filter(function (item) {
        return item.lineId === lineId;
      })[0];
      if (changed && window.GinStock) {
        var others = items.reduce(function (sum, item) {
          if (item.productId !== changed.productId || item.lineId === lineId) return sum;
          return sum + Number(item.quantity || 0);
        }, 0);
        var cap = stockCap(changed.productId);
        if (cap != null && others + qty > cap) {
          qty = Math.max(1, cap - others);
          qtyInput.value = String(qty);
          changed.quantity = qty;
          announce("Only " + cap + " available online.");
        }
      }
      saveBasket(items);
      renderBasket();
    });
  }

  if (fulfilmentInputs.length) {
    fulfilmentInputs.forEach(function (input) {
      input.addEventListener("change", toggleFulfilmentDetails);
    });
    toggleFulfilmentDetails();
  }

  if (noteChoices.length) {
    noteChoices.forEach(function (input) {
      input.addEventListener("change", syncCardNote);
    });
  }
  if (noteMessageInput) {
    noteMessageInput.addEventListener("input", syncCardNote);
  }

  setupDeliveryDateInput();
  setupCollectionDateInput();

  if (collectionDateInput) {
    collectionDateInput.addEventListener("change", function () {
      collectionPrompt = true;
      populateCollectionTimes();
      if (collectionTimeSelect) collectionTimeSelect.value = "";
      checkCollectionSchedule();
      syncCheckoutAvailability();
    });
    collectionDateInput.addEventListener("blur", function () {
      checkCollectionSchedule();
      syncCheckoutAvailability();
    });
  }

  if (collectionTimeSelect) {
    collectionTimeSelect.addEventListener("change", function () {
      checkCollectionSchedule();
      syncCheckoutAvailability();
    });
  }

  if (deliveryDateInput) {
    deliveryDateInput.addEventListener("change", function () {
      checkDeliveryDate();
      syncCheckoutAvailability();
    });
    deliveryDateInput.addEventListener("blur", function () {
      checkDeliveryDate();
      syncCheckoutAvailability();
    });
  }

  if (deliveryNameInput) {
    deliveryNameInput.addEventListener("input", syncCheckoutAvailability);
  }

  if (deliveryPostcodeInput) {
    if (window.GinAddressSearch) {
      window.GinAddressSearch.attach(deliveryPostcodeInput, {
        onPick: function () {
          if (postcodeCheckTimer) clearTimeout(postcodeCheckTimer);
          checkDeliveryPostcode().then(function () {
            checkDeliveryDate();
            syncCheckoutAvailability();
          });
        },
      });
    }
    deliveryPostcodeInput.addEventListener("input", function () {
      deliveryPostcodeValid = false;
      lastCheckedPostcode = "";
      showPostcodeError("");
      syncCheckoutAvailability();
      if (deliveryPostcodeValue()) schedulePostcodeCheck();
    });
    deliveryPostcodeInput.addEventListener("blur", function () {
      if (postcodeCheckTimer) clearTimeout(postcodeCheckTimer);
      checkDeliveryPostcode().then(function () {
        checkDeliveryDate();
        syncCheckoutAvailability();
      });
    });
  }

  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", startStripeCheckout);
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      saveBasket([]);
      renderBasket();
      announce("Basket cleared.");
    });
  }

  window.addEventListener("ginhouse:basket", function () {
    renderBasket();
  });

  window.addEventListener("ginhouse:stock", function () {
    renderBasket();
  });

  renderBasket();
})();
