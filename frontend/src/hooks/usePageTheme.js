import { useLayoutEffect } from "react";

/**
 * Call once per page component: `usePageTheme("pdfstudio")`. Sets
 * data-theme on <html> before paint (useLayoutEffect, not useEffect) so
 * there's no flash of the previous page's colors when navigating.
 */
export function usePageTheme(themeName) {
  useLayoutEffect(() => {
    const previous = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = themeName;
    return () => {
      if (previous) document.documentElement.dataset.theme = previous;
    };
  }, [themeName]);
}
