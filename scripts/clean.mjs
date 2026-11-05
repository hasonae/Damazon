#!/usr/bin/env node
import { readdir, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const workspaceRoots = ['apps', 'packages'];

const buildDirectoryNames = new Set([
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.vite',
  'playwright-report',
  'test-results',
]);

/**
 * Compiled output that leaked next to TypeScript sources. Every workspace is
 * configured with `noEmit` for typechecking and writes real output to `dist/`,
 * so a `.js`/`.d.ts` file inside `src/` is always a leftover from an
 * accidentally emitting run. Left in place they shadow the `.tsx` sources
 * during Vite resolution, so edits would silently never reach the browser.
 */
const artifactExtensions = ['.js', '.js.map', '.d.ts', '.d.ts.map'];

async function collectTargets(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const targets = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const entryPath = join(directory, entry.name);
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue;
    }
    if (buildDirectoryNames.has(entry.name)) {
      targets.push(entryPath);
      continue;
    }
    targets.push(...(await collectTargets(entryPath)));
  }

  return targets;
}

function sourceStem(fileName) {
  for (const extension of artifactExtensions) {
    if (fileName.endsWith(extension)) {
      return fileName.slice(0, -extension.length);
    }
  }
  return null;
}

/**
 * Removes compiled artifacts inside `src/` directories, but only when a
 * `.ts` or `.tsx` source with the same stem exists, so hand-written JavaScript
 * (none is expected today, but the guard keeps the script honest) survives.
 */
async function collectSourceArtifacts(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const artifacts = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }
      artifacts.push(...(await collectSourceArtifacts(entryPath)));
      continue;
    }
    const stem = sourceStem(entry.name);
    if (stem === null) {
      continue;
    }
    const hasSource =
      (await stat(join(directory, `${stem}.ts`)).then(
        () => true,
        () => false,
      )) ||
      (await stat(join(directory, `${stem}.tsx`)).then(
        () => true,
        () => false,
      ));
    if (hasSource) {
      artifacts.push(entryPath);
    }
  }

  return artifacts;
}

async function main() {
  const targets = [];
  const artifacts = [];
  for (const workspaceRoot of workspaceRoots) {
    const root = join(repositoryRoot, workspaceRoot);
    targets.push(...(await collectTargets(root)));
    artifacts.push(...(await collectSourceArtifacts(root)));
  }

  for (const target of targets) {
    const info = await stat(target).catch(() => null);
    if (!info) {
      continue;
    }
    await rm(target, { recursive: true, force: true });
    process.stdout.write(`removed ${target.slice(repositoryRoot.length + 1)}\n`);
  }

  for (const artifact of artifacts) {
    await rm(artifact, { force: true });
    process.stdout.write(`removed stale artifact ${artifact.slice(repositoryRoot.length + 1)}\n`);
  }

  if (targets.length === 0 && artifacts.length === 0) {
    process.stdout.write('nothing to clean\n');
  }
}

await main();
