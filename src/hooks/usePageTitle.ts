import { useEffect } from 'react';

export function usePageTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} — myfynzo` : 'myfynzo — Your Wealth. AI-Guided.';
    return () => { document.title = prev; };
  }, [title]);
}
