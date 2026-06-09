(function () {
  "use strict";

  const InfinityApp = window.Infinity;
  const { $, supabase, toast, formatCurrency } = InfinityApp;

  const checkout = {
    step: 1,
    deliveryEligible: false,
    lastRadiusResult: null
  };

  function openCheckout() {
    const cart = InfinityApp.products.getCart();
    if (!cart.length) {
      toast("Add at least one product before checkout.", "warning");
      return;
    }

    if (!InfinityApp.state.user) {
      toast("Please sign in before placing an order.", "warning");
      InfinityApp.openAuth("login");
      return;
    }

    if (!InfinityApp.state.settings.is_open) {
      toast("The store is currently closed. Please check our business hours.", "error");
      return;
    }

    const min = Number(InfinityApp.state.settings.min_order_amount || 20);
    if (InfinityApp.products.cartSubtotal() < min) {
      toast("Minimum order amount is " + formatCurrency(min) + ".", "warning");
      return;
    }

    prefillDelivery();
    InfinityApp.products.closeCart();
    $("#checkout-overlay")?.classList.remove("modal-overlay--hidden");
    $("#checkout-modal")?.classList.remove("modal--hidden");
    document.body.classList.add("modal-open");
    setStep(1);
  }

  function closeCheckout() {
    $("#checkout-overlay")?.classList.add("modal-overlay--hidden");
    $("#checkout-modal")?.classList.add("modal--hidden");
    document.body.classList.remove("modal-open");
  }

  function setStep(step) {
    checkout.step = step;
    document.querySelectorAll(".checkout-step").forEach((el) => {
      el.classList.toggle("checkout-step--active", Number(el.dataset.step) === step);
    });
    document.querySelectorAll(".checkout-pane").forEach((el) => el.classList.remove("checkout-pane--active"));
    $("#checkout-step-" + step)?.classList.add("checkout-pane--active");

    if (step === 2) renderCheckoutSummary();
    if (step === 3) renderOrderReview();
  }

  function getDeliveryPayload() {
    return {
      street: $("#delivery-street")?.value.trim(),
      city: $("#delivery-city")?.value.trim(),
      state: $("#delivery-state")?.value.trim().toUpperCase(),
      zip: $("#delivery-zip")?.value.trim(),
      lat: Number($("#delivery-lat")?.value),
      lng: Number($("#delivery-lng")?.value),
      notes: $("#delivery-notes")?.value.trim()
    };
  }

  function validateDelivery() {
    const delivery = getDeliveryPayload();
    if (!delivery.street || !delivery.city || !delivery.state || !delivery.zip || !delivery.lat || !delivery.lng) {
      toast("Complete the delivery form and check the delivery radius.", "warning");
      return false;
    }

    const result = InfinityApp.location.checkCoordinates(delivery.lat, delivery.lng);
    checkout.lastRadiusResult = result;
    checkout.deliveryEligible = result.eligible;

    const box = $("#radius-check-result");
    if (box) {
      box.style.display = "block";
      box.classList.toggle("is-ok", result.eligible);
      box.classList.toggle("is-danger", !result.eligible);
      box.textContent = result.eligible
        ? `Delivery available. This address is ${result.distance.toFixed(2)} km from the store.`
        : `Outside delivery radius. This address is ${result.distance.toFixed(2)} km away; limit is ${result.radius} km.`;
    }

    if (!result.eligible) {
      toast("This address is outside the delivery radius.", "error");
      return false;
    }

    return true;
  }

  function prefillDelivery() {
    const profile = InfinityApp.state.profile;
    if (!profile) return;
    if ($("#delivery-street") && profile.street_address) $("#delivery-street").value = profile.street_address;
    if ($("#delivery-city") && profile.city) $("#delivery-city").value = profile.city;
    if ($("#delivery-state") && profile.state) $("#delivery-state").value = profile.state;
    if ($("#delivery-zip") && profile.zip_code) $("#delivery-zip").value = profile.zip_code;
    if ($("#delivery-lat") && profile.latitude) $("#delivery-lat").value = profile.latitude;
    if ($("#delivery-lng") && profile.longitude) $("#delivery-lng").value = profile.longitude;
  }

  function totals() {
    const subtotal = InfinityApp.products.cartSubtotal();
    const method = InfinityApp.payment.getSelectedMethod();
    const codFee = method === "cod" ? Number(InfinityApp.state.settings.cod_fee || 5) : 0;
    return {
      subtotal,
      codFee,
      total: subtotal + codFee,
      method
    };
  }

  function renderCheckoutSummary() {
    const t = totals();
    const el = $("#checkout-order-summary");
    if (!el) return;
    el.innerHTML = `
      <div class="summary-row"><span>Items</span><strong>${InfinityApp.products.cartCount()}</strong></div>
      <div class="summary-row"><span>Subtotal</span><strong>${formatCurrency(t.subtotal)}</strong></div>
      <div class="summary-row"><span>COD Fee</span><strong>${formatCurrency(t.codFee)}</strong></div>
      <div class="summary-row"><span>Total</span><strong>${formatCurrency(t.total)}</strong></div>
    `;
  }

  function renderOrderReview() {
    const t = totals();
    const delivery = getDeliveryPayload();
    const items = InfinityApp.products.getCart().map((item) => {
      const product = InfinityApp.products.cartItemProduct(item);
      return `<div class="review-row"><span>${item.quantity} x ${escapeHtml(product.name)}</span><strong>${formatCurrency(Number(product.price) * item.quantity)}</strong></div>`;
    }).join("");

    const el = $("#order-review");
    if (!el) return;
    el.innerHTML = `
      <h4>Items</h4>
      ${items}
      <h4>Delivery</h4>
      <div class="review-row"><span>Address</span><strong>${escapeHtml(delivery.street)}, ${escapeHtml(delivery.city)}, ${escapeHtml(delivery.state)} ${escapeHtml(delivery.zip)}</strong></div>
      <div class="review-row"><span>Distance</span><strong>${checkout.lastRadiusResult ? checkout.lastRadiusResult.distance.toFixed(2) + " km" : "Checked"}</strong></div>
      <h4>Payment</h4>
      <div class="review-row"><span>Method</span><strong>${t.method === "cod" ? "Cash on Delivery" : "Apple Pay"}</strong></div>
      <div class="review-row"><span>Subtotal</span><strong>${formatCurrency(t.subtotal)}</strong></div>
      <div class="review-row"><span>COD Fee</span><strong>${formatCurrency(t.codFee)}</strong></div>
      <div class="review-row"><span>Total</span><strong>${formatCurrency(t.total)}</strong></div>
    `;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function saveDeliveryToProfile(delivery) {
    if (!InfinityApp.state.user) return;
    await supabase
      .from("profiles")
      .update({
        street_address: delivery.street,
        city: delivery.city,
        state: delivery.state,
        zip_code: delivery.zip,
        latitude: delivery.lat,
        longitude: delivery.lng
      })
      .eq("id", InfinityApp.state.user.id);
  }

  async function placeOrder() {
    const button = $("#place-order-btn");
    const text = $(".btn-text", button);
    const loader = $(".btn-loader", button);
    const errorBox = $("#checkout-error");

    if (errorBox) errorBox.style.display = "none";
    if (button) button.disabled = true;
    if (text) text.style.display = "none";
    if (loader) loader.style.display = "";

    try {
      if (!validateDelivery()) throw new Error("Delivery address is not eligible.");

      const cart = InfinityApp.products.getCart();
      const t = totals();
      const delivery = getDeliveryPayload();
      const payment = await InfinityApp.payment.authorizePayment(t.total);
      if (!payment.ok) throw new Error(payment.message || "Payment failed.");

      const orderPayload = {
        user_id: InfinityApp.state.user.id,
        delivery_address: delivery.street,
        delivery_city: delivery.city,
        delivery_state: delivery.state,
        delivery_zip: delivery.zip,
        delivery_lat: delivery.lat,
        delivery_lng: delivery.lng,
        delivery_notes: delivery.notes || null,
        subtotal: t.subtotal,
        cod_fee: t.codFee,
        total: t.total,
        payment_method: t.method,
        payment_status: t.method === "cod" ? "pending" : "paid",
        status: "pending"
      };

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert(orderPayload)
        .select("*")
        .single();

      if (orderError) throw orderError;

      const itemRows = cart.map((item) => {
        const product = InfinityApp.products.cartItemProduct(item);
        return {
          order_id: order.id,
          product_id: product.id,
          product_name: product.name,
          product_image: product.image_url || null,
          unit_price: Number(product.price),
          quantity: item.quantity,
          line_total: Number(product.price) * item.quantity
        };
      });

      const { error: itemError } = await supabase.from("order_items").insert(itemRows);
      if (itemError) throw itemError;

      await saveDeliveryToProfile(delivery);
      await InfinityApp.loadProfile();
      InfinityApp.products.clearCart();
      await InfinityApp.products.loadProducts();
      InfinityApp.products.renderProducts();
      closeCheckout();
      showSuccess(order.order_number);
    } catch (error) {
      if (errorBox) {
        errorBox.textContent = error.message || "Could not place order.";
        errorBox.style.display = "block";
      }
      toast(error.message || "Could not place order.", "error");
    } finally {
      if (button) button.disabled = false;
      if (text) text.style.display = "";
      if (loader) loader.style.display = "none";
    }
  }

  function showSuccess(orderNumber) {
    $("#success-order-number") && ($("#success-order-number").textContent = orderNumber);
    $("#order-success-overlay")?.classList.remove("modal-overlay--hidden");
    $("#order-success-modal")?.classList.remove("modal--hidden");
    document.body.classList.add("modal-open");
  }

  function closeSuccess() {
    $("#order-success-overlay")?.classList.add("modal-overlay--hidden");
    $("#order-success-modal")?.classList.add("modal--hidden");
    document.body.classList.remove("modal-open");
  }

  async function openOrders() {
    if (!InfinityApp.state.user) {
      InfinityApp.openAuth("login");
      return;
    }

    $("#orders-overlay")?.classList.remove("modal-overlay--hidden");
    $("#orders-modal")?.classList.remove("modal--hidden");
    document.body.classList.add("modal-open");
    await loadOrders();
  }

  function closeOrders() {
    $("#orders-overlay")?.classList.add("modal-overlay--hidden");
    $("#orders-modal")?.classList.add("modal--hidden");
    document.body.classList.remove("modal-open");
  }

  async function loadOrders() {
    const list = $("#orders-list");
    if (list) list.innerHTML = '<div class="orders-loading">Loading your orders...</div>';

    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });

    if (error) {
      if (list) list.innerHTML = `<div class="form-error">Could not load orders: ${escapeHtml(error.message)}</div>`;
      return;
    }

    if (!data?.length) {
      if (list) list.innerHTML = '<div class="orders-loading">No orders yet.</div>';
      return;
    }

    if (list) {
      list.innerHTML = data.map((order) => `
        <article class="order-card">
          <div class="order-card__head">
            <div>
              <strong>${escapeHtml(order.order_number)}</strong>
              <div class="product-card__meta">${new Date(order.created_at).toLocaleString()}</div>
            </div>
            <span class="status-pill">${escapeHtml(order.status)}</span>
          </div>
          ${(order.order_items || []).map((item) => `
            <div class="order-row"><span>${item.quantity} x ${escapeHtml(item.product_name)}</span><strong>${formatCurrency(item.line_total)}</strong></div>
          `).join("")}
          <div class="order-row"><span>Total</span><strong>${formatCurrency(order.total)}</strong></div>
          <div class="order-row"><span>Payment</span><strong>${order.payment_method === "cod" ? "COD" : "Online"} / ${escapeHtml(order.payment_status)}</strong></div>
        </article>
      `).join("");
    }
  }

  function initOrderEvents() {
    $("#checkout-btn")?.addEventListener("click", openCheckout);
    $("#checkout-modal-close")?.addEventListener("click", closeCheckout);
    $("#checkout-overlay")?.addEventListener("click", closeCheckout);
    $("#to-payment-btn")?.addEventListener("click", () => {
      if (validateDelivery()) setStep(2);
    });
    $("#back-to-delivery-btn")?.addEventListener("click", () => setStep(1));
    $("#to-confirm-btn")?.addEventListener("click", () => setStep(3));
    $("#back-to-payment-btn")?.addEventListener("click", () => setStep(2));
    $("#place-order-btn")?.addEventListener("click", placeOrder);

    document.querySelectorAll('input[name="payment"]').forEach((input) => {
      input.addEventListener("change", renderCheckoutSummary);
    });

    $("#my-orders-link")?.addEventListener("click", (event) => {
      event.preventDefault();
      openOrders();
    });
    $("#footer-orders")?.addEventListener("click", (event) => {
      event.preventDefault();
      openOrders();
    });
    $("#orders-modal-close")?.addEventListener("click", closeOrders);
    $("#orders-overlay")?.addEventListener("click", closeOrders);
    $("#view-orders-btn")?.addEventListener("click", async () => {
      closeSuccess();
      await openOrders();
    });
    $("#continue-shopping-btn")?.addEventListener("click", closeSuccess);
    $("#order-success-overlay")?.addEventListener("click", closeSuccess);
  }

  InfinityApp.orders = {
    openCheckout,
    closeCheckout,
    openOrders,
    loadOrders,
    totals
  };

  document.addEventListener("DOMContentLoaded", initOrderEvents);
})();
