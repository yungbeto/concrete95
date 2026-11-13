# Concrete 95 — Roadmap

---

## Code Review Backlog (2026-11-13)

Findings from a full read of the audio engine, client, sessions/share, Freesound path, Firestore rules and canvas components. Tick items off as they land.

### Bugs

- [x] **R1 Auto-save loses edits.** The 30s auto-save effect (`EtherealAcousticsClient.tsx`, deps `[isSessionDirty, activeSession?.id, user?.uid]`) captures `layers`/settings from the *first* dirty render, saves that stale snapshot, then marks the session clean, so later edits are lost and the beforeunload warning disappears. Read current state from refs when the timer fires.
- [x] **R2 Drone layers restore as Pads.** `handleLoadSession`'s `else` branch handles `drone` with `startSynthLoop`. Removing it later calls `stopDroneLoop` on a Sequence, which leaks the synth, FX and detune interval.
- [x] **R3 Settings not saved or tracked.** `collectSettings()` omits `convolverMix` (Space), `lofiAmount`, `warbleAmount`, and the dirty-tracking deps also miss `freqShift`. Layer `isMuted` isn't saved.
- [x] **R4 Diffusion slider is a no-op.** `Tone.Reverb` has no `diffusion` property. *Done: control removed; value kept in sessions for compatibility.*
- [x] **R5 Share has no error handling.** If `saveSharedSession` throws, the share panel spins forever. `firestore.rules` has no `shared_sessions` match (default deny), so verify the deployed rules. Each panel open writes a new doc, so reuse the ID while the session is unchanged. *Done: falls back to an lz-string link if Firestore fails, reuses the link while unchanged, recipient sees a toast for a broken link, `shared_sessions` rule added to `firestore.rules`. **Not deployed:** run `firebase deploy --only firestore:rules`.*
- [x] **R6 Seeded melodies aren't reproducible.** The `random`/`randomWalk` patterns in `startMelodicLoop` use `Math.random()` when building events, so share links get different notes.
- [x] **R7 Disabling Drift reverts the user's cutoff.** `setLayerFilterCutoff` updates `driftCenter` but not `driftOriginalCenter`.
- [x] **R8 Grain seek doesn't stick.** `handleSeek` restarts only voice 0 and doesn't update `grainStartedAt`/`grainStartOffset`, so the scatter timer snaps it back.
- [x] **R9 `createdAt` overwritten on every save** (`buildSession`: `existingId ? now : now`).
- [ ] **R10 Guestbook `createdAt` is client-supplied**, so ordering can be spoofed. Use `serverTimestamp()` / validate against `request.time`. *Blocker: existing docs store an ISO string and `migrateLocalEntries` intentionally writes past timestamps. Needs a schema decision (e.g. add `serverCreatedAt` validated `== request.time`, order by it, backfill old docs).*
- [x] **R11 Remove / Stop All clicks.** Volume jumps to -∞ and dispose cuts release tails. Add a ~300ms fade.
- [x] **R12 Shortcuts fire on focused sliders/buttons.** Space = Stop All, Backspace = delete layer. Ignore `role=slider`, buttons, etc.
- [x] **R13 FX/Master sliders were uncontrolled** (`defaultValue`), so loading a session moved the labels but not the thumbs. *Now `value`.*
- [x] **R14 Drift toggle skipped the newest layer.** The memoized Settings window captured a stale `layers` array (memo keyed on `layers.length`; the node arrives after). *Handlers read `layersRef`.*

### Hygiene

- [x] **H1** `ignoreBuildErrors: true` hides 6 real TS errors in `AudioEngine.tsx`. Fix them, then turn the flag off. *Done: `tsc` clean, flag removed, `next build` passes.*
- [x] **H2** Delete unused shadcn components whose deps aren't installed (`calendar`, `carousel`, `chart`, `form`). *Also removed `sidebar`, which was unused.*
- [x] **H3** 23 build files under `.firebase/` are tracked. Ignore `.firebase/` entirely and `git rm --cached` them.
- [ ] **H4** `/api/audio-proxy` is an open proxy and is now dead in prod (egress block). Remove it or restrict it.

### Performance

