import React, { useState, useMemo, useEffect } from 'react';
import { Flow } from 'flow-sdk';
import { MasterManifest, ShotPrompt, NodeStage } from '../types';
import { DEFAULT_VIDEO_MODEL, getShotCost } from '../constants';
import { ffmpegService } from '../services/ffmpegService';
interface ManifestNodeProps {
  manifest: MasterManifest;
  onNavigate: (stage: NodeStage) => void;
  onUpdateTimeline?: (timeline: ShotPrompt[]) => void;
  onSaveMaster?: (base64: string, mediaId: string) => void;
}
export const ManifestNode: React.FC<ManifestNodeProps> = ({ manifest, onNavigate, onUpdateTimeline, onSaveMaster }) => {
  const [timeline, setTimeline] = useState<ShotPrompt[]>(manifest.timeline || []);
  const [renderingIndex, setRenderingIndex] = useState<number | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [stitching, setStitching] = useState(false);
  const [ffmpegStatus, setFfmpegStatus] = useState<string>('');
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [masterPreview, setMasterPreview] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'done' | 'error'>('idle');
  useEffect(() => {
    if (isApproved && !ffmpegLoaded) {
      ffmpegService.load(msg => setFfmpegStatus(msg)).then(() => setFfmpegLoaded(true));
    }
  }, [isApproved, ffmpegLoaded]);
  const totalCredits = useMemo(() => {
    const shots = manifest.timeline || [];
    return shots.reduce((sum, shot) => {
      return sum + getShotCost(shot.durationSeconds, manifest.metadata.targetResolution);
    }, 0);
  }, [manifest.timeline, manifest.metadata.targetResolution]);
  const getActorForShot = (shot: ShotPrompt) => {
    return (manifest.actors || []).find(a => 
      a.name.trim().toLowerCase() === shot.speakerLabel.trim().toLowerCase()
    );
  };
  const updateAndPersistTimeline = (newTimeline: ShotPrompt[]) => {
    setTimeline(newTimeline);
    onUpdateTimeline?.(newTimeline);
  };
  const executeRender = async (shotIndex: number) => {
    const shot = timeline[shotIndex];
    if (!shot) return;
    setRenderingIndex(shotIndex);
    
    // Reset error for this shot
    const resetTimeline = [...timeline];
    resetTimeline[shotIndex] = { ...shot, errorMessage: undefined };
    setTimeline(resetTimeline);
    
    try {
      const actor = getActorForShot(shot);
      const location = (manifest.locations || []).find(l => l.id === shot.locationId);
      
      const audioReferenceMediaIds: string[] = [];
      if (actor?.voiceId) audioReferenceMediaIds.push(actor.voiceId);
      if (manifest.backgroundMusicId) audioReferenceMediaIds.push(manifest.backgroundMusicId);
      const referenceImageMediaIds: string[] = [];
      if (actor?.mediaId) referenceImageMediaIds.push(actor.mediaId);
      if (location?.mediaId) referenceImageMediaIds.push(location.mediaId);
      // SDK R2V Constraint Check: Audio references MUST be paired with image references or source video
      const hasAudio = audioReferenceMediaIds.length > 0;
      const hasImages = referenceImageMediaIds.length > 0;
      const dialogueContext = shot.dialogue ? `. Character ${shot.speakerLabel} is speaking: "${shot.dialogue}".` : '';
      const result = await Flow.generate.video({
        prompt: `${shot.visualPrompt}${dialogueContext} Cinematic high-stakes drama, set: ${location?.name || 'studio'}, professional focus, 8k resolution.`,
        modelDisplayName: DEFAULT_VIDEO_MODEL,
        aspectRatio: manifest.metadata.aspectRatio,
        resolution: manifest.metadata.targetResolution,
        // Only provide audio if we have images to pair with, otherwise SDK will throw validation error
        referenceImageMediaIds: hasImages ? referenceImageMediaIds : undefined,
        audioReferenceMediaIds: (hasAudio && hasImages) ? audioReferenceMediaIds : undefined,
        durationSeconds: shot.durationSeconds
      });
      const updatedTimeline = [...timeline];
      updatedTimeline[shotIndex] = { ...shot, mediaId: result.mediaId, base64: result.base64, errorMessage: undefined };
      updateAndPersistTimeline(updatedTimeline);
    } catch (err) {
      console.error('Shot render failed:', err);
      const msg = err instanceof Error ? err.message : 'Unknown Synthesis Error';
      const failedTimeline = [...timeline];
      failedTimeline[shotIndex] = { ...shot, errorMessage: msg };
      updateAndPersistTimeline(failedTimeline);
    } finally {
      setRenderingIndex(null);
    }
  };
  const handleManualFix = async (shotIndex: number) => {
    try {
      const media = await Flow.media.select({ filter: 'video' });
      const updatedTimeline = [...timeline];
      updatedTimeline[shotIndex] = { 
        ...updatedTimeline[shotIndex], 
        mediaId: media.mediaId, 
        base64: media.base64,
        errorMessage: undefined
      };
      updateAndPersistTimeline(updatedTimeline);
    } catch (err) {
      console.error('Manual fix failed:', err);
    }
  };
  const stitchFinalVideo = async () => {
    const renderedShots = timeline.filter(s => !!s.base64);
    if (renderedShots.length === 0) return;
    setStitching(true);
    setFfmpegStatus('Assembling Production Master...');
    try {
      const fileNames: string[] = [];
      for (let i = 0; i < renderedShots.length; i++) {
        const shot = renderedShots[i];
        const fileName = `shot_${i}.mp4`;
        fileNames.push(fileName);
        const bytes = Uint8Array.from(atob(shot.base64!), c => c.charCodeAt(0));
        await ffmpegService.writeFile(fileName, bytes);
      }
      const inputArgs: string[] = [];
      fileNames.forEach(name => inputArgs.push('-i', name));
      const filterInputs = fileNames.map((_, i) => `[${i}:v][${i}:a]`).join('');
      const filterComplex = `${filterInputs}concat=n=${fileNames.length}:v=1:a=1[outv][outa]`;
      await ffmpegService.exec([
        ...inputArgs,
        '-filter_complex', filterComplex,
        '-map', '[outv]', '-map', '[outa]',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
        '-c:a', 'aac', '-pix_fmt', 'yuv420p', '-movflags', 'faststart', '-y', 'output.mp4',
      ]);
      const outputData = await ffmpegService.readFile('output.mp4') as Uint8Array;
      
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(new Blob([outputData], { type: 'video/mp4' }));
      });
      const saved = await Flow.save({
        base64: base64Data,
        mimeType: 'video/mp4',
        name: `CINEMADRAFT_EP${manifest.episodeNumber}_MASTER`
      });
      onSaveMaster?.(base64Data, saved.mediaId);
      setMasterPreview(base64Data);
      setFfmpegStatus('Master Complete and Saved to Gallery.');
      for (const name of fileNames) await ffmpegService.deleteFile(name);
      await ffmpegService.deleteFile('output.mp4');
    } catch (err) {
      console.error('Stitching failed:', err);
      setFfmpegStatus('Stitch Engine Failure.');
    } finally {
      setStitching(false);
    }
  };
  const downloadMaster = async () => {
    if (!masterPreview) return;
    setDownloadStatus('downloading');
    try {
      await Flow.download({
        base64: masterPreview,
        mimeType: 'video/mp4',
        filename: `CinemaDraft_Ep${manifest.episodeNumber}_Master.mp4`
      });
      setDownloadStatus('done');
      setTimeout(() => setDownloadStatus('idle'), 3000);
    } catch (err) {
      console.error('Download failed:', err);
      setDownloadStatus('error');
      setTimeout(() => setDownloadStatus('idle'), 3000);
    }
  };
  const downloadLabel = {
    idle: 'Export Master',
    downloading: 'Exporting...',
    done: 'Export Complete ✓',
    error: 'Export Failed'
  }[downloadStatus];
  if (!isApproved) {
    return (
      <div className="h-full flex items-center justify-center bg-[#050505] p-10">
        <div className="max-w-xl w-full bg-[#0c0c0e] border-2 border-amber-500/20 rounded-[4rem] p-16 text-center space-y-12 shadow-[0_0_150px_rgba(245,158,11,0.1)] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <span className="material-symbols-outlined text-[15rem]">receipt_long</span>
          </div>
          <div className="w-28 h-28 bg-amber-500/10 border-2 border-amber-500/20 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner">
            <span className="material-symbols-outlined text-amber-500 text-6xl">payments</span>
          </div>
          <div className="space-y-4">
            <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">Production Budget</h2>
            <p className="text-xs text-slate-500 mt-4 uppercase tracking-[0.4em] leading-relaxed font-bold">
              Episode {manifest.episodeNumber} requires <span className="text-amber-400 font-black underline underline-offset-8 decoration-2">{totalCredits} credits</span> for full kinematic rendering.
            </p>
          </div>
          <button 
            onClick={() => setIsApproved(true)} 
            className="w-full py-8 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-[2rem] uppercase tracking-[0.5em] text-sm transition-all active:scale-95 shadow-2xl shadow-amber-900/50"
          >
            Authorize Rendering
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="h-full flex flex-col bg-[#050505] overflow-hidden">
      <div className="px-10 py-8 border-b-2 border-white/10 flex justify-between items-center bg-[#0c0c0e] z-20">
        <div className="flex items-center gap-6">
           <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-black font-black shadow-lg">
             {manifest.episodeNumber}
           </div>
           <div>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">Rendering Console</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.5em] font-black mt-2">Active Assembly: {manifest.seriesTitle}</p>
          </div>
        </div>
        
        <div className="flex gap-4">
          {timeline.length > 0 && timeline.every(s => !!s.base64) && !masterPreview && (
            <button 
              onClick={stitchFinalVideo} 
              disabled={stitching} 
              className="px-10 py-4 bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-black uppercase tracking-[0.4em] rounded-[1.5rem] shadow-2xl shadow-emerald-900/30 flex items-center gap-4 transition-all"
            >
              <span className="material-symbols-outlined text-2xl">{stitching ? 'sync' : 'auto_fix_high'}</span>
              {stitching ? 'Stitching Master...' : 'Assemble Episode Master'}
            </button>
          )}
          {masterPreview && (
            <div className="flex gap-4">
              <button 
                onClick={downloadMaster}
                disabled={downloadStatus !== 'idle'}
                className={`px-8 py-4 text-black text-[10px] font-black uppercase tracking-[0.4em] rounded-[1.5rem] shadow-2xl flex items-center gap-3 transition-all ${
                  downloadStatus === 'error' ? 'bg-red-500' : 
                  downloadStatus === 'done' ? 'bg-emerald-500' : 'bg-amber-500 hover:bg-amber-400 shadow-amber-900/30'
                }`}
              >
                <span className="material-symbols-outlined">
                  {downloadStatus === 'error' ? 'report' : downloadStatus === 'done' ? 'check_circle' : 'download'}
                </span>
                {downloadLabel}
              </button>
              <button 
                onClick={() => setMasterPreview(null)} 
                className="px-8 py-4 bg-white/5 text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] rounded-[1.5rem] border-2 border-white/10 hover:text-white hover:bg-white/10 transition-all"
              >
                Refine Shots
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-12 no-scrollbar relative">
        {masterPreview ? (
          <div className="h-full flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in duration-1000">
            <div className="w-full max-w-sm aspect-[9/16] bg-black rounded-[5rem] border-4 border-amber-500/40 shadow-[0_0_150px_rgba(245,158,11,0.15)] overflow-hidden relative group">
              <video 
                src={`data:video/mp4;base64,${masterPreview}`} 
                className="w-full h-full object-cover" 
                controls 
                autoPlay 
              />
              <div className="absolute top-12 left-0 right-0 text-center pointer-events-none px-10">
                 <span className="bg-emerald-500 text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] shadow-2xl border-2 border-black/20">Final Release Ready</span>
              </div>
            </div>
            <div className="mt-12 text-center space-y-4">
               <p className="text-xs text-slate-500 uppercase tracking-[1em] font-black italic">End of Production Cycle</p>
               <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter">Episode {manifest.episodeNumber} Manifested</h3>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12">
            {timeline.map((shot, idx) => {
              const actor = getActorForShot(shot);
              const hasVoice = !!actor?.voiceId;
              return (
                <div key={shot.id} className="bg-[#0c0c0e] border-2 border-white/5 rounded-[4rem] overflow-hidden group hover:border-amber-400/40 transition-all shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                  <div className="aspect-[9/16] bg-black relative overflow-hidden">
                    {shot.base64 ? (
                      <video src={`data:video/mp4;base64,${shot.base64}`} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-10 text-center bg-[radial-gradient(circle_at_50%_50%,_rgba(255,255,255,0.03)_0%,_transparent_100%)]">
                         {renderingIndex === idx ? (
                           <div className="flex flex-col items-center gap-8">
                             <div className="w-20 h-20 border-4 border-amber-500/10 border-t-amber-400 rounded-full animate-spin shadow-[0_0_30px_rgba(245,158,11,0.3)]" />
                             <span className="text-xs font-mono font-black text-amber-400 uppercase tracking-[0.5em] animate-pulse">Encoding Unit_{idx+1}</span>
                           </div>
                         ) : (
                           <div className="space-y-6 opacity-20">
                              <span className="material-symbols-outlined text-8xl text-white">movie</span>
                              <p className="text-[10px] uppercase tracking-[0.4em] text-white font-black">Awaiting Synthesis</p>
                           </div>
                         )}
                      </div>
                    )}
                    
                    {/* Dialogue Overlay */}
                    <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black via-black/80 to-transparent">
                       <div className="space-y-2">
                          <div className="flex items-center gap-2">
                             <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">{shot.speakerLabel}</span>
                             <div className="h-[1px] flex-1 bg-amber-500/30" />
                             {hasVoice && (
                               <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-md">
                                 <span className="material-symbols-outlined text-[10px] text-emerald-400 font-bold">mic</span>
                                 <span className="text-[7px] font-black text-emerald-400 uppercase tracking-tighter">Vocal_Sync</span>
                               </div>
                             )}
                          </div>
                          <p className="text-[11px] text-white font-medium italic leading-snug line-clamp-2">"{shot.dialogue || 'Cinematic Beat'}"</p>
                       </div>
                    </div>
                    <div className="absolute top-8 left-8 bg-black/90 px-5 py-2 rounded-2xl text-[10px] font-black text-white uppercase border-2 border-white/10 shadow-2xl backdrop-blur-2xl">Unit_{String(idx + 1).padStart(2, '0')}</div>
                    
                    {shot.errorMessage && (
                      <div className="absolute inset-0 bg-red-600/60 backdrop-blur-xl flex items-center justify-center p-10 text-center z-30 animate-in fade-in duration-300">
                         <div className="space-y-6">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30">
                              <span className="material-symbols-outlined text-white text-4xl">warning</span>
                            </div>
                            <div className="space-y-3">
                              <p className="text-sm font-black text-white uppercase tracking-[0.2em]">Synthesis Error</p>
                              <div className="max-h-[100px] overflow-y-auto px-4">
                                <p className="text-[9px] text-white/90 font-mono leading-relaxed uppercase tracking-widest bg-black/40 p-3 rounded-xl border border-white/10">
                                  {shot.errorMessage}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col gap-3 pt-4">
                              <button 
                                onClick={() => executeRender(idx)}
                                className="w-full py-4 bg-white text-black text-[10px] font-black uppercase tracking-[0.4em] rounded-2xl hover:bg-slate-100 transition-all active:scale-95 shadow-xl"
                              >
                                Retry Render
                              </button>
                              <button 
                                onClick={() => handleManualFix(idx)}
                                className="w-full py-4 bg-black/40 border border-white/30 text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-2xl hover:bg-black/60 transition-all flex items-center justify-center gap-3 active:scale-95"
                              >
                                <span className="material-symbols-outlined text-base">upload_file</span>
                                Manual Fix
                              </button>
                            </div>
                         </div>
                      </div>
                    )}
                  </div>
                  <div className="p-8 space-y-6">
                    <div className="flex justify-between items-center px-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{shot.durationSeconds}S Duration</span>
                      <span className="text-[10px] font-mono font-bold text-amber-500/50 uppercase tracking-tighter">ID: {shot.id.slice(0,6)}</span>
                    </div>
                    <button 
                      onClick={() => executeRender(idx)} 
                      disabled={renderingIndex !== null || stitching} 
                      className={`w-full py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] transition-all active:scale-95 ${
                        shot.base64 
                          ? 'bg-white/5 text-slate-400 border-2 border-white/10 hover:bg-white/10 hover:text-white' 
                          : 'bg-amber-500 hover:bg-amber-400 text-black shadow-2xl shadow-amber-900/40'
                      }`}
                    >
                      {shot.base64 ? 'Refine Visual' : 'Execute Render'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {ffmpegStatus && (
        <div className="h-16 bg-[#0a0a0a] border-t-2 border-white/10 flex items-center px-12 relative overflow-hidden">
           <div className="absolute inset-0 bg-amber-500/5 animate-pulse pointer-events-none" />
           <div className="flex items-center gap-6 relative z-10">
             <div className="w-3 h-3 bg-amber-400 rounded-full animate-ping shadow-[0_0_15px_rgba(245,158,11,1)]" />
             <span className="text-xs font-mono font-black text-amber-400 uppercase tracking-widest italic">{ffmpegStatus}</span>
           </div>
        </div>
      )}
    </div>
  );
};