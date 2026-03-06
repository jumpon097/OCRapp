
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { OCRResult, ProcessState, ProcessingStatus } from './types';
import { extractTextFromImage, summarizeText, translateText } from './services/geminiService';
import { UploadIcon, CameraIcon, LoadingIcon, HistoryIcon, CopyIcon, CheckIcon } from './components/Icons';
import Button from './components/Button';

const App: React.FC = () => {
  const [history, setHistory] = useState<OCRResult[]>([]);
  const [currentResult, setCurrentResult] = useState<OCRResult | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ state: ProcessState.IDLE });
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history from local storage
  useEffect(() => {
    const saved = localStorage.getItem('ocr_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history to local storage
  useEffect(() => {
    localStorage.setItem('ocr_history', JSON.stringify(history));
  }, [history]);

  const handleProcessImage = async (base64Image: string) => {
    try {
      setStatus({ state: ProcessState.PROCESSING, message: 'Gemini is reading the image...' });
      const text = await extractTextFromImage(base64Image);
      
      const newResult: OCRResult = {
        id: crypto.randomUUID(),
        originalImage: base64Image,
        extractedText: text,
        timestamp: Date.now(),
      };

      setCurrentResult(newResult);
      setHistory(prev => [newResult, ...prev.slice(0, 19)]); // Keep last 20
      setStatus({ state: ProcessState.SUCCESS });
      setShowHistory(false);
    } catch (error) {
      console.error(error);
      setStatus({ state: ProcessState.ERROR, message: error instanceof Error ? error.message : 'Processing failed' });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      await handleProcessImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSummarize = async () => {
    if (!currentResult) return;
    try {
      setStatus({ state: ProcessState.PROCESSING, message: 'Creating summary...' });
      const summary = await summarizeText(currentResult.extractedText);
      const updated = { ...currentResult, summary };
      setCurrentResult(updated);
      setHistory(prev => prev.map(item => item.id === updated.id ? updated : item));
      setStatus({ state: ProcessState.SUCCESS });
    } catch (error) {
      setStatus({ state: ProcessState.ERROR, message: 'Summarization failed' });
    }
  };

  const handleTranslate = async (lang: string) => {
    if (!currentResult) return;
    try {
      setStatus({ state: ProcessState.PROCESSING, message: `Translating to ${lang}...` });
      const translation = await translateText(currentResult.extractedText, lang);
      const updated = { ...currentResult, translation };
      setCurrentResult(updated);
      setHistory(prev => prev.map(item => item.id === updated.id ? updated : item));
      setStatus({ state: ProcessState.SUCCESS });
    } catch (error) {
      setStatus({ state: ProcessState.ERROR, message: 'Translation failed' });
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraOpen(true);
      }
    } catch (err) {
      alert("Camera access denied or unavailable.");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      
      // Stop camera
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setIsCameraOpen(false);
      
      handleProcessImage(dataUrl);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(type);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center pb-12">
      {/* Navbar */}
      <header className="w-full h-16 glass-panel sticky top-0 z-50 px-4 md:px-8 flex items-center justify-between border-b">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setCurrentResult(null); setShowHistory(false); }}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">O</div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">ocrOCR</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" icon={<HistoryIcon className="w-5 h-5" />} onClick={() => setShowHistory(!showHistory)}>
            History
          </Button>
          <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()}>
            <UploadIcon className="w-4 h-4 mr-2" /> New Scan
          </Button>
        </div>
      </header>

      <main className="w-full max-w-5xl px-4 mt-8 flex-1">
        {status.state === ProcessState.PROCESSING && (
          <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center transition-opacity">
            <div className="bg-white p-8 rounded-3xl shadow-2xl border flex flex-col items-center gap-4 max-w-sm text-center">
              <LoadingIcon className="w-12 h-12 text-indigo-600 animate-spin" />
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Processing with Gemini</h3>
                <p className="text-slate-500 mt-1">{status.message}</p>
              </div>
            </div>
          </div>
        )}

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileChange} 
        />

        {/* Empty State / Dashboard */}
        {!currentResult && !showHistory && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 mb-6">
              <CameraIcon className="w-12 h-12" />
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-4">Transform Images into Insights</h1>
            <p className="text-slate-500 text-lg max-w-xl mb-10">
              Advanced text extraction, summarization, and translation powered by Google Gemini 3.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
              <Button 
                variant="primary" 
                size="lg" 
                className="flex-1 py-6 rounded-2xl" 
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon className="w-6 h-6 mr-3" />
                Upload Image
              </Button>
              <Button 
                variant="secondary" 
                size="lg" 
                className="flex-1 py-6 rounded-2xl" 
                onClick={startCamera}
              >
                <CameraIcon className="w-6 h-6 mr-3" />
                Use Camera
              </Button>
            </div>
          </div>
        )}

        {/* Camera Modal */}
        {isCameraOpen && (
          <div className="fixed inset-0 bg-slate-900 z-[60] flex flex-col">
            <video ref={videoRef} autoPlay playsInline className="flex-1 object-contain" />
            <div className="p-8 flex items-center justify-between bg-slate-900/80 backdrop-blur-md">
              <Button variant="ghost" className="text-white" onClick={() => {
                const stream = videoRef.current?.srcObject as MediaStream;
                stream?.getTracks().forEach(t => t.stop());
                setIsCameraOpen(false);
              }}>Cancel</Button>
              <button 
                onClick={capturePhoto}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center group"
              >
                <div className="w-16 h-16 rounded-full bg-white group-active:scale-95 transition-transform"></div>
              </button>
              <div className="w-20"></div> {/* Spacer */}
            </div>
          </div>
        )}

        {/* Result View */}
        {currentResult && !showHistory && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start mb-12">
            {/* Left Column: Image & Actions */}
            <div className="space-y-6">
              <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-100 group relative">
                <img 
                  src={currentResult.originalImage} 
                  alt="Original" 
                  className="w-full h-auto object-cover max-h-[500px]"
                />
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Button variant="secondary" size="sm" onClick={() => setCurrentResult(null)}>Close</Button>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-3xl shadow-md border border-slate-100 space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                  AI Enhancement
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" size="sm" onClick={handleSummarize} disabled={!!currentResult.summary}>
                    Summarize
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleTranslate('Spanish')} disabled={!!currentResult.translation}>
                    To Spanish
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleTranslate('French')} disabled={!!currentResult.translation}>
                    To French
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleTranslate('Japanese')} disabled={!!currentResult.translation}>
                    To Japanese
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Column: Text Results */}
            <div className="space-y-6">
              {/* Extracted Text */}
              <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col min-h-[400px]">
                <div className="p-4 border-b flex items-center justify-between bg-slate-50">
                  <span className="font-semibold text-slate-700">Extracted Text</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    icon={copyFeedback === 'text' ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
                    onClick={() => copyToClipboard(currentResult.extractedText, 'text')}
                  >
                    {copyFeedback === 'text' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <div className="p-6 flex-1 overflow-y-auto whitespace-pre-wrap text-slate-700 font-mono text-sm leading-relaxed">
                  {currentResult.extractedText}
                </div>
              </div>

              {/* Summary */}
              {currentResult.summary && (
                <div className="bg-indigo-50/50 rounded-3xl border border-indigo-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="p-4 border-b border-indigo-100 flex items-center justify-between bg-indigo-100/50">
                    <span className="font-semibold text-indigo-900 flex items-center gap-2">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                      AI Summary
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-indigo-700 hover:bg-indigo-200"
                      icon={copyFeedback === 'summary' ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
                      onClick={() => copyToClipboard(currentResult.summary!, 'summary')}
                    >
                      {copyFeedback === 'summary' ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <div className="p-6 text-indigo-900 leading-relaxed italic">
                    {currentResult.summary}
                  </div>
                </div>
              )}

              {/* Translation */}
              {currentResult.translation && (
                <div className="bg-emerald-50/50 rounded-3xl border border-emerald-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="p-4 border-b border-emerald-100 flex items-center justify-between bg-emerald-100/50">
                    <span className="font-semibold text-emerald-900 flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      Translation
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-emerald-700 hover:bg-emerald-200"
                      icon={copyFeedback === 'translation' ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
                      onClick={() => copyToClipboard(currentResult.translation!, 'translation')}
                    >
                      {copyFeedback === 'translation' ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <div className="p-6 text-emerald-900 leading-relaxed">
                    {currentResult.translation}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History List */}
        {showHistory && (
          <div className="animate-in fade-in zoom-in-95 duration-200 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-slate-900">Scan History</h2>
              <Button variant="ghost" onClick={() => setShowHistory(false)}>Back to Camera</Button>
            </div>
            
            {history.length === 0 ? (
              <div className="bg-white rounded-3xl p-20 text-center border border-dashed border-slate-300">
                <p className="text-slate-400 text-lg">No history yet. Start scanning to see them here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {history.map((item) => (
                  <div 
                    key={item.id} 
                    className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl transition-all cursor-pointer group"
                    onClick={() => {
                      setCurrentResult(item);
                      setShowHistory(false);
                    }}
                  >
                    <div className="aspect-[4/3] relative overflow-hidden">
                      <img src={item.originalImage} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white font-semibold">View Result</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-slate-800 text-sm line-clamp-2 mb-2 font-mono">
                        {item.extractedText.slice(0, 80)}...
                      </p>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-xs text-slate-400">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                        {item.summary && (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase">Summary</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {history.length > 0 && (
              <div className="mt-12 flex justify-center">
                <Button variant="danger" outline onClick={() => {
                  if (confirm("Clear all history?")) {
                    setHistory([]);
                  }
                }}>Clear All History</Button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="mt-20 py-10 border-t w-full text-center text-slate-400 text-sm">
        <p>&copy; 2024 ocrOCR. High-Fidelity Intelligence.</p>
        <p className="mt-1">Built with Gemini 3 Flash</p>
      </footer>
    </div>
  );
};

export default App;
