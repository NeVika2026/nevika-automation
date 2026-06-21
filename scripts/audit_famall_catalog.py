from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import asdict, dataclass
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
PRICE_PDF = Path("/Users/viktoria/Desktop/ПРАЙС-ЛИСТ FAMALL- новый.pdf")
PRODUCTS_JSON = ROOT / "data/products.json"
CATEGORIES_JSON = ROOT / "data/categories.json"
VALIDATION_REPORT_JSON = ROOT / "data/catalog-validation-report.json"
MISSING_IMAGES_JSON = ROOT / "data/missing-images-report.json"
GENERIC_PLACEHOLDER = "assets/images/products/placeholder.svg"

BRANDS = [
    "BERCLEAN",
    "YIJIAN",
    "LIMANCY",
    "PREDAWN",
    "MIAOROU",
    "MIUBABY",
    "OKFAD",
    "BOCARE",
    "SUTING",
    "MOREFUTURE",
    "CARICH",
    "ILIFE",
    "BEIJING",
    "ХАН",
]


@dataclass
class PriceItem:
    index: int
    name: str
    brand: str
    category: str
    volume: str
    partner_price: int
    retail_price: int
    pv: float
    source_line: str
    extraction_note: str = ""


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).replace("ё", "е").replace("Ё", "Е")
    value = re.sub(r"[^\wа-яА-Я]+", " ", value.lower(), flags=re.UNICODE)
    return re.sub(r"\s+", " ", value).strip()


def slugify(value: str) -> str:
    translit = {
        "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z",
        "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r",
        "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sch",
        "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
    }
    text = "".join(translit.get(char, char) for char in value.lower())
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:90]


def detect_brand(name: str) -> str:
    normalized = normalize_text(name).upper()
    for brand in BRANDS:
        if normalize_text(brand).upper() in normalized:
            return brand.title() if brand not in {"OKFAD", "BOCARE", "SUTING"} else brand
    return "FAMALL"


def split_volume(name: str) -> tuple[str, str]:
    patterns = [
        r"(\d+(?:[.,]\d+)?\s*(?:мл|мг|гр|г|g|шт|штук|рулон(?:а|ов)?|предмет(?:ов|а)?|пакетик(?:ов|а)?|лист(?:ов)?|мм|кг)\.?(?:\s*[*xх/]\s*\d+\s*(?:шт|штук|пакетик(?:ов)?|лист(?:ов)?)?)?)$",
        r"(р-р\s*[\d*хx/ ]+(?:,\s*)?\d*\s*(?:штук|шт)?)$",
        r"(\d+\s*[-–]\s*\d+\s*кг)$",
        r"(\d+)$",
    ]
    cleaned = re.sub(r"\s+", " ", name).strip()
    for pattern in patterns:
        match = re.search(pattern, cleaned, flags=re.IGNORECASE)
        if match:
            volume = match.group(1).strip(" .,")
            product_name = cleaned[: match.start()].strip(" .,")
            if len(product_name) >= 4:
                return product_name, volume
    return cleaned, ""


def repair_pdf_price_extraction(partner_raw: str, retail_price: int) -> tuple[int, str]:
    partner_price = int(partner_raw)
    if partner_price <= retail_price:
        return partner_price, ""

    # pypdf склеивает строку "2,8 гр. 275 500" как "2,8 гр. 2758 500" у позиции 97.
    # Берем цену из PDF-строки, отбрасывая лишнюю последнюю цифру, только если это
    # восстанавливает обязательное правило: партнерская цена ниже розничной.
    if len(partner_raw) >= 4:
        repaired = int(partner_raw[:-1])
        if 0 < repaired < retail_price:
            return repaired, f"Исправлена ошибка извлечения PDF: {partner_raw} -> {repaired}"

    return partner_price, "Подозрительная цена: партнерская цена выше розничной"


def parse_price_pdf() -> list[PriceItem]:
    text = "\n".join((page.extract_text() or "") for page in PdfReader(str(PRICE_PDF)).pages)
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    items: list[PriceItem] = []
    category = ""
    current_number = 1
    buffer: list[str] = []

    def flush() -> None:
        nonlocal buffer, current_number
        if not buffer:
            return

        raw = " ".join(buffer)
        raw = re.sub(r"\s+", " ", raw).strip()
        raw = re.sub(rf"^{current_number}\s*", "", raw)
        match = re.search(r"(.+?)\s+(\d+)\s+(\d+)\s+(\d+(?:,\d+)?)$", raw)

        if not match:
            buffer = []
            current_number += 1
            return

        name_with_volume = match.group(1).strip()
        partner_price, extraction_note = repair_pdf_price_extraction(match.group(2), int(match.group(3)))
        name, volume = split_volume(name_with_volume)
        items.append(
            PriceItem(
                index=current_number,
                name=name,
                brand=detect_brand(name),
                category=category or "FAMALL",
                volume=volume,
                partner_price=partner_price,
                retail_price=int(match.group(3)),
                pv=float(match.group(4).replace(",", ".")),
                source_line=raw,
                extraction_note=extraction_note,
            )
        )
        buffer = []
        current_number += 1

    for line in lines:
        if line.startswith("ПРАЙС") or line.startswith("Наименование") or line.startswith("Цена "):
            continue

        category_line = not re.match(r"^\d{1,3}\s*", line) and not re.search(r"\d+\s+\d+\s+\d+(?:,\d+)?$", line)
        if category_line and line.upper() == line:
            flush()
            category = line.replace("СЕРИЯ", "").replace('"', "").strip(" :")
            continue

        number_match = re.match(r"^(\d{1,3})(.*)$", line)
        if number_match:
            number = int(number_match.group(1))
            if number == current_number:
                flush()
                buffer = [line]
                if re.search(r"\d+\s+\d+\s+\d+(?:,\d+)?$", line):
                    flush()
                continue

        if buffer:
            buffer.append(line)
            if re.search(r"\d+\s+\d+\s+\d+(?:,\d+)?$", line):
                flush()

    flush()
    return items


