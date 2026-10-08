import { Flow } from 'flow-sdk';
import {
  SeriesBible, SeriesStyle, ActorProfile, LocationAsset, ShotPrompt,
  EpisodeProduction, EpisodeContinuity, EpisodeScript
} from '../types';
import { SHOT_DURATIONS, WORDS_PER_SECOND } from '../constants';

/**
 * Shared continuity helpers: model JSON handling, identity matching,
 * story/character/location context for prompts, and shot timing.
 */

export const newId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11);

// ===== MODEL JSON =====
export const parseModelJson = <T>(text: string): T => {
  let clean = text.trim();
  if (clean.includes('```')) clean = clean.replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Model response did not contain JSON.');
  return JSON.parse(clean.substring(start, end + 1)) as T;
};

/** Calls the text model, parses JSON, validates the shape and retries on failure. */
export async function generateJson<T>(
  prompt: string,
  systemInstruction: string,
  validate: (value: T) => boolean,
  retries = 1
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await Flow.generate.text(
        attempt === 0 ? prompt : `${prompt}\n\nYour previous answer was invalid. Return ONLY the complete JSON object matching the schema.`,
        { systemInstruction }
      );
      const parsed = parseModelJson<T>(response.text);
      if (!validate(parsed)) throw new Error('Model response did not match the expected structure.');
      return parsed;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Generation failed.');
}

// ===== IDENTITY MATCHING =====
const TITLE_WORDS = new Set([
  'mr', 'mrs', 'ms', 'miss', 'dr', 'detective', 'det', 'officer', 'captain', 'capt', 'agent',
  'sir', 'madam', 'lady', 'lord', 'professor', 'prof', 'young', 'old', 'the', 'vo', 'os'
]);

const normalizeName = (name: string): string =>
  name.toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w && !TITLE_WORDS.has(w))
    .join(' ');

/** Finds an actor by name or alias, tolerating titles ("Detective Ray") and partial names ("Ray"). */
export const findActor = (roster: ActorProfile[], name?: string): ActorProfile | undefined => {
  if (!name) return undefined;
  const target = normalizeName(name);
  if (!target) return undefined;
  const namesOf = (a: ActorProfile) => [a.name, ...(a.aliases || [])].map(normalizeName).filter(Boolean);
  const exact = roster.find(a => namesOf(a).includes(target));
  if (exact) return exact;
  const tokens = target.split(' ');
  const partial = roster.filter(a => namesOf(a).some(n => {
    const t = n.split(' ');
    return tokens.every(x => t.includes(x)) || t.every(x => tokens.includes(x));
  }));
  return partial.length === 1 ? partial[0] : undefined;
};

export const findLocation = (locations: LocationAsset[], name?: string): LocationAsset | undefined => {
  if (!name) return undefined;
  const target = normalizeName(name);
  if (!target) return undefined;
  const exact = locations.find(l => normalizeName(l.name) === target);
  if (exact) return exact;
  const partial = locations.filter(l => {
    const n = normalizeName(l.name);
    return n.includes(target) || target.includes(n);
  });
  return partial.length === 1 ? partial[0] : undefined;
};

export const resolveSpeaker = (shot: ShotPrompt, actors: ActorProfile[]): ActorProfile | undefined =>
  (shot.speakerActorId && actors.find(a => a.id === shot.speakerActorId)) || findActor(actors, shot.speakerLabel);

/** Actors visible in a shot, speaker first. */
export const resolveShotActors = (shot: ShotPrompt, actors: ActorProfile[]): ActorProfile[] => {
  const speaker = resolveSpeaker(shot, actors);
  const others = (shot.actorIds || [])
    .filter(id => id !== speaker?.id)
    .map(id => actors.find(a => a.id === id))
    .filter((a): a is ActorProfile => !!a);
  return speaker ? [speaker, ...others] : others;
};

// ===== STATE PATCHES (always applied to the latest bible) =====
export const patchEpisode = (prev: SeriesBible, index: number, updates: Partial<EpisodeProduction>): Partial<SeriesBible> => ({
  episodes: prev.episodes.map((ep, i) => (i === index ? { ...ep, ...updates } : ep))
});

