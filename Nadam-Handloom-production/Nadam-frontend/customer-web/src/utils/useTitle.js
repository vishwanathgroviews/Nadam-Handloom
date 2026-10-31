import { useEffect } from 'react';

// The browser tab's title for each page.
export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Nandam Handlooms` : 'Nandam Handlooms · Handwoven in Mangalagiri';
  }, [title]);
}
