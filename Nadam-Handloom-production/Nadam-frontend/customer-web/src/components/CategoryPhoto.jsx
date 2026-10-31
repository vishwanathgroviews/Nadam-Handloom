import Picture from './Picture.jsx';

// A category's photo: one of the website's own ({ site }) or the shop's ({ url }).
export default function CategoryPhoto({ photo, sizes = '100vw', alt = '', priority = false }) {
  if (photo.site) return <Picture name={photo.site} position={photo.position} sizes={sizes} alt={alt} priority={priority} />;
  if (!photo.url) return <span className="ph-missing" />;
  return <img src={photo.url} alt={alt} loading={priority ? 'eager' : 'lazy'} decoding={priority ? 'sync' : 'async'} fetchPriority={priority ? 'high' : undefined} />;
}
