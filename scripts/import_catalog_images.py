#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import re
import shutil
from difflib import SequenceMatcher
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OCR_PATH = ROOT / "data/catalog-ocr/vision-ocr.json"
SOURCE_DIR = ROOT / "assets/catalog-source"
OUT_DIR = ROOT / "assets/img/products"
CSV_PATH = ROOT / "data/famall-products-clean.csv"
PRODUCTS_PATH = ROOT / "data/products.json"
REVIEW_PATH = ROOT / "data/catalog-image-review.json"

BRAND_ALIASES = {
    "limancy": ["limancy", "limangy", "linancy", "umancy", "wmancy", "mancy", "uncy"],
    "berclean": ["berclean", "berclean", "berclean", "berclean", "berclean", "berclean", "berclean", "berclean", "berclean", "berclеan", "bercléan", "berclean", "berclean", "bercl ean", "berclian"],
    "okfad": ["okfad", "okead", "okfad", "okfao"],
    "yijian": ["yijian", "yjian", "yuhan", "yihan", "yijlan"],
    "miubaby": ["miubaby", "miuboby", "miubaby", "nubaby"],
    "miaorou": ["miaorou", "miaorou", "miaorou", "miaorou"],
    "bocare": ["bocare", "boocare", "b0care"],
    "suting": ["suting", "su ting", "suting"],
    "morefuture": ["morefuture", "moreluture", "morefutture", "morefutre"],
    "predawn": ["predawn", "predawn", "pre dawn"],
    "famall": ["famall"],
    "han": ["han", "хан"],
}

CANONICAL_BRAND = {
    "limancy": "LIMANCY",
    "berclean": "Berclean",
    "okfad": "OKFAD",
    "yijian": "Yijian",
    "miubaby": "Miubaby",
    "miaorou": "Miaorou",
    "bocare": "BOCARE",
    "suting": "SUTING",
    "morefuture": "Morefuture",
    "predawn": "Predawn",
    "famall": "FAMALL",
    "han": "Хан",
}

SERVICE_WORDS = [
    "каталог продукции",
    "содержание",
    "о компании",
    "бренды",
    "декоративная косметика",
    "уходовая косметика",
    "парфюм",
    "средства для волос",
    "гигиена полости рта",
    "товары для детского ухода",
    "продукты для здоровья",
    "уход за домом",
    "уход за интимной гигиеной",
    "салфетки и бумага",
    "другие товары",
]

STOP_TOKENS = {
    "для", "с", "со", "и", "в", "на", "из", "от", "по", "за", "к", "а", "или",
    "ml", "мл", "г", "гр", "шт", "штук", "объем", "объём", "размер", "набор",
    "famall", "limancy", "berclean", "okfad", "yijian", "miubaby", "miaorou",
    "bocare", "suting", "morefuture", "predawn",
}

VOL_RE = re.compile(r"об[ъь]?е[мё]\s*:?\s*([0-9][0-9\s,.*xх/+\-]*(?:мл|г|гр|шт|штук|мм|kg|кг|листов|рулон[а-я]*)?)", re.I)

MANUAL_MATCH_HINTS = {
    "famall-070": ("img551.jpg", "ромаш"),
    "famall-078": ("img457.jpg", "мужские духи"),
    "famall-080": ("img456.jpg", "diva"),
}

SKIP_AUTO_IMAGE_IDS = {
    "famall-098",
}