export const patchActor = (prev: SeriesBible, id: string, updates: Partial<ActorProfile>): Partial<SeriesBible> => ({
  sharedCastRoster: prev.sharedCastRoster.map(a => (a.id === id ? { ...a, ...updates } : a)),
  episodes: prev.episodes.map(ep => ep.actors.some(a => a.id === id)
    ? { ...ep, actors: ep.actors.map(a => (a.id === id ? { ...a, ...updates } : a)) }
    : ep)
});

export const patchLocation = (prev: SeriesBible, id: string, updates: Partial<LocationAsset>): Partial<SeriesBible> => ({
  sharedLocations: (prev.sharedLocations || []).map(l => (l.id === id ? { ...l, ...updates } : l)),
  episodes: prev.episodes.map(ep => ep.locations.some(l => l.id === id)
    ? { ...ep, locations: ep.locations.map(l => (l.id === id ? { ...l, ...updates } : l)) }
    : ep)
});

// ===== PROMPT CONTEXT =====
export const buildStyleBlock = (style?: SeriesStyle): string =>
  style
    ? `Genre: ${style.genre}. Tone: ${style.tone}. Visual look: ${style.visualLook}. Color palette: ${style.colorPalette}.`
    : '';

export const describeActor = (a: ActorProfile): string => [
  `${a.name}${a.aliases?.length ? ` (also called ${a.aliases.join(', ')})` : ''}`,
  a.role && `role: ${a.role}`,
  a.age && `age: ${a.age}`,
  `appearance: ${a.visualDescription}`,
  a.wardrobe && `signature wardrobe: ${a.wardrobe}`,
  a.personality && `personality: ${a.personality}`,
  a.voiceDescription && `voice: ${a.voiceDescription}`
].filter(Boolean).join('; ');

export const buildCharacterBible = (roster: ActorProfile[]): string =>
  roster.length ? roster.map(a => `- ${describeActor(a)}`).join('\n') : '(no established characters yet)';

export const buildLocationLibrary = (locations: LocationAsset[]): string =>
  locations.length ? locations.map(l => `- ${l.name}: ${l.description}`).join('\n') : '(no established locations yet)';

const DETAILED_RECAP_WINDOW = 12;

/** "Previously on" context: every prior episode, plus the exact hand-off from the previous one. */
export const buildPreviouslyOn = (bible: SeriesBible, episodeIndex: number): string => {
  const prior = bible.episodes.slice(0, episodeIndex);
  if (prior.length === 0) {
    return 'This is the FIRST episode. Establish the world, the protagonist, their desire and the central conflict within the first seconds.';
  }
  const detailedFrom = Math.max(0, prior.length - DETAILED_RECAP_WINDOW);
  const lines = prior.map((ep, i) => {
    const text = i >= detailedFrom && ep.continuity ? ep.continuity.recap : ep.summary.synopsis;
    return `Ep ${ep.summary.episode_number} "${ep.summary.title}": ${text}`;
  });
  const prev = prior[prior.length - 1];
  const sections = [`STORY SO FAR:\n${lines.join('\n')}`];
  if (prev.continuity) {
    sections.push(
      `WHERE EPISODE ${prev.summary.episode_number} ENDED:\n${prev.continuity.endingState}\n` +
      `Character states: ${prev.continuity.characterStates}\n` +
      `Open threads: ${prev.continuity.openThreads.join('; ') || 'none'}\n` +
      `Cliffhanger to pick up immediately: ${prev.continuity.cliffhanger}`
    );
  } else if (prev.summary.cliffhanger) {
    sections.push(`Cliffhanger to pick up immediately: ${prev.summary.cliffhanger}`);
  }
  if (prev.script?.script_content) {
    sections.push(`FINAL PAGE OF EPISODE ${prev.summary.episode_number} SCRIPT (continue seamlessly from here):\n${prev.script.script_content.slice(-1500)}`);
  }
  return sections.join('\n\n');
};

export const CONTINUITY_SCHEMA = `{
    "recap": "2-3 sentence summary of what happened in this episode",
    "endingState": "Exactly where and how the episode ends: who is present, location, emotional state",
    "characterStates": "Per character: what they now know, want, feel, plus any wardrobe/injury changes",
    "openThreads": ["Every unresolved story thread so far, including older ones still open"],
    "cliffhanger": "The final unresolved moment the next episode must pick up"
  }`;

