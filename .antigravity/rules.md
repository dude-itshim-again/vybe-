# VibeForge Workspace Architectural Guardrails

## 1. Authoritative Specifications
All implementation across the repository must strictly conform to `/docs/01_SYSTEM_ARCHITECTURE.md` through `/docs/06_IMPLEMENTATION_ROADMAP.md`. Any structural changes to audio graphs, schemas, or algorithms must first be updated in the `/docs` documentation suite.

## 2. Strict 60fps Rendering Invariant
Never store high-frequency audio analysis data (FFT bins, sub-bass energy, or millisecond word-fill progress) inside React `useState` or component state.
* Continuous visual animations, audio reactivity, and canvas rendering MUST be driven directly via `requestAnimationFrame`.
* Frame updates must mutate DOM elements directly or update CSS Custom Properties (`--bass-energy`, `--word-progress`) on `:root` or container style declarations to prevent React reconciliation overhead.

## 3. Anti-Clip Guarantee
All Web Audio API filter chains and audio processing graphs MUST route through a `DynamicsCompressorNode` configured as a brickwall/soft-knee limiter before connecting to `AudioContext.destination`.
* Default limiter constraints: `threshold = -6dB`, `knee = 12dB`, `ratio = 12`, `attack = 0.003s`, `release = 0.25s`.
* When a limiter bypass is enabled for testing, visual clipping warnings must be exposed to the user.

## 4. Clean Modular Structure
Keep DSP classes pure TypeScript inside `src/audio/` decoupled from React components.
* Audio processing classes must accept native Web Audio interfaces and contain zero JSX or React dependencies.
* React hooks (`src/hooks/`) act solely as lifecycle bridges between the browser DOM and the audio engine.
