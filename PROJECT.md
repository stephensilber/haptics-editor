# Web Haptics Monorepo

## Structure

```
packages/web-haptics/     # npm library (web-haptics) — vibration API with PWM intensity
site/                     # Demo/docs site for web-haptics library
apps/ahap-editor/         # Standalone AHAP designer tool (iOS Core Haptics)
apps/react-example/       # React usage example
apps/svelte-example/      # Svelte usage example
apps/vue-example/         # Vue usage example
```

## Key Technologies

- **pnpm workspaces** monorepo
- **Vite** bundler for all apps
- **React 18** + TypeScript (strict mode)
- **SCSS Modules** for component styling (`.module.scss`)
- **motion** (Framer Motion) for animations
- **tsup** for library builds

## web-haptics Library (`packages/web-haptics/`)

Core class: `WebHaptics` — wraps `navigator.vibrate()` with:
- PWM intensity modulation (20ms cycle, on/off segments)
- Debug mode: Web Audio API synthesis (noise bursts through bandpass filter)
- DOM-based click fallback for unsupported browsers
- Preset patterns: success, warning, error, light, medium, heavy, soft, rigid, selection, nudge, buzz

Exports: `web-haptics` (core), `web-haptics/react`, `web-haptics/vue`, `web-haptics/svelte`

Types: `Vibration { duration, intensity?, delay? }`, `HapticInput`, `TriggerOptions`

## Demo Site (`site/`)

- UA-based mobile/desktop routing (`/Mobi|Android/i`)
- Desktop: phone mockup with QR code, haptic builder
- Mobile: tabbed view (Play, Install, Build)
- `AppProvider` context: `debug` state (defaults on for desktop = audio feedback)
- `useHaptics` hook wraps `useWebHaptics` + favicon shake

### Haptic Builder (`site/src/surfaces/builder/`)
- Reducer-based state: `Tap { id, position, duration, intensity }`
- Timeline: 0–1000ms, click-to-add, drag-to-move, resize handles, intensity handles
- Collision detection prevents overlapping taps
- Playback via `trigger()` with RAF-based active tap highlighting + playhead animation
- Code generation output

## AHAP Editor (`apps/ahap-editor/`)

Standalone AHAP designer targeting iOS Core Haptics `.ahap` file output.

### Data Model
```typescript
AhapEvent { id, type: 'transient'|'continuous', time, duration, intensity, sharpness }
AhapProject { name, events: AhapEvent[] }
```

### Architecture
- `lib/ahap.ts` — Serialize/deserialize between `AhapEvent[]` and AHAP JSON format
- `lib/share.ts` — URL hash encoding (`#data=<base64url>`) for sharing patterns
- `lib/preview.ts` — Audio preview (Web Audio API noise synthesis) + Vibration API playback
  - Audio: RAF loop fires clicks at intensity-based intervals
  - Sharpness maps to bandpass filter frequency (2000–5000 Hz) and Q factor
  - Vibration: PWM modulation per event, scheduled via setTimeout
- `components/timeline/` — Main editor (forwardRef with imperative handle for play control)
  - Two event types: transient (dot/line) and continuous (resizable bar)
  - Sharpness → color hue encoding (warm=low, cool=high)
  - No collision detection (AHAP supports overlapping)
  - Configurable timeline duration (auto-expands)
  - Time in seconds with 0.05s snap grid
- `components/event-inspector/` — Selected event detail panel
- `components/toolbar/` — Play, add mode toggle, clear, share/import/download
- `views/mobile.tsx` — Stacked layout, share button, collapsible JSON preview
- `views/desktop.tsx` — Side-by-side with AHAP output panel, import modal

### AHAP JSON Format
```json
{
  "Version": 1.0,
  "Metadata": { "Project": "name" },
  "Pattern": [
    { "Event": { "Time": 0, "EventType": "HapticTransient", "EventParameters": [...] } },
    { "Event": { "Time": 0.5, "EventType": "HapticContinuous", "EventDuration": 1.0, "EventParameters": [...] } }
  ]
}
```

EventParameters: `HapticIntensity` (0–1), `HapticSharpness` (0–1).

### Running
```bash
cd apps/ahap-editor && pnpm dev
```

## Styling Conventions

- CSS variables defined in `variables.scss` (P3 color space with sRGB fallback)
- Colors: `--body`, `--body-light`, `--color`, `--color-muted`, `--color-light`, `--border`, `--blue`, `--green`, `--red`, etc.
- Fonts: `--font-primary` (Open Runde/SF Pro Rounded), `--font-code` (SF Mono)
- SCSS modules for component scoping
- `data-*` attributes for state-based styling (e.g., `data-active`, `data-selected`, `data-playing`)

## Common Patterns

- Reducer-based state management (no external state libraries)
- Pointer events for drag interactions (not mouse events) — supports touch
- `useClickOutside` for deselection
- Spring animations via motion library
- RAF loops for real-time playback visualization
- `useImperativeHandle` + `forwardRef` for cross-component play control
