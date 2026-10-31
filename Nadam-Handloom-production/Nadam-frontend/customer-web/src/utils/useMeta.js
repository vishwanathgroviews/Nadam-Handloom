import { useEffect } from 'react';

const DEFAULT = 'Handwoven Mangalagiri pattu sarees and dress materials from Nandam Handlooms, Old Mangalagiri. Free delivery across India.';

function tag(attr, key) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  return el;
}

// The page's description for search engines and link previews (title comes from useTitle).
export function useMeta(description, { image } = {}) {
  useEffect(() => {
    const text = description || DEFAULT;
    tag('name', 'description').setAttribute('content', text);
    tag('property', 'og:description').setAttribute('content', text);
    tag('property', 'og:title').setAttribute('content', document.title);
    tag('property', 'og:url').setAttribute('content', window.location.origin + window.location.pathname);
    if (image) tag('property', 'og:image').setAttribute('content', image);
  }, [description, image]);
}
