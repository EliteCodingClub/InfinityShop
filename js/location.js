(function () {
  "use strict";

  const InfinityApp = window.Infinity;
  const { $, toast } = InfinityApp;

  function toRad(value) {
    return (Number(value) * Math.PI) / 180;
  }

  function distanceKm(lat1, lng1, lat2, lng2) {
    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  function getShopCenter() {
    const settings = InfinityApp.state.settings;
    return {
      lat: Number(settings.shop_lat || 38.7895),
      lng: Number(settings.shop_lng || -90.3227),
      radius: Number(settings.delivery_radius_km || 10)
    };
  }

  function checkCoordinates(lat, lng) {
    const shop = getShopCenter();
    const distance = distanceKm(shop.lat, shop.lng, Number(lat), Number(lng));
    return {
      distance,
      radius: shop.radius,
      eligible: distance <= shop.radius
    };
  }

  function showBanner(message, type = "info") {
    const banner = $("#location-banner");
    const text = $("#location-banner-text");
    if (!banner || !text) return;
    text.innerHTML = message;
    banner.classList.remove("location-banner--hidden", "is-ok", "is-warn", "is-danger");
    if (type !== "info") banner.classList.add("is-" + type);
  }

  function hideBanner() {
    $("#location-banner")?.classList.add("location-banner--hidden");
  }

  function fillLocationInputs(lat, lng) {
    const latInput = $("#delivery-lat");
    const lngInput = $("#delivery-lng");
    if (latInput) latInput.value = Number(lat).toFixed(6);
    if (lngInput) lngInput.value = Number(lng).toFixed(6);
  }

  function renderRadiusResult(result) {
    const box = $("#radius-check-result");
    const nextButton = $("#to-payment-btn");
    if (!box) return;

    box.style.display = "block";
    box.classList.remove("is-ok", "is-danger", "is-warn");

    if (result.eligible) {
      box.classList.add("is-ok");
      box.textContent = `Delivery available. This address is ${result.distance.toFixed(2)} km from the store.`;
      if (nextButton) nextButton.disabled = false;
    } else {
      box.classList.add("is-danger");
      box.textContent = `Outside delivery radius. This address is ${result.distance.toFixed(2)} km away; limit is ${result.radius} km.`;
      if (nextButton) nextButton.disabled = true;
    }
  }

  function validateDeliveryForm() {
    const required = ["delivery-street", "delivery-city", "delivery-state", "delivery-zip", "delivery-lat", "delivery-lng"];
    for (const id of required) {
      const el = $("#" + id);
      if (!el || !el.value.trim()) {
        el?.focus();
        toast("Please complete the delivery address and coordinates.", "warning");
        return false;
      }
    }
    return true;
  }

  function checkDeliveryFormRadius() {
    if (!validateDeliveryForm()) return null;
    const lat = $("#delivery-lat").value;
    const lng = $("#delivery-lng").value;
    const result = checkCoordinates(lat, lng);
    renderRadiusResult(result);
    return result;
  }

  function detectLocation() {
    if (!navigator.geolocation) {
      toast("Your browser does not support location detection.", "warning");
      return;
    }

    const button = $("#detect-location-btn");
    if (button) {
      button.disabled = true;
      button.textContent = "Detecting...";
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        fillLocationInputs(latitude, longitude);
        const result = checkCoordinates(latitude, longitude);
        renderRadiusResult(result);
        showBanner(
          result.eligible
            ? `You appear to be within <strong>${result.radius}km</strong> of Infinity Liquor Shop.`
            : `Your current location appears outside our <strong>${result.radius}km</strong> delivery radius.`,
          result.eligible ? "ok" : "danger"
        );
        if (button) {
          button.disabled = false;
          button.textContent = "Detect";
        }
      },
      () => {
        toast("Location permission was denied. You can type latitude and longitude manually.", "warning");
        if (button) {
          button.disabled = false;
          button.textContent = "Detect";
        }
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }
    );
  }

  function initLocation() {
    $("#location-banner-close")?.addEventListener("click", hideBanner);
    $("#detect-location-btn")?.addEventListener("click", detectLocation);
    $("#check-radius-btn")?.addEventListener("click", checkDeliveryFormRadius);

    window.addEventListener("infinity:settings-loaded", () => {
      const settings = InfinityApp.state.settings;
      showBanner(
        `Orders are delivered within <strong>${settings.delivery_radius_km || 10}km</strong> of ${settings.shop_address}.`,
        "warn"
      );
      window.setTimeout(hideBanner, 7000);
    });
  }

  InfinityApp.location = {
    distanceKm,
    checkCoordinates,
    checkDeliveryFormRadius,
    detectLocation,
    getShopCenter
  };

  document.addEventListener("DOMContentLoaded", initLocation);
})();
