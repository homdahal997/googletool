// ===== SERIES-LEVEL TYPES =====
export interface EpisodeSummary {
  episode_number: number;
  title: string;
  synopsis: string;
  hook?: string;
  cliffhanger?: string;
}
export interface SeriesSynopsis {
  seriesTitle: string;
  story_synopsis: string;
  episodes: EpisodeSummary[];
}
// ===== SERIES BIBLE FOUNDATION =====
export interface SeriesStyle {
  genre: string;
  tone: string;
  visualLook: string;
  colorPalette: string;
}
export interface SeriesCharacterSpec {
  name: string;
  aliases?: string[];
  role: string;
  age: string;
  appearance: string;
  wardrobe: string;
  personality: string;
  voice: string;
}
export interface SeriesLocationSpec {
  name: string;
  description: string;
  image_prompt: string;
}
export interface SeriesFoundation {
  seriesTitle: string;
  logline: string;
  story_synopsis: string;
  season_arc: string[];
  style: Pick<SeriesStyle, 'visualLook' | 'colorPalette'>;
  characters: SeriesCharacterSpec[];
  locations: SeriesLocationSpec[];
}
// ===== PHASE 2: SCRIPTWRITING =====
export interface EpisodeScript {
  episode_number: number;
  scene_header: string;
  cast_list: string[];
  script_content: string;
}
// ===== PHASE 3: CHARACTER & LOCATION ASSETS =====
export interface CharacterAsset {
  name: string;
  image_prompt: string;
}
export interface LocationAsset {
  id: string;
  name: string;
  description: string;
  image_prompt: string;
  mediaId?: string;
  base64?: string;
  imageStale?: boolean;
}
export interface CharacterAssetResponse {
  characters: CharacterAsset[];
}
export interface LocationAssetResponse {
  locations: Array<{ name: string; description: string; image_prompt: string }>;
}
// ===== APPLICATION-LEVEL ACTOR =====
export interface ActorProfile {
  id: string;
  name: string;
  visualDescription: string;
  mediaId?: string;
  base64?: string;
  voiceId?: string;
  voiceReferenceName?: string;
  aliases?: string[];
  role?: string;
  age?: string;
  wardrobe?: string;
  personality?: string;
  voiceDescription?: string;
  imageStale?: boolean;
}
// ===== DERIVED SHOT =====
export interface ShotPrompt {
  id: string;
  index: number;
  visualPrompt: string;
  dialogue: string;
  speakerLabel: string;
  durationSeconds: 4 | 6 | 8 | 10;
  locationId?: string; 
  sceneNumber?: number;
  speakerActorId?: string;
  actorIds?: string[];
  shotSize?: string;
  cameraAngle?: string;
  cameraMovement?: string;
  lens?: string;
  lighting?: string;
  action?: string;
  performance?: string;
  mediaId?: string;
  base64?: string;
  errorMessage?: string; // Track specific failures
}
// ===== PER-EPISODE PRODUCTION STATE =====
export type EpisodeStage = 'script' | 'characters' | 'locations' | 'render';
export interface EpisodeContinuity {
  recap: string;
  endingState: string;
  characterStates: string;
  openThreads: string[];
  cliffhanger: string;
}
export interface EpisodeProduction {
  summary: EpisodeSummary;
  script?: EpisodeScript;
  continuity?: EpisodeContinuity;
  actors: ActorProfile[];
  locations: LocationAsset[];
  timeline: ShotPrompt[];
  backgroundMusicId?: string;
  soundtrackTitle?: string;
  masterMediaId?: string;
  masterBase64?: string;
  stage: EpisodeStage;
  stageStatus: Record<EpisodeStage, 'idle' | 'processing' | 'completed' | 'error'>;
}
// ===== SERIES BIBLE =====
export interface SeriesBible {
  rawIdea: string;
  story_synopsis: string;
  seriesTitle: string;
  logline?: string;
  seasonArc?: string[];
  style?: SeriesStyle;
  episodes: EpisodeProduction[];
  activeEpisodeIndex: number | null;
  sharedCastRoster: ActorProfile[];
  sharedLocations?: LocationAsset[];
  metadata: {
    language: string;
    aspectRatio: '9:16' | '16:9';
    targetResolution: '360p' | '720p';
  };
}
// ===== UI STAGES =====
export type NodeStage = 'drafting' | 'seeding' | 'scouting' | 'syncing' | 'manifest';
export type BibleUpdater = (prev: SeriesBible) => Partial<SeriesBible>;
export interface MasterManifest {
  seriesTitle: string;
  episodeNumber: number;
  style?: SeriesStyle;
  actors: ActorProfile[];
  locations: LocationAsset[];
  timeline: ShotPrompt[];
  backgroundMusicId?: string;
  soundtrackTitle?: string;
  metadata: {
    language: string;
    aspectRatio: '9:16' | '16:9';
    targetResolution: '360p' | '720p';
  };
}