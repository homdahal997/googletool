import React, { useState } from 'react';
import { Flow } from 'flow-sdk';
import { SeriesBible, ShotPrompt, EpisodeProduction } from '../types';
interface EpisodeScriptNodeProps {
  bible: SeriesBible;
  episodeIndex: number;
  onComplete: (data: Partial<EpisodeProduction>) => void;
  onBackToDashboard: () => void;
}
export const EpisodeScriptNode: React.FC<EpisodeScriptNodeProps> = ({
  bible, episodeIndex, onComplete, onBackToDashboard
}) => {
  const episode = bible.episodes[episodeIndex];
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generateScript = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const prompt = `[CINEMADRAFT_SCRIPT_STORYBOARD]
      Transform this episode synopsis into a cinematic screenplay AND a structured shot timeline.
      
      Series Narrative: ${bible.story_synopsis}
      Target Episode: ${episode.summary.episode_number} - ${episode.summary.title}
      Synopsis: ${episode.summary.synopsis}
      Language: ${bible.metadata.language}
      Output ONLY a JSON object:
      {
        "script": {
          "episode_number": ${episode.summary.episode_number},
          "scene_header": "INT. SCENE - DAY",
          "cast_list": ["Character A", "Character B"],
          "script_content": "Cinematic script with dialogue"
        },
        "shots": [
          {
            "index": 1,
            "visualPrompt": "Detailed cinematic visual for AI video generation",
            "dialogue": "Line of dialogue",
            "speakerLabel": "Character Name",
            "durationSeconds": 6
          }
        ]
      }
      Constraint: durationSeconds must be 4, 6, 8, or 10. Max 10 shots.`;
      const response = await Flow.generate.text(prompt, {
        systemInstruction: "You are the CinemaDraft Narrative Orchestrator. Respond ONLY with valid JSON. No conversational text."
      });
      const jsonStr = response.text.substring(response.text.indexOf('{'), response.text.lastIndexOf('}') + 1);
      const parsed = JSON.parse(jsonStr);
      const timeline: ShotPrompt[] = parsed.shots.map((s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9),
        durationSeconds: [4, 6, 8, 10].includes(s.durationSeconds) ? s.durationSeconds : 6
      }));
      // Send the entire update package at once
      onComplete({
        script: parsed.script,
        timeline: timeline,
        stageStatus: { ...episode.stageStatus, script: 'completed' }
      });
      
    } catch (err) {
      console.error('Script generation failed:', err);
      setError('The narrative node failed to compile the script. Please retry.');
    } finally {
      setIsGenerating(false);
    }
  };
  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#070709]">
      <div className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
          
          <div className="bg-[#0d0d12] border border-white/5 rounded-[2.5rem] p-10 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
              <span className="material-symbols-outlined text-[10rem]">history_edu</span>
            </div>
            <div className="relative z-10 space-y-4">
              <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] flex items-center gap-3">
                <span className="w-2 h-2 bg-amber-500 rounded-full" />
                Narrative Foundation
              </h3>
              <p className="text-xl text-slate-100 font-light italic leading-relaxed">
                "{episode.summary.synopsis}"
              </p>
            </div>
          </div>
          {!episode.script ? (
            <div className="bg-[#0d0d12] border border-white/5 rounded-[2.5rem] p-12 text-center space-y-10 shadow-2xl relative overflow-hidden">
              <div className="w-24 h-24 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner group">
                <span className="material-symbols-outlined text-amber-500 text-5xl group-hover:scale-110 transition-transform duration-500">auto_fix_high</span>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Scriptwriting Engine</h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-mono leading-relaxed max-w-sm mx-auto">
                  Initialize agentic expansion to transform synopsis into cinematic storyboard timeline
                </p>
              </div>
              {error && (
                <div className="p-5 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] uppercase font-black text-center rounded-2xl tracking-widest animate-pulse">
                  {error}
                </div>
              )}
              <button
                onClick={generateScript}
                disabled={isGenerating}
                className="w-full py-7 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black rounded-3xl transition-all shadow-2xl shadow-amber-900/40 flex flex-col items-center gap-1 active:scale-95 group overflow-hidden relative"
              >
                {isGenerating ? (
                  <>
                    <div className="absolute inset-0 bg-white/5 animate-pulse" />
                    <span className="material-symbols-outlined animate-spin text-2xl mb-1">refresh</span>
                    <span className="text-[10px] uppercase tracking-[0.2em]">Compiling Narrative Sequence...</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs uppercase tracking-[0.3em]">Initialize Script Expansion</span>
                    <span className="text-[8px] opacity-60 uppercase tracking-widest font-mono mt-1">Orchestration Phase_1: ACTIVE</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="bg-[#0d0d12] border border-white/10 rounded-[3rem] p-10 space-y-8 shadow-2xl relative">
                <div className="absolute top-10 right-10 flex items-center gap-3">
                   <div className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
                     <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                     <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Script Locked</span>
                   </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">{episode.script.scene_header}</span>
                  <div className="flex flex-wrap gap-2 pt-4">
                    {episode.script.cast_list.map((name) => (
                      <span key={name} className="px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="p-10 bg-black/40 border border-white/5 rounded-[2rem] relative shadow-inner">
                  <div className="absolute top-6 right-8 opacity-[0.03] select-none pointer-events-none">
                    <span className="material-symbols-outlined text-8xl">format_quote</span>
                  </div>
                  <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono relative z-10 max-h-[300px] overflow-y-auto no-scrollbar">
                    {episode.script.script_content}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <button
                  onClick={generateScript}
                  disabled={isGenerating}
                  className="py-6 bg-white/5 hover:bg-white/10 text-slate-500 font-black rounded-3xl transition-all uppercase tracking-[0.3em] text-[10px] border border-white/5"
                >
                  Regenerate Narrative
                </button>
                <button
                  onClick={() => onComplete({})}
                  className="py-6 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-3xl transition-all shadow-2xl shadow-amber-900/30 uppercase tracking-[0.3em] text-xs flex items-center justify-center gap-3 active:scale-95 group"
                >
                  Proceed to Casting
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