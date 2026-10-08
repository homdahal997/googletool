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
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Defensive array check
  const locations = episode.locations || [];
  const scoutLocations = async () => {
    if (!episode.script) return;
    setIsGenerating(true);
    setError(null);
    try {
      setStatus('Analyzing script for environments...');
      const prompt = `[EXTRACT_LOCATIONS]
      Script:
      """
      ${episode.script.script_content}
      """
      
      Extract filming locations. Max 3.
      Output ONLY a JSON object:
      {
        "locations": [
          { "name": "Name", "description": "Atmospheric summary", "image_prompt": "Cinematic visual prompt" }
        ]
      }`;
      const response = await Flow.generate.text(prompt, {
        systemInstruction: "You are the Production Designer. Extract environments and respond ONLY with JSON."
      });
      let cleanJson = response.text.trim();
      if (cleanJson.includes('```')) cleanJson = cleanJson.replace(/```json|```/g, '').trim();
      const startIdx = cleanJson.indexOf('{');
      const endIdx = cleanJson.lastIndexOf('}');
      if (startIdx === -1) throw new Error('Invalid JSON');
      
      const parsed: LocationAssetResponse = JSON.parse(cleanJson.substring(startIdx, endIdx + 1));
      const generatedLocations: LocationAsset[] = [];
      for (let i = 0; i < parsed.locations.length; i++) {
        const loc = parsed.locations[i];
        setStatus(`Visualizing Environment: ${loc.name} (${i + 1}/${parsed.locations.length})...`);
        const visual = await Flow.generate.image({
          prompt: `${loc.image_prompt}. Wide cinematic established environment, professional cinematography, 8k.`,
          modelDisplayName: DEFAULT_IMAGE_MODEL,
          aspectRatio: bible.metadata.aspectRatio
        });
        generatedLocations.push({
          id: Math.random().toString(36).substr(2, 9),
          name: loc.name,
          description: loc.description,
          image_prompt: loc.image_prompt,
          mediaId: visual.mediaId,
          base64: visual.base64
        });
      }
      setStatus('Mapping shots to sets...');
      const mappingPrompt = `[SET_MAPPING]
      Locations: ${JSON.stringify(generatedLocations.map(l => ({ id: l.id, name: l.name })))}
      Shots: ${JSON.stringify((episode.timeline || []).map(s => ({ index: s.index, visualPrompt: s.visualPrompt })))}
      
      Return ONLY a JSON mapping: { "mapping": [ { "shotIndex": 1, "locationId": "id" } ] }`;
      const mappingResponse = await Flow.generate.text(mappingPrompt, {
        systemInstruction: "Map shots to scouted locations. Respond ONLY with JSON."
      });
      let mapJson = mappingResponse.text.trim();
      if (mapJson.includes('```')) mapJson = mapJson.replace(/```json|```/g, '').trim();
      const mapParsed = JSON.parse(mapJson.substring(mapJson.indexOf('{'), mapJson.lastIndexOf('}') + 1));
      const updatedTimeline = (episode.timeline || []).map(shot => {
        const match = mapParsed.mapping.find((m: any) => m.shotIndex === shot.index);
        return { ...shot, locationId: match?.locationId };
      });
      onComplete({
        locations: generatedLocations,
        timeline: updatedTimeline,
        stageStatus: { ...episode.stageStatus, locations: 'completed' }
      });
      
    } catch (err) {
      console.error('Scouting failed:', err);
      setError('The Environment Node failed to initialize the scout. Please retry.');
    } finally {
      setIsGenerating(false);
    }
  };
  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#070709]">
      <div className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
          
          {locations.length === 0 ? (
            <div className="bg-[#0d0d12] border border-white/5 rounded-[3rem] p-16 text-center space-y-10 shadow-2xl relative overflow-hidden">
               <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(245,158,11,0.03)_0%,_transparent_70%)]" />
              
              <div className="w-24 h-24 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner relative z-10 group">
                <span className="material-symbols-outlined text-amber-500 text-5xl group-hover:scale-110 transition-transform duration-500">distance</span>
              </div>
              
              <div className="relative z-10 space-y-3">
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">Location Scout Console</h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-mono max-w-sm mx-auto leading-relaxed">
                  Establish the visual world. Expand script environments into persistent set locks for production continuity.
                </p>
              </div>
              {error && (
                <div className="p-5 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black rounded-2xl uppercase tracking-widest relative z-10 animate-pulse">
                   {error}
                </div>
              )}
              <button
                onClick={scoutLocations}
                disabled={isGenerating}
                className="w-full py-7 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black rounded-[2rem] transition-all shadow-2xl shadow-amber-900/40 active:scale-95 relative z-10 overflow-hidden"
              >
                {isGenerating ? (
                   <div className="flex flex-col items-center gap-1">
                     <span className="material-symbols-outlined animate-spin text-2xl mb-1">refresh</span>
                     <span className="text-[10px] uppercase tracking-widest animate-pulse">{status}</span>
                   </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs uppercase tracking-[0.3em]">Initialize Environment Scouting</span>
                    <span className="text-[8px] opacity-60 font-mono tracking-widest">Phase_3: SET_DESIGN_ACTIVE</span>
                  </div>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-12 animate-in fade-in duration-1000">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.5em] border-l-2 border-amber-500 pl-4">Locked Production Sets</h3>
                <div className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
                   <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                   <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Environments Secured</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {locations.map((loc) => (
                  <div key={loc.id} className="bg-[#0d0d12] border border-white/5 rounded-[3rem] overflow-hidden group hover:border-amber-500/40 transition-all shadow-2xl">
                    <div className="aspect-video bg-slate-900 relative">
                      {loc.base64 && <img src={`data:image/png;base64,${loc.base64}`} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt={loc.name} />}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                      <div className="absolute top-6 left-6 px-3 py-1 bg-amber-500 rounded text-[8px] font-black text-black uppercase tracking-widest shadow-xl">SET LOCKED</div>
                      <div className="absolute bottom-8 left-10 right-10">
                         <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2 group-hover:text-amber-500 transition-colors">{loc.name}</h4>
                         <p className="text-[10px] text-slate-500 uppercase leading-relaxed font-light italic line-clamp-2">{loc.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-5">
                <button onClick={scoutLocations} className="py-6 bg-white/5 hover:bg-white/10 text-slate-500 font-black rounded-3xl transition-all uppercase tracking-[0.3em] text-[10px] border border-white/5">
                  Re-scout Locations
                </button>
                <button onClick={() => onComplete({})} className="py-6 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-3xl transition-all shadow-2xl shadow-amber-900/30 uppercase tracking-[0.3em] text-xs flex items-center justify-center gap-3 active:scale-95 group">
                  Proceed to Final Render
                  <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};