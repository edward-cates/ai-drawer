// Tests for image analysis (grid color sampling)
import { readFileSync } from 'fs';
import { analyzeImage } from '../server/analyze.js';
import assert from 'assert';

const TEST_IMAGE = './test-image.png';

async function runTests() {
  console.log('=== Analysis Tests (Grid Sampling) ===\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Basic analysis runs without error
  try {
    console.log('Test 1: Analysis runs without error...');
    const buf = readFileSync(TEST_IMAGE);
    const result = analyzeImage(buf);
    assert(result.dimensions, 'Should have dimensions');
    assert(result.samples, 'Should have samples array');
    assert(result.gridSize, 'Should have gridSize');
    console.log('  ✓ Passed\n');
    passed++;
  } catch (err) {
    console.log('  ✗ Failed:', err.message, '\n');
    failed++;
  }

  // Test 2: Default grid size produces correct number of samples
  try {
    console.log('Test 2: Default 25x25 grid produces 625 samples...');
    const buf = readFileSync(TEST_IMAGE);
    const result = analyzeImage(buf);
    assert(result.gridSize === 25, `Expected gridSize 25, got ${result.gridSize}`);
    assert(result.samples.length === 625, `Expected 625 samples, got ${result.samples.length}`);
    console.log('  ✓ Passed\n');
    passed++;
  } catch (err) {
    console.log('  ✗ Failed:', err.message, '\n');
    failed++;
  }

  // Test 3: Custom grid size works
  try {
    console.log('Test 3: Custom grid size (10x10) works...');
    const buf = readFileSync(TEST_IMAGE);
    const result = analyzeImage(buf, { gridSize: 10 });
    assert(result.gridSize === 10, `Expected gridSize 10, got ${result.gridSize}`);
    assert(result.samples.length === 100, `Expected 100 samples, got ${result.samples.length}`);
    console.log('  ✓ Passed\n');
    passed++;
  } catch (err) {
    console.log('  ✗ Failed:', err.message, '\n');
    failed++;
  }

  // Test 4: Samples have correct structure
  try {
    console.log('Test 4: Samples have correct structure...');
    const buf = readFileSync(TEST_IMAGE);
    const result = analyzeImage(buf);
    for (let i = 0; i < Math.min(10, result.samples.length); i++) {
      const sample = result.samples[i];
      assert(typeof sample.x === 'number', `Sample ${i} missing x`);
      assert(typeof sample.y === 'number', `Sample ${i} missing y`);
      assert(typeof sample.color === 'string', `Sample ${i} missing color`);
      assert(sample.color.startsWith('#'), `Sample ${i} color should be hex`);
      assert(sample.color.length === 7, `Sample ${i} color should be #rrggbb format`);
    }
    console.log('  ✓ Passed\n');
    passed++;
  } catch (err) {
    console.log('  ✗ Failed:', err.message, '\n');
    failed++;
  }

  // Test 5: Samples span the image
  try {
    console.log('Test 5: Samples span the image...');
    const buf = readFileSync(TEST_IMAGE);
    const result = analyzeImage(buf);
    const xs = result.samples.map(s => s.x);
    const ys = result.samples.map(s => s.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Samples should span at least 80% of the image
    const xSpan = (maxX - minX) / result.dimensions.width;
    const ySpan = (maxY - minY) / result.dimensions.height;
    assert(xSpan > 0.8, `X span ${Math.round(xSpan * 100)}% should be > 80%`);
    assert(ySpan > 0.8, `Y span ${Math.round(ySpan * 100)}% should be > 80%`);
    console.log(`  X span: ${Math.round(xSpan * 100)}%, Y span: ${Math.round(ySpan * 100)}%`);
    console.log('  ✓ Passed\n');
    passed++;
  } catch (err) {
    console.log('  ✗ Failed:', err.message, '\n');
    failed++;
  }

  // Test 6: Finds colorful samples (non-background)
  try {
    console.log('Test 6: Finds colorful samples in test image...');
    const buf = readFileSync(TEST_IMAGE);
    const result = analyzeImage(buf);

    // Count non-background colors
    const colorful = result.samples.filter(s => {
      const r = parseInt(s.color.slice(1, 3), 16);
      const g = parseInt(s.color.slice(3, 5), 16);
      const b = parseInt(s.color.slice(5, 7), 16);
      // Skip near-white/gray
      if (r > 200 && g > 200 && b > 200) return false;
      return true;
    });

    console.log(`  Found ${colorful.length} non-background samples out of ${result.samples.length}`);
    assert(colorful.length > 20, `Should find at least 20 colorful samples, got ${colorful.length}`);

    // Show unique colors found
    const uniqueColors = [...new Set(colorful.map(s => s.color))];
    console.log(`  Unique colors: ${uniqueColors.length}`);
    console.log(`  Sample colors: ${uniqueColors.slice(0, 8).join(', ')}`);
    console.log('  ✓ Passed\n');
    passed++;
  } catch (err) {
    console.log('  ✗ Failed:', err.message, '\n');
    failed++;
  }

  // Summary
  console.log('=== Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
