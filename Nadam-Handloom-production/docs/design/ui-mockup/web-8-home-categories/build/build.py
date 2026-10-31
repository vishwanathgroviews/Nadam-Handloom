# Builds the mock-up's files from build/captured.json (made by capture.cjs from the live website):
#   assets/live.css, assets/fonts/   the live website's styles and fonts (only the font addresses change)
#   img/site/, img/s3/               the live photos the page uses, kept inside the mock-up
#   assets/captured.js               the live home page's parts (header, sections, footer, menu)
#   assets/data.js                   categories, collections and crafts with their counts (live)
# Run in docs/design/ui-mockup/web-8-home-categories: python3 build/build.py
import json, os, re, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
cap = json.load(open(os.path.join(HERE, 'captured.json'), encoding='utf-8'))
SITE, parts, home, catalog = cap['site'], cap['parts'], cap['home'], cap['catalog']
S3 = 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/'

def fetch(url, dest):
    if os.path.exists(dest): return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    urllib.request.urlretrieve(url, dest)
    return dest

def local_s3(url):
    key = url[len(S3):]
    rel = 'img/s3/' + key.replace('/', '_')
    fetch(url, os.path.join(ROOT, rel))
    return rel

# ---------- Styles and fonts ----------
css = urllib.request.urlopen(parts['css'][0]).read().decode('utf-8')
def font(m):
    name = m.group(1)
    fetch(f'{SITE}/assets/{name}', os.path.join(ROOT, 'assets', 'fonts', name))
    return f'url(fonts/{name})'
css = re.sub(r'url\(/assets/([^)]+)\)', font, css)
def css_img(m):
    fetch(f'{SITE}/img/{m.group(1)}', os.path.join(ROOT, 'img', m.group(1)))
    return f'url(../img/{m.group(1)})'
css = re.sub(r'url\(/img/([^)]+)\)', css_img, css)
open(os.path.join(ROOT, 'assets', 'live.css'), 'w', encoding='utf-8').write(f'/* The live website\'s styles ({parts["css"][0]}, {cap["at"][:10]}), unchanged except font and photo addresses. */\n' + css)

# ---------- The live page's parts ----------
OLD_NEW = [('917382968566', '917382388565'), ('73829 68566', '73823 88565'), ('9494170180', '7382388565'), ('94941 70180', '73823 88565')]
def fix(html):
    if not html: return html
    html = re.sub(r'https://nandamhandlooms-media\.s3\.ap-south-1\.amazonaws\.com/[^"\' ),]+', lambda m: local_s3(m.group(0)), html)
    def site_img(m):
        fetch(f'{SITE}/img/{m.group(1)}', os.path.join(ROOT, 'img', m.group(1)))
        return f'img/{m.group(1)}'
    html = re.sub(r'(?<=["\' ,])/img/([A-Za-z0-9_./-]+\.(?:jpg|webp|png))', site_img, html)
    # Animations start again in the mock-up: drop the "already shown" marks of the capture.
    html = re.sub(r'class="([^"]*)"', lambda m: 'class="' + ' '.join(t for t in m.group(1).split() if t != 'in') + '"', html)
    html = re.sub(r'transform: translateX\([^)]*\);?', '', html)
    for a, b in OLD_NEW: html = html.replace(a, b)  # the new shop number (waiting to go live)
    return html

sections = {}
for s in parts['sections']:
    key = s['label'] or s['cls'].split()[0]
    sections[key] = fix(s['html'])
menu = fix(parts['menu'])
# One number for calls and WhatsApp now: the menu's second line goes.
menu = re.sub(r'<br>WhatsApp \+91 73823 88565', '', menu)
CAP = {
    'at': cap['at'], 'site': SITE,
    'announce': fix(parts['announce']), 'header': fix(parts['header']), 'footer': fix(parts['footer']),
    'fab': fix(parts['fab']), 'menu': menu, 'sections': sections,
}
open(os.path.join(ROOT, 'assets', 'captured.js'), 'w', encoding='utf-8').write(
    '/* The live home page\'s parts as visitors got them on ' + cap['at'][:10] + ' (build/capture.cjs), photos kept in img/. Built by build/build.py. */\n'
    'window.CAP = ' + json.dumps(CAP, ensure_ascii=False) + ';\n')

