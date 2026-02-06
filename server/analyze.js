// Image pre-analysis - sample colors at grid points
import { PNG } from 'pngjs';

/**
 * Analyze a target image by sampling colors on a grid
 * @param {Buffer} imageBuffer - PNG image buffer
 * @param {Object} options - { gridSize: number of samples per axis }
 * @returns {Object} { dimensions, samples }
 */
export function analyzeImage(imageBuffer, options = {}) {
  const { gridSize = 25 } = options;

  const png = PNG.sync.read(imageBuffer);
  const { width, height, data } = png;

  const samples = [];
  const stepX = width / (gridSize + 1);
  const stepY = height / (gridSize + 1);

  for (let row = 1; row <= gridSize; row++) {
    for (let col = 1; col <= gridSize; col++) {
      const x = Math.round(col * stepX);
      const y = Math.round(row * stepY);
      const idx = (y * width + x) * 4;

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const color = toHex(r, g, b);

      samples.push({ x, y, color });
    }
  }

  return {
    dimensions: { width, height },
    gridSize,
    samples,
  };
}

function toHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
