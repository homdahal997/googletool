import React, { useState, useEffect } from 'react';
import { SeriesBible, ShotPrompt, EpisodeScript, BibleUpdater, ActorProfile, LocationAsset } from '../types';
import { SHOT_SIZES, CAMERA_ANGLES, CAMERA_MOVEMENTS, SHOT_DURATIONS } from '../constants';
import {
  generateJson, generateContinuity, findActor, findLocation, fitDialogueToShots, newId, patchEpisode,
  buildStyleBlock, buildCharacterBible, buildLocationLibrary, buildPreviouslyOn,
  CONTINUITY_SCHEMA, isContinuity, normalizeContinuity
} from '../services/continuityService';
interface EpisodeScriptNodeProps {
  bible: SeriesBible;
  episodeIndex: number;
  onUpdateBible: (updater: BibleUpdater) => void;
  onComplete: () => void;
  onBackToDashboard: () => void;
}
interface ScriptResponse {
  script: EpisodeScript;
  continuity: any;
  new_characters?: any[];
  new_locations?: any[];
  shots: any[];
}
const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : []);
export const EpisodeScriptNode: React.FC<EpisodeScriptNodeProps> = ({
  bible, episodeIndex, onUpdateBible, onComplete, onBackToDashboard
}) => {
  const episode = bible.episodes[episodeIndex];
  const previousEpisode = episodeIndex > 0 ? bible.episodes[episodeIndex - 1] : undefined;
  const library = bible.sharedLocations || [];
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
      const nextEpisode = bible.episodes[episodeIndex + 1];
      const prompt = `[CINEMADRAFT_SCRIPT_STORYBOARD]
You are writing Episode ${episode.summary.episode_number} of ${bible.episodes.length} of "${bible.seriesTitle}".
SERIES: ${bible.logline || ''}
${bible.story_synopsis}
${bible.seasonArc?.length ? `SEASON ARC:\n${bible.seasonArc.join('\n')}` : ''}
STYLE: ${buildStyleBlock(bible.style)}
LANGUAGE: all dialogue in ${bible.metadata.language}.

CHARACTER BIBLE (use these EXACT names; never change appearance, wardrobe, personality or voice):
${buildCharacterBible(bible.sharedCastRoster)}

LOCATION LIBRARY (reuse these EXACT names whenever the story allows):
${buildLocationLibrary(library)}

${buildPreviouslyOn(bible, episodeIndex)}

THIS EPISODE: "${episode.summary.title}"
Synopsis: ${episode.summary.synopsis}
${episode.summary.hook ? `Opening hook: ${episode.summary.hook}` : ''}
${episode.summary.cliffhanger ? `Must end on: ${episode.summary.cliffhanger}` : 'Must end on a strong cliffhanger.'}
${nextEpisode ? `Next episode (set it up, do not play it): ${nextEpisode.summary.synopsis}` : 'This is the series finale: pay off the central conflict and open threads.'}

WRITING RULES:
- Pick up the previous cliffhanger within the first shots, then land the opening hook.
- Professional screenplay format: scene headings (INT./EXT. LOCATION - DAY/NIGHT), action lines, CHARACTER cues, parentheticals.
- 12-18 spoken lines. Every line advances plot or reveals character; prefer subtext to exposition; each character keeps their established voice and personality.
- Characters only know what they have learned on screen. Honor character states, injuries, wardrobe changes and open threads.
- Only introduce a new character or location if the story truly needs it, and list it in new_characters / new_locations with a full fixed description.

CINEMATOGRAPHY RULES (big-production coverage):
- 14-22 shots. Open every scene with an establishing Wide or Extreme Wide Shot of the location.
- Cover conversations with shot / reverse shot (Over-the-Shoulder, Medium Close-Up). Respect the 180-degree rule: describe which side of frame each character occupies and keep it consistent within the scene.
- Close-Ups and Extreme Close-Ups for emotional peaks and reveals, Inserts for key props, reaction shots after big lines.
- Never use the same shot size twice in a row. Motivate every camera move (slow push-in for tension, handheld for chaos, crane for scale).
- Lighting must match the scene's time of day and stay consistent across shots of the same scene.
- One speaker per shot, max 20 words per line. Silent shots use an empty dialogue and empty speakerLabel.
- visualPrompt must be self-contained: blocking, frame position, expression and wardrobe of everyone in frame, and the set.
- shotSize from: ${SHOT_SIZES.join(', ')}. cameraAngle from: ${CAMERA_ANGLES.join(', ')}. cameraMovement from: ${CAMERA_MOVEMENTS.join(', ')}.

Output ONLY a JSON object:
{
  "script": {
    "episode_number": ${episode.summary.episode_number},
    "scene_header": "INT. LOCATION - NIGHT",
    "cast_list": ["Exact Character Name"],
    "script_content": "Full formatted screenplay"
  },
  "continuity": ${CONTINUITY_SCHEMA},
  "new_characters": [ { "name": "", "role": "", "age": "", "appearance": "", "wardrobe": "", "personality": "", "voice": "" } ],
  "new_locations": [ { "name": "", "description": "", "image_prompt": "" } ],
  "shots": [
    {
      "index": 1,
      "sceneNumber": 1,
      "location": "Exact location name",
      "characters": ["Exact names visible in frame"],
      "speakerLabel": "Exact character name or empty",
      "dialogue": "Line or empty",
      "performance": "Emotion and delivery",
      "shotSize": "Wide Shot",
      "cameraAngle": "Eye Level",
      "cameraMovement": "Slow Push-In",
      "lens": "35mm",
      "lighting": "Lighting setup",
      "visualPrompt": "Self-contained visual description",
      "durationSeconds": 6
    }
  ]
}`;
      const parsed = await generateJson<ScriptResponse>(
        prompt,
        'You are an award-winning showrunner, screenwriter and director of photography. Respond ONLY with valid JSON.',
        r => !!r?.script?.script_content && Array.isArray(r.shots) && r.shots.length > 0 && isContinuity(r.continuity)
      );
      onUpdateBible(prev => {
        const roster: ActorProfile[] = [...prev.sharedCastRoster];
        for (const c of asArray(parsed.new_characters)) {
          if (!c?.name || findActor(roster, c.name)) continue;
          roster.push({
            id: newId(), name: String(c.name), aliases: [], role: c.role, age: c.age,
            visualDescription: c.appearance || String(c.name), wardrobe: c.wardrobe,
            personality: c.personality, voiceDescription: c.voice
          });
        }
        const locations: LocationAsset[] = [...(prev.sharedLocations || [])];
        const addLocation = (name: string, description?: string, image_prompt?: string) => {
          if (!name || findLocation(locations, name)) return;
          locations.push({ id: newId(), name, description: description || name, image_prompt: image_prompt || description || name });
        };
        asArray(parsed.new_locations).forEach(l => addLocation(String(l?.name || ''), l?.description, l?.image_prompt));
        parsed.shots.forEach(s => addLocation(String(s?.location || '')));
        const timeline: ShotPrompt[] = fitDialogueToShots(parsed.shots.map((s, i) => {
          const speaker = findActor(roster, s.speakerLabel);
          const inFrame = asArray(s.characters).map(n => findActor(roster, String(n))?.id).filter((id): id is string => !!id);
          const duration = Number(s.durationSeconds);
          return {
            id: newId(),
            index: i + 1,
            sceneNumber: Number(s.sceneNumber) || undefined,
            visualPrompt: String(s.visualPrompt || ''),
            dialogue: String(s.dialogue || ''),
            speakerLabel: speaker?.name ?? String(s.speakerLabel || ''),
            speakerActorId: speaker?.id,
            actorIds: Array.from(new Set([...(speaker ? [speaker.id] : []), ...inFrame])),
            locationId: findLocation(locations, s.location)?.id,
            shotSize: s.shotSize, cameraAngle: s.cameraAngle, cameraMovement: s.cameraMovement,
            lens: s.lens, lighting: s.lighting, performance: s.performance,
            durationSeconds: (SHOT_DURATIONS as readonly number[]).includes(duration) ? duration as ShotPrompt['durationSeconds'] : 6
          };
        }));
        const castIds = new Set([
          ...timeline.flatMap(s => s.actorIds || []),
          ...asArray(parsed.script.cast_list).map(n => findActor(roster, String(n))?.id).filter((id): id is string => !!id)
        ]);
        const locationIds = new Set(timeline.map(s => s.locationId).filter(Boolean));
        return {
          sharedCastRoster: roster,
          sharedLocations: locations,
          ...patchEpisode(prev, episodeIndex, {
            script: { ...parsed.script, episode_number: episode.summary.episode_number },
            continuity: normalizeContinuity(parsed.continuity),
            timeline,
            actors: roster.filter(a => castIds.has(a.id)),
            locations: locations.filter(l => locationIds.has(l.id)),
            stageStatus: { ...prev.episodes[episodeIndex].stageStatus, script: 'completed' }
          })
        };
      });
    } catch (err) {
      setError(`Failed to compile script: ${err instanceof Error ? err.message : 'unknown error'}. Please retry.`);
    } finally {
      setIsGenerating(false);
    }
  };
  const handleSaveEdits = async () => {
    if (!editedScript) return;
    setIsSaving(true);
    setError(null);
    const roster = bible.sharedCastRoster;
    const timeline = fitDialogueToShots(editedTimeline.map(s => {
      const original = episode.timeline.find(o => o.id === s.id);
      if (original && original.speakerLabel === s.speakerLabel) return s;
      const speaker = findActor(roster, s.speakerLabel);
      const actorIds = (s.actorIds || []).filter(id => id !== original?.speakerActorId);
      return { ...s, speakerActorId: speaker?.id, actorIds: speaker ? Array.from(new Set([speaker.id, ...actorIds])) : actorIds };
    }));
    const scriptChanged = editedScript.script_content !== episode.script?.script_content;
    onUpdateBible(prev => patchEpisode(prev, episodeIndex, { script: editedScript, timeline }));
    setIsEditing(false);
    if (scriptChanged) {
      try {
        const continuity = await generateContinuity(bible, episodeIndex, editedScript);
        onUpdateBible(prev => patchEpisode(prev, episodeIndex, { continuity }));
      } catch (err) {
        setError(`Script saved, but continuity notes could not be refreshed: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }
    setIsSaving(false);
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
          
          <div className="bg-[#0d0d12] border border-white/10 rounded-3xl p-8 flex justify-between items-center relative overflow-hidden shadow-2xl">
            <div className="relative z-10 space-y-2">
              <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-3">
                <span className="w-2 h-2 bg-amber-500 rounded-full" />
                Current Objective
              </h3>
              <p className="text-base text-slate-200 font-medium leading-relaxed">"{episode.summary.synopsis}"</p>
              {episode.summary.cliffhanger && <p className="text-sm text-slate-300">Ends on: {episode.summary.cliffhanger}</p>}
              {previousEpisode && !previousEpisode.continuity && (
                <p className="text-sm text-amber-400">Episode {previousEpisode.summary.episode_number} has no continuity notes yet, so this script will only see its outline.</p>
              )}
            </div>
            {episode.script && (
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className={`focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${isEditing ? 'bg-emerald-500 text-black' : 'bg-white/5 text-slate-300 border border-white/10 hover:text-white'}`}
              >
                {isEditing ? 'Lock Adjustments' : 'Edit Manifest'}
              </button>
            )}
          </div>
          {error && (
            <div className="p-5 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold text-center rounded-2xl">{error}</div>
          )}
          {!episode.script ? (
            <div className="bg-[#0d0d12] border border-white/10 rounded-3xl p-12 text-center space-y-8 shadow-2xl">
              <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <span className="material-symbols-outlined text-amber-500 text-4xl">auto_fix_high</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Scriptwriting Agent</h3>
                <p className="text-xs text-slate-300 uppercase tracking-widest font-mono">Expand synopsis into a cinematic storyboard</p>
              </div>
              <button onClick={generateScript} disabled={isGenerating} className="w-full py-7 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-3xl transition-all shadow-2xl shadow-amber-900/40 uppercase tracking-widest text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">
                {isGenerating ? 'Synthesizing Narrative...' : 'Initialize Script Expansion'}
              </button>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
              {isEditing ? (
                <div className="space-y-8 bg-[#0d0d12] border border-white/10 rounded-3xl p-10 shadow-2xl">
                   <div className="space-y-6">
                      <label className="text-xs font-bold text-amber-500 uppercase tracking-widest">Screenplay Raw Text</label>
                      <textarea 
                        value={editedScript?.script_content} 
                        onChange={(e) => setEditedScript(s => s ? { ...s, script_content: e.target.value } : null)}
                        className="w-full h-64 bg-black/40 border border-white/10 rounded-2xl p-6 text-sm text-slate-200 font-mono focus:border-amber-500/40 outline-none"
                      />
                   </div>
                   <div className="space-y-6">
                      <label className="text-xs font-bold text-amber-500 uppercase tracking-widest">Shot Timeline Matrix</label>
                      <div className="space-y-4">
                        {editedTimeline.map((shot, i) => (
                          <div key={shot.id} className="grid grid-cols-12 gap-4 bg-black/30 p-4 rounded-xl border border-white/10">
                            <div className="col-span-1 text-xs font-mono text-slate-400 flex items-center justify-center">{i+1}</div>
                            <div className="col-span-3">
                              <input 
                                value={shot.speakerLabel} 
                                onChange={(e) => updateShot(i, 'speakerLabel', e.target.value)}
                                className="w-full bg-transparent border-b border-white/10 text-xs text-white py-1 outline-none font-bold uppercase tracking-widest focus:border-amber-400/60 transition-colors"
                                placeholder="Speaker"
                              />
                            </div>
                            <div className="col-span-4">
                              <select value={shot.shotSize || ''} onChange={(e) => updateShot(i, 'shotSize', e.target.value)} className="w-full bg-black border-b border-white/10 text-xs text-slate-200 py-1 outline-none focus:border-amber-400/60 transition-colors">
                                <option value="">Shot size</option>
                                {SHOT_SIZES.map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            </div>
                            <div className="col-span-4">
                              <select value={shot.locationId || ''} onChange={(e) => updateShot(i, 'locationId', e.target.value || undefined)} className="w-full bg-black border-b border-white/10 text-xs text-slate-200 py-1 outline-none focus:border-amber-400/60 transition-colors">
                                <option value="">Location</option>
                                {library.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                              </select>
                            </div>
                            <div className="col-span-11 col-start-2">
                              <input 
                                value={shot.dialogue} 
                                onChange={(e) => updateShot(i, 'dialogue', e.target.value)}
                                className="w-full bg-transparent border-b border-white/10 text-xs text-white py-1 outline-none focus:border-amber-400/60 transition-colors"
                                placeholder="Dialogue"
                              />
                            </div>
                            <div className="col-span-11 col-start-2">
                              <input 
                                value={shot.visualPrompt} 
                                onChange={(e) => updateShot(i, 'visualPrompt', e.target.value)}
                                className="w-full bg-transparent border-b border-white/10 text-xs text-slate-300 py-1 outline-none italic focus:border-amber-400/60 transition-colors"
                                placeholder="Visual Prompt"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                   </div>
                   <button onClick={handleSaveEdits} disabled={isSaving} className="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl uppercase tracking-widest text-sm shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">Apply Director Adjustments</button>
                </div>
              ) : (
                <div className="bg-[#0d0d12] border border-white/10 rounded-3xl p-10 space-y-8 shadow-2xl relative">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">{episode.script.scene_header}</span>
                    <div className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
                       <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                       <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest italic">Draft Approved</span>
                    </div>
                  </div>
                  <div className="p-10 bg-black/40 border border-white/10 rounded-2xl text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-mono shadow-inner max-h-[400px] overflow-y-auto">
                    {episode.script.script_content}
                  </div>
                  {episode.continuity && (
                    <div className="p-6 bg-black/30 border border-white/10 rounded-2xl space-y-2 text-sm text-slate-200">
                      <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">Continuity Notes {isSaving && '(refreshing...)'}</span>
                      <p><span className="text-slate-300">Recap:</span> {episode.continuity.recap}</p>
                      <p><span className="text-slate-300">Character states:</span> {episode.continuity.characterStates}</p>
                      <p><span className="text-slate-300">Cliffhanger:</span> {episode.continuity.cliffhanger}</p>
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-5">
                <button onClick={generateScript} disabled={isGenerating} className="py-6 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-3xl transition-all uppercase tracking-widest text-xs border border-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">{isGenerating ? 'Synthesizing Narrative...' : 'Regenerate Narrative'}</button>
                <button onClick={onComplete} disabled={isGenerating || isEditing} className="py-6 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-3xl transition-all shadow-2xl shadow-amber-900/30 uppercase tracking-widest text-sm flex items-center justify-center gap-3 active:scale-95 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">
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