// Image comparison and diff visualization
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import sharp from 'sharp';

/**
 * Compare two images and return similarity metrics + diff visualization
 * @param {Buffer} targetBuffer - Target image PNG buffer
 * @param {Buffer} currentBuffer - Current render PNG buffer
 * @returns {Object} { similarity, diffPixels, totalPixels, diffImage }
 */
export async function compareImages(targetBuffer, currentBuffer) {
  // Decode PNGs
  const target = PNG.sync.read(targetBuffer);
  const current = PNG.sync.read(currentBuffer);

  // Resize current to match target if dimensions differ
  let currentResized = current;
  if (target.width !== current.width || target.height !== current.height) {
    const resizedBuffer = await sharp(currentBuffer)
      .resize(target.width, target.height, { fit: 'fill' })
      .png()
      .toBuffer();
    currentResized = PNG.sync.read(resizedBuffer);
  }

  const { width, height } = target;
  const totalPixels = width * height;

  // Create diff image
  const diff = new PNG({ width, height });

  // Run pixelmatch
  const diffPixels = pixelmatch(
    target.data,
    currentResized.data,
    diff.data,
    width,
    height,
    {
      threshold: 0.1, // Color difference threshold
      includeAA: true, // Include anti-aliased pixels
      diffColor: [255, 0, 0], // Red for differences
      diffColorAlt: [0, 255, 0], // Green for anti-aliased differences
    }
  );

  // Calculate similarity percentage
  const similarity = ((totalPixels - diffPixels) / totalPixels) * 100;

  // Encode diff image to buffer
  const diffBuffer = PNG.sync.write(diff);

  return {
    similarity: Math.round(similarity * 100) / 100, // Round to 2 decimal places
    diffPixels,
    totalPixels,
    diffImage: diffBuffer,
  };
}

/**
 * Get image dimensions
 * @param {Buffer} imageBuffer - PNG buffer
 * @returns {Object} { width, height }
 */
export function getImageDimensions(imageBuffer) {
  const png = PNG.sync.read(imageBuffer);
  return { width: png.width, height: png.height };
}

/**
 * Convert buffer to base64
 */
export function bufferToBase64(buffer) {
  return buffer.toString('base64');
}
