import React from 'react';
import { SeriesBible, NodeStage, ActorProfile, EpisodeProduction, ShotPrompt } from '../types';
import { EpisodeScriptNode } from './EpisodeScriptNode';
import { EpisodeCharacterNode } from './EpisodeCharacterNode';
import { EpisodeLocationNode } from './EpisodeLocationNode';
import { ManifestNode } from './ManifestNode';
interface ProductionPipelineProps {
  bible: SeriesBible;
  episodeIndex: number;
  onUpdateBible: (updates: Partial<SeriesBible>) => void;
  onExit: () => void;
}
export const ProductionPipeline: React.FC<ProductionPipelineProps> = ({ bible, episodeIndex, onUpdateBible, onExit }) => {
  const episode = bible.episodes[episodeIndex];
  
  const manifest = {
    seriesTitle: bible.seriesTitle,
    episodeNumber: episode.summary.episode_number,
    actors: episode.actors.length > 0 ? episode.actors : bible.sharedCastRoster,
    locations: episode.locations,
    timeline: episode.timeline,
    backgroundMusicId: episode.backgroundMusicId,
    soundtrackTitle: episode.soundtrackTitle,
    metadata: bible.metadata
  };
  const activeStage: NodeStage = 
    episode.stage === 'script' ? 'drafting' : 
    episode.stage === 'characters' ? 'seeding' : 
    episode.stage === 'locations' ? 'scouting' : 'manifest';
  const handleNodeComplete = (updates: Partial<EpisodeProduction>, nextStage: NodeStage) => {
    const updatedEpisodes = [...bible.episodes];
    const currentEp = { ...updatedEpisodes[episodeIndex], ...updates };
    if (nextStage === 'seeding') currentEp.stage = 'characters';
    else if (nextStage === 'scouting') currentEp.stage = 'locations';
    else if (nextStage === 'manifest') currentEp.stage = 'render'; 
    
    if (activeStage === 'drafting') currentEp.stageStatus.script = 'completed';
    if (activeStage === 'seeding') currentEp.stageStatus.characters = 'completed';
    if (activeStage === 'scouting') currentEp.stageStatus.locations = 'completed';
    
    updatedEpisodes[episodeIndex] = currentEp;
    onUpdateBible({ episodes: updatedEpisodes });
  };
  const handleUpdateSharedRoster = (roster: ActorProfile[]) => {
    onUpdateBible({ sharedCastRoster: roster });
  };
  const handleUpdateTimeline = (timeline: ShotPrompt[]) => {
    const updatedEpisodes = [...bible.episodes];
    updatedEpisodes[episodeIndex] = {
      ...updatedEpisodes[episodeIndex],
      timeline: timeline
    };
    onUpdateBible({ episodes: updatedEpisodes });
  };
  const handleUpdateEpisode = (updates: Partial<EpisodeProduction>) => {
    const updatedEpisodes = [...bible.episodes];
    updatedEpisodes[episodeIndex] = {
      ...updatedEpisodes[episodeIndex],
      ...updates
    };
    onUpdateBible({ episodes: updatedEpisodes });
  };
  const saveMasterVideo = (base64: string, mediaId: string) => {
    const updatedEpisodes = [...bible.episodes];
    updatedEpisodes[episodeIndex] = {
      ...updatedEpisodes[episodeIndex],
      masterBase64: base64,
      masterMediaId: mediaId,
      stageStatus: { ...updatedEpisodes[episodeIndex].stageStatus, render: 'completed' }
    };
    onUpdateBible({ episodes: updatedEpisodes });
  };
  return (
    <div className="h-full flex flex-col bg-[#050505]">
      <div className="flex items-center justify-between px-8 py-5 bg-[#0c0c0e] border-b-2 border-white/10 relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent pointer-events-none" />
        <div className="flex items-center gap-6 relative z-10">
           <button onClick={onExit} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center group transition-all shadow-xl border-2 border-white/10">
             <span className="material-symbols-outlined text-slate-300 group-hover:text-white group-hover:scale-125 transition-transform text-2xl">arrow_back</span>
           </button>
           <div>
             <div className="flex items-center gap-3">
               <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.6)]" />
               <div className="text-xs font-black text-amber-400 uppercase tracking-[0.4em]">Node_Stream_Active</div>
             </div>
             <h2 className="text-base font-black text-white uppercase tracking-tight mt-1">
               EPISODE {manifest.episodeNumber} <span className="mx-3 text-white/20">|</span> {manifest.seriesTitle}
             </h2>
           </div>
        </div>
        
        <div className="flex items-center gap-8">
           <div className="hidden lg:flex flex-col items-end">
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Active Production Hub</span>
             <span className="text-xs font-black text-amber-400 uppercase tracking-[0.4em] italic">{activeStage.toUpperCase()}</span>
           </div>
           <div className="w-[2px] h-10 bg-white/10" />
           <div className="flex flex-col items-end">
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Runtime Integrity</span>
             <span className="text-xs font-mono font-black text-emerald-400 uppercase tracking-tighter">00:00:0{episodeIndex + 1}:ENCRYPTED</span>
           </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative">
        {activeStage === 'drafting' && (
          <EpisodeScriptNode 
            bible={bible} 
            episodeIndex={episodeIndex} 
            onComplete={(data) => handleNodeComplete(data, 'seeding')} 
            onBackToDashboard={onExit} 
          />
        )}
        {activeStage === 'seeding' && (
          <EpisodeCharacterNode 
            bible={bible} 
            episodeIndex={episodeIndex} 
            onUpdateSharedRoster={handleUpdateSharedRoster} 
            onComplete={(data) => handleNodeComplete(data, 'scouting')} 
            onBackToDashboard={onExit} 
          />
        )}
        {activeStage === 'scouting' && (
          <EpisodeLocationNode 
            bible={bible} 
            episodeIndex={episodeIndex} 
            onComplete={(data) => handleNodeComplete(data, 'manifest')} 
            onBackToDashboard={onExit} 
          />
        )}
        {activeStage === 'manifest' && (
          <ManifestNode 
            manifest={manifest} 
            onUpdateTimeline={handleUpdateTimeline}
            onUpdateEpisode={handleUpdateEpisode}
            onSaveMaster={saveMasterVideo} 
            onNavigate={(s) => {
              const updatedEpisodes = [...bible.episodes];
              if (s === 'drafting') updatedEpisodes[episodeIndex].stage = 'script';
              else if (s === 'seeding') updatedEpisodes[episodeIndex].stage = 'characters';
              else if (s === 'scouting') updatedEpisodes[episodeIndex].stage = 'locations';
              else updatedEpisodes[episodeIndex].stage = 'render';
              onUpdateBible({ episodes: updatedEpisodes });
            }} 
          />
        )}
      </div>
    </div>
  );
};