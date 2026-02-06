// Tests for create/edit flows (mocked - no API calls)
import { applyPatches, createEmptyDocument } from '../shared/schema.js';
import { validatePatches } from '../server/validate.js';
import { renderToBase64PNG } from '../server/renderer.js';
import assert from 'assert';

// Mock AI response for "create_design" tool
const MOCK_CREATE_RESPONSE = {
  thinking: 'Creating a spec-based design collaboration diagram',
  name: 'Spec Collaboration Flow',
  canvas: {
    width: 1000,
    height: 600,
    background: '#f5f5f5',
  },
  elements: [
    { id: 'title', type: 'text', x: 500, y: 40, content: 'Spec-Based Design Flow', fontSize: 28, fontWeight: 'bold', fill: '#1a1a1a', textAnchor: 'middle' },
    { id: 'pm-box', type: 'rect', x: 50, y: 150, width: 100, height: 60, fill: '#3b82f6', cornerRadius: 8 },
    { id: 'pm-label', type: 'text', x: 100, y: 185, content: 'PMs', fontSize: 16, fill: '#ffffff', textAnchor: 'middle' },
    { id: 'po-box', type: 'rect', x: 50, y: 250, width: 100, height: 60, fill: '#22c55e', cornerRadius: 8 },
    { id: 'po-label', type: 'text', x: 100, y: 285, content: 'POs', fontSize: 16, fill: '#ffffff', textAnchor: 'middle' },
    { id: 'dev-box', type: 'rect', x: 50, y: 350, width: 100, height: 60, fill: '#f59e0b', cornerRadius: 8 },
    { id: 'dev-label', type: 'text', x: 100, y: 385, content: 'Devs', fontSize: 16, fill: '#ffffff', textAnchor: 'middle' },
    { id: 'qa-box', type: 'rect', x: 50, y: 450, width: 100, height: 60, fill: '#ef4444', cornerRadius: 8 },
    { id: 'qa-label', type: 'text', x: 100, y: 485, content: 'QAs', fontSize: 16, fill: '#ffffff', textAnchor: 'middle' },
    { id: 'spec-box', type: 'rect', x: 300, y: 280, width: 150, height: 100, fill: '#8b5cf6', cornerRadius: 12 },
    { id: 'spec-label', type: 'text', x: 375, y: 335, content: 'Spec Sheet', fontSize: 18, fill: '#ffffff', textAnchor: 'middle' },
    { id: 'ai-box', type: 'rect', x: 550, y: 280, width: 120, height: 100, fill: '#1a1a1a', cornerRadius: 12 },
    { id: 'ai-label', type: 'text', x: 610, y: 335, content: 'AI', fontSize: 24, fill: '#ffffff', textAnchor: 'middle' },
    { id: 'dashboard-box', type: 'rect', x: 770, y: 250, width: 180, height: 160, fill: '#ffffff', stroke: '#e5e5e5', strokeWidth: 2, cornerRadius: 8 },
    { id: 'dashboard-label', type: 'text', x: 860, y: 340, content: 'Dashboard', fontSize: 18, fill: '#1a1a1a', textAnchor: 'middle' },
    { id: 'arrow1', type: 'path', d: 'M 150 180 L 300 310', stroke: '#666', strokeWidth: 2 },
    { id: 'arrow2', type: 'path', d: 'M 150 280 L 300 320', stroke: '#666', strokeWidth: 2 },
    { id: 'arrow3', type: 'path', d: 'M 150 380 L 300 340', stroke: '#666', strokeWidth: 2 },
    { id: 'arrow4', type: 'path', d: 'M 150 480 L 300 350', stroke: '#666', strokeWidth: 2 },
    { id: 'arrow5', type: 'path', d: 'M 450 330 L 550 330', stroke: '#666', strokeWidth: 2 },
    { id: 'arrow6', type: 'path', d: 'M 670 330 L 770 330', stroke: '#666', strokeWidth: 2 },
  ],
};

// Mock AI response for "edit_design" tool
const MOCK_EDIT_RESPONSE = {
  thinking: 'User wants larger fonts, will increase fontSize on all text elements',
  message: 'Made all fonts bigger',
  patches: [
    { op: 'update', id: 'title', props: { fontSize: 36 } },
    { op: 'update', id: 'pm-label', props: { fontSize: 20 } },
    { op: 'update', id: 'po-label', props: { fontSize: 20 } },
    { op: 'update', id: 'dev-label', props: { fontSize: 20 } },
    { op: 'update', id: 'qa-label', props: { fontSize: 20 } },
    { op: 'update', id: 'spec-label', props: { fontSize: 22 } },
    { op: 'update', id: 'ai-label', props: { fontSize: 30 } },
    { op: 'update', id: 'dashboard-label', props: { fontSize: 22 } },
  ],
};

