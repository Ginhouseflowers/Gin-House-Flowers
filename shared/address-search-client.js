/**
 * Address suggestions as the customer types, limited to the delivery area.
 * Uses Photon (https://photon.komoot.io), a free OpenStreetMap search.
 * The 10-mile check still runs on the postcode via shared/delivery-radius-client.js.
 */
(function (global) {
  var ENDPOINT = "https://photon.komoot.io/api/";
  var SHOP = { lat: 52.252278, lon: 0.105793 };
  var AREA_BBOX = "-0.14,52.10,0.35,52.40";
  var MIN_CHARS = 3;
  var POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/gi;

  function extractPostcode(text) {
    var matches = String(text || "").toUpperCase().match(POSTCODE_RE);
    if (!matches) return "";
    var last = matches[matches.length - 1].replace(/\s+/g, "");
    return last.slice(0, -3) + " " + last.slice(-3);
  }

  function formatFeature(props) {
    var first = [props.housenumber, props.street].filter(Boolean).join(" ");
    var place = props.locality || props.district || props.city || "";
    var parts = [];
    if (props.name && props.name !== props.street) parts.push(props.name);
    if (first) parts.push(first);
    else if (props.street) parts.push(props.street);
    if (place && parts.join(" ").indexOf(place) === -1) parts.push(place);
    if (props.postcode) parts.push(props.postcode.toUpperCase());
    return parts.join(", ");
  }

  function search(term, signal) {
    var url =
      ENDPOINT +
      "?q=" +
      encodeURIComponent(term) +
      "&limit=6&lang=en&lat=" +
      SHOP.lat +
      "&lon=" +
      SHOP.lon +
      "&bbox=" +
      AREA_BBOX +
      "&layer=house&layer=street";
    return fetch(url, { signal: signal })
      .then(function (response) {
        if (!response.ok) throw new Error("Address search failed");
        return response.json();
      })
      .then(function (data) {
        var seen = {};
        return (data.features || [])
          .map(function (feature) {
            var props = feature.properties || {};
            if (props.countrycode && props.countrycode !== "GB") return null;
            var label = formatFeature(props);
            if (!label || seen[label]) return null;
            seen[label] = true;
            return { label: label, hasPostcode: Boolean(props.postcode), hasNumber: Boolean(props.housenumber) };
          })
          .filter(Boolean);
      });
  }

  function attach(input, options) {
    var onPick = (options && options.onPick) || function () {};
    var wrap = document.createElement("div");
    wrap.className = "address-field";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    var listId = input.id + "-suggestions";
    var list = document.createElement("ul");
    list.className = "address-suggest";
    list.id = listId;
    list.setAttribute("role", "listbox");
    list.hidden = true;
    wrap.appendChild(list);

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", listId);

    var results = [];
    var active = -1;
    var timer = null;
    var controller = null;

    function close() {
      list.hidden = true;
      list.innerHTML = "";
      results = [];
      active = -1;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }

    function highlight(index) {
      active = index;
      Array.prototype.forEach.call(list.querySelectorAll("[role=option]"), function (el, i) {
        el.setAttribute("aria-selected", i === index ? "true" : "false");
      });
      if (index >= 0) input.setAttribute("aria-activedescendant", listId + "-" + index);
      else input.removeAttribute("aria-activedescendant");
    }

    function pick(index) {
      var result = results[index];
      if (!result) return;
      input.value = result.label;
      close();
      onPick(result);
      if (!result.hasNumber) {
        input.focus();
        input.setSelectionRange(0, 0);
      }
    }

    function render() {
      if (!results.length) {
        close();
        return;
      }
      list.innerHTML =
        results
          .map(function (result, i) {
            var safe = result.label
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");
            return (
              '<li role="option" id="' +
              listId +
              "-" +
              i +
              '" aria-selected="false" data-index="' +
              i +
              '">' +
              safe +
              "</li>"
            );
          })
          .join("") +
        '<li class="address-suggest-credit" aria-hidden="true">Address search © OpenStreetMap contributors</li>';
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      active = -1;
    }

    input.addEventListener("input", function () {
      var term = input.value.trim();
      if (timer) clearTimeout(timer);
      if (term.length < MIN_CHARS) {
        close();
        return;
      }
      timer = setTimeout(function () {
        if (controller) controller.abort();
        controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        search(term, controller ? controller.signal : undefined)
          .then(function (found) {
            if (input.value.trim() !== term) return;
            results = found;
            render();
          })
          .catch(function () {});
      }, 250);
    });

    input.addEventListener("keydown", function (event) {
      if (list.hidden || !results.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        highlight((active + 1) % results.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        highlight(active <= 0 ? results.length - 1 : active - 1);
      } else if (event.key === "Enter" && active >= 0) {
        event.preventDefault();
        pick(active);
      } else if (event.key === "Escape") {
        close();
      }
    });

    list.addEventListener("mousedown", function (event) {
      var option = event.target.closest("[role=option]");
      if (!option) return;
      event.preventDefault();
      pick(Number(option.getAttribute("data-index")));
    });

    input.addEventListener("blur", function () {
      setTimeout(close, 150);
    });
  }

  global.GinAddressSearch = {
    attach: attach,
    extractPostcode: extractPostcode,
  };
})(typeof window !== "undefined" ? window : this);
