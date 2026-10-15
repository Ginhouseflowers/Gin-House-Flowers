/**
 * Browser-side collection scheduling (shop opening hours).
 */
(function (global) {
  var OPENING_MINUTES = {
    0: null,
    1: null,
    2: { open: 10 * 60 + 30, close: 17 * 60 },
    3: { open: 9 * 60 + 30, close: 17 * 60 },
    4: { open: 9 * 60 + 30, close: 17 * 60 },
    5: { open: 9 * 60 + 30, close: 17 * 60 },
    6: { open: 9 * 60, close: 13 * 60 },
  };

  var SLOT_INTERVAL_MINS = 30;
  var LATE_ORDER_FROM_MINS = 17 * 60;
  var LATE_ORDER_UNTIL_MINS = 9 * 60;
  var LATE_ORDER_EARLIEST_MINS = 10 * 60 + 30;
  var SAME_DAY_LEAD_MINS = 120;
  var OPENING_HOURS_LABEL =
    "Tuesday 10:30am–5pm, Wednesday–Friday 9:30am–5pm, Saturday 9am–1pm";

  function parseIsoDate(dateStr) {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return null;
    }
    var parts = dateStr.split("-").map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (
      date.getFullYear() !== parts[0] ||
      date.getMonth() !== parts[1] - 1 ||
      date.getDate() !== parts[2]
    ) {
      return null;
    }
    return date;
  }

  function formatIsoDate(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function formatTimeValue(totalMinutes) {
    var h = Math.floor(totalMinutes / 60);
    var m = totalMinutes % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  function formatTimeLabel(totalMinutes) {
    var h = Math.floor(totalMinutes / 60);
    var m = totalMinutes % 60;
    var hour12 = h % 12 === 0 ? 12 : h % 12;
    var ampm = h < 12 ? "am" : "pm";
    if (m === 0) {
      return hour12 + ampm;
    }
    return hour12 + ":" + String(m).padStart(2, "0") + ampm;
  }

  function nowInShop() {
    try {
      var parts = {};
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date())
        .forEach(function (part) {
          parts[part.type] = Number(part.value);
        });
      return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    } catch (e) {
      return new Date();
    }
  }

  function startOfToday() {
    var today = nowInShop();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  function isOpenDay(date) {
    var closed = global.GinClosedDates || [];
    return Boolean(OPENING_MINUTES[date.getDay()]) && closed.indexOf(formatIsoDate(date)) === -1;
  }

  /** Orders placed from 5pm until the next morning can't be collected before 10:30am on the next open day. */
  function lateOrderCollectionDay() {
    var now = nowInShop();
    var nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes < LATE_ORDER_FROM_MINS && nowMinutes >= LATE_ORDER_UNTIL_MINS) {
      return null;
    }
    var day = startOfToday();
    if (nowMinutes >= LATE_ORDER_FROM_MINS) day.setDate(day.getDate() + 1);
    for (var i = 0; i < 21; i += 1) {
      if (isOpenDay(day)) return day.getTime();
      day.setDate(day.getDate() + 1);
    }
    return null;
  }

  function getSlotsForDateString(dateStr) {
    var date = parseIsoDate(dateStr);
    if (!date) {
      return [];
    }

    var hours = OPENING_MINUTES[date.getDay()];
    var closed = global.GinClosedDates || [];
    if (!hours || closed.indexOf(dateStr) !== -1) {
      return [];
    }

    var slots = [];
    var today = startOfToday();
    var isToday = date.getTime() === today.getTime();
    var now = nowInShop();
    var nowMinutes = now.getHours() * 60 + now.getMinutes();
    var isLateOrderDay = date.getTime() === lateOrderCollectionDay();

    for (
      var mins = hours.open;
      mins + SLOT_INTERVAL_MINS <= hours.close;
      mins += SLOT_INTERVAL_MINS
    ) {
      if (isToday && mins < nowMinutes + SAME_DAY_LEAD_MINS) {
        continue;
      }
      if (isLateOrderDay && mins < LATE_ORDER_EARLIEST_MINS) {
        continue;
      }
      slots.push({
        value: formatTimeValue(mins),
        label: formatTimeLabel(mins),
      });
    }

    return slots;
  }

  function getEarliestCollectionDate() {
    var date = startOfToday();
    for (var i = 0; i < 21; i += 1) {
      var check = new Date(date);
      check.setDate(date.getDate() + i);
      if (getSlotsForDateString(formatIsoDate(check)).length > 0) {
        return formatIsoDate(check);
      }
    }
    return formatIsoDate(date);
  }

  function validateCollectionDateTime(dateStr, timeStr) {
    var date = parseIsoDate(dateStr);
    if (!date) {
      return { ok: false, error: "Please choose a collection date." };
    }

    var today = startOfToday();
    if (date < today) {
      return { ok: false, error: "Collection date cannot be in the past." };
    }

    if (!OPENING_MINUTES[date.getDay()]) {
      return {
        ok: false,
        error:
          "The shop is closed on Sundays and Mondays. Collection is available " +
          OPENING_HOURS_LABEL +
          ".",
      };
    }

    if ((global.GinClosedDates || []).indexOf(dateStr) !== -1) {
      return {
        ok: false,
        error: "The shop is closed for collection on that date. Please choose another day.",
      };
    }

    if (!timeStr) {
      return { ok: false, error: "Please choose a collection time." };
    }

    var slots = getSlotsForDateString(dateStr);
    var valid = slots.some(function (slot) {
      return slot.value === timeStr;
    });

    if (!valid) {
      if (date.getTime() === lateOrderCollectionDay() && timeStr < "10:30") {
        return {
          ok: false,
          error: "Orders placed after 5pm can be collected from 10:30am on the next day we are open.",
        };
      }
      return {
        ok: false,
        error:
          "Please choose a collection time within our opening hours (Tue 10:30am–5pm, Wed–Fri 9:30am–5pm, Sat 9am–1pm).",
      };
    }

    return { ok: true, date: dateStr, time: timeStr };
  }

  global.GinCollectionSchedule = {
    OPENING_HOURS_LABEL: OPENING_HOURS_LABEL,
    getEarliestCollectionDate: getEarliestCollectionDate,
    getSlotsForDate: getSlotsForDateString,
    validateCollectionDateTime: validateCollectionDateTime,
  };
})(typeof window !== "undefined" ? window : global);
