import React, { useState, useRef } from 'react';
import { SeriesBible } from './types';
import { IntroModal } from './components/IntroModal';
import { SeriesArchitectNode } from './components/SeriesArchitectNode';
import { EpisodeDashboard } from './components/EpisodeDashboard';
import { ProductionPipeline } from './components/ProductionPipeline';
import { projectService } from './services/projectService';
export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [bible, setBible] = useState<SeriesBible | null>(null);
  const [activeView, setActiveView] = useState<'architect' | 'dashboard' | 'production'>('architect');
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleBibleComplete = (newBible: SeriesBible) => {
    setBible(newBible);
    setActiveView('dashboard');
  };
  const startEpisodeProduction = (index: number) => {
    if (!bible) return;
    setBible(prev => prev ? { ...prev, activeEpisodeIndex: index } : null);
    setActiveView('production');
  };
  const exitProduction = () => {
    setBible(prev => prev ? { ...prev, activeEpisodeIndex: null } : null);
    setActiveView('dashboard');
  };
  const updateBible = (updates: Partial<SeriesBible>) => {
    setBible(prev => prev ? { ...prev, ...updates } : null);
  };
  const handleExport = async () => {
    if (!bible) return;
    setIsExporting(true);
    await projectService.exportProject(bible);
    setIsExporting(false);
  };
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const importedBible = await projectService.importProject(file);
      setBible(importedBible);
      setActiveView('dashboard');
      // Reset input
      e.target.value = '';
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import project.');
    }
  };
  return (
    <div className="flex flex-col h-full bg-[#050505] text-slate-200 font-sans overflow-hidden">
      {showIntro && <IntroModal onClose={() => setShowIntro(false)} />}
      
      {/* Hidden input for local project import */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".json" 
        className="hidden" 
      />
      <header className="h-20 border-b border-white/10 flex items-center justify-between px-8 bg-[#0a0a0a] shrink-0 z-20">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.3)]">
            <span className="material-symbols-outlined text-black text-3xl font-black">account_tree</span>
          </div>
          <div>
            <h1 className="font-black text-base uppercase tracking-[0.25em] italic text-white leading-none">
              CinemaDraft <span className="text-amber-400">Series Studio</span>
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.4em] font-black mt-1.5 flex items-center gap-2">
              {bible?.seriesTitle || 'Agentic Production House'}
              {bible && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_5px_rgba(52,211,153,1)]" />}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white/5 rounded-2xl p-1.5 border border-white/10 gap-1 mr-4">
            <button 
              onClick={handleImportClick}
              className="px-4 py-2 hover:bg-white/5 text-slate-400 hover:text-white rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
              title="Import Project JSON"
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              <span className="hidden sm:inline">Import</span>
            </button>
            {bible && (
              <button 
                onClick={handleExport}
                disabled={isExporting}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-black rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-900/20"
                title="Export Project JSON"
              >
                <span className="material-symbols-outlined text-lg">{isExporting ? 'sync' : 'save'}</span>
                <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export Studio'}</span>
              </button>
            )}
          </div>
          {activeView !== 'architect' && (
            <button 
              onClick={() => setActiveView('dashboard')}
              className={`flex items-center gap-3 px-6 py-2.5 rounded-2xl border transition-all ${
                activeView === 'dashboard' 
                  ? 'border-amber-400 bg-amber-400/10 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.1)]' 
                  : 'border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className="material-symbols-outlined text-xl">dashboard</span>
              <span className="text-[11px] font-black uppercase tracking-widest">Dashboard</span>
            </button>
          )}
           <div className="flex flex-col items-end border-l border-white/10 pl-6 ml-2">
              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Runtime Integrity</span>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                <span className="text-[11px] text-emerald-400 font-mono font-bold uppercase tracking-tighter italic">Nodes_Online</span>
              </div>
           </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(245,158,11,0.06)_0%,_transparent_70%)]" />
        
        <div className="h-full relative z-10 overflow-hidden">
          {activeView === 'architect' && (
            <SeriesArchitectNode onComplete={handleBibleComplete} />
          )}
          {activeView === 'dashboard' && bible && (
            <EpisodeDashboard 
              bible={bible} 
              onSelectEpisode={startEpisodeProduction}
            />
          )}
          {activeView === 'production' && bible && bible.activeEpisodeIndex !== null && (
            <ProductionPipeline 
              bible={bible}
              episodeIndex={bible.activeEpisodeIndex}
              onUpdateBible={updateBible}
              onExit={exitProduction}
            />
          )}
        </div>
      </main>
      <footer className="h-12 bg-[#0a0a0a] border-t border-white/10 flex items-center px-8 justify-between shrink-0">
        <div className="flex gap-10">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-slate-600 uppercase tracking-tighter">Status:</span>
            <span className="text-[11px] font-black text-amber-500 uppercase tracking-[0.25em]">
              {bible ? 'Production Environment Ready' : 'Awaiting Manifest Initialization'}
            </span>
          </div>
          {bible && (
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-slate-600 uppercase tracking-tighter">Capacity:</span>
              <span className="text-[11px] font-black text-amber-400">{bible.episodes.length} Episodes</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest italic font-bold">
            Studio Local Persistence Layer <span className="text-amber-500/50 mx-2">//</span> V1.1.0_CLEAN
          </span>
        </div>
      </footer>
    </div>
  );
}