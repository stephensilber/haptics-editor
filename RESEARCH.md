# AHAP & iOS Core Haptics Research

## AHAP File Format Specification

### Identity
- **Extension**: `.ahap`
- **UTI**: `public.haptics-content` (registered as `AVFileType.AHAP`, iOS 17+)
- **Format**: JSON-compliant text file
- **No standard MIME type** — use `application/json` or custom `application/haptics+json`

### Top-Level Structure

```json
{
  "Version": 1.0,
  "Metadata": {
    "Project": "MyApp",
    "Created": "2024-01-15",
    "Description": "A sample haptic pattern"
  },
  "Pattern": [
    { "Event": { ... } },
    { "Parameter": { ... } },
    { "ParameterCurve": { ... } }
  ]
}
```

- **`Version`** (Number): Core Haptics compatibility version. Currently `1.0`.
- **`Metadata`** (Object, optional): Freeform. Not processed by engine. Can contain `Project`, `Created`, `Description`, or anything.
- **`Pattern`** (Array): Array of dictionaries, each containing exactly one of: `Event`, `Parameter`, or `ParameterCurve`.

### Event Types

#### 1. HapticTransient
Brief, impulse-like haptic — a tap, click, or strike. Duration is implicit (determined by the Taptic Engine based on intensity). You do **not** specify `EventDuration`.

```json
{
  "Event": {
    "Time": 0.0,
    "EventType": "HapticTransient",
    "EventParameters": [
      { "ParameterID": "HapticIntensity", "ParameterValue": 0.8 },
      { "ParameterID": "HapticSharpness", "ParameterValue": 0.4 }
    ]
  }
}
```

#### 2. HapticContinuous
Sustained haptic with a looped waveform. Requires `EventDuration`. Max single event: **30 seconds**.

```json
{
  "Event": {
    "Time": 0.0,
    "EventType": "HapticContinuous",
    "EventDuration": 0.5,
    "EventParameters": [
      { "ParameterID": "HapticIntensity", "ParameterValue": 0.6 },
      { "ParameterID": "HapticSharpness", "ParameterValue": 0.3 }
    ]
  }
}
```

#### 3. AudioContinuous
Synthesized audio with a looped waveform. Requires `EventDuration`.

#### 4. AudioCustom
Plays a developer-supplied audio file from the app bundle. Requires `EventWaveformPath`.

```json
{
  "Event": {
    "Time": 0.0,
    "EventType": "AudioCustom",
    "EventWaveformPath": "Sounds/Explosion.caf",
    "EventParameters": [
      { "ParameterID": "AudioVolume", "ParameterValue": 0.75 }
    ]
  }
}
```

### Event Parameters

All 0–1 range unless noted.

| ParameterID | Range | Notes |
|---|---|---|
| `HapticIntensity` | 0–1 | Strength of haptic |
| `HapticSharpness` | 0–1 | 0 = round/organic, 1 = crisp/precise |
| `AttackTime` | 0–1 | Ramp-in time (normalized, not seconds) |
| `DecayTime` | 0–1 | Ramp-out time for unsustained events |
| `ReleaseTime` | 0–1 | Ramp-out after sustained event finishes |
| `Sustained` | 0 or 1 | 1 = sustained envelope |
| `AudioVolume` | 0–1 | Volume for audio events |
| `AudioBrightness` | 0–1 | High-frequency content |
| `AudioPan` | -1 to 1 | Stereo position |
| `AudioPitch` | -1 to 1 | Pitch offset |

`AttackTime`, `DecayTime`, `ReleaseTime`, `Sustained` apply to all event types **except** HapticTransient.

### Dynamic Parameters

Applied globally to all events at a given time. Intensity/Volume controls are **multiplicative**; all others are **additive**.

```json
{
  "Parameter": {
    "ParameterID": "HapticIntensityControl",
    "ParameterValue": 0.5,
    "Time": 1.0
  }
}
```

| ParameterID | Range | Application |
|---|---|---|
| `HapticIntensityControl` | 0–1 | Multiplicative on intensity |
| `HapticSharpnessControl` | -1 to 1 | Additive offset to sharpness |
| `HapticAttackTimeControl` | -1 to 1 | Additive offset |
| `HapticDecayTimeControl` | -1 to 1 | Additive offset |
| `HapticReleaseTimeControl` | -1 to 1 | Additive offset |
| `AudioVolumeControl` | 0–1 | Multiplicative on volume |
| `AudioBrightnessControl` | -1 to 1 | Additive offset |
| `AudioPanControl` | -1 to 1 | Additive offset |
| `AudioPitchControl` | -1 to 1 | Additive offset |
| `AudioAttackTimeControl` | -1 to 1 | Additive offset |
| `AudioDecayTimeControl` | -1 to 1 | Additive offset |
| `AudioReleaseTimeControl` | -1 to 1 | Additive offset |

