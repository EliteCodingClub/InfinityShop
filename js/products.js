(function () {
  "use strict";

  const InfinityApp = window.Infinity;
  const { $, $$, supabase, toast, formatCurrency } = InfinityApp;

  const productState = {
    categories: [],
    products: [],
    filtered: [],
    activeCategory: "all",
    search: "",
    sort: "featured",
    visibleCount: 12,
    cart: []
  };

  const CART_KEY = "infinity_cart_v1";

  function productImage(product) {
    if (product.image_url) return product.image_url;
    const label = encodeURIComponent(product.name || "Infinity Liquor");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#17130d"/><stop offset="1" stop-color="#5f4b1d"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><rect x="285" y="105" width="230" height="380" rx="42" fill="rgba(255,255,255,.08)" stroke="#e8c96d" stroke-width="4"/><rect x="335" y="48" width="130" height="78" rx="16" fill="rgba(255,255,255,.1)" stroke="#c9a84c" stroke-width="3"/><text x="400" y="330" text-anchor="middle" font-family="Georgia,serif" font-size="44" fill="#f6f0e5">Infinity</text><text x="400" y="375" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#e8c96d">${label}</text></svg>`;
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  }

  function cartFromStorage() {
    try {
      productState.cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    } catch (_error) {
      productState.cart = [];
    }
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(productState.cart));
  }

  function cartItemProduct(item) {
    return productState.products.find((product) => product.id === item.productId) || item.product;
  }

  function cartSubtotal() {
    return productState.cart.reduce((sum, item) => {
      const product = cartItemProduct(item);
      return sum + Number(product?.price || 0) * item.quantity;
    }, 0);
  }

  function cartCount() {
    return productState.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  function updateCartUI() {
    const count = cartCount();
    const badge = $("#cart-count");
    if (badge) {
      badge.textContent = String(count);
      badge.classList.add("is-bumping");
      window.setTimeout(() => badge.classList.remove("is-bumping"), 430);
    }

    const itemsEl = $("#cart-items");
    const emptyEl = $("#cart-empty");
    const footer = $("#cart-footer");
    const subtotal = cartSubtotal();
    const total = subtotal;

    $("#cart-subtotal") && ($("#cart-subtotal").textContent = formatCurrency(subtotal));
    $("#cart-total") && ($("#cart-total").textContent = formatCurrency(total));
    $("#cod-fee-row") && ($("#cod-fee-row").style.display = "none");

    if (!itemsEl) return;

    if (!productState.cart.length) {
      if (emptyEl) emptyEl.style.display = "";
      if (footer) footer.classList.add("cart-sidebar__footer--hidden");
      $$(".cart-item", itemsEl).forEach((node) => node.remove());
      return;
    }

    if (emptyEl) emptyEl.style.display = "none";
    if (footer) footer.classList.remove("cart-sidebar__footer--hidden");

    $$(".cart-item", itemsEl).forEach((node) => node.remove());
    const html = productState.cart.map((item) => {
      const product = cartItemProduct(item);
      return `
        <div class="cart-item" data-id="${item.productId}">
          <img class="cart-item__img" src="${productImage(product)}" alt="${escapeHtml(product?.name || "Product")}">
          <div>
            <h3 class="cart-item__title">${escapeHtml(product?.name || "Product")}</h3>
            <p class="cart-item__meta">${formatCurrency(product?.price)} each</p>
            <div class="qty-control" aria-label="Quantity controls">
              <button type="button" data-cart-dec="${item.productId}">-</button>
              <span>${item.quantity}</span>
              <button type="button" data-cart-inc="${item.productId}">+</button>
            </div>
          </div>
          <button class="cart-item__remove" type="button" data-cart-remove="${item.productId}">Remove</button>
        </div>
      `;
    }).join("");

    itemsEl.insertAdjacentHTML("beforeend", html);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function stockLabel(product) {
    if (Number(product.stock) <= 0) return "Out of stock";
    if (Number(product.stock) <= 5) return `${product.stock} left`;
    return `${product.stock} in stock`;
  }

  async function loadCategories() {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    productState.categories = data || [];
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("*, categories(name, slug, icon)")
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    productState.products = data || [];
  }

  function renderCategories() {
    const grid = $("#categories-grid");
    const filters = $(".products__filters");
    if (!grid || !filters) return;

    const counts = new Map();
    productState.products.forEach((product) => {
      const slug = product.categories?.slug || "other";
      counts.set(slug, (counts.get(slug) || 0) + 1);
    });

    grid.innerHTML = productState.categories.map((category) => `
      <button class="category-card" type="button" data-category="${category.slug}">
        <span class="category-card__icon">${category.icon || "Bottle"}</span>
        <span class="category-card__name">${escapeHtml(category.name)}</span>
        <span class="category-card__count">${counts.get(category.slug) || 0} products</span>
      </button>
    `).join("");

    filters.innerHTML = `
      <button class="filter-btn filter-btn--active" data-category="all">All</button>
      ${productState.categories.map((category) => `
        <button class="filter-btn" data-category="${category.slug}">${escapeHtml(category.name)}</button>
      `).join("")}
    `;
  }

  function applyFilters() {
    let products = [...productState.products];

    if (productState.activeCategory !== "all") {
      products = products.filter((product) => product.categories?.slug === productState.activeCategory);
    }

    if (productState.search) {
      const query = productState.search.toLowerCase();
      products = products.filter((product) => {
        return [product.name, product.brand, product.description, product.categories?.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      });
    }

    products.sort((a, b) => {
      if (productState.sort === "price-low") return Number(a.price) - Number(b.price);
      if (productState.sort === "price-high") return Number(b.price) - Number(a.price);
      if (productState.sort === "name") return String(a.name).localeCompare(String(b.name));
      if (productState.sort === "newest") return new Date(b.created_at) - new Date(a.created_at);
      return Number(b.is_featured) - Number(a.is_featured);
    });

    productState.filtered = products;
  }

  function renderProducts() {
    const grid = $("#products-grid");
    const empty = $("#products-empty");
    const loadMore = $("#load-more-container");
    if (!grid) return;

    applyFilters();
    const visible = productState.filtered.slice(0, productState.visibleCount);

    grid.innerHTML = visible.map((product) => `
      <article class="product-card" data-id="${product.id}">
        <div class="product-card__media">
          <img src="${productImage(product)}" alt="${escapeHtml(product.name)}">
          ${product.is_featured ? '<span class="product-card__badge">Featured</span>' : ""}
        </div>
        <div class="product-card__body">
          <span class="product-card__category">${escapeHtml(product.categories?.name || "Spirits")}</span>
          <h3 class="product-card__title">${escapeHtml(product.name)}</h3>
          <p class="product-card__desc">${escapeHtml(product.description || "Premium selection from Infinity Liquor Shop.")}</p>
          <span class="product-card__meta">${escapeHtml(product.brand || "House selection")} ${product.volume_ml ? " / " + product.volume_ml + "ml" : ""} ${product.abv ? " / " + product.abv + "% ABV" : ""}</span>
          <span class="product-card__stock">${stockLabel(product)}</span>
          <div class="product-card__bottom">
            <span class="product-card__price">${formatCurrency(product.price)}</span>
          </div>
          <div class="product-card__actions">
            <button class="btn btn--gold" type="button" data-add-cart="${product.id}" ${Number(product.stock) <= 0 ? "disabled" : ""}>Add to Cart</button>
            <button class="btn btn--ghost product-card__quick" type="button" data-quickview="${product.id}" aria-label="Quick view">View</button>
          </div>
        </div>
      </article>
    `).join("");

    if (empty) empty.style.display = productState.filtered.length ? "none" : "block";
    if (loadMore) loadMore.style.display = productState.filtered.length > productState.visibleCount ? "block" : "none";
  }

  function setCategory(slug) {
    productState.activeCategory = slug;
    productState.visibleCount = 12;
    $$(".filter-btn").forEach((button) => button.classList.toggle("filter-btn--active", button.dataset.category === slug));
    $$(".category-card").forEach((button) => button.classList.toggle("is-active", button.dataset.category === slug));
    renderProducts();
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function addToCart(productId, quantity = 1) {
    const product = productState.products.find((item) => item.id === productId);
    if (!product) return;
    if (Number(product.stock) <= 0) {
      toast("This product is out of stock.", "warning");
      return;
    }

    const existing = productState.cart.find((item) => item.productId === productId);
    const currentQty = existing?.quantity || 0;
    if (currentQty + quantity > Number(product.stock)) {
      toast("Only " + product.stock + " units available.", "warning");
      return;
    }

    if (existing) existing.quantity += quantity;
    else productState.cart.push({ productId, quantity, product });

    saveCart();
    updateCartUI();
    toast("Added to cart.", "success");
  }

  function setCartQuantity(productId, quantity) {
    const item = productState.cart.find((entry) => entry.productId === productId);
    const product = productState.products.find((entry) => entry.id === productId) || item?.product;
    if (!item || !product) return;

    if (quantity <= 0) {
      productState.cart = productState.cart.filter((entry) => entry.productId !== productId);
    } else if (quantity <= Number(product.stock)) {
      item.quantity = quantity;
    } else {
      toast("Only " + product.stock + " units available.", "warning");
    }

    saveCart();
    updateCartUI();
  }

  function clearCart() {
    productState.cart = [];
    saveCart();
    updateCartUI();
  }

  function openQuickView(productId) {
    const product = productState.products.find((item) => item.id === productId);
    if (!product) return;

    const content = $("#quickview-content");
    if (content) {
      content.innerHTML = `
        <img class="quickview__image" src="${productImage(product)}" alt="${escapeHtml(product.name)}">
        <div>
          <span class="product-card__category">${escapeHtml(product.categories?.name || "Spirits")}</span>
          <h2 class="quickview__title">${escapeHtml(product.name)}</h2>
          <p class="product-card__desc">${escapeHtml(product.description || "Premium selection from Infinity Liquor Shop.")}</p>
          <div class="summary-row"><span>Brand</span><strong>${escapeHtml(product.brand || "House selection")}</strong></div>
          <div class="summary-row"><span>Volume</span><strong>${product.volume_ml || "-"} ml</strong></div>
          <div class="summary-row"><span>ABV</span><strong>${product.abv || "-"}%</strong></div>
          <div class="summary-row"><span>Stock</span><strong>${stockLabel(product)}</strong></div>
          <div class="summary-row"><span>Price</span><strong>${formatCurrency(product.price)}</strong></div>
          <button class="btn btn--gold btn--full" type="button" data-add-cart="${product.id}" ${Number(product.stock) <= 0 ? "disabled" : ""}>Add to Cart</button>
        </div>
      `;
    }

    $("#quickview-overlay")?.classList.remove("modal-overlay--hidden");
    $("#quickview-modal")?.classList.remove("modal--hidden");
    document.body.classList.add("modal-open");
  }

  function closeQuickView() {
    $("#quickview-overlay")?.classList.add("modal-overlay--hidden");
    $("#quickview-modal")?.classList.add("modal--hidden");
    document.body.classList.remove("modal-open");
  }

  function openCart() {
    $("#cart-overlay")?.classList.remove("cart-overlay--hidden");
    $("#cart-sidebar")?.classList.remove("cart-sidebar--closed");
    document.body.classList.add("cart-open");
  }

  function closeCart() {
    $("#cart-overlay")?.classList.add("cart-overlay--hidden");
    $("#cart-sidebar")?.classList.add("cart-sidebar--closed");
    document.body.classList.remove("cart-open");
  }

  function initProductEvents() {
    document.addEventListener("click", (event) => {
      const categoryButton = event.target.closest("[data-category]");
      const addButton = event.target.closest("[data-add-cart]");
      const quickButton = event.target.closest("[data-quickview]");
      const incButton = event.target.closest("[data-cart-inc]");
      const decButton = event.target.closest("[data-cart-dec]");
      const removeButton = event.target.closest("[data-cart-remove]");

      if (categoryButton) setCategory(categoryButton.dataset.category);
      if (addButton) addToCart(addButton.dataset.addCart);
      if (quickButton) openQuickView(quickButton.dataset.quickview);
      if (incButton) {
        const item = productState.cart.find((entry) => entry.productId === incButton.dataset.cartInc);
        if (item) setCartQuantity(item.productId, item.quantity + 1);
      }
      if (decButton) {
        const item = productState.cart.find((entry) => entry.productId === decButton.dataset.cartDec);
        if (item) setCartQuantity(item.productId, item.quantity - 1);
      }
      if (removeButton) setCartQuantity(removeButton.dataset.cartRemove, 0);
    });

    $("#cart-toggle")?.addEventListener("click", openCart);
    $("#cart-close")?.addEventListener("click", closeCart);
    $("#cart-overlay")?.addEventListener("click", closeCart);
    $("#cart-shop-btn")?.addEventListener("click", closeCart);
    $("#quickview-close")?.addEventListener("click", closeQuickView);
    $("#quickview-overlay")?.addEventListener("click", closeQuickView);

    $("#sort-select")?.addEventListener("change", (event) => {
      productState.sort = event.target.value;
      renderProducts();
    });

    $("#search-input")?.addEventListener("input", (event) => {
      productState.search = event.target.value.trim();
      productState.visibleCount = 12;
      renderProducts();
    });

    $("#search-clear")?.addEventListener("click", () => {
      const input = $("#search-input");
      if (input) input.value = "";
      productState.search = "";
      renderProducts();
    });

    $("#load-more-btn")?.addEventListener("click", () => {
      productState.visibleCount += 8;
      renderProducts();
    });
  }

  async function initProducts() {
    cartFromStorage();
    updateCartUI();
    initProductEvents();

    try {
      await Promise.all([loadCategories(), loadProducts()]);
      renderCategories();
      renderProducts();
      updateCartUI();
    } catch (error) {
      $("#products-grid") && ($("#products-grid").innerHTML = "");
      $("#products-empty") && ($("#products-empty").style.display = "block");
      toast("Could not load products: " + error.message, "error");
    }
  }

  InfinityApp.products = {
    state: productState,
    loadProducts,
    renderProducts,
    addToCart,
    clearCart,
    cartSubtotal,
    cartCount,
    getCart: () => productState.cart,
    cartItemProduct,
    updateCartUI,
    openCart,
    closeCart,
    productImage
  };

  document.addEventListener("DOMContentLoaded", initProducts);
})();
