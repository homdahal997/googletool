import React, { useState } from 'react';
import { Flow } from 'flow-sdk';
import { SeriesBible, CharacterAssetResponse, ActorProfile, BibleUpdater } from '../types';
import { DEFAULT_IMAGE_MODEL } from '../constants';
import { generateJson, findActor, newId, patchActor, patchEpisode, buildCharacterBible, buildPortraitPrompt } from '../services/continuityService';
interface EpisodeCharacterNodeProps {
  bible: SeriesBible;
  episodeIndex: number;
  onUpdateBible: (updater: BibleUpdater) => void;
  onComplete: () => void;
  onBackToDashboard: () => void;
}
export const EpisodeCharacterNode: React.FC<EpisodeCharacterNodeProps> = ({
  bible, episodeIndex, onUpdateBible, onComplete, onBackToDashboard
}) => {
  const episode = bible.episodes[episodeIndex];
  const cast = episode.actors.map(a => bible.sharedCastRoster.find(r => r.id === a.id) ?? a);
  const needsPortrait = cast.filter(a => !a.base64 || a.imageStale);
  const missingVoice = cast.filter(a => !a.voiceId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const syncVoice = async (actorId: string) => {
    try {
      const media = await Flow.media.select({ filter: 'audio' });
      onUpdateBible(prev => patchActor(prev, actorId, { voiceId: media.mediaId, voiceReferenceName: media.name }));
    } catch (err) { console.error('Voice sync failed:', err); }
  };
  const updateActor = (id: string, updates: Partial<ActorProfile>) => {
    const changesLook = 'visualDescription' in updates || 'wardrobe' in updates || 'age' in updates;
    onUpdateBible(prev => patchActor(prev, id, changesLook ? { ...updates, imageStale: true } : updates));
  };
  const generatePortraits = async (actors: ActorProfile[]) => {
    const failed: string[] = [];
    for (const actor of actors) {
      setStatus(`Visualizing Identity: ${actor.name}...`);
      try {
        const portrait = await Flow.generate.image({
          prompt: buildPortraitPrompt(actor, bible.style),
          modelDisplayName: DEFAULT_IMAGE_MODEL, aspectRatio: '1:1'
        });
        onUpdateBible(prev => patchActor(prev, actor.id, { mediaId: portrait.mediaId, base64: portrait.base64, imageStale: false }));
      } catch (err) {
        console.error(`Portrait failed for ${actor.name}:`, err);
        failed.push(actor.name);
      }
    }
    if (failed.length) setError(`Portrait generation failed for: ${failed.join(', ')}. Retry them individually.`);
  };
  const runPortraits = async (actors: ActorProfile[]) => {
    setIsGenerating(true);
    setError(null);
    try { await generatePortraits(actors); } finally { setIsGenerating(false); setStatus(''); }
  };
  const generateCharacters = async () => {
    if (!episode.script) return;
    setIsGenerating(true);
    setError(null);
    setStatus('Analyzing script for cast extraction...');
    try {
      const prompt = `[CASTING_DIRECTOR]
Established characters (reuse these EXACT names when the script refers to them, including by nickname or title):
${buildCharacterBible(bible.sharedCastRoster)}

Script: """${episode.script.script_content}"""

List every speaking or visible character in this script. For new characters give a detailed fixed physical description (age, ethnicity, face, hair, build, distinguishing marks).
Return ONLY a JSON: { "characters": [ { "name": "NAME", "image_prompt": "visual description" } ] }`;
      const parsed = await generateJson<CharacterAssetResponse>(
        prompt, 'You are the Casting Director. Respond ONLY with valid JSON.', r => Array.isArray(r?.characters)
      );
      const roster = [...bible.sharedCastRoster];
      const episodeActors: ActorProfile[] = [];
      for (const char of parsed.characters) {
        if (!char?.name) continue;
        const existing = findActor(roster, char.name);
        if (existing) { if (!episodeActors.includes(existing)) episodeActors.push(existing); continue; }
        const newActor: ActorProfile = { id: newId(), name: char.name, visualDescription: char.image_prompt, aliases: [] };
        roster.push(newActor);
        episodeActors.push(newActor);
      }
      const added = roster.slice(bible.sharedCastRoster.length);
      onUpdateBible(prev => ({
        sharedCastRoster: [...prev.sharedCastRoster, ...added.filter(n => !prev.sharedCastRoster.some(r => r.id === n.id))],
        ...patchEpisode(prev, episodeIndex, { actors: episodeActors })
      }));
      await generatePortraits(episodeActors.filter(a => !a.base64 || a.imageStale));
    } catch (err) {
      setError(`Casting failed: ${err instanceof Error ? err.message : 'unknown error'}. Try again.`);
    } finally { setIsGenerating(false); setStatus(''); }
  };
  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#070709]">
      <div className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700">
          {error && (
            <div className="p-5 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold text-center rounded-2xl">{error}</div>
          )}
          
          {cast.length === 0 ? (
            <div className="bg-[#0d0d12] border border-white/10 rounded-3xl p-20 text-center space-y-10 shadow-2xl">
              <div className="w-24 h-24 bg-amber-500/10 border-2 border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto"><span className="material-symbols-outlined text-amber-500 text-6xl">group</span></div>
              <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none">Casting Dashboard</h3>
              <button onClick={generateCharacters} disabled={isGenerating} className="w-full py-8 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl uppercase tracking-widest transition-all active:scale-95 shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">
                {isGenerating ? status : 'Initialize Casting Scan'}
              </button>
            </div>
          ) : (
            <div className="space-y-12">
              <div className="flex items-center justify-between border-l-4 border-amber-500 pl-8">
                <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em]">Identity Sync Active</h3>
                <span className="text-xs text-emerald-500 font-bold uppercase tracking-widest">Cast Manifest Locked</span>
              </div>
              {needsPortrait.length > 0 && (
                <button onClick={() => runPortraits(needsPortrait)} disabled={isGenerating} className="w-full py-5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl uppercase tracking-widest text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isGenerating ? status : `Generate ${needsPortrait.length} Reference Portrait${needsPortrait.length > 1 ? 's' : ''}`}
                </button>
              )}
              {missingVoice.length > 0 && (
                <div className="p-5 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm rounded-2xl">
                  No voice sample locked for {missingVoice.map(a => a.name).join(', ')}. Without one, the video model only gets a written voice description and the voice can drift between shots and episodes. Sync a voice sample to keep it identical.
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                {cast.map((actor) => (
                  <div key={actor.id} className="bg-[#0d0d12] border-2 border-white/10 rounded-3xl overflow-hidden group hover:border-amber-400/40 transition-all">
                    <div className="aspect-[4/5] bg-slate-900 relative">
                      {actor.base64 && <img src={`data:image/png;base64,${actor.base64}`} className="w-full h-full object-cover transition-all duration-1000" alt={actor.name} />}
                      {actor.imageStale && <span className="absolute top-6 left-6 px-3 py-1 bg-amber-500 text-black text-xs font-bold uppercase rounded-lg">Description changed</span>}
                      {actor.role && <span className="absolute top-6 right-6 px-3 py-1 bg-black/70 text-slate-200 text-xs font-bold uppercase rounded-lg">{actor.role}</span>}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                      <div className="absolute inset-x-0 bottom-0 p-8 space-y-4">
                        {editingId === actor.id ? (
                          <div className="space-y-3 bg-black/80 p-4 rounded-2xl backdrop-blur-md border border-white/10 animate-in zoom-in duration-300">
                             <input 
                               value={actor.name} 
                               onChange={(e) => updateActor(actor.id, { name: e.target.value })}
                               className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-sm text-white outline-none uppercase font-bold tracking-widest focus:border-amber-400/60 transition-colors"
                             />
                             <textarea 
                               value={actor.visualDescription}
                               onChange={(e) => updateActor(actor.id, { visualDescription: e.target.value })}
                               className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-slate-300 outline-none h-20 resize-none font-mono focus:border-amber-400/60 transition-colors"
                               placeholder="Fixed appearance"
                             />
                             <input 
                               value={actor.wardrobe || ''}
                               onChange={(e) => updateActor(actor.id, { wardrobe: e.target.value })}
                               className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs text-slate-300 outline-none focus:border-amber-400/60 transition-colors"
                               placeholder="Signature wardrobe"
                             />
                             <input 
                               value={actor.voiceDescription || ''}
                               onChange={(e) => updateActor(actor.id, { voiceDescription: e.target.value })}
                               className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs text-slate-300 outline-none focus:border-amber-400/60 transition-colors"
                               placeholder="Voice (pitch, accent, pace, texture)"
                             />
                             <button onClick={() => setEditingId(null)} className="w-full py-2 bg-emerald-500 text-black text-xs font-bold uppercase rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">Confirm Edits</button>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-end">
                              <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter group-hover:text-amber-400">{actor.name}</h4>
                              <div className="flex gap-2">
                                <button onClick={() => runPortraits([actor])} disabled={isGenerating} title="Regenerate portrait" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"><span className="material-symbols-outlined text-lg">refresh</span></button>
                                <button onClick={() => setEditingId(actor.id)} className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"><span className="material-symbols-outlined text-lg">edit</span></button>
                              </div>
                            </div>
                            <button onClick={() => syncVoice(actor.id)} className={`focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 border transition-all ${actor.voiceId ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/10 text-slate-200 border-white/10'}`}>
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
                <button onClick={generateCharacters} disabled={isGenerating} className="py-6 bg-white/5 text-slate-300 font-bold rounded-2xl uppercase tracking-widest text-xs border-2 border-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">Re-Casting</button>
                <button onClick={onComplete} disabled={isGenerating} className="py-6 bg-amber-600 hover:bg-amber-400 text-black font-bold rounded-2xl uppercase tracking-widest text-sm flex items-center justify-center gap-3 active:scale-95 group shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">
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