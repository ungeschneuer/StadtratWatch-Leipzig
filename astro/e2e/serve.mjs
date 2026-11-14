// Serves the built site below its base path, as GitHub Pages does: a folder answers with its index.html, anything
// unknown with 404. `astro preview` runs as a background service in Astro 7, which Playwright cannot wait for.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const [port, base = '/StadtratWatch-Leipzig'] = process.argv.slice(2);
const root = new URL('../dist/', import.meta.url).pathname;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.csv': 'text/csv',
  '.wasm': 'application/wasm',
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const inside = pathname.startsWith(`${base}/`) || pathname === base;
  let file = inside ? normalize(join(root, pathname.slice(base.length))) : '';
  if (file && existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Nicht gefunden');
    return;
  }
  response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
}).listen(Number(port));
