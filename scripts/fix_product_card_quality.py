#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_PATH = ROOT / "data/products.json"
CATEGORIES_PATH = ROOT / "data/categories.json"
CSV_PATH = ROOT / "data/famall-products-clean.csv"
REPORT_PATH = ROOT / "data/catalog-card-quality-report.json"
BASELINE_PRODUCTS_PATH = ROOT / "data/products.before-catalog-images.json"
PLACEHOLDER_IMAGE = "assets/images/products/placeholder.svg"


CATEGORY_ORDER = [
    "Уход за домом",
    "Личная гигиена",
    "Гигиена полости рта",
    "Салфетки и бумаги",
    "Детский уход",
    "Уходовая косметика",
    "Декоративная косметика",
    "Уход за волосами",
    "Парфюм",
    "Продукты и пищевые добавки",
]


DISPLAY_NAMES = {
    "famall-002": "BERCLEAN средство для посуды, лимон",
    "famall-004": "BERCLEAN средство для посуды, бамбук",
    "famall-006": "Пищевые пакеты для хранения 25x35",
    "famall-007": "Набор салфеток для уборки, 3 шт.",
    "famall-010": "MIAOROU детские влажные салфетки",
    "famall-011": "MIAOROU влажные салфетки для кухни",
    "famall-019": "Гранулы для очистки труб",
    "famall-020": "Гель для чистки унитаза",
    "famall-022": "YIJIAN COOL паста Лунцзин и мята",
    "famall-028": "YIJIAN ферментная паста для десен",
    "famall-029": "Miubaby детская зубная паста",
    "famall-032": "OKFAD зубные щетки, 2 шт.",
    "famall-033": "LIMANCY массажная жидкость с травами",
    "famall-035": "LIMANCY крем для рук, фруктовый микс",
    "famall-040": "PREDAWN пластыри для стоп с травами",
    "famall-041": "LIMANCY лосьон для тела",
    "famall-045": "LIMANCY шампунь против перхоти",
    "famall-047": "LIMANCY питательный шампунь с шелком",
    "famall-052": "LIMANCY эфирное масло для волос",
    "famall-053": "LIMANCY солнцезащитный крем SPF50",
    "famall-057": "LIMANCY кондиционер с полынью",
    "famall-058": "LIMANCY гель для душа с шелком",
    "famall-060": "LIMANCY гель для душа с молоком",
    "famall-061": "LIMANCY маска для лица с женьшенем",
    "famall-063": "LIMANCY маска для лица с гранатом",
    "famall-064": "LIMANCY маска для лица с огурцом",
    "famall-065": "LIMANCY тоник с гиалуроновой кислотой №1",
    "famall-066": "LIMANCY гидрогель с гиалуроновой кислотой №2",
    "famall-067": "LIMANCY сыворотка с гиалуроновой кислотой №3",
    "famall-068": "LIMANCY мыло с древесным углем",
    "famall-069": "BERCLEAN жидкое мыло с алоэ",
    "famall-070": "BERCLEAN жидкое мыло с ромашкой",
    "famall-071": "BERCLEAN антибактериальное мыло для белья",
    "famall-072": "BERCLEAN детское мыло",
    "famall-073": "LIMANCY гель с алоэ вера",
    "famall-076": "LIMANCY очищающее средство с алоэ",
    "famall-077": "LIMANCY гель для душа с молоком",
    "famall-078": "LIMANCY мужские духи 50 мл",
    "famall-079": "LIMANCY духи №1",
    "famall-080": "LIMANCY Diva Parfum",
    "famall-081": "BOCARE мужской спрей",
    "famall-082": "SUTING ночные прокладки 360 мм",
    "famall-083": "SUTING ночные прокладки Ultra 360 мм",
    "famall-084": "SUTING дневные прокладки с бамбуком",
    "famall-085": "SUTING ежедневные прокладки с бамбуком",
    "famall-086": "BOCARE вкладыши для женщин",
    "famall-087": "BOCARE вкладыши для мужчин",
    "famall-088": "Miaorou детские очищающие салфетки",
    "famall-090": "Miubaby средство для стирки детских вещей",
    "famall-091": "Miubaby детский шампунь и гель",
    "famall-092": "YIJIAN детская зубная щетка",
    "famall-093": "BERCLEAN детское мыло",
    "famall-094": "LIMANCY CC-кушон 001 с запасным блоком",
    "famall-095": "LIMANCY CC-кушон 002 с запасным блоком",
    "famall-096": "LIMANCY крем для тела и лица",
    "famall-097": "LIMANCY бальзам для губ с оттенком",
    "famall-098": "LIMANCY бальзам для губ с алоэ",
    "famall-099": "MOREFUTURE пробиотический напиток",
    "famall-100": "MOREFUTURE кофе с женьшенем",
    "famall-101": "MOREFUTURE витаминные конфеты",
    "famall-102": "MOREFUTURE чай из кукурузных рылец",
    "famall-103": "Miao Rou бамбуковая бумага в рулонах",
    "famall-104": "Miao Rou детские влажные салфетки",
    "famall-105": "Miao Rou бамбуковые платочки",
}


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.lower().replace("ё", "е")).strip()


