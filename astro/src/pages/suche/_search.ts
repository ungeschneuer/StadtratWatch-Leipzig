type PagefindUIOptions = {
  element: HTMLElement;
  bundlePath: string;
  showSubResults: boolean;
  showImages: boolean;
  resetStyles: boolean;
};

declare global {
  interface Window {
    PagefindUI?: new (options: PagefindUIOptions) => unknown;
  }
}

// The UI script is part of the index Pagefind writes after the build, so it is loaded from there and not bundled.
export function loadSearch(element: HTMLElement): void {
  const bundlePath = element.dataset.bundlePath ?? '/pagefind/';
  const script = document.createElement('script');
  script.src = `${bundlePath}pagefind-ui.js`;
  script.addEventListener('load', () => {
    if (!window.PagefindUI) return;
    new window.PagefindUI({
      element,
      bundlePath,
      showSubResults: true,
      showImages: false,
      resetStyles: false,
    });
  });
  script.addEventListener('error', () => {
    element.textContent =
      'Der Suchindex fehlt. Er entsteht beim Bauen der Seite (npm run build).';
  });
  document.head.append(script);
}
