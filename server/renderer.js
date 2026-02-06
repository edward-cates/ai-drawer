// Server-side JSON Document → SVG → PNG renderer
import { Resvg } from '@resvg/resvg-js';

// Render document to SVG string
export function renderToSVGString(doc) {
  const { canvas, elements, order } = doc;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">`;

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
    attrs += ` fill="${element.fill}"`;
  } else if (element.type !== 'line' && element.type !== 'group' && element.type !== 'text') {
    attrs += ' fill="none"';
  }

  if (element.stroke) attrs += ` stroke="${element.stroke}"`;
  if (element.strokeWidth) attrs += ` stroke-width="${element.strokeWidth}"`;
  if (element.opacity !== undefined) attrs += ` opacity="${element.opacity}"`;

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
