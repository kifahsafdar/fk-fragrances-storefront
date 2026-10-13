"use strict";

document.documentElement.classList.add("reveal-ready");

const filterButtons = document.querySelectorAll(".filter-button");
const productCards = Array.from(document.querySelectorAll(".product-card"));
const productGrid = document.querySelector(".product-grid");
const emptyMessage = document.querySelector(".filter-empty");
const pagination = document.querySelector(".pagination");
const paginationPages = document.querySelector(".pagination-pages");
const paginationStatus = document.querySelector(".pagination-status");
const cartToggle = document.querySelector(".cart-toggle");
const cartDialog = document.querySelector("#cart-dialog");
const cartItems = document.querySelector(".cart-items");
const cartCount = document.querySelector(".cart-count");
const cartTitleCount = document.querySelector(".cart-title-count");
const cartEmpty = document.querySelector(".cart-empty");
const cartSubtotal = document.querySelector(".cart-subtotal");
const cartStatus = document.querySelector(".checkout-status");
const checkoutForm = document.querySelector("#checkout-form");
const whatsappFallback = document.querySelector(".whatsapp-fallback");
const toast = document.querySelector(".shop-toast");
const collection = document.querySelector("#collection");
const storageKey = "fk-fragrances-cart-v1";
const orderNumber = "923136000665";
const pageSize = 2;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const formatPrice = (amount) =>
  `PKR ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(amount)}`;
const priceFor = (product, size) =>
  product.basePrice * ({ 10: 1, 30: 3, 50: 5 }[size] || 1);

const products = new Map(
  productCards.map((card) => {
    const catalogProduct = window.FK_PRODUCTS[card.dataset.productId];
    const priceLabel = card.querySelector(".product-price span");
    const sizeSelector = card.querySelector("[data-size-selector]");
    const updatePrice = () => {
      const size = sizeSelector.value;
      card.querySelector(".product-price").replaceChildren(
        document.createTextNode(`${formatPrice(priceFor(catalogProduct, size))} `),
        priceLabel,
      );
      priceLabel.textContent = `/ ${size} ml`;
    };
    sizeSelector.addEventListener("change", () =>
      updateCatalogSize(sizeSelector.value),
    );
    updatePrice();
    return [
      card.dataset.productId,
      {
        id: card.dataset.productId,
        name: catalogProduct.name,
        family: catalogProduct.family,
        type: catalogProduct.type,
        description: catalogProduct.description,
        basePrice: catalogProduct.basePrice,
        gallery: catalogProduct.gallery,
        imageAlt: catalogProduct.imageAlt,
        notes: catalogProduct.notes,
      },
    ];
  }),
);

const cart = new Map();
let toastTimer;
let currentPage = 1;
let activeFilter = "all";
let activeStockFilter = "all";
let activeSort = "recommended";

function updateCatalogSize(size) {
  document.querySelector("#catalog-size").value = size;
  productCards.forEach((card) => {
    const selector = card.querySelector("[data-size-selector]");
    selector.value = size;
    const product = window.FK_PRODUCTS[card.dataset.productId];
    const price = card.querySelector(".product-price");
    const unit = price.querySelector("span");
    price.replaceChildren(
      document.createTextNode(`${formatPrice(priceFor(product, size))} `),
      unit,
    );
    unit.textContent = `/ ${size} ml`;
  });
  currentPage = 1;
  renderCollection();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2600);
}

