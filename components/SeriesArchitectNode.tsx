import React, { useState } from 'react';
import { Flow } from 'flow-sdk';
import { SeriesBible, SeriesSynopsis } from '../types';
interface SeriesArchitectNodeProps {
  onComplete: (bible: SeriesBible) => void;
}
export const SeriesArchitectNode: React.FC<SeriesArchitectNodeProps> = ({ onComplete }) => {
  const [idea, setIdea] = useState('');
  const [episodeCount, setEpisodeCount] = useState<number>(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const episodeOptions = [10, 45, 60];
  const executeArchitect = async () => {
    if (!idea.trim()) return;
    setIsProcessing(true);
    setError(null);
    try {
      const prompt = `[SERIES_ARCHITECT] 
      Transform this raw concept into a high-stakes, cinematic ${episodeCount}-episode vertical drama series breakdown.
      
      Concept: "${idea}"
      
      Generate a full ${episodeCount}-episode arc with intense hooks and cliffhangers.
      Output ONLY a JSON object:
      {
        "seriesTitle": "Catchy Cinematic Title",
        "story_synopsis": "Overall series narrative arc (2 sentences)",
        "episodes": [
          {
            "episode_number": 1,
            "title": "Episode Title",
            "synopsis": "One very brief sentence synopsis"
          }
        ]
      }
      IMPORTANT: Keep individual episode synopses extremely brief (max 15 words) to ensure the full list fits in the response.`;
      const response = await Flow.generate.text(prompt, {
        systemInstruction: `You are a Senior Series Architect for a vertical drama studio. Output ONLY valid JSON matching the requested schema. No conversational text.`
      });
      const jsonStr = response.text.substring(response.text.indexOf('{'), response.text.lastIndexOf('}') + 1);
      const parsed: SeriesSynopsis = JSON.parse(jsonStr);
      const bible: SeriesBible = {
        rawIdea: idea,
        seriesTitle: parsed.seriesTitle,
        story_synopsis: parsed.story_synopsis,
        episodes: parsed.episodes.map(ep => ({
          summary: ep,
          actors: [],
          locations: [],
          timeline: [],
          stage: 'script',
          stageStatus: { 
            script: 'idle', 
            characters: 'idle', 
            locations: 'idle', 
            render: 'idle' 
          }
        })),
        activeEpisodeIndex: null,
        sharedCastRoster: [],
        metadata: {
          language: 'English',
          aspectRatio: '9:16',
          targetResolution: '720p'
        }
      };
      onComplete(bible);
    } catch (err) {
      console.error('Architect failed:', err);
      setError('The Architect node failed to compile the series manifest. Try a simpler concept.');
    } finally {
      setIsProcessing(false);
    }
  };
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 overflow-y-auto no-scrollbar bg-[#050505]">
      <div className="w-full max-w-3xl space-y-12 py-12 animate-in fade-in slide-in-from-bottom-12 duration-700">
        <div className="text-center space-y-6">
          <div className="w-24 h-24 bg-amber-400/10 border-2 border-amber-400/30 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(245,158,11,0.2)]">
            <span className="material-symbols-outlined text-5xl text-amber-400">architecture</span>
          </div>
          <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter leading-none">
            CinemaDraft <span className="text-amber-400">Architect</span>
          </h2>
          <p className="text-slate-400 text-xs uppercase font-bold tracking-[0.6em] font-mono">Stage 0 // Narrative Architecture</p>
        </div>
        <div className="bg-[#0c0c0e] border-2 border-white/10 rounded-[3rem] p-12 shadow-[0_0_100px_rgba(0,0,0,0.8)] space-y-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <span className="material-symbols-outlined text-[12rem]">auto_awesome</span>
          </div>
          <div className="space-y-8 relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <label className="text-xs font-black text-slate-300 uppercase tracking-[0.4em] flex items-center gap-3">
                <span className="w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                Raw Concept Blueprint
              </label>
              
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2">Episode Count</span>
                <div className="flex bg-black p-1.5 rounded-2xl border-2 border-white/10">
                  {episodeOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setEpisodeCount(opt)}
                      className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        episodeCount === opt 
                          ? 'bg-amber-500 text-black shadow-lg' 
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Inject your core narrative concept here..."
              className="w-full h-48 bg-black/60 border-2 border-white/10 rounded-[2rem] p-8 text-xl text-white outline-none focus:border-amber-400/50 transition-all resize-none placeholder:opacity-10 font-medium italic tracking-tight"
            />
          </div>
          {error && (
            <div className="p-6 bg-red-500/10 border-2 border-red-500/20 text-red-400 text-xs uppercase font-black text-center rounded-[2rem] tracking-[0.2em] animate-pulse">
              {error}
            </div>
          )}
          <button
            onClick={executeArchitect}
            disabled={isProcessing || !idea.trim()}
            className="w-full py-8 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-900 disabled:text-slate-700 text-black font-black rounded-[2.5rem] transition-all shadow-2xl shadow-amber-900/40 uppercase tracking-[0.5em] text-sm flex flex-col items-center gap-2 group relative overflow-hidden active:scale-95"
          >
            {isProcessing ? (
              <>
<span className="material-symbols-outlined animate-spin text-3xl mb-1">refresh</span>
                <span className="text-xs uppercase tracking-widest font-black animate-pulse italic">Synthesizing {episodeCount} Eps...</span>
              </>
            ) : (
              <>
                <span className="text-base">Compile Studio Bible</span>
                <span className="text-[10px] opacity-60 font-mono tracking-[0.4em] font-black">PHASE_0: INITIALIZE</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};