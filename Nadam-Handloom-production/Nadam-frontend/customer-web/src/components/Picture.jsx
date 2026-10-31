import photos from '../data/sitePhotos.json';

// One of the shop's own photos, in the size the screen needs (WebP, JPEG for old browsers),
// with a blurred stand-in while it loads. priority: the first big photo of a page.
export default function Picture({ name, alt = '', sizes = '100vw', priority = false, className = '', position, style, ref }) {
  const p = photos[name];
  if (!p) return <span ref={ref} className={`pic ${className}`} style={style} />;
  const set = (ext) => p.widths.map((w) => `/img/site/${name}-${w}.${ext} ${w}w`).join(', ');
  const largest = p.widths[p.widths.length - 1];
  const fallback = p.widths.find((w) => w >= 1200) || largest;
  return (
    <span ref={ref} className={`pic ${className}`} style={{ backgroundImage: `url("${p.blur}")`, ...style }}>
      <picture>
        <source type="image/webp" srcSet={set('webp')} sizes={sizes} />
        <img
          src={`/img/site/${name}-${fallback}.jpg`}
          srcSet={set('jpg')}
          sizes={sizes}
          alt={alt}
          width={largest}
          height={Math.round(largest / p.ratio)}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          fetchPriority={priority ? 'high' : undefined}
          style={position ? { objectPosition: position } : undefined}
        />
      </picture>
    </span>
  );
}
