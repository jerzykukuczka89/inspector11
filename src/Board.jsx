import { useEffect, useMemo, useState } from 'react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase.js';

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hr = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${day} ${hr}:${min}`;
}

export default function Board({ user }) {
  // 로그인 보호막 작동
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white border border-line rounded-xl shadow-sm text-center">
        <span className="text-4xl mb-4">⚠️</span>
        <h3 className="text-lg font-bold text-navy mb-2">접근 권한이 없습니다.</h3>
        <p className="text-gray text-sm mb-4">로그인한 사용자만 게시판을 이용하실 수 있습니다.</p>
      </div>
    );
  }

  const [posts, setPosts] = useState([]);
  const [author, setAuthor] = useState('');
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [status, setStatus] = useState('');
  const [toast, setToast] = useState(null);
  const [enterId, setEnterId] = useState(null);

  // 댓글 입력 창 상태 관리 { [postId]: '댓글텍스트' }
  const [commentInputs, setCommentInputs] = useState({});

  // 사용자 정보 변경 시 작성자 자동 할당
  useEffect(() => {
    if (user) {
      setAuthor(user.displayName || user.email.split('@')[0]);
    }
  }, [user]);

  // Firestore 실시간 데이터 조회 (onSnapshot)
  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setPosts(list);
    }, (error) => {
      console.error('Firestore snapshot error:', error);
      showToast('게시글을 불러오는 중 오류가 발생했습니다.', 'warn');
    });

    return () => unsubscribe();
  }, []);

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
        (p.author && p.author.toLowerCase().includes(q)) ||
        (p.message && p.message.toLowerCase().includes(q))
    );
  }, [posts, searchQuery]);

  // Firestore 글쓰기 등록 처리
  async function handleSubmit(e) {
    e.preventDefault();
    const name = author.trim();
    const body = message.trim();
    if (!name || !body) {
      showToast('이름과 메시지를 모두 입력해 주세요', 'warn');
      return;
    }

    const item = {
      author: name,
      message: body,
      views: 0,
      likes: 0,
      comments: [], // 댓글 초기화용 빈 배열
      createdAt: new Date().toISOString(),
    };

    try {
      setStatus('등록 중...');
      const docRef = await addDoc(collection(db, 'messages'), item);
      setMessage('');
      setEnterId(docRef.id);
      setTimeout(() => setEnterId(null), 600);
      setStatus('등록되었습니다.');
      showToast('등록되었습니다.', 'ok');
      setTimeout(() => setStatus(''), 2500);
    } catch (err) {
      console.error('Error writing document: ', err);
      showToast('등록에 실패했습니다: ' + err.message, 'warn');
      setStatus('');
    }
  }

  // 댓글 입력 핸들러
  function handleCommentChange(postId, val) {
    setCommentInputs((prev) => ({
      ...prev,
      [postId]: val
    }));
  }

  // 댓글 등록 처리
  async function handleCommentSubmit(e, postId) {
    e.preventDefault();
    const text = (commentInputs[postId] || '').trim();
    if (!text) return;

    const commentAuthor = user.displayName || user.email.split('@')[0];
    const newComment = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      author: commentAuthor,
      text: text,
      createdAt: new Date().toISOString()
    };

    const postRef = doc(db, 'messages', postId);
    const targetPost = posts.find((p) => p.id === postId);
    const existingComments = targetPost.comments || [];

    try {
      await updateDoc(postRef, {
        comments: [...existingComments, newComment]
      });
      setCommentInputs((prev) => ({
        ...prev,
        [postId]: ''
      }));
      showToast('댓글이 등록되었습니다.', 'ok');
    } catch (err) {
      console.error('Error adding comment: ', err);
      showToast('댓글 등록에 실패했습니다.', 'warn');
    }
  }

  // 댓글 삭제 처리
  async function handleCommentDelete(postId, commentId) {
    if (!confirm('댓글을 삭제할까요?')) return;

    const postRef = doc(db, 'messages', postId);
    const targetPost = posts.find((p) => p.id === postId);
    const updatedComments = (targetPost.comments || []).filter((c) => c.id !== commentId);

    try {
      await updateDoc(postRef, {
        comments: updatedComments
      });
      showToast('댓글이 삭제되었습니다.', 'ok');
    } catch (err) {
      console.error('Error deleting comment: ', err);
      showToast('댓글 삭제에 실패했습니다.', 'warn');
    }
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

  // Firestore 글 삭제 처리
  async function handleDelete() {
    if (!selected.size) {
      alert('삭제할 게시글을 선택하세요.');
      return;
    }
    if (!confirm(`선택한 ${selected.size}건을 삭제할까요?`)) return;
    
    try {
      setStatus('삭제 중...');
      const deletePromises = Array.from(selected).map((id) => 
        deleteDoc(doc(db, 'messages', id))
      );
      await Promise.all(deletePromises);
      setSelected(new Set());
      showToast('삭제되었습니다.', 'ok');
      setStatus('');
    } catch (err) {
      console.error('Error deleting document: ', err);
      showToast('삭제에 실패했습니다: ' + err.message, 'warn');
      setStatus('');
    }
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
        <p className="text-[12px] sm:text-[13px] text-[#666] mt-2 tracking-tight break-keep">
          ( 알림 · 소통 &gt; 소통 &gt; <span className="text-[#333]">노리터</span> )
        </p>
      </div>

      <div className="bg-[#E8EDF3] border border-[#C5CED9] rounded px-3 py-2.5 mb-4 flex flex-wrap gap-2 items-center">
        <select className="h-8 px-2 border border-[#bbb] rounded text-sm bg-white text-ink shrink-0">
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
          className="flex-1 min-w-0 basis-[140px] h-8 px-3 border border-[#bbb] rounded text-sm bg-white"
        />
        <button
          type="button"
          onClick={handleSearch}
          className="h-8 px-4 bg-navy-deep text-white text-sm font-bold rounded flex items-center gap-1.5 hover:bg-[#003a61] shrink-0"
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
              placeholder="로그인이 필요합니다"
              readOnly
              className="w-full h-10 px-3 border border-[#C9D3DF] rounded-md text-sm text-ink bg-gray-100 cursor-not-allowed"
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
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              className="h-10 px-6 bg-navy-deep hover:bg-[#003a61] text-white text-sm font-bold rounded-md transition-colors"
            >
              등록하기
            </button>
            <button
              type="button"
              onClick={() => {
                setMessage('');
              }}
              className="h-10 px-4 bg-white border border-[#bbb] text-gray text-sm font-semibold rounded-md hover:bg-rail"
            >
              초기화
            </button>
            {status && <p className="text-sm text-blue font-bold w-full sm:w-auto">{status}</p>}
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
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
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
                        <span className="text-[11px] sm:text-xs text-gray sm:ml-auto w-full sm:w-auto">
                          {fmtDate(p.createdAt)}
                        </span>
                      </div>
                      <p className="text-[15px] font-extrabold text-navy mb-1.5 break-words">{p.author}</p>
                      <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {p.message}
                      </p>
                      
                      {/* 추천/조회수 메타데이터 영역 */}
                      <div className="flex gap-3 mt-3 text-[11px] text-gray">
                        <span>조회 {p.views || 0}</span>
                        <span>추천 {p.likes || 0}</span>
                      </div>

                      {/* 댓글 기능 섹션 */}
                      <div className="mt-4 pt-3 border-t border-line/60">
                        <div className="flex items-center gap-1 mb-2 text-xs font-bold text-[#666]">
                          <span>💬 댓글 {p.comments?.length || 0}개</span>
                        </div>

                        {/* 댓글 목록 */}
                        {p.comments && p.comments.length > 0 && (
                          <div className="space-y-2 mb-3 max-h-[250px] overflow-y-auto pr-1">
                            {p.comments.map((c) => (
                              <div key={c.id} className="bg-[#f8fafc] border border-[#e2e8f0] p-2.5 rounded-md text-xs min-w-0">
                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mb-1">
                                  <span className="font-bold text-navy break-words min-w-0">{c.author}</span>
                                  <span className="text-[10px] text-gray sm:ml-auto">{fmtDate(c.createdAt)}</span>
                                  {/* 댓글 작성자 본인 또는 게시판 주인 권한으로 삭제 허용 */}
                                  {(c.author === author || user.email.split('@')[0] === c.author) && (
                                    <button 
                                      type="button"
                                      onClick={() => handleCommentDelete(p.id, c.id)}
                                      className="text-red-500 hover:text-red-700 font-bold transition-colors shrink-0"
                                      title="댓글 삭제"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                                <p className="text-ink leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{c.text}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 댓글 입력 폼 */}
                        <form onSubmit={(e) => handleCommentSubmit(e, p.id)} className="flex gap-2 min-w-0">
                          <input
                            type="text"
                            placeholder="댓글을 입력해 주세요..."
                            value={commentInputs[p.id] || ''}
                            onChange={(e) => handleCommentChange(p.id, e.target.value)}
                            className="flex-1 min-w-0 h-8 px-2.5 border border-[#C9D3DF] rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue/50"
                          />
                          <button
                            type="submit"
                            className="h-8 px-3 bg-blue hover:bg-blue/90 text-white font-bold text-xs rounded transition-colors shrink-0"
                          >
                            등록
                          </button>
                        </form>
                      </div>

                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-3 border-t border-line bg-rail text-xs text-gray">
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
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0">1 / 1</span>
            <select className="h-7 max-w-full px-1 border border-[#bbb] rounded bg-white text-ink">
              <option>목록 개수 20</option>
              <option>목록 개수 50</option>
            </select>
          </div>
        </div>
      </section>
    </>
  );
}