export const isContinuity = (c: any): c is EpisodeContinuity =>
  !!c && typeof c.recap === 'string' && typeof c.endingState === 'string' && typeof c.cliffhanger === 'string';

export const normalizeContinuity = (c: any): EpisodeContinuity => ({
  recap: String(c.recap || ''),
  endingState: String(c.endingState || ''),
  characterStates: String(c.characterStates || ''),
  openThreads: Array.isArray(c.openThreads) ? c.openThreads.map(String) : [],
  cliffhanger: String(c.cliffhanger || '')
});

/** Re-derives the continuity record from a (possibly hand-edited) script. */
export const generateContinuity = async (bible: SeriesBible, episodeIndex: number, script: EpisodeScript): Promise<EpisodeContinuity> => {
  const prompt = `[CONTINUITY_SUPERVISOR]
Series: ${bible.seriesTitle}
${buildPreviouslyOn(bible, episodeIndex)}

EPISODE ${script.episode_number} SCRIPT:
"""${script.script_content}"""

Write the continuity record for this episode. Output ONLY JSON:
${CONTINUITY_SCHEMA}`;
  const parsed = await generateJson<any>(prompt, 'You are the Script Supervisor responsible for story continuity. Respond ONLY with valid JSON.', isContinuity);
  return normalizeContinuity(parsed);
};

// ===== SHOT TIMING =====
const MAX_WORDS_PER_SHOT = Math.floor((SHOT_DURATIONS[SHOT_DURATIONS.length - 1] - 1) * WORDS_PER_SECOND);

const countWords = (text: string): number => {
  const t = text.trim();
  if (!t) return 0;
  const words = t.split(/\s+/).length;
  // Scripts without spaces (e.g. CJK) are approximated by character count.
  return words === 1 && t.length > 12 ? Math.ceil(t.length / 3) : words;
};

const pickDuration = (seconds: number): ShotPrompt['durationSeconds'] =>
  SHOT_DURATIONS.find(d => d >= seconds) ?? SHOT_DURATIONS[SHOT_DURATIONS.length - 1];