### Parameter Curves

Schedule parameter changes over time with linear interpolation between control points.

```json
{
  "ParameterCurve": {
    "ParameterID": "HapticIntensityControl",
    "Time": 0.0,
    "ParameterCurveControlPoints": [
      { "Time": 0.0, "ParameterValue": 0.2 },
      { "Time": 0.5, "ParameterValue": 0.9 },
      { "Time": 1.0, "ParameterValue": 0.4 }
    ]
  }
}
```

**Critical limitation**: Max **16 control points** per curve. Points beyond the 16th are **silently ignored**.

### Minimal Valid AHAP

```json
{
  "Version": 1.0,
  "Pattern": [
    {
      "Event": {
        "Time": 0.0,
        "EventType": "HapticTransient"
      }
    }
  ]
}
```

Missing parameters default to system values. Out-of-range values are silently clamped. Unsupported keys are silently ignored.

---

## Core Haptics Framework (iOS)

### Setup
```swift
import CoreHaptics

let engine = try CHHapticEngine()
try engine.start()
```

### Loading AHAP
```swift
// Fire-and-forget
try engine.playPattern(from: URL(fileURLWithPath: path))

// With player control
let pattern = try CHHapticPattern(contentsOf: url)
let player = try engine.makePlayer(with: pattern)
try player.start(atTime: CHHapticTimeImmediate)

// Advanced (looping, pause, resume, seek)
let advancedPlayer = try engine.makeAdvancedPlayer(with: pattern)
advancedPlayer.loopEnabled = true
try advancedPlayer.start(atTime: CHHapticTimeImmediate)
```

### Capability Check
```swift
guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
```

### Device Support
- **Full support**: iPhone 8 and later (all models)
- **No haptic hardware**: iPads (except via Apple Pencil Pro / Magic Keyboard M4)
- **Limited**: Mac via Catalyst (Force Touch trackpad uses different API)
- **Separate API**: Apple Watch (WKHapticType)
- **No haptics**: Simulator

### When Haptics Won't Play
- Low Power Mode enabled
- Taptic Engine disabled in system settings
- Camera is active
- Dictation is active
- Device lacks haptic hardware

---

## Taptic Engine Hardware

- Linear Resonant Actuator (LRA)
- iPhone 8+: wider frequency range and better precision
- Continuous event sharpness maps to frequency: 0.0 ≈ 80 Hz, 1.0 ≈ 230 Hz (iPhone 8)
- Transient sharpness maps to a low-pass filter (low = darker/softer, high = brighter/crisper)

---

## Key Constraints Summary

| Constraint | Value |
|---|---|
| Max continuous event duration | 30 seconds |
| Max parameter curve control points | 16 per curve |
| Intensity range | 0–1 |
| Sharpness range | 0–1 |
| Time values | Seconds (float), relative to pattern start |
| Overlapping events | Allowed, but don't blend cleanly |
| Missing parameters | Default to system values |
| Out-of-range values | Silently clamped |
| Unsupported keys | Silently ignored |

---

## Web Vibration API vs Core Haptics

### What the Web Vibration API Can Do
- `navigator.vibrate(pattern)` — pattern is `number` (ms) or alternating on/off array `[vibrate, pause, vibrate, ...]`
- Binary on/off only — no intensity, no frequency control
- **Not supported in Safari (any version)** — Android Chrome/Firefox/Edge only
- iOS 18+ workaround: `ios-vibrator-pro-max` npm package exploits unofficial Safari vibration

### Feature Gap

| Feature | AHAP | Web Vibration API |
|---|---|---|
| Intensity (0–1) | Yes | No (binary) |
| Sharpness/frequency | Yes | No |
| Transient events | Yes | Approximate (short pulse) |
| Continuous events | Yes | Yes (no amplitude control) |
| Parameter curves | Yes | No |
| Dynamic parameters | Yes | No |
| Audio sync | Yes | No |
| Overlapping events | Yes | No |
| Attack/Decay/Release | Yes | No |

### What We CAN Preview on Web
- HapticTransient → short vibration pulse (10–50ms)
- HapticContinuous → sustained vibration
- Event timing → `setTimeout`/`requestAnimationFrame`
- Intensity → PWM simulation (rapid on/off pulses)
- Audio events → Web Audio API (not synced with vibration)
- Visual preview → timeline visualization

### What We CANNOT Preview on Web
- Sharpness (no motor frequency control)
- True intensity gradation (only PWM approximation)
- Parameter curves with smooth interpolation
- Attack/Decay/Release envelopes
- Overlapping haptic events
- Audio + haptic synchronization
- Any haptics on Safari/iOS (no `navigator.vibrate()`)