# ---------- Data: categories, collections, crafts ----------
cols = catalog['collections']
def col_img(c): return local_s3(c['image']) if c.get('image') else None
collections = [{
    'id': c['id'], 'name': c['name'], 'category': c['category'], 'craft': c.get('craft'),
    'count': c['count'], 'sets': c.get('sets', 0), 'price': c['price'], 'image': col_img(c),
} for c in sorted(cols, key=lambda c: -c['count'])]
by_name = {c['name']: c for c in collections}

# Category photos: the live category photos are a text poster or 400x225 (see the start page), so the
# tiles use the website's own photos, or a collection's photo where the website has none.
CAT_PHOTO = {
    'mangalagiri-handloom-pattu-sarees': ('site', 'lamps', 'A Mangalagiri pattu saree with brass lamps'),
    'handloom-pattu-dress-material': ('site', 'applique', 'Applique work on a pattu dress material'),
    'pattu-lehanga-sets': ('col', 'Full Digital Set Lehanga', 'A red pattu lehanga set with printed motifs'),
    'handloom-cotton-saree': ('s3', S3 + 'site/categories/handloom-cotton-saree.jpg', 'A sea-green handloom cotton saree'),
}
# Names as the home page writes them today ("Mangalagiri pattu sarees", "Pattu dress materials").
SHORT = {'mangalagiri-handloom-pattu-sarees': 'Mangalagiri pattu sarees', 'handloom-pattu-dress-material': 'Pattu dress materials', 'pattu-lehanga-sets': 'Pattu lehanga sets', 'handloom-cotton-saree': 'Handloom cotton sarees'}
categories = []
for c in home['categories']:
    kind, ref, alt = CAT_PHOTO.get(c['slug'], ('s3', c['image'], c['name']))
    photo = {'site': ref} if kind == 'site' else {'src': by_name[ref]['image'] if kind == 'col' else local_s3(ref)}
    categories.append({'slug': c['slug'], 'name': c['name'], 'short': SHORT.get(c['slug'], c['name']), 'count': c['count'],
                       'collections': c['collections'], 'description': c['description'], 'photo': photo, 'alt': alt})

crafts = []
for k in home['crafts']:
    top = next((c for c in collections if c['craft'] == k['key'] and c['image']), None)
    crafts.append({'key': k['key'], 'name': k['name'], 'count': k['count'], 'image': top['image'] if top else None})

# The website's own photo sizes, for <picture> (as the live Picture component).
site_sizes = {}
for f in sorted(os.listdir(os.path.join(ROOT, 'img', 'site'))):
    m = re.match(r'(.+)-(\d+)\.(jpg|webp)$', f)
    if m: site_sizes.setdefault(m.group(1), set()).add(int(m.group(2)))
for name in ['lamps', 'applique', 'pastel', 'zari', 'loom', 'gold-border', 'stack', 'checks', 'painted']:
    for w in (480, 800, 1200):
        for ext in ('jpg', 'webp'):
            try:
                fetch(f'{SITE}/img/site/{name}-{w}.{ext}', os.path.join(ROOT, 'img', 'site', f'{name}-{w}.{ext}'))
                site_sizes.setdefault(name, set()).add(w)
            except Exception:
                pass
NH = {
    'at': cap['at'], 'totals': home['totals'], 'categories': categories, 'collections': collections, 'crafts': crafts,
    'siteSizes': {k: sorted(v) for k, v in site_sizes.items()},
}
open(os.path.join(ROOT, 'assets', 'data.js'), 'w', encoding='utf-8').write(
    '/* Live categories, collections and crafts (' + cap['at'][:10] + '), photos in img/. Built by build/build.py. */\n'
    'window.NH = ' + json.dumps(NH, ensure_ascii=False) + ';\n')

# Collection and saree photos stay as the shop's server keeps them (already compressed to about 80 KB).
print(f'{len(sections)} sections, {len(categories)} categories, {len(collections)} collections, {len(crafts)} crafts')
