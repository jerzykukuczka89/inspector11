import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase.js';
import Board from './Board.jsx';
import Login from './Login.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('로그아웃 오류:', err);
    }
  };

  if (authLoading) {
    return (
      <div className="bg-[#EDF1F7] min-h-screen flex items-center justify-center">
        <div className="text-navy font-bold text-lg animate-pulse">
          사용자 정보를 불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <div className="board-shell bg-[#EDF1F7] text-ink min-h-screen flex flex-col overflow-x-hidden">
      <div className="h-1 bg-gov-red shrink-0" />

      <header className="board-header bg-navy flex items-center shrink-0">
        <a href="index.html#closing" className="d-logo flex items-center gap-2 pl-4 pr-5 cursor-pointer">
          <img src="assets_emblem_only.svg" alt="정부상징" className="h-8 w-8 object-contain" />
          <b className="text-navy text-lg font-extrabold tracking-tight">노사누리</b>
        </a>
        <div className="board-header-title flex-1 text-[#DCE8F6] text-sm font-bold pl-4 min-w-0 truncate">
          근로감독행정시스템
        </div>
        <div className="board-header-actions flex items-center gap-2.5 pr-4 text-[#EAF2FC] text-xs min-w-0">
          {user ? (
            <>
              <span className="board-user-label font-bold bg-white/10 px-2 py-1 rounded max-w-[140px] truncate">
                {user.displayName || user.email}
              </span>
              <button
                onClick={handleLogout}
                className="text-[#ffd7d7] hover:underline bg-transparent border-none cursor-pointer font-bold shrink-0"
              >
                로그아웃
              </button>
            </>
          ) : (
            <span className="font-bold text-gray-300 shrink-0">로그인 필요</span>
          )}
          <span className="board-timer bg-white/15 px-2 py-0.5 rounded font-mono shrink-0">10 : 00</span>
          <a href="index.html#closing" className="text-[#ffd7d7] hover:underline shrink-0">
            뒤로가기
          </a>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 min-w-0">
        <aside className="w-[70px] bg-rail border-r border-line shrink-0 hidden sm:flex flex-col items-center pt-3 gap-1 text-[10px] text-gray">
          <div className="flex flex-col items-center gap-0.5 py-1.5 w-full">
            <span className="text-[17px]">🔔</span>
            <span>알림</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 py-1.5 w-full">
            <span className="text-[17px]">💬</span>
            <span>소통</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 py-1.5 w-full text-blue font-bold">
            <span className="text-[17px]">📋</span>
            <span>노리터</span>
          </div>
        </aside>

        <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 overflow-x-hidden overflow-y-auto">
          {user ? <Board user={user} /> : <Login onLoginSuccess={setUser} />}
        </main>
      </div>
    </div>
  );
}

