import { getBasePath } from "../modules/store.js?v=20260619-2";

export function buildFooterMarkup(basePath) {
  const year = new Date().getFullYear();

  return `
    <div class="site-footer__inner site-footer__inner--compact">
      <div class="site-footer__brand">
        <img class="site-footer__logo" src="${basePath}assets/images/famall-logo.png?v=20260607" alt="FAMALL">
        <p>© ${year} FAMALL</p>
        <p>ИП Демьяненко Виктория Александровна</p>
        <p>ИНН 861101191064</p>
        <p><a href="mailto:info@famall.online">info@famall.online</a></p>
      </div>
    </div>
    <nav class="site-footer__legal" aria-label="Юридическая информация">
      <a href="${basePath}pages/oferta/">Публичная оферта</a>
      <a href="${basePath}pages/privacy/">Политика конфиденциальности</a>
      <a href="${basePath}pages/consent/">Согласие на обработку персональных данных</a>
      <a href="${basePath}pages/marketing-consent/">Согласие на информационные сообщения</a>
      <a href="${basePath}pages/refund/">Возврат и отмена</a>
      <a href="${basePath}pages/requisites/">Реквизиты</a>
    </nav>
  `;
}

export function renderSiteFooter() {
  const footer = document.querySelector('[data-component="site-footer"]');

  if (!footer) {
    return false;
  }

  footer.className = "site-footer";
  footer.innerHTML = buildFooterMarkup(getBasePath());

  return Boolean(footer.innerHTML.trim());
}