- [x] **P1 Reverb Decay slider regenerates the IR on every drag tick** (offline render of up to 10s). Apply on `onValueCommit` / debounce.
- [x] **P2 Always-on FX at 0:** FX-bus convolver (3.5s stereo), shimmer PitchShift, FrequencyShifter, master BitCrusher + Chorus at wet 0, per-grain BitCrusher at wet 0 (~60% of grain layers). Connect only when amount > 0 / create lazily. *Done: FX-bus branches fed only when > 0, Lo-fi/Warble spliced out of the master chain at 0 (`rewireMasterTail`), grain BitCrusher only built when it rolls on. Dry routing verified headless; the CPU win and wet-path sound still need a real-device listen.*
- [x] **P3 Dragging re-renders everything.** Each mousemove calls `setLayers` → whole client + all LayerCards re-render, and the session is marked dirty. rAF-throttle (or transform via ref, commit on mouseup) + `React.memo(LayerCard)`; don't mark dirty until drop. *Done: rAF-coalesced drag, `React.memo(LayerCard)` with stable id-based handlers, dirty marked once on drop (and not for a plain title-bar click).*
- [x] **P4 Freesound round-trip per layer.** A server action searches Freesound every add; the fallback reads 200 Firestore docs each call. Prefetch the list at boot and cache it client-side and server-side (TTL). *Done: client pool cache (10 min TTL, stale-while-revalidate, prefetched at engine init, avoids sounds already playing) + server-side 15 min cache of the Firestore fallback.*
- [ ] **P5 Recording memory.** Float32 chunks: ~230MB for 10 min, doubled at merge. Convert to Int16 incrementally.
- [x] **P6 Visualizer:** both canvases render in fullscreen; new `Uint8Array` allocated per frame; GL resources not freed on shuffle. *Done: GL program/shader/texture/buffer freed on shuffle and unmount, wave buffer reused per frame, windowed canvas skipped while fullscreen is open.*
- [x] **P7 Layer waveform canvas** has no width/height (blurry, no DPR handling). *Done: layer waveform canvas sized to CSS × devicePixelRatio via ResizeObserver.*
- [x] **P8 Pad detune** uses a 50ms `setInterval` + `synth.set()` per layer. Slow it down / ramp. *Done: 250ms steps (< 0.5 cent per step).*
- [x] **P9 Zipper noise.** Param setters use `.value =`. Use `rampTo(v, 0.05)` for gains, filters, sends. *Done: everything user-facing glides — volume, sends, filters, delay, reverb wet, warmth, lo-fi/warble (spliced out only after gliding dry), space/shimmer/freq shift.*

### Delight ideas

- [x] **D1 Key lock.** Pads/Melodies get a random 0–11 semitone transpose, so layers in the same scale clash. Add a "lock to one key" option. *Done: Settings → Key (Free or C–B), defaults to a random locked key on fresh load; drones tune to the root; key shown in each layer's Info; saved in sessions (`keyRoot`, absent = Free so old links sound the same). Follow-up done: in minor modes the drone swaps partial 5 (major 3rd) for 4.*
- [x] **D2 Re-roll layer.** Regenerate a layer's sound, keeping position/volume/send. *Done: ↻ in each card's title bar; 1.5s crossfade; respects key lock, mute, probability, drift; samples keep playing until the new one loads.*
- [ ] **D3 Evolve mode.** Layers slowly fade in/out on their own (generative radio).
- [ ] **D4 Media Session + Wake Lock + sleep timer** (fade out after N min). Lock-screen controls on mobile. *Sleep timer done: moon button in the taskbar (15/30/60/90 min), 60s master fade then Stop All, master restored afterwards; a tap during the fade doesn't cancel it. Still open: Media Session / lock-screen controls + background playback need output routed through an `<audio>` element (MediaStreamDestination), which risks double output/latency, so test on real iOS/Android first. Wake Lock not added (sleep use wants the screen off).*
- [ ] **D5 Session morph.** Crossfade from one saved session to another.
- [ ] **D6 Compressed export.** Opus/WebM via MediaRecorder alongside WAV.
- [ ] **D7 Retroactive record.** "Save the last 60s" ring buffer.
- [x] **D8 Sample credits.** Show Freesound name/author + link on sample/grain layers. *Done: Info menu shows "by <uploader> · CC0 via Freesound" linking to their profile; saved in sessions as `freesoundUser`.*

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
