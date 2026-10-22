// Run with: node --test scripts/build-output-files.check.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { buildOutputFiles } from './build-output-files.mjs';

function fixture(t, adapter) {
  const root = mkdtempSync(join(tmpdir(), 'next-output-check-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  function put(name, text) {
    const file = join(root, name); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text);
  }
  put('required-server-files.json', JSON.stringify({ config: adapter ? { adapterPath: '/adapter.mjs' } : {} }));
  return { root, put };
}
for (const adapter of [false, true]) {
  test(`all output kinds remain inspectable (${adapter ? 'adapter' : 'local'})`, t => {
    const { root, put } = fixture(t, adapter);
    const page = adapter ? `server/route-cache/APP_PAGE/${'a'.repeat(64)}/$` : 'server/app';
    const route = adapter ? `server/route-cache/APP_ROUTE/${'b'.repeat(64)}/$` : 'server/app';
    put(`${page}/index.html`, 'home'); put(`${page}/guides/example.html`, 'guide');
    put(`${page}/salary/3000.html`, 'unsitemapped page'); put(`${page}/_not-found.html`, 'error');
    put(`${route}/sitemap.xml.body`, 'sitemap'); put(`${route}/robots.txt.body`, 'robots');
    put(`${route}/icon.png.body`, 'image'); put(`${page}/page.js`, 'not HTML');
    const output = buildOutputFiles(root);
    assert.equal(output.layout, adapter ? 'route-cache' : 'app');
    assert.deepEqual(output.html.map(([name]) => name).sort(), ['_not-found.html', 'guides/example.html', 'index.html', 'salary/3000.html']);
    for (const [name, content] of [['sitemap.xml.body','sitemap'], ['robots.txt.body','robots'], ['icon.png.body','image'], ['guides/example.html','guide']]) {
      assert.equal(readFileSync(output.file(name), 'utf8'), content);
    }
    assert.equal(output.find('missing.png.body'), undefined);
    assert.throws(() => output.file('missing.html'), /missing/);
  });
}
test('adapter output cannot be rescued by stale local output', t => {
  const { root, put } = fixture(t, true);
  put('server/app/sitemap.xml.body', 'stale');
  assert.throws(() => buildOutputFiles(root), /no generated/);
  put(`server/route-cache/APP_PAGE/${'a'.repeat(64)}/$/index.html`, 'new');
  assert.throws(() => buildOutputFiles(root).file('sitemap.xml.body'), /missing/);
});
test('duplicate public paths fail instead of silently choosing an owner', t => {
  const { root, put } = fixture(t, true);
  for (const owner of ['a', 'b']) put(`server/route-cache/APP_PAGE/${owner.repeat(64)}/$/index.html`, 'duplicate');
  assert.throws(() => buildOutputFiles(root), /ambiguous/);
});
test('missing or unknown layout fails closed', t => {
  const { root, put } = fixture(t, true);
  put('server/route-cache/APP_PAGE/unknown/index.html', 'unexpected');
  assert.throws(() => buildOutputFiles(root), /unexpected/);
  put('required-server-files.json', '{}');
  assert.throws(() => buildOutputFiles(root), /configuration/);
});
