(function () {
  "use strict";

  const InfinityApp = window.Infinity;
  const { $, toast } = InfinityApp;

  const paymentState = {
    method: "cod"
  };

  function supportsApplePay() {
    return Boolean(window.ApplePaySession && window.ApplePaySession.canMakePayments && window.ApplePaySession.canMakePayments());
  }

  function getSelectedMethod() {
    const checked = document.querySelector('input[name="payment"]:checked');
    return checked?.value || "cod";
  }

  function setMethod(method) {
    paymentState.method = method;
  }

  function initPayment() {
    const appleInput = document.querySelector('input[name="payment"][value="apple_pay"]');
    const appleLabel = $("#payment-apple");

    if (appleInput && !supportsApplePay()) {
      appleLabel?.classList.add("is-disabled");
      appleLabel?.addEventListener("click", (event) => {
        event.preventDefault();
        document.querySelector('input[name="payment"][value="cod"]').checked = true;
        setMethod("cod");
        toast("Apple Pay requires Apple Pay capable Safari plus Stripe/merchant setup. COD is available now.", "warning");
      });
    }

    document.querySelectorAll('input[name="payment"]').forEach((input) => {
      input.addEventListener("change", () => setMethod(getSelectedMethod()));
    });
  }

  async function authorizePayment(amount) {
    const method = getSelectedMethod();
    setMethod(method);

    if (method === "cod") {
      return {
        ok: true,
        method: "cod",
        status: "pending",
        codFee: Number(InfinityApp.state.settings.cod_fee || 5)
      };
    }

    if (method === "apple_pay") {
      toast("Apple Pay needs a server-side Stripe PaymentIntent before it can charge real customers.", "warning");
      return {
        ok: false,
        method: "apple_pay",
        message: "Apple Pay is not configured yet. Please choose Cash on Delivery."
      };
    }

    return {
      ok: false,
      method,
      message: "Unsupported payment method."
    };
  }

  InfinityApp.payment = {
    state: paymentState,
    supportsApplePay,
    getSelectedMethod,
    authorizePayment
  };

  document.addEventListener("DOMContentLoaded", initPayment);
})();