def is_placeholder(product: dict) -> bool:
    image = str(product.get("image") or "")
    return not image or product.get("imageType") != "source" or "placeholder" in image


def is_description_missing(product: dict) -> bool:
    description = str(product.get("description") or "").strip()
    return not description or "Описание будет дополнено" in description


def is_confident_image_match(product: dict) -> tuple[bool, str]:
    if product.get("imageType") != "source":
        return False, "Фото отсутствует или является заглушкой"

    match = product.get("match") or {}
    method = match.get("method")
    score = float(match.get("score") or 0)
    source_name = str(match.get("sourceName") or "")
    product_name = str(product.get("name") or "")

    if method == "exact_name" and score >= 0.98:
        return True, "Точное совпадение названия"
    if method == "type_volume" and score >= 0.88:
        return True, "Совпали тип товара и объём"
    if method == "brand_keywords" and score >= 0.95:
        product_tokens = set(normalize_text(product_name).split())
        source_tokens = set(normalize_text(source_name).split())
        meaningful = {token for token in product_tokens if len(token) > 4}
        if len(meaningful & source_tokens) >= max(2, min(4, len(meaningful))):
            return True, "Совпали бренд и ключевые слова"

    return False, f"Неуверенное фото-сопоставление: method={method}, score={score}, source={source_name}"


def update_characteristics(product: dict, price: PriceItem) -> None:
    product["characteristics"] = [
        {"label": "Артикул", "value": f"FAMALL-{price.index:03d}"},
        {"label": "Бренд", "value": price.brand},
        {"label": "Категория", "value": price.category},
        {"label": "Объём", "value": price.volume or "уточняется"},
        {"label": "PV", "value": str(price.pv).replace(".", ",")},
        {"label": "Наличие", "value": "В наличии"},
    ]


