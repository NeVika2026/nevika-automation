import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = path.resolve(".");
const validationPath = path.join(root, "data/catalog-validation-report.json");
const missingPath = path.join(root, "data/missing-images-report.json");
const validationOutputPath = path.join(root, "catalog-validation-report.xlsx");
const missingOutputPath = path.join(root, "missing-images-report.xlsx");

const report = JSON.parse(await fs.readFile(validationPath, "utf8"));
const missingImages = JSON.parse(await fs.readFile(missingPath, "utf8"));

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
  if (typeof value === "object") return JSON.stringify(value, null, 0);
  return value;
}

function formatHeader(range) {
  range.format.fill = "#202124";
  range.format.font = { color: "#FFFFFF", bold: true };
  range.format.horizontalAlignment = "center";
  range.format.wrapText = true;
}

function writeTable(sheet, headers, rows, options = {}) {
  const endCol = col(headers.length);
  sheet.getRange(`A1:${endCol}1`).values = [headers];
  formatHeader(sheet.getRange(`A1:${endCol}1`));
  if (rows.length) {
    sheet.getRange(`A2:${endCol}${rows.length + 1}`).values = rows;
  }
  sheet.getRange(`A1:${endCol}${Math.max(rows.length + 1, 2)}`).format.borders = {
    preset: "all",
    style: "thin",
    color: "#E6E8EC",
  };
  sheet.getRange(`A1:${endCol}${Math.max(rows.length + 1, 2)}`).format.wrapText = true;
  for (const [range, width] of options.widths || []) {
    sheet.getRange(range).format.columnWidthPx = width;
  }
  for (const range of options.moneyRanges || []) {
    sheet.getRange(range).format.numberFormat = '#,##0 "₽"';
  }
  for (const range of options.numberRanges || []) {
    sheet.getRange(range).format.numberFormat = "0.0";
  }
}

