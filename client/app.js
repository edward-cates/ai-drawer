import { renderToSVG } from './renderer.js';

let currentDesign = null;
let designs = [];

// Elements
const designList = document.getElementById('design-list');
const canvasArea = document.getElementById('canvas-area');
const promptBar = document.getElementById('prompt-bar');
const promptForm = document.getElementById('prompt-form');
const promptInput = document.getElementById('prompt-input');
const sendBtn = document.getElementById('send-btn');
const status = document.getElementById('status');

const createBtn = document.getElementById('create-btn');
const createModal = document.getElementById('create-modal');
const modalOptions = document.getElementById('modal-options');
const descriptionInput = document.getElementById('description-input');
const imageInputArea = document.getElementById('image-input-area');
const imageInput = document.getElementById('image-input');
const fileLabel = document.getElementById('file-label');
const modalActions = document.getElementById('modal-actions');
const modalCancel = document.getElementById('modal-cancel');
const modalCreate = document.getElementById('modal-create');

const progressOverlay = document.getElementById('progress-overlay');
const progressTitle = document.getElementById('progress-title');
const progressLog = document.getElementById('progress-log');

let createType = null;
let selectedImage = null;

// Initialize
async function init() {
  await loadDesigns();
}

// Load designs from server
async function loadDesigns() {
  try {
    const res = await fetch('/api/designs');
    designs = await res.json();
    renderDesignList();
  } catch (err) {
    console.error('Failed to load designs:', err);
  }
}

// Render design list in sidebar
function renderDesignList() {
  if (designs.length === 0) {
    designList.innerHTML = '<div class="empty-state">No designs yet</div>';
    return;
  }

  designList.innerHTML = designs.map(d => `
    <div class="design-item ${currentDesign?.id === d.id ? 'active' : ''}" data-id="${d.id}">
      ${d.thumbnail
        ? `<img class="design-thumb" src="${d.thumbnail}" alt="">`
        : '<div class="design-thumb"></div>'
      }
      <span class="design-name">${d.name}</span>
    </div>
  `).join('');

  designList.querySelectorAll('.design-item').forEach(item => {
    item.addEventListener('click', () => selectDesign(item.dataset.id));
  });
}

// Select a design
async function selectDesign(id) {
  try {
    const res = await fetch(`/api/designs/${id}`);
    currentDesign = await res.json();
    renderDesignList();
    renderCanvas();
    promptBar.style.display = 'block';
    setStatus('');
  } catch (err) {
    console.error('Failed to load design:', err);
  }
}

// Render current design to canvas
function renderCanvas() {
  if (!currentDesign) {
    canvasArea.innerHTML = `
      <div class="welcome">
        <h2>Welcome to AI Design</h2>
        <p>Create a new design to get started</p>
      </div>
    `;
    return;
  }

  canvasArea.innerHTML = '<div class="canvas-container" id="canvas"></div>';
  const canvas = document.getElementById('canvas');

  try {
    const svg = renderToSVG(currentDesign.document);
    canvas.appendChild(svg);
  } catch (err) {
    if (currentDesign.thumbnail) {
      canvas.innerHTML = `<img src="${currentDesign.thumbnail}" alt="Design">`;
    }
  }
}

// Set status message
function setStatus(message, isError = false) {
  status.textContent = message;
  status.className = 'status' + (isError ? ' error' : '');
}

// Progress helpers
function showProgress(title) {
  progressTitle.textContent = title;
  progressLog.innerHTML = '';
  progressOverlay.classList.add('open');
}

function hideProgress() {
  progressOverlay.classList.remove('open');
}

function logProgress(msg, type = 'info') {
  const div = document.createElement('div');
  div.textContent = msg;
  if (type === 'error') div.style.color = '#ef4444';
  if (type === 'thinking') div.style.color = '#3b82f6';
  progressLog.appendChild(div);
  progressLog.scrollTop = progressLog.scrollHeight;
}

// Stream SSE response
async function streamSSE(url, body, onEvent) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event = JSON.parse(line.slice(6));
          onEvent(event);
        } catch (e) {
          console.error('Parse error:', e);
        }
      }
    }
  }
}

// Create modal
createBtn.addEventListener('click', () => {
  createType = null;
  selectedImage = null;
  descriptionInput.style.display = 'none';
  imageInputArea.style.display = 'none';
  modalActions.style.display = 'none';
  descriptionInput.querySelector('textarea').value = '';
  fileLabel.textContent = 'Drop an image or click to upload';
  fileLabel.classList.remove('has-file');
  createModal.classList.add('open');
});

