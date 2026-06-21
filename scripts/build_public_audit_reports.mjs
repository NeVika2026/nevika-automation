import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = path.resolve(".");
const products = JSON.parse(await fs.readFile(path.join(root, "data/products.json"), "utf8"));
const validation = JSON.parse(await fs.readFile(path.join(root, "data/catalog-validation-report.json"), "utf8"));
const missingImages = JSON.parse(await fs.readFile(path.join(root, "data/missing-images-report.json"), "utf8"));
const driveRecordsPath = path.join(root, "data/drive-media-report.json");
const driveRecords = fsSync.existsSync(driveRecordsPath)
  ? JSON.parse(await fs.readFile(driveRecordsPath, "utf8"))
  : [];

const priceOutputPath = path.join(root, "catalog-price-validation-report.xlsx");
const imagesOutputPath = path.join(root, "missing-images-report.xlsx");

function col(index) {
  let value = "";
  let n = index;
  while (n > 0) {
    const mod = (n - 1) % 26;
    value = String.fromCharCode(65 + mod) + value;
    n = Math.floor((n - mod) / 26);
  }
  return value;
}

function text(value) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join("; ");
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function importantTokens(value) {
  return new Set(normalize(value).split(" ").filter((token) => token.length >= 5));
}

function sheetHeader(range) {
  range.format.fill = "#202124";
  range.format.font = { color: "#ffffff", bold: true };
  range.format.horizontalAlignment = "center";
  range.format.wrapText = true;
}

function writeTable(sheet, headers, rows, widths = []) {
  const endCol = col(headers.length);
  sheet.getRange(`A1:${endCol}1`).values = [headers];
  sheetHeader(sheet.getRange(`A1:${endCol}1`));
  if (rows.length) {
    sheet.getRange(`A2:${endCol}${rows.length + 1}`).values = rows;
  }
  sheet.getRange(`A1:${endCol}${Math.max(rows.length + 1, 2)}`).format.borders = {
    preset: "all",
    style: "thin",
    color: "#E6E8EC",
  };
  sheet.getRange(`A1:${endCol}${Math.max(rows.length + 1, 2)}`).format.wrapText = true;
  widths.forEach(([range, width]) => {
    sheet.getRange(range).format.columnWidthPx = width;
  });
}

function getImageState(product) {
  const image = product.image || "";
  const exists = Boolean(image && fsSync.existsSync(path.join(root, image)));
  const isReal = product.imageType === "source" && exists && !image.includes("placeholder");
  return { image, exists, isReal };
}

function getImageConfidence(product) {
  if (product.imageType !== "source") return "низкий";
  const method = product.match?.method || "";
  const score = Number(product.match?.score || 0);
  if (method === "exact_name" && score >= 0.98) return "высокий";
  if (method === "type_volume" && score >= 0.88) return "высокий";
  if (method === "brand_keywords" && score >= 0.95) return "средний";
  return "средний";
}

function findVideos(product) {
  const tokens = importantTokens(`${product.brand} ${product.name} ${product.volume}`);
  return driveRecords
    .filter((record) => record.mime?.startsWith("video/"))
    .filter((record) => {
      const candidate = `${record.name} ${record.folderPath}`;
      const candidateTokens = importantTokens(candidate);
      let overlap = 0;
      tokens.forEach((token) => {
        if (candidateTokens.has(token)) overlap += 1;
      });
      return overlap >= 2 || normalize(candidate).includes(normalize(product.brand));
    })
    .slice(0, 3)
    .map((record) => `${record.folderPath}/${record.name}`);
}

