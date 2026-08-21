import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Upload,
    Plus,
    Trash2,
    Download,
    CheckCircle2,
    Loader2,
    AlertCircle,
    Image as ImageIcon,
    Play,
    Pause,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import JSZip from 'jszip';

// Validates a 7-char hex color string like #ff00aa
const isValidHex = (hex) => /^#[0-9a-f]{6}$/i.test(hex);

// Safely get a value for <input type="color"> — must be valid 7-char hex
const safeHex = (hex) => isValidHex(hex) ? hex : '#000000';

// --- UTILITIES ---
const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
};

// --- COLOR DISTANCE (TOLERANCE) ---
const rgbDistance = (r1, g1, b1, r2, g2, b2) => {
    return Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2));
};

const MAX_COLOR_DIST = Math.sqrt(3 * Math.pow(255, 2)); // ~441.67

const checkerStyle = {
    backgroundImage: 'repeating-linear-gradient(45deg, #1f2937 25%, transparent 25%, transparent 75%, #1f2937 75%, #1f2937), repeating-linear-gradient(45deg, #1f2937 25%, #111827 25%, #111827 75%, #1f2937 75%, #1f2937)',
    backgroundPosition: '0 0, 10px 10px',
    backgroundSize: '20px 20px'
};

// Find a color that isn't used in the image to use as a transparency key
const getUnusedColor = (imageData) => {
    const used = new Set();
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 128) {
            used.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
        }
    }
    for (let r = 0; r < 256; r += 21) {
        for (let g = 0; g < 256; g += 21) {
            for (let b = 0; b < 256; b += 21) {
                if (!used.has(`${r},${g},${b}`)) return [r, g, b];
            }
        }
    }
    return [255, 0, 255]; // Fallback magenta
};

// --- GIF PROCESSING ENGINE ---
const decodeGif = async (arrayBuffer) => {
    // Fix 1: Ensure the ArrayBuffer is cast to a typed Uint8Array 
    // to prevent 'data.subarray is not a function' errors in the GIF parser.
    const gif = parseGIF(new Uint8Array(arrayBuffer));
    const rawFrames = decompressFrames(gif, true);
    const frames = [];

    const canvas = document.createElement('canvas');
    canvas.width = gif.lsd.width;
    canvas.height = gif.lsd.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    for (let i = 0; i < rawFrames.length; i++) {
        const frame = rawFrames[i];

        // Save state for next frame's disposal (method 3)
        if (frame.disposalType === 3) {
            tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.drawImage(canvas, 0, 0);
        }

        // Fix 2: Draw current frame patch with a guard for 0-dimension 
        // or mismatched data lengths that would cause an IndexSizeError crash.
        if (frame.dims.width > 0 && frame.dims.height > 0) {
            const expectedLength = frame.dims.width * frame.dims.height * 4;
            let patchArray = new Uint8ClampedArray(frame.patch);

            // Guard against malformed GIF frame lengths
            if (patchArray.length !== expectedLength) {
                const fixed = new Uint8ClampedArray(expectedLength);
                fixed.set(patchArray.subarray(0, Math.min(patchArray.length, expectedLength)));
                patchArray = fixed;
            }

            const patchData = new ImageData(
                patchArray,
                frame.dims.width,
                frame.dims.height
            );
            const patchCanvas = document.createElement('canvas');
            patchCanvas.width = frame.dims.width;
            patchCanvas.height = frame.dims.height;
            patchCanvas.getContext('2d').putImageData(patchData, 0, 0);
            ctx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);
        }

        // Extract full frame data
        frames.push({
            imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
            delay: Math.max(frame.delay, 20), // Normalize 0-delay to standard 20ms
            width: canvas.width,
            height: canvas.height
        });

        // Apply disposal for NEXT frame
        if (frame.disposalType === 2) {
            ctx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
        } else if (frame.disposalType === 3) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(tempCanvas, 0, 0);
        }
    }
    return frames;
};

const applySourcesToImageData = (imageData, sources, globalNewColor) => {
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;

    const tgt = hexToRgb(globalNewColor);
    const parsedSources = sources.map(s => ({
        src: hexToRgb(s.source),
        tol: (s.tolerance / 100) * MAX_COLOR_DIST
    }));

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue; // Skip fully transparent pixels

        const r = data[i], g = data[i + 1], b = data[i + 2];

        for (let j = 0; j < parsedSources.length; j++) {
            const s = parsedSources[j];
            const dist = rgbDistance(r, g, b, s.src.r, s.src.g, s.src.b);

            if (dist <= s.tol) {
                data[i] = tgt.r;
                data[i + 1] = tgt.g;
                data[i + 2] = tgt.b;
                break; // Apply first matching source
            }
        }
    }
    return new ImageData(data, width, height);
};

