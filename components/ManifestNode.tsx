import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Flow } from 'flow-sdk';
import { MasterManifest, ShotPrompt, NodeStage, EpisodeProduction } from '../types';
import { DEFAULT_VIDEO_MODEL, getShotCost, MAX_REFERENCE_IMAGES, SHOT_SIZES, CAMERA_ANGLES, CAMERA_MOVEMENTS } from '../constants';
import { ffmpegService } from '../services/ffmpegService';
import {
  buildShotPrompt, resolveSpeaker, resolveShotActors, findActor,
  getOutputSize, inspectMp4, buildStitchArgs, buildMusicArgs
} from '../services/continuityService';
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
      const actors = manifest.actors || [];
      const locations = manifest.locations || [];
      const speaker = resolveSpeaker(shot, actors);
      const location = locations.find(l => l.id === shot.locationId);
      const audioIds: string[] = speaker?.voiceId && shot.dialogue?.trim() ? [speaker.voiceId] : [];
      const actorImageIds = resolveShotActors(shot, actors)
        .map(a => a.mediaId)
        .filter((id): id is string => !!id)
        .slice(0, location?.mediaId ? MAX_REFERENCE_IMAGES - 1 : MAX_REFERENCE_IMAGES);
      const imageIds: string[] = location?.mediaId ? [...actorImageIds, location.mediaId] : actorImageIds;
      const result = await Flow.generate.video({
        prompt: buildShotPrompt(shot, {
          actors, locations, style: manifest.style,
          language: manifest.metadata.language, aspectRatio: manifest.metadata.aspectRatio
        }),
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
      onUpdateTimeline?.(next);
    } finally { setRenderingIndex(null); }
  };
  const missingShots = timeline.filter(s => !s.base64);
  const stitchFinalVideo = async () => {
    if (timeline.length === 0) return;
    if (missingShots.length > 0) {
      setFfmpegStatus(`Cannot assemble: unit ${missingShots.map(s => s.index).join(', ')} not rendered yet.`);
      return;
    }
    if (!ffmpegLoaded) { setFfmpegStatus('Encoder is still loading, try again in a moment.'); return; }
    setStitching(true);
    const files: string[] = [];
    try {
      setFfmpegStatus('Preparing clips...');
      const clips: { name: string; hasAudio: boolean; duration: number }[] = [];
      for (let i = 0; i < timeline.length; i++) {
        const name = `s${i}.mp4`;
        const bytes = Uint8Array.from(atob(timeline[i].base64!), c => c.charCodeAt(0));
        await ffmpegService.writeFile(name, bytes);
        files.push(name);
        const info = inspectMp4(bytes);
        clips.push({ name, hasAudio: info.hasAudio, duration: info.duration || timeline[i].durationSeconds });
      }
      setFfmpegStatus('Assembling Sequence...');
      await ffmpegService.exec(buildStitchArgs(clips, getOutputSize(manifest.metadata.aspectRatio)));
      files.push('out.mp4');
      let finalFile = 'out.mp4';
      if (manifest.backgroundMusicId) {
        setFfmpegStatus('Mixing Soundtrack...');
        const m = await Flow.media.select({ id: manifest.backgroundMusicId });
        await ffmpegService.writeFile('bg.mp3', Uint8Array.from(atob(m.base64), c => c.charCodeAt(0)));
        files.push('bg.mp3');
        await ffmpegService.exec(buildMusicArgs(clips.reduce((sum, c) => sum + c.duration, 0), 'bg.mp3'));
        files.push('master.mp4');
        finalFile = 'master.mp4';
      }
      const out = await ffmpegService.readFile(finalFile) as Uint8Array;
      const b64 = await new Promise<string>(r => { const f = new FileReader(); f.onloadend = () => r((f.result as string).split(',')[1]); f.readAsDataURL(new Blob([out as any])); });
      setMasterPreview(b64);
      setFfmpegStatus('');
      try { const s = await Flow.save({ base64: b64, mimeType: 'video/mp4', name: `CD_MASTER_EP${manifest.episodeNumber}` }); onSaveMaster?.(b64, s.mediaId); } catch { onSaveMaster?.(b64, ''); }
    } catch (e) { setFfmpegStatus(`Stitch Error: ${e}`); } finally {
      for (const n of files) { try { await ffmpegService.deleteFile(n); } catch { /* already removed */ } }
      setStitching(false);
    }
  };
  const editingShot = timeline.find(s => s.id === editingShotId);
  if (!isApproved) {
    return (
      <div className="h-full flex items-center justify-center bg-[#050505] p-10">
        <div className="max-w-xl w-full bg-[#0c0c0e] border-2 border-amber-500/20 rounded-3xl p-16 text-center space-y-12 shadow-2xl">
          <div className="w-28 h-28 bg-amber-500/10 border-2 border-amber-500/20 rounded-3xl flex items-center justify-center mx-auto shadow-inner"><span className="material-symbols-outlined text-amber-500 text-6xl">payments</span></div>
          <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">Production Budget</h2>
          <button onClick={() => setIsApproved(true)} className="w-full py-8 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-2xl uppercase tracking-[0.2em] text-sm transition-all shadow-2xl active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">Authorize Rendering</button>
        </div>
      </div>
    );
  }
  return (
    <div className="h-full flex flex-col bg-[#050505] overflow-hidden">
      {editingShot && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-300">
           <div className="max-w-xl w-full bg-[#0d0d12] border border-white/10 rounded-3xl p-10 space-y-8 shadow-2xl">
              <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest">Director Overrides: Unit {editingShot.index}</h3>
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-widest">Visual Direction</label>
                  <textarea value={editingShot.visualPrompt} onChange={(e) => updateShotPrompt(editingShot.id, { visualPrompt: e.target.value })} className="w-full h-32 bg-black border border-white/10 rounded-xl p-4 text-sm text-white italic outline-none focus:border-amber-400/40" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-3">
                     <label className="text-xs font-bold text-slate-300 uppercase tracking-widest">Speaker Cue</label>
                     <input value={editingShot.speakerLabel} onChange={(e) => updateShotPrompt(editingShot.id, { speakerLabel: e.target.value, speakerActorId: findActor(manifest.actors || [], e.target.value)?.id })} className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-amber-400/60 transition-colors" />
                   </div>
                   <div className="space-y-3">
                     <label className="text-xs font-bold text-slate-300 uppercase tracking-widest">Target Duration</label>
                     <select value={editingShot.durationSeconds} onChange={(e) => updateShotPrompt(editingShot.id, { durationSeconds: Number(e.target.value) as any })} className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-amber-400/60 transition-colors">
                       {[4,6,8,10].map(v => <option key={v} value={v}>{v} Seconds</option>)}
                     </select>
                   </div>
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-widest">Dialogue</label>
                  <textarea value={editingShot.dialogue} onChange={(e) => updateShotPrompt(editingShot.id, { dialogue: e.target.value })} className="w-full h-20 bg-black border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-amber-400/40" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {([
                    ['Shot Size', 'shotSize', SHOT_SIZES],
                    ['Angle', 'cameraAngle', CAMERA_ANGLES],
                    ['Movement', 'cameraMovement', CAMERA_MOVEMENTS]
                  ] as const).map(([label, field, options]) => (
                    <div key={field} className="space-y-3">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-widest">{label}</label>
                      <select value={editingShot[field] || ''} onChange={(e) => updateShotPrompt(editingShot.id, { [field]: e.target.value || undefined })} className="w-full bg-black border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/60 transition-colors">
                        <option value="">Auto</option>
                        {options.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => setEditingShotId(null)} className="w-full py-5 bg-emerald-500 text-black font-bold rounded-2xl uppercase tracking-widest text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">Lock Manifest Adjustments</button>
           </div>
        </div>
      )}
      <div className="px-10 py-8 border-b-2 border-white/10 flex justify-between items-center bg-[#0c0c0e] z-20">
        <div className="flex items-center gap-6">
           <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-black font-bold shadow-lg">{manifest.episodeNumber}</div>
           <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">Rendering Console</h2>
        </div>
        <div className="flex gap-4">
          <button onClick={() => onUpdateEpisode?.({ backgroundMusicId: undefined })} className={`focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 px-6 py-2.5 rounded-xl border transition-all text-xs font-bold uppercase tracking-widest ${manifest.backgroundMusicId ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-300'}`}>
            {manifest.backgroundMusicId ? 'Soundtrack Locked' : 'Add Soundtrack'}
          </button>
          {missingShots.length > 0 && !masterPreview && (
            <span className="self-center text-xs font-bold text-slate-300 uppercase tracking-widest">{timeline.length - missingShots.length} / {timeline.length} units rendered</span>
          )}
          {timeline.length > 0 && missingShots.length === 0 && !masterPreview && (
            <button onClick={stitchFinalVideo} disabled={stitching || !ffmpegLoaded} className="px-10 py-4 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase tracking-widest rounded-2xl shadow-2xl flex items-center gap-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">
              <span className="material-symbols-outlined text-2xl">{stitching ? 'sync' : 'auto_fix_high'}</span> Assemble Master
            </button>
          )}
          {masterPreview && <button onClick={() => Flow.download({ base64: masterPreview, mimeType: 'video/mp4', filename: 'master.mp4' })} className="px-8 py-4 bg-amber-500 text-black text-xs font-bold uppercase tracking-widest rounded-2xl shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">Export Master</button>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-12 no-scrollbar">
        {masterPreview ? (
          <div className="h-full flex flex-col items-center justify-center p-8 animate-in zoom-in duration-1000">
            <video ref={masterVideoRef} src={`data:video/mp4;base64,${masterPreview}`} className={`max-w-sm rounded-3xl border-4 border-amber-500/40 shadow-2xl ${manifest.metadata.aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'}`} controls />
            <div className="mt-8 text-center space-y-4"><p className="text-xs text-slate-300 uppercase tracking-[0.2em] font-bold italic">Production Finalized</p></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
            {timeline.map((shot, idx) => (
              <div key={shot.id} className="bg-[#0c0c0e] border-2 border-white/10 rounded-3xl overflow-hidden group hover:border-amber-400/40 transition-all shadow-xl">
                <div className={`${manifest.metadata.aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'} bg-black relative`}>
                  {shot.base64 ? (
                    <>
                      <video src={`data:video/mp4;base64,${shot.base64}`} className="w-full h-full object-cover" loop playsInline controls />
                      <button onClick={() => handleDownloadShot(shot)} className="absolute top-6 right-6 w-10 h-10 bg-black/60 rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"><span className="material-symbols-outlined">download</span></button>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-10 text-center">
                       {renderingIndex === idx ? <div className="w-16 h-16 border-4 border-amber-500/10 border-t-amber-400 rounded-full animate-spin" /> : <span className="material-symbols-outlined text-7xl text-white/40">movie</span>}
                    </div>
                  )}
                  <div className="absolute top-6 left-6 flex items-center gap-2">
                     <span className="bg-black/80 px-4 py-1.5 rounded-xl text-xs font-bold text-white uppercase border border-white/10">Unit {idx + 1}</span>
                     {!shot.base64 && <button onClick={() => setEditingShotId(shot.id)} className="w-8 h-8 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 hover:bg-amber-500 hover:text-black border border-amber-500/20 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"><span className="material-symbols-outlined text-sm">edit_note</span></button>}
                  </div>
                  {shot.errorMessage && <div className="absolute inset-0 bg-red-600/80 backdrop-blur-md flex items-center justify-center p-8 text-center text-white text-xs font-bold uppercase tracking-widest leading-relaxed">Synthesis Fail: {shot.errorMessage.slice(0,50)}...</div>}
                </div>
                <div className="p-6 space-y-3">
                  {(shot.shotSize || shot.cameraAngle || shot.cameraMovement) && (
                    <p className="text-xs text-slate-300 font-bold text-center">{[shot.shotSize, shot.cameraAngle, shot.cameraMovement].filter(Boolean).join(' · ')}</p>
                  )}
                  <button onClick={() => executeRender(idx)} disabled={renderingIndex !== null} className={`focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50 disabled:cursor-not-allowed w-full py-4 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${shot.base64 ? 'bg-white/5 text-slate-300 border border-white/10 hover:text-white hover:bg-white/10' : 'bg-amber-500 text-black shadow-lg hover:bg-amber-400'}`}>
                    {shot.base64 ? 'Re-Render Unit' : 'Execute Unit Synthesis'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {ffmpegStatus && <div className="h-12 bg-black border-t border-white/10 flex items-center px-10"><span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest italic">{ffmpegStatus}</span></div>}
    </div>
  );
};