import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Flow } from 'flow-sdk';
import { MasterManifest, ShotPrompt, NodeStage, EpisodeProduction } from '../types';
import { DEFAULT_VIDEO_MODEL, getShotCost } from '../constants';
import { ffmpegService } from '../services/ffmpegService';
interface ManifestNodeProps {
  manifest: MasterManifest;
  onNavigate: (stage: NodeStage) => void;
  onUpdateTimeline?: (timeline: ShotPrompt[]) => void;
  onUpdateEpisode?: (updates: Partial<EpisodeProduction>) => void;
  onSaveMaster?: (base64: string, mediaId: string) => void;
}
const PlayOverlay: React.FC<{ videoRef: React.RefObject<HTMLVideoElement | null> }> = ({ videoRef }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    setIsPlaying(!video.paused);
    return () => { video.removeEventListener('play', onPlay); video.removeEventListener('pause', onPause); };
  }, [videoRef]);
  const togglePlay = (e: React.MouseEvent) => { e.stopPropagation(); const v = videoRef.current; if (!v) return; if (v.paused) v.play(); else v.pause(); };
  return (
    <div onClick={togglePlay} className={`absolute inset-0 flex items-center justify-center cursor-pointer z-10 transition-all ${isPlaying ? 'opacity-0 hover:opacity-100 bg-black/30' : 'opacity-100 bg-black/40 backdrop-blur-[2px]'}`}>
      <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center shadow-2xl transition-transform active:scale-95">
        <span className="material-symbols-outlined text-black text-4xl font-black">{isPlaying ? 'pause' : 'play_arrow'}</span>
      </div>
    </div>
  );
};
export const ManifestNode: React.FC<ManifestNodeProps> = ({ 
  manifest, onNavigate, onUpdateTimeline, onUpdateEpisode, onSaveMaster 
}) => {
  const [timeline, setTimeline] = useState<ShotPrompt[]>(manifest.timeline || []);
  const [renderingIndex, setRenderingIndex] = useState<number | null>(null);
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(() => (manifest.timeline || []).some(s => !!s.base64));
  const [stitching, setStitching] = useState(false);
  const [ffmpegStatus, setFfmpegStatus] = useState<string>('');
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [masterPreview, setMasterPreview] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'done' | 'error'>('idle');
  const [shotDownloadStates, setShotDownloadStates] = useState<Record<string, 'idle' | 'downloading' | 'done'>>({});
  
  const masterVideoRef = useRef<HTMLVideoElement>(null);
  const shotRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  useEffect(() => {
    if (isApproved && !ffmpegLoaded) {
      ffmpegService.load(msg => setFfmpegStatus(msg)).then(() => setFfmpegLoaded(true));
    }
  }, [isApproved, ffmpegLoaded]);
  const updateShotPrompt = (id: string, updates: Partial<ShotPrompt>) => {
    const next = timeline.map(s => s.id === id ? { ...s, ...updates } : s);
    setTimeline(next);
    onUpdateTimeline?.(next);
  };
  const getActorForShot = (shot: ShotPrompt) => (manifest.actors || []).find(a => a.name.toLowerCase() === shot.speakerLabel.toLowerCase());
  const handleDownloadShot = async (shot: ShotPrompt) => {
    if (!shot.base64) return;
    setShotDownloadStates(prev => ({ ...prev, [shot.id]: 'downloading' }));
    try {
      await Flow.download({ base64: shot.base64, mimeType: 'video/mp4', filename: `CinemaDraft_S${shot.index}.mp4` });
      setShotDownloadStates(prev => ({ ...prev, [shot.id]: 'done' }));
      setTimeout(() => setShotDownloadStates(prev => ({ ...prev, [shot.id]: 'idle' })), 2000);
    } catch { setShotDownloadStates(prev => ({ ...prev, [shot.id]: 'idle' })); }
  };
  const executeRender = async (shotIndex: number) => {
    const shot = timeline[shotIndex];
    if (!shot) return;
    setRenderingIndex(shotIndex);
    try {
      const actor = getActorForShot(shot);
      const location = (manifest.locations || []).find(l => l.id === shot.locationId);
      const audioIds: string[] = actor?.voiceId ? [actor.voiceId] : [];
      const imageIds: string[] = [];
      if (actor?.mediaId) imageIds.push(actor.mediaId);
      if (location?.mediaId) imageIds.push(location.mediaId);
      const result = await Flow.generate.video({
        prompt: `${shot.visualPrompt}. Character ${shot.speakerLabel}: "${shot.dialogue}". ${manifest.metadata.aspectRatio === '9:16' ? 'Vertical 9:16' : 'Widescreen 16:9'}.`,
        modelDisplayName: DEFAULT_VIDEO_MODEL,
        aspectRatio: manifest.metadata.aspectRatio,
        resolution: manifest.metadata.targetResolution,
        referenceImageMediaIds: imageIds.length > 0 ? imageIds : undefined,
        audioReferenceMediaIds: (audioIds.length > 0 && imageIds.length > 0) ? audioIds : undefined,
        durationSeconds: shot.durationSeconds
      });
      const next = [...timeline];
      next[shotIndex] = { ...shot, mediaId: result.mediaId, base64: result.base64, errorMessage: undefined };
      setTimeline(next);
      onUpdateTimeline?.(next);
    } catch (err) {
      const next = [...timeline];
      next[shotIndex] = { ...shot, errorMessage: err instanceof Error ? err.message : 'Render Failed' };
      setTimeline(next);
    } finally { setRenderingIndex(null); }
  };
  const stitchFinalVideo = async () => {
    const rendered = timeline.filter(s => !!s.base64);
    if (rendered.length === 0) return;
    setStitching(true);
    try {
      const names: string[] = [];
      for (let i = 0; i < rendered.length; i++) {
        const fn = `s${i}.mp4`; names.push(fn);
        const b = Uint8Array.from(atob(rendered[i].base64!), c => c.charCodeAt(0));
        await ffmpegService.writeFile(fn, b);
      }
      setFfmpegStatus('Assembling Sequence...');
      const inputs: string[] = []; names.forEach(n => inputs.push('-i', n));
      const filters = names.map((_, i) => `[${i}:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]; [${i}:a]aresample=44100[a${i}]`).join('; ');
      const concat = names.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${names.length}:v=1:a=1[outv][outa]`;
      await ffmpegService.exec([...inputs, '-filter_complex', `${filters}; ${concat}`, '-map', '[outv]', '-map', '[outa]', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-y', 'out.mp4']);
      
      if (manifest.backgroundMusicId) {
        setFfmpegStatus('Mixing Soundtrack...');
        const m = await Flow.media.select({ id: manifest.backgroundMusicId });
        await ffmpegService.writeFile('bg.mp3', Uint8Array.from(atob(m.base64), c => c.charCodeAt(0)));
        await ffmpegService.exec(['-i', 'out.mp4', '-i', 'bg.mp3', '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=first[a]', '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-y', 'master.mp4']);
      } else {
        await ffmpegService.exec(['-i', 'out.mp4', '-c:v', 'copy', '-c:a', 'copy', '-y', 'master.mp4']);
      }
      const out = await ffmpegService.readFile('master.mp4') as Uint8Array;
      const b64 = await new Promise<string>(r => { const f = new FileReader(); f.onloadend = () => r((f.result as string).split(',')[1]); f.readAsDataURL(new Blob([out])); });
      setMasterPreview(b64);
      try { const s = await Flow.save({ base64: b64, mimeType: 'video/mp4', name: `CD_MASTER_EP${manifest.episodeNumber}` }); onSaveMaster?.(b64, s.mediaId); } catch { onSaveMaster?.(b64, ''); }
      for (const n of names) await ffmpegService.deleteFile(n);
      await ffmpegService.deleteFile('out.mp4'); await ffmpegService.deleteFile('master.mp4');
    } catch (e) { setFfmpegStatus(`Stitch Error: ${e}`); } finally { setStitching(false); }
  };
  const editingShot = timeline.find(s => s.id === editingShotId);
  if (!isApproved) {
    return (
      <div className="h-full flex items-center justify-center bg-[#050505] p-10">
        <div className="max-w-xl w-full bg-[#0c0c0e] border-2 border-amber-500/20 rounded-[4rem] p-16 text-center space-y-12 shadow-2xl">
          <div className="w-28 h-28 bg-amber-500/10 border-2 border-amber-500/20 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner"><span className="material-symbols-outlined text-amber-500 text-6xl">payments</span></div>
          <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">Production Budget</h2>
          <button onClick={() => setIsApproved(true)} className="w-full py-8 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-[2rem] uppercase tracking-[0.5em] text-sm transition-all shadow-2xl active:scale-95">Authorize Rendering</button>
        </div>
      </div>
    );
  }
  return (
    <div className="h-full flex flex-col bg-[#050505] overflow-hidden">
      {editingShot && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-300">
           <div className="max-w-xl w-full bg-[#0d0d12] border border-white/10 rounded-[3rem] p-10 space-y-8 shadow-2xl">
              <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">Director Overrides: Unit {editingShot.index}</h3>
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Visual Direction</label>
                  <textarea value={editingShot.visualPrompt} onChange={(e) => updateShotPrompt(editingShot.id, { visualPrompt: e.target.value })} className="w-full h-32 bg-black border border-white/10 rounded-xl p-4 text-xs text-white italic outline-none focus:border-amber-400/40" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-3">
                     <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Speaker Cue</label>
                     <input value={editingShot.speakerLabel} onChange={(e) => updateShotPrompt(editingShot.id, { speakerLabel: e.target.value })} className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none" />
                   </div>
                   <div className="space-y-3">
                     <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Target Duration</label>
                     <select value={editingShot.durationSeconds} onChange={(e) => updateShotPrompt(editingShot.id, { durationSeconds: Number(e.target.value) as any })} className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none">
                       {[4,6,8,10].map(v => <option key={v} value={v}>{v} Seconds</option>)}
                     </select>
                   </div>
                </div>
              </div>
              <button onClick={() => setEditingShotId(null)} className="w-full py-5 bg-emerald-500 text-black font-black rounded-2xl uppercase tracking-[0.3em] text-xs">Lock Manifest Adjustments</button>
           </div>
        </div>
      )}
      <div className="px-10 py-8 border-b-2 border-white/10 flex justify-between items-center bg-[#0c0c0e] z-20">
        <div className="flex items-center gap-6">
           <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-black font-black shadow-lg">{manifest.episodeNumber}</div>
           <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">Rendering Console</h2>
        </div>
        <div className="flex gap-4">
          <button onClick={() => onUpdateEpisode?.({ backgroundMusicId: undefined })} className={`px-6 py-2.5 rounded-xl border transition-all text-[9px] font-black uppercase tracking-widest ${manifest.backgroundMusicId ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-400'}`}>
            {manifest.backgroundMusicId ? 'Soundtrack Locked' : 'Add Soundtrack'}
          </button>
          {timeline.every(s => !!s.base64) && !masterPreview && (
            <button onClick={stitchFinalVideo} disabled={stitching} className="px-10 py-4 bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-black uppercase tracking-[0.4em] rounded-[1.5rem] shadow-2xl flex items-center gap-4">
              <span className="material-symbols-outlined text-2xl">{stitching ? 'sync' : 'auto_fix_high'}</span> Assemble Master
            </button>
          )}
          {masterPreview && <button onClick={() => Flow.download({ base64: masterPreview, mimeType: 'video/mp4', filename: 'master.mp4' })} className="px-8 py-4 bg-amber-500 text-black text-[10px] font-black uppercase tracking-[0.4em] rounded-[1.5rem] shadow-2xl">Export Master</button>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-12 no-scrollbar">
        {masterPreview ? (
          <div className="h-full flex flex-col items-center justify-center p-8 animate-in zoom-in duration-1000">
            <video ref={masterVideoRef} src={`data:video/mp4;base64,${masterPreview}`} className={`max-w-sm rounded-[3rem] border-4 border-amber-500/40 shadow-2xl ${manifest.metadata.aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'}`} controls />
            <div className="mt-8 text-center space-y-4"><p className="text-[10px] text-slate-500 uppercase tracking-[1em] font-black italic">Production Finalized</p></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
            {timeline.map((shot, idx) => (
              <div key={shot.id} className="bg-[#0c0c0e] border-2 border-white/5 rounded-[3rem] overflow-hidden group hover:border-amber-400/40 transition-all shadow-xl">
                <div className={`aspect-[9/16] bg-black relative`}>
                  {shot.base64 ? (
                    <>
                      <video src={`data:video/mp4;base64,${shot.base64}`} className="w-full h-full object-cover" loop playsInline controls />
                      <button onClick={() => handleDownloadShot(shot)} className="absolute top-6 right-6 w-10 h-10 bg-black/60 rounded-xl flex items-center justify-center text-white/40 hover:text-white transition-all"><span className="material-symbols-outlined">download</span></button>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-10 text-center">
                       {renderingIndex === idx ? <div className="w-16 h-16 border-4 border-amber-500/10 border-t-amber-400 rounded-full animate-spin" /> : <span className="material-symbols-outlined text-7xl text-white/10">movie</span>}
                    </div>
                  )}
                  <div className="absolute top-6 left-6 flex items-center gap-2">
                     <span className="bg-black/80 px-4 py-1.5 rounded-xl text-[9px] font-black text-white uppercase border border-white/10">Unit {idx + 1}</span>
                     {!shot.base64 && <button onClick={() => setEditingShotId(shot.id)} className="w-8 h-8 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 hover:bg-amber-500 hover:text-black border border-amber-500/20 transition-all"><span className="material-symbols-outlined text-sm">edit_note</span></button>}
                  </div>
                  {shot.errorMessage && <div className="absolute inset-0 bg-red-600/80 backdrop-blur-md flex items-center justify-center p-8 text-center text-white text-[10px] font-black uppercase tracking-widest leading-relaxed">Synthesis Fail: {shot.errorMessage.slice(0,50)}...</div>}
                </div>
                <div className="p-6">
                  <button onClick={() => executeRender(idx)} disabled={renderingIndex !== null} className={`w-full py-4 rounded-[1.5rem] text-[9px] font-black uppercase tracking-[0.3em] transition-all ${shot.base64 ? 'bg-white/5 text-slate-500 border border-white/10 hover:text-white hover:bg-white/10' : 'bg-amber-500 text-black shadow-lg hover:bg-amber-400'}`}>
                    {shot.base64 ? 'Re-Render Unit' : 'Execute Unit Synthesis'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {ffmpegStatus && <div className="h-12 bg-black border-t border-white/10 flex items-center px-10"><span className="text-[9px] font-mono font-black text-amber-400 uppercase tracking-widest italic">{ffmpegStatus}</span></div>}
    </div>
  );
};