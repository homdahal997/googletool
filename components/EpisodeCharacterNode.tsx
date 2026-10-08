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
    } catch (err) {
      console.error('Voice sync failed:', err);
    }
  };
  const generateCharacters = async () => {
    if (!episode.script) {
      setError('No script found. Please complete the Scriptwriter stage first.');
      return;
    }
    setIsGenerating(true);
    setError(null);
    setStatus('Initializing Casting Engine...');
    
    try {
      setStatus('Analyzing script for cast extraction...');
      
      const prompt = `[CASTING_DIRECTOR]
      Episode Script:
      """
      ${episode.script.script_content}
      """
      Identify key characters. For each, create a vivid cinematic portrait prompt.
      Return ONLY a JSON object:
      {
        "characters": [
          { "name": "NAME", "image_prompt": "Vivid cinematic visual description, facial features, age, personality" }
        ]
      }`;
      const response = await Flow.generate.text(prompt, {
        systemInstruction: "You are the Casting Director. Respond ONLY with valid JSON."
      });
      let cleanJson = response.text.trim();
      if (cleanJson.includes('```')) cleanJson = cleanJson.replace(/```json|```/g, '').trim();
      const startIdx = cleanJson.indexOf('{');
      const endIdx = cleanJson.lastIndexOf('}');
      const parsed: CharacterAssetResponse = JSON.parse(cleanJson.substring(startIdx, endIdx + 1));
      
      const updatedRoster = [...bible.sharedCastRoster];
      const episodeActors: ActorProfile[] = [];
      for (let i = 0; i < parsed.characters.length; i++) {
        const char = parsed.characters[i];
        setStatus(`Visualizing Identity: ${char.name} (${i + 1}/${parsed.characters.length})...`);
        
        const existing = updatedRoster.find(
          a => a.name.trim().toLowerCase() === char.name.trim().toLowerCase()
        );
        if (existing) {
          episodeActors.push(existing);
          continue;
        }
        const portrait = await Flow.generate.image({
          prompt: `${char.image_prompt}. Cinematic character portrait, soft directional light, 8k resolution, photorealistic studio shot.`,
          modelDisplayName: DEFAULT_IMAGE_MODEL,
          aspectRatio: '1:1'
        });
        const newActor: ActorProfile = {
          id: Math.random().toString(36).substr(2, 9),
          name: char.name,
          visualDescription: char.image_prompt,
          mediaId: portrait.mediaId,
          base64: portrait.base64
        };
        updatedRoster.push(newActor);
        episodeActors.push(newActor);
      }
      onUpdateSharedRoster(updatedRoster);
      onComplete({
        actors: episodeActors,
        stageStatus: { ...episode.stageStatus, characters: 'completed' }
      });
      
    } catch (err) {
      console.error('Casting Error:', err);
      setError('Casting sequence failed. Ensure narrative nodes are populated.');
    } finally {
      setIsGenerating(false);
    }
  };
  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#070709]">
      <div className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
          
          {episode.actors.length === 0 ? (
            <div className="bg-[#0d0d12] border border-white/5 rounded-[4rem] p-20 text-center space-y-12 shadow-[0_0_100px_rgba(0,0,0,0.5)] relative overflow-hidden">
               <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
                 <span className="material-symbols-outlined text-[15rem]">account_circle</span>
               </div>
              
              <div className="w-28 h-28 bg-amber-500/10 border-2 border-amber-500/20 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner group">
                <span className="material-symbols-outlined text-amber-500 text-6xl group-hover:scale-110 transition-transform duration-700">group</span>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter">Casting Dashboard</h3>
                <p className="text-xs text-slate-500 uppercase tracking-[0.4em] font-mono max-w-md mx-auto leading-relaxed">
                  Synthesizing narrative nodes to extract entities and generate persistent visual fingerprints for continuity.
                </p>
              </div>
              {error && (
                <div className="p-6 bg-red-500/10 border-2 border-red-500/20 text-red-400 text-xs font-black rounded-3xl uppercase tracking-widest">
                   {error}
                </div>
              )}
              <button 
                onClick={generateCharacters} 
                disabled={isGenerating} 
                className="w-full py-8 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black rounded-[2.5rem] transition-all shadow-2xl shadow-amber-900/40 active:scale-95 text-sm uppercase tracking-[0.4em]"
              >
                {isGenerating ? status : 'Initialize Casting Scan'}
              </button>
            </div>
          ) : (
            <div className="space-y-12 pb-20">
              <div className="flex items-center justify-between border-l-4 border-amber-500 pl-8">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.5em]">Episode {episode.summary.episode_number} Cast</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] mt-1 font-bold">Identity Synchronization: ACTIVE</p>
                </div>
                <div className="px-5 py-2 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-2xl flex items-center gap-3">
                   <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,1)]" />
                   <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Sync Secured</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                {episode.actors.map((actor) => (
                  <div key={actor.id} className="bg-[#0d0d12] border-2 border-white/5 rounded-[3rem] overflow-hidden group hover:border-amber-400/40 transition-all shadow-2xl">
                    <div className="aspect-[4/5] bg-slate-900 relative">
                      {actor.base64 && (
                        <img src={`data:image/png;base64,${actor.base64}`} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" alt={actor.name} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                      <div className="absolute bottom-0 left-0 right-0 p-8 space-y-4">
                         <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter group-hover:text-amber-400 transition-colors">{actor.name}</h4>
                         
                         <button 
                           onClick={() => syncVoice(actor.id)}
                           className={`w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all ${
                             actor.voiceId 
                               ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                               : 'bg-white/10 text-slate-300 hover:bg-white/20 border border-white/10'
                           }`}
                         >
                           <span className="material-symbols-outlined text-sm">{actor.voiceId ? 'check_circle' : 'mic'}</span>
                           {actor.voiceId ? `Vocal Sync: ${actor.voiceReferenceName?.slice(0,12)}` : 'Sync Voice Identity'}
                         </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-8">
                <button 
                  onClick={generateCharacters} 
                  disabled={isGenerating}
                  className="py-6 bg-white/5 hover:bg-white/10 text-slate-500 font-black rounded-[2rem] transition-all uppercase tracking-[0.3em] text-[10px] border-2 border-white/5"
                >
                  Regenerate Cast
                </button>
                <button 
                  onClick={() => onComplete({})} 
                  className="py-6 bg-amber-600 hover:bg-amber-400 text-black font-black rounded-[2rem] transition-all shadow-2xl shadow-amber-900/40 uppercase tracking-[0.3em] text-xs flex items-center justify-center gap-3 active:scale-95 group"
                >
                  Proceed to Environment Scouting
                  <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}