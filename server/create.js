// Create a design from a text description (with structured output)
import Anthropic from '@anthropic-ai/sdk';
import { applyPatches, createEmptyDocument } from '../shared/schema.js';
import { validatePatches } from './validate.js';
import { getAllPalettesForPrompt } from '../shared/palettes.js';

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
            type: { type: 'string', enum: ['rect', 'ellipse', 'path', 'text', 'line', 'icon'] },
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
            fill: { description: 'Color "#hex" or gradient { type: "linear"|"radial", angle?: number, stops: [{ offset: 0-1, color: "#hex" }] }' },
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
            name: { type: 'string', description: 'Icon name for type="icon"' },
            size: { type: 'number', description: 'Icon size in pixels for type="icon"' },
            color: { type: 'string', description: 'Icon stroke color for type="icon"' },
            shadow: {
              type: 'object',
              description: 'Drop shadow: { offsetX, offsetY, blur, color }',
              properties: {
                offsetX: { type: 'number' },
                offsetY: { type: 'number' },
                blur: { type: 'number' },
                color: { type: 'string' },
              },
            },
            blur: { type: 'number', description: 'Gaussian blur radius in pixels' },
            glow: {
              type: 'object',
              description: 'Outer glow: { blur, color, opacity }',
              properties: {
                blur: { type: 'number' },
                color: { type: 'string' },
                opacity: { type: 'number' },
              },
            },
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
- Use a cohesive color palette (see palettes below)
- Create visual hierarchy with size and color
- Use descriptive IDs (e.g., "title-text", "hero-bg", "flow-arrow")
- For diagrams, use rects for boxes, paths for arrows, text for labels
- Colors are hex "#rrggbb"
- Coordinates are pixels from top-left origin

8px Grid System:
- All spacing, padding, margins should be multiples of 8: 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128
- Element sizes: widths/heights should use 8px increments
- Small gaps: 8px, Medium: 16-24px, Large: 32-48px, XL: 64px+

Typography Scale:
- xs: 12px (captions, labels)
- sm: 14px (body small, secondary text)
- base: 16px (body text)
- lg: 18px (lead text)
- xl: 20px (h4)
- 2xl: 24px (h3)
- 3xl: 30px (h2)
- 4xl: 36px (h1)
- 5xl: 48px (display)
- 6xl: 60px (hero)
- Font weights: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)

Color Palettes (use colors from ONE palette for consistency):
${getAllPalettesForPrompt()}

Fills can be solid colors OR gradients:
- Solid: fill: "#3b82f6"
- Linear gradient: fill: { type: "linear", angle: 90, stops: [{ offset: 0, color: "#3b82f6" }, { offset: 1, color: "#8b5cf6" }] }
- Radial gradient: fill: { type: "radial", stops: [{ offset: 0, color: "#fff" }, { offset: 1, color: "#000" }] }

Shadows for depth:
- shadow: { offsetX: 4, offsetY: 4, blur: 12, color: "#00000025" }
- Use subtle shadows for cards, stronger for floating elements

Blur effect:
- blur: 4 (gaussian blur radius)
- Use for background elements or dreamy effects

Glow effect:
- glow: { blur: 8, color: "#3b82f6", opacity: 0.6 }
- Use for highlights, buttons, neon effects

Icons (Lucide library):
- { type: "icon", name: "check", x: 10, y: 10, size: 24, color: "#000" }
- Common icons: check, x, plus, minus, arrow-left, arrow-right, arrow-up, arrow-down, chevron-left, chevron-right, home, search, settings, user, bell, mail, heart, star, play, pause, download, upload, trash, edit, share, link, shopping-cart, credit-card, alert-circle, check-circle, sun, moon, lock, eye, refresh-cw, external-link, menu, filter, layers

Use gradients for backgrounds and buttons. Use shadows for cards and depth. Use glow for emphasis. Use icons for UI elements and actions.`;

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

  // Use streaming to show progress
  const stream = client.messages.stream({
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

  // Stream actual AI output
  let streamedText = '';
  stream.on('text', (text) => {
    streamedText += text;
    const preview = streamedText.slice(-100).replace(/\n/g, ' ');
    emit('status', `AI: ${preview}`);
    log(`[stream] ${text}`);
  });

  const response = await stream.finalMessage();

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
