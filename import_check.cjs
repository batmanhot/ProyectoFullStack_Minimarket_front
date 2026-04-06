const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, 'src');
const exts = ['.js', '.jsx', '.ts', '.tsx'];
const regex = /^\s*import\s+.*\s+from\s+['"](\.[^'"]+)['"]/;
const missing = [];
function existsSync(file) {
  try { return fs.existsSync(file); } catch { return false; }
}
function checkImport(filePath, modulePath) {
  const candidate = path.resolve(path.dirname(filePath), modulePath);
  if (existsSync(candidate)) return true;
  for (const ext of exts) {
    if (existsSync(candidate + ext)) return true;
  }
  if (existsSync(candidate) && fs.lstatSync(candidate).isDirectory()) {
    for (const ext of exts) {
      if (existsSync(path.join(candidate, 'index' + ext))) return true;
    }
  }
  return false;
}
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      walk(p);
    } else if (stat.isFile() && (p.endsWith('.js') || p.endsWith('.jsx'))) {
      const text = fs.readFileSync(p, 'utf8');
      const lines = text.split(/\r?\n/);
      lines.forEach((line, index) => {
        const m = regex.exec(line);
        if (m) {
          const mod = m[1];
          if (mod.startsWith('.')) {
            if (!checkImport(p, mod)) {
              missing.push({ file: p, line: index + 1, text: line.trim(), resolved: path.resolve(path.dirname(p), mod) });
            }
          }
        }
      });
    }
  }
}
walk(root);
if (missing.length) {
  missing.forEach(m => {
    console.log(`${m.file}:${m.line}: ${m.text} -> ${m.resolved}`);
  });
  process.exit(1);
}
console.log('OK: no missing relative imports found');
