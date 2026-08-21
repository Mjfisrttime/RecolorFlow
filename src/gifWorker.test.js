import { describe, it, expect } from 'vitest';
import { hexToRgb, rgbDistance } from './gifWorker.js';

describe('gifWorker utilities', () => {
    describe('hexToRgb', () => {
        it('should correctly parse 6-character hex with #', () => {
            expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
            expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
            expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
            expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
            expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
            expect(hexToRgb('#1a2b3c')).toEqual({ r: 26, g: 43, b: 60 });
        });

        it('should correctly parse 6-character hex without #', () => {
            expect(hexToRgb('ff0000')).toEqual({ r: 255, g: 0, b: 0 });
            expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
            expect(hexToRgb('1a2b3c')).toEqual({ r: 26, g: 43, b: 60 });
        });

        it('should be case-insensitive', () => {
            expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
            expect(hexToRgb('1A2B3C')).toEqual({ r: 26, g: 43, b: 60 });
        });

        it('should return {r:0, g:0, b:0} for invalid hex codes', () => {
            expect(hexToRgb('#ff000')).toEqual({ r: 0, g: 0, b: 0 }); // too short
            expect(hexToRgb('#ff00000')).toEqual({ r: 0, g: 0, b: 0 }); // too long
            expect(hexToRgb('red')).toEqual({ r: 0, g: 0, b: 0 });
            expect(hexToRgb('')).toEqual({ r: 0, g: 0, b: 0 });
            expect(hexToRgb(null)).toEqual({ r: 0, g: 0, b: 0 });
            expect(hexToRgb(undefined)).toEqual({ r: 0, g: 0, b: 0 });
        });
    });

    describe('rgbDistance', () => {
        it('should return 0 for identical colors', () => {
            expect(rgbDistance(255, 0, 0, 255, 0, 0)).toBe(0);
            expect(rgbDistance(0, 255, 0, 0, 255, 0)).toBe(0);
            expect(rgbDistance(0, 0, 255, 0, 0, 255)).toBe(0);
            expect(rgbDistance(128, 128, 128, 128, 128, 128)).toBe(0);
        });

        it('should calculate correct distance between primary colors', () => {
            // distance between red (255,0,0) and green (0,255,0)
            // sqrt((255-0)^2 + (0-255)^2 + (0-0)^2) = sqrt(255^2 + 255^2) = sqrt(65025 + 65025) = sqrt(130050) ~= 360.624
            expect(rgbDistance(255, 0, 0, 0, 255, 0)).toBeCloseTo(360.624, 3);

            // distance between black (0,0,0) and white (255,255,255)
            // sqrt(3 * 255^2) = sqrt(195075) ~= 441.673
            expect(rgbDistance(0, 0, 0, 255, 255, 255)).toBeCloseTo(441.673, 3);
        });

        it('should be symmetric', () => {
            const dist1 = rgbDistance(10, 20, 30, 40, 50, 60);
            const dist2 = rgbDistance(40, 50, 60, 10, 20, 30);
            expect(dist1).toBe(dist2);
        });

        it('should calculate known smaller distances correctly', () => {
            // (0,0,0) to (3,4,0) -> sqrt(9 + 16) = 5
            expect(rgbDistance(0, 0, 0, 3, 4, 0)).toBe(5);
        });
    });
});