def norm(value: str) -> str:
    value = value.lower().replace("ё", "е")
    value = value.replace("×", "x").replace("）", ")")
    value = re.sub(r"[^a-zа-я0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def tokens(value: str) -> set[str]:
    return {t for t in norm(value).split() if len(t) > 2 and t not in STOP_TOKENS}


def brand_key(text: str) -> str | None:
    value = norm(text)
    compact = value.replace(" ", "")
    for key, aliases in BRAND_ALIASES.items():
        for alias in aliases:
            alias_norm = norm(alias).replace(" ", "")
            if compact == alias_norm:
                return key
            if len(alias_norm) >= 5 and SequenceMatcher(None, compact, alias_norm).ratio() >= 0.78:
                return key
    return None


def page_category(lines: list[dict]) -> str:
    top = [line for line in lines if line["y"] > 0.9 and len(line["text"]) > 2]
    if top:
        return max(top, key=lambda item: item["width"])["text"].strip("• ")
    text = " ".join(line["text"] for line in lines).lower()
    for word in SERVICE_WORDS[3:]:
        if word in text:
            return word.capitalize()
    return ""


def is_service_page(page: dict) -> bool:
    text = norm(" ".join(line["text"] for line in page["lines"]))
    if len(page["lines"]) <= 4:
        return True
    if any(word in text for word in ["каталог продукции famall", "содержание", "о компании", "бренды"]):
        return True
    if not any(brand_key(line["text"]) for line in page["lines"]):
        return True
    return False


def clean_line(text: str) -> str:
    text = re.sub(r"^[•·\-\s]+", "", text).strip()
    text = text.replace("Обьем", "Объём").replace("Обьём", "Объём")
    return re.sub(r"\s+", " ", text)


def looks_like_title_line(text: str) -> bool:
    low = norm(text)
    if not low or low.isdigit():
        return False
    if low.startswith(("объем", "обьем", "объём")):
        return False
    if low.startswith(("особенности", "ключевые", "способ", "сделано", "спроектировано")):
        return False
    if text.strip().startswith(("•", "-")):
        return False
    return len(low) >= 4


def cluster_anchors(lines: list[dict]) -> list[dict]:
    candidates = []
    for line in lines:
        key = brand_key(line["text"])
        if not key:
            continue
        if line["y"] > 0.9 or line["y"] < 0.06:
            continue
        if line["height"] > 0.12:
            continue
        candidates.append({**line, "brand_key": key})

    deduped: list[dict] = []
    for item in sorted(candidates, key=lambda line: (-line["y"], line["x"])):
        if any(abs(item["x"] - other["x"]) < 0.045 and abs(item["y"] - other["y"]) < 0.07 for other in deduped):
            continue
        deduped.append(item)

    # Product packaging often contains the brand above the real text block.
    # If a lower brand anchor appears in the same column, keep the lower text anchor.
    filtered = []
    for item in deduped:
        has_lower_text_anchor = any(
            other is not item
            and other["brand_key"] == item["brand_key"]
            and abs(other["x"] - item["x"]) < 0.18
            and 0.10 < item["y"] - other["y"] < 0.34
            for other in deduped
        )
        if not has_lower_text_anchor:
            filtered.append(item)
    return filtered


def row_groups(anchors: list[dict]) -> list[list[dict]]:
    rows: list[list[dict]] = []
    for anchor in sorted(anchors, key=lambda item: -item["y"]):
        for row in rows:
            if abs(anchor["y"] - row[0]["y"]) < 0.18:
                row.append(anchor)
                break
        else:
            rows.append([anchor])
    for row in rows:
        row.sort(key=lambda item: item["x"])
    return rows


def extract_records(page: dict) -> list[dict]:
    if is_service_page(page):
        return []

    lines = page["lines"]
    category = page_category(lines)
    anchors = cluster_anchors(lines)
    rows = row_groups(anchors)
    records: list[dict] = []
    image_number = int(re.sub(r"\D", "", page["file"]) or "0")

    local_counter = 0
    for row_index, row in enumerate(rows):
        row_y = sum(item["y"] for item in row) / len(row)
        upper = min(0.90, row_y + 0.34)
        if row_index + 1 < len(rows):
            next_y = sum(item["y"] for item in rows[row_index + 1]) / len(rows[row_index + 1])
            lower = max(0.06, (row_y + next_y) / 2 - 0.02)
        else:
            lower = 0.07

        x_bounds = [0.02]
        for left, right in zip(row, row[1:]):
            x_bounds.append((left["x"] + right["x"]) / 2)
        x_bounds.append(0.98)

        for index, anchor in enumerate(row):
            x0, x1 = x_bounds[index], x_bounds[index + 1]
            group = [
                line for line in lines
                if lower <= line["y"] <= upper and x0 <= line["x"] + line["width"] / 2 <= x1
            ]
            group = sorted(group, key=lambda line: (-line["y"], line["x"]))
            below = [line for line in group if line["y"] < anchor["y"] - 0.012]
            title_parts = []
            consumed = set()
            for line in below:
                text = clean_line(line["text"])
                if not looks_like_title_line(text):
                    break
                if len(title_parts) >= 3:
                    break
                title_parts.append(text)
                consumed.add(id(line))
            title = " ".join(title_parts).strip()
            if not title:
                continue
            if norm(title) in {norm(CANONICAL_BRAND.get(anchor["brand_key"], anchor["text"])), "limancy limancy"}:
                continue

            desc_parts = []
            volume = ""
            for line in below:
                text = clean_line(line["text"])
                match = VOL_RE.search(text)
                if match and not volume:
                    volume = match.group(1).strip(" .")
                if id(line) in consumed:
                    continue
                if match:
                    continue
                if len(desc_parts) < 8 and (line["text"].strip().startswith(("•", "-")) or len(text) > 28):
                    desc_parts.append(text)

            if not volume:
                page_match = VOL_RE.search(" ".join(line["text"] for line in group))
                if page_match:
                    volume = page_match.group(1).strip(" .")

            avg_conf = sum(line["confidence"] for line in group) / max(1, len(group))
            brand = CANONICAL_BRAND.get(anchor["brand_key"], anchor["text"])
            local_counter += 1
            product_id = f"catalog-{image_number}-{local_counter}"
            image_name = f"{product_id}.jpg"

            record = {
                "id": product_id,
                "brand": brand,
                "title": title,
                "category": category,
                "description": " ".join(desc_parts),
                "volume": volume,
                "retail_price": "",
                "partner_price": "",
                "image": f"assets/img/products/{image_name}",
                "source_image": f"assets/catalog-source/{page['file']}",
                "source_page": str(image_number),
                "needs_review": avg_conf < 0.72 or len(title_parts) == 0 or len(title) < 6,
                "_crop": (x0, lower, x1, upper),
                "_avg_conf": avg_conf,
            }
            records.append(record)
    return records


def save_crop(record: dict) -> bool:
    src = ROOT / record["source_image"]
    if not src.exists():
        return False
    img = Image.open(src).convert("RGB")
    width, height = img.size
    x0, lower, x1, upper = record["_crop"]
    margin_x, margin_y = 0.018, 0.028
    left = max(0, int((x0 - margin_x) * width))
    right = min(width, int((x1 + margin_x) * width))
    top = max(0, int((1 - min(0.94, upper + margin_y)) * height))
    bottom = min(height, int((1 - max(0.03, lower - margin_y)) * height))
    if right - left < 120 or bottom - top < 120:
        return False
    crop = img.crop((left, top, right, bottom))
    crop.thumbnail((1000, 1000), Image.LANCZOS)
    out_path = ROOT / record["image"]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    crop.save(out_path, quality=88, optimize=True)
    return True


def product_match_score(product: dict, record: dict) -> tuple[float, dict]:
    p_text = f"{product.get('brand', '')} {product.get('name', '')} {product.get('category', '')} {product.get('volume', '')}"
    r_text = f"{record['brand']} {record['title']} {record['category']} {record['volume']}"
    r_full_text = f"{r_text} {record['description']}"
    p_norm = norm(p_text)
    r_norm = norm(r_text)
    seq = SequenceMatcher(None, p_norm, r_norm).ratio()
    p_tokens = tokens(p_text)
    r_tokens = tokens(r_text)
    r_full_tokens = tokens(r_full_text)
    overlap = len(p_tokens & r_tokens)
    union = max(1, len(p_tokens | r_tokens))
    jaccard = overlap / union
    full_overlap = len(p_tokens & r_full_tokens)
    full_jaccard = full_overlap / max(1, len(p_tokens | r_full_tokens))
    brand_ok = norm(product.get("brand", "")) in norm(record["brand"]) or norm(record["brand"]) in norm(product.get("brand", ""))
    score = 0.50 * seq + 0.34 * jaccard + 0.08 * full_jaccard + (0.12 if brand_ok else 0)
    return score, {
        "seq": round(seq, 3),
        "jaccard": round(jaccard, 3),
        "full_jaccard": round(full_jaccard, 3),
        "overlap": overlap,
        "full_overlap": full_overlap,
        "brand_ok": brand_ok,
    }


def is_placeholder_image(product: dict) -> bool:
    image = str(product.get("image", ""))
    return (
        not image
        or "placeholder" in image
        or "placeholders/" in image
        or str(product.get("imageType", "")).endswith("placeholder")
        or product.get("status") == "need_image"
    )


def update_products(records: list[dict]) -> dict:
    products = json.loads(PRODUCTS_PATH.read_text(encoding="utf-8"))
    updated = []
    review = []
    no_photo = []

    for product in products:
        old_placeholder = is_placeholder_image(product)
        manual_hint = MANUAL_MATCH_HINTS.get(product.get("id", ""))
        scored = []
        for record in records:
            score, detail = product_match_score(product, record)
            if manual_hint and record["source_image"].endswith(manual_hint[0]) and manual_hint[1] in norm(record["title"]):
                score = 1.0
                detail = {**detail, "manual": True}
            scored.append((score, detail, record))
        scored.sort(key=lambda item: item[0], reverse=True)
        best_score, detail, best = scored[0] if scored else (0, {}, None)

        confident = (
            best
            and product.get("id") not in SKIP_AUTO_IMAGE_IDS
            and (best_score >= 0.52 or detail.get("manual"))
            and (detail.get("manual") or detail.get("overlap", 0) >= 2 or detail.get("full_overlap", 0) >= 4)
            and (detail.get("brand_ok") or best_score >= 0.68)
            and not best["needs_review"]
            and Path(ROOT / best["image"]).exists()
        )

        if confident:
            old_image = product.get("image", "")
            image_changed = False
            if old_placeholder:
                product["image"] = best["image"]
                product["imageType"] = "catalog_crop"
                product["gallery"] = [{
                    "type": "catalog_crop",
                    "src": best["image"],
                    "alt": product["name"],
                }]
                product["status"] = "published"
                image_changed = old_image != product.get("image")
            if image_changed and best["description"] and not product.get("description"):
                product["description"] = best["description"][:420]
            if best["volume"] and not product.get("volume"):
                product["volume"] = best["volume"]
            product["catalogSource"] = {
                "sourceImage": best["source_image"],
                "sourcePage": best["source_page"],
                "matchScore": round(best_score, 3),
                "matchDetail": detail,
            }
            updated.append({
                "id": product["id"],
                "name": product["name"],
                "image_before": old_image,
                "image_after": product.get("image", ""),
                "match": best["title"],
                "score": round(best_score, 3),
                "source_image": best["source_image"],
                "image_changed": image_changed,
            })
        else:
            if is_placeholder_image(product):
                no_photo.append(product["name"])
            review.append({
                "id": product.get("id"),
                "name": product.get("name"),
                "best_match": best["title"] if best else "",
                "best_brand": best["brand"] if best else "",
                "score": round(best_score, 3),
                "detail": detail,
                "source_image": best["source_image"] if best else "",
                "reason": "low_confidence_or_placeholder_source",
            })

    PRODUCTS_PATH.write_text(json.dumps(products, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"updated": updated, "review": review, "no_photo": no_photo}


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if OUT_DIR.exists():
        for old in OUT_DIR.glob("catalog-*.jpg"):
            old.unlink()

    pages = json.loads(OCR_PATH.read_text(encoding="utf-8"))
    records = []
    processed_pages = 0
    for page in pages:
        page_records = extract_records(page)
        if page_records:
            processed_pages += 1
        for record in page_records:
            if save_crop(record):
                records.append(record)
            else:
                record["image"] = ""
                record["needs_review"] = True
                records.append(record)

    fields = [
        "id", "brand", "title", "category", "description", "volume",
        "retail_price", "partner_price", "image", "source_image", "source_page",
        "needs_review",
    ]
    with CSV_PATH.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for record in records:
            writer.writerow({field: record[field] for field in fields})

    product_result = update_products(records)
    review_payload = {
        "source_images_unpacked": len(list(SOURCE_DIR.glob("*.jpg"))),
        "source_images_processed": len(pages),
        "product_pages_detected": processed_pages,
        "catalog_records_found": len(records),
        "crops_saved": sum(1 for record in records if record.get("image") and (ROOT / record["image"]).exists()),
        "site_products_updated": len(product_result["updated"]),
        "site_products_without_photo": product_result["no_photo"],
        "manual_review": product_result["review"],
        "catalog_records_need_review": [
            {field: record[field] for field in fields}
            for record in records
            if record["needs_review"]
        ],
    }
    REVIEW_PATH.write_text(json.dumps(review_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "source_images_unpacked": review_payload["source_images_unpacked"],
        "source_images_processed": review_payload["source_images_processed"],
        "product_pages_detected": processed_pages,
        "catalog_records_found": len(records),
        "crops_saved": review_payload["crops_saved"],
        "site_products_updated": len(product_result["updated"]),
        "site_products_without_photo": len(product_result["site_products_without_photo"] if "site_products_without_photo" in product_result else product_result["no_photo"]),
        "catalog_records_need_review": len(review_payload["catalog_records_need_review"]),
        "csv": str(CSV_PATH.relative_to(ROOT)),
        "images": str(OUT_DIR.relative_to(ROOT)),
        "review": str(REVIEW_PATH.relative_to(ROOT)),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
