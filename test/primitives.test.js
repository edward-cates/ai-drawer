// Tests for visual primitives: gradients, shadows, blur, glow, icons, palettes
import { applyPatches, createEmptyDocument } from '../shared/schema.js';
import { validatePatches } from '../server/validate.js';
import { renderToSVGString, renderToBase64PNG } from '../server/renderer.js';
import { ICONS, ICON_NAMES, getIconPath } from '../shared/icons.js';
import { PALETTES, PALETTE_NAMES, getPalette, getColor } from '../shared/palettes.js';
import assert from 'assert';

async function runTests() {
  console.log('=== Visual Primitives Tests ===\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Icons module loads correctly
  try {
    console.log('Test 1: Icons module loads...');

    assert(Object.keys(ICONS).length > 50, 'Should have 50+ icons');
    assert(ICON_NAMES.includes('check'), 'Should have check icon');
    assert(ICON_NAMES.includes('arrow-right'), 'Should have arrow-right icon');
    assert(ICON_NAMES.includes('heart'), 'Should have heart icon');

    const checkPath = getIconPath('check');
    assert(checkPath && checkPath.length > 0, 'check icon should have path data');

    const unknownPath = getIconPath('nonexistent-icon');
    assert(unknownPath === null, 'Unknown icon should return null');

    console.log(`  Loaded ${ICON_NAMES.length} icons`);
    console.log('  ✓ Passed\n');
    passed++;
  } catch (err) {
    console.log('  ✗ Failed:', err.message, '\n');
    failed++;
  }

  // Test 2: Palettes module loads correctly
  try {
    console.log('Test 2: Palettes module loads...');

    assert(Object.keys(PALETTES).length >= 8, 'Should have 8+ palettes');
    assert(PALETTE_NAMES.includes('modern'), 'Should have modern palette');
    assert(PALETTE_NAMES.includes('dark'), 'Should have dark palette');
    assert(PALETTE_NAMES.includes('vibrant'), 'Should have vibrant palette');

    const modern = getPalette('modern');
    assert(modern.primary, 'Palette should have primary color');
    assert(modern.secondary, 'Palette should have secondary color');
    assert(modern.background, 'Palette should have background color');
    assert(modern.text, 'Palette should have text color');

    const color = getColor('modern', 'primary');
    assert(color === modern.primary, 'getColor should return correct color');

    console.log(`  Loaded ${PALETTE_NAMES.length} palettes`);
    console.log('  ✓ Passed\n');
    passed++;
  } catch (err) {
    console.log('  ✗ Failed:', err.message, '\n');
    failed++;
  }

  // Test 3: Gradient element validates and renders
  try {
    console.log('Test 3: Gradient fill validates and renders...');

    const doc = createEmptyDocument({ width: 400, height: 300 });

    const patches = [
      {
        op: 'add',
        id: 'gradient-rect',
        element: {
          type: 'rect',
          x: 50, y: 50, width: 300, height: 200,
          fill: {
            type: 'linear',
            angle: 90,
            stops: [
              { offset: 0, color: '#3b82f6' },
              { offset: 1, color: '#8b5cf6' }
            ]
          }
        }
      },
      {
        op: 'add',
        id: 'radial-circle',
        element: {
          type: 'ellipse',
          cx: 200, cy: 150, rx: 50, ry: 50,
          fill: {
            type: 'radial',
            stops: [
              { offset: 0, color: '#ffffff' },
              { offset: 1, color: '#000000' }
            ]
          }
        }
      }
    ];

    const results = validatePatches(patches, doc);
    const valid = results.filter(r => r.valid);
    assert(valid.length === 2, 'Both gradient patches should be valid');

    const finalDoc = applyPatches(doc, valid.map(r => r.patch));

    const svg = renderToSVGString(finalDoc);
    assert(svg.includes('linearGradient'), 'SVG should contain linearGradient');
    assert(svg.includes('radialGradient'), 'SVG should contain radialGradient');
    assert(svg.includes('url(#grad-'), 'SVG should reference gradient');

    const png = renderToBase64PNG(finalDoc);
    assert(png.length > 100, 'Should render to PNG');

    console.log('  ✓ Passed\n');
    passed++;
  } catch (err) {
    console.log('  ✗ Failed:', err.message, '\n');
    failed++;
  }

  // Test 4: Shadow element validates and renders
  try {
    console.log('Test 4: Shadow validates and renders...');

    const doc = createEmptyDocument({ width: 400, height: 300 });

    const patches = [{
      op: 'add',
      id: 'shadow-rect',
      element: {
        type: 'rect',
        x: 100, y: 100, width: 200, height: 100,
        fill: '#ffffff',
        shadow: {
          offsetX: 4,
          offsetY: 4,
          blur: 12,
          color: '#00000040'
        }
      }
    }];

    const results = validatePatches(patches, doc);
    assert(results[0].valid, 'Shadow patch should be valid');

    const finalDoc = applyPatches(doc, [patches[0]]);

    const svg = renderToSVGString(finalDoc);
    assert(svg.includes('<filter'), 'SVG should contain filter');
    assert(svg.includes('feDropShadow'), 'SVG should contain feDropShadow');

    const png = renderToBase64PNG(finalDoc);
    assert(png.length > 100, 'Should render to PNG');

    console.log('  ✓ Passed\n');
    passed++;
  } catch (err) {
    console.log('  ✗ Failed:', err.message, '\n');
    failed++;
  }

  // Test 5: Blur effect validates and renders
  try {
    console.log('Test 5: Blur effect validates and renders...');

    const doc = createEmptyDocument({ width: 400, height: 300 });

    const patches = [{
      op: 'add',
      id: 'blurred-rect',
      element: {
        type: 'rect',
        x: 100, y: 100, width: 200, height: 100,
        fill: '#3b82f6',
        blur: 4
      }
    }];

    const results = validatePatches(patches, doc);
    assert(results[0].valid, 'Blur patch should be valid');

    const finalDoc = applyPatches(doc, [patches[0]]);

    const svg = renderToSVGString(finalDoc);
    assert(svg.includes('<filter'), 'SVG should contain filter');
    assert(svg.includes('feGaussianBlur'), 'SVG should contain feGaussianBlur');

    const png = renderToBase64PNG(finalDoc);
    assert(png.length > 100, 'Should render to PNG');

    console.log('  ✓ Passed\n');
    passed++;
  } catch (err) {
    console.log('  ✗ Failed:', err.message, '\n');
    failed++;
  }

  // Test 6: Glow effect validates and renders
  try {
    console.log('Test 6: Glow effect validates and renders...');

    const doc = createEmptyDocument({ width: 400, height: 300 });

    const patches = [{
      op: 'add',
      id: 'glowing-rect',
      element: {
        type: 'rect',
        x: 100, y: 100, width: 200, height: 100,
        fill: '#3b82f6',
        glow: {
          blur: 8,
          color: '#3b82f6',
          opacity: 0.6
        }
      }
    }];

    const results = validatePatches(patches, doc);
    assert(results[0].valid, 'Glow patch should be valid');

    const finalDoc = applyPatches(doc, [patches[0]]);

    const svg = renderToSVGString(finalDoc);
    assert(svg.includes('<filter'), 'SVG should contain filter');
    assert(svg.includes('feFlood'), 'SVG should contain feFlood for glow');
    assert(svg.includes('feMerge'), 'SVG should contain feMerge for glow');

    const png = renderToBase64PNG(finalDoc);
    assert(png.length > 100, 'Should render to PNG');

    console.log('  ✓ Passed\n');
    passed++;
  } catch (err) {
    console.log('  ✗ Failed:', err.message, '\n');
    failed++;
  }

  // Test 7: Icon element validates and renders
  try {
    console.log('Test 7: Icon element validates and renders...');

    const doc = createEmptyDocument({ width: 400, height: 300 });

    const patches = [{
      op: 'add',
      id: 'check-icon',
      element: {
        type: 'icon',
        name: 'check',
        x: 100, y: 100,
        size: 48,
        color: '#22c55e'
      }
    }];

    const results = validatePatches(patches, doc);
    assert(results[0].valid, 'Icon patch should be valid');

    const finalDoc = applyPatches(doc, [patches[0]]);

    const svg = renderToSVGString(finalDoc);
    assert(svg.includes('<g id="check-icon"'), 'SVG should contain icon group');
    assert(svg.includes('<path'), 'SVG should contain icon path');
    assert(svg.includes('stroke="#22c55e"'), 'SVG should have icon color');

    const png = renderToBase64PNG(finalDoc);
    assert(png.length > 100, 'Should render to PNG');

    console.log('  ✓ Passed\n');
    passed++;
  } catch (err) {
    console.log('  ✗ Failed:', err.message, '\n');
    failed++;
  }

  // Test 8: Combined effects (shadow + glow)
  try {
    console.log('Test 8: Combined effects (shadow + glow)...');

    const doc = createEmptyDocument({ width: 400, height: 300 });

    const patches = [{
      op: 'add',
      id: 'fancy-button',
      element: {
        type: 'rect',
        x: 100, y: 100, width: 200, height: 60,
        fill: {
          type: 'linear',
          angle: 180,
          stops: [
            { offset: 0, color: '#3b82f6' },
            { offset: 1, color: '#2563eb' }
          ]
        },
        cornerRadius: 8,
        shadow: { offsetX: 0, offsetY: 4, blur: 12, color: '#00000030' },
        glow: { blur: 4, color: '#3b82f6', opacity: 0.3 }
      }
    }];

    const results = validatePatches(patches, doc);
    assert(results[0].valid, 'Combined effects patch should be valid');

    const finalDoc = applyPatches(doc, [patches[0]]);

    const svg = renderToSVGString(finalDoc);
    assert(svg.includes('linearGradient'), 'Should have gradient');
    assert(svg.includes('<filter'), 'Should have filter');
    assert(svg.includes('feDropShadow'), 'Should have shadow');
    assert(svg.includes('feFlood'), 'Should have glow');

    const png = renderToBase64PNG(finalDoc);
    assert(png.length > 100, 'Should render to PNG');

    console.log('  ✓ Passed\n');
    passed++;
  } catch (err) {
    console.log('  ✗ Failed:', err.message, '\n');
    failed++;
  }

  // Test 9: Multiple icons render correctly
  try {
    console.log('Test 9: Multiple icons render...');

    const doc = createEmptyDocument({ width: 600, height: 100 });

    const iconNames = ['home', 'search', 'user', 'settings', 'heart'];
    const patches = iconNames.map((name, i) => ({
      op: 'add',
      id: `icon-${name}`,
      element: {
        type: 'icon',
        name,
        x: 20 + i * 100, y: 30,
        size: 40,
        color: '#374151'
      }
    }));

    const results = validatePatches(patches, doc);
    const valid = results.filter(r => r.valid);
    assert(valid.length === 5, 'All 5 icon patches should be valid');

    const finalDoc = applyPatches(doc, valid.map(r => r.patch));

    const svg = renderToSVGString(finalDoc);
    for (const name of iconNames) {
      assert(svg.includes(`id="icon-${name}"`), `Should contain ${name} icon`);
    }

    const png = renderToBase64PNG(finalDoc);
    assert(png.length > 100, 'Should render to PNG');

    console.log('  ✓ Passed\n');
    passed++;
  } catch (err) {
    console.log('  ✗ Failed:', err.message, '\n');
    failed++;
  }

  // Test 10: Palette colors are valid hex
  try {
    console.log('Test 10: All palette colors are valid hex...');

    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    let invalidColors = [];

    for (const paletteName of PALETTE_NAMES) {
      const palette = getPalette(paletteName);
      for (const [key, value] of Object.entries(palette)) {
        if (key === 'name') continue;
        if (!hexRegex.test(value)) {
          invalidColors.push(`${paletteName}.${key}: ${value}`);
        }
      }
    }

    if (invalidColors.length > 0) {
      console.log('  Invalid colors:', invalidColors.join(', '));
    }
    assert(invalidColors.length === 0, 'All palette colors should be valid hex');

    console.log(`  Validated ${PALETTE_NAMES.length} palettes`);
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
