import React, { useState } from 'react';
import { SeriesBible, EpisodeStage, EpisodeSummary, BibleUpdater } from '../types';
import { patchEpisode } from '../services/continuityService';
interface EpisodeDashboardProps {
  bible: SeriesBible;
  onSelectEpisode: (index: number) => void;
  onUpdateBible: (updater: BibleUpdater) => void;
}
const STAGE_ORDER: EpisodeStage[] = ['script', 'characters', 'locations', 'render'];
const STAGE_LABELS: Record<EpisodeStage, string> = {
  script: 'Script',
  characters: 'Cast',
  locations: 'Scout',
  render: 'Render'
};
export const EpisodeDashboard: React.FC<EpisodeDashboardProps> = ({ bible, onSelectEpisode, onUpdateBible }) => {
  const [activeMaster, setActiveMaster] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftSummary, setDraftSummary] = useState<EpisodeSummary | null>(null);
  const openOutlineEditor = (index: number) => {
    setEditingIndex(index);
    setDraftSummary({ ...bible.episodes[index].summary });
  };
  const saveOutline = () => {
    if (editingIndex === null || !draftSummary) return;
    const index = editingIndex;
    const summary = draftSummary;
    onUpdateBible(prev => patchEpisode(prev, index, { summary }));
    setEditingIndex(null);
    setDraftSummary(null);
  };
  const completedEpisodesCount = bible.episodes.filter(ep => ep.stageStatus.render === 'completed').length;
  const progressPercent = Math.round((completedEpisodesCount / bible.episodes.length) * 100);
  return (
    <div className="h-full flex flex-col p-8 bg-[#050505] overflow-y-auto no-scrollbar relative">
      {activeMaster && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-8 bg-black/98 backdrop-blur-3xl animate-in fade-in duration-500">
           <div className="max-w-md w-full relative group">
              <button onClick={() => setActiveMaster(null)} className="absolute -top-12 right-0 text-white/80 hover:text-white flex items-center gap-3 text-sm uppercase font-bold tracking-widest transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">
                Close Master <span className="material-symbols-outlined text-xl">close</span>
              </button>
              <div className="rounded-3xl border-2 border-white/20 shadow-2xl overflow-hidden bg-black">
                <video src={`data:video/mp4;base64,${activeMaster}`} className="w-full" controls autoPlay />
              </div>
           </div>
        </div>
      )}
      {draftSummary && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-8 bg-black/90 backdrop-blur-3xl">
          <div className="max-w-xl w-full bg-[#0d0d12] border border-white/10 rounded-3xl p-10 space-y-6 shadow-2xl">
            <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest">Edit Outline: Episode {draftSummary.episode_number}</h3>
            {([
              ['Title', 'title', false],
              ['Synopsis', 'synopsis', true],
              ['Opening Hook', 'hook', true],
              ['Cliffhanger', 'cliffhanger', true]
            ] as const).map(([label, field, multiline]) => (
              <label key={field} className="block space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">{label}</span>
                {multiline ? (
                  <textarea value={draftSummary[field] || ''} onChange={(e) => setDraftSummary({ ...draftSummary, [field]: e.target.value })} className="w-full h-20 bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-amber-400/40" />
                ) : (
                  <input value={draftSummary[field] || ''} onChange={(e) => setDraftSummary({ ...draftSummary, [field]: e.target.value })} className="w-full bg-black border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/40" />
                )}
              </label>
            ))}
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => { setEditingIndex(null); setDraftSummary(null); }} className="py-4 bg-white/5 text-slate-300 font-bold rounded-2xl uppercase tracking-widest text-sm border border-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">Cancel</button>
              <button onClick={saveOutline} className="py-4 bg-emerald-500 text-black font-bold rounded-2xl uppercase tracking-widest text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">Save Outline</button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-6xl w-full mx-auto space-y-12 pb-24">
        
        {/* Series Bible Hero Section */}
        <div className="bg-[#0a0a0c] border-2 border-amber-500/30 p-12 rounded-3xl text-center relative overflow-hidden shadow-[0_0_100px_rgba(245,158,11,0.05)]">
          <div className="absolute top-8 right-10 text-xs font-mono font-bold text-amber-400/80 uppercase tracking-[0.2em]">STUDIO_ARCHIVE: {bible.seriesTitle.slice(0,12)}</div>
          <div className="inline-block px-6 py-2 bg-amber-400/10 border border-amber-400/20 rounded-full text-xs font-bold text-amber-400 uppercase tracking-widest mb-6 shadow-inner">Master Manifest Locked</div>
          <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter leading-none mb-6">{bible.seriesTitle}</h2>
          {bible.logline && <p className="text-sm text-amber-300 max-w-3xl mx-auto font-bold mb-4">{bible.logline}</p>}
          <p className="text-lg text-slate-200 max-w-3xl mx-auto leading-relaxed font-medium mb-10">{bible.story_synopsis}</p>
          {bible.seasonArc && bible.seasonArc.length > 0 && (
            <ol className="max-w-3xl mx-auto text-left text-sm text-slate-300 space-y-1 mb-10 list-decimal list-inside">
              {bible.seasonArc.map((act, i) => <li key={i}>{act}</li>)}
            </ol>
          )}
          
          <div className="max-w-xl mx-auto space-y-4">
            <div className="flex justify-between items-center text-sm font-bold text-amber-400 uppercase tracking-widest px-2">
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
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-[0.2em]">Production Grid</h3>
            <span className="text-sm font-mono font-bold text-slate-300 uppercase tracking-widest">{bible.episodes.length} Episodes Sequential_Lock</span>
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
                    className={`w-full text-left bg-[#0c0c0e] border-2 rounded-3xl p-6 space-y-5 transition-all shadow-2xl relative overflow-hidden flex flex-col ${
                      !isUnlocked 
                        ? 'border-white/10 hover:-translate-y-2 cursor-pointer' 
                        : isFullyRendered 
                          ? 'border-emerald-500/40 bg-emerald-500/[0.03] hover:-translate-y-2 cursor-pointer' 
                          : 'border-white/10 hover:border-amber-400/50 hover:-translate-y-2 cursor-pointer'
                    }`}
                  >
                    {!ep.script && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openOutlineEditor(index); }}
                        title="Edit outline"
                        className="absolute top-2 right-2 z-40 w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center text-slate-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                    )}
                    {/* Hover Play Button for completed episodes */}
                    {hasMaster && isUnlocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-30 opacity-0 group-hover:opacity-100 transition-all duration-300">
                         <button 
                           onClick={(e) => { e.stopPropagation(); setActiveMaster(ep.masterBase64!); }}
                           className="w-20 h-20 bg-amber-500 text-black rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.6)] transform scale-75 group-hover:scale-100 transition-all active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
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
                            <span className="text-xs font-bold text-white uppercase tracking-widest">Episode Locked</span>
                            <p className="text-xs font-bold text-slate-300 uppercase tracking-[0.2em] leading-relaxed">Finish previous episode to unlock production</p>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between relative z-10">
                      <div className={`w-14 h-14 border rounded-2xl flex flex-col items-center justify-center text-xs font-bold transition-all ${
                        isFullyRendered 
                          ? 'bg-emerald-500 border-emerald-400 text-black' 
                          : 'bg-black border-white/20 text-amber-400 group-hover:bg-amber-400 group-hover:text-black'
                      }`}>
                        <span className="text-xs font-bold">EP</span>
                        <span className="text-base leading-none">{ep.summary.episode_number}</span>
                      </div>
                      
                      {isFullyRendered ? (
                        <div className="flex items-center gap-2 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
                          <span className="material-symbols-outlined text-emerald-400 text-lg">verified</span>
                          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Released</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isUnlocked ? 'bg-amber-400 animate-pulse' : 'bg-slate-700'}`} />
                          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">{STAGE_LABELS[ep.stage]}</span>
                        </div>
                      )}
                    </div>
                    <div className="min-h-[5rem] space-y-2 relative z-10">
                      <h4 className={`text-base font-bold uppercase tracking-tight line-clamp-1 transition-colors ${
                        isUnlocked ? 'text-white group-hover:text-amber-400' : 'text-slate-200'
                      }`}>
                        {ep.summary.title}
                      </h4>
                      <p className="text-sm leading-relaxed line-clamp-3 font-medium text-slate-300">
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
                          <span className="text-xs font-bold text-slate-400 uppercase text-center block tracking-tighter">{STAGE_LABELS[stage]}</span>
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
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-[0.2em]">Casting Continuity</h3>
            <span className="text-xs font-mono text-slate-400 uppercase tracking-widest font-bold">Shared_Identity_Core</span>
          </div>
          <div className="flex flex-wrap gap-6">
             {bible.sharedCastRoster.length === 0 ? (
               <div className="w-full py-16 border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center text-slate-400 bg-white/5">
                  <span className="material-symbols-outlined text-5xl mb-4 text-slate-400">groups</span>
                  <p className="text-sm uppercase tracking-widest font-bold text-slate-300">Awaiting Cross-Episode Identity Sync</p>
               </div>
             ) : (
               bible.sharedCastRoster.map((actor) => (
                 <div key={actor.id} className="bg-[#0c0c0e] border-2 border-white/10 px-6 py-5 rounded-3xl flex items-center gap-5 transition-all hover:border-amber-400/40 hover:bg-amber-400/[0.02] shadow-2xl">
                    <div className="w-16 h-16 bg-slate-900 rounded-2xl overflow-hidden border-2 border-white/10 shadow-xl">
                      {actor.base64 && <img src={`data:image/png;base64,${actor.base64}`} className="w-full h-full object-cover transition-all duration-1000" alt={actor.name} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white uppercase tracking-widest leading-tight">{actor.name}</h4>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                        <span className="text-xs text-slate-300 uppercase font-bold tracking-widest">ID_LOCKED</span>
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