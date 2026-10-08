export const DEFAULT_VIDEO_MODEL = 'Omni 1.1 Flash';
export const DEFAULT_IMAGE_MODEL = '🍌 Nano Banana Pro';
export const SHOT_DURATIONS = [4, 6, 8, 10] as const;
export const WORDS_PER_SECOND = 2.5;
export const MAX_REFERENCE_IMAGES = 3;
export const SHOT_SIZES = [
  'Extreme Wide Shot', 'Wide Shot', 'Full Shot', 'Medium Shot', 'Medium Close-Up',
  'Close-Up', 'Extreme Close-Up', 'Over-the-Shoulder', 'Two Shot', 'POV', 'Insert'
];
export const CAMERA_ANGLES = [
  'Eye Level', 'Low Angle', 'High Angle', 'Dutch Angle', "Bird's Eye", 'Worm\'s Eye', 'Profile'
];
export const CAMERA_MOVEMENTS = [
  'Static', 'Slow Push-In', 'Pull-Out', 'Tracking', 'Dolly', 'Pan', 'Tilt',
  'Handheld', 'Steadicam', 'Crane', 'Orbit'
];
export const GENRE_OPTIONS = ['Drama', 'Romance', 'Thriller', 'Crime', 'Mystery', 'Revenge', 'Fantasy', 'Sci-Fi', 'Horror', 'Comedy'];
export const TONE_OPTIONS = ['Gritty', 'Emotional', 'Suspenseful', 'Dark', 'Glamorous', 'Lighthearted', 'Epic'];
export const CREDIT_COSTS = {
  '360p': { 4: 4, 6: 5, 8: 6, 10: 7 },
  '720p': { 4: 7, 6: 10, 8: 12, 10: 15 }
} as const;
/**
 * Calculates credit cost based on duration and resolution.
 */
export const getShotCost = (duration: number, resolution: '360p' | '720p'): number => {
  const table = CREDIT_COSTS[resolution];
  if (duration <= 4) return table[4];
  if (duration <= 6) return table[6];
  if (duration <= 8) return table[8];
  return table[10];
};