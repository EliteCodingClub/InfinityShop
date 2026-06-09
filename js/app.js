(function () {
  "use strict";

  const InfinityApp = window.Infinity || {};
  window.Infinity = InfinityApp;
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

    $("#back-to-top")?.addEventListener("click", () => {
      if (window.lenis) {
        window.lenis.scrollTo(0);
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
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
    // 1. Initialize Lenis for Smooth Scrolling
    if (window.Lenis) {
      const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        direction: 'vertical',
        gestureDirection: 'vertical',
        smooth: true,
        mouseMultiplier: 1,
        smoothTouch: false,
        touchMultiplier: 2,
        infinite: false,
      });

      window.lenis = lenis;

      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    }

    // 2. Initialize GSAP and ScrollTrigger
    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      
      // Update ScrollTrigger on Lenis scroll
      if (window.lenis) {
        window.lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => {
          window.lenis.raf(time * 1000);
        });
        gsap.ticker.lagSmoothing(0);
      }

      // Parallax Hero
      gsap.to(".hero__bg", {
        yPercent: 30,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: true
        }
      });

      // Reveal Animations (Replacing AOS)
      const revealElements = document.querySelectorAll('[data-aos]');
      revealElements.forEach((el) => {
        const animation = el.getAttribute('data-aos');
        const delay = (el.getAttribute('data-aos-delay') || 0) / 1000;
        
        let fromVars = { opacity: 0 };
        if (animation === 'fade-up') fromVars.y = 50;
        if (animation === 'fade-down') fromVars.y = -50;
        if (animation === 'fade-left') fromVars.x = 50;
        if (animation === 'fade-right') fromVars.x = -50;

        gsap.from(el, {
          ...fromVars,
          duration: 1,
          delay: delay,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            toggleActions: "play none none none"
          }
        });
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
