// A saree (/product/:slug): photos, price, what is in stock, "Add to bag" (W5; pieces for a set)
// and ordering on WhatsApp. MRP is never shown.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import QtyStepper from '../../components/QtyStepper.jsx';
import { Crumbs, Skeleton } from '../../components/bits.jsx';
import SareeCard from '../../components/SareeCard.jsx';
import { Rail, RailNav } from '../../components/Rail.jsx';
import { useRail } from '../../components/useRail.js';
import { useToast } from '../../components/Toasts.jsx';
import Gallery from './Gallery.jsx';
import NotFoundPage from '../info/NotFoundPage.jsx';
import { useSaree } from '../../data/shop.js';
import { readRecent, rememberSaree } from '../../data/recent.js';
import { useConfig } from '../../config/useConfig.js';
import { useBag } from '../../bag/useBag.js';
import { add, openPanel, MAX_LINES } from '../../bag/store.js';
import { useReveal, useScrollFrame } from '../../utils/motion.js';
import { useTitle } from '../../utils/useTitle.js';
import { useMeta } from '../../utils/useMeta.js';
import { formatMobile } from '../../utils/format.js';
import { num, rs } from '../../utils/money.js';

const PERKS = [
  ['truck', 'Free delivery across India'],
  ['thread', 'Handwoven in Mangalagiri'],
  ['whatsapp', 'Order help on WhatsApp'],
  ['store', 'See it at our store'],
];

function CardRail({ id, eyebrow, title, cards }) {
  const rail = useRail();
  return (
    <section className="section tight" aria-labelledby={id}>
      <div className="sec-head">
        <div><span className="eyebrow">{eyebrow}</span><h2 id={id}>{title}</h2></div>
        <RailNav rail={rail} label={title} />
      </div>
      <Rail rail={rail} label={title} className="four">
        {cards.map((c, i) => <SareeCard key={c.slug} card={c} index={i} />)}
      </Rail>
    </section>
  );
}

function Loading() {
  return (
    <div className="wrap" aria-busy="true" aria-label="Loading the saree">
      <div className="page-head"><Skeleton h={14} style={{ width: 260 }} /></div>
      <div className="pdp">
        <Skeleton h={560} />
        <div className="stack"><Skeleton h={14} style={{ width: '40%' }} /><Skeleton h={44} /><Skeleton h={36} style={{ width: '50%' }} /><Skeleton h={54} /><Skeleton h={120} /></div>
      </div>
    </div>
  );
}

function stockLine(p) {
  if (p.soldOut) return ['out', 'Sold out'];
  if (p.available > 1) return ['', `${num(p.available)} identical pieces in stock: a set for the family`];
  return ['low', 'Only one piece: once it sells, this design is gone'];
}

