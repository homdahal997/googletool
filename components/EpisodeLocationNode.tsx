import React, { useState } from 'react';
import { Flow } from 'flow-sdk';
import { SeriesBible, LocationAssetResponse, LocationAsset, BibleUpdater } from '../types';
import { DEFAULT_IMAGE_MODEL } from '../constants';
import { generateJson, findLocation, newId, patchLocation, patchEpisode, buildLocationLibrary, buildLocationPrompt } from '../services/continuityService';
interface EpisodeLocationNodeProps {
  bible: SeriesBible;
  episodeIndex: number;
  onUpdateBible: (updater: BibleUpdater) => void;
  onComplete: () => void;
  onBackToDashboard: () => void;
}
export const EpisodeLocationNode: React.FC<EpisodeLocationNodeProps> = ({
  bible, episodeIndex, onUpdateBible, onComplete, onBackToDashboard
}) => {
  const episode = bible.episodes[episodeIndex];
  const library = bible.sharedLocations || [];
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const locations = (episode.locations || []).map(l => library.find(x => x.id === l.id) ?? l);
  const needsImage = locations.filter(l => !l.base64 || l.imageStale);
  const updateLocation = (id: string, updates: Partial<LocationAsset>) => {
    const changesLook = 'image_prompt' in updates || 'description' in updates;
    onUpdateBible(prev => patchLocation(prev, id, changesLook ? { ...updates, imageStale: true } : updates));
  };
  const visualizeLocations = async (targets: LocationAsset[]) => {
    const failed: string[] = [];
    for (const loc of targets) {
      setStatus(`Visualizing Set: ${loc.name}...`);
      try {
        const visual = await Flow.generate.image({ prompt: buildLocationPrompt(loc, bible.style), modelDisplayName: DEFAULT_IMAGE_MODEL, aspectRatio: bible.metadata.aspectRatio });
        onUpdateBible(prev => patchLocation(prev, loc.id, { mediaId: visual.mediaId, base64: visual.base64, imageStale: false }));
      } catch (err) {
        console.error(`Set visualization failed for ${loc.name}:`, err);
        failed.push(loc.name);
      }
    }
    if (failed.length) setError(`Set visualization failed for: ${failed.join(', ')}. Retry them individually.`);
  };
  const runVisualize = async (targets: LocationAsset[]) => {
    setIsGenerating(true);
    setError(null);
    try { await visualizeLocations(targets); } finally { setIsGenerating(false); setStatus(''); }
  };
  const scoutLocations = async () => {
    if (!episode.script) return;
    setIsGenerating(true);
    setError(null);
    try {
      setStatus('Analyzing script for environments...');
      const parsed = await generateJson<LocationAssetResponse>(
        `[EXTRACT_LOCATIONS]
Established location library (reuse these EXACT names when the script uses them):
${buildLocationLibrary(library)}

Script: """${episode.script.script_content}"""

List every filming location in this script. For new locations give a detailed visual description of the set.
JSON: { "locations": [ { "name": "Name", "description": "summary", "image_prompt": "prompt" } ] }`,
        'You are the Production Designer. Extract environments and respond ONLY with JSON.',
        r => Array.isArray(r?.locations)
      );
      const known = [...library];
      const episodeLocations: LocationAsset[] = [];
      for (const loc of parsed.locations) {
        if (!loc?.name) continue;
        const existing = findLocation(known, loc.name);
        if (existing) { if (!episodeLocations.includes(existing)) episodeLocations.push(existing); continue; }
        const created: LocationAsset = { id: newId(), name: loc.name, description: loc.description, image_prompt: loc.image_prompt };
        known.push(created);
        episodeLocations.push(created);
      }
      const added = known.slice(library.length);
      onUpdateBible(prev => ({
        sharedLocations: [...(prev.sharedLocations || []), ...added.filter(n => !(prev.sharedLocations || []).some(l => l.id === n.id))],
        ...patchEpisode(prev, episodeIndex, { locations: episodeLocations })
      }));
      await visualizeLocations(episodeLocations.filter(l => !l.base64 || l.imageStale));
    } catch (err) {
      setError(`Scouting failed: ${err instanceof Error ? err.message : 'unknown error'}.`);
    } finally { setIsGenerating(false); setStatus(''); }
  };
  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#070709]">
      <div className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in duration-700">
          {error && (
            <div className="p-5 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold text-center rounded-2xl">{error}</div>
          )}
          
          {locations.length === 0 ? (
            <div className="bg-[#0d0d12] border border-white/10 rounded-3xl p-16 text-center space-y-8 shadow-2xl">
              <div className="w-24 h-24 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto"><span className="material-symbols-outlined text-amber-500 text-5xl">distance</span></div>
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">Location Scout Console</h3>
              <button onClick={scoutLocations} disabled={isGenerating} className="w-full py-7 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl uppercase tracking-widest text-sm shadow-2xl transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">
                {isGenerating ? status : 'Initialize Scout Scan'}
              </button>
            </div>
          ) : (
            <div className="space-y-12 pb-20">
              <div className="flex items-center justify-between border-l-4 border-amber-500 pl-8">
                <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em]">Locked Sets</h3>
                <span className="text-xs text-emerald-500 font-bold uppercase tracking-widest italic">Scouting Data Synced</span>
              </div>
              {needsImage.length > 0 && (
                <button onClick={() => runVisualize(needsImage)} disabled={isGenerating} className="w-full py-5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl uppercase tracking-widest text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isGenerating ? status : `Visualize ${needsImage.length} Set${needsImage.length > 1 ? 's' : ''}`}
                </button>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {locations.map((loc) => (
                  <div key={loc.id} className="bg-[#0d0d12] border-2 border-white/10 rounded-3xl overflow-hidden group hover:border-amber-400/40 transition-all shadow-xl">
                    <div className="aspect-video bg-slate-900 relative">
                      {loc.base64 && <img src={`data:image/png;base64,${loc.base64}`} className="w-full h-full object-cover transition-all duration-700" alt={loc.name} />}
                      {loc.imageStale && <span className="absolute top-6 left-6 px-3 py-1 bg-amber-500 text-black text-xs font-bold uppercase rounded-lg">Description changed</span>}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                      <div className="absolute inset-x-0 bottom-0 p-8 space-y-4">
                        {editingId === loc.id ? (
                           <div className="space-y-3 bg-black/80 p-4 rounded-2xl backdrop-blur-md border border-white/10 animate-in zoom-in duration-300">
                             <input value={loc.name} onChange={(e) => updateLocation(loc.id, { name: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-sm text-white outline-none font-bold uppercase tracking-widest focus:border-amber-400/60 transition-colors" />
                             <textarea value={loc.image_prompt} onChange={(e) => updateLocation(loc.id, { image_prompt: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-slate-300 outline-none h-20 resize-none font-mono focus:border-amber-400/60 transition-colors" />
                             <button onClick={() => setEditingId(null)} className="w-full py-2 bg-emerald-500 text-black text-xs font-bold uppercase rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">Lock Set Adjustments</button>
                           </div>
                        ) : (
                          <div className="flex justify-between items-end">
                            <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter group-hover:text-amber-400 leading-none">{loc.name}</h4>
                            <div className="flex gap-2">
                              <button onClick={() => runVisualize([loc])} disabled={isGenerating} title="Regenerate set" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white/70 hover:text-white transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"><span className="material-symbols-outlined text-lg">refresh</span></button>
                              <button onClick={() => setEditingId(loc.id)} className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white/70 hover:text-white transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"><span className="material-symbols-outlined text-lg">edit</span></button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-8">
                <button onClick={scoutLocations} disabled={isGenerating} className="py-6 bg-white/5 text-slate-300 font-bold rounded-2xl uppercase tracking-widest text-xs border-2 border-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">Re-Scout World</button>
                <button onClick={onComplete} disabled={isGenerating} className="py-6 bg-amber-600 hover:bg-amber-400 text-black font-bold rounded-2xl uppercase tracking-widest text-sm flex items-center justify-center gap-3 shadow-2xl active:scale-95 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">
                  Proceed to Render <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};