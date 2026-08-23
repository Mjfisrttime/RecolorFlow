import { parseGIF, decompressFrames } from 'gifuct-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
};

export const rgbDistanceSq = (r1, g1, b1, r2, g2, b2) => {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return dr * dr + dg * dg + db * db;
};

const MAX_COLOR_DIST = Math.sqrt(3 * Math.pow(255, 2));

export const getUnusedColor = (imageData) => {
    const used = new Set();
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 128) {
            used.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
        }
    }
    
    const quickCandidates = [
        [0, 255, 0],
        [255, 0, 255],
        [0, 255, 255],
        [255, 255, 0],
        [255, 0, 0],
        [0, 0, 255]
    ];
    for (const [r, g, b] of quickCandidates) {
        if (!used.has((r << 16) | (g << 8) | b)) return [r, g, b];
    }
    
    for (let r = 0; r < 256; r += 51) {
        for (let g = 0; g < 256; g += 51) {
            for (let b = 0; b < 256; b += 51) {
                if (!used.has((r << 16) | (g << 8) | b)) return [r, g, b];
            }
        }
    }
    
    return [255, 0, 255];
};

export const createCanvas = (width, height) => {
    if (typeof OffscreenCanvas !== 'undefined') {
        return new OffscreenCanvas(width, height);
    } else if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    } else {
        throw new Error('No canvas implementation available');
    }
};

export const decodeGif = (arrayBuffer) => {
    const gif = parseGIF(new Uint8Array(arrayBuffer));
    const rawFrames = decompressFrames(gif, true);
    const frames = [];

    const width = gif.lsd.width;
    const height = gif.lsd.height;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tempCanvas = createCanvas(width, height);
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    for (let i = 0; i < rawFrames.length; i++) {
        const frame = rawFrames[i];

        if (frame.disposalType === 3) {
            tempCtx.clearRect(0, 0, width, height);
            tempCtx.drawImage(canvas, 0, 0);
        }

        if (frame.dims.width > 0 && frame.dims.height > 0) {
            const expectedLength = frame.dims.width * frame.dims.height * 4;
            let patchArray = new Uint8ClampedArray(frame.patch);

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
            const patchCanvas = createCanvas(frame.dims.width, frame.dims.height);
            patchCanvas.getContext('2d').putImageData(patchData, 0, 0);
            ctx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);
        }

        frames.push({
            imageData: ctx.getImageData(0, 0, width, height),
            delay: Math.max(Number(frame.delay) || 0, 20),
            width: width,
            height: height
        });

        if (frame.disposalType === 2) {
            ctx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
        } else if (frame.disposalType === 3) {
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(tempCanvas, 0, 0);
        }
    }
    return frames;
};

export const applyRulesToImageData = (imageData, rules) => {
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;

    const parsedRules = rules.map(r => {
        const tolDist = (r.tol / 100) * MAX_COLOR_DIST;
        return {
            src: hexToRgb(r.srcHex),
            tgt: hexToRgb(r.tgtHex),
            tolSq: tolDist * tolDist
        };
    });

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;

        const r = data[i], g = data[i + 1], b = data[i + 2];

        for (let j = 0; j < parsedRules.length; j++) {
            const rule = parsedRules[j];
            const distSq = rgbDistanceSq(r, g, b, rule.src.r, rule.src.g, rule.src.b);

            if (distSq <= rule.tolSq) {
                data[i] = rule.tgt.r;
                data[i + 1] = rule.tgt.g;
                data[i + 2] = rule.tgt.b;
                break;
            }
        }
    }
    return new ImageData(data, width, height);
};

export const encodeRecoloredGif = (originalFrames, rules) => {
    if (originalFrames.length === 0) return null;

    const width = originalFrames[0].width;
    const height = originalFrames[0].height;
    const gif = GIFEncoder();

    for (const frame of originalFrames) {
        const recolored = applyRulesToImageData(frame.imageData, rules);

        const keyColor = getUnusedColor(recolored);
        const rgbaPixels = new Uint8Array(width * height * 4);
        const data = recolored.data;

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) {
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

        const palette = quantize(rgbaPixels, 255);
        palette.push(keyColor);
        const transIndex = palette.length - 1;

        const index = applyPalette(rgbaPixels, palette);
        for (let i = 0, j = 0; i < rgbaPixels.length; i += 4, j++) {
            if (rgbaPixels[i] === keyColor[0] && rgbaPixels[i+1] === keyColor[1] && rgbaPixels[i+2] === keyColor[2]) {
                index[j] = transIndex;
            }
        }

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