export default function ProductPage() {
  const { slug } = useParams();
  const { data, status, error, reload } = useSaree(slug);
  const { config } = useConfig();
  const toast = useToast();
  const navigate = useNavigate();
  const bag = useBag();
  const [want, setWant] = useState({ slug, n: 1 });
  const [adding, setAdding] = useState(false);
  const p = data?.product;
  const box = useRef(null);
  const buyRef = useRef(null);
  const [bar, setBar] = useState(false);
  // Read once per saree: the list as it was before this visit.
  const recent = useMemo(() => readRecent().filter((c) => c.slug !== slug).slice(0, 10), [slug]);

  useTitle(p ? p.name : status === 'error' ? 'Saree' : 'Loading');
  useMeta(p ? `${p.name} (${p.sku}), ${rs(p.price)}. ${p.description}`.slice(0, 300) : undefined, { image: p?.photo?.url });
  useReveal(box, [p?.slug]);

  useEffect(() => { if (p) rememberSaree({ ...p, category: p.category.slug }); }, [p]);

  // The bar at the bottom of phones appears once the main buttons have scrolled up out of view.
  useScrollFrame(() => {
    const el = buyRef.current;
    if (el) setBar(el.getBoundingClientRect().bottom < 0);
  }, [p?.slug], { always: true });

  if (status === 'error' && !p) {
    if (error?.status === 404 || error?.code === 'PRODUCT_NOT_FOUND' || error?.code === 'VALIDATION_FAILED') {
      return <NotFoundPage title="This saree isn't on the website now" text="It may have sold out. Take a look at what's new instead." />;
    }
    return (
      <div className="wrap narrow">
        <div className="empty" role="alert">
          <div className="ico-wrap"><Icon name="wifioff" /></div>
          <h3>We couldn't load this saree</h3>
          <p>Please check your connection and try again.</p>
          <button type="button" className="btn btn-primary" onClick={reload}>Try again</button>
        </div>
      </div>
    );
  }
  if (!p) return <Loading />;

  const url = `${window.location.origin}/product/${p.slug}`;
  const wa = config.store.whatsapp;
  const orderText = p.soldOut
    ? `Hello Nandam Handlooms, this saree is sold out. Do you have a similar one?\n${p.name}\nCode: ${p.sku}\n${url}`
    : `Hello Nandam Handlooms, I'd like to order this saree:\n${p.name}\nCode: ${p.sku}\nPrice: ${rs(p.price)}\n${url}`;
  const waHref = `https://wa.me/${wa}?text=${encodeURIComponent(orderText)}`;
  const phone = config.shop.mobile;
  const [tone, stockText] = stockLine(p);
  const colTo = `/category/${p.category.slug}/${p.collection.id}`;

  // The bag: how many of this saree are in it, and how many more can go in.
  const inBag = bag.items.find((it) => it.slug === p.slug)?.quantity || 0;
  const isSet = p.available > 1;
  const room = Math.max(0, p.available - inBag);
  const pieces = Math.min(want.slug === p.slug ? want.n : 1, Math.max(1, room));
  const full = !inBag && bag.items.length >= MAX_LINES;
  const allIn = inBag > 0 && room < 1;
  async function addToBag() {
    if (adding) return;
    setAdding(true);
    try {
      await add({ slug: p.slug, sku: p.sku, name: p.name, price: p.price, available: p.available, photo: p.photo }, isSet ? pieces : 1);
      setWant({ slug: p.slug, n: 1 });
    } catch (err) {
      toast(err.message, { tone: 'bad', ...(err.code === 'BAG_FULL' ? { action: { label: 'View bag', onClick: () => navigate('/bag') } } : {}) });
    } finally {
      setAdding(false);
    }
  }

  // No shop name in the shared text (client, 23 Oct 2026); the link is the only pointer to us.
  async function share() {
    const data = { title: p.name, text: `${p.name}, ${rs(p.price)}`, url };
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch (err) {
      if (err?.name !== 'AbortError') toast('Couldn\'t share. Copy the address from the address bar.', { tone: 'bad' });
    }
  }

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.sku,
    image: p.photos.map((x) => x.url),
    description: p.description,
    brand: { '@type': 'Brand', name: 'Nandam Handlooms' },
    category: p.category.name,
    offers: { '@type': 'Offer', url, priceCurrency: 'INR', price: String(p.price), availability: `https://schema.org/${p.soldOut ? 'OutOfStock' : 'InStock'}`, itemCondition: 'https://schema.org/NewCondition' },
  };

  return (
    <div className="wrap" ref={box}>
      {/* Data for search engines only; never run as code. */}
      <script type="application/ld+json">{JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
      <div className="page-head">
        <Crumbs items={[['Home', '/'], [p.category.name, `/category/${p.category.slug}`], [p.collection.name, colTo], [p.sku]]} />
      </div>
      <div className="pdp">
        <Gallery photos={p.photos.length ? p.photos : p.photo ? [p.photo] : []} />
        <div className="buy">
          {p.collection.name.trim().toLowerCase() === p.name.trim().toLowerCase()
            ? <Link className="colname" to={`/category/${p.category.slug}`}>{p.category.name}</Link>
            : <Link className="colname" to={colTo}>{p.collection.name}</Link>}
          <h1>{p.name}</h1>
          <div className="meta">
            <span>Code <b className="tnum">{p.sku}</b></span>
            {p.craftName ? <span>· {p.craftName}</span> : null}
            {p.isNew && !p.soldOut ? <span className="badge badge-gold">New</span> : null}
          </div>
          <div className="pricebox">
            <span className="price">{rs(p.price)}</span>
            <small>Free delivery across India</small>
          </div>
          <div className={`stockline ${tone}`} role="status"><span className="dot" aria-hidden="true" />{stockText}</div>
          {p.soldOut ? (
            <>
              <div className="buy-row" ref={buyRef}>
                <a className="btn btn-wa btn-lg btn-block" href={waHref} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size="sm" />Ask for a similar saree</a>
                <Link className="btn btn-lg btn-block" to={colTo}>More from this collection</Link>
              </div>
              <p className="muted small">Send us the code and we will look for the same design in another colour.</p>
            </>
          ) : (
            <>
              {isSet && room > 0 ? (
                <div className="buy-qty">
                  <span className="label">Pieces</span>
                  <QtyStepper value={pieces} max={room} onChange={(n) => setWant({ slug: p.slug, n })} label="Pieces to add to the bag" />
                  <span className="left">{inBag ? `${inBag} in your bag · up to ${room} more` : `Up to ${room}`}</span>
                </div>
              ) : null}
              {full ? (
                <Alert tone="warn" title="Your bag is full">{MAX_LINES} different sarees is the most it holds. Remove one to add this saree. <Link className="link" to="/bag">Open the bag</Link></Alert>
              ) : null}
              <div className="buy-row" ref={buyRef}>
                {allIn ? (
                  <button type="button" className="btn btn-inbag btn-lg btn-block" onClick={() => openPanel(null)}>
                    <Icon name="check" size="sm" />{isSet ? `All ${p.available} pieces are in your bag` : 'In your bag'} · View
                  </button>
                ) : (
                  <Button kind="primary" size="lg" block icon="bag" loading={adding} disabled={full} onClick={addToBag}>
                    {inBag ? (pieces === 1 ? 'Add one more to bag' : `Add ${pieces} more to bag`) : 'Add to bag'}
                  </Button>
                )}
                <a className="btn btn-lg btn-block" href={waHref} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size="sm" />Order on WhatsApp</a>
              </div>
              <p className="call-line"><Icon name="phone" size="sm" />Questions? Call <a href={`tel:+91${phone}`}>{formatMobile(phone)}</a></p>
              <p className="hold-note"><Icon name="clock" size="sm" /><span>The bag doesn&apos;t hold the saree: our store sells it too. Send your bag on WhatsApp and we confirm it is still here.</span></p>
            </>
          )}
          <div className="perks">{PERKS.map(([icon, t]) => <div key={t}><Icon name={icon} size="sm" />{t}</div>)}</div>
          {p.highlights.length ? <ul className="highlights">{p.highlights.map((h) => <li key={h}>{h}</li>)}</ul> : null}
          <div className="acc">
            <details open={!p.highlights.length}>
              <summary>About this saree<Icon name="plus" size="sm" /></summary>
              <div className="body">
                <p>{p.description}</p>
                {p.details.length ? <ul>{p.details.map((d) => <li key={d.label}><b>{d.label}:</b> {d.value}</li>)}</ul> : null}
                <p>Colours can look a little different on screens. Ask us on WhatsApp for a video in daylight.</p>
              </div>
            </details>
            <details>
              <summary>Ordering and delivery<Icon name="plus" size="sm" /></summary>
              <div className="body">
                <ul>
                  <li>Add the sarees you like to your bag{isSet ? ': for a set, choose how many pieces' : ''}.</li>
                  <li>Tap <b>Send bag on WhatsApp</b>: the codes, pieces and prices are filled in for you. Or order just this saree with <b>Order on WhatsApp</b>.</li>
                  <li>We confirm they are available and share the payment details.</li>
                  <li>Free delivery across India. We share the tracking number once it ships.</li>
                </ul>
              </div>
            </details>
            <details>
              <summary>Care<Icon name="plus" size="sm" /></summary>
              <div className="body">
                <ul>
                  <li>Dry clean the first few times; after that, a gentle cold hand wash.</li>
                  <li>Dry in the shade, and iron on the reverse at low heat.</li>
                  <li>Store wrapped in a cotton cloth, refolded now and then so the zari doesn't crease.</li>
                </ul>
              </div>
            </details>
          </div>
          <div className="share">
            <span>Share</span>
            <button type="button" className="btn btn-sm" onClick={share}><Icon name="share" size="sm" />Share</button>
            <a className="btn btn-sm" href={`https://wa.me/?text=${encodeURIComponent(`${p.name}, ${rs(p.price)} ${url}`)}`} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size="sm" />WhatsApp</a>
          </div>
        </div>
      </div>

      {data.more.length ? <CardRail id="h-more" eyebrow="The same design" title="More from this collection" cards={data.more} /> : null}
      {data.similar.length ? <CardRail id="h-similar" eyebrow={p.craftName || 'You may also like'} title="You may also like" cards={data.similar} /> : null}
      {recent.length ? <CardRail id="h-recent" eyebrow="Your browsing" title="Recently viewed" cards={recent} /> : null}
      <div style={{ height: 'clamp(32px, 5vw, 64px)' }} />

      <div className={`buybar${bar ? ' on' : ''}`} aria-hidden={!bar}>
        {p.photo ? <img src={p.photo.url} alt="" /> : null}
        <span className="t"><b>{p.name}</b><span className="muted small">{rs(p.price)} · {p.sku}</span></span>
        {p.soldOut ? (
          <a className="btn btn-wa btn-sm" href={waHref} target="_blank" rel="noopener noreferrer" tabIndex={bar ? 0 : -1}><Icon name="whatsapp" size="sm" />Ask</a>
        ) : allIn ? (
          <button type="button" className="btn btn-inbag btn-sm" onClick={() => openPanel(null)} tabIndex={bar ? 0 : -1}><Icon name="check" size="sm" />In bag</button>
        ) : (
          <Button kind="primary" size="sm" icon="bag" loading={adding} disabled={full} onClick={addToBag} tabIndex={bar ? 0 : -1}>Add</Button>
        )}
      </div>
    </div>
  );
}
