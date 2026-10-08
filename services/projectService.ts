import { Flow } from 'flow-sdk';
import { SeriesBible } from '../types';
/**
 * ProjectService handles the local persistence (Export/Import) of the CinemaDraft project state.
 */
export const projectService = {
  /**
   * Exports the current SeriesBible to a JSON file.
   * Uses Blob/FileReader to safely handle large data strings.
   */
  async exportProject(bible: SeriesBible) {
    try {
      const data = JSON.stringify(bible, null, 2);
      const filename = `CinemaDraft_${bible.seriesTitle.replace(/[^a-z0-9]/gi, '_') || 'Project'}.json`;
      
      const blob = new Blob([data], { type: 'application/json' });
      
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      await Flow.download({
        base64,
        mimeType: 'application/json',
        filename
      });
      
      return true;
    } catch (err) {
      console.error('Project export failed:', err);
      return false;
    }
  },
  /**
   * Imports a SeriesBible from a File object.
   */
  async importProject(file: File): Promise<SeriesBible> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = e.target?.result as string;
          const bible = JSON.parse(json) as SeriesBible;
          
          // Basic validation to ensure it looks like a SeriesBible
          if (!bible.seriesTitle || !Array.isArray(bible.episodes)) {
            throw new Error('Invalid Project File: Structure mismatch.');
          }
          
          resolve(bible);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('File reading error.'));
      reader.readAsText(file);
    });
  }
};