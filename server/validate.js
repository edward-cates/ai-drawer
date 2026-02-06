// Patch validation - validate patches before applying to catch errors early
import { ELEMENT_TYPES, PATCH_OPS } from '../shared/schema.js';

const VALID_ELEMENT_TYPES = Object.values(ELEMENT_TYPES);

// Required fields for each element type
const ELEMENT_REQUIRED_FIELDS = {
  rect: ['x', 'y', 'width', 'height'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  path: ['d'],
  text: ['x', 'y', 'content'],
  image: ['x', 'y', 'width', 'height', 'href'],
  icon: ['name', 'x', 'y', 'size'],
  group: ['children'],
};

// Optional fields for each element type
const ELEMENT_OPTIONAL_FIELDS = {
  rect: ['fill', 'stroke', 'strokeWidth', 'opacity', 'rotation', 'cornerRadius', 'shadow', 'blur', 'glow'],
  ellipse: ['fill', 'stroke', 'strokeWidth', 'opacity', 'rotation', 'shadow', 'blur', 'glow'],
  line: ['stroke', 'strokeWidth', 'opacity', 'shadow', 'blur', 'glow'],
  path: ['fill', 'stroke', 'strokeWidth', 'opacity', 'shadow', 'blur', 'glow'],
  text: ['fontSize', 'fontFamily', 'fontWeight', 'fill', 'opacity', 'textAnchor', 'shadow', 'blur', 'glow'],
  image: ['opacity', 'shadow', 'blur', 'glow'],
  icon: ['color', 'opacity', 'rotation', 'shadow', 'glow'],
  group: ['x', 'y', 'opacity', 'rotation', 'shadow', 'blur', 'glow'],
};

/**
 * Validate a single patch against the current document
 * Returns { valid: boolean, error?: string, warnings?: string[] }
 */
export function validatePatch(patch, document) {
  const warnings = [];

  // Check op exists
  if (!patch.op) {
    return { valid: false, error: 'Patch missing "op" field' };
  }

  if (!Object.values(PATCH_OPS).includes(patch.op)) {
    return { valid: false, error: `Invalid op "${patch.op}". Valid ops: ${Object.values(PATCH_OPS).join(', ')}` };
  }

  switch (patch.op) {
    case PATCH_OPS.ADD: {
      if (!patch.id) {
        return { valid: false, error: 'ADD patch missing "id" field' };
      }
      if (!patch.element) {
        return { valid: false, error: 'ADD patch missing "element" field' };
      }
      if (patch.id === 'canvas') {
        return { valid: false, error: 'Cannot ADD element with id "canvas". Use UPDATE with id "canvas" to change canvas properties.' };
      }
      if (document.elements[patch.id]) {
        return { valid: false, error: `Element with id "${patch.id}" already exists. Use UPDATE to modify it.` };
      }

      // Validate element
      const elemValidation = validateElement(patch.element);
      if (!elemValidation.valid) {
        return { valid: false, error: `Invalid element: ${elemValidation.error}` };
      }
      if (elemValidation.warnings) {
        warnings.push(...elemValidation.warnings);
      }
      break;
    }

    case PATCH_OPS.UPDATE: {
      if (!patch.id) {
        return { valid: false, error: 'UPDATE patch missing "id" field' };
      }
      if (!patch.props || typeof patch.props !== 'object') {
        return { valid: false, error: 'UPDATE patch missing "props" object' };
      }

      // Special case: canvas update
      if (patch.id === 'canvas') {
        const validCanvasProps = ['width', 'height', 'background'];
        for (const key of Object.keys(patch.props)) {
          if (!validCanvasProps.includes(key)) {
            warnings.push(`Unknown canvas property "${key}". Valid: ${validCanvasProps.join(', ')}`);
          }
        }
        break;
      }

      if (!document.elements[patch.id]) {
        return { valid: false, error: `Element with id "${patch.id}" does not exist. Use ADD to create it.` };
      }
      break;
    }

    case PATCH_OPS.REMOVE: {
      if (!patch.id) {
        return { valid: false, error: 'REMOVE patch missing "id" field' };
      }
      if (patch.id === 'canvas') {
        return { valid: false, error: 'Cannot remove canvas' };
      }
      if (!document.elements[patch.id]) {
        return { valid: false, error: `Element with id "${patch.id}" does not exist` };
      }
      break;
    }

    case PATCH_OPS.REORDER: {
      if (!patch.order && !patch.id) {
        return { valid: false, error: 'REORDER patch must have either "order" array or "id" with "after"/"before"' };
      }
      break;
    }
  }

  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
}

/**
 * Validate an element definition
 */
function validateElement(element) {
  const warnings = [];

  if (!element.type) {
    return { valid: false, error: 'Element missing "type" field' };
  }

  if (!VALID_ELEMENT_TYPES.includes(element.type)) {
    return { valid: false, error: `Invalid element type "${element.type}". Valid types: ${VALID_ELEMENT_TYPES.join(', ')}` };
  }

  const required = ELEMENT_REQUIRED_FIELDS[element.type] || [];
  for (const field of required) {
    if (element[field] === undefined) {
      return { valid: false, error: `${element.type} element missing required field "${field}"` };
    }
  }

  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
}

/**
 * Validate all patches and return detailed results
 */
export function validatePatches(patches, document) {
  const results = [];
  let tempDoc = {
    canvas: { ...document.canvas },
    elements: { ...document.elements },
    order: [...document.order],
  };

  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i];
    const result = validatePatch(patch, tempDoc);
    results.push({
      index: i,
      patch,
      ...result,
    });

    // Simulate applying valid patches for subsequent validation
    if (result.valid) {
      if (patch.op === PATCH_OPS.ADD) {
        tempDoc.elements[patch.id] = patch.element;
        tempDoc.order.push(patch.id);
      } else if (patch.op === PATCH_OPS.UPDATE && patch.id !== 'canvas') {
        tempDoc.elements[patch.id] = { ...tempDoc.elements[patch.id], ...patch.props };
      } else if (patch.op === PATCH_OPS.REMOVE) {
        delete tempDoc.elements[patch.id];
        tempDoc.order = tempDoc.order.filter(id => id !== patch.id);
      }
    }
  }

  return results;
}