function updateCart() {
  const totalQuantity = Array.from(cart.values()).reduce(
    (total, quantity) => total + quantity,
    0,
  );
  const subtotal = Array.from(cart.entries()).reduce((total, [key, quantity]) => {
    const [id, selectedSize] = key.split("|");
    return total + priceFor(products.get(id), selectedSize) * quantity;
  }, 0);

  cartCount.textContent = String(totalQuantity);
  cartTitleCount.textContent = totalQuantity ? `(${totalQuantity})` : "";
  cartSubtotal.textContent = formatPrice(subtotal);
  cartEmpty.hidden = totalQuantity > 0;
  cartItems.hidden = totalQuantity === 0;
  checkoutForm.hidden = totalQuantity === 0;
  cartItems.replaceChildren();

  cart.forEach((quantity, key) => {
    const [id, selectedSize] = key.split("|");
    const product = products.get(id);
    const item = document.createElement("article");
    item.className = "cart-item";

    const image = document.createElement("img");
    image.className = "cart-item-image";
    image.src = product.gallery[0];
    image.alt = "";
    image.loading = "lazy";

    const details = document.createElement("div");
    details.className = "cart-item-details";

    const name = document.createElement("h3");
    name.textContent = product.name;

    const sizeLabel = document.createElement("p");
    sizeLabel.className = "cart-item-size";
    sizeLabel.textContent = `${selectedSize} ml`;

    const price = document.createElement("p");
    price.className = "cart-item-price";
    price.textContent = formatPrice(priceFor(product, selectedSize) * quantity);

    const controls = document.createElement("div");
    controls.className = "quantity-controls";

    const decrease = document.createElement("button");
    decrease.type = "button";
    decrease.className = "quantity-button";
    decrease.dataset.cartAction = "decrease";
    decrease.dataset.cartKey = key;
    decrease.setAttribute("aria-label", `Decrease ${product.name} quantity`);
    decrease.textContent = "−";

    const quantityLabel = document.createElement("span");
    quantityLabel.textContent = String(quantity);
    quantityLabel.setAttribute("aria-label", `Quantity ${quantity}`);

    const increase = document.createElement("button");
    increase.type = "button";
    increase.className = "quantity-button";
    increase.dataset.cartAction = "increase";
    increase.dataset.cartKey = key;
    increase.setAttribute("aria-label", `Increase ${product.name} quantity`);
    increase.textContent = "+";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-item";
    remove.dataset.cartAction = "remove";
    remove.dataset.cartKey = key;
    remove.textContent = "Remove";

    controls.append(decrease, quantityLabel, increase, remove);
    details.append(name, sizeLabel, price, controls);
    item.append(image, details);
    cartItems.append(item);
  });

  try {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(cart.entries())));
  } catch (error) {
    console.error("Could not save the shopping bag in this browser.", error);
    cartStatus.textContent =
      "Your bag is available for this visit but could not be saved on this device.";
  }
}

function addToCart(id, size = "10") {
  const product = products.get(id);
  if (!product) {
    console.error(`Cannot add unknown product "${id}" to the shopping bag.`);
    showToast("This scent could not be added. Please refresh and try again.");
    return;
  }

  const key = `${id}|${size}`;
  if ((cart.get(key) || 0) >= 99) {
    showToast("You can add up to 99 of each scent and size.");
    return;
  }
  cart.set(key, (cart.get(key) || 0) + 1);
  updateCart();
  showToast(`${product.name} (${size} ml) added to your bag.`);
  cartToggle.classList.remove("has-bump");
  window.requestAnimationFrame(() => cartToggle.classList.add("has-bump"));
}

function openCart() {
  if (!cartDialog.open) cartDialog.showModal();
}

function openProductDetails(id) {
  if (!products.has(id)) {
    console.error(`Cannot show unknown product "${id}".`);
    return;
  }
  window.location.href = `product.html?id=${encodeURIComponent(id)}`;
}

