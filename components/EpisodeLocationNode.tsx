import React, { useState } from 'react';
import { Flow } from 'flow-sdk';
import { SeriesBible, LocationAssetResponse, LocationAsset, EpisodeProduction } from '../types';
import { DEFAULT_IMAGE_MODEL } from '../constants';
interface EpisodeLocationNodeProps {
  bible: SeriesBible;
  episodeIndex: number;
  onComplete: (data: Partial<EpisodeProduction>) => void;
  onBackToDashboard: () => void;
}
export const EpisodeLocationNode: React.FC<EpisodeLocationNodeProps> = ({
  bible, episodeIndex, onComplete, onBackToDashboard
}) => {
  const episode = bible.episodes[episodeIndex];
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const locations = episode.locations || [];
  const updateLocation = (id: string, updates: Partial<LocationAsset>) => {
    const next = locations.map(l => l.id === id ? { ...l, ...updates } : l);
    onComplete({ locations: next });
  };
  const scoutLocations = async () => {
    if (!episode.script) return;
    setIsGenerating(true);
    try {
      setStatus('Analyzing script for environments...');
      const response = await Flow.generate.text(`[EXTRACT_LOCATIONS] Script: """${episode.script.script_content}""" Extract filming locations. Max 3. JSON: { "locations": [ { "name": "Name", "description": "summary", "image_prompt": "prompt" } ] }`, { systemInstruction: "You are the Production Designer. Extract environments and respond ONLY with JSON." });
      let cleanJson = response.text.trim();
      if (cleanJson.includes('```')) cleanJson = cleanJson.replace(/```json|```/g, '').trim();
      const parsed: LocationAssetResponse = JSON.parse(cleanJson.substring(cleanJson.indexOf('{'), cleanJson.lastIndexOf('}') + 1));
      const generated: LocationAsset[] = [];
      for (const loc of parsed.locations) {
        setStatus(`Visualizing Set: ${loc.name}...`);
        const visual = await Flow.generate.image({ prompt: `${loc.image_prompt}. Wide establishment, cinema.`, modelDisplayName: DEFAULT_IMAGE_MODEL, aspectRatio: bible.metadata.aspectRatio });
        generated.push({ id: Math.random().toString(36).substr(2, 9), name: loc.name, description: loc.description, image_prompt: loc.image_prompt, mediaId: visual.mediaId, base64: visual.base64 });
      }
      onComplete({ locations: generated, stageStatus: { ...episode.stageStatus, locations: 'completed' } });
    } catch { setError('Scouting failed.'); } finally { setIsGenerating(false); }
  };
  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#070709]">
      <div className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in duration-700">
          
          {locations.length === 0 ? (
            <div className="bg-[#0d0d12] border border-white/5 rounded-[4rem] p-16 text-center space-y-8 shadow-2xl">
              <div className="w-24 h-24 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] flex items-center justify-center mx-auto"><span className="material-symbols-outlined text-amber-500 text-5xl">distance</span></div>
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">Location Scout Console</h3>
              <button onClick={scoutLocations} disabled={isGenerating} className="w-full py-7 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-[2rem] uppercase tracking-[0.4em] text-sm shadow-2xl transition-all">
                {isGenerating ? status : 'Initialize Scout Scan'}
              </button>
            </div>
          ) : (
            <div className="space-y-12 pb-20">
              <div className="flex items-center justify-between border-l-4 border-amber-500 pl-8">
                <h3 className="text-sm font-black text-white uppercase tracking-[0.5em]">Locked Sets</h3>
                <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest italic">Scouting Data Synced</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {locations.map((loc) => (
                  <div key={loc.id} className="bg-[#0d0d12] border-2 border-white/5 rounded-[3rem] overflow-hidden group hover:border-amber-400/40 transition-all shadow-xl">
                    <div className="aspect-video bg-slate-900 relative">
                      {loc.base64 && <img src={`data:image/png;base64,${loc.base64}`} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt={loc.name} />}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                      <div className="absolute inset-x-0 bottom-0 p-8 space-y-4">
                        {editingId === loc.id ? (
                           <div className="space-y-3 bg-black/80 p-4 rounded-2xl backdrop-blur-md border border-white/10 animate-in zoom-in duration-300">
                             <input value={loc.name} onChange={(e) => updateLocation(loc.id, { name: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-xs text-white outline-none font-black uppercase tracking-widest" />
                             <textarea value={loc.image_prompt} onChange={(e) => updateLocation(loc.id, { image_prompt: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-[10px] text-slate-400 outline-none h-20 resize-none font-mono" />
                             <button onClick={() => setEditingId(null)} className="w-full py-2 bg-emerald-500 text-black text-[9px] font-black uppercase rounded-lg">Lock Set Adjustments</button>
                           </div>
                        ) : (
                          <div className="flex justify-between items-end">
                            <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter group-hover:text-amber-400 leading-none">{loc.name}</h4>
                            <button onClick={() => setEditingId(loc.id)} className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white/40 hover:text-white transition-all"><span className="material-symbols-outlined text-lg">edit</span></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-8">
                <button onClick={scoutLocations} className="py-6 bg-white/5 text-slate-500 font-black rounded-[2rem] uppercase tracking-[0.3em] text-[10px] border-2 border-white/5">Re-Scout World</button>
                <button onClick={() => onComplete({})} className="py-6 bg-amber-600 hover:bg-amber-400 text-black font-black rounded-[2rem] uppercase tracking-[0.3em] text-xs flex items-center justify-center gap-3 shadow-2xl active:scale-95 group">
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