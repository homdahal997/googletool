import React, { useState } from 'react';
import { SeriesBible, SeriesFoundation, EpisodeSummary } from '../types';
import { GENRE_OPTIONS, TONE_OPTIONS } from '../constants';
import { generateJson, newId } from '../services/continuityService';
interface SeriesArchitectNodeProps {
  onComplete: (bible: SeriesBible) => void;
}
export const SeriesArchitectNode: React.FC<SeriesArchitectNodeProps> = ({ onComplete }) => {
  const [idea, setIdea] = useState('');
  const [episodeCount, setEpisodeCount] = useState<number>(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [language, setLanguage] = useState('English');
  const [genre, setGenre] = useState(GENRE_OPTIONS[0]);
  const [tone, setTone] = useState(TONE_OPTIONS[0]);
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [resolution, setResolution] = useState<'360p' | '720p'>('720p');
  const episodeOptions = [10, 45, 60];
  const OUTLINE_BATCH_SIZE = 10;
  const format = aspectRatio === '9:16' ? 'vertical short-form drama' : 'widescreen short-form drama';
  const architectSystem = `You are a Senior Series Architect and showrunner for a premium ${format} studio. Output ONLY valid JSON matching the requested schema. No conversational text.`;
  const generateFoundation = () => generateJson<SeriesFoundation>(`[SERIES_BIBLE]
      Build the series bible for a ${episodeCount}-episode ${genre.toLowerCase()} ${format} with a ${tone.toLowerCase()} tone.
      Concept: "${idea}"
      Dialogue language: ${language}

      Requirements:
      - A clear protagonist with a strong desire, a formidable antagonist, and escalating stakes.
      - A season arc split into 3-5 acts with episode ranges, midpoint reversal and finale payoff.
      - Main recurring characters (4-8) with FIXED visual identities so every episode and shot looks the same: ethnicity, age, face, hair, build, distinguishing marks, plus a signature wardrobe and a distinct voice (pitch, accent, pace, texture).
      - Recurring locations (3-8) reused across episodes.
      - A single visual look and color palette for the whole series.

      Output ONLY a JSON object:
      {
        "seriesTitle": "Catchy Cinematic Title",
        "logline": "One-sentence hook",
        "story_synopsis": "Overall series narrative arc (3-4 sentences)",
        "season_arc": ["Act 1 (Ep 1-X): ..."],
        "style": { "visualLook": "camera, lens and lighting look, e.g. anamorphic, shallow depth of field, moody contrast", "colorPalette": "dominant grading colors" },
        "characters": [ { "name": "Full Name", "aliases": ["nicknames"], "role": "protagonist/antagonist/...", "age": "30s", "appearance": "detailed fixed physical description", "wardrobe": "signature outfit", "personality": "core traits and flaw", "voice": "voice description" } ],
        "locations": [ { "name": "Location Name", "description": "what it is and its mood", "image_prompt": "detailed visual description of the set" } ]
      }`,
    architectSystem,
    f => !!f?.seriesTitle && Array.isArray(f.characters) && Array.isArray(f.locations)
  );
  const generateOutlineBatch = (foundation: SeriesFoundation, previous: EpisodeSummary[], start: number, end: number) => {
    const earlier = previous.slice(0, Math.max(0, previous.length - 20)).map(e => `Ep ${e.episode_number}: ${e.title}`);
    const recent = previous.slice(-20).map(e => `Ep ${e.episode_number} "${e.title}": ${e.synopsis} Cliffhanger: ${e.cliffhanger || '-'}`);
    return generateJson<{ episodes: EpisodeSummary[] }>(`[EPISODE_OUTLINE]
      Series: ${foundation.seriesTitle} — ${foundation.logline}
      Arc: ${foundation.story_synopsis}
      Season acts:
      ${foundation.season_arc.join('\n      ')}
      Characters: ${foundation.characters.map(c => `${c.name} (${c.role})`).join(', ')}
      Locations: ${foundation.locations.map(l => l.name).join(', ')}
      Total episodes: ${episodeCount}

      ${previous.length ? `Episodes already outlined:\n      ${[...earlier, ...recent].join('\n      ')}` : 'No episodes outlined yet.'}

      Outline episodes ${start} to ${end}. Each episode must open by resolving the previous cliffhanger, advance the act it belongs to, and end on a new cliffhanger. Use only the characters and locations above unless the story requires a new one.
      Output ONLY a JSON object:
      { "episodes": [ { "episode_number": ${start}, "title": "Episode Title", "synopsis": "What happens (max 40 words)", "hook": "Opening moment that grabs attention", "cliffhanger": "Final unresolved moment" } ] }`,
      architectSystem,
      r => Array.isArray(r?.episodes) && r.episodes.length > 0
    );
  };
  const executeArchitect = async () => {
    if (!idea.trim()) return;
    setIsProcessing(true);
    setError(null);
    try {
      setStatus('Writing series bible...');
      const foundation = await generateFoundation();
      foundation.season_arc = Array.isArray(foundation.season_arc) ? foundation.season_arc : [];
      const outline: EpisodeSummary[] = [];
      for (let start = 1; start <= episodeCount; start += OUTLINE_BATCH_SIZE) {
        const end = Math.min(episodeCount, start + OUTLINE_BATCH_SIZE - 1);
        setStatus(`Outlining episodes ${start}-${end} of ${episodeCount}...`);
        const batch = await generateOutlineBatch(foundation, outline, start, end);
        batch.episodes.slice(0, end - start + 1).forEach((ep, i) => outline.push({ ...ep, episode_number: start + i }));
      }
      const bible: SeriesBible = {
        rawIdea: idea,
        seriesTitle: foundation.seriesTitle,
        logline: foundation.logline,
        story_synopsis: foundation.story_synopsis,
        seasonArc: foundation.season_arc,
        style: {
          genre,
          tone,
          visualLook: foundation.style?.visualLook || 'Cinematic, shallow depth of field, motivated lighting',
          colorPalette: foundation.style?.colorPalette || 'Natural, filmic grade'
        },
        episodes: outline.map(ep => ({
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
        sharedCastRoster: foundation.characters.map(c => ({
          id: newId(),
          name: c.name,
          aliases: Array.isArray(c.aliases) ? c.aliases : [],
          role: c.role,
          age: c.age,
          visualDescription: c.appearance,
          wardrobe: c.wardrobe,
          personality: c.personality,
          voiceDescription: c.voice
        })),
        sharedLocations: foundation.locations.map(l => ({
          id: newId(),
          name: l.name,
          description: l.description,
          image_prompt: l.image_prompt
        })),
        metadata: {
          language: language.trim() || 'English',
          aspectRatio,
          targetResolution: resolution
        }
      };
      onComplete(bible);
    } catch (err) {
      console.error('Architect failed:', err);
      setError('The Architect node failed to compile the series manifest. Try a simpler concept.');
    } finally {
      setIsProcessing(false);
      setStatus('');
    }
  };
  return (
    <div className="h-full flex flex-col items-center p-8 overflow-y-auto no-scrollbar bg-[#050505]">
      <div className="w-full max-w-3xl my-auto space-y-12 py-12 animate-in fade-in slide-in-from-bottom-12 duration-700">
        <div className="text-center space-y-6">
          <div className="w-24 h-24 bg-amber-400/10 border-2 border-amber-400/30 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(245,158,11,0.2)]">
            <span className="material-symbols-outlined text-5xl text-amber-400">architecture</span>
          </div>
          <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter leading-none">
            CinemaDraft <span className="text-amber-400">Architect</span>
          </h2>
          <p className="text-slate-300 text-sm uppercase font-bold tracking-[0.2em] font-mono">Stage 0 // Narrative Architecture</p>
        </div>
        <div className="bg-[#0c0c0e] border-2 border-white/10 rounded-3xl p-12 shadow-[0_0_100px_rgba(0,0,0,0.8)] space-y-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <span className="material-symbols-outlined text-[12rem]">auto_awesome</span>
          </div>
          <div className="space-y-8 relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <label className="text-sm font-bold text-slate-200 uppercase tracking-widest flex items-center gap-3">
                <span className="w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                Raw Concept Blueprint
              </label>
              
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-widest mr-2">Episode Count</span>
                <div className="flex bg-black p-1.5 rounded-2xl border-2 border-white/10">
                  {episodeOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setEpisodeCount(opt)}
                      className={`focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 px-6 py-2 rounded-xl text-sm font-bold uppercase tracking-widest transition-all ${
                        episodeCount === opt 
                          ? 'bg-amber-500 text-black shadow-lg' 
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={episodeCount}
                    onChange={(e) => setEpisodeCount(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-16 bg-transparent text-center text-sm font-bold text-white outline-none"
                    title="Custom episode count"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <label className="block space-y-2">
                <span className="block text-xs font-bold text-slate-300 uppercase tracking-widest">Genre</span>
                <select value={genre} onChange={(e) => setGenre(e.target.value)} className="w-full bg-black border-2 border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/60 transition-colors">
                  {GENRE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="block text-xs font-bold text-slate-300 uppercase tracking-widest">Tone</span>
                <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full bg-black border-2 border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/60 transition-colors">
                  {TONE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="block text-xs font-bold text-slate-300 uppercase tracking-widest">Language</span>
                <input value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-black border-2 border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/60 transition-colors" />
              </label>
              <label className="block space-y-2">
                <span className="block text-xs font-bold text-slate-300 uppercase tracking-widest">Aspect</span>
                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as '9:16' | '16:9')} className="w-full bg-black border-2 border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/60 transition-colors">
                  <option value="9:16">9:16 Vertical</option>
                  <option value="16:9">16:9 Widescreen</option>
                </select>
              </label>
              <label className="block space-y-2">
                <span className="block text-xs font-bold text-slate-300 uppercase tracking-widest">Resolution</span>
                <select value={resolution} onChange={(e) => setResolution(e.target.value as '360p' | '720p')} className="w-full bg-black border-2 border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/60 transition-colors">
                  <option value="720p">720p</option>
                  <option value="360p">360p</option>
                </select>
              </label>
            </div>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Inject your core narrative concept here..."
              className="w-full h-48 bg-black/60 border-2 border-white/10 rounded-2xl p-8 text-xl text-white outline-none focus:border-amber-400/50 transition-all resize-none placeholder:text-slate-400 font-medium italic tracking-tight"
            />
          </div>
          {error && (
            <div className="p-6 bg-red-500/10 border-2 border-red-500/20 text-red-400 text-sm uppercase font-bold text-center rounded-2xl tracking-[0.2em] animate-pulse">
              {error}
            </div>
          )}
          <button
            onClick={executeArchitect}
            disabled={isProcessing || !idea.trim()}
            className="w-full py-8 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-900 disabled:text-slate-400 text-black font-bold rounded-3xl transition-all shadow-2xl shadow-amber-900/40 uppercase tracking-[0.2em] text-sm flex flex-col items-center gap-2 group relative overflow-hidden active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <span className="material-symbols-outlined animate-spin text-3xl mb-1">refresh</span>
                <span className="text-sm uppercase tracking-widest font-bold animate-pulse italic">{status || `Synthesizing ${episodeCount} Eps...`}</span>
              </>
            ) : (
              <>
                <span className="text-base">Compile Studio Bible</span>
                <span className="text-xs text-black/70 font-mono tracking-widest font-bold">PHASE_0: INITIALIZE</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};