async function buildPriceWorkbook() {
  const workbook = Workbook.create();
  const summary = workbook.worksheets.add("Итоги");
  const rows = validation.allProducts.map((item) => {
    const suspicious = validation.suspiciousPrices.find((entry) => entry.id === item.id);
    const corrected = validation.correctedPrices.find((entry) => entry.id === item.id);
    return [
      item.id,
      item.sku,
      item.name,
      products.find((product) => product.id === item.id)?.brand || "",
      item.category,
      item.volume,
      item.retailPrice,
      item.partnerPrice,
      item.retailPrice,
      item.partnerPrice,
      item.pv,
      suspicious ? "ручная проверка" : "корректно",
      suspicious?.reason || corrected?.note || "Цена совпадает со строкой PDF-прайса",
      suspicious ? "да" : "нет",
      item.priceSource,
      item.pricePdfRow,
      item.priceExtractionNote,
    ];
  });

  writeTable(summary, ["Показатель", "Значение", "Комментарий"], [
    ["Источник цен", validation.priceSource, "Единственный источник retailPrice, partnerPrice и PV"],
    ["Проверено товаров", validation.productsChecked, "Все товары текущего каталога"],
    ["Строк PDF разобрано", validation.pdfRowsParsed, "Контроль полноты PDF-прайса"],
    ["Исправлено цен", validation.correctedPricesCount, "Изменения относительно текущего JSON после повторного аудита"],
    ["Подозрительные цены", validation.suspiciousPricesCount, "Партнёрская цена выше розницы или пустая цена"],
    ["Карточек на ручную проверку по цене", validation.suspiciousPrices.length, "Только ценовые риски"],
  ], [["A:A", 260], ["B:B", 420], ["C:C", 520]]);

  const details = workbook.worksheets.add("Проверка цен");
  writeTable(details, [
    "ID",
    "Артикул",
    "Название товара",
    "Бренд",
    "Категория",
    "Объём",
    "Текущая розничная цена",
    "Текущая партнёрская цена",
    "PDF розничная цена",
    "PDF партнёрская цена",
    "PV",
    "Статус проверки",
    "Причина / комментарий",
    "Требуется ручная проверка",
    "Источник цены",
    "Строка PDF",
    "Примечание извлечения PDF",
  ], rows, [
    ["A:B", 112], ["C:C", 420], ["D:D", 130], ["E:E", 220], ["F:F", 120],
    ["G:J", 140], ["K:K", 70], ["L:L", 160], ["M:M", 360], ["N:N", 150],
    ["O:O", 420], ["P:Q", 160],
  ]);
  details.getRange(`G2:J${rows.length + 1}`).format.numberFormat = '#,##0 "₽"';
  details.getRange(`K2:K${rows.length + 1}`).format.numberFormat = "0.0";

  await workbook.inspect({ kind: "table", range: "Итоги!A1:C7", include: "values,formulas", tableMaxRows: 8, tableMaxCols: 3 });
  await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 50 }, summary: "formula error scan" });
  await workbook.render({ sheetName: "Итоги", range: "A1:C7", scale: 2 });
  await workbook.render({ sheetName: "Проверка цен", range: "A1:Q16", scale: 2 });
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(priceOutputPath);
}

