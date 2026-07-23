/**
 * 11조 발표 영상 — 대형 스크린용 고화질 녹화
 * 로그인 → 김재원·강재귀(+관할팝업)·박재홍·이선하(좌우명 강조)
 * → closing → 노리터(?demo=1)
 */
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync, existsSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'raw');
const BASE = process.env.PRESENTATION_URL || 'http://127.0.0.1:8080/';

mkdirSync(OUT_DIR, { recursive: true });

async function clickTab(page, label) {
  const tab = page.locator('#mheader .d-tab', { hasText: label }).first();
  await tab.waitFor({ state: 'visible', timeout: 15000 });
  await tab.click();
  await page.waitForTimeout(500);
}

async function showMemberDetail(page, { mottoHoldMs = 4500, withPopup = false } = {}) {
  const slide = page.locator('.slide.active');
  await page.waitForTimeout(2000);

  const banner = slide.locator('.banner-flip').first();
  if (await banner.count()) {
    await banner.click({ force: true });
    await page.waitForTimeout(mottoHoldMs);
  }

  const kw = slide.locator('.kw-wrap').first();
  if (await kw.count()) {
    await kw.click({ force: true });
    await page.waitForTimeout(4000);
  }

  const row = slide.locator('.notice .row').first();
  if (await row.count()) {
    await row.click({ force: true });
    await page.waitForTimeout(4000);
  }

  if (withPopup) {
    const map = slide.locator('.kr-inner').first();
    if (await map.count()) {
      await map.hover({ force: true });
      await page.waitForTimeout(7000); // 관할지역 팝업 유지
      await page.mouse.move(40, 40);
      await page.waitForTimeout(600);
    }
  } else {
    await page.waitForTimeout(1500);
  }
}

async function main() {
  if (existsSync(OUT_DIR)) {
    for (const f of readdirSync(OUT_DIR)) {
      if (f.endsWith('.webm') || f.endsWith('.mp4')) unlinkSync(join(OUT_DIR, f));
    }
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2, // 대형 스크린용 선명도
    recordVideo: {
      dir: OUT_DIR,
      size: { width: 1920, height: 1080 },
    },
  });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#loginBtn', { timeout: 30000 });
  await page.waitForFunction(() => {
    const btn = document.getElementById('loginBtn');
    return btn && !btn.classList.contains('disabled');
  }, { timeout: 20000 });
  await page.waitForTimeout(700);
  await page.locator('#loginBtn').click({ force: true });
  await page.waitForSelector('#mheader .d-tab', { timeout: 15000 });
  await page.waitForTimeout(900);

  // 1) 김재원
  await clickTab(page, '김재원');
  await showMemberDetail(page, { mottoHoldMs: 4500 });

  // 2) 강재귀 + 관할지역 팝업
  await clickTab(page, '강재귀');
  await showMemberDetail(page, { mottoHoldMs: 4000, withPopup: true });

  // 3) 박재홍
  await clickTab(page, '박재홍');
  await showMemberDetail(page, { mottoHoldMs: 4500 });

  // 4) 이선하 — 좌우명 5~7초+
  await clickTab(page, '이선하');
  await showMemberDetail(page, { mottoHoldMs: 7000 });

  // 마무리
  await clickTab(page, '마무리');
  await page.waitForTimeout(9000);
  const gp = page.locator('#groupPhoto');
  if (await gp.count()) await gp.click({ force: true }).catch(() => {});
  await page.waitForTimeout(5000);

  // 노리터 게시판 시연 (Firebase 때문에 networkidle 불가)
  await page.goto(new URL('board.html?demo=1', BASE).href, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('text=노리터', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  // 글쓰기·목록이 보이도록 스크롤
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.scrollBy(0, 420));
  await page.waitForTimeout(4500);
  await page.evaluate(() => window.scrollBy(0, 480));
  await page.waitForTimeout(3500);

  await page.waitForTimeout(800);
  await context.close();
  await browser.close();

  const vids = readdirSync(OUT_DIR).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (!vids.length) {
    console.error('No video file produced');
    process.exit(1);
  }
  const src = join(OUT_DIR, vids[0]);
  const dest = join(OUT_DIR, 'take1.webm');
  if (src !== dest) renameSync(src, dest);
  console.log('OK:', dest);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
