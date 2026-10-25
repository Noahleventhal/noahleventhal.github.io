"""Vendor Latin font files and licenses from the official Google Fonts sources."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import quote_plus
import re

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'fonts'
FAMILIES = ['Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Nunito', 'Work Sans', 'DM Sans', 'Manrope', 'Raleway', 'Oswald', 'Merriweather', 'Lora', 'Playfair Display', 'Libre Baskerville', 'Roboto Slab', 'Roboto Mono', 'Space Mono']
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
def fetch(url):
    with urlopen(Request(url, headers={'User-Agent': UA}), timeout=30) as response:
        return response.read()

def vendor(family):
    slug = family.lower().replace(' ', '')
    css = fetch(f'https://fonts.googleapis.com/css2?family={quote_plus(family)}:wght@400;700&display=swap').decode()
    blocks = re.findall(r'/\* latin \*/\s*(@font-face\s*\{[^}]+\})', css)
    if not blocks:
        raise RuntimeError(f'No Latin font face for {family}')
    license_text = None
    for directory, filename in [('ofl', 'OFL.txt'), ('apache', 'LICENSE.txt')]:
        try:
            license_text = fetch(f'https://raw.githubusercontent.com/google/fonts/main/{directory}/{slug}/{filename}')
            break
        except Exception:
            continue
    if license_text is None:
        raise RuntimeError(f'No license for {family}')
    (OUT / f'{slug}-LICENSE.txt').write_bytes(license_text)
    sources = {}
    rewritten = []
    for block in blocks:
        remote = re.search(r'url\((https://fonts.gstatic.com/[^)]+)\)', block).group(1)
        if remote not in sources:
            local = f'{slug}-{len(sources)}.woff2'
            (OUT / local).write_bytes(fetch(remote))
            sources[remote] = local
        rewritten.append(block.replace(remote, './' + sources[remote]))
    return '\n'.join(rewritten)

OUT.mkdir(parents=True, exist_ok=True)
with ThreadPoolExecutor(max_workers=6) as executor:
    sheets = list(executor.map(vendor, FAMILIES))
(OUT / 'fonts.css').write_text('/* Locally hosted fonts. Licenses are included beside each font. */\n' + '\n'.join(sheets) + '\n')
print(f'Vendored {len(FAMILIES)} font families and licenses')
