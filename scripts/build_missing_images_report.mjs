import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = path.resolve("..");
const productsPath = path.join(root, "data/products.json");
const missingPath = path.join(root, "data/missing-images-report.json");
const importReportPath = path.join(root, "data/import-report.json");
const outputPath = path.join(root, "missing-images-report.xlsx");

const products = JSON.parse(await fs.readFile(productsPath, "utf8"));
const missing = JSON.parse(await fs.readFile(missingPath, "utf8"));
const importReport = JSON.parse(await fs.readFile(importReportPath, "utf8"));

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

function formatSheetHeader(range) {
  range.format.fill = "#202124";
  range.format.font = { color: "#FFFFFF", bold: true };
  range.format.horizontalAlignment = "center";
  range.format.wrapText = true;
}

const workbook = Workbook.create();
const summary = workbook.worksheets.add("Итоги");
const details = workbook.worksheets.add("Товары без фото");

summary.getRange("A1:E1").merge();
summary.getRange("A1").values = [["FAMALL - отчет по товарам без реальных изображений"]];
summary.getRange("A1").format.fill = "#FF2942";
summary.getRange("A1").format.font = { color: "#FFFFFF", bold: true, size: 18 };
summary.getRange("A1").format.horizontalAlignment = "center";
summary.getRange("A1").format.rowHeightPx = 42;

const summaryRows = [
  ["Показатель", "Значение", "Комментарий", "", ""],
  ["Товаров опубликовано", products.length, "Все опубликованные товары взяты из PDF-прайса", "", ""],
  ["Реальных фото найдено", importReport.productsMatchedWithImage, "Из сайтов FAMALL и DOCX-каталога", "", ""],
  ["Товаров без реального фото", missing.length, "Для них созданы премиальные заглушки", "", ""],
  ["Премиальных заглушек создано", importReport.premiumPlaceholdersCreated, "Заглушки уже подключены в products.json", "", ""],
  ["Новинок на странице", importReport.newProductsPageCount, "Коллекция new", "", ""],
  ["Хитов на странице", importReport.hitProductsPageCount, "Коллекция hits", "", ""],
  ["Акций на странице", importReport.saleProductsPageCount, "Коллекция sale", "", ""],
  ["Ручная проверка", importReport.manualReviewCount, "Похожие совпадения не опубликованы как фото без подтверждения", "", ""],
];
summary.getRange(`A3:E${summaryRows.length + 2}`).values = summaryRows;
formatSheetHeader(summary.getRange("A3:E3"));
summary.getRange(`A4:B${summaryRows.length + 2}`).format.borders = { preset: "all", style: "thin", color: "#E6E8EC" };
summary.getRange(`A4:A${summaryRows.length + 2}`).format.font = { bold: true };
summary.getRange(`B4:B${summaryRows.length + 2}`).format.horizontalAlignment = "center";
summary.getRange("A:E").format.columnWidthPx = 180;
summary.getRange("C:C").format.columnWidthPx = 380;
summary.getRange("A3:E12").format.wrapText = true;

const headers = [
  "ID",
  "Артикул",
  "Название",
  "Бренд",
  "Категория",
  "Объем",
  "Розничная цена",
  "Партнерская цена",
  "PV",
  "Созданная заглушка",
  "Где искали",
  "Результат",
  "Следующее действие",
];

const rows = missing.map((item) => [
  item.id,
  item.sku,
  item.name,
  item.brand,
  item.category,
  item.volume || "",
  item.retailPrice,
  item.partnerPrice,
  item.pv,
  item.placeholderImage,
  item.sourcesTried.join("; "),
  item.result,
  item.nextAction,
]);

details.getRange(`A1:${col(headers.length)}1`).values = [headers];
formatSheetHeader(details.getRange(`A1:${col(headers.length)}1`));
if (rows.length) {
  details.getRange(`A2:${col(headers.length)}${rows.length + 1}`).values = rows;
  details.getRange(`A1:${col(headers.length)}${rows.length + 1}`).format.borders = { preset: "all", style: "thin", color: "#E6E8EC" };
  details.getRange(`G2:H${rows.length + 1}`).format.numberFormat = '#,##0 "₽"';
  details.getRange(`I2:I${rows.length + 1}`).format.numberFormat = "0.0";
}

[
  ["A:A", 92],
  ["B:B", 116],
  ["C:C", 380],
  ["D:D", 120],
  ["E:E", 190],
  ["F:F", 110],
  ["G:H", 118],
  ["I:I", 70],
  ["J:J", 280],
  ["K:K", 300],
  ["L:L", 230],
  ["M:M", 360],
].forEach(([range, width]) => {
  details.getRange(range).format.columnWidthPx = width;
});
details.getRange(`A1:${col(headers.length)}${rows.length + 1}`).format.wrapText = true;
details.getRange(`A2:${col(headers.length)}${rows.length + 1}`).format.rowHeightPx = 68;

const summaryCheck = await workbook.inspect({
  kind: "table",
  range: "Итоги!A1:E12",
  include: "values,formulas",
  tableMaxRows: 14,
  tableMaxCols: 6,
});
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
await workbook.render({ sheetName: "Итоги", range: "A1:E12", scale: 2 });
await workbook.render({ sheetName: "Товары без фото", range: "A1:M18", scale: 2 });

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(JSON.stringify({
  outputPath,
  missingRows: rows.length,
  summaryPreview: summaryCheck.ndjson,
  errorScan: errors.ndjson,
}, null, 2));
