import json
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen


SITEMAP_PATH = Path("/zap/wrk/zap-sitemap.txt")
PI_LIST_URL = "http://127.0.0.1:3000/api/pi"


def _demo_pi_id():
    try:
        with urlopen(PI_LIST_URL, timeout=10) as response:
            pis = json.loads(response.read().decode("utf-8"))
    except (OSError, URLError, json.JSONDecodeError) as exc:
        print(f"Unable to discover demo PI id from {PI_LIST_URL}: {exc}")
        return None

    if not pis:
        print(f"No PI records returned by {PI_LIST_URL}; skipping PI-specific sitemap URLs")
        return None

    active = next((pi for pi in pis if pi.get("status") == "active"), None)
    selected = active or pis[0]
    pi_id = selected.get("id")
    print(f"Using PI id for ZAP sitemap templates: {pi_id}")
    return pi_id


def _sitemap_urls(target):
    urls = []
    pi_id = None
    if SITEMAP_PATH.exists():
        for line in SITEMAP_PATH.read_text(encoding="utf-8").splitlines():
            url = line.strip()
            if not url or url.startswith("#"):
                continue
            if "{pi_id}" in url:
                pi_id = pi_id or _demo_pi_id()
                if not pi_id:
                    continue
                url = url.format(pi_id=pi_id)
            urls.append(url)

    if target not in urls:
        urls.insert(0, target)

    return urls


def zap_started(zap, target):
    for url in _sitemap_urls(target):
        try:
            print(f"Preloading ZAP sitemap URL: {url}")
            zap.urlopen(url)
        except Exception as exc:
            print(f"Failed to preload ZAP sitemap URL {url}: {exc}")
