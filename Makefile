.PHONY: dev start test test-analyze test-create test-match analyze clean

# Start development server with hot reload
dev:
	npm run dev

# Start production server
start:
	npm run start

# Run all tests (mocked, no API)
test: test-analyze test-create

# Run analysis tests
test-analyze:
	node test/analyze.test.js

# Run create/edit structure tests (mocked)
test-create:
	node test/create.test.js

# Run match test (uses test-image.png, requires API)
test-match:
	node test-match.js

# Run analysis on test image (debug output)
analyze:
	@node -e "\
	import { readFileSync } from 'fs'; \
	import { analyzeImage } from './server/analyze.js'; \
	const buf = readFileSync('./test-image.png'); \
	analyzeImage(buf).then(r => { \
	  console.log('Dimensions:', r.dimensions); \
	  console.log('Shapes:', JSON.stringify(r.shapes, null, 2)); \
	  console.log('Text blocks:', r.text.length); \
	});"

# Clean generated files
clean:
	rm -f test-match-output.json test-match-output.png
	rm -rf node_modules/.cache

# Install dependencies
install:
	npm install

# Show help
help:
	@echo "Available targets:"
	@echo "  make dev          - Start dev server with hot reload"
	@echo "  make start        - Start production server"
	@echo "  make test         - Run all tests"
	@echo "  make test-analyze - Run analysis tests"
	@echo "  make test-match   - Run image matching test"
	@echo "  make analyze      - Debug: analyze test-image.png"
	@echo "  make clean        - Remove generated files"
	@echo "  make install      - Install dependencies"
