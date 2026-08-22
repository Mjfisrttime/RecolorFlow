import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { decodeGif, applyRulesToImageData } from '../core/gifEngine.js';

const isValidHex = (hex) => /^#[0-9a-f]{6}$/i.test(hex);

export default function PreviewCanvas({ file, mode, rules, isPlaying, onColorPick }) {
    const [previewFrames, setPreviewFrames] = useState([]);
    const [previewStatus, setPreviewStatus] = useState('idle');
    const originalCanvasRef = useRef(null);
    const recoloredCanvasRef = useRef(null);
    const animationRef = useRef(null);
    const previewFrameIdxRef = useRef(0);
    const rulesRef = useRef(rules);
    const recoloredCacheRef = useRef(new Map());

    // Keep rules ref updated without triggering re-renders
    useEffect(() => {
        rulesRef.current = rules;
        recoloredCacheRef.current.clear();
    }, [rules]);

    useEffect(() => {
        let isCancelled = false;
        
        const loadPreview = async () => {
            if (!file) {
                setPreviewFrames([]);
                setPreviewStatus('idle');
                return;
            }

            setPreviewStatus('loading');
            try {
                if (mode === 'gif') {
                    const buffer = await file.file.arrayBuffer();
                    const frames = await decodeGif(buffer);
                    if (isCancelled) return;
                    if (!frames || frames.length === 0) throw new Error("No frames decoded");
                    setPreviewFrames(frames);
                } else {
                    const img = new Image();
                    img.src = file.dataUrl;
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
                previewFrameIdxRef.current = 0;
                setPreviewStatus('success');
            } catch (err) {
                if (isCancelled) return;
                console.error("Failed to decode for preview:", err);
                setPreviewStatus('error');
            }
        };

        loadPreview();
        return () => { isCancelled = true; };
    }, [file, mode]);

    useEffect(() => {
        if (previewFrames.length === 0) {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            return;
        }

        let lastDrawTime = performance.now();
        let isFirstDraw = true;
        const drawFrame = (time) => {
            try {
                if (previewFrameIdxRef.current >= previewFrames.length) {
                    previewFrameIdxRef.current = 0;
                }
                
                const frame = previewFrames[previewFrameIdxRef.current];

                if (isFirstDraw || (isPlaying && (time - lastDrawTime >= frame.delay))) {
                    const oCtx = originalCanvasRef.current?.getContext('2d');
                    const rCtx = recoloredCanvasRef.current?.getContext('2d');

                    if (oCtx && rCtx && frame.imageData) {
                        originalCanvasRef.current.width = frame.width;
                        originalCanvasRef.current.height = frame.height;
                        oCtx.putImageData(frame.imageData, 0, 0);

                        recoloredCanvasRef.current.width = frame.width;
                        recoloredCanvasRef.current.height = frame.height;
                        
                        const currentRules = rulesRef.current || [];
                        if (currentRules.every(r => isValidHex(r.srcHex) && isValidHex(r.tgtHex))) {
                            let recoloredData = recoloredCacheRef.current.get(previewFrameIdxRef.current);
                            if (!recoloredData) {
                                recoloredData = applyRulesToImageData(frame.imageData, currentRules);
                                recoloredCacheRef.current.set(previewFrameIdxRef.current, recoloredData);
                            }
                            rCtx.putImageData(recoloredData, 0, 0);
                        } else {
                            rCtx.putImageData(frame.imageData, 0, 0);
                        }
                    }

                    if (isPlaying) {
                        previewFrameIdxRef.current = (previewFrameIdxRef.current + 1) % previewFrames.length;
                        lastDrawTime = time;
                    }
                    isFirstDraw = false;
                }
            } catch (err) {
                console.error("Render loop error:", err);
            }
            animationRef.current = requestAnimationFrame(drawFrame);
        };

        animationRef.current = requestAnimationFrame(drawFrame);
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [previewFrames, isPlaying]);

    const handleCanvasClick = (e) => {
        const canvas = originalCanvasRef.current;
        if (!canvas || !onColorPick) return;

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
            
        onColorPick(hex);
    };

    if (!file) {
        return (
            <div className="text-center text-outline bg-surface-container/80 p-6 rounded-xl backdrop-blur-sm">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select a file from the queue to preview.</p>
            </div>
        );
    }

    if (previewStatus === 'loading') {
        return (
            <div className="text-center flex flex-col items-center text-primary bg-surface-container/80 p-6 rounded-xl backdrop-blur-sm">
                <Loader2 className="w-10 h-10 mb-3 animate-spin" />
                <p className="text-sm font-medium">
                    {mode === 'gif' ? 'Decoding GIF frames...' : 'Loading image...'}
                </p>
            </div>
        );
    }

    if (previewStatus === 'error') {
        return (
            <div className="text-center flex flex-col items-center text-error bg-surface-container/80 p-6 rounded-xl backdrop-blur-sm">
                <AlertCircle className="w-10 h-10 mb-3" />
                <p className="text-sm font-medium">
                    {mode === 'gif' ? 'Failed to preview this GIF.' : 'Failed to preview this image.'}
                </p>
                <p className="text-xs text-error/70 mt-1">It might be corrupted or an unsupported format.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col md:flex-row gap-8 items-center justify-center w-full max-w-4xl relative z-10">
            <div className="flex flex-col items-center gap-3">
                <span className="text-xs font-semibold text-on-surface-variant tracking-wider uppercase flex items-center gap-2 drop-shadow-md">
                    Original <span className="bg-surface-container-high text-on-surface px-1.5 py-0.5 rounded text-[10px] normal-case border border-outline-variant">Click to pick color</span>
                </span>
                <div 
                    className="rounded-xl overflow-hidden border border-outline-variant shadow-2xl relative cursor-crosshair group bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMWQyMDI3Ii8+PHJlY3QgeD0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzEwMTMxYSIvPjxyZWN0IHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMxMDEzMWEiLz48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzFkMjAyNyIvPjwvc3ZnPg==')]" 
                    title="Click to pick Target Color for the active rule"
                >
                    <canvas ref={originalCanvasRef} onClick={handleCanvasClick} className="max-w-[300px] max-h-[300px] object-contain relative z-10" />
                    <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20" />
                </div>
            </div>

            <div className="flex flex-col items-center gap-3">
                <span className="text-xs font-semibold text-primary tracking-wider uppercase flex items-center gap-2 drop-shadow-md">
                    Recolored <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px] normal-case border border-primary/30">Current Result</span>
                </span>
                <div className="rounded-xl overflow-hidden border border-primary/50 shadow-2xl shadow-primary/20 relative bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMWQyMDI3Ii8+PHJlY3QgeD0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzEwMTMxYSIvPjxyZWN0IHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMxMDEzMWEiLz48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzFkMjAyNyIvPjwvc3ZnPg==')]">
                    <canvas ref={recoloredCanvasRef} className="max-w-[300px] max-h-[300px] object-contain" />
                </div>
            </div>
        </div>
    );
}