function renderCollection({ scroll = false } = {}) {
  const filteredProducts = productCards
    .filter((card) => activeFilter === "all" || card.dataset.family === activeFilter)
    .filter((card) => activeStockFilter === "all" || card.dataset.stock === (activeStockFilter === "in-stock" ? "in" : "out"))
    .sort((first, second) => {
      if (activeSort === "price-low" || activeSort === "price-high") {
        const firstSize = first.querySelector("[data-size-selector]").value;
        const secondSize = second.querySelector("[data-size-selector]").value;
        const difference =
          priceFor(products.get(first.dataset.productId), firstSize) -
          priceFor(products.get(second.dataset.productId), secondSize);
        return activeSort === "price-low" ? difference : -difference;
      }
      return activeSort === "recommended"
        ? window.FK_PRODUCTS[first.dataset.productId].recommendation -
            window.FK_PRODUCTS[second.dataset.productId].recommendation
        : Number(second.dataset.stock === "in") - Number(first.dataset.stock === "in");
    });
  const pageCount = Math.ceil(filteredProducts.length / pageSize);
  currentPage = Math.min(Math.max(currentPage, 1), Math.max(pageCount, 1));
  const startIndex = (currentPage - 1) * pageSize;
  const visibleCards = new Set(
    filteredProducts.slice(startIndex, startIndex + pageSize),
  );

  filteredProducts.forEach((card) => productGrid.append(card));
  productCards.forEach((card, index) => {
    const isVisible = visibleCards.has(card);
    card.hidden = !isVisible;
    card.classList.remove("is-page-entering");
    if (isVisible && !reducedMotion.matches) {
      card.style.setProperty("--stagger-index", String(index % pageSize));
      requestAnimationFrame(() => card.classList.add("is-page-entering"));
    }
  });

  emptyMessage.hidden = filteredProducts.length > 0;
  document.querySelector(".catalog-results").textContent =
    `Showing ${filteredProducts.length} of ${productCards.length} fragrances`;
  pagination.hidden = pageCount <= 1;
  paginationStatus.textContent = `Page ${currentPage} of ${pageCount || 1}`;
  paginationPages.replaceChildren();

  for (let page = 1; page <= pageCount; page += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pagination-page";
    button.dataset.page = String(page);
    button.textContent = String(page);
    button.setAttribute("aria-label", `Go to collection page ${page}`);
    button.setAttribute("aria-current", String(page === currentPage));
    paginationPages.append(button);
  }

  pagination.querySelector('[data-page-action="previous"]').disabled =
    currentPage <= 1;
  pagination.querySelector('[data-page-action="next"]').disabled =
    currentPage >= pageCount;
  productGrid.setAttribute(
    "aria-label",
    `Collection page ${currentPage}, showing ${visibleCards.size} of ${filteredProducts.length} fragrances`,
  );

  if (scroll) {
    collection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

try {
  const savedCart = localStorage.getItem(storageKey);
  if (savedCart) {
    const parsedCart = JSON.parse(savedCart);
    if (!Array.isArray(parsedCart)) {
      throw new TypeError("Saved cart is not a list.");
    }
    parsedCart.forEach(([savedKey, quantity]) => {
      const [id, size = "10"] = String(savedKey).split("|");
      if (
        products.has(id) &&
        ["10", "30", "50"].includes(size) &&
        Number.isSafeInteger(quantity) &&
        quantity > 0 &&
        quantity <= 99
      ) {
        cart.set(`${id}|${size}`, quantity);
      }
    });
  }
} catch (error) {
  console.error("Could not restore the saved shopping bag.", error);
  cartStatus.textContent =
    "Your previous bag could not be restored. You can start a new one.";
}

updateCart();
renderCollection();

cartToggle.addEventListener("click", openCart);

document.querySelectorAll("[data-close-cart]").forEach((button) => {
  button.addEventListener("click", () => cartDialog.close());
});

cartDialog.addEventListener("click", (event) => {
  if (event.target === cartDialog) cartDialog.close();
});

document.querySelectorAll("[data-product-details]").forEach((button) => {
  button.addEventListener("click", () =>
    openProductDetails(button.dataset.productDetails),
  );
});

document.querySelectorAll("[data-add-product]").forEach((button) => {
  button.addEventListener("click", () => {
    const card = button.closest(".product-card");
    addToCart(
      button.dataset.addProduct,
      card.querySelector("[data-size-selector]").value,
    );
  });
});

cartItems.addEventListener("click", (event) => {
  const button =
    event.target instanceof Element
      ? event.target.closest("[data-cart-action]")
      : null;
  if (!button) return;

  const { cartKey, cartAction } = button.dataset;
  const quantity = cart.get(cartKey);
  if (!quantity) return;

  if (cartAction === "remove" || (cartAction === "decrease" && quantity === 1)) {
    cart.delete(cartKey);
  } else if (cartAction === "decrease") {
    cart.set(cartKey, quantity - 1);
  } else if (cartAction === "increase" && quantity < 99) {
    cart.set(cartKey, quantity + 1);
  } else if (cartAction === "increase") {
    showToast("You can add up to 99 of each scent.");
    return;
  }

  updateCart();
});

document.querySelector(".pagination").addEventListener("click", (event) => {
  const button =
    event.target instanceof Element
      ? event.target.closest("[data-page], [data-page-action]")
      : null;
  if (!button || button.disabled) return;

  if (button.dataset.page) {
    currentPage = Number(button.dataset.page);
  } else if (button.dataset.pageAction === "previous") {
    currentPage -= 1;
  } else if (button.dataset.pageAction === "next") {
    currentPage += 1;
  }

  renderCollection({ scroll: true });
});

checkoutForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (cart.size === 0) {
    cartStatus.textContent = "Add a fragrance to your bag before placing an order.";
    return;
  }

  const customer = new FormData(checkoutForm);
  const orderLines = Array.from(cart.entries()).map(([key, quantity]) => {
    const [id, size] = key.split("|");
    const product = products.get(id);
    return `- ${product.name} (${size} ml) x ${quantity}: ${formatPrice(priceFor(product, size) * quantity)}`;
  });
  const subtotal = Array.from(cart.entries()).reduce((total, [key, quantity]) => {
    const [id, size] = key.split("|");
    return total + priceFor(products.get(id), size) * quantity;
  }, 0);
  const message = [
    "Hello F.K. Fragrances! I'd like to place an order:",
    "",
    ...orderLines,
    "",
    `Subtotal (sample prices): ${formatPrice(subtotal)}`,
    "Please confirm the final prices, delivery charges, availability and payment method.",
    "",
    `Name: ${customer.get("name")}`,
    `Phone: ${customer.get("phone")}`,
    `City: ${customer.get("city")}`,
    `Delivery address: ${customer.get("address")}`,
  ].join("\n");
  const whatsappUrl = `https://wa.me/${orderNumber}?text=${encodeURIComponent(message)}`;

  whatsappFallback.href = whatsappUrl;
  whatsappFallback.hidden = false;
  cartStatus.textContent =
    "Your order is ready. WhatsApp will open so you can review and send your message.";
  const whatsappWindow = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  if (!whatsappWindow) {
    cartStatus.textContent =
      "Your order is ready. If WhatsApp did not open, use the link below to send it.";
  }
});