def slugify(value: str) -> str:
    translit = {
        "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e",
        "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l",
        "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s",
        "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "c", "ч": "ch",
        "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e",
        "ю": "yu", "я": "ya",
    }
    value = "".join(translit.get(ch, ch) for ch in value.lower())
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def clean_display_name(product: dict) -> str:
    if product["id"] in DISPLAY_NAMES:
        return DISPLAY_NAMES[product["id"]]

    name = re.sub(r"\s+", " ", product["name"]).strip()
    name = name.replace("Г ель", "Гель").replace("Травянная", "Травяная")
    name = name.replace("Витаминый", "Витаминные").replace("мужин", "мужчин")

    replacements = [
        ("Увлажняющий воздушный", ""),
        ("Питательный и увлажняющий", ""),
        ("Разглаживающий", ""),
        ("Восстанавливающий", ""),
        ("специальное", ""),
        ("сильной прочищающей способностью", ""),
        ("натурального цвета", ""),
    ]
    for before, after in replacements:
        name = name.replace(before, after)
    name = re.sub(r"\s+", " ", name).strip()

    if len(name) <= 68:
        return name

    words = name.split()
    compact = []
    for word in words:
        if len(" ".join(compact + [word])) > 68:
            break
        compact.append(word)
    return " ".join(compact).rstrip(" ,/-") + "..."


def category_for(product: dict) -> str:
    text = normalize_text(" ".join([
        product.get("name", ""),
        product.get("brand", ""),
        product.get("category", ""),
    ]))

    is_child = any(word in text for word in ["детск", "miubaby", "miu baby", "baby"])
    if is_child and any(word in text for word in ["салфет", "шампун", "мыло", "крем", "зуб", "стирк", "гель"]):
        return "Детский уход"

    if any(word in text for word in ["салфет", "бумаг", "платоч", "полотенц", "бамбукового волокна"]):
        return "Салфетки и бумаги"

    if any(word in text for word in ["посуд", "стирк", "унитаз", "труб", "барабан", "шарик", "бель", "пакет", "уборк"]):
        return "Уход за домом"

    if any(word in text for word in ["зуб", "щетк", "полости рта"]):
        return "Гигиена полости рта"

    if any(word in text for word in ["духи", "parfum", "парфюм"]):
        return "Парфюм"

    if any(word in text for word in ["кушон", "подводк", "помад", "карандаш", "cc-", "cc "]) or ("бальзам для губ" in text and "оттен" in text):
        return "Декоративная косметика"

    if any(word in text for word in ["шампун", "кондиционер", "волос"]):
        return "Уход за волосами"

    if any(word in text for word in ["проклад", "вкладыш", "интим", "антиперспирант", "мыло", "гель для душа"]):
        return "Личная гигиена"

    if any(word in text for word in [
        "крем", "лосьон", "сыворот", "тоник", "гидрогель", "маск", "алоэ",
        "пилинг", "эссенц", "солнцезащит", "очищающ", "очищен", "массажная жидкость",
        "пластыри", "бальзам для губ",
    ]):
        return "Уходовая косметика"

    if any(word in text for word in ["кофе", "чай", "пробиот", "витамин", "конфет", "morefuture"]):
        return "Продукты и пищевые добавки"

    return product.get("category", "").capitalize() or "Уход за домом"


def is_placeholder(product: dict) -> bool:
    image = str(product.get("image", ""))
    return (
        not image
        or "placeholder" in image
        or "placeholders/" in image
        or product.get("status") == "need_image"
        or "placeholder" in str(product.get("imageType", ""))
    )


