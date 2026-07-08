# 11조(함께하조) — 노동감독관, 일의 의미

노사누리 스타일 발표/홈페이지. 로그인 애니메이션 + 9명 조원 슬라이드 + 마무리.

## 로컬 실행

```bash
# 방법 1: index.html 더블클릭 (정상 동작 — index.html에 내장된 백업 데이터로 표시됨)

# 방법 2: 로컬 서버 (권장 — data/ 폴더의 최신 내용을 바로 반영)
cd c:\dev\11jo-homepage
python -m http.server 8080
# 브라우저: http://localhost:8080
```

더블클릭(`file://`)으로 열면 브라우저 보안 정책상 `data/*.json`을 직접 읽을 수 없어서,
`index.html` 안에 내장해 둔 백업 데이터로 대신 표시된다. `data/` 폴더 내용을 바꾼 뒤에는
아래 명령으로 백업을 다시 구워야 더블클릭 모드에도 반영된다(서버로 열 때는 항상 최신 반영됨):

```bash
python build_embed.py
```

## 조작

- `→` / `Space`: 다음 슬라이드
- `←`: 이전 슬라이드
- `F`: 전체화면
- `R`: 처음(로그인)으로
- `?print`: 인쇄용 페이지 나열 (`index.html?print`)

## 폴더 구조

```
index.html              ← 메인 페이지 (디자인/레이아웃 — 조 대표만 수정)
editor.html             ← 조원용 내용 편집 폼 (팀원 배포용)
data/members.json       ← 조원 명단(표시 순서)
data/members/*.json     ← 조원별 슬라이드 내용 (조원이 각자 수정)
data/korea.json         ← 한반도 시도 백지도 (SVG path, 조 대표 관리)
data/offices.json       ← 지청별 지도 위치·관할지역 (조 대표 관리)
data/munis.json         ← 시군구 경계 벡터 (관할 팝업 지도, build_munis.py가 생성)
build_embed.py          ← data/ 최신 내용을 index.html 내장 백업으로 굽는 스크립트
build_munis.py          ← 통계청 시군구 경계로 data/munis.json을 만드는 스크립트
assets_emblem_only.png  ← 정부 마크
swj.jpg / wjk.jpg / lsh.jpg
pic/cut/*.png           ← 조원 사진 9장
design.md               ← 디자인 기조
```

## 조원별 내용 수정 (editor.html)

전체 디자인·레이아웃은 `index.html`에 있고, 조 대표만 관리한다. 조원 각자는 자신의
슬라이드 문구(소속·핵심 키워드·인용구·관점·다짐 등)만 `editor.html`에서 수정할 수 있다.

1. 조 대표가 로컬 서버를 켜고(`python -m http.server 8080`) 팀원에게 아래 링크를 하나씩 전달
   (또는 폰/PC에서 팀원이 직접 폴더를 열어 서버를 켜도 됨):
   ```
   http://localhost:8080/editor.html?name=이선하
   ```
   이름을 모르면 `http://localhost:8080/editor.html`만 전달해도 본인 이름을 선택할 수 있다.
2. 팀원이 항목을 수정하고 **「JSON 파일로 저장」** 버튼을 누르면 `이름.json` 파일이 다운로드된다.
3. 그 파일을 카카오톡/이메일로 조 대표에게 전달 → 조 대표가 `data/members/이름.json`에 덮어쓰면 반영됨.

강조하고 싶은 단어는 인용구 안에 `**단어**`처럼 별표 두 개로 감싸면 발표 화면에서 파란색으로 강조된다
(HTML을 직접 쓸 필요 없음).

### 조원이 수정하는 것 / 조 대표가 관리하는 것

- **조원(editor.html)**: 소속·핵심 키워드·인용구·관점(2~4개)·**앞으로의 다짐(3개 고정)**·마무리 한 줄.
- **조 대표만**: 전체 디자인/레이아웃(`index.html`), 한반도 지도(`data/korea.json`),
  지청 위치·관할지역(`data/offices.json`).

### 한반도 지도 (앞으로의 다짐 아래)

각 슬라이드의 '앞으로의 다짐' 아래에 한반도 백지도가 나오고, 조원의 **소속 지청**이 지도에
표시되며(빨간 핀 + 시도 강조), 옆에 **관할지역** 말풍선이 뜬다. 위치·관할 정보는
`data/offices.json`에서 소속 지청 이름으로 관리한다. (지도 원본: `@svg-maps/south-korea`, CC BY 4.0)

## GitHub Pages 배포

1. GitHub에 새 저장소 생성 (예: `11jo-homepage`)
2. 이 폴더에서:

```bash
git init
git add .
git commit -m "Initial: 11조 발표 홈페이지"
git branch -M main
git remote add origin https://github.com/<USER>/<REPO>.git
git push -u origin main
```

3. GitHub → Settings → Pages → Source: **Deploy from branch** → `main` / `/ (root)`
4. `https://<USER>.github.io/<REPO>/` 에서 확인

## 사진 재생성 (선택)

```bash
pip install rembg pillow
python make_portraits.py <입력.jpg> pic/cut/<이름>.png
python normalize_portraits.py
```