modalOptions.querySelectorAll('.modal-option').forEach(option => {
  option.addEventListener('click', () => {
    createType = option.dataset.type;

    if (createType === 'description') {
      descriptionInput.style.display = 'block';
      imageInputArea.style.display = 'none';
    } else {
      descriptionInput.style.display = 'none';
      imageInputArea.style.display = 'block';
    }

    modalActions.style.display = 'flex';
  });
});

imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    selectedImage = event.target.result;
    fileLabel.textContent = file.name;
    fileLabel.classList.add('has-file');
  };
  reader.readAsDataURL(file);
});

modalCancel.addEventListener('click', () => {
  createModal.classList.remove('open');
});

createModal.addEventListener('click', (e) => {
  if (e.target === createModal) {
    createModal.classList.remove('open');
  }
});

modalCreate.addEventListener('click', async () => {
  if (createType === 'description') {
    const description = descriptionInput.querySelector('textarea').value.trim();
    if (!description) return;
    await createFromDescription(description);
  } else if (createType === 'image') {
    if (!selectedImage) return;
    await createFromImage(selectedImage);
  }
});

// Create from description
async function createFromDescription(description) {
  createModal.classList.remove('open');
  showProgress('Creating design...');

  let newDesign = null;

  try {
    await streamSSE('/api/designs/from-description', { description }, (event) => {
      switch (event.type) {
        case 'start':
        case 'status':
          logProgress(event.message);
          break;
        case 'thinking':
          logProgress(event.message, 'thinking');
          break;
        case 'complete':
          logProgress(event.message);
          break;
        case 'done':
          newDesign = {
            id: event.id,
            name: event.name,
            document: event.document,
            thumbnail: event.thumbnail,
          };
          logProgress(`Created: ${event.name}`);
          break;
        case 'error':
          logProgress(`Error: ${event.message}`, 'error');
          break;
      }
    });

    // Update immediately with the data we already have
    if (newDesign) {
      currentDesign = newDesign;
      await loadDesigns();
      renderDesignList();
      renderCanvas();
      promptBar.style.display = 'block';
    }
  } catch (err) {
    logProgress(`Error: ${err.message}`, 'error');
  }

  setTimeout(hideProgress, 500);
}

// Create from image
async function createFromImage(image) {
  createModal.classList.remove('open');
  showProgress('Matching image...');

  let newDesign = null;

  try {
    await streamSSE('/api/designs/from-image', { image }, (event) => {
      switch (event.type) {
        case 'phase':
          logProgress(`${event.phase}: ${event.description}`);
          break;
        case 'ai_response':
          if (event.thinking) {
            logProgress(event.thinking.slice(0, 100) + '...', 'thinking');
          }
          logProgress(`${event.patchCount} changes`);
          break;
        case 'critique':
          if (event.issues?.length) {
            logProgress(`Found ${event.issues.length} issues to fix`);
          }
          break;
        case 'patches_applied':
          logProgress(`Applied ${event.appliedCount} patches`);
          break;
        case 'render_update':
          logProgress('Rendered');
          break;
        case 'complete':
          logProgress(`Complete: ${event.reason}`);
          break;
        case 'done':
          newDesign = {
            id: event.id,
            name: event.name,
            document: event.document,
            thumbnail: event.thumbnail,
          };
          logProgress('Design ready');
          break;
        case 'error':
          logProgress(`Error: ${event.message}`, 'error');
          break;
      }
    });

    // Update immediately with the data we already have
    if (newDesign) {
      currentDesign = newDesign;
      await loadDesigns();
      renderDesignList();
      renderCanvas();
      promptBar.style.display = 'block';
    }
  } catch (err) {
    logProgress(`Error: ${err.message}`, 'error');
  }

  setTimeout(hideProgress, 500);
}

// Edit design
promptForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const prompt = promptInput.value.trim();
  if (!prompt || !currentDesign) return;

  sendBtn.disabled = true;
  setStatus('Thinking...');

  try {
    await streamSSE(`/api/designs/${currentDesign.id}/edit`, { prompt }, (event) => {
      switch (event.type) {
        case 'start':
        case 'status':
          setStatus(event.message);
          break;
        case 'thinking':
          setStatus(event.message);
          break;
        case 'complete':
          setStatus(event.message);
          break;
        case 'done':
          currentDesign.document = event.document;
          currentDesign.thumbnail = event.thumbnail;
          renderCanvas();
          renderDesignList();
          promptInput.value = '';
          setStatus(event.message || 'Done');
          break;
        case 'error':
          setStatus(event.message, true);
          break;
      }
    });
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    sendBtn.disabled = false;
  }
});

// Keyboard shortcut
promptInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    promptForm.dispatchEvent(new Event('submit'));
  }
});

// Start
init();
