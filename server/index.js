import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { matchImage } from './match.js';
import { editDesign } from './edit.js';
import { createFromDescription } from './create.js';
import { renderToBase64PNG } from './renderer.js';
import { supabase, getDesigns, getDesign, createDesign, updateDesign, deleteDesign, getUser, checkRateLimit, incrementUsage } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(join(__dirname, '../client')));

// Auth middleware - extracts user from Authorization header
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.slice(7);
  const user = await getUser(token);
  req.user = user;
  next();
}

// Require auth middleware
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

app.use(authMiddleware);

// Get Supabase config for client
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || 'https://staukauuowzlrooepwfo.supabase.co',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  });
});

// Get all designs (library)
app.get('/api/designs', requireAuth, async (req, res) => {
  const designs = await getDesigns(req.user.id);
  res.json(designs);
});

// Get a single design
app.get('/api/designs/:id', requireAuth, async (req, res) => {
  const design = await getDesign(req.params.id, req.user.id);
  if (!design) {
    return res.status(404).json({ error: 'Design not found' });
  }
  res.json(design);
});

// Check rate limit endpoint
app.get('/api/usage', requireAuth, async (req, res) => {
  const usage = await checkRateLimit(req.user.id);
  res.json(usage);
});

// Create new design from description (SSE)
app.post('/api/designs/from-description', requireAuth, async (req, res) => {
  const { description } = req.body;
  if (!description) {
    return res.status(400).json({ error: 'Missing description' });
  }

  // Check rate limit
  const usage = await checkRateLimit(req.user.id);
  if (!usage.allowed) {
    return res.status(429).json({
      error: 'Daily limit reached',
      message: `You've used all ${usage.limit} prompts for today. Try again tomorrow.`
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

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

    // Save to database
    const design = await createDesign(
      req.user.id,
      result.name || 'Untitled',
      result.document,
      thumbnail
    );

    // Increment usage
    await incrementUsage(req.user.id);

    sendEvent({
      type: 'done',
      id: design.id,
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
app.post('/api/designs/from-image', requireAuth, async (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Missing image' });
  }

  // Check rate limit (image matching uses 3 API calls, count as 3)
  const usage = await checkRateLimit(req.user.id);
  if (!usage.allowed) {
    return res.status(429).json({
      error: 'Daily limit reached',
      message: `You've used all ${usage.limit} prompts for today. Try again tomorrow.`
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

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

    // Save to database
    const design = await createDesign(
      req.user.id,
      'Matched Design',
      result.document,
      thumbnail
    );

    // Increment usage (image matching uses 3 API calls)
    await incrementUsage(req.user.id);
    await incrementUsage(req.user.id);
    await incrementUsage(req.user.id);

    sendEvent({
      type: 'done',
      id: design.id,
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
app.post('/api/designs/:id/edit', requireAuth, async (req, res) => {
  const { prompt } = req.body;

  const design = await getDesign(req.params.id, req.user.id);
  if (!design) {
    return res.status(404).json({ error: 'Design not found' });
  }
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  // Check rate limit
  const usage = await checkRateLimit(req.user.id);
  if (!usage.allowed) {
    return res.status(429).json({
      error: 'Daily limit reached',
      message: `You've used all ${usage.limit} prompts for today. Try again tomorrow.`
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await editDesign(design.document, prompt, [], (progress) => {
      sendEvent(progress);
    });

    let thumbnail = null;
    try {
      thumbnail = `data:image/png;base64,${renderToBase64PNG(result.document)}`;
    } catch (err) {
      console.error('Thumbnail render failed:', err);
    }

    // Update in database
    await updateDesign(req.params.id, req.user.id, {
      document: result.document,
      thumbnail,
    });

    // Increment usage
    await incrementUsage(req.user.id);

    sendEvent({
      type: 'done',
      document: result.document,
      thumbnail,
      message: result.message,
    });
  } catch (err) {
    console.error('Edit error:', err);
    sendEvent({ type: 'error', message: err.message });
  }

  res.end();
});

// Rename a design
app.patch('/api/designs/:id', requireAuth, async (req, res) => {
  const design = await getDesign(req.params.id, req.user.id);
  if (!design) {
    return res.status(404).json({ error: 'Design not found' });
  }

  if (req.body.name) {
    await updateDesign(req.params.id, req.user.id, { name: req.body.name });
  }

  res.json({ id: design.id, name: req.body.name || design.name });
});

// Duplicate a design
app.post('/api/designs/:id/duplicate', requireAuth, async (req, res) => {
  const design = await getDesign(req.params.id, req.user.id);
  if (!design) {
    return res.status(404).json({ error: 'Design not found' });
  }

  const newDesign = await createDesign(
    req.user.id,
    `${design.name} (Copy)`,
    design.document,
    design.thumbnail
  );

  res.json(newDesign);
});

// Delete a design
app.delete('/api/designs/:id', requireAuth, async (req, res) => {
  const success = await deleteDesign(req.params.id, req.user.id);
  if (!success) {
    return res.status(404).json({ error: 'Design not found' });
  }
  res.json({ success: true });
});

// Render a design to PNG
app.get('/api/designs/:id/render', requireAuth, async (req, res) => {
  const design = await getDesign(req.params.id, req.user.id);
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
  console.log(`AI Drawer server running at http://localhost:${PORT}`);
});
