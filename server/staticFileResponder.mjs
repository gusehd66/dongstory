import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.webp', 'image/webp'],
]);

export function createStaticFileResponder(distDir) {
  const rootDir = resolve(distDir);

  async function respond(requestUrl = '/') {
    const pathname = getPathname(requestUrl);
    const filePath = await getStaticFilePath(rootDir, pathname);

    if (!filePath) {
      return {
        status: 404,
        contentType: 'text/plain; charset=utf-8',
        body: Buffer.from('Not found'),
      };
    }

    return {
      status: 200,
      contentType: getContentType(filePath),
      body: await readFile(filePath),
    };
  }

  return { respond };
}

async function getStaticFilePath(rootDir, pathname) {
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const requestedPath = resolve(join(rootDir, safePath === sep ? 'index.html' : safePath));

  if (!isInsideRoot(rootDir, requestedPath)) {
    return undefined;
  }

  if (await isFile(requestedPath)) {
    return requestedPath;
  }

  const indexPath = join(rootDir, 'index.html');

  return await isFile(indexPath) ? indexPath : undefined;
}

function getPathname(requestUrl) {
  try {
    return new URL(requestUrl, 'http://localhost').pathname;
  } catch {
    return '/';
  }
}

function getContentType(filePath) {
  return CONTENT_TYPES.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream';
}

function isInsideRoot(rootDir, filePath) {
  return filePath === rootDir || filePath.startsWith(`${rootDir}${sep}`);
}

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}
