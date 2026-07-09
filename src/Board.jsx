import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'team_messages';

function fmtDate(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}


function loadMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function Board() {
  const [posts, setPosts] = useState(() => loadMessages());
  const [author, setAuthor] = useState('');
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [status, setStatus] = useState('');
  const [toast, setToast] = useState(null);
  const [enterId, setEnterId] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  }, [posts]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  function showToast(msg, type = 'warn') {
    setToast({ msg, type });
  }

  const filtered = useMemo(() => {
    if (!searchQuery) return posts;
    const q = searchQuery.toLowerCase();
    return posts.filter(
      (p) =>
        p.author.toLowerCase().includes(q) ||
        p.message.toLowerCase().includes(q)
    );
  }, [posts, searchQuery]);

  function handleSubmit(e) {
    e.preventDefault();
    const name = author.trim();
    const body = message.trim();
    if (!name || !body) {
      showToast('이름과 메시지를 모두 입력해 주세요', 'warn');
      return;
    }

    const item = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      author: name,
      message: body,
      views: 0,
      likes: 0,
      createdAt: new Date().toISOString(),
    };

    setPosts((prev) => [item, ...prev]);
    setAuthor('');
    setMessage('');
    setEnterId(item.id);
    setTimeout(() => setEnterId(null), 600);
    setStatus('등록되었습니다.');
    showToast('등록되었습니다.', 'ok');
    setTimeout(() => setStatus(''), 2500);
  }

  function handleSearch() {
    setSearchQuery(searchInput.trim());
    setSelected(new Set());
  }

  function toggleAll(checked) {
    if (checked) setSelected(new Set(filtered.map((p) => p.id)));
    else setSelected(new Set());
  }

  function toggleOne(id, checked) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function handleDelete() {
    if (!selected.size) {
      alert('삭제할 게시글을 선택하세요.');
      return;
    }
    if (!confirm(`선택한 ${selected.size}건을 삭제할까요?`)) return;
    setPosts((prev) => prev.filter((p) => !selected.has(p.id)));
    setSelected(new Set());
  }

  const allChecked = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  return (
    <>
      {toast && (
        <div className={`board-toast show ${toast.type}`} role="alert">
          {toast.msg}
        </div>
      )}

      <div className="mb-4">
        <h1 className="text-[22px] font-extrabold text-[#333] flex items-center gap-1.5 leading-none">
          <span className="noriter-star" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M10 2.8L11.85 7.2C11.95 7.45 12.18 7.62 12.45 7.65L17.2 8.35L13.75 11.65C13.55 11.83 13.45 12.1 13.5 12.38L14.45 17.05L10 14.65L5.55 17.05L6.5 12.38C6.55 12.1 6.45 11.83 6.25 11.65L2.8 8.35L7.55 7.65C7.82 7.62 8.05 7.45 8.15 7.2L10 2.8Z"
                stroke="#8A96A8"
                strokeWidth="1.35"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span>노리터</span>
        </h1>
        <p className="text-[13px] text-[#666] mt-2 tracking-tight">
          ( 알림 · 소통 &gt; 소통 &gt; <span className="text-[#333]">노리터</span> )
        </p>
      </div>

      <div className="bg-[#E8EDF3] border border-[#C5CED9] rounded px-3 py-2.5 mb-4 flex flex-wrap gap-2 items-center">
        <select className="h-8 px-2 border border-[#bbb] rounded text-sm bg-white text-ink">
          <option>제목</option>
          <option>내용</option>
          <option>게시자</option>
        </select>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
          placeholder="검색어를 입력하세요"
          className="flex-1 min-w-[160px] h-8 px-3 border border-[#bbb] rounded text-sm bg-white"
        />
        <button
          type="button"
          onClick={handleSearch}
          className="h-8 px-4 bg-navy-deep text-white text-sm font-bold rounded flex items-center gap-1.5 hover:bg-[#003a61]"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" />
          </svg>
          조회
        </button>
      </div>

      <section className="bg-white border border-line rounded-lg shadow-sm mb-4 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-rail">
          <span className="w-1.5 h-4 bg-blue rounded-sm" />
          <h2 className="text-base font-extrabold text-navy">글쓰기</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-4 md:p-5 space-y-4">
          <div>
            <label htmlFor="author" className="block text-sm font-bold text-navy mb-1.5">
              작성자
            </label>
            <input
              id="author"
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              maxLength={30}
              placeholder="이름을 입력하세요"
              className="w-full h-10 px-3 border border-[#C9D3DF] rounded-md text-sm text-ink focus-ring-blue"
            />
          </div>
          <div>
            <label htmlFor="message" className="block text-sm font-bold text-navy mb-1.5">
              메시지
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="11조에게 전하고 싶은 메시지를 입력하세요"
              className="w-full px-3 py-2.5 border border-[#C9D3DF] rounded-md text-sm text-ink leading-relaxed resize-y min-h-[120px] focus-ring-blue"
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              className="h-10 px-6 bg-navy-deep hover:bg-[#003a61] text-white text-sm font-bold rounded-md transition-colors"
            >
              등록하기
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthor('');
                setMessage('');
              }}
              className="h-10 px-4 bg-white border border-[#bbb] text-gray text-sm font-semibold rounded-md hover:bg-rail"
            >
              초기화
            </button>
            {status && <p className="text-sm text-blue font-bold">{status}</p>}
          </div>
        </form>
      </section>

      <section className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-line">
          <h2 className="text-sm font-extrabold text-blue flex items-center gap-1.5">
            <span className="text-blue text-base">●</span>
            게시글 목록 <span className="text-ink font-bold">(총 {filtered.length}건)</span>
          </h2>
          <div className="flex items-center gap-2 text-xs">
            {filtered.length > 0 && (
              <label className="flex items-center gap-1.5 text-gray cursor-pointer select-none">
                <input
                  type="checkbox"
                  aria-label="전체 선택"
                  checked={allChecked}
                  onChange={(e) => toggleAll(e.target.checked)}
                />
                전체 선택
              </label>
            )}
            <button
              type="button"
              onClick={handleDelete}
              className="px-2 py-1 border border-[#aaa] rounded bg-white text-gray hover:bg-rail"
            >
              － 삭제
            </button>
          </div>
        </div>

        <div className="p-4 md:p-5 space-y-3 bg-rail-soft min-h-[120px]">
          {!filtered.length ? (
            <div className="py-12 text-center text-gray text-sm bg-white rounded-xl border border-dashed border-line">
              등록된 게시글이 없습니다.
            </div>
          ) : (
            filtered.map((p, i) => {
              const isNewest = i === 0 && !searchQuery;
              const no = filtered.length - i;
              return (
                <article
                  key={p.id}
                  className={[
                    'post-card p-4 md:p-5',
                    isNewest ? 'is-newest' : '',
                    p.id === enterId ? 'post-card-enter' : '',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 shrink-0"
                      aria-label="선택"
                      checked={selected.has(p.id)}
                      onChange={(e) => toggleOne(p.id, e.target.checked)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {isNewest ? (
                          <span className="text-[11px] font-extrabold text-blue bg-blue-soft px-2 py-0.5 rounded-full">
                            NEW
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-gray bg-rail px-2 py-0.5 rounded-full">
                            #{no}
                          </span>
                        )}
                        <span className="text-[11px] text-gray">공통</span>
                        <span className="text-xs text-gray ml-auto">{fmtDate(p.createdAt)}</span>
                      </div>
                      <p className="text-[15px] font-extrabold text-navy mb-1.5">{p.author}</p>
                      <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap break-words">
                        {p.message}
                      </p>
                      <div className="flex gap-3 mt-3 text-[11px] text-gray">
                        <span>조회 {p.views || 0}</span>
                        <span>추천 {p.likes || 0}</span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-line bg-rail text-xs text-gray">
          <div className="flex items-center gap-1">
            <button type="button" className="w-7 h-7 border border-[#bbb] bg-white rounded">
              «
            </button>
            <button type="button" className="w-7 h-7 border border-[#bbb] bg-gov-red text-white rounded font-bold">
              1
            </button>
            <button type="button" className="w-7 h-7 border border-[#bbb] bg-white rounded">
              »
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span>1 / 1</span>
            <select className="h-7 px-1 border border-[#bbb] rounded bg-white text-ink">
              <option>목록 개수 20</option>
              <option>목록 개수 50</option>
            </select>
          </div>
        </div>
      </section>
    </>
  );
}
