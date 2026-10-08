// ===== SERIES-LEVEL TYPES =====
export interface EpisodeSummary {
  episode_number: number;
  title: string;
  synopsis: string;
}
export interface SeriesSynopsis {
  seriesTitle: string;
  story_synopsis: string;
  episodes: EpisodeSummary[];
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
  mediaId?: string;
  base64?: string;
  errorMessage?: string; // Track specific failures
}
// ===== PER-EPISODE PRODUCTION STATE =====
export type EpisodeStage = 'script' | 'characters' | 'locations' | 'render';
export interface EpisodeProduction {
  summary: EpisodeSummary;
  script?: EpisodeScript;
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
  episodes: EpisodeProduction[];
  activeEpisodeIndex: number | null;
  sharedCastRoster: ActorProfile[];
  metadata: {
    language: string;
    aspectRatio: '9:16' | '16:9';
    targetResolution: '360p' | '720p';
  };
}
// ===== UI STAGES =====
export type NodeStage = 'drafting' | 'seeding' | 'scouting' | 'syncing' | 'manifest';
export interface MasterManifest {
  seriesTitle: string;
  episodeNumber: number;
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