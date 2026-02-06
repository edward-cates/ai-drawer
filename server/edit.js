// Edit a design with natural language (structured output)
import Anthropic from '@anthropic-ai/sdk';
import { applyPatches } from '../shared/schema.js';
import { renderToBase64PNG } from './renderer.js';
import { validatePatches, generateSchemaDoc } from './validate.js';

const client = new Anthropic();

const EDIT_TOOL = {
  name: 'edit_design',
  description: 'Edit an existing design by applying patches',
  input_schema: {
    type: 'object',
    properties: {
      thinking: {
        type: 'string',
        description: 'What you see and what changes you will make',
      },
      message: {
        type: 'string',
        description: 'Brief description of changes for the user',
      },
      patches: {
        type: 'array',
        description: 'Patches to apply to the design',
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

const EDIT_SYSTEM_PROMPT = `You edit designs based on user requests. You can see the current design as an image.

Look at the image carefully, then make the requested changes using patches:
- ADD: { op: "add", id: "new-id", element: { type: "rect|text|...", ...props } }
- UPDATE: { op: "update", id: "existing-id", props: { ...changed props } }
- UPDATE canvas: { op: "update", id: "canvas", props: { background: "#hex" } }
- REMOVE: { op: "remove", id: "existing-id" }

Colors are hex "#rrggbb". Coordinates are pixels from top-left.`;

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

  const response = await client.messages.create({
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

  emit('status', 'AI responded');

  // Extract tool use result
  const toolUse = response.content.find(c => c.type === 'tool_use');
  if (!toolUse || toolUse.name !== 'edit_design') {
    throw new Error('No edit output from AI');
  }

  const result = toolUse.input;
  emit('thinking', result.thinking);
  emit('status', `Changes: ${result.patches.length} patches`);

  // Validate and apply patches
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

    emit('status', `Applying ${valid.length} changes...`);

    if (valid.length > 0) {
      document = applyPatches(document, valid);
    }
  }

  emit('status', 'Rendering...');
  emit('complete', result.message || 'Done');

  return {
    document,
    message: result.message || 'Design updated',
    response: JSON.stringify(result),
  };
}