async function buildValidationWorkbook() {
  const workbook = Workbook.create();
  const summary = workbook.worksheets.add("Итоги");

  summary.getRange("A1:F1").merge();
  summary.getRange("A1").values = [["FAMALL - аудит каталога и цен"]];
  summary.getRange("A1").format.fill = "#FF2942";
  summary.getRange("A1").format.font = { color: "#FFFFFF", bold: true, size: 18 };
  summary.getRange("A1").format.horizontalAlignment = "center";
  summary.getRange("A1").format.rowHeightPx = 42;

  const summaryRows = [
    ["Показатель", "Значение", "Комментарий", "", "", ""],
    ["Дата отчета", report.generatedAt, "Сгенерировано после полного аудита 105 товаров", "", "", ""],
    ["Источник цен", report.priceSource, "Единственный источник retailPrice, partnerPrice и PV", "", "", ""],
    ["Проверено товаров", report.productsChecked, "Все товары из текущего products.json", "", "", ""],
    ["Строк PDF разобрано", report.pdfRowsParsed, "Контроль полноты прайса", "", "", ""],
    ["Исправлено цен", report.correctedPricesCount, "Расхождения между текущим каталогом и PDF", "", "", ""],
    ["Подозрительные цены", report.suspiciousPricesCount, "После исправления обязательная валидация пройдена", "", "", ""],
    ["Товары без уверенного фото", report.missingImagesCount, "Фото заменено заглушкой или отсутствовало", "", "", ""],
    ["Товары без описания", report.missingDescriptionsCount, "Описание отсутствует или временное", "", "", ""],
    ["Неуверенные сопоставления", report.uncertainMatchesCount, "Требуют ручной проверки", "", "", ""],
    ["Партнёрские цены на сайте", report.publicPartnerPricesHidden ? "Скрыты" : "Показаны", "До завершения проверки не выводятся публично", "", "", ""],
  ];
  summary.getRange(`A3:F${summaryRows.length + 2}`).values = summaryRows;
  formatHeader(summary.getRange("A3:F3"));
  summary.getRange(`A4:F${summaryRows.length + 2}`).format.borders = { preset: "all", style: "thin", color: "#E6E8EC" };
  summary.getRange(`A4:A${summaryRows.length + 2}`).format.font = { bold: true };
  summary.getRange("A:A").format.columnWidthPx = 230;
  summary.getRange("B:B").format.columnWidthPx = 210;
  summary.getRange("C:C").format.columnWidthPx = 460;
  summary.getRange("A3:F14").format.wrapText = true;

  const allProducts = workbook.worksheets.add("Все товары");
  writeTable(
    allProducts,
    ["ID", "Артикул", "Название", "Категория", "Объём", "Розница", "Партнёрская", "PV", "Фото", "Тип фото", "Статус", "Описание", "Источник цены", "Строка PDF", "Примечание"],
    report.allProducts.map((item) => [
      item.id,
      item.sku,
      item.name,
      item.category,
      item.volume,
      item.retailPrice,
      item.partnerPrice,
      item.pv,
      item.image,
      item.imageType,
      item.status,
      item.hasDescription ? "есть" : "нет",
      item.priceSource,
      item.pricePdfRow,
      item.priceExtractionNote,
    ]),
    {
      widths: [["A:B", 112], ["C:C", 380], ["D:D", 210], ["E:E", 120], ["F:G", 120], ["H:H", 70], ["I:I", 310], ["J:K", 150], ["L:L", 110], ["M:M", 360], ["N:N", 90], ["O:O", 260]],
      moneyRanges: [`F2:G${report.allProducts.length + 1}`],
      numberRanges: [`H2:H${report.allProducts.length + 1}`],
    }
  );

  const corrected = workbook.worksheets.add("Исправленные цены");
  writeTable(
    corrected,
    ["ID", "Название", "Старая розница", "Старая партнёрская", "Новая розница", "Новая партнёрская", "Источник", "Примечание"],
    report.correctedPrices.map((item) => [
      item.id,
      item.name,
      item.oldRetailPrice,
      item.oldPartnerPrice,
      item.newRetailPrice,
      item.newPartnerPrice,
      item.source,
      item.note,
    ]),
    {
      widths: [["A:A", 110], ["B:B", 430], ["C:F", 130], ["G:G", 360], ["H:H", 300]],
      moneyRanges: [`C2:F${Math.max(report.correctedPrices.length + 1, 2)}`],
    }
  );

  const suspicious = workbook.worksheets.add("Подозрительные цены");
  writeTable(
    suspicious,
    ["ID", "Название", "Розница", "Партнёрская", "Причина", "Источник", "Строка PDF"],
    report.suspiciousPrices.map((item) => [
      item.id,
      item.name,
      item.retailPrice,
      item.partnerPrice,
      item.reason,
      item.source,
      item.sourceLine,
    ]),
    {
      widths: [["A:A", 110], ["B:B", 430], ["C:D", 120], ["E:E", 300], ["F:G", 360]],
      moneyRanges: [`C2:D${Math.max(report.suspiciousPrices.length + 1, 2)}`],
    }
  );

  const noImages = workbook.worksheets.add("Без фото");
  writeTable(
    noImages,
    ["ID", "Артикул", "Название", "Бренд", "Категория", "Объём", "Розница", "Партнёрская", "PV", "Текущее фото", "Предыдущее фото", "Причина", "Следующее действие"],
    report.missingImages.map((item) => [
      item.id,
      item.sku,
      item.name,
      item.brand,
      item.category,
      item.volume,
      item.retailPrice,
      item.partnerPrice,
      item.pv,
      item.currentImage,
      item.previousImage,
      item.reason,
      item.nextAction,
    ]),
    {
      widths: [["A:B", 110], ["C:C", 390], ["D:D", 120], ["E:E", 190], ["F:F", 110], ["G:H", 120], ["I:I", 70], ["J:K", 300], ["L:M", 360]],
      moneyRanges: [`G2:H${Math.max(report.missingImages.length + 1, 2)}`],
      numberRanges: [`I2:I${Math.max(report.missingImages.length + 1, 2)}`],
    }
  );

  const noDescriptions = workbook.worksheets.add("Без описания");
  writeTable(
    noDescriptions,
    ["ID", "Название", "Категория", "Причина"],
    report.missingDescriptions.map((item) => [item.id, item.name, item.category, item.reason]),
    { widths: [["A:A", 110], ["B:B", 430], ["C:C", 220], ["D:D", 360]] }
  );

  const manual = workbook.worksheets.add("Ручная проверка");
  writeTable(
    manual,
    ["ID", "Название", "Поле", "Причина", "Сопоставление"],
    report.uncertainMatches.map((item) => [item.id, item.name, item.field, item.reason, text(item.match)]),
    { widths: [["A:A", 110], ["B:B", 430], ["C:C", 120], ["D:D", 420], ["E:E", 460]] }
  );

  await workbook.inspect({ kind: "table", range: "Итоги!A1:F14", include: "values,formulas", tableMaxRows: 16, tableMaxCols: 6 });
  await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 300 },
    summary: "final formula error scan",
  });
  await workbook.render({ sheetName: "Итоги", range: "A1:F14", scale: 2 });
  await workbook.render({ sheetName: "Все товары", range: "A1:O18", scale: 2 });
  await workbook.render({ sheetName: "Без фото", range: "A1:M18", scale: 2 });

  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(validationOutputPath);
}

