import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { matchImage } from './match.js';
import { editDesign } from './edit.js';
import { createFromDescription } from './create.js';
import { createEmptyDocument } from '../shared/schema.js';
import { renderToBase64PNG } from './renderer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// In-memory design library (replace with DB for production)
const designs = new Map();

app.use(express.json({ limit: '50mb' }));
app.use(express.static(join(__dirname, '../client')));

// Get all designs (library)
app.get('/api/designs', (req, res) => {
  const list = [];
  for (const [id, design] of designs) {
    list.push({
      id,
      name: design.name,
      thumbnail: design.thumbnail,
      createdAt: design.createdAt,
      updatedAt: design.updatedAt,
    });
  }
  list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json(list);
});

// Get a single design
app.get('/api/designs/:id', (req, res) => {
  const design = designs.get(req.params.id);
  if (!design) {
    return res.status(404).json({ error: 'Design not found' });
  }
  res.json(design);
});

// Create new design from description (SSE)
app.post('/api/designs/from-description', async (req, res) => {
  const { description } = req.body;
  if (!description) {
    return res.status(400).json({ error: 'Missing description' });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const id = uuidv4();
  const now = new Date().toISOString();

  try {
    const result = await createFromDescription(description, (progress) => {
      sendEvent(progress);
    });

    let thumbnail = null;
    try {
      thumbnail = `data:image/png;base64,${renderToBase64PNG(result.document)}`;
    } catch (err) {
      console.error('Thumbnail render failed:', err);
    }

    const design = {
      id,
      name: result.name || 'Untitled',
      document: result.document,
      thumbnail,
      history: [],
      createdAt: now,
      updatedAt: now,
    };

    designs.set(id, design);

    sendEvent({
      type: 'done',
      id,
      name: design.name,
      thumbnail,
      document: design.document,
    });
  } catch (err) {
    console.error('Create from description error:', err);
    sendEvent({ type: 'error', message: err.message });
  }

  res.end();
});

// Create new design from image (SSE)
app.post('/api/designs/from-image', async (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Missing image' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const id = uuidv4();
  const now = new Date().toISOString();

  try {
    let base64Data = image;
    if (image.startsWith('data:')) {
      base64Data = image.split(',')[1];
    }
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const result = await matchImage(imageBuffer, {
      onProgress: (progress) => {
        sendEvent(progress);
      },
    });

    let thumbnail = null;
    try {
      thumbnail = `data:image/png;base64,${renderToBase64PNG(result.document)}`;
    } catch (err) {
      console.error('Thumbnail render failed:', err);
    }

    const design = {
      id,
      name: 'Matched Design',
      document: result.document,
      thumbnail,
      history: [],
      createdAt: now,
      updatedAt: now,
    };

    designs.set(id, design);

    sendEvent({
      type: 'done',
      id,
      name: design.name,
      thumbnail,
      document: design.document,
    });
  } catch (err) {
    console.error('Create from image error:', err);
    sendEvent({ type: 'error', message: err.message });
  }

  res.end();
});

// Edit a design with natural language (SSE)
app.post('/api/designs/:id/edit', async (req, res) => {
  const { prompt } = req.body;
  const design = designs.get(req.params.id);

  if (!design) {
    return res.status(404).json({ error: 'Design not found' });
  }
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await editDesign(design.document, prompt, design.history, (progress) => {
      sendEvent(progress);
    });

    // Update design
    design.document = result.document;
    design.history.push({ role: 'user', content: prompt });
    design.history.push({ role: 'assistant', content: result.response });
    design.updatedAt = new Date().toISOString();

    if (design.history.length > 20) {
      design.history = design.history.slice(-20);
    }

    try {
      design.thumbnail = `data:image/png;base64,${renderToBase64PNG(design.document)}`;
    } catch (err) {
      console.error('Thumbnail render failed:', err);
    }

    sendEvent({
      type: 'done',
      document: design.document,
      thumbnail: design.thumbnail,
      message: result.message,
    });
  } catch (err) {
    console.error('Edit error:', err);
    sendEvent({ type: 'error', message: err.message });
  }

  res.end();
});

// Rename a design
app.patch('/api/designs/:id', (req, res) => {
  const design = designs.get(req.params.id);
  if (!design) {
    return res.status(404).json({ error: 'Design not found' });
  }

  if (req.body.name) {
    design.name = req.body.name;
    design.updatedAt = new Date().toISOString();
  }

  res.json({ id: design.id, name: design.name });
});

// Delete a design
app.delete('/api/designs/:id', (req, res) => {
  if (!designs.has(req.params.id)) {
    return res.status(404).json({ error: 'Design not found' });
  }
  designs.delete(req.params.id);
  res.json({ success: true });
});

// Render a design to PNG
app.get('/api/designs/:id/render', (req, res) => {
  const design = designs.get(req.params.id);
  if (!design) {
    return res.status(404).json({ error: 'Design not found' });
  }

  try {
    const png = renderToBase64PNG(design.document);
    const buffer = Buffer.from(png, 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Render failed' });
  }
});

app.listen(PORT, () => {
  console.log(`AI Design server running at http://localhost:${PORT}`);
});