if (
  window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !reducedMotion.matches
) {
  productCards.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      if (card.hidden) return;
      const bounds = card.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;

      card.classList.add("is-tilting");
      card.style.setProperty("--tilt-x", `${(0.5 - y) * 5}deg`);
      card.style.setProperty("--tilt-y", `${(x - 0.5) * 5}deg`);
      card.style.setProperty("--glow-x", `${x * 100}%`);
      card.style.setProperty("--glow-y", `${y * 100}%`);
    });

    card.addEventListener("pointerleave", () => {
      card.classList.remove("is-tilting");
      card.style.removeProperty("--tilt-x");
      card.style.removeProperty("--tilt-y");
      card.style.removeProperty("--glow-x");
      card.style.removeProperty("--glow-y");
    });
  });
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    currentPage = 1;

    filterButtons.forEach((filterButton) => {
      const isSelected = filterButton === button;
      filterButton.classList.toggle("is-active", isSelected);
      filterButton.setAttribute("aria-pressed", String(isSelected));
    });

    renderCollection();
  });
});

document.querySelector("#sort-products").addEventListener("change", (event) => {
  activeSort = event.currentTarget.value;
  currentPage = 1;
  renderCollection();
});

document.querySelector("#stock-filter").addEventListener("change", (event) => {
  activeStockFilter = event.currentTarget.value;
  currentPage = 1;
  renderCollection();
});
document.querySelector("#catalog-size").addEventListener("change", (event) => {
  updateCatalogSize(event.currentTarget.value);
});

const heroSlides = Array.from(products.values()).sort(
  (first, second) =>
    window.FK_PRODUCTS[first.id].recommendation -
    window.FK_PRODUCTS[second.id].recommendation,
);
const heroPhoto = document.querySelector("[data-hero-photo]");
const heroDots = document.querySelector(".hero-carousel-dots");
const heroProgress = document.querySelector(".hero-carousel-progress");
const heroCampaignButton = document.querySelector("[data-hero-discover]");
const heroShopCard = document.querySelector(".campaign-shop-card");
const heroEdition = document.querySelector("[data-hero-edition]");
const heroName = document.querySelector("[data-hero-name]");
const heroNotes = document.querySelector("[data-hero-notes]");
const heroFamily = document.querySelector("[data-hero-family]");
const heroTitle = document.querySelector("[data-hero-title]");
const heroDescription = document.querySelector("[data-hero-description]");
const heroOverline = document.querySelector("[data-hero-overline]");
const heroSideNote = document.querySelector("[data-hero-side-note]");
const heroCopy = document.querySelector(".hero-copy");
const heroSection = document.querySelector(".hero-campaign");
let heroIndex = -1;
let heroTimer;

