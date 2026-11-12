// The site may be served below a path (a GitHub project page), so every internal link goes through the base path.
export function sitePath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}
