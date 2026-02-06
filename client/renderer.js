// JSON Document → SVG Renderer

export function renderToSVG(doc) {
  const { canvas, elements, order } = doc;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', canvas.width);
  svg.setAttribute('height', canvas.height);
  svg.setAttribute('viewBox', `0 0 ${canvas.width} ${canvas.height}`);
  svg.style.backgroundColor = canvas.background || '#ffffff';

  // Render elements in order
  for (const id of order) {
    const element = elements[id];
    if (!element) continue;

    const svgElement = renderElement(id, element, elements, svgNS);
    if (svgElement) {
      svg.appendChild(svgElement);
    }
  }

  return svg;
}

function renderElement(id, element, allElements, svgNS) {
  let el;

  switch (element.type) {
    case 'rect':
      el = document.createElementNS(svgNS, 'rect');
      el.setAttribute('x', element.x || 0);
      el.setAttribute('y', element.y || 0);
      el.setAttribute('width', element.width || 0);
      el.setAttribute('height', element.height || 0);
      if (element.cornerRadius) {
        el.setAttribute('rx', element.cornerRadius);
        el.setAttribute('ry', element.cornerRadius);
      }
      break;

    case 'ellipse':
      el = document.createElementNS(svgNS, 'ellipse');
      el.setAttribute('cx', element.cx || 0);
      el.setAttribute('cy', element.cy || 0);
      el.setAttribute('rx', element.rx || 0);
      el.setAttribute('ry', element.ry || 0);
      break;

    case 'line':
      el = document.createElementNS(svgNS, 'line');
      el.setAttribute('x1', element.x1 || 0);
      el.setAttribute('y1', element.y1 || 0);
      el.setAttribute('x2', element.x2 || 0);
      el.setAttribute('y2', element.y2 || 0);
      break;

    case 'path':
      el = document.createElementNS(svgNS, 'path');
      el.setAttribute('d', element.d || '');
      break;

    case 'text':
      el = document.createElementNS(svgNS, 'text');
      el.setAttribute('x', element.x || 0);
      el.setAttribute('y', element.y || 0);
      el.textContent = element.content || '';
      if (element.fontSize) el.setAttribute('font-size', element.fontSize);
      if (element.fontFamily) el.setAttribute('font-family', element.fontFamily);
      if (element.fontWeight) el.setAttribute('font-weight', element.fontWeight);
      if (element.textAnchor) el.setAttribute('text-anchor', element.textAnchor);
      break;

    case 'image':
      el = document.createElementNS(svgNS, 'image');
      el.setAttribute('x', element.x || 0);
      el.setAttribute('y', element.y || 0);
      el.setAttribute('width', element.width || 0);
      el.setAttribute('height', element.height || 0);
      el.setAttribute('href', element.href || '');
      break;

    case 'group':
      el = document.createElementNS(svgNS, 'g');
      if (element.children) {
        for (const childId of element.children) {
          const childElement = allElements[childId];
          if (childElement) {
            const childSvg = renderElement(childId, childElement, allElements, svgNS);
            if (childSvg) {
              el.appendChild(childSvg);
            }
          }
        }
      }
      break;

    default:
      console.warn(`Unknown element type: ${element.type}`);
      return null;
  }

  // Apply common attributes
  el.setAttribute('id', id);

  if (element.fill) el.setAttribute('fill', element.fill);
  else if (element.type !== 'line' && element.type !== 'group') el.setAttribute('fill', 'none');

  if (element.stroke) el.setAttribute('stroke', element.stroke);
  if (element.strokeWidth) el.setAttribute('stroke-width', element.strokeWidth);
  if (element.opacity !== undefined) el.setAttribute('opacity', element.opacity);

  if (element.rotation) {
    const cx = element.cx || (element.x + (element.width || 0) / 2) || 0;
    const cy = element.cy || (element.y + (element.height || 0) / 2) || 0;
    el.setAttribute('transform', `rotate(${element.rotation} ${cx} ${cy})`);
  }

  return el;
}

// Render to SVG string (for export)
export function renderToSVGString(doc) {
  const svg = renderToSVG(doc);
  const serializer = new XMLSerializer();
  return serializer.serializeToString(svg);
}
