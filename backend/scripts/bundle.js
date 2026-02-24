const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const handlers = ['upload', 'ingest', 'query', 'whitepaper'];

async function bundle() {
  for (const handler of handlers) {
    const entryPoint = path.join(__dirname, '..', 'handlers', handler, 'index.ts');
    const outDir = path.join(__dirname, '..', 'dist', handler);

    fs.mkdirSync(outDir, { recursive: true });

    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      outdir: outDir,
      platform: 'node',
      target: 'node20',
      format: 'cjs',
      sourcemap: true,
      external: [],
      minify: false,
    });

    console.log(`Bundled ${handler} handler`);
  }
}

bundle().catch((err) => {
  console.error(err);
  process.exit(1);
});
