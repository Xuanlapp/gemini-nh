
import React, { useState, useEffect, useRef } from 'react';
import { ImageFile, BatchItem, ImageAdjustments } from './types';
import { generatePodImage } from './services/geminiService';
import JSZip from 'jszip';

const EditModal: React.FC<{
  image: string;
  batchName: string;
  onSave: (newBase64: string, applyToAll: boolean) => void;
  onRegenerate: (prompt: string, currentImage: string) => Promise<void>;
  onClose: () => void;
}> = ({ image, batchName, onSave, onRegenerate, onClose }) => {
  const [adjustments, setAdjustments] = useState<ImageAdjustments>({ brightness: 100, contrast: 100, rotation: 0 });
  const [prompt, setPrompt] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const isRotated = adjustments.rotation % 180 !== 0;
      canvas.width = isRotated ? img.height : img.width;
      canvas.height = isRotated ? img.width : img.height;
      if (ctx) {
        ctx.filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%)`;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((adjustments.rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
      }
    };
    img.src = image;
  }, [image, adjustments]);

  const handleRegenerate = async () => {
    if (!prompt.trim()) return;
    setHistory(prev => [...prev, image]);
    setRedoStack([]); 
    setIsRegenerating(true);
    await onRegenerate(prompt, image);
    setIsRegenerating(false);
    setPrompt('');
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setRedoStack(prev => [...prev, image]);
    setHistory(prev => prev.slice(0, -1));
    onSave(previous, false);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, image]);
    setRedoStack(prev => prev.slice(0, -1));
    onSave(next, false);
  };

  const cleanFileName = (name: string) => {
    return name
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')           
      .trim();                        
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `${cleanFileName(batchName)}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[90vh]">
        <div className="flex-1 bg-slate-100 p-8 flex items-center justify-center overflow-hidden bg-checkered relative">
          <canvas ref={canvasRef} className="max-w-full max-h-full object-contain shadow-2xl rounded-xl" />
          {isRegenerating && (
             <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-600">Redesigning Asset...</span>
                </div>
             </div>
          )}
        </div>
        <div className="w-full md:w-80 border-l border-slate-100 flex flex-col">
          <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-slate-900 uppercase tracking-tighter text-lg">Asset Refiner</h3>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adjustments</label>
                <div className="space-y-4 bg-slate-50 p-4 rounded-2xl">
                   <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase"><span>Brightness</span><span>{adjustments.brightness}%</span></div>
                      <input type="range" min="0" max="200" value={adjustments.brightness} onChange={e => setAdjustments(p => ({...p, brightness: parseInt(e.target.value)}))} className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-full appearance-none" />
                   </div>
                   <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase"><span>Contrast</span><span>{adjustments.contrast}%</span></div>
                      <input type="range" min="0" max="200" value={adjustments.contrast} onChange={e => setAdjustments(p => ({...p, contrast: parseInt(e.target.value)}))} className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-full appearance-none" />
                   </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Redesign Output</label>
                <textarea 
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="e.g., xóa chiếc quần đi, đổi màu áo sang đỏ..."
                  className="w-full h-24 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
                <div className="flex gap-2">
                  <button 
                    onClick={handleUndo}
                    disabled={history.length === 0 || isRegenerating}
                    className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    Undo
                  </button>
                  <button 
                    onClick={handleRedo}
                    disabled={redoStack.length === 0 || isRegenerating}
                    className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    Redo
                  </button>
                </div>
                <button 
                  onClick={handleRegenerate}
                  disabled={isRegenerating || !prompt.trim()}
                  className="w-full mt-2 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:bg-slate-300"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  Redesign
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-8 border-t border-slate-50 space-y-3">
            <button onClick={handleDownload} className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              SAVE AS {cleanFileName(batchName).slice(0, 15)}...
            </button>
            <button onClick={() => onSave(canvasRef.current!.toDataURL('image/png'), false)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 transition-all">Apply to this</button>
            <button onClick={() => onSave(canvasRef.current!.toDataURL('image/png'), true)} className="w-full bg-indigo-50 text-indigo-600 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100">Apply to all</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Lightbox: React.FC<{ image: string; onClose: () => void }> = ({ image, onClose }) => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-12 cursor-zoom-out animate-in fade-in" onClick={onClose}>
    <img src={image} className="max-w-full max-h-full object-contain shadow-2xl" />
  </div>
);

const App: React.FC = () => {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [shouldStopGlobal, setShouldStopGlobal] = useState(false);
  const [outputsPerBatch, setOutputsPerBatch] = useState(1);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<{ batchId: string; index: number; data: string; mode: 'normal' | 'pro' } | null>(null);
  const [hasProKey, setHasProKey] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasProKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleConnectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasProKey(true);
    } else {
      alert("Hệ thống quản lý Key không khả dụng trên trình duyệt này.");
    }
  };

  const fileToBase64 = (file: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file);
  });

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    const grouped: { [key: string]: File[] } = {};
    files.forEach(f => {
      if (!f.type.startsWith('image/')) return;
      const parts = (f as any).webkitRelativePath.split('/');
      if (parts.length > 2) {
        const name = parts[parts.length - 2];
        if (!grouped[name]) grouped[name] = [];
        grouped[name].push(f);
      }
    });

    const newBatches: BatchItem[] = await Promise.all(Object.entries(grouped).map(async ([name, fs]) => ({
      id: Math.random().toString(36).substr(2, 9),
      name,
      images: await Promise.all(fs.slice(0, 5).map(async f => ({ id: Math.random().toString(36).substr(2, 9), file: f, preview: URL.createObjectURL(f), base64: await fileToBase64(f) }))),
      status: 'idle',
      resultsNormal: [],
      resultsPro: []
    })));
    setBatches(p => [...p, ...newBatches]);
  };

  const processBatch = async (batchId: string, mode: 'normal' | 'pro') => {
    const idx = batches.findIndex(b => b.id === batchId);
    if (idx === -1) return;

    setBatches(p => p.map(b => b.id === batchId ? { 
      ...b, 
      status: 'processing', 
      processingMode: mode,
      error: undefined 
    } : b));

    try {
      const batch = batches[idx];
      const resUrls: string[] = [];
      const isPro = mode === 'pro';

      for (let i = 0; i < outputsPerBatch; i++) {
        const currentBatch = batches.find(b => b.id === batchId);
        if (shouldStopGlobal || (currentBatch && currentBatch.status === 'stopping')) break;
        const b64 = await generatePodImage(batch.images, batch.customPrompt, undefined, isPro);
        resUrls.push(b64);
      }
      
      setBatches(p => p.map(b => {
        if (b.id === batchId) {
          return { 
            ...b, 
            status: 'completed', 
            [isPro ? 'resultsPro' : 'resultsNormal']: resUrls 
          };
        }
        return b;
      }));
    } catch (err: any) {
      if (err.message.includes("PRO_KEY_REQUIRED")) {
        alert("Model Gemini 3 Pro yêu cầu API Key riêng (Paid Project). Hãy nhấn 'Setup Pro Engine' ở phía trên.");
        handleConnectKey();
      }
      setBatches(p => p.map(b => b.id === batchId ? { ...b, status: 'error', error: err.message } : b));
    }
  };

  const stopBatch = (batchId: string) => {
    setBatches(p => p.map(b => b.id === batchId ? { ...b, status: 'stopping' } : b));
  };

  const processAll = async (mode: 'normal' | 'pro') => {
    setIsProcessingAll(true);
    setShouldStopGlobal(false);
    for (const b of batches) {
      if (shouldStopGlobal) break;
      await processBatch(b.id, mode);
    }
    setIsProcessingAll(false);
  };

  const cleanFileName = (name: string) => {
    return name
      .replace(/[^a-zA-Z0-9 ]/g, ' ') 
      .replace(/\s+/g, ' ')           
      .trim();                        
  };

  const downloadProject = async () => {
    const zip = new JSZip();
    for (const batch of batches) {
      if (batch.resultsNormal.length === 0 && batch.resultsPro.length === 0) continue;
      const folder = zip.folder(batch.name);
      if (!folder) continue;
      
      const normalFolder = folder.folder("Normal");
      batch.resultsNormal.forEach((res, i) => {
        const base64Data = res.split(',')[1];
        const fileName = `${cleanFileName(batch.name)} Normal ${i + 1}.png`;
        normalFolder?.file(fileName, base64Data, { base64: true });
      });

      const proFolder = folder.folder("Pro");
      batch.resultsPro.forEach((res, i) => {
        const base64Data = res.split(',')[1];
        const fileName = `${cleanFileName(batch.name)} Pro ${i + 1}.png`;
        proFolder?.file(fileName, base64Data, { base64: true });
      });
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `POD-Project-${new Date().getTime()}.zip`;
    link.click();
  };

  const onEditRegenerate = async (prompt: string, currentImage: string) => {
    if (!editTarget) return;
    try {
      const isPro = editTarget.mode === 'pro';
      const newB64 = await generatePodImage([], prompt, currentImage, isPro);
      setEditTarget(prev => prev ? { ...prev, data: newB64 } : null);
      
      setBatches(p => p.map(b => {
        if (b.id === editTarget.batchId) {
          const key = isPro ? 'resultsPro' : 'resultsNormal';
          return { ...b, [key]: b[key].map((r, i) => (i === editTarget.index) ? newB64 : r) };
        }
        return b;
      }));
    } catch (e) {
      alert("Error regenerating: " + e);
    }
  };

  const handleInputDropReplace = async (batchId: string, imgId: string, file: File) => {
    if (!file.type.startsWith('image/')) return;
    const b64 = await fileToBase64(file);
    const preview = URL.createObjectURL(file);
    setBatches(p => p.map(b => b.id === batchId ? { 
      ...b, 
      images: b.images.map(i => i.id === imgId ? { ...i, base64: b64, preview, file } : i) 
    } : b));
  };

  const handleInputDropAdd = async (batchId: string, file: File) => {
    if (!file.type.startsWith('image/')) return;
    const b64 = await fileToBase64(file);
    const preview = URL.createObjectURL(file);
    setBatches(p => p.map(b => b.id === batchId ? { 
      ...b, 
      images: [...b.images, { id: Math.random().toString(36).substr(2, 9), file, preview, base64: b64 }].slice(0, 5)
    } : b));
  };

  const handleDeleteInput = (batchId: string, imgId: string) => {
    setBatches(p => p.map(b => b.id === batchId ? {
      ...b,
      images: b.images.filter(i => i.id !== imgId)
    } : b));
  };

  const removeBatchById = (id: string) => {
    setBatches(prev => prev.filter(item => item.id !== id));
  };

  const openAmazonSearchOnOtherScreen = (keyword: string) => {
    const url = `https://www.amazon.com/s?k=${encodeURIComponent(keyword)}`;
    const screenWidth = window.screen.width;
    const currentWindowLeft = window.screenX || window.screenLeft;
    const targetLeft = currentWindowLeft < screenWidth / 2 ? screenWidth : 0;
    const windowFeatures = `width=1400,height=1000,left=${targetLeft},top=0,resizable=yes,scrollbars=yes,status=yes`;
    window.open(url, `amazon_search_${keyword.replace(/[^a-zA-Z0-9]/g, '_')}`, windowFeatures);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="max-w-[1900px] mx-auto px-6 pt-10">
        {/* HEADER AREA */}
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-5">
             <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-100">P</div>
             <div>
               <h1 className="text-xl font-black text-slate-900 uppercase leading-none mb-1">POD GENIUS <span className="text-indigo-600">PRO</span></h1>
               <div className="flex items-center gap-2">
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">High-Volume 2K Pipeline</p>
                 <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${hasProKey ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                    {hasProKey ? '● ENGINE 3.0 PRO ACTIVE' : '○ ENGINE BASIC'}
                 </div>
               </div>
             </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
             {!hasProKey && (
                <button onClick={handleConnectKey} className="bg-amber-500 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 transition-all flex items-center gap-2 shadow-lg shadow-amber-100">
                   Setup Pro Engine
                </button>
             )}
             <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200">
                <span className="text-[9px] font-black uppercase text-slate-500">Output Qty:</span>
                <select 
                  value={outputsPerBatch} 
                  onChange={e => setOutputsPerBatch(Number(e.target.value))}
                  className="bg-transparent text-sm font-black text-indigo-600 focus:outline-none cursor-pointer"
                >
                  {[1,2,3,4,5,10].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
             </div>
             <button onClick={() => { setShouldStopGlobal(true); setIsProcessingAll(false); }} className="bg-red-50 text-red-500 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Emergency Stop</button>
             <button onClick={() => folderInputRef.current?.click()} className="bg-slate-900 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center gap-2 shadow-xl shadow-slate-200">
                Import Project
             </button>
             <button disabled={batches.length === 0} onClick={downloadProject} className="bg-white border border-slate-200 text-slate-900 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
                Export ZIP
             </button>
             <div className="flex gap-2">
               <button disabled={isProcessingAll || batches.length === 0} onClick={() => processAll('normal')} className="bg-slate-800 text-white px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-700 transition-all shadow-xl shadow-slate-100">
                 NORMAL RUN ALL
               </button>
               <button disabled={isProcessingAll || batches.length === 0} onClick={() => processAll('pro')} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">
                 PRO RUN ALL
               </button>
             </div>
          </div>
        </div>

        {/* BATCH LIST - Reduced Height */}
        <div className="space-y-6">
          {batches.map((batch, index) => (
            <div key={batch.id} className="bg-white rounded-[32px] border border-slate-100 relative shadow-sm hover:border-indigo-200 transition-all hover:shadow-2xl hover:shadow-indigo-50/30 group/card overflow-hidden">
              <div className="flex flex-col lg:flex-row min-h-[360px]">
                
                {/* COMPACT SIDEBAR */}
                <div className="w-full lg:w-60 bg-slate-50/50 border-r border-slate-100 p-6 flex flex-col justify-between shrink-0">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-[13px] mb-3 shadow-sm border border-indigo-200">
                          #{index + 1}
                        </div>
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${batch.status === 'processing' ? 'bg-indigo-600 animate-pulse' : 'bg-slate-300'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <button 
                          onClick={() => openAmazonSearchOnOtherScreen(batch.name)}
                          className="group/link block text-left w-full focus:outline-none"
                        >
                          <h3 className="text-[11px] font-black text-slate-900 uppercase whitespace-normal break-words leading-tight mb-2 hover:text-indigo-600 transition-colors">
                            {batch.name}
                          </h3>
                        </button>
                        <div className="flex flex-wrap gap-1">
                           <span className="text-[7px] font-black bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded uppercase">{batch.images.length} SAMPLE</span>
                           <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${batch.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-indigo-50 text-indigo-600'}`}>{batch.status}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-1.5">
                    {batch.status === 'processing' ? (
                       <button onClick={() => stopBatch(batch.id)} className="w-full bg-red-50 text-red-500 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all border border-red-100">
                         STOP
                       </button>
                    ) : (
                       <div className="space-y-1.5">
                         <button onClick={() => processBatch(batch.id, 'normal')} className="w-full bg-slate-800 text-white py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-700 transition-all shadow-md">
                           NORMAL RUN
                         </button>
                         <button onClick={() => processBatch(batch.id, 'pro')} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md">
                           PRO RUN
                         </button>
                       </div>
                    )}
                    <button onClick={() => removeBatchById(batch.id)} className="w-full text-red-400 py-1.5 font-black text-[8px] uppercase tracking-widest hover:text-red-600">
                      DELETE PROJECT
                    </button>
                  </div>
                </div>

                {/* HORIZONTAL AREA (INPUTS & OUTPUTS) */}
                <div className="flex-1 p-6 flex flex-row items-stretch gap-6 overflow-x-auto custom-scrollbar">
                  
                  {/* ENLARGED INPUTS AREA - Increased to w-44 h-60 (approx 1.35x previous size) */}
                  <div className="flex flex-col gap-3 shrink-0">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5">INPUT REFRENCES</label>
                    <div className="flex flex-row gap-2.5">
                      {[0, 1, 2, 3, 4].map(idx => {
                        const img = batch.images[idx];
                        return (
                          <div 
                            key={img?.id || idx}
                            className="w-44 h-60 rounded-[32px] border-2 border-slate-50 shadow-sm overflow-hidden bg-slate-100 cursor-pointer hover:ring-2 hover:ring-indigo-500/10 transition-all relative group shrink-0"
                            onDragOver={e => e.preventDefault()}
                            onDrop={async e => {
                              e.preventDefault();
                              if (e.dataTransfer.files[0]) {
                                if (img) handleInputDropReplace(batch.id, img.id, e.dataTransfer.files[0]);
                                else handleInputDropAdd(batch.id, e.dataTransfer.files[0]);
                              }
                            }}
                          >
                            {img ? (
                              <>
                                <img src={img.preview} onClick={() => setZoomImage(img.preview)} className="w-full h-full object-cover" />
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteInput(batch.id, img.id); }}
                                  className="absolute top-2.5 right-2.5 z-30 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                              </>
                            ) : (
                              <div 
                                onClick={() => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.onchange = async (e: any) => {
                                    if (e.target.files[0]) handleInputDropAdd(batch.id, e.target.files[0]);
                                  };
                                  input.click();
                                }}
                                className="w-full h-full flex items-center justify-center text-slate-200 hover:text-indigo-400 transition-colors bg-slate-50/50"
                              >
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="w-px bg-slate-100 self-stretch my-4 shrink-0" />

                  {/* REBALANCED OUTPUT AREA (NORMAL) */}
                  <div className="flex flex-col gap-3 shrink-0">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5">NORMAL OUTPUT</label>
                    <div className="flex flex-row gap-3">
                       <div className="w-[285px] h-[390px] rounded-[36px] bg-slate-50 border border-slate-200 overflow-hidden relative group shrink-0 shadow-inner flex flex-col gap-2 p-1.5">
                          {batch.resultsNormal.length > 0 ? (
                            <div 
                              className="w-full h-full rounded-[30px] bg-checkered overflow-hidden relative cursor-pointer group"
                              onClick={() => setEditTarget({ batchId: batch.id, index: 0, data: batch.resultsNormal[0], mode: 'normal' })}
                            >
                               <img src={batch.resultsNormal[0]} className="w-full h-full object-contain relative z-10" />
                               <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center text-white backdrop-blur-[2px]">
                                  <span className="text-[9px] font-black uppercase tracking-widest">REFINE NORMAL</span>
                               </div>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-200">
                               {batch.status === 'processing' && batch.processingMode === 'normal' ? (
                                 <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                               ) : (
                                 <div className="text-center">
                                   <div className="w-24 h-32 border-2 border-slate-100 rounded-[24px] mb-3 mx-auto flex items-center justify-center opacity-30">
                                      <span className="text-[10px] font-black uppercase text-slate-300">IDLE</span>
                                   </div>
                                 </div>
                               )}
                            </div>
                          )}
                       </div>
                       {batch.resultsNormal.slice(1).map((res, i) => (
                         <div key={i} className="w-[285px] h-[390px] rounded-[36px] bg-checkered border border-slate-100 overflow-hidden relative cursor-pointer shadow-sm shrink-0" onClick={() => setEditTarget({ batchId: batch.id, index: i+1, data: res, mode: 'normal' })}>
                           <img src={res} className="w-full h-full object-contain" />
                         </div>
                       ))}
                    </div>
                  </div>

                  {/* REBALANCED OUTPUT AREA (PRO) */}
                  <div className="flex flex-col gap-3 shrink-0">
                    <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest border-b border-indigo-100 pb-1.5">PRO OUTPUT</label>
                    <div className="flex flex-row gap-3">
                       <div className="w-[285px] h-[390px] rounded-[36px] bg-indigo-50/30 border border-indigo-100 overflow-hidden relative group shrink-0 shadow-inner flex flex-col gap-2 p-1.5">
                          {batch.resultsPro.length > 0 ? (
                            <div 
                              className="w-full h-full rounded-[30px] bg-checkered overflow-hidden relative cursor-pointer group"
                              onClick={() => setEditTarget({ batchId: batch.id, index: 0, data: batch.resultsPro[0], mode: 'pro' })}
                            >
                               <img src={batch.resultsPro[0]} className="w-full h-full object-contain relative z-10" />
                               <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center text-white backdrop-blur-[2px]">
                                  <span className="text-[9px] font-black uppercase tracking-widest">REFINE PRO</span>
                               </div>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-indigo-100">
                               {batch.status === 'processing' && batch.processingMode === 'pro' ? (
                                 <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
                               ) : (
                                 <div className="text-center">
                                   <div className="w-24 h-32 border-2 border-indigo-50 rounded-[24px] mb-3 mx-auto flex items-center justify-center opacity-30">
                                      <span className="text-[10px] font-black uppercase text-indigo-200">IDLE</span>
                                   </div>
                                 </div>
                               )}
                            </div>
                          )}
                       </div>
                       {batch.resultsPro.slice(1).map((res, i) => (
                         <div key={i} className="w-[285px] h-[390px] rounded-[36px] bg-checkered border border-indigo-50 overflow-hidden relative cursor-pointer shadow-sm shrink-0" onClick={() => setEditTarget({ batchId: batch.id, index: i+1, data: res, mode: 'pro' })}>
                           <img src={res} className="w-full h-full object-contain" />
                         </div>
                       ))}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          ))}
          {batches.length === 0 && (
            <div className="py-40 flex flex-col items-center justify-center border-4 border-dashed border-slate-100 rounded-[60px] bg-white/50">
               <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 shadow-inner">
                 <svg className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
               </div>
               <h2 className="text-xl font-black text-slate-400 uppercase tracking-tighter">No POD Projects Loaded</h2>
               <p className="text-sm text-slate-400 mt-2 max-w-md text-center">Your pipeline is empty. Import your niche folders to begin the automated design process.</p>
               <button onClick={() => folderInputRef.current?.click()} className="mt-8 bg-indigo-600 text-white px-8 py-4 rounded-3xl font-black text-[12px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200">Upload Folder</button>
            </div>
          )}
        </div>
      </div>

      <input type="file" ref={folderInputRef} className="hidden" multiple onChange={handleFolderUpload} {...({ webkitdirectory: '', directory: '' } as any)} />
      {editTarget && (
        <EditModal 
          image={editTarget.data} 
          batchName={batches.find(b => b.id === editTarget.batchId)?.name || 'design'}
          onClose={() => setEditTarget(null)} 
          onSave={(newB64, applyToAll) => {
            const isPro = editTarget.mode === 'pro';
            const key = isPro ? 'resultsPro' : 'resultsNormal';
            setBatches(p => p.map(b => {
              if (b.id === editTarget.batchId) {
                return { ...b, [key]: b[key].map((r, i) => (i === editTarget.index || applyToAll) ? newB64 : r) };
              }
              return b;
            }));
            if (!applyToAll) setEditTarget(prev => prev ? { ...prev, data: newB64 } : null);
          }}
          onRegenerate={onEditRegenerate}
        />
      )}
      {zoomImage && <Lightbox image={zoomImage} onClose={() => setZoomImage(null)} />}

      <style>{`
        .bg-checkered { background-color: #ffffff; background-image: linear-gradient(45deg, #F8FAFC 25%, transparent 25%), linear-gradient(-45deg, #F8FAFC 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #F8FAFC 75%), linear-gradient(-45deg, transparent 75%, #F8FAFC 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-in { animation: fade-in 0.2s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default App;
