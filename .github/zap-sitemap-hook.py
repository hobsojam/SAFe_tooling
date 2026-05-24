from pathlib import Path


SITEMAP_PATH = Path("/zap/wrk/zap-sitemap.txt")


def _sitemap_urls(target):
    urls = []
    if SITEMAP_PATH.exists():
        for line in SITEMAP_PATH.read_text(encoding="utf-8").splitlines():
            url = line.strip()
            if url and not url.startswith("#"):
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
