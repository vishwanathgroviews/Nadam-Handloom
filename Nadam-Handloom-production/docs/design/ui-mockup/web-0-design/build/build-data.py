"""Builds assets/data.js for the website mock-up from the LIVE public catalogue.

Run from this folder:  python3 build-data.py [--fetch]
  --fetch   download the catalogue again from https://api.nandamhandlooms.com/api/v1
            (the same public lists any website visitor gets) into ./cache/
Photos are copied (resized to 540 x 720) into ../img/p/ and ../img/site/, so the
mock-up works on its own and loads fast. Only public data is used: no customers,
orders or staff.
"""
import json, os, re, subprocess, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'cache')
ROOT = os.path.dirname(HERE)
IMG_P = os.path.join(ROOT, 'img', 'p')
IMG_S = os.path.join(ROOT, 'img', 'site')
API = 'https://api.nandamhandlooms.com/api/v1'
S3 = 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/'
PER_COLLECTION = 6          # sarees per collection copied into the mock-up
PRICE_OK = (500, 15000)     # outside this the live price is a typo (listed as a data fix)
PHOTO_IS_LOGO = {'full-digital-set-lehanga'}  # live listings whose photo is the shop logo (listed as a data fix)


def get(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def fetch():
    os.makedirs(CACHE, exist_ok=True)
    items, page = [], 1
    while True:
        d = get(f'{API}/catalog/products?page={page}&pageSize=48')['data']
        items += d['items']
        if len(d['items']) < 48:
            break
        page += 1
        time.sleep(0.1)
    cats = get(f'{API}/catalog/categories')['data']
    json.dump(items, open(os.path.join(CACHE, 'products.json'), 'w'))
    json.dump(cats, open(os.path.join(CACHE, 'categories.json'), 'w'))
    json.dump({'fetchedAt': time.strftime('%Y-%m-%d %H:%M IST')}, open(os.path.join(CACHE, 'meta.json'), 'w'))


QUEUE = []


def save_img(url, path, size=640):
    """Queues a photo; run_queue() copies them all, 16 at a time."""
    QUEUE.append((url, path, size))
    return True


def run_queue():
    def one(job):
        return job, copy_img(*job)
    with ThreadPoolExecutor(16) as pool:
        bad = [job[1] for job, ok in pool.map(one, QUEUE) if not ok]
    return bad


def copy_img(url, path, size=640):
    if os.path.exists(path):
        return True
    try:
        data = urllib.request.urlopen(url, timeout=60).read()
    except Exception as e:  # noqa: BLE001
        print('  photo failed', url, e)
        return False
    open(path, 'wb').write(data)
    subprocess.run(['sips', '-Z', str(size), '-s', 'format', 'jpeg', '-s', 'formatOptions', 'normal', path, '--out', path], capture_output=True)
    return True


# Obvious spelling slips in collection names, shown fixed (and listed as content fixes).
FIXES = [(r'\bEmbroidry\b', 'Embroidery'), (r'\bkalankari\b', 'Kalamkari'), (r'\bDuppata\b', 'Dupatta'), (r'\s+—\s+Border$', ''), (r'\s{2,}', ' ')]
SMALL = {'and', 'with', 'of', 'in'}


def tidy(name):
    s = name.strip()
    for a, b in FIXES:
        s = re.sub(a, b, s, flags=re.I)
    words = []
    for i, w in enumerate(s.split(' ')):
        if re.match(r'^[\d/]+k?$', w, re.I) or w.isupper() and len(w) <= 4:
            words.append(w.replace('K', 'k'))
        elif i and w.lower() in SMALL:
            words.append(w.lower())
        else:
            words.append(w[:1].upper() + w[1:].lower())
    return ' '.join(words)


def single(name):
    return re.sub(r'\bSarees\b', 'Saree', name)


# "Shop by craft": groups made from words in the collection names (to confirm with the shop).
CRAFTS = [
    ('embroidery', 'Embroidery', r'embroid|chikankari'),
    ('applique', 'Applique', r'applique'),
    ('digital', 'Digital Print', r'digital'),
    ('screen', 'Screen & Block Print', r'screen|baguru|bagru|embossing'),
    ('kalamkari', 'Kalamkari & Hand Painted', r'kalamkari|kalankari|hand ?painted|tanjore'),
    ('bandhani', 'Bandhani & Shibori', r'bandini|bandhani|shibori'),
    ('checks', 'Checks', r'checks'),
    ('pure', 'Pure Pattu & Plain', r'pure pattu|plain|butta'),
]


def main():
    if '--fetch' in sys.argv or not os.path.exists(os.path.join(CACHE, 'products.json')):
        fetch()
    items = json.load(open(os.path.join(CACHE, 'products.json')))
    cats = json.load(open(os.path.join(CACHE, 'categories.json')))
    meta = json.load(open(os.path.join(CACHE, 'meta.json')))
    os.makedirs(IMG_P, exist_ok=True)
    os.makedirs(IMG_S, exist_ok=True)

    by_col = defaultdict(list)
    for p in items:
        by_col[p['subcategoryId']].append(p)

    skipped, collections, products = [], [], []
    for sid, ps in by_col.items():
        s = ps[0]['subcategory']
        price = float(s['onlinePrice'])
        if not (PRICE_OK[0] <= price <= PRICE_OK[1]) or s['name'].lower().startswith('test'):
            skipped.append({'name': s['name'], 'price': price, 'count': len(ps)})
            continue
        ps.sort(key=lambda p: p['createdAt'], reverse=True)          # newest first
        ps.sort(key=lambda p: 0 if p['availableCount'] > 1 else 1)  # then sets (more than one in stock) first
        name = tidy(s['name'])
        col = {
            'id': sid[:8], 'name': name, 'raw': s['name'], 'cat': ps[0]['category']['slug'], 'price': price,
            'mrp': float(s['mrp']) if s['mrp'] else None, 'count': len(ps), 'sets': sum(1 for p in ps if p['availableCount'] > 1),
            'desc': (s.get('description') or '').strip(),
            'craft': next((c[0] for c in CRAFTS if re.search(c[2], s['name'], re.I)), None),
        }
        picked = ps[:PER_COLLECTION]
        for p in picked:
            img = p['images'][0]['url'] if p['images'] else None
            fn = p['id'][:8] + '.jpg'
            if img and save_img(img, os.path.join(IMG_P, fn)):
                products.append({'id': p['id'][:8], 'slug': p['slug'], 'sku': p['sku'], 'col': col['id'], 'img': 'img/p/' + fn,
                                 'avail': p['availableCount'], 'at': p['createdAt'][:10], 'name': single(name), 'logo': p['slug'] in PHOTO_IS_LOGO})
        col['img'] = next((x['img'] for x in products if x['col'] == col['id']), None)
        collections.append(col)

    collections.sort(key=lambda c: -c['count'])
    shown = {c['cat'] for c in collections}
    categories = []
    for c in sorted(cats, key=lambda c: c['sortOrder']):
        n = sum(x['count'] for x in collections if x['cat'] == c['slug'])
        local = 'img/site/cat-' + c['slug'] + '.jpg'
        if c.get('imageUrl'):
            save_img(c['imageUrl'], os.path.join(ROOT, local), 900)
        categories.append({'slug': c['slug'], 'name': tidy(c['name']), 'raw': c['name'], 'count': n, 'img': local if c.get('imageUrl') else None, 'shown': c['slug'] in shown})

    site = {}
    for key in ['hero/hero-pattu-zari-border.jpg', 'hero/hero-bridal-brocade.jpg', 'hero/hero-cotton-checks.jpg', 'hero/hero-kalamkari-border.jpg',
                'hero/hero-craft-story.jpg', 'brand/handloom_banner.jpg', 'brand/logo.png', 'craft/texture-gold-border-1.jpg',
                'craft/texture-mint-border.jpg', 'craft/texture-mint-embroidery.jpg', 'craft/texture-silver-border-1.jpg']:
        out = 'img/site/' + key.replace('/', '-')
        if save_img(S3 + key, os.path.join(ROOT, out), 1600 if 'hero' in key or 'banner' in key else 900):
            site[key.replace('/', '-').rsplit('.', 1)[0].replace('hero-hero-', 'hero-')] = out

    missing = run_queue()
    if missing:
        print('photos that could not be copied:', len(missing))
        gone = {os.path.relpath(m, ROOT) for m in missing}
        products = [x for x in products if x['img'] not in gone]
        site = {k: v for k, v in site.items() if v not in gone}

    crafts = [{'key': k, 'name': n, 'count': sum(c['count'] for c in collections if c['craft'] == k),
               'img': next((c['img'] for c in collections if c['craft'] == k), None)} for k, n, _ in CRAFTS]
    totals = {'online': len(items), 'shown': sum(c['count'] for c in collections), 'collections': len(collections),
              'sets': sum(1 for p in items if p['availableCount'] > 1), 'inMock': len(products), 'fetchedAt': meta['fetchedAt']}
    data = {'totals': totals, 'categories': categories, 'collections': collections, 'products': products, 'crafts': crafts,
            'site': site, 'skipped': skipped,
            'store': {'name': 'Nandam Handlooms', 'lines': ['#10-23, Opp. Brahmam Gari Temple', 'Hussain Katta, Old Mangalagiri', 'Guntur Dist, Andhra Pradesh 522 503'],
                      'phone': '+91 73829 68566', 'hours': 'Monday to Sunday, 9:30 am to 8:30 pm', 'map': 'https://maps.app.goo.gl/qK54PztChaCdGzMz6'}}
    with open(os.path.join(ROOT, 'assets', 'data.js'), 'w') as f:
        f.write('/* Generated by build/build-data.py from the live public catalogue (' + meta['fetchedAt'] + '). Do not edit by hand. */\n')
        f.write('window.NH_DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(json.dumps(totals), 'skipped', len(skipped), 'categories shown', [c['name'] for c in categories if c['shown']])


if __name__ == '__main__':
    main()
