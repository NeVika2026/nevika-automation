#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import re
import shutil
import ssl
import urllib.error
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_PATH = ROOT / "docs/data/products.json"
DATA_PRODUCTS_PATH = ROOT / "data/products.json"
IMAGE_DIR = ROOT / "docs/assets/images/products"
REPORT_PATH = ROOT / "docs/data/product-image-update-report.csv"
MISSING_SOURCES_PATH = ROOT / "missing_products_image_sources.csv"
WB_MATCHES_PATH = ROOT / "wildberries_matches.csv"

UPDATE_CONFIDENCE = 0.72
REVIEW_CONFIDENCE = 0.58

USER_AGENT = "Mozilla/5.0 (compatible; FAMALL-catalog-bot/1.0)"


def norm(value: str) -> str:
    value = (value or "").lower().replace("ё", "е")
    value = re.sub(r"[^a-zа-я0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def needs_image(product: dict) -> bool:
    image = product.get("image") or ""
    if not image:
        return True
    if "placeholder" in image:
        return True
    if product.get("imageType") == "premium_placeholder":
        return True
    if "famallnetwork" in image or re.search(r"famall-\d+-famallnetwork", image):
        return True
    return False


def sku_number(sku: str) -> int:
    return int(sku.split("-")[-1])


def all_local_image_files() -> list[Path]:
    files: list[Path] = []
    for path in IMAGE_DIR.iterdir():
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        if "placeholder" in path.name:
            continue
        if path.name.startswith("famall-"):
            continue
        files.append(path)
    return files


def best_local_match(product: dict, files: list[Path]) -> tuple[Path | None, float]:
    name = product.get("name") or ""
    slug = product.get("slug") or ""
    best_path = None
    best_score = 0.0
    for path in files:
        score = max(score_name(path.stem, name), score_name(path.stem, slug))
        if score > best_score:
            best_score = score
            best_path = path
    return best_path, best_score


def local_candidates(product: dict) -> list[Path]:
    number = sku_number(product["sku"])
    slug = product.get("slug") or ""
    names = []
    for path in IMAGE_DIR.iterdir():
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        if "placeholder" in path.name or path.name.startswith("famall-"):
            continue
        if path.name.startswith(f"{number}-"):
            names.append(path)
    if slug:
        for ext in (".jpg", ".jpeg", ".png", ".webp"):
            candidate = IMAGE_DIR / f"{slug}{ext}"
            if candidate.exists():
                names.append(candidate)
    deduped: list[Path] = []
    seen = set()
    for path in names:
        if path not in seen:
            deduped.append(path)
            seen.add(path)
    return deduped


def score_name(left: str, right: str) -> float:
    return SequenceMatcher(None, norm(left), norm(right)).ratio()


def load_missing_sources() -> dict[str, dict]:
    rows: dict[str, dict] = {}
    if not MISSING_SOURCES_PATH.exists():
        return rows
    with MISSING_SOURCES_PATH.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            rows[row["sku"]] = row
    return rows


def load_wb_matches() -> dict[str, dict]:
    rows: dict[str, dict] = {}
    if not WB_MATCHES_PATH.exists():
        return rows
    with WB_MATCHES_PATH.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            rows[row["sku"]] = row
    return rows


def fetch_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    context = ssl.create_default_context()
    with urllib.request.urlopen(request, timeout=30, context=context) as response:
        return response.read().decode("utf-8", errors="replace")


def fetch_bytes(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    context = ssl.create_default_context()
    with urllib.request.urlopen(request, timeout=30, context=context) as response:
        return response.read()


def scrape_famallnetwork_catalog() -> list[tuple[str, str]]:
    html = fetch_text("https://famallnetwork.su/shop/")
    pairs: list[tuple[str, str]] = []
    pattern = re.compile(
        r'class="woocommerce-loop-product__title"[^>]*>\s*<a[^>]*>([^<]+)</a>[\s\S]{0,1200}?'
        r'<img[^>]+(?:data-src|src)="([^"]+)"',
        re.I,
    )
    for title, src in pattern.findall(html):
        pairs.append((title.strip(), src.strip()))
    return pairs


def scrape_wb_brand_images() -> list[tuple[str, str]]:
    url = "https://global.wildberries.ru/brands/2683531-famall"
    try:
        html = fetch_text(url)
    except urllib.error.HTTPError:
        return []
    pairs: list[tuple[str, str]] = []
    for block in re.findall(r'product-card__main[^>]*>[\s\S]{0,2500}?', html):
        name_match = re.search(r'product-card__name[^>]*>([^<]+)<', block)
        img_match = re.search(r'src="(https://[^"]+/images/[^"]+)"', block)
        if name_match and img_match:
            pairs.append((name_match.group(1).strip(), img_match.group(1).strip()))
    return pairs


def extension_from_url(url: str, content_type: str | None = None) -> str:
    path = urlparse(url).path.lower()
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        if path.endswith(ext):
            return ext
    if content_type:
        if "png" in content_type:
            return ".png"
        if "webp" in content_type:
            return ".webp"
    return ".jpg"


def save_remote_image(url: str, product: dict) -> str | None:
    try:
        payload = fetch_bytes(url)
    except (urllib.error.URLError, TimeoutError, ValueError):
        return None
    if len(payload) < 1024:
        return None
    ext = extension_from_url(url)
    filename = f"{sku_number(product['sku'])}-{norm(product.get('slug') or product['name']).replace(' ', '-')[:80]}{ext}"
    filename = re.sub(r"[^a-z0-9.\-_]", "", filename.lower())
    target = IMAGE_DIR / filename
    target.write_bytes(payload)
    return f"assets/images/products/{filename}"


def update_product_gallery(product: dict, src: str, source: str) -> None:
    product["image"] = src
    product["imageType"] = "source"
    product["gallery"] = [
        {
            "type": "source",
            "src": src,
            "alt": product.get("name", ""),
            "source": source,
        }
    ]


def load_baseline_products() -> list[dict]:
    import subprocess

    try:
        raw = subprocess.check_output(["git", "show", "HEAD:docs/data/products.json"], text=True)
        return json.loads(raw)
    except (subprocess.CalledProcessError, FileNotFoundError, json.JSONDecodeError):
        return json.loads(PRODUCTS_PATH.read_text(encoding="utf-8"))


def main() -> None:
    products = json.loads(PRODUCTS_PATH.read_text(encoding="utf-8"))
    baseline_products = load_baseline_products()
    baseline_by_sku = {item.get("sku"): item for item in baseline_products}
    missing_sources = load_missing_sources()
    wb_matches = load_wb_matches()
    report_rows: list[dict] = []

    external_catalog: list[tuple[str, str]] = []
    wb_catalog: list[tuple[str, str]] = []
    try:
        external_catalog = scrape_famallnetwork_catalog()
    except (urllib.error.URLError, TimeoutError, ValueError):
        external_catalog = []
    try:
        wb_catalog = scrape_wb_brand_images()
    except (urllib.error.URLError, TimeoutError, ValueError):
        wb_catalog = []

    local_pool = all_local_image_files()
    targets = [
        {
            "sku": product.get("sku", ""),
            "name": product.get("name", ""),
            "old_image": (baseline_by_sku.get(product.get("sku")) or product).get("image") or "",
        }
        for product in baseline_products
        if needs_image(baseline_by_sku.get(product.get("sku"), product))
    ]

    for target in targets:
        product = next(item for item in products if item.get("sku") == target["sku"])
        sku = target["sku"]
        name = target["name"]
        old_image = target["old_image"]

        chosen_src = None
        source = ""
        confidence = 0.0
        status = "not-found"

        local_files = local_candidates(product)
        if local_files:
            best = max(local_files, key=lambda path: score_name(path.stem, product.get("slug") or name))
            chosen_src = f"assets/images/products/{best.name}"
            source = "project/local-file"
            confidence = max(score_name(best.stem, name), 0.95)
            status = "updated"

        if not chosen_src:
            fuzzy_path, fuzzy_score = best_local_match(product, local_pool)
            number = sku_number(sku)
            if fuzzy_path and fuzzy_path.name.startswith(f"{number}-"):
                chosen_src = f"assets/images/products/{fuzzy_path.name}"
                source = "project/local-file"
                confidence = fuzzy_score
                status = "updated"
            elif fuzzy_path and fuzzy_score >= REVIEW_CONFIDENCE:
                source = "project/local-file-fuzzy"
                confidence = fuzzy_score
                status = "needs-review"

        if not chosen_src and status != "needs-review":
            row = missing_sources.get(sku)
            if row and row.get("image_url") and row["image_url"].startswith("http"):
                remote = row["image_url"]
                saved = save_remote_image(remote, product)
                if saved:
                    chosen_src = saved
                    source = row.get("source") or "famallnetwork.su/shop/"
                    confidence = 0.9
                    status = "updated"

        if not chosen_src and status != "needs-review" and sku in wb_matches:
            wb = wb_matches[sku]
            conf = float(wb.get("confidence") or 0)
            wb_name = wb.get("wb_name") or ""
            if conf >= REVIEW_CONFIDENCE:
                wb_image = next((img for title, img in wb_catalog if score_name(title, wb_name) >= 0.7), None)
                if wb_image:
                    saved = save_remote_image(wb_image, product)
                    if saved:
                        chosen_src = saved
                        source = "global.wildberries.ru/brands/2683531-famall"
                        confidence = conf
                        status = "updated" if conf >= UPDATE_CONFIDENCE else "needs-review"
                elif conf >= REVIEW_CONFIDENCE:
                    source = "global.wildberries.ru/brands/2683531-famall"
                    confidence = conf
                    status = "needs-review"

        if not chosen_src and status != "needs-review" and external_catalog:
            best_score = 0.0
            best_url = ""
            for title, url in external_catalog:
                score = score_name(title, name)
                if score > best_score:
                    best_score = score
                    best_url = url
            if best_score >= UPDATE_CONFIDENCE and best_url:
                saved = save_remote_image(best_url, product)
                if saved:
                    chosen_src = saved
                    source = "famallnetwork.su/shop/"
                    confidence = best_score
                    status = "updated"
            elif best_score >= REVIEW_CONFIDENCE:
                status = "needs-review"
                source = "famallnetwork.su/shop/"
                confidence = best_score

        if chosen_src and status == "updated":
            update_product_gallery(product, chosen_src, source)

        report_rows.append(
            {
                "sku": sku,
                "name": name,
                "old_image": old_image,
                "new_image": chosen_src or "",
                "source": source,
                "confidence": f"{confidence:.3f}",
                "status": status,
            }
        )

    PRODUCTS_PATH.write_text(json.dumps(products, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    shutil.copy2(PRODUCTS_PATH, DATA_PRODUCTS_PATH)

    with REPORT_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["sku", "name", "old_image", "new_image", "source", "confidence", "status"],
        )
        writer.writeheader()
        writer.writerows(report_rows)

    summary = {
        row["status"]: sum(1 for item in report_rows if item["status"] == row["status"])
        for row in report_rows
    }
    unique_summary: dict[str, int] = {}
    for row in report_rows:
        unique_summary[row["status"]] = unique_summary.get(row["status"], 0) + 1
    print(json.dumps({"report": str(REPORT_PATH), "summary": unique_summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
