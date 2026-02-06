// Design Document Schema
// This is the source of truth for the design format

export const ELEMENT_TYPES = {
  RECT: 'rect',
  ELLIPSE: 'ellipse',
  LINE: 'line',
  PATH: 'path',
  TEXT: 'text',
  IMAGE: 'image',
  GROUP: 'group',
};

export const PATCH_OPS = {
  ADD: 'add',
  UPDATE: 'update',
  REMOVE: 'remove',
  REORDER: 'reorder',
};

// Example element structures:
//
// Rect:
// { type: 'rect', x, y, width, height, fill?, stroke?, strokeWidth?, opacity?, rotation?, cornerRadius? }
//
// Ellipse:
// { type: 'ellipse', cx, cy, rx, ry, fill?, stroke?, strokeWidth?, opacity?, rotation? }
//
// Line:
// { type: 'line', x1, y1, x2, y2, stroke?, strokeWidth?, opacity? }
//
// Path:
// { type: 'path', d, fill?, stroke?, strokeWidth?, opacity? }
//
// Text:
// { type: 'text', x, y, content, fontSize?, fontFamily?, fontWeight?, fill?, opacity?, textAnchor? }
//
// Image:
// { type: 'image', x, y, width, height, href, opacity? }
//
// Group:
// { type: 'group', children: [...ids], x?, y?, opacity?, rotation? }

// Default canvas
export const DEFAULT_CANVAS = {
  width: 800,
  height: 600,
  background: '#ffffff',
};

// Create an empty design document
export function createEmptyDocument(canvasOptions = {}) {
  return {
    canvas: { ...DEFAULT_CANVAS, ...canvasOptions },
    elements: {},
    order: [],
  };
}

// Validate a design document (basic validation)
export function validateDocument(doc) {
  if (!doc || typeof doc !== 'object') return { valid: false, error: 'Document must be an object' };
  if (!doc.canvas) return { valid: false, error: 'Document must have a canvas' };
  if (!doc.elements || typeof doc.elements !== 'object') return { valid: false, error: 'Document must have elements object' };
  if (!Array.isArray(doc.order)) return { valid: false, error: 'Document must have order array' };

  // Check all order IDs exist in elements
  for (const id of doc.order) {
    if (!doc.elements[id]) {
      return { valid: false, error: `Order references non-existent element: ${id}262` };
    }
  }

  return { valid: true };
}

// Apply a patch to a document (immutable - returns new doc)
export function applyPatch(doc, patch) {
  const newDoc = {
    canvas: { ...doc.canvas },
    elements: { ...doc.elements },
    order: [...doc.order],
  };

  switch (patch.op) {
    case PATCH_OPS.ADD: {
      if (newDoc.elements[patch.id]) {
        throw new Error(`Element with id "${patch.id}" already exists`);
      }
      newDoc.elements[patch.id] = { ...patch.element };

      // Insert at position or end
      if (patch.after) {
        const idx = newDoc.order.indexOf(patch.after);
        if (idx === -1) {
          newDoc.order.push(patch.id);
        } else {
          newDoc.order.splice(idx + 1, 0, patch.id);
        }
      } else if (patch.before) {
        const idx = newDoc.order.indexOf(patch.before);
        if (idx === -1) {
          newDoc.order.unshift(patch.id);
        } else {
          newDoc.order.splice(idx, 0, patch.id);
        }
      } else {
        newDoc.order.push(patch.id);
      }
      break;
    }

    case PATCH_OPS.UPDATE: {
      // Special case: update canvas properties
      if (patch.id === 'canvas') {
        newDoc.canvas = {
          ...newDoc.canvas,
          ...patch.props,
        };
        break;
      }

      if (!newDoc.elements[patch.id]) {
        throw new Error(`Element with id "${patch.id}" does not exist`);
      }
      newDoc.elements[patch.id] = {
        ...newDoc.elements[patch.id],
        ...patch.props,
      };
      break;
    }

    case PATCH_OPS.REMOVE: {
      if (!newDoc.elements[patch.id]) {
        throw new Error(`Element with id "${patch.id}" does not exist`);
      }
      delete newDoc.elements[patch.id];
      newDoc.order = newDoc.order.filter(id => id !== patch.id);

      // Also remove from any groups
      for (const el of Object.values(newDoc.elements)) {
        if (el.type === 'group' && el.children) {
          el.children = el.children.filter(id => id !== patch.id);
        }
      }
      break;
    }

    case PATCH_OPS.REORDER: {
      if (patch.order) {
        newDoc.order = patch.order;
      } else if (patch.id && patch.after) {
        newDoc.order = newDoc.order.filter(id => id !== patch.id);
        const idx = newDoc.order.indexOf(patch.after);
        newDoc.order.splice(idx + 1, 0, patch.id);
      } else if (patch.id && patch.before) {
        newDoc.order = newDoc.order.filter(id => id !== patch.id);
        const idx = newDoc.order.indexOf(patch.before);
        newDoc.order.splice(idx, 0, patch.id);
      }
      break;
    }

    default:
      throw new Error(`Unknown patch operation: ${patch.op}`);
  }

  return newDoc;
}

// Apply multiple patches
export function applyPatches(doc, patches) {
  return patches.reduce((d, patch) => applyPatch(d, patch), doc);
}