function renderHero(index) {
  const isFirstRender = heroIndex === -1;
  heroIndex = (index + heroSlides.length) % heroSlides.length;
  const featured = heroSlides[heroIndex];
  heroPhoto.classList.remove("is-switching");
  void heroPhoto.offsetWidth;
  heroPhoto.classList.add("is-switching");
  heroPhoto.src = featured.gallery[0];
  heroPhoto.alt = featured.imageAlt;
  document.querySelector(".campaign-visual").setAttribute(
    "aria-label",
    `${featured.name} perfume editorial`,
  );
  heroName.textContent = featured.name.toUpperCase();
  heroNotes.textContent = featured.type.toUpperCase();
  heroFamily.textContent = featured.family;
  heroTitle.textContent = featured.name.toUpperCase();
  heroDescription.textContent = featured.description;
  heroOverline.textContent = `SCENT ${String(heroIndex + 1).padStart(2, "0")} · ${featured.type.toUpperCase()}`;
  heroSideNote.textContent = featured.family;
  if (!isFirstRender) {
    heroCopy.classList.remove("is-changing");
    void heroCopy.offsetWidth;
    heroCopy.classList.add("is-changing");
  }
  heroEdition.textContent = `${String(heroIndex + 1).padStart(2, "0")} — ${featured.family}`;
  heroCampaignButton.dataset.productDetails = featured.id;
  heroCampaignButton.firstChild.textContent = `Discover ${featured.name} `;
  heroShopCard.dataset.productDetails = featured.id;
  heroProgress.textContent = `${String(heroIndex + 1).padStart(2, "0")} / ${String(heroSlides.length).padStart(2, "0")}`;
  heroDots.replaceChildren();
  heroSlides.forEach((slide, indexInList) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "hero-carousel-dot";
    dot.setAttribute("aria-label", `Feature ${slide.name}`);
    dot.setAttribute("aria-pressed", String(indexInList === heroIndex));
    dot.addEventListener("click", () => {
      renderHero(indexInList);
      restartHeroTimer();
    });
    heroDots.append(dot);
  });
}

heroPhoto.addEventListener("animationend", (event) => {
  if (event.animationName === "hero-photo-switch") {
    heroPhoto.classList.remove("is-switching");
  }
});
heroCopy.addEventListener("animationend", (event) => {
  if (event.animationName === "hero-copy-switch") {
    heroCopy.classList.remove("is-changing");
  }
});

function stopHeroTimer() {
  window.clearInterval(heroTimer);
}

function startHeroTimer() {
  stopHeroTimer();
  if (
    !reducedMotion.matches &&
    !document.hidden &&
    !heroSection.matches(":hover") &&
    !heroSection.contains(document.activeElement)
  ) {
    heroTimer = window.setInterval(() => renderHero(heroIndex + 1), 5000);
  }
}

function restartHeroTimer() {
  startHeroTimer();
}

document.querySelectorAll("[data-hero-step]").forEach((button) => {
  button.addEventListener("click", () => {
    renderHero(heroIndex + Number(button.dataset.heroStep));
    restartHeroTimer();
  });
});
heroSection.addEventListener("mouseenter", stopHeroTimer);
heroSection.addEventListener("mouseleave", startHeroTimer);
heroSection.addEventListener("focusin", stopHeroTimer);
heroSection.addEventListener("focusout", (event) => {
  if (!heroSection.contains(event.relatedTarget)) startHeroTimer();
});
const heroProductPhotoFrame = document.querySelector(".campaign-photo-frame");
if (
  window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !reducedMotion.matches
) {
  heroProductPhotoFrame.addEventListener("pointermove", (event) => {
    const bounds = heroProductPhotoFrame.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    heroPhoto.style.setProperty("--photo-tilt-x", `${(0.5 - y) * 5}deg`);
    heroPhoto.style.setProperty("--photo-tilt-y", `${(x - 0.5) * 6}deg`);
  });
  heroProductPhotoFrame.addEventListener("pointerleave", () => {
    heroPhoto.style.removeProperty("--photo-tilt-x");
    heroPhoto.style.removeProperty("--photo-tilt-y");
  });
}
document.addEventListener("visibilitychange", startHeroTimer);
reducedMotion.addEventListener("change", startHeroTimer);
renderHero(0);
startHeroTimer();

if ("IntersectionObserver" in window && !reducedMotion.matches) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14, rootMargin: "0px 0px -35px 0px" },
  );

  document.querySelectorAll("[data-reveal]").forEach((element, index) => {
    element.style.setProperty("--reveal-index", String(index % 4));
    revealObserver.observe(element);
  });
} else {
  document
    .querySelectorAll("[data-reveal]")
    .forEach((element) => element.classList.add("is-revealed"));
}

if (!reducedMotion.matches) {
  const marquee = document.querySelector(".scent-marquee-track");
  marquee.addEventListener("pointerenter", () => {
    marquee.classList.add("is-paused");
  });
  marquee.addEventListener("pointerleave", () => {
    marquee.classList.remove("is-paused");
  });
}
