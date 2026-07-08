# -*- coding: utf-8 -*-
"""
관할지역 팝업용 시군구 벡터 지도 데이터(data/munis.json) 생성 스크립트.

통계청(KOSTAT) 2018 시군구 경계 GeoJSON(southkorea-maps 프로젝트)을 내려받아
 1) 단일 평면 좌표계(경위도 → 등장방형 투영, 폭 1000 기준)로 변환하고
 2) 지청별 관할 구역의 바운딩박스로 팝업 viewBox(크롭 창)를 계산한 뒤
 3) 각 시군구 외곽선을 화면 표시 배율에 맞춰 단순화(더글러스-포이커)해서
data/munis.json 하나로 저장한다. index.html의 관할지역 팝업이 이 파일을 읽어
관할 행정구역을 실제 경계 모양 그대로 입체(떠오름+점멸) 하이라이트한다.

사용법:
    python build_munis.py                # GeoJSON을 매번 내려받아 생성
    python build_munis.py --src 파일경로  # 미리 받아둔 GeoJSON 사용
생성 후 임베드 백업 갱신을 위해 build_embed.py도 다시 실행할 것.
"""
import json
import math
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "data" / "munis.json"
SRC_URL = ("https://raw.githubusercontent.com/southkorea/southkorea-maps/"
           "master/kostat/2018/json/skorea-municipalities-2018-geo.json")

CANVAS_W = 1000.0          # 전국 투영 좌표계 폭
POPUP_PX = 588.0           # 팝업에서 지도가 그려지는 실제 픽셀 폭(616 - 패딩)
VIEW_ASPECT = 1.38         # 팝업 지도 viewBox 가로:세로 비율
PAD_RATIO = 0.34           # 관할 bbox 주변 여백 비율(맥락 지역 노출용)
TOL_PX = 0.55              # 단순화 허용 오차(화면 픽셀)
ISLET_PX = 2.4             # 이보다 작은 섬/조각(화면 픽셀 변 기준)은 제거
LABEL_MIN_PX2 = 26 * 26    # 맥락(비관할) 라벨 표시 최소 면적(화면 픽셀²)

# 지청별 관할 시군구. (코드 앞 2자리, 이름) — 이름이 '시'로 끝나면 하위 구 포함
# (예: '수원시' → 수원시장안구·권선구·팔달구·영통구), '*'는 해당 시도 전체.
# 근거: map/소속 지청별 관할.txt, data/offices.json jurisdiction.
OFFICE_JURIS = {
    "서울지방노동청 서부지청": [("11", "용산구"), ("11", "마포구"), ("11", "서대문구"), ("11", "은평구")],
    "서울지방노동청 동부지청": [("11", "송파구"), ("11", "강동구"), ("11", "성동구"), ("11", "광진구")],
    "경기지방노동청": [("31", "수원시"), ("31", "화성시"), ("31", "용인시")],
    "경기지방노동청 의정부지청": [("31", "의정부시"), ("31", "양주시"), ("31", "동두천시"), ("31", "포천시"),
                       ("31", "연천군"), ("31", "구리시"), ("31", "남양주시"), ("31", "가평군"),
                       ("32", "철원군")],
    "중부지방노동청 태백지청": [("32", "태백시"), ("32", "삼척시")],
    "대전지방노동청": [("25", "*"), ("29", "세종시"), ("34", "금산군"), ("34", "공주시"),
                ("34", "논산시"), ("34", "계룡시")],
    "대구지방노동청": [("22", "중구"), ("22", "수성구"), ("22", "북구"), ("22", "동구"),
                ("37", "군위군"), ("37", "경산시"), ("37", "영천시"), ("37", "청도군")],
    "광주지방노동청": [("24", "*"), ("36", "나주시"), ("36", "화순군"), ("36", "곡성군"), ("36", "구례군"),
                ("36", "담양군"), ("36", "장성군"), ("36", "영광군"), ("36", "함평군")],
}

CITY_GROUP_RE = re.compile(r"^(.+?시)(.+[구군])$")  # 수원시장안구 → 수원시


