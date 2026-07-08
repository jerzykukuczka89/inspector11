# -*- coding: utf-8 -*-
"""조원 cut PNG 크기·하단 정렬 통일 — 상대적 키 차이 보정."""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
CUT = os.path.join(ROOT, "pic", "cut")
CANVAS = (720, 1020)  # w, h
FILL = 0.94  # 캔버스 높이 대비 인물 비율

names = ["강민우","강재귀","김재원","신원주","박재홍","오승진","우자경","이선하","이정훈"]
for n in names:
    path = os.path.join(CUT, n + ".png")
    if not os.path.exists(path):
        print("skip", n); continue
    im = Image.open(path).convert("RGBA")
    bbox = im.getbbox()
    if not bbox:
        continue
    person = im.crop(bbox)
    cw, ch = CANVAS
    scale = min(cw / person.width, ch * FILL / person.height)
    nw, nh = int(person.width * scale), int(person.height * scale)
    person = person.resize((nw, nh), Image.LANCZOS)
    out = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    x = (cw - nw) // 2
    y = ch - nh
    out.paste(person, (x, y), person)
    out.save(path)
    print("norm", n, nw, nh)
