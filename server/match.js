// Image matching - reconstruct a target image with critique loop
import Anthropic from '@anthropic-ai/sdk';
import { applyPatches, createEmptyDocument } from '../shared/schema.js';
import { renderToPNG } from './renderer.js';
import { getImageDimensions, bufferToBase64 } from './diff.js';
import { validatePatches, generateSchemaDoc } from './validate.js';
import { analyzeImage } from './analyze.js';

const client = new Anthropic();

const BUILD_SYSTEM_PROMPT = `You are reconstructing a target image using geometric primitives.

You will receive:
1. COLOR SAMPLES - A grid of exact color values from the target image
2. TARGET IMAGE - Visual reference

Build the image using the primitives. Match the structure and intent - if you see chevrons with centered labels, create that. Use the color samples for precise positioning.

## Response Format
JSON only, no markdown:
{
  "thinking": "What I see and how I'll build it",
  "patches": [...]
}

## Available Operations
- ADD: { "op": "add", "id": "unique-id", "element": { "type": "rect|ellipse|path|text|line", ...props } }
- UPDATE canvas: { "op": "update", "id": "canvas", "props": { "background": "#hex" } }

## Element Types
- rect: x, y, width, height, fill, stroke, strokeWidth, cornerRadius
- ellipse: cx, cy, rx, ry, fill, stroke, strokeWidth
- path: d (SVG path string), fill, stroke, strokeWidth
- text: x, y, content, fontSize, fontFamily, fontWeight, fill, textAnchor ("start"|"middle"|"end")
- line: x1, y1, x2, y2, stroke, strokeWidth

Colors are hex "#rrggbb". Coordinates are pixels from top-left.`;

const CRITIQUE_SYSTEM_PROMPT = `Compare the current image to the target image and identify conceptual differences.

Focus on structural/semantic issues, not pixel-perfect alignment:
- Are labels positioned correctly relative to shapes? (centered, above, below?)
- Are shapes the right type? (rectangles vs chevrons vs arrows?)
- Is the hierarchy/flow correct?
- Are colors matched to the right elements?

## Response Format
JSON only:
{
  "issues": [
    "The stage labels should be centered INSIDE the chevrons, not below them",
    "The chevrons need arrow points on both ends, not just rectangles",
    ...
  ],
  "done": false
}

Set "done": true if the image is a good conceptual match (minor pixel differences are OK).`;

const FIX_SYSTEM_PROMPT = `Fix the identified issues in the current document.

You will receive:
- TARGET IMAGE - What we're trying to match
- CURRENT IMAGE - Your previous attempt
- ISSUES - Conceptual problems to fix
- CURRENT DOCUMENT - The JSON to modify

Apply patches to fix the issues. Focus on the conceptual problems listed.

## Response Format
JSON only:
{
  "thinking": "How I'm fixing each issue",
  "patches": [...]
}

## Available Operations
- ADD: { "op": "add", "id": "unique-id", "element": { ... } }
- UPDATE: { "op": "update", "id": "existing-id", "props": { ...changes } }
- REMOVE: { "op": "remove", "id": "existing-id" }

## Element Types
- rect: x, y, width, height, fill, stroke, strokeWidth, cornerRadius
- ellipse: cx, cy, rx, ry, fill, stroke, strokeWidth
- path: d (SVG path string), fill, stroke, strokeWidth
- text: x, y, content, fontSize, fontFamily, fontWeight, fill, textAnchor
- line: x1, y1, x2, y2, stroke, strokeWidth`;

/**
 * Match a target image: build → critique → fix
 */
