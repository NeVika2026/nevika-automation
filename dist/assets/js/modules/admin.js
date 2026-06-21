export function initAdminPage() {
  const log = document.querySelector("[data-admin-log]");
  const actions = document.querySelector("[data-admin-actions]");
  const newsForm = document.querySelector("[data-news-form]");

  if (!log || !actions) {
    return;
  }

  function addLog(message) {
    const item = document.createElement("li");
    item.textContent = `${new Date().toLocaleTimeString("ru-RU")} - ${message}`;
    log.prepend(item);
  }

  actions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-admin-action]");

    if (!button) {
      return;
    }

    const message = button.dataset.adminAction;
    addLog(`${message}: UX готов. Реальная обработка файлов будет подключена позже.`);
  });

  actions.addEventListener("change", (event) => {
    const input = event.target.closest("[data-admin-file]");

    if (!input || !input.files.length) {
      return;
    }

    const label = input.dataset.adminFile === "catalog" ? "Каталог FAMALL" : "Прайс России";
    addLog(`${label}: выбран файл "${input.files[0].name}".`);
  });

  if (newsForm) {
    newsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(newsForm);
      const title = String(formData.get("title") || "").trim() || "Новость без заголовка";
      addLog(`Новость "${title}" подготовлена к публикации. Запись в JSON подключим позже.`);
      newsForm.reset();
    });
  }
}
