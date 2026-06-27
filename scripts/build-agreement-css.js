const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const backendRoot = path.resolve(__dirname, '..');
const frontendRoot = path.resolve(backendRoot, '..', 'frontend');
const inputCss = path.join(backendRoot, 'src', 'styles', 'agreement.css');
const outputCss = path.join(backendRoot, 'dist', 'styles', 'agreement.css');
const fallbackCss = path.join(backendRoot, 'src', 'styles', 'agreement.compiled.css');
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
  if (!fs.existsSync(frontendRoot)) {
    console.warn(`[Warning] Frontend directory not found at: ${frontendRoot}. Checking for fallback compiled CSS...`);
    if (fs.existsSync(fallbackCss)) {
      console.log(`[Success] Found fallback compiled CSS at: ${fallbackCss}. Using it.`);
      fs.copyFileSync(fallbackCss, outputCss);
      process.exit(0);
    } else if (fs.existsSync(outputCss)) {
      console.log(`[Success] Found existing compiled CSS at: ${outputCss}. Using it.`);
      process.exit(0);
    } else {
      console.warn(`[Warning] No fallback compiled CSS found at: ${fallbackCss}. Creating a basic stylesheet from input CSS.`);
      fs.copyFileSync(inputCss, outputCss);
      process.exit(0);
    }
  }

  console.log(`Frontend CSS not found. Attempting to build frontend at: ${frontendRoot}`);
  const frontendBuild = spawnSync('npm', ['run', 'build'], {
    cwd: frontendRoot,
    stdio: 'inherit',
    shell: true,
  });

  if (frontendBuild.error) {
    console.warn(`[Warning] Frontend build failed to spawn: ${frontendBuild.error.message}. Checking for existing compiled CSS...`);
    if (fs.existsSync(outputCss)) {
      console.log(`[Success] Found existing compiled CSS at: ${outputCss}. Using it.`);
      process.exit(0);
    } else {
      fs.copyFileSync(inputCss, outputCss);
      process.exit(0);
    }
  }

  if (frontendBuild.status !== 0) {
    console.warn(`[Warning] Frontend build failed with status ${frontendBuild.status}. Checking for existing compiled CSS...`);
    if (fs.existsSync(outputCss)) {
      console.log(`[Success] Found existing compiled CSS at: ${outputCss}. Using it.`);
      process.exit(0);
    } else {
      fs.copyFileSync(inputCss, outputCss);
      process.exit(0);
    }
  }

  sourceCss = findLatestCssFile(frontendDist);
}

if (!sourceCss) {
  console.warn(`[Warning] Compiled CSS not found in frontend build output. Checking for existing compiled CSS...`);
  if (fs.existsSync(outputCss)) {
    console.log(`[Success] Found existing compiled CSS at: ${outputCss}. Using it.`);
    process.exit(0);
  } else {
    fs.copyFileSync(inputCss, outputCss);
    process.exit(0);
  }
} else {
  fs.copyFileSync(sourceCss, outputCss);
  console.log(`Copied ${sourceCss} -> ${outputCss}`);
}