def load_source():
    if len(sys.argv) >= 3 and sys.argv[1] == "--src":
        return json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    print("downloading:", SRC_URL)
    with urllib.request.urlopen(SRC_URL, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def rings_of(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    if geom["type"] == "MultiPolygon":
        return geom["coordinates"]
    return []


def ring_area(pts):
    s = 0.0
    for i in range(len(pts) - 1):
        s += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]
    return s / 2.0


def ring_centroid(pts):
    a = ring_area(pts)
    if abs(a) < 1e-9:
        return pts[0]
    cx = cy = 0.0
    for i in range(len(pts) - 1):
        f = pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]
        cx += (pts[i][0] + pts[i + 1][0]) * f
        cy += (pts[i][1] + pts[i + 1][1]) * f
    return [cx / (6 * a), cy / (6 * a)]


def simplify(pts, tol):
    """더글러스-포이커(반복형). pts는 열린 폴리라인."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    t2 = tol * tol
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        dd = dx * dx + dy * dy
        dmax, imax = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if dd == 0:
                d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = ((px - ax) * dx + (py - ay) * dy) / dd
                t = max(0.0, min(1.0, t))
                d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d > dmax:
                dmax, imax = d, i
        if dmax > t2:
            keep[imax] = True
            stack.append((a, imax))
            stack.append((imax, b))
    return [p for p, k in zip(pts, keep) if k]


def main():
    src = load_source()
    feats = [f for f in src["features"] if f["properties"]["code"][:2] != "39"]  # 제주 제외

    # ---- 투영: 경위도 → 평면(y는 아래로 증가) ----
    lons, lats = [], []
    for f in feats:
        for poly in rings_of(f["geometry"]):
            for x, y in poly[0]:
                lons.append(x)
                lats.append(y)
    lon0, lon1 = min(lons), max(lons)
    lat0, lat1 = min(lats), max(lats)
    k = math.cos(math.radians((lat0 + lat1) / 2))
    S = CANVAS_W / ((lon1 - lon0) * k)

    def prj(lon, lat):
        return ((lon - lon0) * k * S, (lat1 - lat) * S)

    # ---- 시군구별 투영 링 + 메타 ----
    shapes = []  # {c,n,g,rings(투영),bb,area,cen}
    for f in feats:
        p = f["properties"]
        rings = []
        for poly in rings_of(f["geometry"]):
            for ring in poly:
                rings.append([list(prj(x, y)) for x, y in ring])
        xs = [pt[0] for r in rings for pt in r]
        ys = [pt[1] for r in rings for pt in r]
        main = max(rings, key=lambda r: abs(ring_area(r)))
        m = CITY_GROUP_RE.match(p["name"])
        shapes.append({
            "c": p["code"], "n": p["name"],
            "g": (m.group(1) if m else None),
            "rings": rings,
            "bb": [min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)],
            "area": sum(abs(ring_area(r)) for r in rings),
            "cen": ring_centroid(main),
        })
    by_code = {s["c"]: s for s in shapes}

    # ---- 지청별 관할 코드 + viewBox ----
    offices = {}
    for office, spec in OFFICE_JURIS.items():
        juris = []
        for pref, name in spec:
            if name == "*":
                hit = [s for s in shapes if s["c"].startswith(pref)]
            else:
                hit = [s for s in shapes if s["c"].startswith(pref) and
                       (s["n"] == name or (name.endswith("시") and s["n"].startswith(name)))]
            if not hit:
                raise SystemExit(f"관할 매칭 실패: {office} / {pref} {name}")
            juris += [s["c"] for s in hit]
        js = [by_code[c] for c in juris]
        x0 = min(s["bb"][0] for s in js)
        y0 = min(s["bb"][1] for s in js)
        x1 = max(s["bb"][0] + s["bb"][2] for s in js)
        y1 = max(s["bb"][1] + s["bb"][3] for s in js)
        w, h = x1 - x0, y1 - y0
        px, py = w * PAD_RATIO + 2.5, h * PAD_RATIO + 2.5
        x0, y0, w, h = x0 - px, y0 - py, w + 2 * px, h + 2 * py
        # 팝업 비율(VIEW_ASPECT)에 맞춰 부족한 쪽을 중앙 기준으로 확장
        if w / h < VIEW_ASPECT:
            nw = h * VIEW_ASPECT
            x0 -= (nw - w) / 2
            w = nw
        else:
            nh = w / VIEW_ASPECT
            y0 -= (nh - h) / 2
            h = nh
        offices[office] = {"vb": [x0, y0, w, h], "juris": juris}

    # ---- 형상별 최소 화면 배율(px/unit) → 단순화 오차 ----
    def isects(bb, vb):
        return (bb[0] < vb[0] + vb[2] and bb[0] + bb[2] > vb[0] and
                bb[1] < vb[1] + vb[3] and bb[1] + bb[3] > vb[1])

    out_shapes = []
    for s in shapes:
        scale = 0.0  # 이 형상이 표시되는 가장 확대된 배율
        for o in offices.values():
            if isects(s["bb"], o["vb"]):
                scale = max(scale, POPUP_PX / o["vb"][2])
        if scale == 0.0:
            continue  # 어느 팝업에도 안 보이는 지역은 제외
        tol = TOL_PX / scale
        min_edge = ISLET_PX / scale
        ds = []
        for ring in s["rings"]:
            if abs(ring_area(ring)) < min_edge * min_edge:
                continue
            sp = simplify(ring, tol)
            if len(sp) < 4:
                continue
            ds.append("M" + "L".join(f"{p[0]:.2f} {p[1]:.2f}" for p in sp[:-1]) + "Z")
        if not ds:
            continue
        out_shapes.append({
            "c": s["c"], "n": s["n"], **({"g": s["g"]} if s["g"] else {}),
            "d": "".join(ds),
            "bb": [round(v, 2) for v in s["bb"]],
        })
    kept = {s["c"] for s in out_shapes}

    # ---- 지청별 라벨(관할은 항상, 맥락 지역은 충분히 클 때만) ----
    for office, o in offices.items():
        vb = o["vb"]
        scale = POPUP_PX / vb[2]
        juris = set(o["juris"])
        groups = {}  # 라벨 단위: 시(구 통합) 또는 단일 시군구
        for s in shapes:
            if s["c"] not in kept or not isects(s["bb"], vb):
                continue
            key = (s["c"][:2], s["g"] or s["n"])
            g = groups.setdefault(key, {"t": s["g"] or s["n"], "a": 0.0,
                                        "x": 0.0, "y": 0.0, "on": False})
            g["a"] += s["area"]
            g["x"] += s["cen"][0] * s["area"]
            g["y"] += s["cen"][1] * s["area"]
            g["on"] = g["on"] or (s["c"] in juris)
        labels = []
        for g in groups.values():
            x, y = g["x"] / g["a"], g["y"] / g["a"]
            if not g["on"]:
                if g["a"] * scale * scale < LABEL_MIN_PX2:
                    continue  # 너무 작게 보이는 맥락 지역은 라벨 생략
                mx, my = vb[2] * 0.03, vb[3] * 0.03
                if not (vb[0] + mx < x < vb[0] + vb[2] - mx and
                        vb[1] + my < y < vb[1] + vb[3] - my):
                    continue  # 중심이 창 밖/가장자리면 생략
            lb = {"t": g["t"], "x": round(x, 1), "y": round(y, 1)}
            if g["on"]:
                lb["on"] = 1
            labels.append(lb)
        labels.sort(key=lambda l: (not l.get("on"), l["t"]))
        o["labels"] = labels

    out = {
        "_comment": "build_munis.py가 생성(수정 금지). 통계청 2018 시군구 경계"
                    " → 관할지역 팝업 벡터 지도. shapes: 전국 공통 좌표계"
                    f"(폭 {CANVAS_W:.0f}) 경로, offices: 지청별 크롭 viewBox·관할 코드·라벨.",
        "shapes": out_shapes,
        "offices": {
            k: {"viewBox": " ".join(f"{v:.2f}" for v in o["vb"]),
                "juris": o["juris"], "labels": o["labels"]}
            for k, o in offices.items()
        },
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")
    print(f"저장: {OUT} ({OUT.stat().st_size:,} bytes, 형상 {len(out_shapes)}개)")
    for k, o in offices.items():
        n_lb = len(o["labels"])
        print(f"  {k}: 관할 {len(o['juris'])}개, 라벨 {n_lb}개, "
              f"viewBox {' '.join(f'{v:.0f}' for v in o['vb'])}")


if __name__ == "__main__":
    main()