### Sharpness Approximation Strategies (Visual/Audio Only)
1. **Visual**: Show as waveform frequency — low sharpness = smooth, high sharpness = jagged
2. **Audio sonification**: Map to audio frequency/brightness
3. **Vibration hint (Android)**: Vary pulse timing — shorter/frequent for high sharpness
4. **Color coding**: Warm/soft = low sharpness, cool/bright = high sharpness

---

## Existing Tools

### Captain AHAP (ahap.fancypixel.it)
Web-based AHAP designer — requires JS to run, could not inspect details. Serves as prior art for what we're building.

### expo-ahap (Evan Bacon)
React Native/Expo package for playing AHAP files. Shows community interest in cross-platform AHAP tooling.

---

## Architecture Decisions for Our Tool

### Scope: What AHAP Features to Support in Editor

**Must have (v1)**:
- HapticTransient events (time, intensity, sharpness)
- HapticContinuous events (time, duration, intensity, sharpness)
- Multiple events on a timeline
- AHAP file export (valid JSON)
- AHAP file import (parse and load into editor)
- Web preview via Vibration API (intensity approximation, sharpness visual only)

**Nice to have (v2)**:
- Parameter curves (HapticIntensityControl, HapticSharpnessControl)
- Dynamic parameters
- Audio events (AudioContinuous, AudioCustom)
- Attack/Decay/Release controls
- Metadata editing

**Out of scope**:
- Audio file bundling (AudioCustom waveform paths)
- Real-time dynamic parameter modification during playback

### Data Model Mapping

```
Current Tap → AHAP HapticContinuous (has duration)
                or HapticTransient (when duration ≈ 0 or below threshold)

Tap.position (ms) → Event.Time (seconds, / 1000)
Tap.duration (ms) → Event.EventDuration (seconds, / 1000)
Tap.intensity (0-1) → HapticIntensity (0-1) ← direct map
NEW: Tap.sharpness (0-1) → HapticSharpness (0-1)
NEW: Tap.type → "transient" | "continuous"
```

### Timeline Changes
- Current: 0–1000ms (1 second)
- AHAP: Seconds-based, no hard limit on pattern length
- New: Configurable timeline length, default 1–2 seconds, allow extension up to 30s

### Import/Export Flow

**Mobile web (design + preview)**:
1. Design pattern in editor
2. Preview with vibration (Android) or audio (iOS fallback)
3. Export as shareable string (base64-encoded AHAP JSON? URL param? QR code?)
4. Copy string to clipboard

**Desktop web (import + save)**:
1. Paste/import shareable string
2. Visualize pattern in editor
3. Download as `.ahap` file
4. Optionally edit and re-export

### Sharing Format Options
1. **Base64-encoded JSON in URL hash** — `https://site.com/ahap#eyJ...` — simple, shareable
2. **Compressed + base64** — for longer patterns
3. **QR code** — mobile to desktop transfer
4. **Raw JSON copy** — paste the AHAP JSON directly

---

## References

- [AHAP File Format — Apple Developer](https://developer.apple.com/documentation/corehaptics/representing-haptic-patterns-in-ahap-files)
- [Playing AHAP from File — Apple Developer](https://developer.apple.com/documentation/corehaptics/playing-a-custom-haptic-pattern-from-a-file)
- [Core Haptics — Apple Developer](https://developer.apple.com/documentation/corehaptics/)
- [CHHapticEvent — Apple Developer](https://developer.apple.com/documentation/corehaptics/chhapticevent)
- [CHHapticEvent.EventType — Apple Developer](https://developer.apple.com/documentation/corehaptics/chhapticevent/eventtype)
- [CHHapticEvent.ParameterID — Apple Developer](https://developer.apple.com/documentation/corehaptics/chhapticevent/parameterid)
- [AVFileType.AHAP — Apple Developer](https://developer.apple.com/documentation/avfoundation/avfiletype/ahap)
- [Introducing Core Haptics — WWDC19](https://developer.apple.com/videos/play/wwdc2019/520/)
- [Expanding Sensory Experience — WWDC19](https://developer.apple.com/videos/play/wwdc2019/223/)
- [10 Things About Core Haptics — Daniel Buttner](https://danielbuettner.medium.com/10-things-you-should-know-about-designing-for-apple-core-haptics-9219fdebdcaa)
- [Core Haptics Tutorial — Exyte](https://exyte.com/blog/creating-haptic-feedback-with-core-haptics)
- [Core Haptics — Donny Wals](https://www.donnywals.com/adding-haptics-to-your-app/)
- [expo-ahap — Evan Bacon](https://github.com/EvanBacon/expo-ahap)
- [Vibration API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API)
- [ios-vibrator-pro-max](https://github.com/samdenty/ios-vibrator-pro-max)
- [Captain AHAP — FancyPixel](https://ahap.fancypixel.it/)
