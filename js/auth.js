(function () {
  "use strict";

  const SUPABASE_URL = "https://dclvdusoprsffxaevfwn.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjbHZkdXNvcHJzZmZ4YWV2ZnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4Mzg5MzEsImV4cCI6MjA5NjQxNDkzMX0.njHty_59_jHqUvCpmEyup4WLFLwUMqdyWgj6LBHUp08";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const state = {
    user: null,
    profile: null,
    settings: {
      shop_name: "Infinity Liquor Shop",
      shop_address: "2975 Patterson Rd, Florissant, MO 63031",
      shop_phone: "(314) 555-0100",
      shop_email: "info@infinityliquor.com",
      shop_lat: 38.7895,
      shop_lng: -90.3227,
      delivery_radius_km: 10,
      cod_fee: 5,
      min_order_amount: 20,
      is_open: true
    }
  };

  function toast(message, type = "info") {
    const colors = {
      info: "linear-gradient(135deg, #1f2937, #111827)",
      success: "linear-gradient(135deg, #217a4b, #135c34)",
      error: "linear-gradient(135deg, #9b2c2c, #631818)",
      warning: "linear-gradient(135deg, #9a6b18, #5b3b09)"
    };

    if (window.Toastify) {
      window.Toastify({
        text: message,
        duration: 3400,
        gravity: "bottom",
        position: "right",
        stopOnFocus: true,
        style: { background: colors[type] || colors.info, borderRadius: "8px" }
      }).showToast();
      return;
    }

    console.log(message);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(Number(value || 0));
  }

  function setError(id, message) {
    const el = $("#" + id);
    if (!el) return;
    el.textContent = message || "";
    el.style.display = message ? "block" : "none";
  }

  function setSuccess(id, message) {
    const el = $("#" + id);
    if (!el) return;
    el.textContent = message || "";
    el.style.display = message ? "block" : "none";
  }

  function setLoading(button, loading) {
    if (!button) return;
    button.disabled = loading;
    const text = $(".btn-text", button);
    const loader = $(".btn-loader", button);
    if (text && loader) {
      text.style.display = loading ? "none" : "";
      loader.style.display = loading ? "" : "none";
    }
  }

  function calculateAge(dateString) {
    const dob = new Date(dateString);
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1;
    return age;
  }

  async function loadSettings() {
    const { data, error } = await client
      .from("shop_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      state.settings = { ...state.settings, ...data };
    }

    window.dispatchEvent(new CustomEvent("infinity:settings-loaded", { detail: state.settings }));
  }

  async function loadProfile() {
    if (!state.user) {
      state.profile = null;
      return null;
    }

    const { data, error } = await client
      .from("profiles")
      .select("*")
      .eq("id", state.user.id)
      .maybeSingle();

    if (error) {
      toast("Could not load your profile: " + error.message, "warning");
      return null;
    }

    state.profile = data;
    return data;
  }

  function initials(nameOrEmail) {
    const raw = (nameOrEmail || "Customer").trim();
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return raw.slice(0, 2).toUpperCase();
  }

  function updateAuthUI() {
    const loggedIn = Boolean(state.user);
    const authButtons = $("#auth-buttons");
    const mobileAuthButtons = $("#mobile-auth-buttons");
    const userMenu = $("#user-menu");
    const displayName = $("#user-display-name");
    const avatar = $("#user-avatar-initials");

    if (authButtons) authButtons.style.display = loggedIn ? "none" : "";
    if (mobileAuthButtons) mobileAuthButtons.style.display = loggedIn ? "none" : "";
    if (userMenu) userMenu.classList.toggle("user-menu--hidden", !loggedIn);

    if (loggedIn) {
      const name = state.profile?.full_name || state.user.email || "Customer";
      if (displayName) displayName.textContent = name.split(" ")[0];
      if (avatar) avatar.textContent = initials(name);
    }

    window.dispatchEvent(new CustomEvent("infinity:auth-changed", {
      detail: { user: state.user, profile: state.profile }
    }));
  }

  function openAuth(mode = "login") {
    $("#auth-overlay")?.classList.remove("modal-overlay--hidden");
    $("#auth-modal")?.classList.remove("modal--hidden");
    document.body.classList.add("modal-open");
    switchAuthTab(mode);
  }

  function closeAuth() {
    $("#auth-overlay")?.classList.add("modal-overlay--hidden");
    $("#auth-modal")?.classList.add("modal--hidden");
    document.body.classList.remove("modal-open");
  }

  function switchAuthTab(mode) {
    $$(".auth-tab").forEach((tab) => {
      tab.classList.toggle("auth-tab--active", tab.dataset.tab === mode);
    });

    $$(".auth-form").forEach((form) => form.classList.remove("auth-form--active"));
    $("#form-" + mode)?.classList.add("auth-form--active");
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError("login-error", "");
    const button = $("#login-submit");
    setLoading(button, true);

    const email = $("#login-email")?.value.trim();
    const password = $("#login-password")?.value;

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    setLoading(button, false);

    if (error) {
      setError("login-error", error.message);
      return;
    }

    state.user = data.user;
    await loadProfile();
    updateAuthUI();
    closeAuth();
    toast("Signed in successfully.", "success");
  }

  async function handleSignup(event) {
    event.preventDefault();
    setError("signup-error", "");
    const button = $("#signup-submit");
    setLoading(button, true);

    const fullName = $("#signup-name")?.value.trim();
    const phone = $("#signup-phone")?.value.trim();
    const email = $("#signup-email")?.value.trim();
    const dateOfBirth = $("#signup-dob")?.value;
    const password = $("#signup-password")?.value;
    const acceptedTerms = $("#signup-terms")?.checked;

    if (!acceptedTerms) {
      setLoading(button, false);
      setError("signup-error", "You must accept the terms and confirm you are 21 or older.");
      return;
    }

    if (calculateAge(dateOfBirth) < 21) {
      setLoading(button, false);
      setError("signup-error", "You must be 21 or older to create an account.");
      return;
    }

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          date_of_birth: dateOfBirth
        }
      }
    });

    if (error) {
      setLoading(button, false);
      setError("signup-error", error.message);
      return;
    }

    state.user = data.user;
    await loadProfile();

    if (state.user) {
      await client
        .from("profiles")
        .update({ full_name: fullName, phone, date_of_birth: dateOfBirth, age_verified: true })
        .eq("id", state.user.id);
      await loadProfile();
    }

    setLoading(button, false);
    updateAuthUI();
    closeAuth();
    toast("Account created. You can place orders now.", "success");
  }

  async function handleForgot(event) {
    event.preventDefault();
    setError("forgot-error", "");
    setSuccess("forgot-success", "");
    const email = $("#forgot-email")?.value.trim();
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });

    if (error) {
      setError("forgot-error", error.message);
      return;
    }

    setSuccess("forgot-success", "Password reset email sent.");
  }

  async function logout() {
    await client.auth.signOut();
    state.user = null;
    state.profile = null;
    updateAuthUI();
    toast("Signed out.", "success");
  }

  async function initSession() {
    const { data } = await client.auth.getSession();
    state.user = data.session?.user || null;
    if (state.user) await loadProfile();
    updateAuthUI();

    client.auth.onAuthStateChange(async (_event, session) => {
      state.user = session?.user || null;
      if (state.user) await loadProfile();
      else state.profile = null;
      updateAuthUI();
    });
  }

  function initAuthEvents() {
    $("#login-btn")?.addEventListener("click", () => openAuth("login"));
    $("#signup-btn")?.addEventListener("click", () => openAuth("signup"));
    $("#mobile-login-btn")?.addEventListener("click", () => openAuth("login"));
    $("#mobile-signup-btn")?.addEventListener("click", () => openAuth("signup"));
    $("#footer-login")?.addEventListener("click", (event) => {
      event.preventDefault();
      openAuth("login");
    });
    $("#footer-signup")?.addEventListener("click", (event) => {
      event.preventDefault();
      openAuth("signup");
    });

    $("#auth-modal-close")?.addEventListener("click", closeAuth);
    $("#auth-overlay")?.addEventListener("click", closeAuth);
    $("#login-form")?.addEventListener("submit", handleLogin);
    $("#signup-form")?.addEventListener("submit", handleSignup);
    $("#forgot-form")?.addEventListener("submit", handleForgot);
    $("#logout-btn")?.addEventListener("click", logout);

    $$(".auth-tab").forEach((tab) => {
      tab.addEventListener("click", () => switchAuthTab(tab.dataset.tab));
    });

    $$(".auth-switch-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        switchAuthTab(button.dataset.target);
      });
    });

    $("#forgot-password-link")?.addEventListener("click", (event) => {
      event.preventDefault();
      switchAuthTab("forgot");
    });

    $$(".form-eye-toggle").forEach((button) => {
      button.addEventListener("click", () => {
        const input = $("#" + button.dataset.target);
        if (!input) return;
        input.type = input.type === "password" ? "text" : "password";
      });
    });

    $("#signup-password")?.addEventListener("input", (event) => {
      const value = event.target.value;
      const score = Math.min(100, value.length * 10 + (/[A-Z]/.test(value) ? 15 : 0) + (/\d/.test(value) ? 15 : 0));
      const fill = $("#password-strength-fill");
      const text = $("#password-strength-text");
      if (fill) {
        fill.style.width = score + "%";
        fill.style.background = score >= 75 ? "var(--ok)" : score >= 45 ? "var(--warn)" : "var(--danger)";
      }
      if (text) text.textContent = value ? (score >= 75 ? "Strong password" : score >= 45 ? "Medium password" : "Weak password") : "";
    });

    $("#user-menu-trigger")?.addEventListener("click", () => {
      $("#user-dropdown")?.classList.toggle("is-open");
    });
  }

  window.Infinity = {
    supabase: client,
    state,
    $,
    $$,
    toast,
    formatCurrency,
    openAuth,
    closeAuth,
    loadProfile,
    loadSettings,
    updateAuthUI,
    calculateAge
  };

  document.addEventListener("DOMContentLoaded", async () => {
    initAuthEvents();
    await loadSettings();
    await initSession();
  });
})();
