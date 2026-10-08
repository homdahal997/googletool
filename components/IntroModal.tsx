import React from 'react';
interface IntroModalProps {
  onClose: () => void;
}
export const IntroModal: React.FC<IntroModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
      <div className="max-w-xl w-full bg-[#0d0d0f] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] animate-in fade-in zoom-in duration-500">
        <div className="h-64 bg-[radial-gradient(circle_at_50%_0%,_rgba(245,158,11,0.25)_0%,_transparent_70%)] flex flex-col items-center justify-center relative">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
          <div className="relative z-10 flex flex-col items-center">
            <span className="material-symbols-outlined text-[7.5rem] text-amber-400 drop-shadow-[0_0_40px_rgba(245,158,11,0.5)] mb-2">account_tree</span>
            <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">CinemaDraft <span className="text-amber-400">Architect</span></h1>
            <p className="text-slate-400 font-mono text-[11px] font-bold uppercase tracking-[0.4em] mt-3">Workflow Orchestrator</p>
          </div>
        </div>
        
        <div className="p-10 space-y-10">
          <div className="grid grid-cols-1 gap-6">
            <div className="flex items-start gap-5 p-5 bg-white/5 rounded-3xl border border-white/10">
              <span className="material-symbols-outlined text-amber-400 text-3xl">schema</span>
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Agentic Pipeline</h3>
                <p className="text-[11px] text-slate-300 mt-1 uppercase leading-relaxed tracking-wider font-medium">A multi-stage orchestration that moves from raw idea to structured manifest automatically.</p>
              </div>
            </div>
            <div className="flex items-start gap-5 p-5 bg-white/5 rounded-3xl border border-white/10">
              <span className="material-symbols-outlined text-amber-400 text-3xl">fingerprint</span>
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Locked Identity</h3>
                <p className="text-[11px] text-slate-300 mt-1 uppercase leading-relaxed tracking-wider font-medium">Maintain 100% character consistency across episodes with visual seeding.</p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-full py-7 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-2xl transition-all active:scale-95 shadow-2xl shadow-amber-900/40 uppercase tracking-[0.4em] text-sm"
          >
            Initialize Orchestrator
          </button>
        </div>
      </div>
    </div>
  );
};