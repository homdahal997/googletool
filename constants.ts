export const DEFAULT_VIDEO_MODEL = 'Omni 1.1 Flash';
export const DEFAULT_IMAGE_MODEL = '🍌 Nano Banana Pro';
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