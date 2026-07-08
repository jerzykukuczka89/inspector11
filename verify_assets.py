# -*- coding: utf-8 -*-
"""index.html이 참조하는 로컬 자산이 모두 존재하는지 확인."""
import os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()

paths = set(re.findall(r'(?:src|img):"([^"]+)"', html))
paths |= set(re.findall(r'src="([^"]+)"', html))
local = [p for p in paths if not p.startswith("data:") and not p.startswith("http") and "${" not in p]

missing = []
for p in local:
    full = os.path.join(ROOT, p.replace("/", os.sep))
    ok = os.path.isfile(full)
    print(("OK " if ok else "MISSING ") + p)
    if not ok:
        missing.append(p)

# TEAM photo paths
for name in ["강민우","강재귀","김재원","신원주","박재홍","오승진","우자경","이선하","이정훈"]:
    p = f"pic/cut/{name}.png"
    full = os.path.join(ROOT, "pic", "cut", name + ".png")
    ok = os.path.isfile(full)
    print(("OK " if ok else "MISSING ") + p)
    if not ok:
        missing.append(p)

if missing:
    sys.exit(1)
print("ALL OK", len(local) + 9, "assets")
