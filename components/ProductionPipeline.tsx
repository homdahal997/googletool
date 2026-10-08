import React from 'react';
import { SeriesBible, NodeStage, EpisodeProduction, EpisodeStage, ShotPrompt, BibleUpdater } from '../types';
import { patchEpisode } from '../services/continuityService';
import { EpisodeScriptNode } from './EpisodeScriptNode';
import { EpisodeCharacterNode } from './EpisodeCharacterNode';
import { EpisodeLocationNode } from './EpisodeLocationNode';
import { ManifestNode } from './ManifestNode';
interface ProductionPipelineProps {
  bible: SeriesBible;
  episodeIndex: number;
  onUpdateBible: (updates: Partial<SeriesBible> | BibleUpdater) => void;
  onExit: () => void;
}
const NEXT_STAGE: Record<EpisodeStage, EpisodeStage> = {
  script: 'characters', characters: 'locations', locations: 'render', render: 'render'
};
const NODE_TO_EPISODE_STAGE: Record<NodeStage, EpisodeStage> = {
  drafting: 'script', seeding: 'characters', scouting: 'locations', syncing: 'render', manifest: 'render'
};
export const ProductionPipeline: React.FC<ProductionPipelineProps> = ({ bible, episodeIndex, onUpdateBible, onExit }) => {
  const episode = bible.episodes[episodeIndex];
  const roster = bible.sharedCastRoster;
  const library = bible.sharedLocations || [];
  
  const manifest = {
    seriesTitle: bible.seriesTitle,
    episodeNumber: episode.summary.episode_number,
    style: bible.style,
    actors: [...roster, ...episode.actors.filter(a => !roster.some(r => r.id === a.id))],
    locations: [...library, ...episode.locations.filter(l => !library.some(x => x.id === l.id))],
    timeline: episode.timeline,
    backgroundMusicId: episode.backgroundMusicId,
    soundtrackTitle: episode.soundtrackTitle,
    metadata: bible.metadata
  };
  const activeStage: NodeStage = 
    episode.stage === 'script' ? 'drafting' : 
    episode.stage === 'characters' ? 'seeding' : 
    episode.stage === 'locations' ? 'scouting' : 'manifest';
  const advanceStage = () => {
    onUpdateBible(prev => {
      const ep = prev.episodes[episodeIndex];
      return patchEpisode(prev, episodeIndex, {
        stage: NEXT_STAGE[ep.stage],
        stageStatus: { ...ep.stageStatus, [ep.stage]: 'completed' }
      });
    });
  };
  const handleUpdateTimeline = (timeline: ShotPrompt[]) => {
    onUpdateBible(prev => patchEpisode(prev, episodeIndex, { timeline }));
  };
  const handleUpdateEpisode = (updates: Partial<EpisodeProduction>) => {
    onUpdateBible(prev => patchEpisode(prev, episodeIndex, updates));
  };
  const saveMasterVideo = (base64: string, mediaId: string) => {
    onUpdateBible(prev => patchEpisode(prev, episodeIndex, {
      masterBase64: base64,
      masterMediaId: mediaId,
      stageStatus: { ...prev.episodes[episodeIndex].stageStatus, render: 'completed' }
    }));
  };
  return (
    <div className="h-full flex flex-col bg-[#050505]">
      <div className="flex items-center justify-between px-8 py-5 bg-[#0c0c0e] border-b-2 border-white/10 relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent pointer-events-none" />
        <div className="flex items-center gap-6 relative z-10">
           <button onClick={onExit} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center group transition-all shadow-xl border-2 border-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">
             <span className="material-symbols-outlined text-slate-200 group-hover:text-white group-hover:scale-125 transition-transform text-2xl">arrow_back</span>
           </button>
           <div>
             <div className="flex items-center gap-3">
               <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.6)]" />
               <div className="text-sm font-bold text-amber-400 uppercase tracking-widest">Node_Stream_Active</div>
             </div>
             <h2 className="text-base font-bold text-white uppercase tracking-tight mt-1">
               EPISODE {manifest.episodeNumber} <span className="mx-3 text-white/50">|</span> {manifest.seriesTitle}
             </h2>
           </div>
        </div>
        
        <div className="flex items-center gap-8">
           <div className="hidden lg:flex flex-col items-end">
             <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Active Production Hub</span>
             <span className="text-sm font-bold text-amber-400 uppercase tracking-widest italic">{activeStage.toUpperCase()}</span>
           </div>
           <div className="w-[2px] h-10 bg-white/10" />
           <div className="flex flex-col items-end">
             <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Runtime Integrity</span>
             <span className="text-sm font-mono font-bold text-emerald-400 uppercase tracking-tighter">00:00:0{episodeIndex + 1}:ENCRYPTED</span>
           </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative">
        {activeStage === 'drafting' && (
          <EpisodeScriptNode 
            bible={bible} 
            episodeIndex={episodeIndex} 
            onUpdateBible={onUpdateBible}
            onComplete={advanceStage} 
            onBackToDashboard={onExit} 
          />
        )}
        {activeStage === 'seeding' && (
          <EpisodeCharacterNode 
            bible={bible} 
            episodeIndex={episodeIndex} 
            onUpdateBible={onUpdateBible}
            onComplete={advanceStage} 
            onBackToDashboard={onExit} 
          />
        )}
        {activeStage === 'scouting' && (
          <EpisodeLocationNode 
            bible={bible} 
            episodeIndex={episodeIndex} 
            onUpdateBible={onUpdateBible}
            onComplete={advanceStage} 
            onBackToDashboard={onExit} 
          />
        )}
        {activeStage === 'manifest' && (
          <ManifestNode 
            manifest={manifest} 
            onUpdateTimeline={handleUpdateTimeline}
            onUpdateEpisode={handleUpdateEpisode}
            onSaveMaster={saveMasterVideo} 
            onNavigate={(s) => onUpdateBible(prev => patchEpisode(prev, episodeIndex, { stage: NODE_TO_EPISODE_STAGE[s] }))} 
          />
        )}
      </div>
    </div>
  );
};