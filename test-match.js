// Test script for image matching
import { readFileSync, writeFileSync } from 'fs';

const BASE_URL = 'http://localhost:3000';

async function test() {
  console.log('=== Testing Image Match (Build → Critique → Fix) ===\n');

  // 1. Create session
  console.log('Creating session...');
  const sessionRes = await fetch(`${BASE_URL}/api/session`, { method: 'POST' });
  const { sessionId } = await sessionRes.json();
  console.log(`Session: ${sessionId}\n`);

  // 2. Load test image
  console.log('Loading test-image.png...');
  const imageBuffer = readFileSync('./test-image.png');
  const imageBase64 = imageBuffer.toString('base64');
  const targetImage = `data:image/png;base64,${imageBase64}`;
  console.log(`Image size: ${imageBuffer.length} bytes\n`);

  // 3. Call match endpoint
  console.log('Starting match...\n');
  console.log('─'.repeat(70));

  const response = await fetch(`${BASE_URL}/api/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, targetImage }),
  });

  // 4. Stream results
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalDoc = null;
  let finalImage = null;

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
          handleEvent(event);

          if (event.type === 'final') {
            finalDoc = event.document;
            finalImage = event.image;
          }
        } catch (e) {
          console.error('Parse error:', e.message);
        }
      }
    }
  }

  console.log('─'.repeat(70));
  console.log('\n=== Match Complete ===\n');

  // 5. Save final output
  if (finalDoc) {
    writeFileSync('./test-match-output.json', JSON.stringify(finalDoc, null, 2));
    console.log('Saved document to test-match-output.json');
    console.log(`Final element count: ${Object.keys(finalDoc.elements).length}`);
  }

  if (finalImage) {
    const base64Data = finalImage.replace(/^data:image\/png;base64,/, '');
    writeFileSync('./test-match-output.png', Buffer.from(base64Data, 'base64'));
    console.log('Saved render to test-match-output.png');
  }
}

function handleEvent(event) {
  switch (event.type) {
    case 'init':
      console.log(`Target: ${event.targetWidth}x${event.targetHeight}`);
      break;

    case 'analyzing':
      console.log('Sampling colors from target...');
      break;

    case 'analysis_complete':
      console.log(`Sampled ${event.samples} grid points\n`);
      break;

    case 'phase':
      console.log(`\n>>> ${event.phase.toUpperCase()}: ${event.description}`);
      break;

    case 'ai_response':
      if (event.thinking) {
        // Truncate long thinking
        const thinking = event.thinking.length > 200
          ? event.thinking.slice(0, 200) + '...'
          : event.thinking;
        console.log(`    Thinking: ${thinking}`);
      }
      console.log(`    Patches: ${event.patchCount}`);
      break;

    case 'critique':
      if (event.issues?.length > 0) {
        console.log('    Issues found:');
        for (const issue of event.issues) {
          console.log(`      - ${issue}`);
        }
      }
      if (event.done) {
        console.log('    ✓ Critique approved - no fixes needed');
      }
      break;

    case 'validation_error':
      console.log(`    ✗ Invalid patch: ${event.error}`);
      break;

    case 'patches_applied':
      console.log(`    ✓ Applied ${event.appliedCount} patches. Elements: ${event.elementCount}`);
      break;

    case 'render_update':
      console.log(`    ✓ Rendered (${event.phase})`);
      break;

    case 'complete':
      console.log(`\n>>> COMPLETE (${event.reason})`);
      break;

    case 'error':
      console.log(`\n>>> ERROR: ${event.message}`);
      break;
  }
}

test().catch(console.error);
