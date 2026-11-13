import type { ReactNode } from 'react';

// The review app is published below the site, at <site>/review/.
const SITE_URL = new URL('../', new URL(import.meta.env.BASE_URL, window.location.origin)).href;

export function Page({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="navbar border-base-300 bg-base-100 min-h-14 border-b px-4 sm:px-6">
        <a href={SITE_URL} className="text-primary font-semibold">
          StadtratWatch Leipzig
        </a>
        <span className="text-base-content/70 ms-2 text-sm">Prüfung</span>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-4 text-xl font-semibold sm:text-2xl">{children}</h1>;
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`alert alert-soft mb-4 ${tone === 'error' ? 'alert-error' : 'alert-info'}`}
    >
      {children}
    </p>
  );
}
