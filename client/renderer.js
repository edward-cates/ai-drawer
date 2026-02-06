// JSON Document → SVG Renderer
import { getIconPath } from '/shared/icons.js';

export function renderToSVG(doc) {
  const { canvas, elements, order } = doc;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', canvas.width);
  svg.setAttribute('height', canvas.height);
  svg.setAttribute('viewBox', `0 0 ${canvas.width} ${canvas.height}`);
  svg.style.backgroundColor = canvas.background || '#ffffff';

  // Create defs for gradients and filters
  const defs = document.createElementNS(svgNS, 'defs');
  const gradientMap = {};
  const filterMap = {};

  // Pre-scan for gradients and shadows
  for (const id of order) {
    const element = elements[id];
    if (element?.fill && typeof element.fill === 'object') {
      const gradId = `grad-${id}`;
      gradientMap[id] = gradId;
      defs.appendChild(createGradient(element.fill, gradId, svgNS));
    }
    // Collect all filter effects for this element
    const filters = [];
    if (element?.shadow && typeof element.shadow === 'object') {
      filters.push({ type: 'shadow', config: element.shadow });
    }
    if (element?.blur && typeof element.blur === 'number') {
      filters.push({ type: 'blur', config: element.blur });
    }
    if (element?.glow && typeof element.glow === 'object') {
      filters.push({ type: 'glow', config: element.glow });
    }
    if (filters.length > 0) {
      const filterId = `filter-${id}`;
      filterMap[id] = filterId;
      defs.appendChild(createCombinedFilter(filters, filterId, svgNS));
    }
  }

  if (defs.children.length > 0) {
    svg.appendChild(defs);
  }

  // Render elements in order
  for (const id of order) {
    const element = elements[id];
    if (!element) continue;

    const svgElement = renderElement(id, element, elements, svgNS, gradientMap, filterMap);
    if (svgElement) {
      svg.appendChild(svgElement);
    }
  }

  return svg;
}

function createGradient(gradient, id, svgNS) {
  let gradEl;

  if (gradient.type === 'radial') {
    gradEl = document.createElementNS(svgNS, 'radialGradient');
    gradEl.setAttribute('cx', '50%');
    gradEl.setAttribute('cy', '50%');
    gradEl.setAttribute('r', '50%');
  } else {
    gradEl = document.createElementNS(svgNS, 'linearGradient');
    const angle = gradient.angle || 0;
    const rad = (angle - 90) * Math.PI / 180;
    const x1 = 50 - Math.cos(rad) * 50;
    const y1 = 50 - Math.sin(rad) * 50;
    const x2 = 50 + Math.cos(rad) * 50;
    const y2 = 50 + Math.sin(rad) * 50;
    gradEl.setAttribute('x1', `${x1}%`);
    gradEl.setAttribute('y1', `${y1}%`);
    gradEl.setAttribute('x2', `${x2}%`);
    gradEl.setAttribute('y2', `${y2}%`);
  }

  gradEl.setAttribute('id', id);

  for (const stop of (gradient.stops || [])) {
    const stopEl = document.createElementNS(svgNS, 'stop');
    stopEl.setAttribute('offset', `${stop.offset * 100}%`);
    stopEl.setAttribute('stop-color', stop.color);
    gradEl.appendChild(stopEl);
  }

  return gradEl;
}

