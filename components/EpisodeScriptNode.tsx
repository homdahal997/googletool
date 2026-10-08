import React, { useState, useEffect } from 'react';
import { Flow } from 'flow-sdk';
import { SeriesBible, ShotPrompt, EpisodeProduction, EpisodeScript } from '../types';
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
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local state for editing
  const [editedScript, setEditedScript] = useState<EpisodeScript | null>(null);
  const [editedTimeline, setEditedTimeline] = useState<ShotPrompt[]>([]);
  useEffect(() => {
    if (episode.script) setEditedScript(episode.script);
    if (episode.timeline) setEditedTimeline(episode.timeline);
  }, [episode.script, episode.timeline]);
  const generateScript = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const prompt = `[CINEMADRAFT_SCRIPT_STORYBOARD]
      Expand this episode synopsis into a compelling short-form screenplay and a matching shot timeline.
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
          "script_content": "Formatted screenplay with 12-18 distinct spoken lines"
        },
        "shots": [
          {
            "index": 1,
            "visualPrompt": "Detailed cinematic visual",
            "dialogue": "Line from script",
            "speakerLabel": "Character Name",
            "durationSeconds": 6
          }
        ]
      }`;
      const response = await Flow.generate.text(prompt, {
        systemInstruction: "You are the CinemaDraft Narrative Orchestrator. Respond ONLY with valid JSON."
      });
      const jsonStr = response.text.substring(response.text.indexOf('{'), response.text.lastIndexOf('}') + 1);
      const parsed = JSON.parse(jsonStr);
      const timeline: ShotPrompt[] = parsed.shots.map((s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9),
        durationSeconds: [4, 6, 8, 10].includes(s.durationSeconds) ? s.durationSeconds : 6
      }));
      onComplete({
        script: parsed.script,
        timeline: timeline,
        stageStatus: { ...episode.stageStatus, script: 'completed' }
      });
      
    } catch (err) {
      setError('Failed to compile script. Please retry.');
    } finally {
      setIsGenerating(false);
    }
  };
  const handleSaveEdits = () => {
    onComplete({
      script: editedScript || undefined,
      timeline: editedTimeline,
    });
    setIsEditing(false);
  };
  const updateShot = (idx: number, field: keyof ShotPrompt, value: any) => {
    const next = [...editedTimeline];
    next[idx] = { ...next[idx], [field]: value };
    setEditedTimeline(next);
  };
  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#070709]">
      <div className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
          
          <div className="bg-[#0d0d12] border border-white/5 rounded-[2.5rem] p-8 flex justify-between items-center relative overflow-hidden shadow-2xl">
            <div className="relative z-10 space-y-2">
              <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] flex items-center gap-3">
                <span className="w-2 h-2 bg-amber-500 rounded-full" />
                Current Objective
              </h3>
              <p className="text-sm text-slate-300 font-medium italic">"{episode.summary.synopsis}"</p>
            </div>
            {episode.script && (
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isEditing ? 'bg-emerald-500 text-black' : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white'}`}
              >
                {isEditing ? 'Lock Adjustments' : 'Edit Manifest'}
              </button>
            )}
          </div>
          {!episode.script ? (
            <div className="bg-[#0d0d12] border border-white/5 rounded-[2.5rem] p-12 text-center space-y-8 shadow-2xl">
              <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
                <span className="material-symbols-outlined text-amber-500 text-4xl">auto_fix_high</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Scriptwriting Agent</h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-mono">Expand synopsis into a cinematic storyboard</p>
              </div>
              <button onClick={generateScript} disabled={isGenerating} className="w-full py-7 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-3xl transition-all shadow-2xl shadow-amber-900/40 uppercase tracking-[0.4em] text-sm">
                {isGenerating ? 'Synthesizing Narrative...' : 'Initialize Script Expansion'}
              </button>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
              {isEditing ? (
                <div className="space-y-8 bg-[#0d0d12] border border-white/10 rounded-[3rem] p-10 shadow-2xl">
                   <div className="space-y-6">
                      <label className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">Screenplay Raw Text</label>
                      <textarea 
                        value={editedScript?.script_content} 
                        onChange={(e) => setEditedScript(s => s ? { ...s, script_content: e.target.value } : null)}
                        className="w-full h-64 bg-black/40 border border-white/10 rounded-2xl p-6 text-xs text-slate-300 font-mono focus:border-amber-500/40 outline-none"
                      />
                   </div>
                   <div className="space-y-6">
                      <label className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">Shot Timeline Matrix</label>
                      <div className="space-y-4">
                        {editedTimeline.map((shot, i) => (
                          <div key={shot.id} className="grid grid-cols-12 gap-4 bg-black/30 p-4 rounded-xl border border-white/5">
                            <div className="col-span-1 text-[10px] font-mono text-slate-600 flex items-center justify-center">{i+1}</div>
                            <div className="col-span-3">
                              <input 
                                value={shot.speakerLabel} 
                                onChange={(e) => updateShot(i, 'speakerLabel', e.target.value)}
                                className="w-full bg-transparent border-b border-white/10 text-[10px] text-white py-1 outline-none font-black uppercase tracking-widest"
                                placeholder="Speaker"
                              />
                            </div>
                            <div className="col-span-8">
                              <input 
                                value={shot.visualPrompt} 
                                onChange={(e) => updateShot(i, 'visualPrompt', e.target.value)}
                                className="w-full bg-transparent border-b border-white/10 text-[10px] text-slate-400 py-1 outline-none italic"
                                placeholder="Visual Prompt"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                   </div>
                   <button onClick={handleSaveEdits} className="w-full py-4 bg-emerald-500 text-black font-black rounded-2xl uppercase tracking-[0.3em] text-xs shadow-xl">Apply Director Adjustments</button>
                </div>
              ) : (
                <div className="bg-[#0d0d12] border border-white/10 rounded-[3rem] p-10 space-y-8 shadow-2xl relative">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">{episode.script.scene_header}</span>
                    <div className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
                       <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                       <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest italic">Draft Approved</span>
                    </div>
                  </div>
                  <div className="p-10 bg-black/40 border border-white/5 rounded-[2rem] text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono shadow-inner max-h-[400px] overflow-y-auto no-scrollbar">
                    {episode.script.script_content}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-5">
                <button onClick={generateScript} className="py-6 bg-white/5 hover:bg-white/10 text-slate-500 font-black rounded-3xl transition-all uppercase tracking-[0.3em] text-[10px] border border-white/5">Regenerate Narrative</button>
                <button onClick={() => onComplete({})} className="py-6 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-3xl transition-all shadow-2xl shadow-amber-900/30 uppercase tracking-[0.3em] text-xs flex items-center justify-center gap-3 active:scale-95 group">
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