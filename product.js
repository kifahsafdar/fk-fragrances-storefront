"use strict";

const products = window.FK_PRODUCTS;
const params = new URLSearchParams(window.location.search);
const product = products[params.get("id")];
const orderNumber = "923136000665";
const cartStorageKey = "fk-fragrances-cart-v1";
const reviewStorageKey = "fk-fragrances-reviews-v1";
const formatPrice = (amount) =>
  `PKR ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(amount)}`;
const priceFor = (item, size) =>
  item.basePrice * ({ 10: 1, 30: 3, 50: 5 }[size] || 1);

if (!product) {
  document.title = "Fragrance not found — F.K. Fragrances";
  document.querySelector(".product-page-main").innerHTML =
    '<section class="product-not-found"><h1>We could not find that fragrance.</h1><p>Choose one of the scents in our collection to explore its story.</p><a class="button button-dark" href="index.html#collection">Explore the collection ↗</a></section>';
} else {
  initializeProductPage(product);
}

function initializeProductPage(item) {
  const photo = document.querySelector("[data-detail-photo]");
  const dots = document.querySelector(".detail-gallery-dots");
  const sizeSelect = document.querySelector("[data-detail-size]");
  const priceLabel = document.querySelector("[data-detail-price]");
  const cart = new Map();
  const cartDialog = document.querySelector("#cart-dialog");
  const cartToggle = document.querySelector(".cart-toggle");
  const cartItems = document.querySelector(".cart-items");
  const cartCount = document.querySelector(".cart-count");
  const cartTitleCount = document.querySelector(".cart-title-count");
  const cartEmpty = document.querySelector(".cart-empty");
  const cartSubtotal = document.querySelector(".cart-subtotal");
  const checkoutForm = document.querySelector("#checkout-form");
  const checkoutStatus = document.querySelector(".checkout-status");
  const whatsappFallback = document.querySelector(".whatsapp-fallback");
  let photoIndex = 0;
  let toastTimer;

  document.title = `${item.name} — F.K. Fragrances`;
  document.querySelector('meta[name="description"]').content = item.description;
  document.querySelector("[data-detail-name]").textContent = item.name;
  document.querySelector("[data-product-breadcrumb]").textContent = item.name;
  document.querySelector("[data-detail-family]").textContent = item.family;
  document.querySelector("[data-detail-type]").textContent = item.type;
  document.querySelector("[data-detail-description]").textContent = item.description;
  document.querySelector("[data-detail-stock]").textContent =
    "Availability shown as a sample; please confirm on WhatsApp.";

  const notes = document.querySelector("[data-detail-notes]");
  item.notes.forEach(([label, text]) => {
    const row = document.createElement("div");
    row.className = "detail-note";
    const noteLabel = document.createElement("strong");
    noteLabel.textContent = label;
    const noteText = document.createElement("span");
    noteText.textContent = text;
    row.append(noteLabel, noteText);
    notes.append(row);
  });

  function renderPhoto(index) {
    photoIndex = (index + item.gallery.length) % item.gallery.length;
    photo.classList.remove("is-changing");
    void photo.offsetWidth;
    photo.classList.add("is-changing");
    photo.src = item.gallery[photoIndex];
    photo.alt = `${item.imageAlt} — photo ${photoIndex + 1} of ${item.gallery.length}`;
    dots.replaceChildren();
    item.gallery.forEach((_, currentIndex) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "detail-gallery-dot";
      dot.setAttribute("aria-label", `Show product photo ${currentIndex + 1}`);
      dot.setAttribute("aria-pressed", String(currentIndex === photoIndex));
      dot.addEventListener("click", () => renderPhoto(currentIndex));
      dots.append(dot);
    });
  }

  function renderPrice() {
    priceLabel.textContent = `${formatPrice(priceFor(item, sizeSelect.value))} · ${sizeSelect.value} ml`;
  }

  function reviewKey() {
    return `${reviewStorageKey}:${item.id}`;
  }

  function getReviews() {
    try {
      const saved = localStorage.getItem(reviewKey());
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new TypeError("Saved reviews are not a list.");
      return parsed.filter(
        (review) =>
          typeof review.name === "string" &&
          typeof review.text === "string" &&
          Number.isInteger(review.rating) &&
          review.rating >= 1 &&
          review.rating <= 5,
      );
    } catch (error) {
      console.error("Could not read this browser's saved reviews.", error);
      document.querySelector(".review-status").textContent =
        "Saved reviews could not be read in this browser.";
      return [];
    }
  }

  function renderReviews() {
    const reviews = getReviews();
    const list = document.querySelector("[data-review-list]");
    const countLink = document.querySelector("[data-review-count]");
    const ratingStars = document.querySelector("[data-rating-stars]");
    const ratingSummary = document.querySelector("[data-rating-summary]");
    countLink.textContent = reviews.length
      ? `${reviews.length} local review${reviews.length === 1 ? "" : "s"}`
      : "Be the first to leave a review";
    if (reviews.length) {
      const average =
        reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
      const rounded = Math.round(average);
      ratingStars.textContent = `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
      ratingStars.setAttribute("aria-label", `${average.toFixed(1)} out of 5 stars`);
      ratingSummary.textContent = `${average.toFixed(1)} / 5`;
    } else {
      ratingStars.textContent = "";
      ratingStars.setAttribute("aria-label", "No ratings yet");
      ratingSummary.textContent = "No ratings yet";
    }
    list.replaceChildren();
    if (reviews.length === 0) {
      const empty = document.createElement("p");
      empty.className = "review-empty";
      empty.textContent = "No reviews yet. Share your first impression of this scent.";
      list.append(empty);
      return;
    }

    reviews.slice().reverse().forEach((review) => {
      const card = document.createElement("article");
      card.className = "review-card";
      const header = document.createElement("header");
      const name = document.createElement("h3");
      name.textContent = review.name;
      const rating = document.createElement("span");
      rating.className = "review-stars";
      rating.setAttribute("aria-label", `${review.rating} out of 5 stars`);
      rating.textContent = `${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}`;
      const text = document.createElement("p");
      text.textContent = review.text;
      const date = document.createElement("small");
      date.textContent = new Date(review.date).toLocaleDateString();
      header.append(name, rating);
      card.append(header, text, date);
      list.append(card);
    });
  }

  function readCart() {
    try {
      const saved = localStorage.getItem(cartStorageKey);
      if (!saved) return;
      const entries = JSON.parse(saved);
      if (!Array.isArray(entries)) throw new TypeError("Saved cart is not a list.");
      entries.forEach((entry) => {
        if (!Array.isArray(entry) || entry.length !== 2) return;
        const [key, rawQuantity] = entry;
        let id = key;
        let size = "10";
        if (typeof key === "string" && key.includes("|")) {
          [id, size] = key.split("|");
        }
        const quantity = Number(rawQuantity);
        if (products[id] && ["10", "30", "50"].includes(size) &&
            Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 99) {
          cart.set(`${id}|${size}`, quantity);
        }
      });
    } catch (error) {
      console.error("Could not restore the saved shopping bag.", error);
      checkoutStatus.textContent = "Your previous bag could not be restored. You can start a new one.";
    }
  }

  function persistCart() {
    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(Array.from(cart.entries())));
    } catch (error) {
      console.error("Could not save the shopping bag in this browser.", error);
      checkoutStatus.textContent = "Your bag is available for this visit but could not be saved on this device.";
    }
  }

  function updateCart() {
    const totalQuantity = Array.from(cart.values()).reduce((sum, quantity) => sum + quantity, 0);
    const subtotal = Array.from(cart.entries()).reduce((sum, [key, quantity]) => {
      const [id, size] = key.split("|");
      return sum + priceFor(products[id], size) * quantity;
    }, 0);
    cartCount.textContent = String(totalQuantity);
    cartTitleCount.textContent = totalQuantity ? `(${totalQuantity})` : "";
    cartSubtotal.textContent = formatPrice(subtotal);
    cartEmpty.hidden = totalQuantity > 0;
    cartItems.hidden = totalQuantity === 0;
    checkoutForm.hidden = totalQuantity === 0;
    cartItems.replaceChildren();

    cart.forEach((quantity, key) => {
      const [id, size] = key.split("|");
      const cartProduct = products[id];
      const row = document.createElement("article");
      row.className = "cart-item";
      const image = document.createElement("img");
      image.className = "cart-item-image";
      image.src = cartProduct.gallery[0];
      image.alt = "";
      const details = document.createElement("div");
      details.className = "cart-item-details";
      const name = document.createElement("h3");
      name.textContent = cartProduct.name;
      const sizeLabel = document.createElement("p");
      sizeLabel.className = "cart-item-size";
      sizeLabel.textContent = `${size} ml`;
      const price = document.createElement("p");
      price.className = "cart-item-price";
      price.textContent = formatPrice(priceFor(cartProduct, size) * quantity);
      const controls = document.createElement("div");
      controls.className = "quantity-controls";
      [["decrease", "−"], ["quantity", String(quantity)], ["increase", "+"], ["remove", "Remove"]].forEach(([action, label]) => {
        if (action === "quantity") {
          const quantityLabel = document.createElement("span");
          quantityLabel.textContent = label;
          controls.append(quantityLabel);
          return;
        }
        const button = document.createElement("button");
        button.type = "button";
        button.className = action === "remove" ? "remove-item" : "quantity-button";
        button.dataset.cartAction = action;
        button.dataset.cartKey = key;
        button.textContent = label;
        controls.append(button);
      });
      details.append(name, sizeLabel, price, controls);
      row.append(image, details);
      cartItems.append(row);
    });
    persistCart();
  }

  function toast(message) {
    const element = document.querySelector(".shop-toast");
    element.textContent = message;
    element.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => element.classList.remove("is-visible"), 2600);
  }

  document.querySelectorAll("[data-gallery-step]").forEach((button) => {
    button.addEventListener("click", () => renderPhoto(photoIndex + Number(button.dataset.galleryStep)));
  });
  photo.addEventListener("animationend", (event) => {
    if (event.animationName === "detail-photo-change") {
      photo.classList.remove("is-changing");
    }
  });
  sizeSelect.addEventListener("change", renderPrice);
  document.querySelector("[data-detail-add]").addEventListener("click", () => {
    const key = `${item.id}|${sizeSelect.value}`;
    const quantity = cart.get(key) || 0;
    if (quantity >= 99) {
      toast("You can add up to 99 of each scent and size.");
      return;
    }
    cart.set(key, quantity + 1);
    updateCart();
    toast(`${item.name} (${sizeSelect.value} ml) added to your bag.`);
    cartToggle.classList.add("has-bump");
    window.setTimeout(() => cartToggle.classList.remove("has-bump"), 500);
  });
  cartToggle.addEventListener("click", () => {
    if (!cartDialog.open) cartDialog.showModal();
  });
  document.querySelectorAll("[data-close-cart]").forEach((button) => {
    button.addEventListener("click", () => cartDialog.close());
  });
  cartDialog.addEventListener("click", (event) => {
    if (event.target === cartDialog) cartDialog.close();
  });

  cartItems.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-cart-action]") : null;
    if (!button) return;
    const key = button.dataset.cartKey;
    const quantity = cart.get(key);
    if (!quantity) return;
    if (button.dataset.cartAction === "remove" || (button.dataset.cartAction === "decrease" && quantity === 1)) cart.delete(key);
    else if (button.dataset.cartAction === "decrease") cart.set(key, quantity - 1);
    else if (quantity < 99) cart.set(key, quantity + 1);
    else {
      toast("You can add up to 99 of each scent and size.");
      return;
    }
    updateCart();
  });

  checkoutForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (cart.size === 0) {
      checkoutStatus.textContent = "Add a fragrance to your bag before placing an order.";
      return;
    }
    const customer = new FormData(checkoutForm);
    const orderLines = Array.from(cart.entries()).map(([key, quantity]) => {
      const [id, size] = key.split("|");
      const cartProduct = products[id];
      return `- ${cartProduct.name} (${size} ml) x ${quantity}: ${formatPrice(priceFor(cartProduct, size) * quantity)}`;
    });
    const subtotal = Array.from(cart.entries()).reduce((sum, [key, quantity]) => {
      const [id, size] = key.split("|");
      return sum + priceFor(products[id], size) * quantity;
    }, 0);
    const message = [
      "Hello F.K. Fragrances! I'd like to place an order:", "",
      ...orderLines, "", `Subtotal (sample prices): ${formatPrice(subtotal)}`,
      "Please confirm the final prices, delivery charges, availability and payment method.", "",
      `Name: ${customer.get("name")}`, `Phone: ${customer.get("phone")}`,
      `City: ${customer.get("city")}`, `Delivery address: ${customer.get("address")}`,
    ].join("\n");
    const url = `https://wa.me/${orderNumber}?text=${encodeURIComponent(message)}`;
    whatsappFallback.href = url;
    whatsappFallback.hidden = false;
    checkoutStatus.textContent = "Your order is ready. WhatsApp will open so you can review and send your message.";
    if (!window.open(url, "_blank", "noopener,noreferrer")) {
      checkoutStatus.textContent = "Your order is ready. If WhatsApp did not open, use the link below to send it.";
    }
  });

  const reviewForm = document.querySelector("[data-review-form]");
  reviewForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(reviewForm);
    const review = {
      name: String(form.get("name")).trim(),
      rating: Number(form.get("rating")),
      text: String(form.get("review")).trim(),
      date: new Date().toISOString(),
    };
    if (review.name.length < 2 || review.text.length < 10 || review.rating < 1 || review.rating > 5) {
      document.querySelector(".review-status").textContent = "Please add your name, a 1–5 rating, and a review of at least 10 characters.";
      return;
    }
    try {
      const reviews = getReviews();
      reviews.push(review);
      localStorage.setItem(reviewKey(), JSON.stringify(reviews));
      reviewForm.reset();
      document.querySelector(".review-status").textContent = "Your review has been saved in this browser.";
      renderReviews();
    } catch (error) {
      console.error("Could not save your review in this browser.", error);
      document.querySelector(".review-status").textContent = "Your review could not be saved. Please check browser storage and try again.";
    }
  });

  const recommendationGrid = document.querySelector("[data-recommendations]");
  Object.values(products)
    .filter((candidate) => candidate.id !== item.id)
    .slice(0, 3)
    .forEach((candidate) => {
      const link = document.createElement("a");
      link.className = "recommendation-card";
      link.href = `product.html?id=${encodeURIComponent(candidate.id)}`;
      const frame = document.createElement("span");
      frame.className = "recommendation-photo";
      const image = document.createElement("img");
      image.src = candidate.gallery[0];
      image.alt = candidate.imageAlt;
      image.loading = "lazy";
      const name = document.createElement("h3");
      name.className = "recommendation-name";
      name.textContent = candidate.name;
      const type = document.createElement("p");
      type.className = "recommendation-type";
      type.textContent = candidate.type;
      frame.append(image);
      link.append(frame, name, type);
      recommendationGrid.append(link);
    });

  if (
    "IntersectionObserver" in window &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    const detailObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -35px 0px" },
    );
    document
      .querySelectorAll(".detail-reviews, .detail-recommendations")
      .forEach((section) => detailObserver.observe(section));
  } else {
    document
      .querySelectorAll(".detail-reviews, .detail-recommendations")
      .forEach((section) => section.classList.add("is-visible"));
  }

  renderPhoto(0);
  renderPrice();
  renderReviews();
  readCart();
  updateCart();
}
