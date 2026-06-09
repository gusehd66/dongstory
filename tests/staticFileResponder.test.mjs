import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStaticFileResponder } from '../server/staticFileResponder.mjs';

test('serves index.html for the root route', async () => {
  const distDir = await createDistFixture();

  try {
    const response = await createStaticFileResponder(distDir).respond('/');

    assert.equal(response.status, 200);
    assert.equal(response.contentType, 'text/html; charset=utf-8');
    assert.equal(response.body.toString(), '<main>Dongstory</main>');
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});

test('serves static assets with matching content types', async () => {
  const distDir = await createDistFixture();

  try {
    const response = await createStaticFileResponder(distDir).respond('/assets/app.js');

    assert.equal(response.status, 200);
    assert.equal(response.contentType, 'text/javascript; charset=utf-8');
    assert.equal(response.body.toString(), 'console.log("ok");');
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});

test('falls back to index.html for client-side routes', async () => {
  const distDir = await createDistFixture();

  try {
    const response = await createStaticFileResponder(distDir).respond('/floor/12');

    assert.equal(response.status, 200);
    assert.equal(response.contentType, 'text/html; charset=utf-8');
    assert.equal(response.body.toString(), '<main>Dongstory</main>');
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});

async function createDistFixture() {
  const distDir = await mkdtemp(join(tmpdir(), 'dongstory-dist-'));
  const assetsDir = join(distDir, 'assets');

  await mkdir(assetsDir, { recursive: true });
  await writeFile(join(distDir, 'index.html'), '<main>Dongstory</main>');
  await writeFile(join(distDir, 'favicon.svg'), '<svg></svg>');
  await writeFile(join(assetsDir, 'app.js'), 'console.log("ok");');

  return distDir;
}
