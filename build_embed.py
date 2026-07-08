# -*- coding: utf-8 -*-
"""
data/ 폴더(members.json, members/*.json, korea.json, offices.json, munis.json)의 최신 내용을
index.html의 <script id="embedded-data"> 블록에 다시 구워 넣는다.

목적: index.html을 서버 없이 더블클릭으로 열면(file://) 브라우저가 fetch()로
로컬 JSON 파일을 읽는 것을 CORS로 막는다. 그래서 항상 최신 data/ 를 fetch로 읽되,
그게 안 될 때(더블클릭) 쓸 수 있는 백업 스냅샷을 index.html 안에 같이 넣어둔다.

사용법: data/ 안의 내용을 바꾼 뒤(팀원 JSON 반영 등) 이 스크립트를 다시 실행.
    python build_embed.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent
DATA = ROOT / "data"
INDEX = ROOT / "index.html"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    order = load(DATA / "members.json")
    members = {n: load(DATA / "members" / f"{n}.json") for n in order}
    korea = load(DATA / "korea.json")
    offices = load(DATA / "offices.json")
    munis = load(DATA / "munis.json")

    blob = json.dumps(
        {"order": order, "members": members, "korea": korea, "offices": offices, "munis": munis},
        ensure_ascii=False,
        separators=(",", ":"),
    )

    html = INDEX.read_text(encoding="utf-8")
    pattern = re.compile(
        r'(<script type="application/json" id="embedded-data">\n).*?(\n</script>)',
        re.DOTALL,
    )
    if not pattern.search(html):
        raise SystemExit("embedded-data script 태그를 index.html에서 찾지 못했습니다.")
    html = pattern.sub(lambda m: m.group(1) + blob + m.group(2), html, count=1)
    INDEX.write_text(html, encoding="utf-8")
    print(f"embedded-data 갱신 완료 ({len(blob):,} bytes, 조원 {len(order)}명)")


if __name__ == "__main__":
    main()
