import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Read Next.js output without assuming that a deployment adapter uses server/app. */
export function buildOutputFiles(distDir = '.next') {
  const { config } = JSON.parse(readFileSync(join(distDir, 'required-server-files.json'), 'utf8'));
  assert(config && typeof config === 'object', 'missing Next.js build configuration');
  const adapter = Boolean(config.adapterPath);
  /** @type {Map<string, string>} */
  const files = new Map();
  function walk(directory, prefix = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      const file = join(directory, entry.name);
      if (entry.isDirectory()) walk(file, name);
      else if (entry.isFile() && /\.(html|body)$/.test(entry.name)) {
        assert(!files.has(name), `ambiguous build output: ${name}`);
        files.set(name, file);
      }
    }
  }
  if (adapter) {
    // Next.js 16.3 adapter builds isolate each source route under its own cache owner.
    // Use only this build's configured layout; never fall back to stale server/app files.
    for (const kind of ['APP_PAGE', 'APP_ROUTE']) {
      const directory = join(distDir, 'server', 'route-cache', kind);
      if (!existsSync(directory)) continue;
      for (const owner of readdirSync(directory, { withFileTypes: true })) {
        assert(owner.isDirectory() && /^[a-f0-9]{64}$/.test(owner.name), `unexpected route-cache owner: ${owner.name}`);
        walk(join(directory, owner.name, '$'));
      }
    }
  } else {
    walk(join(distDir, 'server', 'app'));
  }
  assert(files.size > 0, 'no generated build output found');
  return {
    layout: adapter ? 'route-cache' : 'app',
    file(name) {
      const file = files.get(name);
      assert(file, `generated build output missing: ${name}`);
      return file;
    },
    find: (name) => files.get(name),
    html: [...files.entries()].filter(([name]) => name.endsWith('.html')),
  };
}
