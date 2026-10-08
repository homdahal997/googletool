import React, { useState } from 'react';
import { Flow } from 'flow-sdk';
import { SeriesBible, CharacterAssetResponse, ActorProfile, EpisodeProduction } from '../types';
import { DEFAULT_IMAGE_MODEL } from '../constants';
interface EpisodeCharacterNodeProps {
  bible: SeriesBible;
  episodeIndex: number;
  onUpdateSharedRoster: (roster: ActorProfile[]) => void;
  onComplete: (data: Partial<EpisodeProduction>) => void;
  onBackToDashboard: () => void;
}
export const EpisodeCharacterNode: React.FC<EpisodeCharacterNodeProps> = ({
  bible, episodeIndex, onUpdateSharedRoster, onComplete, onBackToDashboard
}) => {
  const episode = bible.episodes[episodeIndex];
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const syncVoice = async (actorId: string) => {
    try {
      const media = await Flow.media.select({ filter: 'audio' });
      const updatedRoster = bible.sharedCastRoster.map(a => 
        a.id === actorId ? { ...a, voiceId: media.mediaId, voiceReferenceName: media.name } : a
      );
      onUpdateSharedRoster(updatedRoster);
      
      const updatedEpisodeActors = episode.actors.map(a => 
        a.id === actorId ? { ...a, voiceId: media.mediaId, voiceReferenceName: media.name } : a
      );
      onComplete({ actors: updatedEpisodeActors });
    } catch (err) { console.error('Voice sync failed:', err); }
  };
  const updateActor = (id: string, updates: Partial<ActorProfile>) => {
    const updatedRoster = bible.sharedCastRoster.map(a => a.id === id ? { ...a, ...updates } : a);
    onUpdateSharedRoster(updatedRoster);
    const updatedEpActors = episode.actors.map(a => a.id === id ? { ...a, ...updates } : a);
    onComplete({ actors: updatedEpActors });
  };
  const generateCharacters = async () => {
    if (!episode.script) return;
    setIsGenerating(true);
    setStatus('Analyzing script for cast extraction...');
    try {
      const prompt = `[CASTING_DIRECTOR] Script: """${episode.script.script_content}""" Identify characters. Return ONLY a JSON: { "characters": [ { "name": "NAME", "image_prompt": "visual description" } ] }`;
      const response = await Flow.generate.text(prompt, { systemInstruction: "You are the Casting Director. Respond ONLY with valid JSON." });
      let cleanJson = response.text.trim();
      if (cleanJson.includes('```')) cleanJson = cleanJson.replace(/```json|```/g, '').trim();
      const parsed: CharacterAssetResponse = JSON.parse(cleanJson.substring(cleanJson.indexOf('{'), cleanJson.lastIndexOf('}') + 1));
      
      const updatedRoster = [...bible.sharedCastRoster];
      const episodeActors: ActorProfile[] = [];
      for (const char of parsed.characters) {
        setStatus(`Visualizing Identity: ${char.name}...`);
        const existing = updatedRoster.find(a => a.name.toLowerCase() === char.name.toLowerCase());
        if (existing) { episodeActors.push(existing); continue; }
        const portrait = await Flow.generate.image({
          prompt: `${char.image_prompt}. Cinematic portrait, studio lighting.`,
          modelDisplayName: DEFAULT_IMAGE_MODEL, aspectRatio: '1:1'
        });
        const newActor: ActorProfile = {
          id: Math.random().toString(36).substr(2, 9),
          name: char.name, visualDescription: char.image_prompt,
          mediaId: portrait.mediaId, base64: portrait.base64
        };
        updatedRoster.push(newActor);
        episodeActors.push(newActor);
      }
      onUpdateSharedRoster(updatedRoster);
      onComplete({ actors: episodeActors, stageStatus: { ...episode.stageStatus, characters: 'completed' } });
    } catch (err) { setError('Casting failed. Try again.'); } finally { setIsGenerating(false); }
  };
  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#070709]">
      <div className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700">
          
          {episode.actors.length === 0 ? (
            <div className="bg-[#0d0d12] border border-white/5 rounded-[4rem] p-20 text-center space-y-10 shadow-2xl">
              <div className="w-24 h-24 bg-amber-500/10 border-2 border-amber-500/20 rounded-[2rem] flex items-center justify-center mx-auto"><span className="material-symbols-outlined text-amber-500 text-6xl">group</span></div>
              <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none">Casting Dashboard</h3>
              <button onClick={generateCharacters} disabled={isGenerating} className="w-full py-8 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-[2rem] uppercase tracking-[0.4em] transition-all active:scale-95 shadow-2xl">
                {isGenerating ? status : 'Initialize Casting Scan'}
              </button>
            </div>
          ) : (
            <div className="space-y-12">
              <div className="flex items-center justify-between border-l-4 border-amber-500 pl-8">
                <h3 className="text-sm font-black text-white uppercase tracking-[0.5em]">Identity Sync Active</h3>
                <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Cast Manifest Locked</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                {episode.actors.map((actor) => (
                  <div key={actor.id} className="bg-[#0d0d12] border-2 border-white/5 rounded-[3rem] overflow-hidden group hover:border-amber-400/40 transition-all">
                    <div className="aspect-[4/5] bg-slate-900 relative">
                      {actor.base64 && <img src={`data:image/png;base64,${actor.base64}`} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" alt={actor.name} />}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                      <div className="absolute inset-x-0 bottom-0 p-8 space-y-4">
                        {editingId === actor.id ? (
                          <div className="space-y-3 bg-black/80 p-4 rounded-2xl backdrop-blur-md border border-white/10 animate-in zoom-in duration-300">
                             <input 
                               value={actor.name} 
                               onChange={(e) => updateActor(actor.id, { name: e.target.value })}
                               className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-xs text-white outline-none uppercase font-black tracking-widest"
                             />
                             <textarea 
                               value={actor.visualDescription}
                               onChange={(e) => updateActor(actor.id, { visualDescription: e.target.value })}
                               className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-[10px] text-slate-400 outline-none h-20 resize-none font-mono"
                             />
                             <button onClick={() => setEditingId(null)} className="w-full py-2 bg-emerald-500 text-black text-[9px] font-black uppercase rounded-lg">Confirm Edits</button>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-end">
                              <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter group-hover:text-amber-400">{actor.name}</h4>
                              <button onClick={() => setEditingId(actor.id)} className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white/40 hover:text-white"><span className="material-symbols-outlined text-lg">edit</span></button>
                            </div>
                            <button onClick={() => syncVoice(actor.id)} className={`w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 border transition-all ${actor.voiceId ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/10 text-slate-300 border-white/10'}`}>
                              <span className="material-symbols-outlined text-sm">{actor.voiceId ? 'check_circle' : 'mic'}</span>
                              {actor.voiceId ? `Voice: ${actor.voiceReferenceName?.slice(0,12)}` : 'Sync Vocal ID'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-8">
                <button onClick={generateCharacters} className="py-6 bg-white/5 text-slate-500 font-black rounded-[2rem] uppercase tracking-[0.3em] text-[10px] border-2 border-white/5">Re-Casting</button>
                <button onClick={() => onComplete({})} className="py-6 bg-amber-600 hover:bg-amber-400 text-black font-black rounded-[2rem] uppercase tracking-[0.3em] text-xs flex items-center justify-center gap-3 active:scale-95 group shadow-2xl">
                  Proceed to Environments <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}