# Pine Validator Playground

A lightweight Monaco Editor runner bundled with the Pine Script v6 validator. Use it to iterate on scripts and observe validator output in real time without launching the full Algo Trade Analytics application.

## Getting Started

```bash
cd pine-validator/playground
npm install
npm run dev
```

The dev server opens on <http://localhost:5173>. Edit the script in the Monaco panel—diagnostics appear in the side panel and inline markers update live.

## Features

- Monaco editor with a minimal Pine Script language definition
- Live validation powered by `EnhancedModularValidator`
- Inline markers for errors/warnings
- Quick snippet buttons for common scenarios
- Theme toggle (light/dark)

## Build & Preview

```bash
npm run build
npm run preview
```

## Notes

- The playground imports validator source directly from `pine-validator`, so keep it in sync with core changes.
- The Vite server is configured to allow access to parent directories (`server.fs.allow`).
- Adjust or expand the snippet list in `src/App.tsx` to cover additional workflows.
