import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'board-app');
const destAssets = path.join(root, 'board-assets');
const templatePath = path.join(root, 'board.template.html');

fs.mkdirSync(destAssets, { recursive: true });

// 이전 해시 파일 정리 — board.js / board.css 만 유지
for (const f of fs.readdirSync(destAssets)) {
  if (f !== 'board.js' && f !== 'board.css') {
    fs.unlinkSync(path.join(destAssets, f));
  }
}

const jsSrc = path.join(srcDir, 'board.js');
if (!fs.existsSync(jsSrc)) {
  console.error('board.js 빌드 결과가 없습니다. vite build를 먼저 실행하세요.');
  process.exit(1);
}
fs.copyFileSync(jsSrc, path.join(destAssets, 'board.js'));

const cssName = fs.readdirSync(srcDir).find((f) => f.endsWith('.css'));
if (cssName) {
  fs.copyFileSync(path.join(srcDir, cssName), path.join(destAssets, 'board.css'));
}

let html = fs.readFileSync(templatePath, 'utf8');
const cssTag = cssName ? '  <link rel="stylesheet" href="./board-assets/board.css">\n' : '';
html = html
  .replace('<!-- BOARD_CSS -->', cssTag.trim())
  .replace('<!-- BOARD_JS -->', '  <script defer src="./board-assets/board.js"></script>');

fs.writeFileSync(path.join(root, 'board.html'), html, 'utf8');
console.log('board.html + board-assets/ 갱신 완료 (IIFE, file:// 호환)');
