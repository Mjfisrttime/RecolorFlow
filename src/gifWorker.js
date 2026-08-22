import { decodeGif, encodeRecoloredGif } from './core/gifEngine.js';

if (typeof self !== "undefined") { 
    self.onmessage = async (e) => {
        const { id, arrayBuffer, rules } = e.data;
        try {
            const frames = decodeGif(arrayBuffer);
            const encodedBytes = encodeRecoloredGif(frames, rules);
            if (!encodedBytes) {
                self.postMessage({ id, status: 'error', error: 'GIF has no frames to encode' });
                return;
            }
            self.postMessage({ id, status: 'done', bytes: encodedBytes }, [encodedBytes.buffer]);
        } catch (err) {
            self.postMessage({ id, status: 'error', error: err.message });
        }
    };
}