function createCombinedFilter(filters, id, svgNS) {
  const filter = document.createElementNS(svgNS, 'filter');
  filter.setAttribute('id', id);
  filter.setAttribute('x', '-50%');
  filter.setAttribute('y', '-50%');
  filter.setAttribute('width', '200%');
  filter.setAttribute('height', '200%');

  let lastResult = 'SourceGraphic';
  let resultCounter = 0;

  for (const f of filters) {
    const resultName = `result${resultCounter++}`;

    if (f.type === 'shadow') {
      const s = f.config;
      const feDropShadow = document.createElementNS(svgNS, 'feDropShadow');
      feDropShadow.setAttribute('in', lastResult);
      feDropShadow.setAttribute('dx', s.offsetX || 0);
      feDropShadow.setAttribute('dy', s.offsetY || 0);
      feDropShadow.setAttribute('stdDeviation', (s.blur || 4) / 2);
      feDropShadow.setAttribute('flood-color', s.color || '#00000040');
      feDropShadow.setAttribute('flood-opacity', '1');
      feDropShadow.setAttribute('result', resultName);
      filter.appendChild(feDropShadow);
      lastResult = resultName;
    }

    if (f.type === 'blur') {
      const feBlur = document.createElementNS(svgNS, 'feGaussianBlur');
      feBlur.setAttribute('in', lastResult);
      feBlur.setAttribute('stdDeviation', f.config);
      feBlur.setAttribute('result', resultName);
      filter.appendChild(feBlur);
      lastResult = resultName;
    }

    if (f.type === 'glow') {
      const g = f.config;
      const blur = g.blur || 8;
      const color = g.color || '#ffffff';
      const opacity = g.opacity !== undefined ? g.opacity : 0.6;

      // Blur the alpha channel
      const feBlur = document.createElementNS(svgNS, 'feGaussianBlur');
      feBlur.setAttribute('in', 'SourceAlpha');
      feBlur.setAttribute('stdDeviation', blur);
      feBlur.setAttribute('result', `glowBlur${resultCounter}`);
      filter.appendChild(feBlur);

      // Colorize
      const feFlood = document.createElementNS(svgNS, 'feFlood');
      feFlood.setAttribute('flood-color', color);
      feFlood.setAttribute('flood-opacity', opacity);
      feFlood.setAttribute('result', `glowColor${resultCounter}`);
      filter.appendChild(feFlood);

      // Composite color with blur
      const feComposite = document.createElementNS(svgNS, 'feComposite');
      feComposite.setAttribute('in', `glowColor${resultCounter}`);
      feComposite.setAttribute('in2', `glowBlur${resultCounter}`);
      feComposite.setAttribute('operator', 'in');
      feComposite.setAttribute('result', `glowComposite${resultCounter}`);
      filter.appendChild(feComposite);

      // Merge glow behind original
      const feMerge = document.createElementNS(svgNS, 'feMerge');
      feMerge.setAttribute('result', resultName);
      const mergeNode1 = document.createElementNS(svgNS, 'feMergeNode');
      mergeNode1.setAttribute('in', `glowComposite${resultCounter}`);
      const mergeNode2 = document.createElementNS(svgNS, 'feMergeNode');
      mergeNode2.setAttribute('in', lastResult);
      feMerge.appendChild(mergeNode1);
      feMerge.appendChild(mergeNode2);
      filter.appendChild(feMerge);
      lastResult = resultName;
    }
  }

  return filter;
}

function renderElement(id, element, allElements, svgNS, gradientMap = {}, filterMap = {}) {
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

    case 'icon': {
      const iconPath = getIconPath(element.name);
      if (!iconPath) {
        console.warn(`Unknown icon: ${element.name}`);
        return null;
      }
      const size = element.size || 24;
      const x = element.x || 0;
      const y = element.y || 0;
      const color = element.color || '#000000';
      const scale = size / 24;

      el = document.createElementNS(svgNS, 'g');
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', iconPath);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('transform', `translate(${x}, ${y}) scale(${scale})`);
      el.appendChild(path);
      break;
    }

    case 'group':
      el = document.createElementNS(svgNS, 'g');
      if (element.children) {
        for (const childId of element.children) {
          const childElement = allElements[childId];
          if (childElement) {
            const childSvg = renderElement(childId, childElement, allElements, svgNS, gradientMap, filterMap);
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

  // Handle fill - solid color or gradient
  if (element.fill) {
    if (typeof element.fill === 'object' && gradientMap[id]) {
      el.setAttribute('fill', `url(#${gradientMap[id]})`);
    } else if (typeof element.fill === 'string') {
      el.setAttribute('fill', element.fill);
    }
  } else if (element.type !== 'line' && element.type !== 'group') {
    el.setAttribute('fill', 'none');
  }

  if (element.stroke) el.setAttribute('stroke', element.stroke);
  if (element.strokeWidth) el.setAttribute('stroke-width', element.strokeWidth);
  if (element.opacity !== undefined) el.setAttribute('opacity', element.opacity);

  // Apply shadow filter if present
  if (filterMap[id]) {
    el.setAttribute('filter', `url(#${filterMap[id]})`);
  }

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
