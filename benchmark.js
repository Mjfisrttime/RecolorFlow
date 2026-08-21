import { performance } from 'perf_hooks';

function oldMethod(data) {
    const used = new Set();
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
    return [0, 255, 0];
}

function newMethod(data) {
    const used = new Set();
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 128) {
            used.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
        }
    }
    for (let r = 0; r < 256; r += 21) {
        for (let g = 0; g < 256; g += 21) {
            for (let b = 0; b < 256; b += 21) {
                if (!used.has((r << 16) | (g << 8) | b)) return [r, g, b];
            }
        }
    }
    return [0, 255, 0];
}

const data = new Uint8ClampedArray(1000000 * 4); // 1MP image
for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(Math.random() * 256);
    data[i+1] = Math.floor(Math.random() * 256);
    data[i+2] = Math.floor(Math.random() * 256);
    data[i+3] = 255; // fully opaque
}

console.log("Measuring old method...");
const startOld = performance.now();
for (let j = 0; j < 10; j++) {
    oldMethod(data);
}
const timeOld = performance.now() - startOld;

console.log("Measuring new method...");
const startNew = performance.now();
for (let j = 0; j < 10; j++) {
    newMethod(data);
}
const timeNew = performance.now() - startNew;

console.log(`Old: ${timeOld.toFixed(2)}ms`);
console.log(`New: ${timeNew.toFixed(2)}ms`);
console.log(`Improvement: ${((timeOld - timeNew) / timeOld * 100).toFixed(2)}%`);