async function buildImagesWorkbook() {
  const workbook = Workbook.create();
  const summary = workbook.worksheets.add("Итоги");
  const driveImages = driveRecords.filter((record) => record.mime?.startsWith("image/"));
  const driveVideos = driveRecords.filter((record) => record.mime?.startsWith("video/"));
  const beforeReal = products.filter((product) => getImageState(product).isReal).length;

  writeTable(summary, ["Показатель", "Значение", "Комментарий"], [
    ["Товаров в каталоге", products.length, "Опубликованные товары из PDF-прайса"],
    ["Реальных фото до обработки", beforeReal, "Локальные source-изображения с существующим файлом"],
    ["Реальных фото после обработки", beforeReal, "Drive не содержит доступных файлов изображений"],
    ["Главных фото добавлено", 0, "Новые фото из Google Drive не подключались"],
    ["Галерей создано", 0, "Случайные кадры из видео не извлекались"],
    ["Товаров с заглушкой", products.length - beforeReal, "Нужна ручная загрузка реальных фото"],
    ["Файлов изображений на Drive", driveImages.length, "Рекурсивный обход публичной папки"],
    ["Видео на Drive", driveVideos.length, "Видео не используются как главное фото"],
  ], [["A:A", 250], ["B:B", 180], ["C:C", 520]]);

  const missingById = new Map(missingImages.map((item) => [item.id, item]));
  const rows = products.map((product) => {
    const imageState = getImageState(product);
    const missing = missingById.get(product.id);
    const gallery = (product.gallery || []).map((item) => item.src).filter(Boolean);
    const videos = findVideos(product);
    return [
      product.id,
      product.sku,
      product.name,
      product.brand,
      product.category,
      product.volume || "",
      imageState.isReal ? "да" : "нет",
      imageState.exists ? "да" : "нет",
      driveImages.length ? "требует ручной проверки" : "нет",
      imageState.isReal ? product.image : "",
      product.image || "",
      imageState.isReal ? product.image : "assets/images/products/placeholder.svg",
      gallery.join("; "),
      getImageConfidence(product),
      videos.length ? "да" : "нет",
      videos.join("; "),
      imageState.isReal ? "нет" : "да",
      missing?.reason || (imageState.isReal ? "Фото подключено локально" : "Фото не найдено в доступных источниках"),
    ];
  });

  const details = workbook.worksheets.add("Все товары");
  writeTable(details, [
    "ID",
    "Артикул",
    "Название товара",
    "Бренд",
    "Категория",
    "Объём",
    "Есть фото сейчас",
    "Найдено локально",
    "Найдено на Google Drive",
    "Путь к исходному файлу",
    "Новый путь в проекте",
    "Главное фото",
    "Дополнительные фото галереи",
    "Уверенность сопоставления",
    "Есть видео",
    "Видео / папки Drive",
    "Требуется ручная проверка",
    "Причина",
  ], rows, [
    ["A:B", 110], ["C:C", 420], ["D:D", 120], ["E:E", 220], ["F:F", 120],
    ["G:I", 130], ["J:M", 330], ["N:N", 150], ["O:O", 100], ["P:P", 460],
    ["Q:Q", 150], ["R:R", 420],
  ]);

  const noPhotoRows = rows.filter((row) => row[6] === "нет");
  const noPhoto = workbook.worksheets.add("Без фото");
  writeTable(noPhoto, [
    "ID",
    "Артикул",
    "Название товара",
    "Бренд",
    "Категория",
    "Объём",
    "Причина",
    "Что загрузить вручную",
  ], noPhotoRows.map((row) => [
    row[0],
    row[1],
    row[2],
    row[3],
    row[4],
    row[5],
    row[17],
    `Реальное фото товара ${row[2]} в формате png/jpg/webp/avif`,
  ]), [["A:B", 110], ["C:C", 420], ["D:D", 120], ["E:E", 220], ["F:F", 120], ["G:H", 460]]);

  const drive = workbook.worksheets.add("Drive media");
  writeTable(drive, ["ID", "MIME", "Название", "Папка"], driveRecords.map((record) => [record.id, record.mime, record.name, record.folderPath]), [["A:A", 260], ["B:B", 260], ["C:D", 480]]);

  await workbook.inspect({ kind: "table", range: "Итоги!A1:C9", include: "values,formulas", tableMaxRows: 10, tableMaxCols: 3 });
  await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 50 }, summary: "formula error scan" });
  await workbook.render({ sheetName: "Итоги", range: "A1:C9", scale: 2 });
  await workbook.render({ sheetName: "Все товары", range: "A1:R16", scale: 2 });
  await workbook.render({ sheetName: "Без фото", range: "A1:H16", scale: 2 });
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(imagesOutputPath);
}

await buildPriceWorkbook();
await buildImagesWorkbook();

console.log(JSON.stringify({
  priceOutputPath,
  imagesOutputPath,
  products: products.length,
  driveRecords: driveRecords.length,
}, null, 2));
