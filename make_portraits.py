# -*- coding: utf-8 -*-
"""증명사진/AI 생성 이미지의 배경을 제거해 투명 PNG로 저장.
사용: python make_portraits.py <입력경로> <출력경로>
인자 없으면 SRC_MAP 전체를 일괄 처리."""
import sys, os
from rembg import remove, new_session
from PIL import Image

_session = new_session("u2net")


def cut(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    img = Image.open(src).convert("RGBA")
    out = remove(img, session=_session,
                 alpha_matting=True,
                 alpha_matting_foreground_threshold=240,
                 alpha_matting_background_threshold=15,
                 alpha_matting_erode_size=10)
    # 투명 여백 잘라내기(콘텐츠 bbox로 crop)
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    out.save(dst)
    print("saved:", dst, out.size)


ROOT = os.path.dirname(os.path.abspath(__file__))
CUT_DIR = os.path.join(ROOT, "pic", "cut")
ASSETS = os.path.join(ROOT, "assets")
BATCH = {
    "gen_kjg.png": "강재귀.png",
    "gen_kjw.png": "김재원.png",
    "gen_swj.png": "신원주.png",
    "gen_pjh.png": "박재홍.png",
    "gen_osj.png": "오승진.png",
    "gen_wjk.png": "우자경.png",
    "gen_lsh.png": "이선하.png",
    "gen_ljh.png": "이정훈.png",
}

if __name__ == "__main__":
    if len(sys.argv) == 3:
        cut(sys.argv[1], sys.argv[2])
    else:
        for src, dst in BATCH.items():
            cut(os.path.join(ASSETS, src), os.path.join(CUT_DIR, dst))
        print("batch done")