async function buildMissingWorkbook() {
  const workbook = Workbook.create();
  const summary = workbook.worksheets.add("Итоги");
  summary.getRange("A1:E1").merge();
  summary.getRange("A1").values = [["FAMALL - товары без уверенного изображения"]];
  summary.getRange("A1").format.fill = "#FF2942";
  summary.getRange("A1").format.font = { color: "#FFFFFF", bold: true, size: 18 };
  summary.getRange("A1").format.horizontalAlignment = "center";
  summary.getRange("A1").format.rowHeightPx = 42;

  const summaryRows = [
    ["Показатель", "Значение", "Комментарий", "", ""],
    ["Товаров без уверенного фото", missingImages.length, "Фото отсутствует или сопоставление не прошло строгую проверку", "", ""],
    ["Источники проверки", "DOCX, famallnetwork62.orgs.biz, Taplink", "Неуверенные фото не используются публично", "", ""],
  ];
  summary.getRange("A3:E5").values = summaryRows;
  formatHeader(summary.getRange("A3:E3"));
  summary.getRange("A3:E5").format.borders = { preset: "all", style: "thin", color: "#E6E8EC" };
  summary.getRange("A:A").format.columnWidthPx = 240;
  summary.getRange("B:B").format.columnWidthPx = 260;
  summary.getRange("C:C").format.columnWidthPx = 440;

  const details = workbook.worksheets.add("Товары без фото");
  writeTable(
    details,
    ["ID", "Артикул", "Название", "Бренд", "Категория", "Объём", "Розница", "Партнёрская", "PV", "Текущее фото", "Предыдущее фото", "Причина", "Источники", "Следующее действие"],
    missingImages.map((item) => [
      item.id,
      item.sku,
      item.name,
      item.brand,
      item.category,
      item.volume,
      item.retailPrice,
      item.partnerPrice,
      item.pv,
      item.currentImage,
      item.previousImage,
      item.reason,
      (item.sourcesChecked || []).join("; "),
      item.nextAction,
    ]),
    {
      widths: [["A:B", 110], ["C:C", 390], ["D:D", 120], ["E:E", 190], ["F:F", 110], ["G:H", 120], ["I:I", 70], ["J:K", 300], ["L:L", 380], ["M:N", 340]],
      moneyRanges: [`G2:H${Math.max(missingImages.length + 1, 2)}`],
      numberRanges: [`I2:I${Math.max(missingImages.length + 1, 2)}`],
    }
  );

  await workbook.inspect({ kind: "table", range: "Итоги!A1:E6", include: "values,formulas", tableMaxRows: 8, tableMaxCols: 5 });
  await workbook.render({ sheetName: "Итоги", range: "A1:E6", scale: 2 });
  await workbook.render({ sheetName: "Товары без фото", range: "A1:N18", scale: 2 });

  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(missingOutputPath);
}

await buildValidationWorkbook();
await buildMissingWorkbook();

console.log(JSON.stringify({
  validationOutputPath,
  missingOutputPath,
  productsChecked: report.productsChecked,
  correctedPrices: report.correctedPricesCount,
  missingImages: missingImages.length,
}, null, 2));
