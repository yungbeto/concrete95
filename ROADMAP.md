# Concrete 95 — Roadmap

---

## Audio Engine

### Master Bus

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| M1 | `Tone.MultibandCompressor` | Replace the Distortion node. Split into 3 bands, compress highs aggressively, leave lows/mids open. More dynamic than a static saturation wet. Directly fixes Pad harshness. | High |
| M2 | `Tone.EQ3` — global high shelf | Insert a 3-band EQ before Destination. Trim air (8kHz+) globally without touching layer character. | High |
| M3 | Mid-Side processing | `Tone.MidSideSplit` + `Tone.MidSideMerge`. Apply heavier reverb to sides only, or gentle compression to the mid. Makes the mix wider without getting harsh. | Medium |

### FX Bus

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| F1 | Pre-send high shelf EQ | `EQ3` at `fxInput` to roll off highs before they hit the reverb. The main source of brightness in the reverb tail. | High |
| F2 | `Tone.FrequencyShifter` | Shifts signal by Hz, not semitones — produces inharmonic beating. At 2–5Hz on the reverb tail, creates slow metallic drift. Very distinct from the octave-up shimmer. A second shimmer option. | High |
| F3 | `Tone.Convolver` — IR reverb | Load a real IR (cathedral, stairwell, spring) as a second parallel reverb option. Gives the bus a specific *place* rather than the generic Freeverb wash. | Medium |
| F4 | `Tone.CrossFade` between reverb states | Smooth morphing between a short dry reverb and a long wet one over time. Currently transitions are abrupt. | Low |

### Per-Layer

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| L1 | `Tone.Compressor` on Pad layers | Slow-attack (80–150ms), slow-release (400ms+), 4:1 ratio, threshold ~-18dB. Lets attack bloom through while catching peaks. Immediately tames Pad harshness. | High |
| L2 | `Tone.BitCrusher` on Grain layers | Subtle lo-fi grit at bits=12–14. Probabilistic (10–20% chance of enabling per layer). Complements granular texture without being obviously digital. | Medium |
| L3 | `Tone.Chorus` on Grain layers | Currently only on Pad. A slow, deep chorus on a granular layer thickens it toward a string ensemble wash. | Medium |
| L4 | `Tone.Pattern` for Melodic sequencing | Replace `Tone.Sequence` flat array. Patterns like `randomWalk`, `upDown`, `alternateDown` generate more interesting melodic motion from the same note pool. | Medium |
| L5 | `Tone.MetalSynth` / `Tone.MembraneSynth` layer | Sparse percussive texture layer — FM partials for metallic resonance or tuned membrane sounds. Very low probability events at slow intervals. | Low |

### Modulation

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| O1 | `Tone.Follower` — envelope follower | Track amplitude of one layer and use it to modulate another (e.g., Pad amplitude drives Noise reverb send). Classic ambient cross-coupling. Not used anywhere. | Medium |
| O2 | Complex LFO waveforms | LFOs are all sine. `Tone.FatOscillator` (detuned unison), `Tone.AMOscillator`, and custom shapes as LFO sources for filter modulation would give more irregular, organic movement. | Low |

---

## UX / Experience

### Quick Wins

| # | Issue | Fix |
|---|-------|-----|
| U1 | No mute button on layer cards | Add a mute toggle to the title bar (next to close). Muting without removing is fundamental for AB testing and live arrangement. |
| U2 | Layer names can't be edited | Double-click the title bar text to rename inline. Right now names are stuck as random adjective+noun forever. |
| U3 | Stop All has no confirmation | Single click destroys everything instantly, no undo. Add a "Are you sure?" prompt or a 2-second undo toast: "Stopped all layers — Undo". |
| U4 | FX Send Bus not on desktop | It's only accessible via a small icon in the corner taskbar. Add `FXBus.exe` as a desktop icon alongside MasterFX, Settings, etc. |
| U5 | Desktop icons don't reflect open state | Clicking an already-open window's icon should look pressed/sunken (like Win95). Currently no visual indicator the window exists. |
| U6 | Seed is invisible | The PRNG seed drives the whole session's character, but you can only see it if you happen to share. Show the current seed as a small copyable token somewhere (e.g., in the session panel or footer). |
| U7 | Layer type has no color accent | All cards have the same blue title bar. Color-code by type (e.g., teal for Grain, amber for Synth Pad, violet for Melodic) so 6–8 layers are visually scannable at a glance. |
| U8 | Share button has no label | `Share2` icon in the corner is tiny and easy to miss. This is a key social feature — give it a text label or move it to a more prominent position. |

### Medium Effort

| # | Issue | Fix |
|---|---------|-----|
| M1 | Welcome dialog too vague | "Click Start to add a layer" doesn't help a new user build a good first soundscape. Add a **Quick Start** button that auto-loads a curated starter pack (1× Grain + 1× Synth Pad + 1× Atmosphere) with good defaults. |
| M2 | Layer cards can't collapse | With 8 layers the desktop gets very cluttered. Add a minimize button that collapses the card to just its title bar (no controls, no waveform). Clicking restores it. Minimized layers appear in the taskbar only. |
| M3 | Start menu has no layer descriptions | New users don't know what "Grain Texture" vs "Sample Loop" means. Add a short tooltip or description line under each option (e.g., "Granular time-stretch of a Freesound sample"). |
| M4 | Freesound loading has no progress | The card sits on "Loading..." with no spinner or ETA. Users tap away thinking it's broken. Add a deterministic loading animation and a timeout toast if it takes >10s. |
| M5 | Taskbar gets unreadably crowded | At 8 layers + open windows, taskbar items shrink to nothing. Separate layers and windows into distinct zones, or add an overflow menu. |
| M6 | Volume always buried in menu bar | The most-used control per layer requires opening the menu. Always show a compact volume slider directly on the card body below the waveform. |
| M7 | No keyboard shortcuts | Power users have no shortcuts. Minimum viable set: `M` = mute active layer, `Delete` = remove active layer, `Cmd/Ctrl+S` = save session, `Space` = stop all / resume all. |

### Bigger Investments

| # | Feature | Description |
|---|---------|-------------|
| B1 | Undo / undo-stack | Removing a layer or stopping all is irreversible. A single-level undo (or a 5s dismissable toast with undo action) would prevent a lot of frustration. |
| B2 | Layer templates / presets | Saved per-layer configurations: "warm grain pad", "sparse melodic", "deep atmosphere". Would let users quickly recall a known-good layer setup. |
| B3 | Soft snap / auto-arrange | Layer cards drift to the same corner. Even a loose snap-to-grid or an "auto-arrange" button that tiles all open cards neatly would help manage a full canvas. |
| B4 | Session import from file | Currently share is URL-only. Exporting and importing a `.json` session file means sessions can be backed up, version-controlled, or shared without Firebase. |

---

## Notes

- Audio priorities: fix Pad harshness first (M1, F1, L1), then explore new timbres (F2, L4)
- UX priorities: mute button (U1), rename (U2), Quick Start (M1), collapse (M2) — these all make the app feel more finished
- `Tone.FrequencyShifter` (F2) is the most musically novel addition and likely lowest effort to wire up
- `Tone.Pattern` (L4) changes musical behavior the most with minimal UI cost — just swap the sequencer internals
