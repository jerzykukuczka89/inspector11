# -*- coding: utf-8 -*-
"""고화질 증명사진 얼굴을 유니폼 cut에 직접 정렬·합성 (선명도 우선)."""
import os
import shutil

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC_PATH = os.path.join(ROOT, "pic", "이선하.jpeg")
DST_PATH = os.path.join(ROOT, "pic", "cut", "이선하.png")
BACKUP = os.path.join(ROOT, "pic", "cut", "이선하_before_hq.png")
PREVIEW_DIR = os.path.join(ROOT, "assets", "_preview")


def load_bgr(path):
    return cv2.cvtColor(np.array(Image.open(path).convert("RGB")), cv2.COLOR_RGB2BGR)


def normalize_rgba(im: Image.Image) -> Image.Image:
    canvas_size = (720, 1020)
    fill = 0.94
    person = im.crop(im.getbbox())
    cw, ch = canvas_size
    scale = min(cw / person.width, ch * fill / person.height)
    nw, nh = int(person.width * scale), int(person.height * scale)
    person = person.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    canvas.paste(person, ((cw - nw) // 2, ch - nh), person)
    return canvas


def get_faces(bgr):
    from insightface.app import FaceAnalysis

    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_size=(640, 640))
    faces = app.get(bgr)
    if not faces:
        raise RuntimeError("no face")
    return max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))


def color_match(src, ref, mask):
    sel = mask > 0.5
    if sel.sum() < 50:
        return src
    s = cv2.cvtColor(src, cv2.COLOR_BGR2LAB).astype(np.float32)
    r = cv2.cvtColor(ref, cv2.COLOR_BGR2LAB).astype(np.float32)
    out = s.copy()
    for c in range(3):
        ss, rr = s[:, :, c][sel], r[:, :, c][sel]
        ratio = np.clip(rr.std() / (ss.std() + 1e-6), 0.8, 1.2)
        out[:, :, c] = (s[:, :, c] - ss.mean()) * ratio + rr.mean()
    return cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)


def build_mask(h, w, kps, alpha):
    """Inner-face mask: brows to upper lip/cheeks. Keep dest jaw/hair/ears."""
    re, le, nose, rm, lm = [np.asarray(p, dtype=np.float32) for p in kps]
    eye_c = (re + le) * 0.5
    mouth_c = (rm + lm) * 0.5
    eye_dist = float(np.linalg.norm(le - re))

    cx = float(nose[0])
    cy = float(eye_c[1] * 0.55 + mouth_c[1] * 0.45)
    rx = eye_dist * 1.35
    ry = eye_dist * 1.55

    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    # Superellipse — soft oval
    nx = (xx - cx) / rx
    ny = (yy - cy) / ry
    r = np.power(np.abs(nx) ** 2.4 + np.abs(ny) ** 2.4, 1 / 2.4)
    mask = np.clip(1.0 - (r - 0.45) / 0.55, 0, 1)

    # Cut forehead/hairline
    top = np.clip((yy - (eye_c[1] - eye_dist * 0.85)) / (eye_dist * 0.4), 0, 1)
    mask *= top
    # Cut chin — keep destination jaw
    bot = np.clip(((mouth_c[1] + eye_dist * 0.45) - yy) / (eye_dist * 0.4), 0, 1)
    mask *= bot
    # Narrow sides (avoid ears)
    side = np.clip(1.05 - np.abs(nx) * 0.35, 0, 1)
    mask *= side

    mask *= alpha.astype(np.float32) / 255.0
    mask = cv2.GaussianBlur(mask, (0, 0), max(3.0, eye_dist * 0.12))
    return np.clip(mask, 0, 1)


def main():
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    if os.path.exists(BACKUP):
        shutil.copy2(BACKUP, DST_PATH)
        print("restored from backup")
    else:
        shutil.copy2(DST_PATH, BACKUP)

    src_bgr = load_bgr(SRC_PATH)
    dst_rgba = np.array(Image.open(DST_PATH).convert("RGBA"))
    dst_bgr = cv2.cvtColor(dst_rgba[:, :, :3], cv2.COLOR_RGB2BGR)
    dst_a = dst_rgba[:, :, 3]

    # Upscale ID photo aggressively for sharp warp
    src_up = cv2.resize(
        src_bgr,
        (src_bgr.shape[1] * 3, src_bgr.shape[0] * 3),
        interpolation=cv2.INTER_LANCZOS4,
    )
    # Mild sharpen on source
    blur = cv2.GaussianBlur(src_up, (0, 0), 1.0)
    src_up = cv2.addWeighted(src_up, 1.3, blur, -0.3, 0)

    src_face = get_faces(src_up)
    dst_face = get_faces(dst_bgr)
    print("src", src_face.bbox, "dst", dst_face.bbox)

    M, _ = cv2.estimateAffinePartial2D(src_face.kps, dst_face.kps, method=cv2.LMEDS)
    h, w = dst_bgr.shape[:2]
    warped = cv2.warpAffine(
        src_up, M, (w, h), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT_101
    )

    mask = build_mask(h, w, dst_face.kps, dst_a)
    warped = color_match(warped, dst_bgr, mask)

    # Frequency separation blend: take color/lighting from dest, detail from HQ
    # Actually we want HQ identity — take most from warped, only edge-blend to dest
    m = mask[..., None]
    # Smoothstep for nicer falloff
    m_ease = m * m * (3 - 2 * m)
    final = np.clip(
        warped.astype(np.float32) * m_ease + dst_bgr.astype(np.float32) * (1 - m_ease),
        0,
        255,
    ).astype(np.uint8)

    out_rgb = cv2.cvtColor(final, cv2.COLOR_BGR2RGB)
    out = normalize_rgba(Image.fromarray(np.dstack([out_rgb, dst_a]), "RGBA"))
    out.save(DST_PATH, optimize=True)

    gray = cv2.cvtColor(final, cv2.COLOR_BGR2GRAY)
    print(
        "saved",
        DST_PATH,
        "sharpness",
        round(cv2.Laplacian(gray[100:400, 220:500], cv2.CV_64F).var(), 1),
        "size",
        os.path.getsize(DST_PATH),
    )

    bg = Image.new("RGBA", out.size, (18, 18, 18, 255))
    bg.alpha_composite(out)
    bg.convert("RGB").save(os.path.join(PREVIEW_DIR, "composite_이선하.jpg"), quality=95)
    out.crop((160, 40, 560, 520)).convert("RGB").save(
        os.path.join(PREVIEW_DIR, "composite_face.jpg"), quality=95
    )
    before = Image.open(BACKUP).convert("RGB").crop((180, 60, 540, 480)).resize((360, 420))
    src_im = Image.open(SRC_PATH).convert("RGB").resize((360, 420))
    after = out.convert("RGB").crop((180, 60, 540, 480)).resize((360, 420))
    side = Image.new("RGB", (1080, 420), (0, 0, 0))
    side.paste(before, (0, 0))
    side.paste(src_im, (360, 0))
    side.paste(after, (720, 0))
    side.save(os.path.join(PREVIEW_DIR, "compare_side.jpg"), quality=95)

    # Also save mask preview
    mask_viz = (mask * 255).astype(np.uint8)
    cv2.imwrite(os.path.join(PREVIEW_DIR, "mask.jpg"), mask_viz)
    print("preview ready")


if __name__ == "__main__":
    main()
