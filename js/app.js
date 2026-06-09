(function () {
  "use strict";

  const InfinityApp = window.Infinity;
  const { $, $$, toast } = InfinityApp;

  const AGE_KEY = "infinity_age_verified";

  function initAgeGate() {
    const gate = $("#age-gate");
    if (!gate) return;

    const verified = localStorage.getItem(AGE_KEY) === "yes";
    if (verified) {
      gate.style.display = "none";
      return;
    }

    document.body.classList.add("modal-open");
    $("#age-gate-yes")?.addEventListener("click", () => {
      localStorage.setItem(AGE_KEY, "yes");
      gate.style.display = "none";
      document.body.classList.remove("modal-open");
    });

    $("#age-gate-no")?.addEventListener("click", () => {
      window.location.href = "https://www.responsibility.org/";
    });
  }

  function initNavigation() {
    $("#mobile-menu-toggle")?.addEventListener("click", () => {
      const nav = $("#mobile-nav");
      const button = $("#mobile-menu-toggle");
      const closed = nav?.classList.toggle("mobile-nav--closed");
      button?.setAttribute("aria-expanded", String(!closed));
    });

    $$(".mobile-nav__link").forEach((link) => {
      link.addEventListener("click", () => $("#mobile-nav")?.classList.add("mobile-nav--closed"));
    });

    $("#search-toggle")?.addEventListener("click", () => {
      const bar = $("#search-bar");
      const hidden = bar?.classList.toggle("search-bar--hidden");
      if (!hidden) $("#search-input")?.focus();
    });

    window.addEventListener("scroll", () => {
      const nav = $("#navbar");
      const topButton = $("#back-to-top");
      if (nav) nav.classList.toggle("navbar--scrolled", window.scrollY > 12);
      if (topButton) topButton.classList.toggle("back-to-top--hidden", window.scrollY < 500);
    }, { passive: true });

    $("#back-to-top")?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function initContactForm() {
    $("#contact-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = $("#contact-name")?.value.trim();
      const email = $("#contact-email")?.value.trim();
      const message = $("#contact-message")?.value.trim();

      if (!name || !email || !message) {
        toast("Please complete the contact form.", "warning");
        return;
      }

      event.target.reset();
      toast("Message received. The store team can connect this to email later.", "success");
    });
  }

  function initLibraries() {
    if (window.AOS) {
      window.AOS.init({
        duration: 700,
        once: true,
        offset: 80
      });
    }

    if (window.gsap) {
      window.gsap.from(".navbar", { y: -20, opacity: 0, duration: 0.55, ease: "power2.out" });
      window.gsap.from(".hero__title-line", {
        y: 28,
        opacity: 0,
        duration: 0.75,
        stagger: 0.12,
        ease: "power3.out",
        delay: 0.15
      });
    }
  }

  function initKeyboard() {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      InfinityApp.closeAuth();
      InfinityApp.products?.closeCart();
      $("#quickview-overlay")?.classList.add("modal-overlay--hidden");
      $("#quickview-modal")?.classList.add("modal--hidden");
    });
  }

  function initRealtimeRefresh() {
    window.addEventListener("infinity:auth-changed", (event) => {
      if (!event.detail.user) return;

      const channel = InfinityApp.supabase
        .channel("customer-order-updates")
        .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${event.detail.user.id}`
        }, (payload) => {
          toast(`Order ${payload.new.order_number} is now ${payload.new.status}.`, "info");
        })
        .subscribe();

      window.addEventListener("beforeunload", () => InfinityApp.supabase.removeChannel(channel), { once: true });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initAgeGate();
    initNavigation();
    initContactForm();
    initLibraries();
    initKeyboard();
    initRealtimeRefresh();
  });
})();
