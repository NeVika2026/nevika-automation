import { initCartPage } from "../modules/cart.js?v=20260619-2";
import { initCatalogPage } from "../modules/catalog.js?v=20260619-2";
import { initHomePage } from "../modules/home.js?v=20260619-2";
import { initNewsPage } from "../modules/news.js?v=20260619-2";
import { initProductPage } from "../modules/product.js?v=20260619-2";
import { initPromoSlots } from "../modules/promos.js?v=20260619-2";
import { FAMALL_REVIEWS_URL, maxUrl, updateCartCount, whatsappUrl } from "../modules/store.js?v=20260619-2";

function getBasePath() {
  if (window.location.pathname.includes("/pages/")) {
    return "../../";
  }

  if (window.location.pathname.includes("/admin/")) {
    return "../";
  }

  return "";
}

function renderHeader() {
  const header = document.querySelector('[data-component="site-header"]');

  if (!header) {
    return;
  }

  const basePath = getBasePath();
  const currentPage = document.body.dataset.page || "home";
  const navItems = [
    { id: "catalog", label: "Каталог", href: `${basePath}pages/catalog/` },
    { id: "new", label: "Новинки", href: `${basePath}pages/new/` },
    { id: "hits", label: "Хиты", href: `${basePath}pages/hits/` },
    { id: "sale", label: "Акции", href: `${basePath}pages/sale/` },
    { id: "about", label: "О компании", href: `${basePath}pages/about/` },
    { id: "documents", label: "Документы", href: `${basePath}pages/documents/` },
    { id: "partners", label: "Партнёрам", href: `${basePath}pages/partners/` },
    { id: "workbook", label: "Рабочая тетрадь", href: `${basePath}pages/workbook/` },
    { id: "news", label: "Новости", href: `${basePath}pages/news/` },
    { id: "contacts", label: "Контакты", href: `${basePath}pages/contacts/` }
  ];

  const navMarkup = navItems
    .map((item) => {
      const activeClass = currentPage === item.id ? " is-active" : "";
      return `<a class="site-header__link${activeClass}" href="${item.href}">${item.label}</a>`;
    })
    .join("");

  const mobileNavMarkup = navItems
    .map((item) => {
      const activeClass = currentPage === item.id ? " is-active" : "";
      return `<a class="site-header__mobile-link${activeClass}" href="${item.href}">${item.label}</a>`;
    })
    .join("");

  header.className = "site-header";
  header.innerHTML = `
    <div class="site-header__inner">
      <a class="site-header__brand" href="${basePath}index.html" aria-label="FAMALL - на главную">
        <img class="site-header__logo" src="${basePath}assets/images/famall-logo.png?v=20260607" alt="FAMALL">
      </a>
      <nav class="site-header__nav" aria-label="Основная навигация">
        ${navMarkup}
      </nav>
      <div class="site-header__actions">
        <a class="site-header__icon-button site-header__search" href="${basePath}pages/catalog/" aria-label="Поиск по товарам">Поиск</a>
        <a class="site-header__icon-button site-header__cart" href="${basePath}pages/cart/" aria-label="Корзина">
          Корзина
          <span class="site-header__cart-badge" data-cart-count hidden>0</span>
        </a>
        <button class="site-header__burger" type="button" aria-label="Открыть меню" aria-expanded="false">
          <span class="site-header__burger-line"></span>
          <span class="site-header__burger-line"></span>
          <span class="site-header__burger-line"></span>
        </button>
      </div>
    </div>
    <nav class="site-header__mobile-panel" aria-label="Мобильная навигация">
      ${mobileNavMarkup}
    </nav>
  `;

  const menuButton = header.querySelector(".site-header__burger");
  menuButton.addEventListener("click", () => {
    const isOpen = header.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Закрыть меню" : "Открыть меню");
  });
}

function renderFooter() {
  const footer = document.querySelector('[data-component="site-footer"]');

  if (!footer) {
    return;
  }

  const basePath = getBasePath();
  const year = new Date().getFullYear();

  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="site-footer__inner">
      <div class="site-footer__brand">
        <img class="site-footer__logo" src="${basePath}assets/images/famall-logo.png?v=20260607" alt="FAMALL">
        <p>Информационный каталог FAMALL. Наличие товаров, условия приобретения, оплаты и доставки уточняйте у консультанта.</p>
      </div>
      <nav class="site-footer__nav" aria-label="Навигация в подвале">
        <a href="${basePath}pages/catalog/">Каталог</a>
        <a href="${basePath}pages/new/">Новинки</a>
        <a href="${basePath}pages/hits/">Хиты</a>
        <a href="${basePath}pages/sale/">Акции</a>
        <a href="${basePath}pages/about/">О компании</a>
        <a href="${basePath}pages/documents/">Документы</a>
        <a href="${basePath}pages/faq/">FAQ</a>
        <a href="${basePath}pages/partners/">Партнёрам</a>
        <a href="${basePath}pages/workbook/">Рабочая тетрадь</a>
        <a href="${basePath}pages/news/">Новости</a>
        <a href="${basePath}pages/contacts/">Контакты</a>
      </nav>
      <div class="site-footer__contacts">
        <strong>Связаться:</strong>
        <a class="btn--max contact-max" href="${maxUrl()}" target="_blank" rel="noopener">MAX</a>
        <a class="contact-whatsapp" href="${whatsappUrl()}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="contact-reviews" href="${FAMALL_REVIEWS_URL}" target="_blank" rel="noopener">Отзывы о продукции</a>
      </div>
    </div>
    <div class="site-footer__bottom">
      <span>© ${year} FAMALL</span>
      <span>Заказ оформляется через выбранный мессенджер.</span>
      <a href="${basePath}pages/privacy-policy/">Политика конфиденциальности</a>
    </div>
  `;
}

function renderFloatingContact() {
  if (document.querySelector("[data-floating-contact]")) {
    return;
  }

  const contact = document.createElement("aside");
  contact.className = "floating-contact";
  contact.setAttribute("data-floating-contact", "");
  contact.setAttribute("aria-label", "Быстрая связь с FAMALL");
  contact.innerHTML = `
    <a class="floating-contact__item floating-contact__item--max btn--max contact-max" href="${maxUrl()}" target="_blank" rel="noopener">MAX</a>
    <a class="floating-contact__item floating-contact__item--whatsapp contact-whatsapp" href="${whatsappUrl()}" target="_blank" rel="noopener">WhatsApp</a>
    <a class="floating-contact__item floating-contact__item--reviews contact-reviews" href="${FAMALL_REVIEWS_URL}" target="_blank" rel="noopener">Отзывы о продукции</a>
  `;
  document.body.append(contact);
}

renderHeader();
renderFooter();
renderFloatingContact();
updateCartCount();
initCatalogPage();
initHomePage();
initProductPage();
initCartPage();
initNewsPage();
initPromoSlots();
