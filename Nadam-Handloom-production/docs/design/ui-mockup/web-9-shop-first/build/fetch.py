# Real data for the "products first" shop mock-up, from the live website's public API (read only):
# the categories, crafts, price bands and collections with their live counts, and a sample of real
# sarees: up to 3 of the newest from every collection, each with its saree page details.
# Photos are kept small (WebP, 600 px wide) in img/p/. Writes assets/data.js.
# Run in docs/design/ui-mockup/web-9-shop-first: python3 build/fetch.py
import json, os, re, shutil, subprocess, time, urllib.request, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SITE = 'https://nandamhandlooms.com'
API = SITE + '/api/v2/shop'
WEB8 = os.path.join(os.path.dirname(ROOT), 'web-8-home-categories')  # the categories-first mock-up (same live photos)
PER_COLLECTION = 3

def get(path):
    time.sleep(0.3)  # the website allows 240 calls a minute from one address
    with urllib.request.urlopen(API + path, timeout=30) as r:
        return json.load(r)

def webp(src_url_or_path, dest, width):
    if os.path.exists(dest): return dest
    tmp = dest + '.src'
    if src_url_or_path.startswith('http'): urllib.request.urlretrieve(src_url_or_path, tmp)
    else: shutil.copyfile(src_url_or_path, tmp)
    subprocess.run(['cwebp', '-quiet', '-q', '72', '-resize', str(width), '0', tmp, '-o', dest], check=True)
    os.remove(tmp)
    return dest

rel = lambda p: os.path.relpath(p, ROOT).replace(os.sep, '/')

home = get('/home')
catalog = get('/catalog')

# ---------- Categories and crafts (live counts; photos as in the categories-first mock-up) ----------
SHORT = {'mangalagiri-handloom-pattu-sarees': 'Pattu sarees', 'handloom-pattu-dress-material': 'Dress materials', 'pattu-lehanga-sets': 'Lehanga sets', 'handloom-cotton-saree': 'Cotton sarees'}
CAT_PHOTO = {
    'mangalagiri-handloom-pattu-sarees': os.path.join(WEB8, 'img/site/lamps-800.webp'),
    'handloom-pattu-dress-material': os.path.join(WEB8, 'img/site/applique-800.webp'),
    'pattu-lehanga-sets': None,  # a lehanga collection photo, below
    'handloom-cotton-saree': os.path.join(WEB8, 'img/s3/site_categories_handloom-cotton-saree.jpg'),
}
cols_by_name = {c['name']: c for c in catalog['collections']}
CAT_PHOTO['pattu-lehanga-sets'] = cols_by_name['Full Digital Set Lehanga']['image']
categories = []
for c in sorted(home['categories'], key=lambda c: -c['count']):
    src = CAT_PHOTO[c['slug']]
    dest = webp(src, os.path.join(ROOT, 'img/c', c['slug'] + '.webp'), 480)
    categories.append({'slug': c['slug'], 'name': c['name'], 'short': SHORT.get(c['slug'], c['name']), 'count': c['count'], 'collections': c['collections'], 'description': c['description'], 'image': rel(dest)})

collections = []
for c in sorted(catalog['collections'], key=lambda c: -c['count']):
    img = webp(c['image'], os.path.join(ROOT, 'img/c', 'col-' + c['id'][:8] + '.webp'), 360) if c.get('image') else None
    collections.append({'id': c['id'], 'name': c['name'], 'category': c['category'], 'craft': c.get('craft'), 'price': c['price'], 'band': c.get('band'), 'count': c['count'], 'sets': c.get('sets', 0), 'image': rel(img) if img else None})

crafts = []
for k in home['crafts']:
    top = next((c for c in collections if c['craft'] == k['key'] and c['image']), None)
    crafts.append({'key': k['key'], 'name': k['name'], 'count': k['count'], 'image': top['image'] if top else None})

price_bands = [{'key': b['key'], 'label': b['label']} for b in catalog['priceBands']] if catalog.get('priceBands') and isinstance(catalog['priceBands'][0], dict) else []

# ---------- A sample of real sarees: up to 3 per collection, with their saree pages ----------
products = []
for c in collections:
    lst = get('/products?' + urllib.parse.urlencode({'collection': c['id'], 'limit': PER_COLLECTION}))
    for card in lst['items']:
        d = get('/products/' + card['slug'])['product']
        photos = []
        for i, ph in enumerate(d['photos'][:3]):
            dest = webp(ph['url'], os.path.join(ROOT, 'img/p', f"{card['sku']}-{i + 1}.webp"), 600)
            photos.append({'src': rel(dest), 'alt': ph.get('alt') or card['name']})
        products.append({
            'slug': card['slug'], 'sku': card['sku'], 'name': card['name'], 'collection': card['collection'], 'category': card['category'],
            'craft': card.get('craft'), 'craftName': d.get('craftName'), 'price': card['price'], 'available': card['available'], 'isNew': card['isNew'],
            'addedAt': card['addedAt'], 'photos': photos, 'description': d.get('description') or '', 'highlights': d.get('highlights') or [], 'details': d.get('details') or [],
        })
    print(f"{c['name']}: {len(lst['items'])}")

for f in ['img/site/pastel-1200.webp', 'img/site/zari-1200.webp', 'img/site/lamps-1200.webp', 'img/logo-96.png', 'img/logo-192.png']:
    os.makedirs(os.path.dirname(os.path.join(ROOT, f)), exist_ok=True)
    shutil.copyfile(os.path.join(WEB8, f), os.path.join(ROOT, f))
for f in os.listdir(os.path.join(WEB8, 'assets/fonts')):
    if re.search(r'(bodoni-moda-latin-(400|500)-normal|figtree-latin(-ext)?-wght-normal)-.*\.woff2$', f):
        shutil.copyfile(os.path.join(WEB8, 'assets/fonts', f), os.path.join(ROOT, 'assets/fonts', f))

store = home['store']
NH = {
    'at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'totals': home['totals'], 'categories': categories, 'crafts': crafts,
    'priceBands': price_bands, 'collections': collections, 'products': products,
    'store': {'name': 'Nandam Handlooms', 'addressLines': store['addressLines'], 'hours': store['hours'], 'mapUrl': store['mapUrl'],
              'whatsapp': '917382388565', 'phone': '7382388565'},  # the new shop number (waiting to go live)
}
with open(os.path.join(ROOT, 'assets', 'data.js'), 'w', encoding='utf-8') as f:
    f.write('/* Live website data (' + NH['at'][:10] + '): categories, crafts, collections with their real counts, and a sample of '
            + str(len(products)) + ' real sarees (up to ' + str(PER_COLLECTION) + ' per collection). Built by build/fetch.py. */\n')
    f.write('window.NH = ' + json.dumps(NH, ensure_ascii=False) + ';\n')
print(f'{len(categories)} categories, {len(crafts)} crafts, {len(collections)} collections, {len(products)} sarees')
