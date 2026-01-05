
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
    return name.replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
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
                  <button onClick={handleUndo} disabled={history.length === 0 || isRegenerating} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50">Undo</button>
                  <button onClick={handleRedo} disabled={redoStack.length === 0 || isRegenerating} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50">Redo</button>
                </div>
                <button onClick={handleRegenerate} disabled={isRegenerating || !prompt.trim()} className="w-full mt-2 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:bg-slate-300">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  Redesign
                </button>
              </div>
            </div>
          </div>
          <div className="p-8 border-t border-slate-50 space-y-3">
            <button onClick={handleDownload} className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              SAVE AS PNG
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [shouldStopGlobal, setShouldStopGlobal] = useState(false);
  const [outputsPerBatch, setOutputsPerBatch] = useState(1);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<{ batchId: string; index: number; data: string; mode: 'normal' | 'pro' } | null>(null);
  const [hasProKey, setHasProKey] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('https://docs.google.com/spreadsheets/d/1Z6oK-BNw8qDNBO9fQ28XOD3eTJzQwdPL6HCePR9uC0U/edit?gid=224107427');

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
    }
  };

  const fetchAsBase64 = async (url: string): Promise<string> => {
    if (!url || !url.startsWith('http')) return "";
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Fetch failed");
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn(`Could not fetch image from ${url}`, e);
      return "";
    }
  };

  const parseCSV = (text: string) => {
    const re = /(?!\s*$)\s*(?:'([^']*)'|"([^"]*)"|([^,]*))\s*(?:,|$)/g;
    const rows: string[][] = [];
    let currentLine: string[] = [];
    let match;

    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      currentLine = [];
      re.lastIndex = 0; 
      while ((match = re.exec(line)) !== null) {
        let val = match[1] || match[2] || match[3] || "";
        currentLine.push(val.trim());
        if (match.index === re.lastIndex) re.lastIndex++;
      }
      rows.push(currentLine);
    }
    return rows;
  };

  const syncFromSheet = async () => {
    if (!sheetUrl.includes('docs.google.com/spreadsheets')) {
      alert("Vui lòng nhập URL Google Sheet hợp lệ.");
      return;
    }

    setIsSyncing(true);
    try {
      const sheetIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      const gidMatch = sheetUrl.match(/gid=([0-9]+)/);
      
      if (!sheetIdMatch) throw new Error("Không tìm thấy Sheet ID trong URL.");
      const sheetId = sheetIdMatch[1];
      const gid = gidMatch ? gidMatch[1] : '0';

      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
      const response = await fetch(csvUrl);
      const csvText = await response.text();
      
      const rows = parseCSV(csvText);

      const dataRows = rows.slice(1);
      const newBatches: BatchItem[] = [];

      for (const row of dataRows) {
        if (!row[0]) continue; 

        const name = row[0];
        const customPrompt = row[11] || row[1] || undefined;
        
        // P-T: indices 15, 16, 17, 18, 19
        const colIndices = [15, 16, 17, 18, 19];
        const imageFiles: (ImageFile | null)[] = [];

        for (const colIdx of colIndices) {
          const url = row[colIdx];
          if (url && url.startsWith('http')) {
            const b64 = await fetchAsBase64(url);
            if (b64) {
              imageFiles.push({
                id: Math.random().toString(36).substr(2, 9),
                file: new File([], "source.png", { type: 'image/png' }),
                preview: url,
                base64: b64
              });
            } else {
              imageFiles.push(null);
            }
          } else {
            imageFiles.push(null);
          }
        }

        newBatches.push({
          id: Math.random().toString(36).substr(2, 9),
          name,
          customPrompt,
          images: imageFiles,
          status: 'idle',
          resultsNormal: [],
          resultsPro: []
        });
      }

      setBatches(newBatches);
    } catch (error: any) {
      alert("Lỗi khi đồng bộ Sheet: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const processBatch = async (batchId: string, mode: 'normal' | 'pro') => {
    const idx = batches.findIndex(b => b.id === batchId);
    if (idx === -1) return;

    setBatches(p => p.map(b => b.id === batchId ? { ...b, status: 'processing', processingMode: mode, error: undefined } : b));

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
      
      setBatches(p => p.map(b => b.id === batchId ? { ...b, status: 'completed', [isPro ? 'resultsPro' : 'resultsNormal']: resUrls } : b));
    } catch (err: any) {
      if (err.message.includes("PRO_KEY_REQUIRED")) {
        handleConnectKey();
      }
      setBatches(p => p.map(b => b.id === batchId ? { ...b, status: 'error', error: err.message } : b));
    }
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

  const downloadProject = async () => {
    const zip = new JSZip();
    for (const batch of batches) {
      if (batch.resultsNormal.length === 0 && batch.resultsPro.length === 0) continue;
      const folder = zip.folder(batch.name);
      if (!folder) continue;
      
      const normalFolder = folder.folder("Normal");
      batch.resultsNormal.forEach((res, i) => {
        normalFolder?.file(`${batch.name} Normal ${i + 1}.png`, res.split(',')[1], { base64: true });
      });

      const proFolder = folder.folder("Pro");
      batch.resultsPro.forEach((res, i) => {
        proFolder?.file(`${batch.name} Pro ${i + 1}.png`, res.split(',')[1], { base64: true });
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
    } catch (e) { alert("Error: " + e); }
  };

  const openAmazonSearch = (keyword: string) => {
    window.open(`https://www.amazon.com/s?k=${encodeURIComponent(keyword)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 font-sans">
      <div className="max-w-[1900px] mx-auto px-6 pt-10">
        
        {/* HEADER AREA */}
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex flex-col gap-6 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-indigo-600 rounded-[22px] flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-indigo-100">G</div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 uppercase leading-none mb-1.5">POD GENIUS <span className="text-indigo-600">SHEET SYNC</span></h1>
                <div className="flex items-center gap-2">
                  <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${hasProKey ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    {hasProKey ? '● PRO ENGINE READY' : '○ CONNECT PRO KEY'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-black uppercase text-slate-400">Qty:</span>
                <select value={outputsPerBatch} onChange={e => setOutputsPerBatch(Number(e.target.value))} className="bg-transparent text-sm font-black text-indigo-600 focus:outline-none cursor-pointer">
                  {[1,2,3,4,5,10].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <button onClick={() => { setShouldStopGlobal(true); setIsProcessingAll(false); }} className="bg-red-50 text-red-500 px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">STOP</button>
              <button disabled={batches.length === 0} onClick={downloadProject} className="bg-white border border-slate-200 text-slate-900 px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">Export ZIP</button>
              <div className="flex gap-2">
                <button disabled={isProcessingAll || batches.length === 0} onClick={() => processAll('normal')} className="bg-slate-900 text-white px-7 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-100">RUN NORMAL</button>
                <button disabled={isProcessingAll || batches.length === 0} onClick={() => processAll('pro')} className="bg-indigo-600 text-white px-7 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">RUN PRO 2K</button>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 p-5 bg-slate-50 rounded-3xl border border-slate-200/60">
             <div className="flex-1 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Source Google Sheet URL (Public View)</label>
                <div className="relative group">
                   <input 
                     type="text" 
                     value={sheetUrl}
                     onChange={(e) => setSheetUrl(e.target.value)}
                     placeholder="Dán link Google Sheet vào đây..."
                     className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                   />
                   <div className="absolute right-3 top-2 bottom-2">
                      <button 
                        onClick={syncFromSheet}
                        disabled={isSyncing}
                        className="h-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {isSyncing ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                        {isSyncing ? 'Syncing...' : 'Sync Data'}
                      </button>
                   </div>
                </div>
             </div>
             <div className="flex-shrink-0 flex items-end">
                <a href="https://docs.google.com/spreadsheets/d/1Z6oK-BNw8qDNBO9fQ28XOD3eTJzQwdPL6HCePR9uC0U/edit?gid=224107427" target="_blank" rel="noreferrer" className="text-[10px] font-black text-indigo-600 uppercase mb-4 hover:underline">Xem mẫu cấu trúc Sheet ↗</a>
             </div>
          </div>
        </div>

        {/* BATCH LIST */}
        <div className="space-y-6">
          {batches.map((batch, index) => (
            <div key={batch.id} className="bg-white rounded-[40px] border border-slate-100 relative shadow-sm hover:border-indigo-200 transition-all hover:shadow-2xl hover:shadow-indigo-50/20 group/card overflow-hidden">
              <div className="flex flex-col lg:flex-row min-h-[400px]">
                
                {/* SIDEBAR */}
                <div className="w-full lg:w-72 bg-slate-50/50 border-r border-slate-100 p-8 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center font-black text-[14px] shadow-sm text-slate-400">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <button onClick={() => openAmazonSearch(batch.name)} className="text-left w-full hover:text-indigo-600 transition-colors">
                          <h3 className="text-[13px] font-black text-slate-900 uppercase leading-tight mb-2 break-words">
                            {batch.name}
                          </h3>
                        </button>
                        <div className="flex flex-wrap gap-1.5">
                           <span className="text-[8px] font-black bg-white border border-slate-200 text-slate-500 px-2 py-1 rounded-lg uppercase">{batch.images.filter(img => !!img).length} REF</span>
                           <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase ${batch.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>{batch.status}</span>
                        </div>
                      </div>
                    </div>
                    {batch.customPrompt && (
                      <div className="bg-white/80 p-3.5 rounded-2xl border border-slate-100 italic text-[11px] text-slate-500 line-clamp-3">
                        "{batch.customPrompt}"
                      </div>
                    )}
                  </div>

                  <div className="mt-8 space-y-2">
                    {batch.status === 'processing' ? (
                       <button onClick={() => setBatches(p => p.map(b => b.id === batch.id ? {...b, status: 'stopping'} : b))} className="w-full bg-red-50 text-red-500 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">STOP BATCH</button>
                    ) : (
                       <div className="grid grid-cols-1 gap-2">
                         <button onClick={() => processBatch(batch.id, 'normal')} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all">GENERATE NORMAL</button>
                         <button onClick={() => processBatch(batch.id, 'pro')} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all">GENERATE PRO 2K</button>
                       </div>
                    )}
                  </div>
                </div>

                {/* HORIZONTAL AREA (INPUTS & OUTPUTS) */}
                <div className="flex-1 p-8 flex flex-row items-stretch gap-8 overflow-x-auto custom-scrollbar">
                  
                  {/* INPUTS AREA - Luôn hiển thị 5 cột */}
                  <div className="flex flex-col gap-4 shrink-0">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">INPUT REFERENCES (5 SLOTS)</label>
                    <div className="flex flex-row gap-3">
                      {[0, 1, 2, 3, 4].map((idx) => {
                        const img = batch.images[idx];
                        return (
                          <div key={idx} className="w-44 h-60 rounded-[32px] border-2 border-slate-50 shadow-sm overflow-hidden bg-slate-50 relative group shrink-0">
                            {img ? (
                              <img src={img.preview} onClick={() => setZoomImage(img.preview)} className="w-full h-full object-cover cursor-zoom-in" alt={`Ref ${idx + 1}`} />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-slate-200 gap-2 border-2 border-dashed border-slate-100 rounded-[32px]">
                                <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Slot {idx + 1} Empty</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="w-px bg-slate-100 self-stretch my-4 shrink-0" />

                  {/* OUTPUT AREA (NORMAL) */}
                  <div className="flex flex-col gap-4 shrink-0">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">NORMAL OUTPUT</label>
                    <div className="flex flex-row gap-3">
                       <div className="w-[300px] h-[400px] rounded-[40px] bg-slate-50 border border-slate-200 overflow-hidden relative group shrink-0 shadow-inner flex flex-col gap-2 p-2">
                          {batch.resultsNormal.length > 0 ? (
                            <div className="w-full h-full rounded-[32px] bg-checkered overflow-hidden relative cursor-pointer group" onClick={() => setEditTarget({ batchId: batch.id, index: 0, data: batch.resultsNormal[0], mode: 'normal' })}>
                               <img src={batch.resultsNormal[0]} className="w-full h-full object-contain relative z-10" />
                               <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center text-white backdrop-blur-[2px]">
                                  <span className="text-[10px] font-black uppercase tracking-widest">REFINE NORMAL</span>
                               </div>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-200">
                               {batch.status === 'processing' && batch.processingMode === 'normal' ? (
                                 <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                               ) : (
                                 <div className="text-center opacity-30">
                                    <div className="w-24 h-32 border-2 border-slate-200 rounded-[24px] mx-auto" />
                                 </div>
                               )}
                            </div>
                          )}
                       </div>
                       {batch.resultsNormal.slice(1).map((res, i) => (
                         <div key={i} className="w-[300px] h-[400px] rounded-[40px] bg-checkered border border-slate-100 overflow-hidden relative cursor-pointer shadow-sm shrink-0" onClick={() => setEditTarget({ batchId: batch.id, index: i+1, data: res, mode: 'normal' })}>
                           <img src={res} className="w-full h-full object-contain" />
                         </div>
                       ))}
                    </div>
                  </div>

                  {/* OUTPUT AREA (PRO) */}
                  <div className="flex flex-col gap-4 shrink-0">
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-indigo-100 pb-2">PRO OUTPUT 2K</label>
                    <div className="flex flex-row gap-3">
                       <div className="w-[300px] h-[400px] rounded-[40px] bg-indigo-50/40 border border-indigo-100 overflow-hidden relative group shrink-0 shadow-inner flex flex-col gap-2 p-2">
                          {batch.resultsPro.length > 0 ? (
                            <div className="w-full h-full rounded-[32px] bg-checkered overflow-hidden relative cursor-pointer group" onClick={() => setEditTarget({ batchId: batch.id, index: 0, data: batch.resultsPro[0], mode: 'pro' })}>
                               <img src={batch.resultsPro[0]} className="w-full h-full object-contain relative z-10" />
                               <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center text-white backdrop-blur-[2px]">
                                  <span className="text-[10px] font-black uppercase tracking-widest">REFINE PRO</span>
                               </div>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-indigo-100">
                               {batch.status === 'processing' && batch.processingMode === 'pro' ? (
                                 <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                               ) : (
                                 <div className="text-center opacity-30">
                                    <div className="w-24 h-32 border-2 border-indigo-200 rounded-[24px] mx-auto" />
                                 </div>
                               )}
                            </div>
                          )}
                       </div>
                       {batch.resultsPro.slice(1).map((res, i) => (
                         <div key={i} className="w-[300px] h-[400px] rounded-[40px] bg-checkered border border-indigo-50 overflow-hidden relative cursor-pointer shadow-sm shrink-0" onClick={() => setEditTarget({ batchId: batch.id, index: i+1, data: res, mode: 'pro' })}>
                           <img src={res} className="w-full h-full object-contain" />
                         </div>
                       ))}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          ))}

          {batches.length === 0 && !isSyncing && (
            <div className="py-48 flex flex-col items-center justify-center border-4 border-dashed border-slate-100 rounded-[60px] bg-white/50 text-center">
               <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center mb-8 shadow-xl shadow-slate-200/50">
                 <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2a4 4 0 014-4h4m-4-4l4 4-4 4m-5 3v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-4a2 2 0 012-2h1m11 4h.01"/></svg>
               </div>
               <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-3">Google Sheets Sync Ready</h2>
               <p className="text-slate-400 max-w-md mx-auto text-sm font-medium">Kết nối link Google Sheet chứa danh sách ý tưởng và hình ảnh tham khảo để bắt đầu quy trình tạo thiết kế tự động.</p>
               <button onClick={syncFromSheet} className="mt-8 bg-indigo-600 text-white px-10 py-5 rounded-3xl font-black text-[12px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-100">Sync Now</button>
            </div>
          )}

          {isSyncing && (
            <div className="py-48 flex flex-col items-center justify-center">
               <div className="w-16 h-16 border-8 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-8" />
               <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest animate-pulse">Fetching Spreadsheet Data...</h2>
               <p className="text-slate-400 mt-3 text-sm font-bold uppercase tracking-widest">Downloading CSV & Fetching Competitor Images</p>
            </div>
          )}
        </div>
      </div>

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
