const fs = require('fs');
const path = require('path');

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      // 1. Superscript unicode range
      for (let i = 0; i < line.length; i++) {
        const code = line.charCodeAt(i);
        if (code === 0x00B9 || (code >= 0x2070 && code <= 0x2079)) {
          console.log(`[SUPERSCRIPT CHAR] ${filePath}:${idx+1}:${i+1} -> Code 0x${code.toString(16)}: ${line}`);
        }
      }
      // 2. HTML entity for superscript 1
      if (/&sup1;|&#185;|&#x0*b9;/i.test(line)) {
        console.log(`[HTML ENTITY] ${filePath}:${idx+1} -> ${line}`);
      }
      // 3. CSS pseudo element content
      if (/content\s*:\s*['"][^'"]*1[^'"]*['"]/i.test(line)) {
        console.log(`[CSS CONTENT] ${filePath}:${idx+1} -> ${line}`);
      }
      // 4. <sup> tag containing 1
      if (/<sup[^>]*>\s*1\s*<\/sup>/i.test(line)) {
        console.log(`[SUP TAG] ${filePath}:${idx+1} -> ${line}`);
      }
    });
  } catch (e) {}
}

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'brain') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(full);
    } else if (entry.isFile()) {
      scanFile(full);
    }
  }
}

scanDir(path.join(__dirname, '..'));
console.log('Comprehensive scan complete.');
