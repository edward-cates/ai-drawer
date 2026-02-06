// Edit a design with natural language (structured output)
import Anthropic from '@anthropic-ai/sdk';
import { applyPatches } from '../shared/schema.js';
import { renderToBase64PNG } from './renderer.js';
import { validatePatches, generateSchemaDoc } from './validate.js';
import { getAllPalettesForPrompt } from '../shared/palettes.js';
import { ICON_NAMES } from '../shared/icons.js';

const client = new Anthropic();

const EDIT_TOOL = {
  name: 'edit_design',
  description: 'Edit a design. You MUST include at least one patch. Do NOT return an empty patches array.',
  input_schema: {
    type: 'object',
    properties: {
      thinking: {
        type: 'string',
        description: 'Brief note on what you will change (1-2 sentences max)',
      },
      message: {
        type: 'string',
        description: 'Brief description of changes for the user',
      },
      patches: {
        type: 'array',
        description: 'REQUIRED: At least one patch. This array must NOT be empty.',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            op: { type: 'string', enum: ['add', 'update', 'remove'] },
            id: { type: 'string', description: 'Element ID (or "canvas" for canvas updates)' },
            element: {
              type: 'object',
              description: 'For add: the full element to add',
            },
            props: {
              type: 'object',
              description: 'For update: properties to change',
            },
          },
          required: ['op', 'id'],
        },
      },
    },
    required: ['thinking', 'message', 'patches'],
  },
};

const EDIT_SYSTEM_PROMPT = `You edit designs. Your patches array MUST contain at least one patch. Never return empty patches.

DO NOT over-analyze. Just output the patches.

Color Palettes (use for consistent colors):
${getAllPalettesForPrompt()}

Patch formats:
- UPDATE: { op: "update", id: "element-id", props: { x: 100, y: 200, ... } }
- ADD: { op: "add", id: "new-id", element: { type: "rect", x: 0, y: 0, width: 100, height: 50, fill: "#000" } }
- REMOVE: { op: "remove", id: "element-id" }

Fills - solid or gradient:
- Solid: fill: "#3b82f6"
- Linear: fill: { type: "linear", angle: 90, stops: [{ offset: 0, color: "#3b82f6" }, { offset: 1, color: "#8b5cf6" }] }
- Radial: fill: { type: "radial", stops: [{ offset: 0, color: "#fff" }, { offset: 1, color: "#000" }] }

Shadows:
- shadow: { offsetX: 4, offsetY: 4, blur: 12, color: "#00000025" }

Blur:
- blur: 4 (gaussian blur radius)

Glow:
- glow: { blur: 8, color: "#3b82f6", opacity: 0.6 }

Icons - ONLY use these exact names:
- { type: "icon", name: "check", x: 10, y: 10, size: 24, color: "#000" }
- Available: ${ICON_NAMES.join(', ')}

Coordinates: pixels from top-left.

8px Grid: Use spacing multiples of 8 (8, 16, 24, 32, 48, 64, 96).
Typography: 12/14/16/18/20/24/30/36/48/60px. Weights: 400/500/600/700.`;

function log(msg) {
  console.log(`[edit] ${msg}`);
}

export async function editDesign(document, prompt, history = [], onProgress = () => {}) {
  const emit = (type, message) => {
    log(message);
    onProgress({ type, message });
  };

  emit('status', 'Analyzing design...');

  // Render current state
  let imageBase64 = null;
  const hasElements = Object.keys(document.elements).length > 0;

  if (hasElements) {
    try {
      emit('status', 'Rendering current design...');
      imageBase64 = renderToBase64PNG(document);
      emit('status', 'Render complete');
    } catch (err) {
      emit('status', `Render failed: ${err.message}`);
    }
  }

  const userContent = [];

  if (imageBase64) {
    userContent.push({
      type: 'text',
      text: 'Current design:',
    });
    userContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: imageBase64,
      },
    });
  }

  userContent.push({
    type: 'text',
    text: `${generateSchemaDoc(document)}

Current document:
\`\`\`json
${JSON.stringify(document, null, 2)}
\`\`\`

User request: ${prompt}`,
  });

  emit('status', 'Sending to AI...');

  // Use streaming to show progress
  const stream = client.messages.stream({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 4096,
    system: EDIT_SYSTEM_PROMPT,
    tools: [EDIT_TOOL],
    tool_choice: { type: 'tool', name: 'edit_design' },
    messages: [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: userContent },
    ],
  });

  // Stream actual AI output
  let streamedText = '';
  stream.on('text', (text) => {
    streamedText += text;
    // Show last 100 chars of streamed text
    const preview = streamedText.slice(-100).replace(/\n/g, ' ');
    emit('status', `AI: ${preview}`);
    log(`[stream] ${text}`);
  });

  const response = await stream.finalMessage();

  emit('status', 'AI responded');

  // Extract tool use result
  const toolUse = response.content.find(c => c.type === 'tool_use');
  if (!toolUse || toolUse.name !== 'edit_design') {
    throw new Error('No edit output from AI');
  }

  const result = toolUse.input;
  log(`AI result: thinking=${!!result.thinking}, message=${result.message}, patches=${result.patches?.length || 0}`);

  if (result.patches) {
    for (const p of result.patches) {
      log(`  Patch: op=${p.op} id=${p.id}`);
    }
  }

  emit('thinking', result.thinking || 'Analyzing...');
  emit('status', `Changes: ${result.patches?.length || 0} patches`);

  // Validate and apply patches
  let appliedCount = 0;
  if (result.patches && result.patches.length > 0) {
    emit('status', 'Validating patches...');
    const results = validatePatches(result.patches, document);
    const valid = results.filter(r => r.valid).map(r => r.patch);
    const invalid = results.filter(r => !r.valid);

    if (invalid.length > 0) {
      emit('status', `${invalid.length} invalid patches skipped`);
      for (const r of invalid) {
        log(`  Invalid: ${r.patch.id} - ${r.error}`);
      }
    }

    if (valid.length > 0) {
      emit('status', `Applying ${valid.length} changes...`);
      document = applyPatches(document, valid);
      appliedCount = valid.length;
    }
  }

  emit('status', 'Rendering...');

  if (appliedCount === 0) {
    const noChangeMsg = (result.patches?.length || 0) === 0
      ? 'AI returned no changes. Try rephrasing your request.'
      : 'All changes were invalid. Try a simpler edit.';
    emit('complete', noChangeMsg);
    log('Warning: No patches were applied');
  } else {
    emit('complete', result.message || `Applied ${appliedCount} changes`);
  }

  return {
    document,
    message: result.message || 'Design updated',
    response: JSON.stringify(result),
  };
}