export async function matchImage(targetImageBuffer, options = {}) {
  const { onProgress = () => {} } = options;

  const { width, height } = getImageDimensions(targetImageBuffer);
  let currentDoc = createEmptyDocument({ width, height });

  onProgress({ type: 'init', targetWidth: width, targetHeight: height });

  // Analyze target
  onProgress({ type: 'analyzing' });
  const analysis = analyzeImage(targetImageBuffer);
  onProgress({ type: 'analysis_complete', samples: analysis.samples.length });

  const sampleText = formatSamples(analysis.samples, analysis.gridSize);
  const targetBase64 = bufferToBase64(targetImageBuffer);

  // === PHASE 1: BUILD ===
  onProgress({ type: 'phase', phase: 'build', description: 'Building initial version' });

  const buildContent = [
    { type: 'text', text: `## COLOR SAMPLES (${analysis.gridSize}x${analysis.gridSize} grid)\n\nCanvas: ${width}x${height}px\n\n${sampleText}\n\n---` },
    { type: 'text', text: 'TARGET IMAGE:' },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: targetBase64 } },
    { type: 'text', text: generateSchemaDoc(currentDoc) },
  ];

  const buildStream = await client.messages.stream({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 8192,
    system: BUILD_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildContent }],
  });

  let dotCount = 0;
  let thinkingInterval = setInterval(() => {
    dotCount = (dotCount + 1) % 4;
    onProgress({ type: 'status', message: 'Building' + '.'.repeat(dotCount + 1) });
  }, 500);

  const buildResponse = await buildStream.finalMessage();
  clearInterval(thinkingInterval);

  let buildResult = parseResponse(buildResponse);
  if (!buildResult) {
    onProgress({ type: 'error', message: 'Failed to parse build response' });
    return { document: currentDoc };
  }

  onProgress({ type: 'ai_response', phase: 'build', thinking: buildResult.thinking, patchCount: buildResult.patches?.length || 0 });

  if (buildResult.patches?.length > 0) {
    currentDoc = applyValidPatches(buildResult.patches, currentDoc, onProgress, 'build');
  }

  // Render after build
  let currentBuffer;
  try {
    currentBuffer = renderToPNG(currentDoc);
    onProgress({ type: 'render_update', phase: 'build', image: `data:image/png;base64,${bufferToBase64(currentBuffer)}` });
  } catch (err) {
    onProgress({ type: 'error', message: `Render failed: ${err.message}` });
    return { document: currentDoc };
  }

  // === PHASE 2: CRITIQUE ===
  onProgress({ type: 'phase', phase: 'critique', description: 'Analyzing what needs fixing' });

  const critiqueContent = [
    { type: 'text', text: 'TARGET IMAGE (what we want):' },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: targetBase64 } },
    { type: 'text', text: 'CURRENT IMAGE (what we have):' },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: bufferToBase64(currentBuffer) } },
    { type: 'text', text: 'What conceptual differences do you see? Focus on structure, not pixels.' },
  ];

  const critiqueStream = await client.messages.stream({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 2048,
    system: CRITIQUE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: critiqueContent }],
  });

  dotCount = 0;
  thinkingInterval = setInterval(() => {
    dotCount = (dotCount + 1) % 4;
    onProgress({ type: 'status', message: 'Analyzing' + '.'.repeat(dotCount + 1) });
  }, 500);

  const critiqueResponse = await critiqueStream.finalMessage();
  clearInterval(thinkingInterval);

  let critiqueResult = parseResponse(critiqueResponse);
  if (!critiqueResult) {
    onProgress({ type: 'error', message: 'Failed to parse critique response' });
    return { document: currentDoc };
  }

  onProgress({ type: 'critique', issues: critiqueResult.issues || [], done: critiqueResult.done });

  // If critique says we're done, return
  if (critiqueResult.done) {
    onProgress({ type: 'complete', reason: 'critique_approved' });
    return { document: currentDoc };
  }

  // === PHASE 3: FIX ===
  onProgress({ type: 'phase', phase: 'fix', description: 'Fixing identified issues' });

  const fixContent = [
    { type: 'text', text: 'TARGET IMAGE:' },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: targetBase64 } },
    { type: 'text', text: 'CURRENT IMAGE:' },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: bufferToBase64(currentBuffer) } },
    { type: 'text', text: `ISSUES TO FIX:\n${critiqueResult.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}` },
    { type: 'text', text: `CURRENT DOCUMENT:\n\`\`\`json\n${JSON.stringify(currentDoc, null, 2)}\n\`\`\`` },
    { type: 'text', text: generateSchemaDoc(currentDoc) },
  ];

  const fixStream = await client.messages.stream({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 8192,
    system: FIX_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: fixContent }],
  });

  dotCount = 0;
  thinkingInterval = setInterval(() => {
    dotCount = (dotCount + 1) % 4;
    onProgress({ type: 'status', message: 'Fixing' + '.'.repeat(dotCount + 1) });
  }, 500);

  const fixResponse = await fixStream.finalMessage();
  clearInterval(thinkingInterval);

  let fixResult = parseResponse(fixResponse);
  if (!fixResult) {
    onProgress({ type: 'error', message: 'Failed to parse fix response' });
    return { document: currentDoc };
  }

  onProgress({ type: 'ai_response', phase: 'fix', thinking: fixResult.thinking, patchCount: fixResult.patches?.length || 0 });

  if (fixResult.patches?.length > 0) {
    currentDoc = applyValidPatches(fixResult.patches, currentDoc, onProgress, 'fix');
  }

  // Final render
  try {
    currentBuffer = renderToPNG(currentDoc);
    onProgress({ type: 'render_update', phase: 'fix', image: `data:image/png;base64,${bufferToBase64(currentBuffer)}` });
  } catch (err) {
    onProgress({ type: 'error', message: `Final render failed: ${err.message}` });
  }

  onProgress({ type: 'complete', reason: 'fix_applied' });
  return { document: currentDoc };
}

function parseResponse(response) {
  const content = response.content[0];
  if (content.type !== 'text') return null;

  try {
    let jsonStr = content.text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('Parse error:', err.message, content.text.slice(0, 200));
    return null;
  }
}

function applyValidPatches(patches, doc, onProgress, phase) {
  const results = validatePatches(patches, doc);
  const valid = results.filter(r => r.valid).map(r => r.patch);
  const invalid = results.filter(r => !r.valid);

  for (const r of invalid) {
    onProgress({ type: 'validation_error', phase, error: r.error });
  }

  if (valid.length > 0) {
    doc = applyPatches(doc, valid);
    onProgress({ type: 'patches_applied', phase, appliedCount: valid.length, invalidCount: invalid.length, elementCount: Object.keys(doc.elements).length });
  }

  return doc;
}

function formatSamples(samples, gridSize) {
  const lines = [];

  const notable = samples.filter(s => {
    const r = parseInt(s.color.slice(1, 3), 16);
    const g = parseInt(s.color.slice(3, 5), 16);
    const b = parseInt(s.color.slice(5, 7), 16);
    if (r > 200 && g > 200 && b > 200) return false;
    if (r < 30 && g < 30 && b < 30) return false;
    return true;
  });

  if (notable.length > 0) {
    lines.push(`Notable colors (${notable.length} samples):`);
    const byColor = {};
    for (const s of notable) {
      if (!byColor[s.color]) byColor[s.color] = [];
      byColor[s.color].push(s);
    }
    for (const [color, points] of Object.entries(byColor)) {
      const coords = points.slice(0, 6).map(p => `(${p.x},${p.y})`).join(' ');
      lines.push(`  ${color}: ${coords}${points.length > 6 ? ` +${points.length - 6} more` : ''}`);
    }
  }

  return lines.join('\n');
}
