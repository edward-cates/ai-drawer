// Create a design from a text description (with structured output)
import Anthropic from '@anthropic-ai/sdk';
import { applyPatches, createEmptyDocument } from '../shared/schema.js';
import { validatePatches } from './validate.js';

const client = new Anthropic();

const CREATE_TOOL = {
  name: 'create_design',
  description: 'Create a design with geometric primitives',
  input_schema: {
    type: 'object',
    properties: {
      thinking: {
        type: 'string',
        description: 'Your approach to creating this design',
      },
      name: {
        type: 'string',
        description: 'Short name for the design (2-5 words)',
      },
      canvas: {
        type: 'object',
        properties: {
          width: { type: 'number' },
          height: { type: 'number' },
          background: { type: 'string', description: 'Hex color like #ffffff' },
        },
        required: ['width', 'height', 'background'],
      },
      elements: {
        type: 'array',
        description: 'Elements to add to the design',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['rect', 'ellipse', 'path', 'text', 'line'] },
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
            fill: { type: 'string' },
            stroke: { type: 'string' },
            strokeWidth: { type: 'number' },
            content: { type: 'string' },
            fontSize: { type: 'number' },
            fontFamily: { type: 'string' },
            fontWeight: { type: 'string' },
            textAnchor: { type: 'string', enum: ['start', 'middle', 'end'] },
            cx: { type: 'number' },
            cy: { type: 'number' },
            rx: { type: 'number' },
            ry: { type: 'number' },
            x1: { type: 'number' },
            y1: { type: 'number' },
            x2: { type: 'number' },
            y2: { type: 'number' },
            d: { type: 'string' },
            cornerRadius: { type: 'number' },
          },
          required: ['id', 'type'],
        },
      },
    },
    required: ['thinking', 'name', 'canvas', 'elements'],
  },
};

const CREATE_SYSTEM_PROMPT = `You create designs from text descriptions using geometric primitives.

Guidelines:
- Set canvas size appropriate for the content (typically 800-1200 wide)
- Use a clean, modern color palette
- Create visual hierarchy with size and color
- Position elements with good spacing and alignment
- Use descriptive IDs (e.g., "title-text", "hero-bg", "flow-arrow")
- For diagrams, use rects for boxes, paths for arrows, text for labels
- Colors are hex "#rrggbb"
- Coordinates are pixels from top-left origin`;

function log(msg) {
  console.log(`[create] ${msg}`);
}

export async function createFromDescription(description, onProgress = () => {}) {
  const emit = (type, message) => {
    log(message);
    onProgress({ type, message });
  };

  emit('status', 'Starting design...');
  emit('status', `Prompt: "${description.slice(0, 50)}..."`);
  emit('status', 'Sending to AI...');

  const response = await client.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 8192,
    system: CREATE_SYSTEM_PROMPT,
    tools: [CREATE_TOOL],
    tool_choice: { type: 'tool', name: 'create_design' },
    messages: [
      {
        role: 'user',
        content: `Create a design based on this description:\n\n${description}`,
      },
    ],
  });

  emit('status', 'AI responded');

  // Extract tool use result
  const toolUse = response.content.find(c => c.type === 'tool_use');
  if (!toolUse || toolUse.name !== 'create_design') {
    throw new Error('No design output from AI');
  }

  const result = toolUse.input;
  emit('thinking', result.thinking);
  emit('status', `Design name: "${result.name}"`);
  emit('status', `Canvas: ${result.canvas.width}x${result.canvas.height}`);
  emit('status', `Elements: ${result.elements.length}`);

  // Build document from structured output
  emit('status', 'Building document...');
  const document = createEmptyDocument({
    width: result.canvas.width,
    height: result.canvas.height,
  });
  document.canvas.background = result.canvas.background;

  // Convert elements array to patches
  const patches = result.elements.map(el => ({
    op: 'add',
    id: el.id,
    element: el,
  }));

  // Validate and apply
  emit('status', 'Validating patches...');
  const validationResults = validatePatches(patches, document);
  const valid = validationResults.filter(r => r.valid).map(r => r.patch);
  const invalid = validationResults.filter(r => !r.valid);

  if (invalid.length > 0) {
    emit('status', `${invalid.length} invalid patches skipped`);
    for (const r of invalid) {
      log(`  Invalid: ${r.patch.id} - ${r.error}`);
    }
  }

  emit('status', `Applying ${valid.length} elements...`);

  let finalDoc = document;
  if (valid.length > 0) {
    finalDoc = applyPatches(document, valid);
  }

  emit('status', 'Rendering...');
  emit('complete', 'Design created!');

  return {
    document: finalDoc,
    name: result.name || 'Untitled',
  };
}
