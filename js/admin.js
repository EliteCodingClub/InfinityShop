(function () {
  "use strict";

  const SUPABASE_URL = "https://dclvdusoprsffxaevfwn.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjbHZkdXNvcHJzZmZ4YWV2ZnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4Mzg5MzEsImV4cCI6MjA5NjQxNDkzMX0.njHty_59_jHqUvCpmEyup4WLFLwUMqdyWgj6LBHUp08";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const state = {
    user: null,
    profile: null,
    orders: [],
    products: [],
    categories: [],
    settings: null
  };

  const statusFlow = ["accepted", "preparing", "dispatched", "delivered"];
  const statusTimestamps = {
    accepted: "accepted_at",
    preparing: "preparing_at",
    dispatched: "dispatched_at",
    delivered: "delivered_at",
    cancelled: "cancelled_at"
  };

  function money(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showAlert(message, type = "info") {
    const el = $("#admin-alert");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    el.classList.toggle("alert--error", type === "error");
    window.setTimeout(() => {
      el.hidden = true;
      el.classList.remove("alert--error");
    }, 4200);
  }

  function setLoginError(message) {
    const el = $("#admin-login-error");
    if (!el) return;
    el.textContent = message || "";
    el.hidden = !message;
  }

  async function requireAdmin() {
    const { data: sessionData } = await db.auth.getSession();
    state.user = sessionData.session?.user || null;

    if (!state.user) {
      showLogin();
      return false;
    }

    const { data, error } = await db
      .from("profiles")
      .select("*")
      .eq("id", state.user.id)
      .maybeSingle();

    if (error || !data?.is_admin) {
      await db.auth.signOut();
      showLogin();
      setLoginError("This account is not authorized for admin access.");
      return false;
    }

    state.profile = data;
    showApp();
    return true;
  }

  function showLogin() {
    $("#admin-login").hidden = false;
    $("#admin-app").hidden = true;
  }

  function showApp() {
    $("#admin-login").hidden = true;
    $("#admin-app").hidden = false;
    $("#admin-user-line").textContent = state.user.email;
  }

  async function login(event) {
    event.preventDefault();
    setLoginError("");
    const email = $("#admin-email").value.trim();
    const password = $("#admin-password").value;
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
      setLoginError(error.message);
      return;
    }

    if (await requireAdmin()) await refreshAll();
  }

  async function logout() {
    await db.auth.signOut();
    showLogin();
  }

  async function refreshAll() {
    await Promise.all([loadCategories(), loadProducts(), loadOrders(), loadSettings()]);
    renderDashboard();
    renderOrders();
    renderProducts();
    renderCategoryOptions();
    renderSettings();
  }

  async function loadCategories() {
    const { data, error } = await db.from("categories").select("*").order("sort_order");
    if (error) throw error;
    state.categories = data || [];
  }

  async function loadProducts() {
    const { data, error } = await db
      .from("products")
      .select("*, categories(name, slug)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    state.products = data || [];
  }

  async function loadOrders() {
    const { data, error } = await db
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    state.orders = data || [];
  }

  async function loadSettings() {
    const { data, error } = await db.from("shop_settings").select("*").limit(1).maybeSingle();
    if (error) throw error;
    state.settings = data;
  }

  function renderDashboard() {
    const today = new Date().toDateString();
    const pending = state.orders.filter((order) => order.status === "pending").length;
    const todayRevenue = state.orders
      .filter((order) => new Date(order.created_at).toDateString() === today && order.status !== "cancelled")
      .reduce((sum, order) => sum + Number(order.total || 0), 0);
    const lowStock = state.products.filter((product) => product.is_active && Number(product.stock) <= 5).length;
    const activeProducts = state.products.filter((product) => product.is_active).length;

    $("#metric-pending").textContent = pending;
    $("#metric-today").textContent = money(todayRevenue);
    $("#metric-low-stock").textContent = lowStock;
    $("#metric-products").textContent = activeProducts;

    $("#latest-orders").innerHTML = orderTable(state.orders.slice(0, 6), false);
  }

  function orderTable(orders, includeActions = true) {
    if (!orders.length) return "<p>No orders found.</p>";
    return `
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Items</th>
            <th>Delivery</th>
            <th>Total</th>
            <th>Status</th>
            ${includeActions ? "<th>Actions</th>" : ""}
          </tr>
        </thead>
        <tbody>
          ${orders.map((order) => `
            <tr>
              <td><strong>${escapeHtml(order.order_number)}</strong><br>${new Date(order.created_at).toLocaleString()}<br>${escapeHtml(order.payment_method)} / ${escapeHtml(order.payment_status)}</td>
              <td>${(order.order_items || []).map((item) => `${item.quantity} x ${escapeHtml(item.product_name)}`).join("<br>")}</td>
              <td>${escapeHtml(order.delivery_address)}<br>${escapeHtml(order.delivery_city)}, ${escapeHtml(order.delivery_state)} ${escapeHtml(order.delivery_zip)}${order.delivery_notes ? "<br>" + escapeHtml(order.delivery_notes) : ""}</td>
              <td><strong>${money(order.total)}</strong></td>
              <td><span class="status-pill">${escapeHtml(order.status)}</span></td>
              ${includeActions ? `<td><div class="actions">${orderActions(order)}</div></td>` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function orderActions(order) {
    if (order.status === "cancelled" || order.status === "delivered") return "";
    const next = statusFlow.find((status) => statusFlow.indexOf(status) > statusFlow.indexOf(order.status));
    const normalizedNext = order.status === "pending" ? "accepted" : next;
    return `
      ${normalizedNext ? `<button class="tiny-btn" data-order-status="${order.id}:${normalizedNext}">Mark ${normalizedNext}</button>` : ""}
      <button class="tiny-btn danger-btn" data-order-status="${order.id}:cancelled">Cancel</button>
    `;
  }

  function renderOrders() {
    const filter = $("#order-status-filter")?.value || "all";
    const orders = filter === "all" ? state.orders : state.orders.filter((order) => order.status === filter);
    $("#orders-table").innerHTML = orderTable(orders, true);
  }

  function renderProducts() {
    const rows = state.products.map((product) => `
      <tr>
        <td><strong>${escapeHtml(product.name)}</strong><br>${escapeHtml(product.brand || "")}</td>
        <td>${escapeHtml(product.categories?.name || "Uncategorized")}</td>
        <td>${money(product.price)}</td>
        <td>${product.stock}</td>
        <td>${product.is_active ? "Active" : "Hidden"}${product.is_featured ? "<br>Featured" : ""}</td>
        <td>
          <div class="actions">
            <button class="tiny-btn" data-edit-product="${product.id}">Edit</button>
            <button class="tiny-btn" data-stock-product="${product.id}:1">+1</button>
            <button class="tiny-btn" data-stock-product="${product.id}:-1">-1</button>
            <button class="tiny-btn danger-btn" data-hide-product="${product.id}">${product.is_active ? "Hide" : "Show"}</button>
          </div>
        </td>
      </tr>
    `).join("");

    $("#products-table").innerHTML = `
      <table>
        <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>State</th><th>Actions</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6">No products yet.</td></tr>'}</tbody>
      </table>
    `;
  }

  function renderCategoryOptions() {
    const select = $("#product-category");
    if (!select) return;
    select.innerHTML = state.categories.map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join("");
  }

  function renderSettings() {
    const settings = state.settings;
    if (!settings) return;
    $("#setting-shop-name").value = settings.shop_name || "";
    $("#setting-phone").value = settings.shop_phone || "";
    $("#setting-email").value = settings.shop_email || "";
    $("#setting-address").value = settings.shop_address || "";
    $("#setting-lat").value = settings.shop_lat || "";
    $("#setting-lng").value = settings.shop_lng || "";
    $("#setting-radius").value = settings.delivery_radius_km || "";
    $("#setting-cod").value = settings.cod_fee || "";
    $("#setting-open").value = String(Boolean(settings.is_open));
  }

  async function updateOrderStatus(orderId, status) {
    const payload = { status };
    const timestamp = statusTimestamps[status];
    if (timestamp) payload[timestamp] = new Date().toISOString();
    if (status === "cancelled") payload.cancel_reason = "Cancelled by admin";

    const { error } = await db.from("orders").update(payload).eq("id", orderId);
    if (error) {
      showAlert(error.message, "error");
      return;
    }

    showAlert("Order updated.");
    await refreshAll();
  }

  async function uploadProductImage(file) {
    if (!file) return null;
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
    const path = `products/${crypto.randomUUID()}-${safeName}`;
    const { error } = await db.storage.from("product-images").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data } = db.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function saveProduct(event) {
    event.preventDefault();
    const file = $("#product-image").files[0];
    let imageUrl = $("#product-image-url").value.trim();
    if (file) imageUrl = await uploadProductImage(file);

    const payload = {
      name: $("#product-name").value.trim(),
      category_id: $("#product-category").value,
      description: $("#product-description").value.trim() || null,
      brand: $("#product-brand").value.trim() || null,
      volume_ml: $("#product-volume").value ? Number($("#product-volume").value) : null,
      price: Number($("#product-price").value),
      stock: Number($("#product-stock").value),
      abv: $("#product-abv").value ? Number($("#product-abv").value) : null,
      image_url: imageUrl || null,
      is_featured: $("#product-featured").value === "true",
      is_active: true
    };

    const id = $("#product-id").value;
    const result = id
      ? await db.from("products").update(payload).eq("id", id)
      : await db.from("products").insert(payload);

    if (result.error) {
      showAlert(result.error.message, "error");
      return;
    }

    resetProductForm();
    showAlert("Product saved.");
    await refreshAll();
  }

  function editProduct(productId) {
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;
    $("#product-id").value = product.id;
    $("#product-name").value = product.name || "";
    $("#product-category").value = product.category_id || "";
    $("#product-description").value = product.description || "";
    $("#product-brand").value = product.brand || "";
    $("#product-volume").value = product.volume_ml || "";
    $("#product-price").value = product.price || "";
    $("#product-stock").value = product.stock || "";
    $("#product-abv").value = product.abv || "";
    $("#product-featured").value = String(Boolean(product.is_featured));
    $("#product-image-url").value = product.image_url || "";
    document.querySelector('[data-view="products"]').click();
  }

  function resetProductForm() {
    $("#product-form").reset();
    $("#product-id").value = "";
  }

  async function changeStock(productId, delta) {
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;
    const nextStock = Math.max(0, Number(product.stock) + Number(delta));
    const { error } = await db.from("products").update({ stock: nextStock }).eq("id", productId);
    if (error) showAlert(error.message, "error");
    else await refreshAll();
  }

  async function toggleProduct(productId) {
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;
    const { error } = await db.from("products").update({ is_active: !product.is_active }).eq("id", productId);
    if (error) showAlert(error.message, "error");
    else await refreshAll();
  }

  async function saveSettings(event) {
    event.preventDefault();
    if (!state.settings) return;
    const payload = {
      shop_name: $("#setting-shop-name").value.trim(),
      shop_phone: $("#setting-phone").value.trim(),
      shop_email: $("#setting-email").value.trim(),
      shop_address: $("#setting-address").value.trim(),
      shop_lat: Number($("#setting-lat").value),
      shop_lng: Number($("#setting-lng").value),
      delivery_radius_km: Number($("#setting-radius").value),
      cod_fee: Number($("#setting-cod").value),
      is_open: $("#setting-open").value === "true"
    };

    const { error } = await db.from("shop_settings").update(payload).eq("id", state.settings.id);
    if (error) {
      showAlert(error.message, "error");
      return;
    }
    showAlert("Settings saved.");
    await refreshAll();
  }

  function switchView(view) {
    $$(".nav-btn").forEach((button) => button.classList.toggle("nav-btn--active", button.dataset.view === view));
    $$(".view").forEach((panel) => panel.classList.remove("view--active"));
    $("#view-" + view).classList.add("view--active");
    $("#view-title").textContent = view.slice(0, 1).toUpperCase() + view.slice(1);
  }

  function initEvents() {
    $("#admin-login-form").addEventListener("submit", login);
    $("#admin-logout").addEventListener("click", logout);
    $("#refresh-admin").addEventListener("click", refreshAll);
    $("#order-status-filter").addEventListener("change", renderOrders);
    $("#product-form").addEventListener("submit", saveProduct);
    $("#reset-product-form").addEventListener("click", resetProductForm);
    $("#settings-form").addEventListener("submit", saveSettings);

    $$(".nav-btn").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });

    document.addEventListener("click", (event) => {
      const statusButton = event.target.closest("[data-order-status]");
      const editButton = event.target.closest("[data-edit-product]");
      const stockButton = event.target.closest("[data-stock-product]");
      const hideButton = event.target.closest("[data-hide-product]");

      if (statusButton) {
        const [orderId, status] = statusButton.dataset.orderStatus.split(":");
        updateOrderStatus(orderId, status);
      }

      if (editButton) editProduct(editButton.dataset.editProduct);

      if (stockButton) {
        const [productId, delta] = stockButton.dataset.stockProduct.split(":");
        changeStock(productId, Number(delta));
      }

      if (hideButton) toggleProduct(hideButton.dataset.hideProduct);
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    initEvents();
    try {
      if (await requireAdmin()) await refreshAll();
    } catch (error) {
      showAlert(error.message, "error");
    }
  });
})();
