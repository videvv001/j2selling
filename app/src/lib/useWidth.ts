import { useEffect, useState } from 'react';

/** Current window width, updated on resize. Layouts switch at the same breakpoints as the design. */
export function useWidth(): number {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}
