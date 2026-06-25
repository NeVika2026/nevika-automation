import { getBasePath } from "../modules/store.js?v=20260623-1";

export const FAMALL_WORLD_URL = "https://famallworld.com/web";
export const FAMALL_LOGIN_URL = "https://famallworld.com/login";
export const VK_BLOG_URL = "https://vk.ru/famall2026";

const NAV_ITEMS = [
  { id: "catalog", label: "Каталог", href: "pages/catalog/" },
  { id: "brands", label: "Бренды", href: "pages/brands/" },
  { id: "new", label: "Новинки", href: "pages/new/" },
  { id: "hits", label: "Хиты", href: "pages/hits/" },
  { id: "sale", label: "Акции", href: "pages/sale/" },
  { id: "workbook", label: "Купить тетрадь", href: "pages/workbook/" },
  { id: "ai-helper", label: "ИИ-помощник", href: "pages/workbook/#ai-helper" },
  { id: "news", label: "Новости", href: "pages/news/" },
  { id: "reviews", label: "Отзывы", href: "pages/reviews/" },
  { id: "partners", label: "Партнёрам", href: "pages/partners/" },
  { id: "contacts", label: "Контакты", href: "pages/contacts/" },
  { id: "famall-world", label: "Официальный сайт", href: FAMALL_WORLD_URL, external: true },
  { id: "famall-login", label: "Вход дистрибьютора", href: FAMALL_LOGIN_URL, external: true }
];

function isNavActive(item, currentPage) {
  if (item.external || item.href.includes("#")) {
    return false;
  }

  if (item.activeOn) {
    return item.activeOn.includes(currentPage);
  }

  return currentPage === item.id;
}

function resolveHref(item, basePath) {
  if (item.external) {
    return item.href;
  }

  return `${basePath}${item.href}`;
}

function navLinkMarkup(item, basePath, currentPage, className, isMobile = false) {
  const href = resolveHref(item, basePath);
  const activeClass = isNavActive(item, currentPage) ? " is-active" : "";
  const externalClass = item.external && isMobile ? " site-header__mobile-link--external" : "";
  const externalAttrs = item.external ? ' target="_blank" rel="noopener"' : "";

  return `<a class="${className}${activeClass}${externalClass}" href="${href}"${externalAttrs}>${item.label}</a>`;
}

export function buildHeaderMarkup(basePath, currentPage = "home") {
  const navMarkup = NAV_ITEMS
    .map((item) => navLinkMarkup(item, basePath, currentPage, "site-header__link"))
    .join("");

  const mobileNavMarkup = NAV_ITEMS
    .map((item) => navLinkMarkup(item, basePath, currentPage, "site-header__mobile-link", true))
    .join("");

  return `
    <div class="site-header__inner">
      <a class="site-header__brand" href="${basePath}index.html" aria-label="FAMALL — на главную">
        <img class="site-header__logo" src="${basePath}assets/images/famall-logo.png?v=20260607" alt="FAMALL">
      </a>
      <nav class="site-header__nav" aria-label="Основная навигация">
        ${navMarkup}
      </nav>
      <div class="site-header__actions">
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
}

export function bindHeaderMenu(header) {
  const menuButton = header.querySelector(".site-header__burger");

  if (!menuButton || menuButton.dataset.bound === "true") {
    return;
  }

  menuButton.dataset.bound = "true";
  menuButton.addEventListener("click", () => {
    const isOpen = header.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Закрыть меню" : "Открыть меню");
  });
}

export function renderSiteHeader() {
  const header = document.querySelector('[data-component="site-header"]');

  if (!header) {
    return false;
  }

  const basePath = getBasePath();
  const currentPage = document.body.dataset.page || "home";

  header.className = "site-header";
  header.innerHTML = buildHeaderMarkup(basePath, currentPage);
  bindHeaderMenu(header);

  return Boolean(header.innerHTML.trim());
}
