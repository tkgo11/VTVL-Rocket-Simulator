import { useEffect, useState } from 'react';

/**
 * Returns true when the viewport is narrower than `breakpoint` px.
 * Uses matchMedia so resizes / orientation changes update the value live.
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    // Older Safari uses addListener / removeListener.
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, [breakpoint]);

  return isMobile;
}
