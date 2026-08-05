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
    Pause
} from 'lucide-react';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import JSZip from 'jszip';

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
    const [files, setFiles] = useState([]);
    const [selectedFileId, setSelectedFileId] = useState(null);
    const [sources, setSources] = useState([
        { id: '1', source: '#ff0000', tolerance: 20 }
    ]);
    const [globalNewColor, setGlobalNewColor] = useState('#0000ff');
    const [activeSourceId, setActiveSourceId] = useState('1');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);

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
        const uploadedFiles = Array.from(e.target.files).filter(f => f.type === 'image/gif');
        const newFiles = uploadedFiles.map(file => ({
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
                const buffer = await selected.file.arrayBuffer();
                const frames = await decodeGif(buffer);
                if (isCancelled) return;
                if (!frames || frames.length === 0) throw new Error("No frames decoded");
                setPreviewFrames(frames);
                setPreviewStatus('success');
            } catch (err) {
                if (isCancelled) return;
                console.error("Failed to decode GIF for preview:", err);
                setPreviewStatus('error');
                setPreviewFrames([]);
            }
        };
        loadPreview();
        return () => { isCancelled = true; };
    }, [selectedFileId]);

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

                        // Apply rules and draw recolored
                        recoloredCanvasRef.current.width = frame.width;
                        recoloredCanvasRef.current.height = frame.height;
                        const recoloredData = applySourcesToImageData(frame.imageData, sources, globalNewColor);
                        rCtx.putImageData(recoloredData, 0, 0);
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

        const updatedFiles = [...files];

        for (let i = 0; i < updatedFiles.length; i++) {
            const fileObj = updatedFiles[i];
            if (fileObj.status === 'done') continue; // Skip already done

            // Update UI to show processing
            setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'processing' } : f));

            // Let React render the 'processing' state before heavy lifting
            await new Promise(resolve => setTimeout(resolve, 50));

            try {
                const buffer = await fileObj.file.arrayBuffer();
                const frames = await decodeGif(buffer);
                const encodedBytes = encodeRecoloredGif(frames, sources, globalNewColor);
                const blob = new Blob([encodedBytes], { type: 'image/gif' });

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
        <div className="flex h-screen bg-gray-950 text-white font-sans overflow-hidden">

            {/* LEFT PANEL: File List */}
            <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col">
                <div className="p-5 border-b border-gray-800">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent flex items-center gap-2">
                        <ImageIcon className="w-6 h-6 text-blue-400" />
                        RecolorFlow
                    </h1>
                    <p className="text-xs text-gray-400 mt-1">Bulk recolor animated GIFs</p>
                </div>

                <div className="p-4 border-b border-gray-800">
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-700 hover:border-blue-500 hover:bg-gray-800/50 transition-colors rounded-xl cursor-pointer">
                        <Upload className="w-6 h-6 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-400 font-medium">Upload GIFs</span>
                        <input type="file" multiple accept="image/gif" className="hidden" onChange={handleFileUpload} />
                    </label>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {files.length === 0 ? (
                        <div className="text-center text-gray-500 text-sm mt-10">No files uploaded yet.</div>
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
            <div className="flex-1 flex flex-col relative bg-gray-950">
                <div className="p-5 flex justify-between items-center border-b border-gray-900">
                    <h2 className="text-sm font-medium text-gray-300">
                        {selectedFile ? `Previewing: ${selectedFile.name}` : 'Live Preview'}
                    </h2>
                    {selectedFile && (
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
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
                            <p>Select a GIF from the left panel to preview.</p>
                        </div>
                    ) : previewStatus === 'loading' ? (
                        <div className="text-center flex flex-col items-center text-blue-400">
                            <Loader2 className="w-10 h-10 mb-3 animate-spin" />
                            <p className="text-sm font-medium">Decoding GIF frames...</p>
                        </div>
                    ) : previewStatus === 'error' ? (
                        <div className="text-center flex flex-col items-center text-red-400">
                            <AlertCircle className="w-10 h-10 mb-3" />
                            <p className="text-sm font-medium">Failed to preview this GIF.</p>
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
                                <span className="text-xs font-semibold text-blue-400 tracking-wider uppercase">Recolored</span>
                                <div className="rounded-xl overflow-hidden border border-blue-500/30 shadow-2xl shadow-blue-500/10 relative" style={checkerStyle}>
                                    <canvas ref={recoloredCanvasRef} className="max-w-[300px] max-h-[300px] object-contain" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT PANEL: Controls */}
            <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
                <div className="p-5 border-b border-gray-800">
                    <h2 className="font-semibold text-gray-200">Color Rules</h2>
                    <p className="text-xs text-gray-400 mt-1">Changes are applied top to bottom.</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Global New Color Input */}
                    <div className="bg-gray-800/60 border border-blue-500/30 p-4 rounded-xl">
                        <label className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-3 block">New Color (Applied to all below)</label>
                        <div className="flex items-center gap-2 bg-gray-900 p-2 rounded-lg border border-gray-700 focus-within:border-blue-500 transition-colors">
                            <input
                                type="color"
                                value={globalNewColor}
                                onChange={(e) => setGlobalNewColor(e.target.value)}
                                className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
                            />
                            <input 
                                type="text" 
                                value={globalNewColor}
                                onChange={(e) => setGlobalNewColor(e.target.value)}
                                className="w-24 bg-transparent border-0 text-sm text-gray-300 uppercase focus:ring-0 p-0 outline-none font-mono"
                                maxLength={7}
                                spellCheck={false}
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
                                className="absolute top-2 right-2 p-1 text-gray-500 hover:text-red-400 z-10"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>

                            <div className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wide">Target Color {idx + 1}</div>

                            <div className="flex items-center gap-2 bg-gray-900 p-1.5 rounded-lg border border-gray-700 focus-within:border-blue-500 transition-colors mb-4">
                                <input
                                    type="color"
                                    value={source.source}
                                    onChange={(e) => setSources(sources.map(s => s.id === source.id ? { ...s, source: e.target.value } : s))}
                                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
                                />
                                <input 
                                    type="text" 
                                    value={source.source}
                                    onChange={(e) => setSources(sources.map(s => s.id === source.id ? { ...s, source: e.target.value } : s))}
                                    className="w-14 min-w-0 bg-transparent border-0 text-xs text-gray-300 uppercase focus:ring-0 p-0 outline-none"
                                    maxLength={7}
                                    spellCheck={false}
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
                                    className="w-full accent-blue-500 bg-gray-700 h-1.5 rounded-lg appearance-none cursor-pointer"
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
                        disabled={files.length === 0 || isProcessing}
                        className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${files.length === 0 ? 'bg-gray-800 text-gray-500 cursor-not-allowed' :
                                isProcessing ? 'bg-blue-600/50 text-blue-200 cursor-wait' :
                                    'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                            }`}
                    >
                        {isProcessing ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Processing {files.filter(f => f.status === 'processing').length} / {files.length}</>
                        ) : (
                            `Apply to ${files.length} GIF${files.length === 1 ? '' : 's'}`
                        )}
                    </button>

                    <button
                        onClick={downloadZip}
                        disabled={doneCount === 0 || isProcessing}
                        className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${doneCount === 0 || isProcessing ? 'bg-gray-800 text-gray-500 cursor-not-allowed' :
                                'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20'
                            }`}
                    >
                        <Download className="w-5 h-5" /> Download ZIP
                    </button>
                </div>
            </div>
        </div>
    );
}