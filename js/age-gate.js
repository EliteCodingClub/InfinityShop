(function () {
  "use strict";

  const AGE_KEY = "infinity_age_verified";

  function isVerified() {
    try {
      return window.localStorage.getItem(AGE_KEY) === "yes";
    } catch (_error) {
      return false;
    }
  }

  function rememberVerified() {
    try {
      window.localStorage.setItem(AGE_KEY, "yes");
    } catch (_error) {
      // Storage can be blocked in some browser modes. Enter anyway after the click.
    }
  }

  function hideGate(gate) {
    gate.style.display = "none";
    document.body.classList.remove("modal-open");
  }

  function initAgeGate() {
    const gate = document.querySelector("#age-gate");
    if (!gate) return;

    if (isVerified()) {
      hideGate(gate);
      return;
    }

    document.body.classList.add("modal-open");

    document.querySelector("#age-gate-yes")?.addEventListener("click", () => {
      rememberVerified();
      hideGate(gate);
    });

    document.querySelector("#age-gate-no")?.addEventListener("click", () => {
      window.location.href = "https://www.responsibility.org/";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAgeGate, { once: true });
  } else {
    initAgeGate();
  }
})();
