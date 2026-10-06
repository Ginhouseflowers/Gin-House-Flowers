(function () {
  var apiUrl = "/api/contact-enquiry";

  function formatValue(field) {
    if (field.type === "date" && field.value) {
      var parts = field.value.split("-");
      var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return date.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    return field.value.trim();
  }

  function buildMessage(form) {
    var lines = [];
    form.querySelectorAll("[data-enquiry-label]").forEach(function (field) {
      var value = formatValue(field);
      if (value) lines.push(field.getAttribute("data-enquiry-label") + ": " + value);
    });
    var message = form.elements.message ? form.elements.message.value.trim() : "";
    if (lines.length && message) return lines.join("\n") + "\n\n" + message;
    return lines.length ? lines.join("\n") : message;
  }

  document.querySelectorAll("[data-contact-form]").forEach(function (form) {
    var statusEl = form.querySelector("[data-contact-status]");
    var submitBtn = form.querySelector("[type=submit]");
    var submitLabel = submitBtn ? submitBtn.textContent : "";

    function setStatus(message, type) {
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.hidden = !message;
      statusEl.classList.remove(
        "contact-form-status--success",
        "contact-form-status--error"
      );
      if (type === "success") {
        statusEl.classList.add("contact-form-status--success");
      } else if (type === "error") {
        statusEl.classList.add("contact-form-status--error");
      }
    }

    function setSubmitting(busy) {
      if (submitBtn) {
        submitBtn.disabled = busy;
        submitBtn.textContent = busy ? "Sending…" : submitLabel;
      }
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      setStatus("", "");

      var payload = {
        name: form.elements.name.value,
        email: form.elements.email.value,
        topic: form.elements.topic.value,
        message: buildMessage(form),
        website: form.elements.website ? form.elements.website.value : "",
      };

      setSubmitting(true);

      fetch(apiUrl, {
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
          if (result.ok) {
            form.reset();
            setStatus(
              result.data.message ||
                "Thank you — your enquiry has been sent. We will get back to you soon.",
              "success"
            );
            return;
          }
          setStatus(
            (result.data && result.data.error) ||
              "Unable to send your enquiry. Please try again or email info@ginhouseflowers.co.uk.",
            "error"
          );
        })
        .catch(function () {
          setStatus(
            "Unable to send your enquiry. Please check your connection or email info@ginhouseflowers.co.uk.",
            "error"
          );
        })
        .finally(function () {
          setSubmitting(false);
        });
    });
  });
})();
