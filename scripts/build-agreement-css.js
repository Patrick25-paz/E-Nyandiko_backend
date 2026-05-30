const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const backendRoot = path.resolve(__dirname, '..');
const frontendRoot = path.resolve(backendRoot, '..', 'frontend');
const inputCss = path.join(backendRoot, 'src', 'styles', 'agreement.css');
const outputCss = path.join(backendRoot, 'dist', 'styles', 'agreement.css');
const frontendDist = path.join(frontendRoot, 'dist');

if (!fs.existsSync(inputCss)) {
  console.error(`Missing input CSS: ${inputCss}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(outputCss), { recursive: true });


function findLatestCssFile(dir) {
  if (!fs.existsSync(dir)) return null;

  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = findLatestCssFile(fullPath);
      if (nested) files.push(nested);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.css')) {
      files.push(fullPath);
    }
  }

  if (files.length === 0) return null;
  return files.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0];
}

let sourceCss = findLatestCssFile(frontendDist);

if (!sourceCss) {
  const frontendBuild = spawnSync('npm', ['run', 'build'], {
    cwd: frontendRoot,
    stdio: 'inherit',
    shell: true,
  });

  if (frontendBuild.error) {
    console.error(frontendBuild.error.message);
    process.exit(1);
  }

  if (frontendBuild.status !== 0) {
    process.exit(frontendBuild.status || 1);
  }

  sourceCss = findLatestCssFile(frontendDist);
}

if (!sourceCss) {
  console.error(`Compiled frontend CSS not found in ${frontendDist}.`);
  process.exit(1);
}

fs.copyFileSync(sourceCss, outputCss);
console.log(`Copied ${sourceCss} -> ${outputCss}`);
