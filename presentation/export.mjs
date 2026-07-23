import { spawnSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import ffmpegPath from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, 'raw', 'take1.webm');
const OUT = join(__dirname, '11조_함께하조_소개.mp4');
const MAX_SEC = 175; // ~2:55 — 연단+영상 합 3:30 여유

const ffprobePath = ffprobe.path;

if (!existsSync(SRC)) {
  console.error('Missing', SRC);
  process.exit(1);
}

function probeDuration(file) {
  const r = spawnSync(
    ffprobePath,
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file],
    { encoding: 'utf8' }
  );
  if (r.status !== 0) throw new Error(r.stderr || 'ffprobe failed');
  return parseFloat(String(r.stdout).trim());
}

const dur = probeDuration(SRC);
console.log('source duration:', dur.toFixed(2), 's');

const args = ['-y', '-i', SRC];
if (dur > MAX_SEC) {
  console.log('trim to', MAX_SEC, 's');
  args.push('-t', String(MAX_SEC));
}
// 대형 스크린: 1080p + 높은 비트레이트
args.push(
  '-vf', 'scale=1920:1080:flags=lanczos,fps=30',
  '-c:v', 'libx264',
  '-preset', 'slow',
  '-crf', '16',
  '-profile:v', 'high',
  '-level', '4.1',
  '-pix_fmt', 'yuv420p',
  '-an',
  '-movflags', '+faststart',
  OUT
);

const enc = spawnSync(ffmpegPath, args, { encoding: 'utf8' });
if (enc.status !== 0) {
  console.error(enc.stderr);
  process.exit(1);
}

const outDur = probeDuration(OUT);
const mb = (statSync(OUT).size / (1024 * 1024)).toFixed(2);
console.log('OK:', OUT);
console.log('duration:', outDur.toFixed(2), 's | size:', mb, 'MB | 1920x1080 CRF16');
