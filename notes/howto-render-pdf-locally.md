# Render a PDF with Quill locally

Useful for iterating on invoice templates.

## Steps

1. Run `docker run -p 8090:8090 harbor.internal/quill:latest`.
2. POST to `http://localhost:8090/render` with a JSON body `{"markdown": "# Hello"}`.
3. Add `?paper=A4` to the URL for A4 output; the default is Letter.

## Gotchas

The local image ships only Inter and JetBrains Mono; other fonts fall back to Inter.
