# Real data for the mock-up, from the live website's public API (read only), plus the admin app's
# list of categories (build/admin-categories.json, read from the live database on 25 Oct):
#   - all 6 active categories: the 4 on the website with their live counts, and the 2 without
#     sarees on the website yet (shown as "Coming soon"), with the photos chosen for each;
#   - every collection (subcategory) on the website, with its photo, words and the saree-page notes;
#   - every saree of every collection (1,730 on 25 Oct); their photos stay on the shop's media (S3).
# Collection and category photos are kept small (WebP) in img/c/. Writes assets/data.js.
# Run in docs/design/ui-mockup/web-10-category-pages: python3 build/fetch.py
import json, os, shutil, subprocess, time, urllib.request, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
API = 'https://nandamhandlooms.com/api/v2/shop'
S3 = 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/'

def get(path):
    time.sleep(0.3)  # the website allows 240 calls a minute from one address
    with urllib.request.urlopen(API + path, timeout=30) as r:
        return json.load(r)

def webp(src, dest, width):
    if os.path.exists(dest): return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + '.src'
    if src.startswith('http'): urllib.request.urlretrieve(src, tmp)
    else: shutil.copyfile(src, tmp)
    subprocess.run(['cwebp', '-quiet', '-q', '74', '-resize', str(width), '0', tmp, '-o', dest], check=True)
    os.remove(tmp)
    return dest
rel = lambda p: os.path.relpath(p, ROOT).replace(os.sep, '/')
site = lambda name, w: f'img/site/{name}-{w}.webp'

home = get('/home')
catalog = get('/catalog')
admin = json.load(open(os.path.join(HERE, 'admin-categories.json'), encoding='utf-8'))

# ---------- Every saree of every collection ----------
products, highlights = [], {}
for c in catalog['collections']:
    offset = 0
    while offset is not None:
        page = get('/products?' + urllib.parse.urlencode({'collection': c['id'], 'limit': 48, 'offset': offset}))
        for p in page['items']:
            products.append({'slug': p['slug'], 'sku': p['sku'], 'name': p['name'], 'collection': c['id'], 'category': p['category'], 'craft': p.get('craft'),
                             'price': p['price'], 'available': p['available'], 'photo': (p.get('photo') or {}).get('url'), 'alt': (p.get('photo') or {}).get('alt') or p['name'],
                             'isNew': p['isNew'], 'addedAt': p['addedAt']})
        offset = page['nextOffset']
    first = next((p for p in products if p['collection'] == c['id']), None)
    if first:  # the saree page's words come from the collection: one look per collection
        d = get('/products/' + first['slug'])['product']
        highlights[c['id']] = {'description': d.get('description') or '', 'highlights': d.get('highlights') or []}
    print(f"{c['name']}: {sum(1 for p in products if p['collection'] == c['id'])} (website {c['count']})")
by_sku = {p['sku']: p for p in products}

# ---------- Collections: their own photos, two fixed (25 Oct) ----------
# Kalamkari Lehanga Sets' photo is a laptop keyboard; Plain Cotton Saree's is a saree that isn't one of its two.
FIX = {'Kalamkari Lehanga Sets': 'NH-PLS-022', 'Plain Cotton Saree': 'NH-HCS-002'}
collections = []
for c in catalog['collections']:  # the website's order: the most pieces first
    src = by_sku[FIX[c['name']]]['photo'] if c['name'] in FIX else c.get('image')
    img = webp(src, os.path.join(ROOT, 'img/c', 'col-' + c['id'][:8] + '.webp'), 420) if src else None
    newest = max((p['addedAt'] for p in products if p['collection'] == c['id']), default='')
    collections.append({'id': c['id'], 'name': c['name'], 'category': c['category'], 'craft': c.get('craft'), 'price': c['price'], 'band': c.get('band'), 'count': c['count'], 'sets': c.get('sets', 0),
                        'image': rel(img) if img else None, 'photoFixed': c['name'] in FIX, 'newest': newest, 'hasNew': any(p['isNew'] for p in products if p['collection'] == c['id']),
                        **highlights.get(c['id'], {'description': c.get('description') or '', 'highlights': []})})

