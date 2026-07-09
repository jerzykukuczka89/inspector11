import Board from './Board.jsx';

export default function App() {
  return (
    <div className="bg-[#EDF1F7] text-ink min-h-screen flex flex-col">
      <div className="h-1 bg-gov-red shrink-0" />

      <header className="h-[60px] bg-navy flex items-center shrink-0">
        <div className="d-logo flex items-center gap-2 pl-4 pr-5">
          <img src="assets_emblem_only.svg" alt="정부상징" className="h-8 w-8 object-contain" />
          <b className="text-navy text-lg font-extrabold tracking-tight">노사누리</b>
        </div>
        <div className="flex-1 text-[#DCE8F6] text-sm font-bold pl-4">근로감독행정시스템</div>
        <div className="flex items-center gap-2.5 pr-4 text-[#EAF2FC] text-xs">
          <span className="font-bold">11조 함께하조</span>
          <span className="bg-white/15 px-2 py-0.5 rounded font-mono">10 : 00</span>
          <a href="index.html" className="text-[#ffd7d7] hover:underline">
            뒤로가기
          </a>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
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

        <main className="flex-1 p-4 md:p-5 overflow-auto">
          <Board />
        </main>
      </div>
    </div>
  );
}
