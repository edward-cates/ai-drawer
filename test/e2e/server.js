// Test server with mocked AI and database
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuid } from 'uuid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(join(__dirname, '../../client')));

// In-memory storage for tests
let designs = [];
let versions = [];
const testUser = { id: 'test-user-id', email: 'test@example.com' };

// Mock auth - always authenticated
app.use((req, res, next) => {
  req.user = testUser;
  next();
});

// Config endpoint (no Supabase in tests)
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: '',
    supabaseAnonKey: '',
  });
});

// Usage endpoint
app.get('/api/usage', (req, res) => {
  res.json({ allowed: true, remaining: 20, limit: 20 });
});

// Get all designs
app.get('/api/designs', (req, res) => {
  res.json(designs.map(d => ({
    id: d.id,
    name: d.name,
    thumbnail: d.thumbnail,
    created_at: d.created_at,
    updated_at: d.updated_at,
  })));
});

// Get single design
app.get('/api/designs/:id', (req, res) => {
  const design = designs.find(d => d.id === req.params.id);
  if (!design) return res.status(404).json({ error: 'Not found' });
  res.json(design);
});

// Create from description (mocked)
app.post('/api/designs/from-description', (req, res) => {
  const { description } = req.body;
  if (!description) return res.status(400).json({ error: 'Missing description' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // Simulate AI response
  sendEvent({ type: 'status', message: 'Starting design...' });
  sendEvent({ type: 'status', message: 'AI is thinking...' });

  const mockDoc = {
    canvas: { width: 800, height: 600, background: '#ffffff' },
    elements: {
      'mock-rect': { id: 'mock-rect', type: 'rect', x: 100, y: 100, width: 200, height: 100, fill: '#3b82f6' },
      'mock-text': { id: 'mock-text', type: 'text', x: 200, y: 150, content: 'Mock Design', fontSize: 24, fill: '#000000' },
    },
  };

  const design = {
    id: uuid(),
    name: description.slice(0, 30),
    document: mockDoc,
    thumbnail: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  designs.unshift(design);

  sendEvent({ type: 'status', message: 'Design created!' });
  sendEvent({
    type: 'done',
    id: design.id,
    name: design.name,
    document: design.document,
    thumbnail: design.thumbnail,
  });

  res.end();
});

// Create from image (mocked)
app.post('/api/designs/from-image', (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'Missing image' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  sendEvent({ type: 'phase', phase: 'build', description: 'Building initial version' });
  sendEvent({ type: 'status', message: 'Building...' });
  sendEvent({ type: 'phase', phase: 'critique', description: 'Analyzing' });
  sendEvent({ type: 'phase', phase: 'fix', description: 'Fixing issues' });

  const mockDoc = {
    canvas: { width: 400, height: 300, background: '#f0f0f0' },
    elements: {
      'matched-rect': { id: 'matched-rect', type: 'rect', x: 50, y: 50, width: 300, height: 200, fill: '#ef4444' },
    },
  };

  const design = {
    id: uuid(),
    name: 'Matched Design',
    document: mockDoc,
    thumbnail: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  designs.unshift(design);

  sendEvent({
    type: 'done',
    id: design.id,
    name: design.name,
    document: design.document,
    thumbnail: design.thumbnail,
  });

  res.end();
});

// Edit design (mocked)
app.post('/api/designs/:id/edit', (req, res) => {
  const { prompt } = req.body;
  const design = designs.find(d => d.id === req.params.id);
  if (!design) return res.status(404).json({ error: 'Not found' });
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // Save version
  versions.push({
    id: uuid(),
    design_id: design.id,
    document: JSON.parse(JSON.stringify(design.document)),
    thumbnail: design.thumbnail,
    created_at: new Date().toISOString(),
  });

  sendEvent({ type: 'status', message: 'Analyzing design...' });
  sendEvent({ type: 'status', message: 'AI is thinking...' });

  // Mock edit - add a new element
  const newId = `edited-${Date.now()}`;
  design.document.elements[newId] = {
    id: newId,
    type: 'text',
    x: 200,
    y: 300,
    content: `Edit: ${prompt.slice(0, 20)}`,
    fontSize: 16,
    fill: '#666666',
  };
  design.updated_at = new Date().toISOString();

  sendEvent({
    type: 'done',
    document: design.document,
    thumbnail: design.thumbnail,
    message: 'Changes applied',
  });

  res.end();
});

// Get versions
app.get('/api/designs/:id/versions', (req, res) => {
  const designVersions = versions
    .filter(v => v.design_id === req.params.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(designVersions);
});

// Switch to version (doesn't modify history)
app.post('/api/designs/:id/revert/:versionId', (req, res) => {
  const design = designs.find(d => d.id === req.params.id);
  const version = versions.find(v => v.id === req.params.versionId);
  if (!design || !version) return res.status(404).json({ error: 'Not found' });

  // Just switch - no new history entry
  design.document = JSON.parse(JSON.stringify(version.document));
  design.thumbnail = version.thumbnail;

  res.json({ document: design.document, thumbnail: design.thumbnail });
});

// Duplicate
app.post('/api/designs/:id/duplicate', (req, res) => {
  const design = designs.find(d => d.id === req.params.id);
  if (!design) return res.status(404).json({ error: 'Not found' });

  const newDesign = {
    id: uuid(),
    name: `${design.name} (Copy)`,
    document: JSON.parse(JSON.stringify(design.document)),
    thumbnail: design.thumbnail,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  designs.unshift(newDesign);
  res.json(newDesign);
});

// Delete
app.delete('/api/designs/:id', (req, res) => {
  const idx = designs.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  designs.splice(idx, 1);
  res.json({ success: true });
});

// Rename
app.patch('/api/designs/:id', (req, res) => {
  const design = designs.find(d => d.id === req.params.id);
  if (!design) return res.status(404).json({ error: 'Not found' });
  if (req.body.name) design.name = req.body.name;
  res.json({ id: design.id, name: design.name });
});

// Render (mock - return empty PNG data)
app.get('/api/designs/:id/render', (req, res) => {
  const design = designs.find(d => d.id === req.params.id);
  if (!design) return res.status(404).json({ error: 'Not found' });

  // Return a tiny valid PNG (1x1 transparent pixel)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  res.setHeader('Content-Type', 'image/png');
  res.send(png);
});

// Reset endpoint for tests
app.post('/api/test/reset', (req, res) => {
  designs = [];
  versions = [];
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
});