async function runTests() {
  console.log('=== Create/Edit Structure Tests (Mocked) ===\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Mock create response produces valid document
  try {
    console.log('Test 1: Create response produces valid document...');

    const doc = createEmptyDocument({
      width: MOCK_CREATE_RESPONSE.canvas.width,
      height: MOCK_CREATE_RESPONSE.canvas.height,
    });
    doc.canvas.background = MOCK_CREATE_RESPONSE.canvas.background;

    const patches = MOCK_CREATE_RESPONSE.elements.map(el => ({
      op: 'add',
      id: el.id,
      element: el,
    }));

    const validationResults = validatePatches(patches, doc);
    const valid = validationResults.filter(r => r.valid);
    const invalid = validationResults.filter(r => !r.valid);

    console.log(`  Valid patches: ${valid.length}`);
    console.log(`  Invalid patches: ${invalid.length}`);

    if (invalid.length > 0) {
      for (const r of invalid) {
        console.log(`    - ${r.patch.id}: ${r.error}`);
      }
    }

    const finalDoc = applyPatches(doc, valid.map(r => r.patch));

    console.log(`  Elements created: ${Object.keys(finalDoc.elements).length}`);
    assert(Object.keys(finalDoc.elements).length > 0, 'Should have elements');

    console.log('  ✓ Passed\n');
    passed++;
  } catch (err) {
    console.log('  ✗ Failed:', err.message, '\n');
    failed++;
  }

  // Test 2: Created document can be rendered
  try {
    console.log('Test 2: Created document can be rendered...');

    const doc = createEmptyDocument({
      width: MOCK_CREATE_RESPONSE.canvas.width,
      height: MOCK_CREATE_RESPONSE.canvas.height,
    });
    doc.canvas.background = MOCK_CREATE_RESPONSE.canvas.background;

    const patches = MOCK_CREATE_RESPONSE.elements.map(el => ({
      op: 'add',
      id: el.id,
      element: el,
    }));

    const validationResults = validatePatches(patches, doc);
    const valid = validationResults.filter(r => r.valid).map(r => r.patch);
    const finalDoc = applyPatches(doc, valid);

    const png = renderToBase64PNG(finalDoc);
    assert(png.length > 100, 'Should produce PNG data');
    console.log(`  PNG size: ${png.length} chars`);

    console.log('  ✓ Passed\n');
    passed++;
  } catch (err) {
    console.log('  ✗ Failed:', err.message, '\n');
    failed++;
  }

  // Test 3: Edit patches apply correctly
  try {
    console.log('Test 3: Edit patches apply to existing document...');

    // First create the document
    const doc = createEmptyDocument({
      width: MOCK_CREATE_RESPONSE.canvas.width,
      height: MOCK_CREATE_RESPONSE.canvas.height,
    });
    doc.canvas.background = MOCK_CREATE_RESPONSE.canvas.background;

    const createPatches = MOCK_CREATE_RESPONSE.elements.map(el => ({
      op: 'add',
      id: el.id,
      element: el,
    }));

    const createValid = validatePatches(createPatches, doc).filter(r => r.valid).map(r => r.patch);
    let finalDoc = applyPatches(doc, createValid);

    // Now apply edit patches
    const editResults = validatePatches(MOCK_EDIT_RESPONSE.patches, finalDoc);
    const editValid = editResults.filter(r => r.valid);
    const editInvalid = editResults.filter(r => !r.valid);

    console.log(`  Edit valid: ${editValid.length}`);
    console.log(`  Edit invalid: ${editInvalid.length}`);

    if (editInvalid.length > 0) {
      for (const r of editInvalid) {
        console.log(`    - ${r.patch.id}: ${r.error}`);
      }
    }

    finalDoc = applyPatches(finalDoc, editValid.map(r => r.patch));

    // Check that font sizes were updated
    const titleElement = finalDoc.elements['title'];
    assert(titleElement.fontSize === 36, `Title fontSize should be 36, got ${titleElement.fontSize}`);

    console.log('  ✓ Passed\n');
    passed++;
  } catch (err) {
    console.log('  ✗ Failed:', err.message, '\n');
    failed++;
  }

  // Test 4: Edited document can be rendered
  try {
    console.log('Test 4: Edited document can be rendered...');

    const doc = createEmptyDocument({
      width: MOCK_CREATE_RESPONSE.canvas.width,
      height: MOCK_CREATE_RESPONSE.canvas.height,
    });
    doc.canvas.background = MOCK_CREATE_RESPONSE.canvas.background;

    const createPatches = MOCK_CREATE_RESPONSE.elements.map(el => ({
      op: 'add',
      id: el.id,
      element: el,
    }));

    const createValid = validatePatches(createPatches, doc).filter(r => r.valid).map(r => r.patch);
    let finalDoc = applyPatches(doc, createValid);

    const editValid = validatePatches(MOCK_EDIT_RESPONSE.patches, finalDoc).filter(r => r.valid).map(r => r.patch);
    finalDoc = applyPatches(finalDoc, editValid);

    const png = renderToBase64PNG(finalDoc);
    assert(png.length > 100, 'Should produce PNG data');
    console.log(`  PNG size: ${png.length} chars`);

    console.log('  ✓ Passed\n');
    passed++;
  } catch (err) {
    console.log('  ✗ Failed:', err.message, '\n');
    failed++;
  }

  // Test 5: Invalid patches are rejected
  try {
    console.log('Test 5: Invalid patches are rejected...');

    const doc = createEmptyDocument({ width: 800, height: 600 });

    const badPatches = [
      { op: 'add', id: 'test', element: { type: 'invalid-type' } },
      { op: 'update', id: 'nonexistent', props: { fill: '#000' } },
      { op: 'remove', id: 'also-nonexistent' },
    ];

    const results = validatePatches(badPatches, doc);
    const invalid = results.filter(r => !r.valid);

    console.log(`  Rejected ${invalid.length} of ${badPatches.length} bad patches`);
    assert(invalid.length === badPatches.length, 'All bad patches should be rejected');

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
