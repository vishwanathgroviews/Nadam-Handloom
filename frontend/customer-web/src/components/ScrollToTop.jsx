import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Puts every navigation back at the top of the page.
 *
 * A single-page app does not reload on navigation, so the browser keeps
 * whatever scroll position the previous screen was left at: tapping a product
 * halfway down a category listing opened its page already scrolled past the
 * photo, and going from a long cart to checkout started below the address
 * form. Nothing in the app was resetting it.
 *
 * Browser Back and Forward are deliberately left alone — the browser restores
 * the position you had on that entry, which is exactly what someone expects
 * when returning to a listing they had scrolled through.
 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;
    // 'instant' rather than smooth: this is a page change, not a scroll
    // gesture, and animating it makes the new page visibly slide.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, search, navigationType]);

  return null;
}
