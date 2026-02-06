// Server-side JSON Document → SVG → PNG renderer
import { Resvg } from '@resvg/resvg-js';
import { getIconPath } from '../shared/icons.js';

// Track gradients and filters for defs
let gradientDefs = [];
let filterDefs = [];
let gradientCounter = 0;

// Render document to SVG string
export function renderToSVGString(doc) {
  const { canvas, elements, order } = doc;

  // Reset defs tracking
  gradientDefs = [];
  filterDefs = [];
  gradientCounter = 0;

  // Pre-scan elements to collect gradients and filters
  for (const id of order) {
    const element = elements[id];
    if (!element) continue;
    collectGradients(id, element);
    collectFilters(id, element);
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">`;

  // Add definitions (gradients and filters)
  if (gradientDefs.length > 0 || filterDefs.length > 0) {
    svg += '<defs>';
    svg += gradientDefs.join('');
    svg += filterDefs.join('');
    svg += '</defs>';
  }

  // Background
  svg += `<rect x="0" y="0" width="${canvas.width}" height="${canvas.height}" fill="${canvas.background || '#ffffff'}"/>`;

  // Render elements in order
  for (const id of order) {
    const element = elements[id];
    if (!element) continue;
    svg += renderElement(id, element, elements);
  }

  svg += '</svg>';
  return svg;
}

// Collect gradient definitions from element
function collectGradients(id, element) {
  if (element.fill && typeof element.fill === 'object') {
    const gradId = `grad-${id}`;
    element._gradientId = gradId;
    gradientDefs.push(renderGradientDef(gradId, element.fill));
  }
}

// Collect filter definitions from element (for shadows, blur, glow)
function collectFilters(id, element) {
  const filters = [];

  if (element.shadow && typeof element.shadow === 'object') {
    filters.push({ type: 'shadow', config: element.shadow });
  }
  if (element.blur && typeof element.blur === 'number') {
    filters.push({ type: 'blur', config: element.blur });
  }
  if (element.glow && typeof element.glow === 'object') {
    filters.push({ type: 'glow', config: element.glow });
  }

  if (filters.length > 0) {
    const filterId = `filter-${id}`;
    element._filterId = filterId;
    filterDefs.push(renderCombinedFilter(filterId, filters));
  }
}

// Render a combined filter definition
function renderCombinedFilter(id, filters) {
  let filterContent = '';
  let lastResult = 'SourceGraphic';
  let resultCounter = 0;

  for (const filter of filters) {
    const resultName = `result${resultCounter++}`;

    if (filter.type === 'shadow') {
      const s = filter.config;
      const offsetX = s.offsetX || 0;
      const offsetY = s.offsetY || 0;
      const blur = s.blur || 4;
      const color = s.color || '#00000040';
      // Shadow behind the element
      filterContent += `<feDropShadow in="${lastResult}" dx="${offsetX}" dy="${offsetY}" stdDeviation="${blur / 2}" flood-color="${color}" flood-opacity="1" result="${resultName}"/>`;
      lastResult = resultName;
    }

    if (filter.type === 'blur') {
      const blur = filter.config;
      filterContent += `<feGaussianBlur in="${lastResult}" stdDeviation="${blur}" result="${resultName}"/>`;
      lastResult = resultName;
    }

    if (filter.type === 'glow') {
      const g = filter.config;
      const blur = g.blur || 8;
      const color = g.color || '#ffffff';
      const opacity = g.opacity !== undefined ? g.opacity : 0.6;
      // Glow: blur the source, colorize it, put original on top
      filterContent += `<feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="glowBlur${resultCounter}"/>`;
      filterContent += `<feFlood flood-color="${color}" flood-opacity="${opacity}" result="glowColor${resultCounter}"/>`;
      filterContent += `<feComposite in="glowColor${resultCounter}" in2="glowBlur${resultCounter}" operator="in" result="glowComposite${resultCounter}"/>`;
      filterContent += `<feMerge result="${resultName}"><feMergeNode in="glowComposite${resultCounter}"/><feMergeNode in="${lastResult}"/></feMerge>`;
      lastResult = resultName;
    }
  }

  return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">${filterContent}</filter>`;
}

// Render a gradient definition
function renderGradientDef(id, gradient) {
  const stops = (gradient.stops || [])
    .map(s => `<stop offset="${s.offset * 100}%" stop-color="${s.color}"/>`)
    .join('');

  if (gradient.type === 'radial') {
    return `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">${stops}</radialGradient>`;
  } else {
    // Linear gradient - convert angle to x1,y1,x2,y2
    const angle = gradient.angle || 0;
    const rad = (angle - 90) * Math.PI / 180;
    const x1 = 50 - Math.cos(rad) * 50;
    const y1 = 50 - Math.sin(rad) * 50;
    const x2 = 50 + Math.cos(rad) * 50;
    const y2 = 50 + Math.sin(rad) * 50;
    return `<linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${stops}</linearGradient>`;
  }
}

function renderElement(id, element, allElements) {
  let el = '';
  const common = buildCommonAttrs(id, element);

  switch (element.type) {
    case 'rect': {
      const rx = element.cornerRadius ? ` rx="${element.cornerRadius}" ry="${element.cornerRadius}"` : '';
      el = `<rect ${common} x="${element.x || 0}" y="${element.y || 0}" width="${element.width || 0}" height="${element.height || 0}"${rx}/>`;
      break;
    }

    case 'ellipse':
      el = `<ellipse ${common} cx="${element.cx || 0}" cy="${element.cy || 0}" rx="${element.rx || 0}" ry="${element.ry || 0}"/>`;
      break;

    case 'line':
      el = `<line ${common} x1="${element.x1 || 0}" y1="${element.y1 || 0}" x2="${element.x2 || 0}" y2="${element.y2 || 0}"/>`;
      break;

    case 'path':
      el = `<path ${common} d="${element.d || ''}"/>`;
      break;

    case 'text': {
      const fontSize = element.fontSize ? ` font-size="${element.fontSize}"` : '';
      const fontFamily = element.fontFamily ? ` font-family="${element.fontFamily}"` : ' font-family="system-ui, sans-serif"';
      const fontWeight = element.fontWeight ? ` font-weight="${element.fontWeight}"` : '';
      const textAnchor = element.textAnchor ? ` text-anchor="${element.textAnchor}"` : '';
      const content = escapeXml(element.content || '');
      el = `<text ${common} x="${element.x || 0}" y="${element.y || 0}"${fontSize}${fontFamily}${fontWeight}${textAnchor}>${content}</text>`;
      break;
    }

    case 'image':
      el = `<image ${common} x="${element.x || 0}" y="${element.y || 0}" width="${element.width || 0}" height="${element.height || 0}" href="${element.href || ''}"/>`;
      break;

    case 'icon': {
      const iconPath = getIconPath(element.name);
      if (!iconPath) {
        return `<!-- Unknown icon: ${element.name} -->`;
      }
      const size = element.size || 24;
      const x = element.x || 0;
      const y = element.y || 0;
      const color = element.color || '#000000';
      const scale = size / 24;
      const transform = buildTransform(element);
      const opacity = element.opacity !== undefined ? ` opacity="${element.opacity}"` : '';
      // Render as a group with a path, scaled and positioned
      el = `<g id="${id}"${transform}${opacity}><path d="${iconPath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(${x}, ${y}) scale(${scale})"/></g>`;
      break;
    }

    case 'group': {
      let children = '';
      if (element.children) {
        for (const childId of element.children) {
          const childElement = allElements[childId];
          if (childElement) {
            children += renderElement(childId, childElement, allElements);
          }
        }
      }
      const transform = buildTransform(element);
      el = `<g id="${id}"${transform}>${children}</g>`;
      break;
    }

    default:
      return '';
  }

  return el;
}

function buildCommonAttrs(id, element) {
  let attrs = `id="${id}"`;

  if (element.fill) {
    if (typeof element.fill === 'object' && element._gradientId) {
      // Gradient fill - reference the gradient def
      attrs += ` fill="url(#${element._gradientId})"`;
    } else if (typeof element.fill === 'string') {
      attrs += ` fill="${element.fill}"`;
    }
  } else if (element.type !== 'line' && element.type !== 'group' && element.type !== 'text') {
    attrs += ' fill="none"';
  }

  if (element.stroke) attrs += ` stroke="${element.stroke}"`;
  if (element.strokeWidth) attrs += ` stroke-width="${element.strokeWidth}"`;
  if (element.opacity !== undefined) attrs += ` opacity="${element.opacity}"`;

  // Apply shadow filter if present
  if (element._filterId) {
    attrs += ` filter="url(#${element._filterId})"`;
  }

  const transform = buildTransform(element);
  if (transform) attrs += transform;

  return attrs;
}

function buildTransform(element) {
  if (!element.rotation) return '';

  const cx = element.cx || (element.x + (element.width || 0) / 2) || 0;
  const cy = element.cy || (element.y + (element.height || 0) / 2) || 0;
  return ` transform="rotate(${element.rotation} ${cx} ${cy})"`;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Render document to PNG buffer
export function renderToPNG(doc, scale = 1) {
  const svgString = renderToSVGString(doc);

  const resvg = new Resvg(svgString, {
    fitTo: scale === 1
      ? { mode: 'original' }
      : { mode: 'zoom', value: scale },
    font: {
      loadSystemFonts: true,
    },
  });

  const pngData = resvg.render();
  return pngData.asPng();
}

// Render to base64 PNG for API (thumbnails use 1x, exports use higher)
export function renderToBase64PNG(doc, scale = 1) {
  const pngBuffer = renderToPNG(doc, scale);
  return pngBuffer.toString('base64');
}
