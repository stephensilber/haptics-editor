# Agent Instructions

## Project Overview

This is a **pnpm monorepo** with a haptic feedback npm library (`web-haptics`) and several apps. The primary active development area is `apps/ahap-editor/` — a standalone AHAP file designer for iOS Core Haptics.

## Before You Start

- Read `PROJECT.md` for full architecture and data model details
- Read `RESEARCH.md` for AHAP file format spec and iOS Core Haptics constraints
- The codebase uses **strict TypeScript** — always run `npx tsc --noEmit` after changes
- SCSS modules are used for all component styles — never use inline styles for layout

## Code Style

- **No unnecessary comments** — don't add comments that just describe what the code does. Only comment non-obvious decisions.
- Follow existing patterns: reducer-based state, pointer events for drag, SCSS modules, motion library for animations
- Use `data-*` attributes for CSS state instead of conditional classnames
- Keep components in `index.tsx` with co-located `styles.module.scss`
- Prefer editing existing files over creating new ones

## File Locations

### AHAP Editor (primary work area)
| Purpose | Path |
|---|---|
| Entry point | `apps/ahap-editor/src/main.tsx` |
| App router | `apps/ahap-editor/src/App.tsx` |
| Data types | `apps/ahap-editor/src/lib/types.ts` |
| AHAP serialization | `apps/ahap-editor/src/lib/ahap.ts` |
| URL sharing | `apps/ahap-editor/src/lib/share.ts` |
| Audio/vibration preview | `apps/ahap-editor/src/lib/preview.ts` |
| Timeline editor | `apps/ahap-editor/src/components/timeline/index.tsx` |
| Event inspector | `apps/ahap-editor/src/components/event-inspector/index.tsx` |
| Toolbar | `apps/ahap-editor/src/components/toolbar/index.tsx` |
| Desktop view | `apps/ahap-editor/src/views/desktop.tsx` |
| Mobile view | `apps/ahap-editor/src/views/mobile.tsx` |
| View styles | `apps/ahap-editor/src/views/styles.module.scss` |
| CSS variables | `apps/ahap-editor/src/styles/variables.scss` |

### Library (reference, rarely modified)
| Purpose | Path |
|---|---|
| Core class + PWM engine | `packages/web-haptics/src/lib/web-haptics/index.ts` |
| Preset patterns | `packages/web-haptics/src/lib/web-haptics/patterns.ts` |
| Types | `packages/web-haptics/src/lib/web-haptics/types.ts` |

### Original Site (reference for interaction patterns)
| Purpose | Path |
|---|---|
| Haptic builder (reference) | `site/src/surfaces/builder/index.tsx` |
| Builder styles (reference) | `site/src/surfaces/builder/styles.module.scss` |

## Key Architecture Decisions

1. **AHAP editor is decoupled from web-haptics library** — it has its own audio engine in `preview.ts` because AHAP has a different data model (sharpness, overlapping events, seconds-based timing)
2. **Timeline uses forwardRef + useImperativeHandle** — exposes `play()`, `playing`, and `totalDuration` so the toolbar can trigger playback while the timeline owns the visual state (playhead, active events)
3. **No collision detection** — unlike the original builder, AHAP supports overlapping haptic events
4. **Sharpness is visual-only on web** — mapped to color hue in the timeline and bandpass filter frequency in audio preview. Can't control motor frequency via Web Vibration API.
5. **Sharing uses URL hash** — `#data=<base64url encoded JSON>` so patterns can be shared without a server

## Development Commands

```bash
# Run AHAP editor
cd apps/ahap-editor && pnpm dev

# Type check
cd apps/ahap-editor && npx tsc --noEmit

# Build
cd apps/ahap-editor && npx vite build

# Run original site (for reference)
pnpm run site:dev    # from repo root
```

## Testing Changes

After making changes to the AHAP editor:
1. Run TypeScript check: `npx tsc --noEmit`
2. Start dev server: `pnpm dev`
3. Verify in browser:
   - Timeline renders events correctly
   - Click to add events (transient/continuous mode)
   - Drag to move, resize handles work
   - Play button triggers audio + playhead animation
   - Inspector shows when event is selected
   - Download produces valid AHAP JSON
   - Import modal accepts raw AHAP JSON

## AHAP Format Quick Reference

```json
{
  "Version": 1.0,
  "Pattern": [
    {
      "Event": {
        "Time": 0.0,
        "EventType": "HapticTransient",
        "EventParameters": [
          { "ParameterID": "HapticIntensity", "ParameterValue": 0.8 },
          { "ParameterID": "HapticSharpness", "ParameterValue": 0.5 }
        ]
      }
    },
    {
      "Event": {
        "Time": 0.5,
        "EventType": "HapticContinuous",
        "EventDuration": 1.0,
        "EventParameters": [
          { "ParameterID": "HapticIntensity", "ParameterValue": 0.6 },
          { "ParameterID": "HapticSharpness", "ParameterValue": 0.3 }
        ]
      }
    }
  ]
}
```

- Transient: no `EventDuration` (implicit from Taptic Engine)
- Continuous: requires `EventDuration` (max 30s)
- Intensity/Sharpness: 0–1 range
- Time: seconds (float)
- Missing params default to system values
- Out-of-range values silently clamped
- Audio events (`AudioContinuous`, `AudioCustom`) are ignored during import
