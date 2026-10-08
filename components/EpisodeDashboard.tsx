import React, { useState } from 'react';
import { SeriesBible, EpisodeStage } from '../types';
interface EpisodeDashboardProps {
  bible: SeriesBible;
  onSelectEpisode: (index: number) => void;
}
const STAGE_ORDER: EpisodeStage[] = ['script', 'characters', 'locations', 'render'];
const STAGE_LABELS: Record<EpisodeStage, string> = {
  script: 'Script',
  characters: 'Cast',
  locations: 'Scout',
  render: 'Render'
};
export const EpisodeDashboard: React.FC<EpisodeDashboardProps> = ({ bible, onSelectEpisode }) => {
  const [activeMaster, setActiveMaster] = useState<string | null>(null);
  const completedEpisodesCount = bible.episodes.filter(ep => ep.stageStatus.render === 'completed').length;
  const progressPercent = Math.round((completedEpisodesCount / bible.episodes.length) * 100);
  return (
    <div className="h-full flex flex-col p-8 bg-[#050505] overflow-y-auto no-scrollbar relative">
      {activeMaster && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-8 bg-black/98 backdrop-blur-3xl animate-in fade-in duration-500">
           <div className="max-w-md w-full relative group">
              <button onClick={() => setActiveMaster(null)} className="absolute -top-12 right-0 text-white/60 hover:text-white flex items-center gap-3 text-xs uppercase font-black tracking-widest transition-all">
                Close Master <span className="material-symbols-outlined text-xl">close</span>
              </button>
              <div className="rounded-[3rem] border-2 border-white/20 shadow-2xl overflow-hidden bg-black">
                <video src={`data:video/mp4;base64,${activeMaster}`} className="w-full" controls autoPlay />
              </div>
           </div>
        </div>
      )}
      <div className="max-w-6xl w-full mx-auto space-y-12 pb-24">
        
        {/* Series Bible Hero Section */}
        <div className="bg-[#0a0a0c] border-2 border-amber-500/30 p-12 rounded-[4rem] text-center relative overflow-hidden shadow-[0_0_100px_rgba(245,158,11,0.05)]">
          <div className="absolute top-8 right-10 text-[10px] font-mono font-bold text-amber-500/50 uppercase tracking-[0.5em]">STUDIO_ARCHIVE: {bible.seriesTitle.slice(0,12)}</div>
          <div className="inline-block px-6 py-2 bg-amber-400/10 border border-amber-400/20 rounded-full text-[10px] font-black text-amber-400 uppercase tracking-[0.4em] mb-6 shadow-inner">Master Manifest Locked</div>
          <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter leading-none mb-6">{bible.seriesTitle}</h2>
          <p className="text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed italic font-medium mb-10">{bible.story_synopsis}</p>
          
          <div className="max-w-xl mx-auto space-y-4">
            <div className="flex justify-between items-center text-[11px] font-black text-amber-400 uppercase tracking-[0.3em] px-2">
              <span>Series Completion Pipeline</span>
              <span className="bg-amber-400 text-black px-2 py-0.5 rounded ml-2">{progressPercent}%</span>
            </div>
            <div className="h-2.5 w-full bg-black/60 rounded-full border border-white/10 overflow-hidden shadow-inner p-[2px]">
              <div className="h-full bg-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.6)] transition-all duration-1000 rounded-full" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>
        {/* Episode Lineup Section */}
        <div className="space-y-8">
          <div className="flex items-center justify-between border-l-4 border-amber-500 pl-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.5em]">Production Grid</h3>
            <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest">{bible.episodes.length} Episodes Sequential_Lock</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {bible.episodes.map((ep, index) => {
              const isFullyRendered = ep.stageStatus.render === 'completed';
              const hasMaster = !!ep.masterBase64;
              const isUnlocked = index === 0 || bible.episodes[index - 1].stageStatus.render === 'completed';
              return (
                <div key={index} className="group relative">
                  <div
                    onClick={() => isUnlocked && onSelectEpisode(index)}
                    className={`w-full text-left bg-[#0c0c0e] border-2 rounded-[2.5rem] p-6 space-y-5 transition-all shadow-2xl relative overflow-hidden flex flex-col ${
                      !isUnlocked 
                        ? 'border-white/10 hover:-translate-y-2 cursor-pointer' 
                        : isFullyRendered 
                          ? 'border-emerald-500/40 bg-emerald-500/[0.03] hover:-translate-y-2 cursor-pointer' 
                          : 'border-white/10 hover:border-amber-400/50 hover:-translate-y-2 cursor-pointer'
                    }`}
                  >
                    {/* Hover Play Button for completed episodes */}
                    {hasMaster && isUnlocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-30 opacity-0 group-hover:opacity-100 transition-all duration-300">
                         <button 
                           onClick={(e) => { e.stopPropagation(); setActiveMaster(ep.masterBase64!); }}
                           className="w-20 h-20 bg-amber-500 text-black rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.6)] transform scale-75 group-hover:scale-100 transition-all active:scale-90"
                         >
                            <span className="material-symbols-outlined text-5xl font-black ml-1">play_arrow</span>
                         </button>
                      </div>
                    )}
                    {/* Locked Overlay */}
                    {!isUnlocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-20 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-300 p-8 text-center">
                          <div className="w-16 h-16 bg-white/5 border border-white/20 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                             <span className="material-symbols-outlined text-white text-3xl">lock</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Episode Locked</span>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-relaxed">Finish previous episode to unlock production</p>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between relative z-10">
                      <div className={`w-14 h-14 border rounded-2xl flex flex-col items-center justify-center text-[10px] font-black transition-all ${
                        isFullyRendered 
                          ? 'bg-emerald-500 border-emerald-400 text-black' 
                          : 'bg-black border-white/20 text-amber-400 group-hover:bg-amber-400 group-hover:text-black'
                      }`}>
                        <span className="text-[8px] opacity-60">EP</span>
                        <span className="text-base leading-none">{ep.summary.episode_number}</span>
                      </div>
                      
                      {isFullyRendered ? (
                        <div className="flex items-center gap-2 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
                          <span className="material-symbols-outlined text-emerald-400 text-lg">verified</span>
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Released</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isUnlocked ? 'bg-amber-400 animate-pulse' : 'bg-slate-700'}`} />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{STAGE_LABELS[ep.stage]}</span>
                        </div>
                      )}
                    </div>
                    <div className="min-h-[5rem] space-y-2 relative z-10">
                      <h4 className={`text-[13px] font-black uppercase tracking-tight line-clamp-1 transition-colors ${
                        isUnlocked ? 'text-white group-hover:text-amber-400' : 'text-slate-200'
                      }`}>
                        {ep.summary.title}
                      </h4>
                      <p className={`text-[11px] leading-snug line-clamp-3 uppercase tracking-wider font-bold italic ${
                        isUnlocked ? 'text-slate-400' : 'text-slate-400'
                      }`}>
                        {ep.summary.synopsis}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-4 border-t border-white/10 relative z-10">
                      {STAGE_ORDER.map((stage) => (
                        <div key={stage} className="flex-1 space-y-1.5">
                          <div className={`h-1.5 rounded-full transition-all duration-500 ${
                            ep.stageStatus[stage] === 'completed' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.3)]' : 
                            ep.stageStatus[stage] === 'processing' ? 'bg-amber-400 animate-pulse' : 'bg-white/10'
                          }`} />
                          <span className="text-[8px] font-black text-slate-600 uppercase text-center block tracking-tighter">{STAGE_LABELS[stage]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Casting Roster */}
        <div className="space-y-8">
          <div className="flex items-center justify-between border-l-4 border-amber-500 pl-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.5em]">Casting Continuity</h3>
            <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest font-black">Shared_Identity_Core</span>
          </div>
          <div className="flex flex-wrap gap-6">
             {bible.sharedCastRoster.length === 0 ? (
               <div className="w-full py-16 border-2 border-dashed border-white/10 rounded-[3rem] flex flex-col items-center justify-center text-slate-600 bg-white/5">
                  <span className="material-symbols-outlined text-5xl mb-4 opacity-20">groups</span>
                  <p className="text-xs uppercase tracking-[0.4em] font-black opacity-30">Awaiting Cross-Episode Identity Sync</p>
               </div>
             ) : (
               bible.sharedCastRoster.map((actor) => (
                 <div key={actor.id} className="bg-[#0c0c0e] border-2 border-white/10 px-6 py-5 rounded-[2.5rem] flex items-center gap-5 transition-all hover:border-amber-400/40 hover:bg-amber-400/[0.02] shadow-2xl">
                    <div className="w-16 h-16 bg-slate-900 rounded-2xl overflow-hidden border-2 border-white/10 shadow-xl">
                      {actor.base64 && <img src={`data:image/png;base64,${actor.base64}`} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" alt={actor.name} />}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-widest leading-tight">{actor.name}</h4>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                        <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">ID_LOCKED</span>
                      </div>
                    </div>
                 </div>
               ))
             )}
          </div>
        </div>
      </div>
    </div>
  );
};