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

  function startOfToday() {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  function getSlotsForDateString(dateStr) {
    var date = parseIsoDate(dateStr);
    if (!date) {
      return [];
    }

    var hours = OPENING_MINUTES[date.getDay()];
    if (!hours) {
      return [];
    }

    var slots = [];
    var today = startOfToday();
    var isToday = date.getTime() === today.getTime();
    var now = new Date();
    var nowMinutes = now.getHours() * 60 + now.getMinutes();

    for (
      var mins = hours.open;
      mins + SLOT_INTERVAL_MINS <= hours.close;
      mins += SLOT_INTERVAL_MINS
    ) {
      if (isToday && mins <= nowMinutes) {
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
    for (var i = 0; i < 14; i += 1) {
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

    if (!timeStr) {
      return { ok: false, error: "Please choose a collection time." };
    }

    var slots = getSlotsForDateString(dateStr);
    var valid = slots.some(function (slot) {
      return slot.value === timeStr;
    });

    if (!valid) {
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
