# AI Drawer

AI-native design tool. Describe what you want or upload an image — AI creates editable vector designs.

## Features

- **Create from description** — "A flow diagram showing user authentication"
- **Create from image** — Upload a screenshot, AI recreates it as editable shapes
- **Edit with natural language** — "Make the title bigger" / "Change the background to blue"

## Quick Start

```bash
npm install
export ANTHROPIC_API_KEY=your-key
npm run dev
```

Open http://localhost:3000

## How It Works

1. Designs are stored as JSON documents with geometric primitives (rects, paths, text, etc.)
2. Claude Opus analyzes your request and outputs structured patches
3. Patches are validated and applied to the document
4. Document renders to SVG (client) or PNG (server)

## Tech Stack

- **Frontend**: Vanilla JS, SVG rendering
- **Backend**: Node.js, Express
- **AI**: Claude Opus 4.5 with structured output (tool_choice)
- **Rendering**: resvg-js for server-side PNG

## Development

```bash
make dev      # Start dev server with hot reload
make test     # Run tests (no API calls)
make help     # Show all commands
```

## License

MIT