# ---------- The 6 categories ----------
SHORT = {'mangalagiri-handloom-pattu-sarees': 'Pattu sarees', 'handloom-pattu-dress-material': 'Pattu dress materials', 'pattu-lehanga-sets': 'Lehanga sets',
         'handloom-cotton-saree': 'Cotton sarees', 'handloom-cotton-dress-material': 'Cotton dress materials', 'fabrics': 'Fabrics'}
NAME = {'mangalagiri-handloom-pattu-sarees': 'Mangalagiri Handloom Pattu Sarees'}  # the admin app writes it in capitals
# Every card uses the photo set in the admin app, as the website does since 27 Oct (owner).
# The server falls back to the newest collection's photo; with neither, the website's own.
shop_photo = {c['slug']: c.get('image') for c in catalog['categories'] + catalog.get('soon', [])}
ALT = {'mangalagiri-handloom-pattu-sarees': 'Mangalagiri pattu sarees', 'handloom-pattu-dress-material': 'A pattu dress material',
       'pattu-lehanga-sets': 'Pattu lehanga sets', 'handloom-cotton-saree': 'A handloom cotton saree',
       'handloom-cotton-dress-material': 'A cotton dress material', 'fabrics': 'Fabrics'}

def admin_photo(slug):
    src = shop_photo.get(slug)
    if not src: return site('silver-border', 1200)
    dest = os.path.join(ROOT, 'img/c', f'admin-{slug}.webp')
    if os.path.exists(dest): os.remove(dest)  # always the photo the admin app has today
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + '.src'
    urllib.request.urlretrieve(src, tmp)
    subprocess.run(['cwebp', '-quiet', '-q', '80', tmp, '-o', dest], check=True)  # its own size, never enlarged
    os.remove(tmp)
    return rel(dest)

live = {c['slug']: c for c in home['categories']}
categories = []
for a in admin['categories']:
    slug = a['slug']
    tile_p = banner_p = admin_photo(slug)
    pos, alt = '50% 50%', ALT[slug]
    lc = live.get(slug)
    categories.append({
        'slug': slug, 'name': NAME.get(slug, a['name']), 'short': SHORT[slug], 'image': tile_p, 'banner': banner_p, 'bannerPos': pos, 'alt': alt,
        'count': lc['count'] if lc else 0, 'collections': lc['collections'] if lc else 0, 'soon': not lc,
        'description': (lc or {}).get('description') or a['description'],
        # For "Coming soon": the subcategories the admin app already has (test ones left out).
        'upcoming': [] if lc else [s['name'] for s in a['subs'] if s['name'] != 'Test1'],
    })
categories.sort(key=lambda c: (c['soon'], -c['count']))

crafts = []
for k in home['crafts']:
    top = next((c for c in collections if c['craft'] == k['key'] and c['image']), None)
    crafts.append({'key': k['key'], 'name': k['name'], 'count': k['count'], 'image': top['image'] if top else None})

store = home['store']
NH = {
    'at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'totals': home['totals'], 'categories': categories, 'crafts': crafts,
    'priceBands': catalog['priceBands'], 'collections': collections, 'products': products,
    'store': {'addressLines': store['addressLines'], 'hours': store['hours'], 'mapUrl': store['mapUrl'], 'whatsapp': '917382388565', 'phone': '7382388565'},  # the new number (waiting to go live)
}
with open(os.path.join(ROOT, 'assets', 'data.js'), 'w', encoding='utf-8') as f:
    f.write('/* Live website data (' + NH['at'][:10] + '): 6 categories, ' + str(len(collections)) + ' collections, every saree (' + str(len(products)) + '). Built by build/fetch.py. */\n')
    f.write('window.NH = ' + json.dumps(NH, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f'{len(categories)} categories ({sum(c["soon"] for c in categories)} coming soon), {len(collections)} collections, {len(products)} sarees, {len(crafts)} crafts')