const splitDialogue = (text: string): string[] => {
  const sentences = text.match(/[^.!?。！？]+[.!?。！？]*/g) || [text];
  const chunks: string[] = [];
  let current = '';
  const pushWords = (sentence: string) => {
    const words = sentence.trim().split(/\s+/);
    for (let i = 0; i < words.length; i += MAX_WORDS_PER_SHOT) chunks.push(words.slice(i, i + MAX_WORDS_PER_SHOT).join(' '));
  };
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence.trim()}` : sentence.trim();
    if (countWords(candidate) <= MAX_WORDS_PER_SHOT) { current = candidate; continue; }
    if (current) chunks.push(current);
    current = '';
    if (countWords(sentence) > MAX_WORDS_PER_SHOT) pushWords(sentence);
    else current = sentence.trim();
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text];
};

/** Ensures each line can be spoken in its shot: lengthens shots, and splits over-long lines into coverage shots. */
export const fitDialogueToShots = (shots: ShotPrompt[]): ShotPrompt[] => {
  const out: ShotPrompt[] = [];
  for (const shot of shots) {
    const dialogue = shot.dialogue || '';
    const chunks = countWords(dialogue) > MAX_WORDS_PER_SHOT ? splitDialogue(dialogue) : [dialogue];
    chunks.forEach((chunk, i) => {
      const needed = countWords(chunk) / WORDS_PER_SECOND + 1;
      const base: ShotPrompt = i === 0 ? shot : {
        ...shot,
        id: newId(),
        shotSize: shot.shotSize === 'Close-Up' ? 'Medium Close-Up' : 'Close-Up',
        cameraMovement: 'Static',
        action: `${shot.speakerLabel} continues speaking; hold on their reaction and eyes.`,
        mediaId: undefined,
        base64: undefined,
        errorMessage: undefined
      };
      out.push({ ...base, dialogue: chunk, durationSeconds: pickDuration(Math.max(needed, i === 0 ? shot.durationSeconds : 4)) });
    });
  }
  return out.map((s, i) => ({ ...s, index: i + 1 }));
};

// ===== RENDER PROMPTS =====
const STYLIZED_LOOK = /\b(anim(?:ation|ated|e)|cartoon|cel[- ]?shad\w*|illustrat\w*|comic|painterly|watercolou?r|3d|pixar|claymation|stop[- ]motion|styli[sz]ed|manga|sketch\w*|cgi)\b/i;

/** True when the chosen visual look is deliberately non-photographic, so "photorealistic" must not be forced. */
export const isStylizedLook = (style?: SeriesStyle): boolean => !!style && STYLIZED_LOOK.test(style.visualLook || '');

export const buildPortraitPrompt = (actor: ActorProfile, style?: SeriesStyle): string =>
  `Character reference portrait of ${actor.name}. ${actor.age ? `Age ${actor.age}. ` : ''}${actor.visualDescription}. ` +
  `${actor.wardrobe ? `Wearing ${actor.wardrobe}. ` : ''}Front-facing head-and-shoulders, neutral expression, soft even studio lighting, ` +
  `plain neutral background, sharp facial detail${isStylizedLook(style) ? '' : ', photorealistic'}.${style ? ` ${style.visualLook}.` : ''}`;

export const buildLocationPrompt = (location: LocationAsset, style?: SeriesStyle): string =>
  `${location.image_prompt}. Establishing wide shot of the empty set, no people, cinematic composition.` +
  `${style ? ` ${style.visualLook}. Color palette: ${style.colorPalette}.` : ''}`;

export const buildShotPrompt = (
  shot: ShotPrompt,
  ctx: { actors: ActorProfile[]; locations: LocationAsset[]; style?: SeriesStyle; language: string; aspectRatio: '9:16' | '16:9' }
): string => {
  const speaker = resolveSpeaker(shot, ctx.actors);
  const inFrame = resolveShotActors(shot, ctx.actors);
  const location = ctx.locations.find(l => l.id === shot.locationId);
  const camera = [shot.shotSize, shot.cameraAngle, shot.cameraMovement, shot.lens].filter(Boolean).join(', ');
  return [
    ctx.style && `STYLE: ${buildStyleBlock(ctx.style)} ${isStylizedLook(ctx.style) ? 'Keep this exact visual style' : 'Photorealistic live-action cinema'}, matching every other shot in the series.`,
    `CAMERA: ${camera || 'Cinematic framing'}.`,
    location && `LOCATION: ${location.name} — ${location.description}.`,
    shot.lighting && `LIGHTING: ${shot.lighting}.`,
    inFrame.length > 0 && `CHARACTERS IN FRAME: ${inFrame.map(a => `${a.name} (${a.visualDescription}${a.wardrobe ? `; wearing ${a.wardrobe}` : ''})`).join(' | ')}.`,
    `ACTION: ${shot.visualPrompt}${shot.action && shot.action !== shot.visualPrompt ? ` ${shot.action}` : ''}`,
    dialogueLine(shot, speaker, ctx.language),
    `FORMAT: ${ctx.aspectRatio === '9:16' ? 'Vertical 9:16' : 'Widescreen 16:9'}. No subtitles, captions or on-screen text.`
  ].filter(Boolean).join('\n');
};

const dialogueLine = (shot: ShotPrompt, speaker: ActorProfile | undefined, language: string): string | false => {
  if (!shot.dialogue?.trim()) return 'DIALOGUE: none (silent shot, ambient sound only).';
  const voice = speaker?.voiceDescription ? ` [voice: ${speaker.voiceDescription}]` : '';
  const delivery = shot.performance ? ` [delivery: ${shot.performance}]` : '';
  return `DIALOGUE (${language}): ${speaker?.name || shot.speakerLabel}${voice}${delivery} says: "${shot.dialogue}"`;
};

// ===== FINAL CUT (stitching) =====
export const getOutputSize = (aspectRatio: '9:16' | '16:9'): { width: number; height: number } =>
  aspectRatio === '9:16' ? { width: 720, height: 1280 } : { width: 1280, height: 720 };

export interface ClipInfo { hasAudio: boolean; duration?: number }

const findAscii = (bytes: Uint8Array, tag: string, from = 0): number => {
  const t = Array.from(tag).map(c => c.charCodeAt(0));
  outer: for (let i = from; i <= bytes.length - t.length; i++) {
    if (bytes[i] !== t[0]) continue;
    for (let j = 1; j < t.length; j++) if (bytes[i + j] !== t[j]) continue outer;
    return i;
  }
  return -1;
};

/** Reads an MP4's header (moov box) to learn whether it has an audio track and how long it is. */
export const inspectMp4 = (bytes: Uint8Array): ClipInfo => {
  const moovTag = findAscii(bytes, 'moov');
  if (moovTag < 4) return { hasAudio: true };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const size = view.getUint32(moovTag - 4);
  const moov = bytes.subarray(moovTag, size > 8 ? Math.min(bytes.length, moovTag - 4 + size) : bytes.length);
  const hasAudio = findAscii(moov, 'soun') >= 0;
  let duration: number | undefined;
  const mvhd = findAscii(moov, 'mvhd');
  if (mvhd >= 0) {
    const v = new DataView(moov.buffer, moov.byteOffset, moov.byteLength);
    const p = mvhd + 4;
    const version = moov[p];
    const timescale = version === 1 ? v.getUint32(p + 20) : v.getUint32(p + 12);
    const ticks = version === 1 ? v.getUint32(p + 24) * 2 ** 32 + v.getUint32(p + 28) : v.getUint32(p + 16);
    if (timescale > 0 && ticks > 0) duration = ticks / timescale;
  }
  return { hasAudio, duration };
};

export interface StitchClip { name: string; hasAudio: boolean; duration: number }

const AUDIO_RATE = 48000;
const CUT_FADE = 0.02;
const t3 = (n: number): string => n.toFixed(3);

/** One ffmpeg pass: every clip to the same size/fps/audio format, 20 ms audio fades at each cut, silent clips get silence. */
export const buildStitchArgs = (clips: StitchClip[], size: { width: number; height: number }): string[] => {
  const { width: w, height: h } = size;
  const parts = clips.map((c, i) => {
    const d = Math.max(0.5, c.duration);
    const video = `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p,` +
      `tpad=stop_mode=clone:stop_duration=2,trim=duration=${t3(d)},setpts=PTS-STARTPTS[v${i}]`;
    const audio = c.hasAudio
      ? `[${i}:a]aresample=${AUDIO_RATE},aformat=channel_layouts=stereo,apad,atrim=duration=${t3(d)},asetpts=PTS-STARTPTS,` +
        `afade=t=in:d=${CUT_FADE},afade=t=out:st=${t3(d - CUT_FADE)}:d=${CUT_FADE}[a${i}]`
      : `anullsrc=r=${AUDIO_RATE}:cl=stereo,atrim=duration=${t3(d)},asetpts=PTS-STARTPTS[a${i}]`;
    return `${video};${audio}`;
  });
  const concat = clips.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${clips.length}:v=1:a=1[outv][outa]`;
  return [
    ...clips.flatMap(c => ['-i', c.name]),
    '-filter_complex', `${parts.join(';')};${concat}`,
    '-map', '[outv]', '-map', '[outa]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', String(AUDIO_RATE),
    '-movflags', '+faststart', '-y', 'out.mp4'
  ];
};