const encodeRecoloredGif = (originalFrames, sources, globalNewColor) => {
    if (originalFrames.length === 0) return null;

    const width = originalFrames[0].width;
    const height = originalFrames[0].height;
    const gif = GIFEncoder(); // Note: gifenc exports a factory function

    for (const frame of originalFrames) {
        const recolored = applySourcesToImageData(frame.imageData, sources, globalNewColor);

        // Transparency handling via Key Color
        const keyColor = getUnusedColor(recolored);
        const rgbaPixels = new Uint8Array(width * height * 4);
        const data = recolored.data;

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) { // If transparent, use key color
                rgbaPixels[i] = keyColor[0];
                rgbaPixels[i + 1] = keyColor[1];
                rgbaPixels[i + 2] = keyColor[2];
                rgbaPixels[i + 3] = 255;
            } else {
                rgbaPixels[i] = data[i];
                rgbaPixels[i + 1] = data[i + 1];
                rgbaPixels[i + 2] = data[i + 2];
                rgbaPixels[i + 3] = data[i + 3];
            }
        }

        // gifenc expects 4-channel RGBA data for quantize and applyPalette
        const palette = quantize(rgbaPixels, 255);
        // Force keyColor into palette to avoid it getting averaged out
        palette.push(keyColor);
        const transIndex = palette.length - 1;

        const index = applyPalette(rgbaPixels, palette);

        gif.writeFrame(index, width, height, {
            palette,
            delay: frame.delay,
            transparent: true,
            transparentIndex: transIndex
        });
    }

    gif.finish();
    return gif.bytes();
};