def main() -> None:
    products = json.loads(PRODUCTS_JSON.read_text(encoding="utf-8"))
    prices = parse_price_pdf()
    prices_by_index = {price.index: price for price in prices}
    corrected_prices = []
    suspicious_prices = []
    correct_prices = []
    missing_images = []
    missing_descriptions = []
    uncertain_matches = []
    manual_review = []
    all_rows = []
    fixed_price_count = 0

    for product in products:
        index = int(str(product["id"]).split("-")[-1])
        price = prices_by_index.get(index)

        if not price:
            product["status"] = "manual_review"
            manual_review.append({
                "id": product["id"],
                "name": product["name"],
                "reason": "Не найдена строка в PDF-прайсе по номеру товара",
            })
            continue

        old_retail = product.get("retailPrice")
        old_partner = product.get("partnerPrice")
        if old_retail != price.retail_price or old_partner != price.partner_price:
            fixed_price_count += 1
            corrected_prices.append({
                "id": product["id"],
                "name": price.name,
                "oldRetailPrice": old_retail,
                "oldPartnerPrice": old_partner,
                "newRetailPrice": price.retail_price,
                "newPartnerPrice": price.partner_price,
                "source": str(PRICE_PDF),
                "note": price.extraction_note,
            })

        product.update({
            "sku": f"FAMALL-{price.index:03d}",
            "slug": slugify(f"{price.index}-{price.name}"),
            "name": price.name,
            "brand": price.brand,
            "category": price.category,
            "volume": price.volume,
            "retailPrice": price.retail_price,
            "partnerPrice": price.partner_price,
            "pv": price.pv,
            "discountPercent": round((1 - price.partner_price / price.retail_price) * 100) if price.retail_price else 0,
            "priceSource": {
                "type": "PDF",
                "file": str(PRICE_PDF),
                "pdfRow": price.index,
                "sourceLine": price.source_line,
                "extractionNote": price.extraction_note,
            },
        })
        update_characteristics(product, price)

        if price.partner_price > price.retail_price or price.retail_price <= 0 or price.partner_price <= 0:
            product["status"] = "manual_review"
            suspicious_prices.append({
                "id": product["id"],
                "name": product["name"],
                "retailPrice": product["retailPrice"],
                "partnerPrice": product["partnerPrice"],
                "reason": "Цена не прошла обязательную валидацию",
                "source": str(PRICE_PDF),
                "sourceLine": price.source_line,
            })
            manual_review.append({
                "id": product["id"],
                "name": product["name"],
                "reason": "Цена не прошла обязательную валидацию",
            })
        else:
            correct_prices.append({
                "id": product["id"],
                "name": product["name"],
                "retailPrice": product["retailPrice"],
                "partnerPrice": product["partnerPrice"],
                "pv": product["pv"],
                "source": str(PRICE_PDF),
                "sourceLine": price.source_line,
            })

        confident_image, image_reason = is_confident_image_match(product)
        if not confident_image:
            previous_image = product.get("image")
            if not is_placeholder(product):
                product["image"] = GENERIC_PLACEHOLDER
                product["imageType"] = "premium_placeholder"
                product["gallery"] = [{"type": "premium_placeholder", "src": GENERIC_PLACEHOLDER, "alt": product["name"]}]
            product["status"] = "need_image" if product.get("status") != "manual_review" else "manual_review"
            missing_images.append({
                "id": product["id"],
                "sku": product["sku"],
                "name": product["name"],
                "brand": product["brand"],
                "category": product["category"],
                "volume": product["volume"],
                "retailPrice": product["retailPrice"],
                "partnerPrice": product["partnerPrice"],
                "pv": product["pv"],
                "currentImage": product.get("image"),
                "previousImage": previous_image,
                "match": product.get("match"),
                "reason": image_reason,
                "sourcesChecked": [
                    "DOCX-каталог",
                    "famallnetwork62.orgs.biz",
                    "famall-ufa.taplink.ws",
                ],
                "nextAction": "Нужна ручная проверка фото или загрузка корректного изображения.",
            })
            if product.get("match", {}).get("method") not in {None, "none"}:
                uncertain_matches.append({
                    "id": product["id"],
                    "name": product["name"],
                    "field": "image",
                    "reason": image_reason,
                    "match": product.get("match"),
                })
        elif product.get("status") == "need_image":
            product["status"] = "published"

        if is_description_missing(product):
            missing_descriptions.append({
                "id": product["id"],
                "name": product["name"],
                "category": product["category"],
                "reason": "Описание отсутствует или является временным текстом",
            })

        all_rows.append({
            "id": product["id"],
            "sku": product["sku"],
            "name": product["name"],
            "category": product["category"],
            "volume": product["volume"],
            "retailPrice": product["retailPrice"],
            "partnerPrice": product["partnerPrice"],
            "pv": product["pv"],
            "image": product.get("image"),
            "imageType": product.get("imageType"),
            "status": product.get("status"),
            "hasDescription": not is_description_missing(product),
            "priceSource": str(PRICE_PDF),
            "pricePdfRow": price.index,
            "priceExtractionNote": price.extraction_note,
        })

    products.sort(key=lambda item: int(str(item["id"]).split("-")[-1]))
    PRODUCTS_JSON.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")

    categories = []
    seen_categories = set()
    for product in products:
        category = product["category"]
        if category in seen_categories:
            continue
        seen_categories.add(category)
        categories.append({"id": slugify(category), "name": category, "slug": slugify(category)})
    CATEGORIES_JSON.write_text(json.dumps(categories, ensure_ascii=False, indent=2), encoding="utf-8")

    MISSING_IMAGES_JSON.write_text(json.dumps(missing_images, ensure_ascii=False, indent=2), encoding="utf-8")

    report = {
        "generatedAt": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "priceSource": str(PRICE_PDF),
        "pricePolicy": "PDF-прайс является единственным источником retailPrice, partnerPrice и PV.",
        "productsChecked": len(products),
        "pdfRowsParsed": len(prices),
        "correctPricesCount": len(correct_prices),
        "correctedPricesCount": len(corrected_prices),
        "suspiciousPricesCount": len(suspicious_prices),
        "missingImagesCount": len(missing_images),
        "missingDescriptionsCount": len(missing_descriptions),
        "uncertainMatchesCount": len(uncertain_matches),
        "manualReviewCount": len(manual_review) + len(uncertain_matches),
        "publicPartnerPricesHidden": bool(suspicious_prices),
        "correctPrices": correct_prices,
        "correctedPrices": corrected_prices,
        "suspiciousPrices": suspicious_prices,
        "missingImages": missing_images,
        "missingDescriptions": missing_descriptions,
        "uncertainMatches": uncertain_matches,
        "manualReview": manual_review,
        "allProducts": all_rows,
    }
    VALIDATION_REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "productsChecked": report["productsChecked"],
        "pdfRowsParsed": report["pdfRowsParsed"],
        "correctedPricesCount": report["correctedPricesCount"],
        "suspiciousPricesCount": report["suspiciousPricesCount"],
        "missingImagesCount": report["missingImagesCount"],
        "missingDescriptionsCount": report["missingDescriptionsCount"],
        "uncertainMatchesCount": report["uncertainMatchesCount"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