/**
 * Generate schema documentation for AI consumption
 */
export function generateSchemaDoc(document) {
  const existingElements = Object.keys(document.elements);

  return `## Available Operations

### ADD - Create new element
{ "op": "add", "id": "<unique-id>", "element": { "type": "<type>", ...props } }
- id must be unique (not in: ${existingElements.length > 0 ? existingElements.slice(0, 10).join(', ') + (existingElements.length > 10 ? '...' : '') : 'none yet'})
- Cannot use id "canvas"

### UPDATE - Modify existing element or canvas
{ "op": "update", "id": "<existing-id>", "props": { ...changed props } }
- For canvas: { "op": "update", "id": "canvas", "props": { "background": "#f5f5f5" } }
- Valid canvas props: width, height, background
- For elements: id must exist (currently: ${existingElements.length > 0 ? existingElements.slice(0, 10).join(', ') + (existingElements.length > 10 ? '...' : '') : 'none'})

### REMOVE - Delete element
{ "op": "remove", "id": "<existing-id>" }

### REORDER - Change z-order
{ "op": "reorder", "order": ["id1", "id2", ...] }

## Element Types

### rect (rectangle)
Required: x, y, width, height
Optional: fill, stroke, strokeWidth, opacity, rotation, cornerRadius, shadow, blur, glow

### ellipse
Required: cx, cy, rx, ry
Optional: fill, stroke, strokeWidth, opacity, rotation, shadow, blur, glow

### line
Required: x1, y1, x2, y2
Optional: stroke, strokeWidth, opacity, shadow, blur, glow

### path (SVG path)
Required: d (SVG path string, e.g., "M 0 0 L 100 100")
Optional: fill, stroke, strokeWidth, opacity, shadow, blur, glow

### text
Required: x, y, content
Optional: fontSize, fontFamily, fontWeight, fill, opacity, textAnchor, shadow, blur, glow

### icon (Lucide icons)
Required: name, x, y, size
Optional: color, opacity, rotation, shadow, glow
Available icons: arrow-left, arrow-right, arrow-up, arrow-down, chevron-left, chevron-right, chevron-up, chevron-down, menu, x, check, plus, minus, home, search, settings, user, users, bell, mail, phone, calendar, clock, heart, star, bookmark, image, camera, video, play, pause, music, file, folder, download, upload, trash, edit, copy, clipboard, message-circle, send, share, link, shopping-cart, shopping-bag, credit-card, dollar-sign, alert-circle, alert-triangle, info, check-circle, x-circle, zap, sun, moon, cloud, globe, lock, unlock, eye, eye-off, refresh-cw, external-link, filter, layers

### group
Required: children (array of element ids)
Optional: x, y, opacity, rotation, shadow, blur, glow

## Fills
- Solid: fill: "#3b82f6"
- Linear gradient: fill: { type: "linear", angle: 90, stops: [{ offset: 0, color: "#..." }, { offset: 1, color: "#..." }] }
- Radial gradient: fill: { type: "radial", stops: [...] }

## Shadows
shadow: { offsetX: 4, offsetY: 4, blur: 12, color: "#00000025" }

## Blur
blur: 4  (gaussian blur radius in pixels)

## Glow
glow: { blur: 8, color: "#3b82f6", opacity: 0.6 }

## Color Palettes
Use colors from one palette for visual consistency:
- modern: #3b82f6 (blue), #8b5cf6, #f59e0b
- minimal: #18181b (dark), #a1a1aa, #fbbf24
- vibrant: #ec4899 (pink), #8b5cf6, #06b6d4
- nature: #16a34a (green), #84cc16, #f97316
- corporate: #1e40af (navy), #475569, #0891b2
- dark: #60a5fa on #0f172a background
- warm: #ea580c (orange), #b45309, #0d9488
- ocean: #0891b2 (cyan), #0284c7, #f472b6
- luxury: #7c3aed (purple), #c084fc, #fbbf24

## 8px Grid
All spacing in multiples of 8: 8, 16, 24, 32, 40, 48, 64, 80, 96, 128

## Typography Scale
12px (xs) | 14px (sm) | 16px (base) | 18px (lg) | 20px (xl) | 24px (2xl) | 30px (3xl) | 36px (4xl) | 48px (5xl) | 60px (6xl)
Weights: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)`;
}