def mark_bad_catalog_rows(rejected_stems: set[str]) -> int:
    if not CSV_PATH.exists():
        return 0

    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as file:
        rows = list(csv.DictReader(file))
        fieldnames = file.seek(0) or list(csv.DictReader(file).fieldnames or [])

    changed = 0
    for row in rows:
        image_stem = Path(row.get("image", "")).stem
        if row.get("id") in rejected_stems or image_stem in rejected_stems:
            if row.get("needs_review") != "true":
                row["needs_review"] = "true"
                changed += 1

    with CSV_PATH.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return changed


def main() -> None:
    products = json.loads(PRODUCTS_PATH.read_text(encoding="utf-8"))
    baseline = {}
    if BASELINE_PRODUCTS_PATH.exists():
        baseline = {
            product["id"]: product
            for product in json.loads(BASELINE_PRODUCTS_PATH.read_text(encoding="utf-8"))
        }
    category_changes = []
    rejected_images = []
    renamed_for_grid = []
    rejected_stems: set[str] = set()

    for product in products:
        original_category = product.get("category", "")
        normalized_category = category_for(product)
        baseline_category = baseline.get(product["id"], {}).get("category", original_category)
        if normalized_category != baseline_category:
            category_changes.append({
                "id": product["id"],
                "name": product["name"],
                "from": baseline_category,
                "to": normalized_category,
            })
        if normalized_category != original_category:
            product["category"] = normalized_category

        product.setdefault("fullName", product["name"])
        display_name = clean_display_name(product)
        if display_name != product["name"]:
            product["displayName"] = display_name
            renamed_for_grid.append({
                "id": product["id"],
                "fullName": product["name"],
                "displayName": display_name,
            })
        else:
            product.pop("displayName", None)

        image = str(product.get("image", ""))
        existing_rejected_image = product.get("rejectedImage")
        if image.startswith("assets/img/products/"):
            rejected_stems.add(Path(image).stem)
            product["rejectedImage"] = image
            product["image"] = PLACEHOLDER_IMAGE
            product["imageType"] = "placeholder"
            product["gallery"] = []
            product["status"] = "need_image"
            product["needs_review"] = True
            product["imageReviewReason"] = "PDF crop contains catalog layout/text; hidden from public card."
            rejected_images.append({
                "id": product["id"],
                "name": product["name"],
                "rejectedImage": image,
            })
        elif existing_rejected_image:
            rejected_images.append({
                "id": product["id"],
                "name": product["name"],
                "rejectedImage": existing_rejected_image,
            })
        elif is_placeholder(product):
            product["needs_review"] = True
            product.setdefault("imageType", "placeholder")
            product.setdefault("image", PLACEHOLDER_IMAGE)
            product["status"] = "need_image"
        else:
            product["needs_review"] = bool(product.get("needs_review", False))

    csv_rows_changed = mark_bad_catalog_rows(rejected_stems)

    categories_in_use = [category for category in CATEGORY_ORDER if any(p["category"] == category for p in products)]
    extra = sorted({p["category"] for p in products} - set(categories_in_use))
    categories = [
        {"id": slugify(category), "name": category, "slug": slugify(category)}
        for category in categories_in_use + extra
    ]

    PRODUCTS_PATH.write_text(json.dumps(products, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    CATEGORIES_PATH.write_text(json.dumps(categories, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    normal_photos = [
        p for p in products
        if not is_placeholder(p) and not str(p.get("image", "")).startswith("assets/img/products/")
    ]
    placeholders = [p for p in products if is_placeholder(p)]
    needs_review = [p for p in products if p.get("needs_review")]

    report = {
        "products_total": len(products),
        "normal_photos": len(normal_photos),
        "placeholders": len(placeholders),
        "needs_review": len(needs_review),
        "rejected_pdf_crops": len(rejected_images),
        "csv_rows_marked_needs_review": csv_rows_changed,
        "category_counts": dict(Counter(p["category"] for p in products)),
        "category_changes": category_changes,
        "display_name_changes": renamed_for_grid,
        "rejected_images": rejected_images,
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "normal_photos": report["normal_photos"],
        "placeholders": report["placeholders"],
        "needs_review": report["needs_review"],
        "rejected_pdf_crops": report["rejected_pdf_crops"],
        "category_changes": len(category_changes),
        "display_name_changes": len(renamed_for_grid),
        "csv_rows_marked_needs_review": csv_rows_changed,
        "report": str(REPORT_PATH.relative_to(ROOT)),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