export const MUSIC_VOLUME = 0.22;

/** Mixes a looping soundtrack under the dialogue: quiet, ducked while people speak, faded in and out. */
export const buildMusicArgs = (totalSeconds: number, musicFile: string): string[] => {
  const fadeOut = Math.min(2, totalSeconds);
  const graph =
    `[0:a]aresample=${AUDIO_RATE},aformat=channel_layouts=stereo,asplit=2[dlg][key];` +
    `[1:a]aresample=${AUDIO_RATE},aformat=channel_layouts=stereo,atrim=duration=${t3(totalSeconds)},asetpts=PTS-STARTPTS,` +
    `afade=t=in:d=1,afade=t=out:st=${t3(Math.max(0, totalSeconds - fadeOut))}:d=${t3(fadeOut)},volume=${MUSIC_VOLUME}[bed];` +
    `[bed][key]sidechaincompress=threshold=0.03:ratio=8:attack=30:release=600[ducked];` +
    `[dlg][ducked]amix=inputs=2:duration=first:normalize=0[a]`;
  return [
    '-i', 'out.mp4', '-stream_loop', '-1', '-i', musicFile,
    '-filter_complex', graph,
    '-map', '0:v', '-map', '[a]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', String(AUDIO_RATE),
    '-movflags', '+faststart', '-y', 'master.mp4'
  ];
};