// --- MAIN APP COMPONENT ---
export default function App() {
    const [mode, setMode] = useState('gif'); // 'gif' | 'image'
    const [gifFiles, setGifFiles] = useState([]);
    const [imageFiles, setImageFiles] = useState([]);
    const [selectedGifId, setSelectedGifId] = useState(null);
    const [selectedImageId, setSelectedImageId] = useState(null);

    const files = mode === 'gif' ? gifFiles : imageFiles;
    const setFiles = mode === 'gif' ? setGifFiles : setImageFiles;
    const selectedFileId = mode === 'gif' ? selectedGifId : selectedImageId;
    const setSelectedFileId = mode === 'gif' ? setSelectedGifId : setSelectedImageId;

    const [sources, setSources] = useState([
        { id: '1', source: '#ff0000', tolerance: 20 }
    ]);
    const [globalNewColor, setGlobalNewColor] = useState('#0000ff');
    const [activeSourceId, setActiveSourceId] = useState('1');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);

    // Reset file statuses when color rules change so re-processing works
    const resetFilesToIdle = useCallback(() => {
        setFiles(prev => prev.map(f => f.status === 'done' ? { ...f, status: 'idle', processedBlob: undefined } : f));
    }, []);

    useEffect(() => {
        resetFilesToIdle();
    }, [sources, globalNewColor, resetFilesToIdle]);

    // Live Preview State
    const [previewFrames, setPreviewFrames] = useState([]);
    const [previewStatus, setPreviewStatus] = useState('idle'); // idle, loading, success, error
    const originalCanvasRef = useRef(null);
    const recoloredCanvasRef = useRef(null);
    const animationRef = useRef(null);

    // --- CANVAS INTERACTION ---
    const handleCanvasClick = (e) => {
        if (!activeSourceId) return;
        const canvas = originalCanvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);

        const ctx = canvas.getContext('2d');
        const pixel = ctx.getImageData(x, y, 1, 1).data;

        if (pixel[3] === 0) return; // Skip fully transparent pixels

        const hex = '#' + [pixel[0], pixel[1], pixel[2]]
            .map(v => v.toString(16).padStart(2, '0'))
            .join('');

        setSources(prev => prev.map(s =>
            s.id === activeSourceId ? { ...s, source: hex } : s
        ));
    };

    // --- FILE HANDLING ---
    const handleFileUpload = (e) => {
        const uploadedFiles = Array.from(e.target.files);
        const validTypes = mode === 'gif' 
            ? ['image/gif'] 
            : ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/bmp', 'image/gif'];
        
        const filteredFiles = uploadedFiles.filter(f => validTypes.includes(f.type) || validTypes.some(t => f.name.toLowerCase().endsWith('.' + t.split('/')[1])));
        
        const newFiles = filteredFiles.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            name: file.name,
            status: 'idle', // idle, processing, done, error
            dataUrl: URL.createObjectURL(file)
        }));

        setFiles(prev => [...prev, ...newFiles]);
        if (!selectedFileId && newFiles.length > 0) {
            setSelectedFileId(newFiles[0].id);
        }
    };

    const removeFile = (id) => {
        const fileToRemove = files.find(f => f.id === id);
        if (fileToRemove) {
            URL.revokeObjectURL(fileToRemove.dataUrl);
            if (fileToRemove.processedBlob) {
                // There isn't an object URL stored for processedBlob in the state, but we can clean up if we ever added one
            }
        }
        setFiles(prev => prev.filter(f => f.id !== id));
        if (selectedFileId === id) {
            setSelectedFileId(null);
            setPreviewFrames([]);
            setPreviewStatus('idle');
        }
    };

    // --- PREVIEW LOGIC ---
    useEffect(() => {
        let isCancelled = false;
        const loadPreview = async () => {
            const selected = files.find(f => f.id === selectedFileId);
            if (!selected) {
                setPreviewFrames([]);
                setPreviewStatus('idle');
                return;
            }

            setPreviewStatus('loading');
            try {
                if (mode === 'gif') {
                    const buffer = await selected.file.arrayBuffer();
                    const frames = await decodeGif(buffer);
                    if (isCancelled) return;
                    if (!frames || frames.length === 0) throw new Error("No frames decoded");
                    setPreviewFrames(frames);
                } else {
                    const img = new Image();
                    img.src = selected.dataUrl;
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                    });
                    if (isCancelled) return;
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    
                    setPreviewFrames([{
                        imageData,
                        delay: 1000,
                        width: img.width,
                        height: img.height
                    }]);
                }
                setPreviewStatus('success');
            } catch (err) {
                if (isCancelled) return;
                console.error("Failed to decode for preview:", err);
                setPreviewStatus('error');
                setPreviewFrames([]);
            }
        };
        loadPreview();
        return () => { isCancelled = true; };
    }, [selectedFileId, mode]);

    // Live Animation Loop
    useEffect(() => {
        if (previewFrames.length === 0 || !isPlaying) {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            return;
        }

        let currentFrameIdx = 0;
        let lastDrawTime = performance.now();
        let isFirstDraw = true; // Force instant draw on mount

        const drawFrame = (time) => {
            try {
                const frame = previewFrames[currentFrameIdx];

                if (isFirstDraw || (time - lastDrawTime >= frame.delay)) {
                    const oCtx = originalCanvasRef.current?.getContext('2d');
                    const rCtx = recoloredCanvasRef.current?.getContext('2d');

                    if (oCtx && rCtx && frame.imageData) {
                        // Draw original
                        originalCanvasRef.current.width = frame.width;
                        originalCanvasRef.current.height = frame.height;
                        oCtx.putImageData(frame.imageData, 0, 0);

                        // Apply rules and draw recolored (only if color is valid hex)
                        recoloredCanvasRef.current.width = frame.width;
                        recoloredCanvasRef.current.height = frame.height;
                        if (isValidHex(globalNewColor) && sources.every(s => isValidHex(s.source))) {
                            const recoloredData = applySourcesToImageData(frame.imageData, sources, globalNewColor);
                            rCtx.putImageData(recoloredData, 0, 0);
                        } else {
                            // Show original when colors are invalid (mid-typing)
                            rCtx.putImageData(frame.imageData, 0, 0);
                        }
                    }

                    currentFrameIdx = (currentFrameIdx + 1) % previewFrames.length;
                    lastDrawTime = time;
                    isFirstDraw = false;
                }
            } catch (err) {
                console.error("Render loop error:", err);
            }
            animationRef.current = requestAnimationFrame(drawFrame);
        };

        animationRef.current = requestAnimationFrame(drawFrame);
        return () => cancelAnimationFrame(animationRef.current);
    }, [previewFrames, sources, globalNewColor, isPlaying]);


    // --- BATCH PROCESSING ---
    const processAll = async () => {
        setIsProcessing(true);

        const pendingFiles = files.filter(f => f.status !== 'done');
        if (pendingFiles.length === 0) {
            setIsProcessing(false);
            return;
        }

        if (mode === 'gif') {
            const worker = new Worker(new URL('./src/gifWorker.js', import.meta.url), { type: 'module' });

            let workerFatalError = null;
            const workerErrorListeners = [];
            worker.onerror = (err) => {
                workerFatalError = err;
                workerErrorListeners.forEach(reject => reject(new Error('Worker crashed: ' + (err.message || 'Unknown error'))));
                workerErrorListeners.length = 0;
            };

            for (const fileObj of pendingFiles) {
                if (workerFatalError) {
                    setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'error' } : f));
                    continue;
                }

                setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'processing' } : f));

                try {
                    const buffer = await fileObj.file.arrayBuffer();
                    const result = await new Promise((resolve, reject) => {
                        workerErrorListeners.push(reject);

                        const handleMessage = (e) => {
                            if (e.data.id === fileObj.id) {
                                worker.removeEventListener('message', handleMessage);
                                const idx = workerErrorListeners.indexOf(reject);
                                if (idx !== -1) workerErrorListeners.splice(idx, 1);

                                if (e.data.status === 'done') {
                                    resolve(e.data.bytes);
                                } else {
                                    reject(new Error(e.data.error || 'Worker error'));
                                }
                            }
                        };
                        worker.addEventListener('message', handleMessage);
                        worker.postMessage({
                            id: fileObj.id,
                            arrayBuffer: buffer,
                            sources,
                            globalNewColor
                        }, [buffer]);
                    });

                    const blob = new Blob([result], { type: 'image/gif' });
                    setFiles(prev => prev.map(f =>
                        f.id === fileObj.id ? { ...f, status: 'done', processedBlob: blob } : f
                    ));
                } catch (err) {
                    console.error(`Error processing ${fileObj.name}:`, err);
                    setFiles(prev => prev.map(f =>
                        f.id === fileObj.id ? { ...f, status: 'error' } : f
                    ));
                }
            }
            worker.terminate();
        } else {
            for (const fileObj of pendingFiles) {
                setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'processing' } : f));
                try {
                    const img = new Image();
                    img.src = fileObj.dataUrl;
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                    });
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    
                    await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI to update
                    
                    const recoloredData = applySourcesToImageData(imageData, sources, globalNewColor);
                    ctx.putImageData(recoloredData, 0, 0);
                    
                    let outType = fileObj.file.type;
                    if (!['image/jpeg', 'image/png', 'image/webp'].includes(outType)) {
                        outType = 'image/png';
                    }
                    
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, outType));
                    
                    setFiles(prev => prev.map(f =>
                        f.id === fileObj.id ? { ...f, status: 'done', processedBlob: blob } : f
                    ));
                } catch (err) {
                    console.error(`Error processing ${fileObj.name}:`, err);
                    setFiles(prev => prev.map(f =>
                        f.id === fileObj.id ? { ...f, status: 'error' } : f
                    ));
                }
            }
        }
        setIsProcessing(false);
    };

    const downloadZip = async () => {
        const zip = new JSZip();
        let count = 0;

        files.forEach(f => {
            if (f.status === 'done' && f.processedBlob) {
                zip.file(`recolored-${f.name}`, f.processedBlob);
                count++;
            }
        });

        if (count === 0) return alert("No successfully processed files to download.");

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'RecolorFlow-Batch.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const downloadSingle = (file) => {
        if (!file.processedBlob) return;
        const url = URL.createObjectURL(file.processedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recolored-${file.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // --- UI COMPONENTS ---
    const selectedFile = files.find(f => f.id === selectedFileId);
    const doneCount = files.filter(f => f.status === 'done').length;

    return (
        <div className="min-h-screen bg-gray-950 text-white font-sans flex flex-col">
            
            {/* UNIFIED HEADER */}
            <header className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent flex items-center gap-2">
                        <ImageIcon className="w-7 h-7 text-blue-400" />
                        RecolorFlow
                    </h1>
                    <p className="text-sm font-medium text-gray-300 mt-1">
                        {mode === 'gif' ? 'Bulk recolor animated GIFs' : 'Bulk recolor icons and images'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Replace colors across your digital assets with precision and batch processing.
                    </p>
                </div>
                <div className="flex items-center bg-gray-800 rounded-lg p-1 border border-gray-700 shadow-inner">
                    <button 
                        onClick={() => setMode('gif')}
                        className={`px-6 py-2 text-xs font-bold rounded-md transition-all ${mode === 'gif' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        GIF
                    </button>
                    <button 
                        onClick={() => setMode('image')}
                        className={`px-6 py-2 text-xs font-bold rounded-md transition-all ${mode === 'image' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        IMAGE
                    </button>
                </div>
            </header>

            {/* MAIN WORKSPACE */}
            <div className="flex flex-col md:flex-row h-auto md:h-[calc(100vh-90px)] min-h-[600px] max-h-none md:max-h-[1000px] border-b border-gray-800 bg-gray-950 overflow-y-visible md:overflow-hidden shrink-0">

            {/* LEFT PANEL: File List */}
            <div className="w-full md:w-80 bg-gray-900/50 border-b md:border-b-0 md:border-r border-gray-800 flex flex-col h-[400px] md:h-auto shrink-0">

                <div className="p-4 border-b border-gray-800">
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-700 hover:border-blue-500 hover:bg-gray-800/50 transition-colors rounded-xl cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.target.querySelector('input').click(); }}>
                        <Upload className="w-6 h-6 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-400 font-medium">
                            {mode === 'gif' ? 'Upload GIFs' : 'Upload Icons / Images'}
                        </span>
                        <input 
                            type="file" 
                            multiple 
                            accept={mode === 'gif' ? 'image/gif' : 'image/png,image/jpeg,image/webp,image/bmp,image/gif'} 
                            className="hidden" 
                            onChange={handleFileUpload} 
                        />
                    </label>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 flex flex-col">
                    {files.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 text-sm p-4">
                            <ImageIcon className="w-8 h-8 mb-3 opacity-20" />
                            <p>{mode === 'gif' ? 'No GIFs uploaded yet.' : 'No images uploaded yet.'}</p>
                            <p className="text-xs text-gray-600 mt-1">Upload files above to begin.</p>
                        </div>
                    ) : (
                        files.map(file => (
                            <div
                                key={file.id}
                                onClick={() => setSelectedFileId(file.id)}
                                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedFileId === file.id ? 'bg-blue-600/20 border border-blue-500/50' : 'bg-gray-800/40 hover:bg-gray-800 border border-transparent'}`}
                            >
                                <img src={file.dataUrl} alt={file.name} className="w-10 h-10 rounded object-cover bg-gray-700" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate text-gray-200">{file.name}</p>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        {file.status === 'idle' && <span className="text-xs text-gray-500">Ready</span>}
                                        {file.status === 'processing' && <><Loader2 className="w-3 h-3 animate-spin text-blue-400" /><span className="text-xs text-blue-400">Processing...</span></>}
                                        {file.status === 'done' && <><CheckCircle2 className="w-3 h-3 text-green-400" /><span className="text-xs text-green-400">Done</span></>}
                                        {file.status === 'error' && <><AlertCircle className="w-3 h-3 text-red-400" /><span className="text-xs text-red-400">Failed</span></>}
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    {file.status === 'done' && (
                                        <button onClick={(e) => { e.stopPropagation(); downloadSingle(file); }} className="p-1.5 text-blue-400 hover:text-blue-300 rounded-md" title="Download">
                                            <Download className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); removeFile(file.id); }} className="p-1.5 text-gray-500 hover:text-red-400 rounded-md" title="Remove">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* CENTER PANEL: Preview */}
            <div className="flex-1 flex flex-col relative bg-gray-950 min-h-[400px] md:min-h-0 shrink-0 md:shrink">
                <div className="p-5 flex justify-between items-center border-b border-gray-900">
                    <h2 className="text-sm font-medium text-gray-300">
                        {selectedFile ? `Previewing: ${selectedFile.name}` : 'Live Preview'}
                    </h2>
                    {selectedFile && mode === 'gif' && (
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            {isPlaying ? 'Pause' : 'Play'}
                        </button>
                    )}
                </div>

                <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
                    {!selectedFile ? (
                        <div className="text-center text-gray-600">
                            <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p>Select a file from the left panel to preview.</p>
                        </div>
                    ) : previewStatus === 'loading' ? (
                        <div className="text-center flex flex-col items-center text-blue-400">
                            <Loader2 className="w-10 h-10 mb-3 animate-spin" />
                            <p className="text-sm font-medium">
                                {mode === 'gif' ? 'Decoding GIF frames...' : 'Loading image...'}
                            </p>
                        </div>
                    ) : previewStatus === 'error' ? (
                        <div className="text-center flex flex-col items-center text-red-400">
                            <AlertCircle className="w-10 h-10 mb-3" />
                            <p className="text-sm font-medium">
                                {mode === 'gif' ? 'Failed to preview this GIF.' : 'Failed to preview this image.'}
                            </p>
                            <p className="text-xs text-red-400/70 mt-1">It might be corrupted or an unsupported format.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row gap-8 items-center justify-center w-full max-w-4xl">
                            {/* Original Canvas */}
                            <div className="flex flex-col items-center gap-3">
                                <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase flex items-center gap-2">
                                    Original <span className="bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded text-[10px] normal-case">Click to pick color</span>
                                </span>
                                <div 
                                    className="rounded-xl overflow-hidden border border-gray-800 shadow-2xl relative cursor-crosshair group" 
                                    style={checkerStyle}
                                    title="Click to pick Target Color for the active rule"
                                >
                                    <canvas ref={originalCanvasRef} onClick={handleCanvasClick} className="max-w-[300px] max-h-[300px] object-contain relative z-10" />
                                    <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20" />
                                </div>
                            </div>

                            {/* Recolored Canvas */}
                            <div className="flex flex-col items-center gap-3">
                                <span className="text-xs font-semibold text-blue-400 tracking-wider uppercase flex items-center gap-2">
                                    Recolored <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded text-[10px] normal-case">Current Result</span>
                                </span>
                                <div className="rounded-xl overflow-hidden border border-blue-500/30 shadow-2xl shadow-blue-500/10 relative" style={checkerStyle}>
                                    <canvas ref={recoloredCanvasRef} className="max-w-[300px] max-h-[300px] object-contain" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT PANEL: Controls */}
            <div className="w-full md:w-80 bg-gray-900 border-t md:border-t-0 md:border-l border-gray-800 flex flex-col h-[500px] md:h-auto shrink-0">
                <div className="p-5 border-b border-gray-800">
                    <h2 className="font-semibold text-gray-200">Color Rules</h2>
                    <p className="text-xs text-gray-400 mt-1">Changes are applied top to bottom.</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}>
                    {/* Global New Color Input */}
                    <div className="bg-gray-800/60 border border-blue-500/30 p-4 rounded-xl">
                        <label className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-3 block">New Color (Applied to all below)</label>
                        <div className="flex items-center gap-2 bg-gray-900 p-2 rounded-lg border border-gray-700 focus-within:border-blue-500 transition-colors">
                            <input
                                type="color"
                                value={safeHex(globalNewColor)}
                                onChange={(e) => setGlobalNewColor(e.target.value)}
                                className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                aria-label="Select Global New Color"
                            />
                            <input 
                                type="text" 
                                value={globalNewColor}
                                onChange={(e) => setGlobalNewColor(e.target.value)}
                                className="w-24 bg-transparent border-0 text-sm text-gray-300 uppercase focus:ring-0 p-0 outline-none font-mono"
                                maxLength={7}
                                spellCheck={false}
                                aria-label="Enter Global New Color Hex"
                            />
                        </div>
                    </div>

                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-2 border-t border-gray-800 mt-4">Target Colors to Replace</div>
                    
                    {sources.map((source, idx) => (
                        <div 
                            key={source.id} 
                            onClick={() => setActiveSourceId(source.id)}
                            className={`bg-gray-800/60 border p-4 rounded-xl relative cursor-pointer transition-all ${activeSourceId === source.id ? 'border-blue-500 ring-1 ring-blue-500/50 shadow-lg shadow-blue-900/20' : 'border-gray-700 hover:border-gray-500'}`}
                        >
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const newSources = sources.filter(s => s.id !== source.id);
                                    setSources(newSources);
                                    if (activeSourceId === source.id && newSources.length > 0) {
                                        setActiveSourceId(newSources[0].id);
                                    }
                                }}
                                className="absolute top-1 right-1 p-2 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors"
                                aria-label={`Delete Target Color ${idx + 1}`}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>

                            <div className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wide">Target Color {idx + 1}</div>

                            <div className="flex items-center gap-2 bg-gray-900 p-1.5 rounded-lg border border-gray-700 focus-within:border-blue-500 transition-colors mb-4">
                                <input
                                    type="color"
                                    value={safeHex(source.source)}
                                    onChange={(e) => setSources(sources.map(s => s.id === source.id ? { ...s, source: e.target.value } : s))}
                                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                    aria-label={`Select Target Color ${idx + 1}`}
                                />
                                <input 
                                    type="text" 
                                    value={source.source}
                                    onChange={(e) => setSources(sources.map(s => s.id === source.id ? { ...s, source: e.target.value } : s))}
                                    className="w-14 min-w-0 bg-transparent border-0 text-xs text-gray-300 uppercase focus:ring-0 p-0 outline-none"
                                    maxLength={7}
                                    spellCheck={false}
                                    aria-label={`Enter Target Color ${idx + 1} Hex`}
                                />
                            </div>

                            <div className="flex flex-col gap-2 pt-4 border-t border-gray-700/50">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs text-gray-400">Match Range (Tolerance)</label>
                                    <span className="text-xs text-blue-400 font-medium">{source.tolerance}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0" max="100"
                                    value={source.tolerance}
                                    onChange={(e) => setSources(sources.map(s => s.id === source.id ? { ...s, tolerance: parseInt(e.target.value) } : s))}
                                    className="w-full accent-blue-500 bg-gray-700 h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                                    aria-label={`Match Range for Target Color ${idx + 1}`}
                                />
                                <span className="text-[10px] text-gray-500 leading-tight">Increase to include similar surrounding colors (anti-aliasing, compression noise)</span>
                            </div>
                        </div>
                    ))}

                    <button
                        onClick={() => {
                            const newId = Math.random().toString();
                            setSources([...sources, { id: newId, source: '#ffffff', tolerance: 20 }]);
                            setActiveSourceId(newId);
                        }}
                        className="w-full py-2.5 flex items-center justify-center gap-2 text-sm text-gray-400 border border-dashed border-gray-700 rounded-xl hover:border-blue-500 hover:text-blue-400 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Add Target Color
                    </button>
                </div>

                <div className="p-4 border-t border-gray-800 bg-gray-900 flex flex-col gap-3">
                    <button
                        onClick={processAll}
                        disabled={files.length === 0 || isProcessing || !isValidHex(globalNewColor) || !sources.every(s => isValidHex(s.source))}
                        className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${(files.length === 0 || !isValidHex(globalNewColor) || !sources.every(s => isValidHex(s.source))) ? 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50' :
                                isProcessing ? 'bg-blue-600/50 text-blue-200 cursor-wait' :
                                    'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                            }`}
                    >
                        {isProcessing ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Processing... {files.filter(f => f.status === 'processing' || f.status === 'done').length} / {files.length} files</>
                        ) : doneCount === files.length && files.length > 0 ? (
                            <><CheckCircle2 className="w-5 h-5" /> Processed {files.length} files</>
                        ) : (
                            `Apply to ${files.length} ${mode === 'gif' ? (files.length === 1 ? 'GIF' : 'GIFs') : (files.length === 1 ? 'Image' : 'Images')}`
                        )}
                    </button>

                    <button
                        onClick={downloadZip}
                        disabled={doneCount === 0 || isProcessing}
                        className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${doneCount === 0 || isProcessing ? 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50' :
                                'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20'
                            }`}
                    >
                        <Download className="w-5 h-5" /> Download ZIP
                    </button>
                </div>
            </div>
            </div>

            {/* QUICK "HOW IT WORKS" STRIP */}
            <div className="border-b border-gray-900 bg-gray-950 shrink-0">
                <div className="max-w-6xl mx-auto px-6 py-12">
                    <h2 className="sr-only">How it works</h2>
                    <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="bg-blue-600/20 text-blue-400 text-xs font-bold px-2 py-0.5 rounded">01</span>
                                <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">Upload</h3>
                            </div>
                            <p className="text-sm text-gray-400">Add your GIFs or images.</p>
                        </div>
                        <div className="hidden md:block text-gray-800 mt-2">→</div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="bg-blue-600/20 text-blue-400 text-xs font-bold px-2 py-0.5 rounded">02</span>
                                <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">Choose Colors</h3>
                            </div>
                            <p className="text-sm text-gray-400">Select the colors to replace.</p>
                        </div>
                        <div className="hidden md:block text-gray-800 mt-2">→</div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="bg-blue-600/20 text-blue-400 text-xs font-bold px-2 py-0.5 rounded">03</span>
                                <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">Preview</h3>
                            </div>
                            <p className="text-sm text-gray-400">Check the result.</p>
                        </div>
                        <div className="hidden md:block text-gray-800 mt-2">→</div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="bg-blue-600/20 text-blue-400 text-xs font-bold px-2 py-0.5 rounded">04</span>
                                <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">Apply</h3>
                            </div>
                            <p className="text-sm text-gray-400">Process your files.</p>
                        </div>
                        <div className="hidden md:block text-gray-800 mt-2">→</div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="bg-blue-600/20 text-blue-400 text-xs font-bold px-2 py-0.5 rounded">05</span>
                                <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">Download</h3>
                            </div>
                            <p className="text-sm text-gray-400">Save your recolored files.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* DETAILED DOCUMENTATION */}
            <div className="flex-1 bg-gray-950 text-gray-300">
                <div className="max-w-[1100px] mx-auto px-6 py-16 lg:py-24 space-y-24">
                    
                    {/* FAQ SECTION */}
                    <section>
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold text-gray-100 mb-3">Frequently Asked Questions</h2>
                            <p className="text-gray-400">Everything you need to know about recoloring your assets.</p>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-x-12 gap-y-10">
                            {/* General */}
                            <div>
                                <h3 className="text-blue-400 font-bold uppercase tracking-wider text-sm mb-4 border-b border-gray-800 pb-2">General</h3>
                                <div className="space-y-3">
                                    <FAQItem question="What is RecolorFlow?">RecolorFlow is a browser-based tool for recoloring GIFs, icons, and images in bulk. It allows you to replace selected colors with a new color while controlling how closely surrounding colors should match.</FAQItem>
                                    <FAQItem question="What file types are supported?">RecolorFlow supports animated GIFs and common image formats such as PNG, JPG/JPEG, and WEBP. The interface clearly indicates supported formats based on the currently selected mode.</FAQItem>
                                    <FAQItem question="Can I recolor multiple files at once?">Yes. RecolorFlow is designed for batch processing. Upload multiple files, configure your color rules, and apply the changes to the selected files.</FAQItem>
                                </div>
                            </div>
                            
                            {/* Color Replacement */}
                            <div>
                                <h3 className="text-blue-400 font-bold uppercase tracking-wider text-sm mb-4 border-b border-gray-800 pb-2">Color Replacement</h3>
                                <div className="space-y-3">
                                    <FAQItem question="How does color replacement work?">You select a target color and choose a new color (e.g., Red → Blue). This replaces the selected color across the image.</FAQItem>
                                    <FAQItem question="What is Match Range / Tolerance?">Tolerance controls how closely a color must match the selected target color before it is replaced. A higher tolerance includes more similar colors to help with anti-aliasing and compression artifacts.</FAQItem>
                                    <FAQItem question="Can I replace multiple colors?">Yes. You can add multiple target colors and configure several color replacement rules. They are applied in the order displayed in the Color Rules panel.</FAQItem>
                                    <FAQItem question="Why isn't my color being replaced?">Check that the target color is correct, increase the tolerance slightly, confirm the selected file contains the target color, and check the Live Preview.</FAQItem>
                                </div>
                            </div>

                            {/* Files & Processing */}
                            <div>
                                <h3 className="text-blue-400 font-bold uppercase tracking-wider text-sm mb-4 border-b border-gray-800 pb-2">Files & Processing</h3>
                                <div className="space-y-3">
                                    <FAQItem question="Will transparent PNGs remain transparent?">Yes. Transparency is preserved when processing supported transparent image formats.</FAQItem>
                                    <FAQItem question="Will animated GIFs remain animated?">Yes. Animated GIFs retain their animation frames when processed through GIF Mode.</FAQItem>
                                    <FAQItem question="Are my original files changed?">No. RecolorFlow creates processed copies rather than modifying the original files you selected.</FAQItem>
                                    <FAQItem question="Does RecolorFlow upload my files?">Your files are processed directly in your browser and do not need to be uploaded to a server.</FAQItem>
                                </div>
                            </div>

                            {/* Troubleshooting */}
                            <div>
                                <h3 className="text-blue-400 font-bold uppercase tracking-wider text-sm mb-4 border-b border-gray-800 pb-2">Troubleshooting</h3>
                                <div className="space-y-3">
                                    <FAQItem question="Why does my image look different?">Image formats can contain anti-aliased pixels, compression artifacts, and multiple shades of similar colors. The tolerance setting affects how surrounding colors are handled.</FAQItem>
                                    <FAQItem question="Why is the Apply button disabled?">The button becomes active when there is at least one valid uploaded file ready for processing and valid colors are entered.</FAQItem>
                                    <FAQItem question="How do I download processed files?">After processing, use the Download ZIP button to download all the generated files together.</FAQItem>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* GUIDE SECTION */}
                    <section>
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold text-gray-100 mb-3">Detailed Guide</h2>
                            <p className="text-gray-400">Master the recoloring workflow.</p>
                        </div>
                        
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="bg-gray-900/40 border border-gray-800 p-6 rounded-xl hover:border-gray-700 transition-colors flex flex-col h-full">
                                <div className="text-blue-400 text-sm font-bold tracking-wider mb-2">01</div>
                                <h3 className="text-lg font-medium text-gray-200 mb-2">Choose a Mode</h3>
                                <p className="text-sm text-gray-400">Choose GIF Mode for animated GIFs or Image Mode for icons and static images.</p>
                            </div>

                            <div className="bg-gray-900/40 border border-gray-800 p-6 rounded-xl hover:border-gray-700 transition-colors flex flex-col h-full">
                                <div className="text-blue-400 text-sm font-bold tracking-wider mb-2">02</div>
                                <h3 className="text-lg font-medium text-gray-200 mb-2">Upload Files</h3>
                                <p className="text-sm text-gray-400">Upload one or multiple supported files for batch processing.</p>
                            </div>

                            <div className="bg-gray-900/40 border border-gray-800 p-6 rounded-xl hover:border-gray-700 transition-colors flex flex-col h-full">
                                <div className="text-blue-400 text-sm font-bold tracking-wider mb-2">03</div>
                                <h3 className="text-lg font-medium text-gray-200 mb-2">Configure Colors</h3>
                                <p className="text-sm text-gray-400">Choose the target color, replacement color, and adjust the tolerance.</p>
                            </div>

                            <div className="bg-gray-900/40 border border-gray-800 p-6 rounded-xl hover:border-gray-700 transition-colors flex flex-col h-full">
                                <div className="text-blue-400 text-sm font-bold tracking-wider mb-2">04</div>
                                <h3 className="text-lg font-medium text-gray-200 mb-2">Preview</h3>
                                <p className="text-sm text-gray-400">Select a file and verify the color replacements in Live Preview.</p>
                            </div>

                            <div className="bg-gray-900/40 border border-gray-800 p-6 rounded-xl hover:border-gray-700 transition-colors flex flex-col h-full">
                                <div className="text-blue-400 text-sm font-bold tracking-wider mb-2">05</div>
                                <h3 className="text-lg font-medium text-gray-200 mb-2">Apply</h3>
                                <p className="text-sm text-gray-400">Process the selected files directly in your browser.</p>
                            </div>

                            <div className="bg-gray-900/40 border border-gray-800 p-6 rounded-xl hover:border-gray-700 transition-colors flex flex-col h-full">
                                <div className="text-blue-400 text-sm font-bold tracking-wider mb-2">06</div>
                                <h3 className="text-lg font-medium text-gray-200 mb-2">Download</h3>
                                <p className="text-sm text-gray-400">Download the completed files collectively as a ZIP archive.</p>
                            </div>
                        </div>

                        {/* USE CASES & TRUST */}
                        <div className="mt-16 text-center">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6">Best For</h3>
                            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm text-gray-300">
                                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500"/> Game Assets</span>
                                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500"/> UI & Web Design</span>
                                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500"/> Branding</span>
                                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500"/> Batch Editing</span>
                            </div>
                            <div className="mt-12 inline-flex items-center gap-2 bg-gray-900/60 border border-gray-800 text-gray-400 text-xs px-5 py-2.5 rounded-full">
                                <AlertCircle className="w-4 h-4 shrink-0 text-blue-400" />
                                Your files are processed locally in your browser and are not uploaded to a server.
                            </div>
                        </div>
                    </section>
                </div>
            </div>
            
            {/* FOOTER */}
            <footer className="border-t border-gray-900 bg-black py-8 text-center">
                <div className="max-w-[1100px] mx-auto px-6 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 font-bold text-gray-300">
                        <ImageIcon className="w-5 h-5 text-blue-500" /> RecolorFlow
                    </div>
                    <p className="text-sm text-gray-500">Bulk image and GIF recoloring</p>
                    <p className="text-xs text-gray-600 mt-4">Created by Mistiso A. Judyawon</p>
                    <p className="text-xs text-gray-600">© 2026 RecolorFlow</p>
                </div>
            </footer>
        </div>
    );
}

const FAQItem = ({ question, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border border-gray-800/80 rounded-xl bg-gray-900/40 overflow-hidden group transition-colors hover:border-gray-700">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:bg-gray-800/60 transition-colors"
                aria-expanded={isOpen}
            >
                <span className={`font-medium text-sm transition-colors ${isOpen ? 'text-blue-400' : 'text-gray-300 group-hover:text-gray-200'}`}>{question}</span>
                <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-400' : 'text-gray-500 group-hover:text-gray-400'}`} />
            </button>
            <div className={`grid transition-all duration-200 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                    <div className="px-5 pb-5 pt-2 text-gray-400 text-sm leading-relaxed border-t border-gray-800/50 mt-1">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};