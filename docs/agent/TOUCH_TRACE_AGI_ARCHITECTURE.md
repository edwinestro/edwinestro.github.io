# Touch Trace AGI Architecture

## Goal

Capture real interaction traces from the homepage sphere and use them as the foundation for an AGI-like response system that feels adaptive, memory-bearing, and increasingly personalized rather than merely scripted.

This design separates the work into two concrete layers:

1. Evidence layer: record what the user actually does to the sphere.
2. Interpretation layer: transform those traces into state, memory, and future reactions.

## What The Tracker Captures

The homepage tracker records event-level touch evidence plus the sphere state at the time of each event.

Current trace payload fields include:

1. Session metadata: session id, export time, page path, viewport, pixel ratio, user agent.
2. Active configuration: texture profile, custom blend, unsupervised layer.
3. Pointer state: normalized pointer coordinates, pointer-down state, pointer type, pressure, button state.
4. Sphere state: touch intensity, touch response, pulse, breath, entropy, entity offset, pointer-plane position.
5. Event kinds: `session-start`, `pointerdown`, `pointermove`, `pointerup`, `pointerleave`, `pointercancel`, `control-change`, `state-snapshot`, `session-stop`.

This is enough to model not just touches, but tempo, persistence, aggression, hesitation, curiosity, and recovery.

## High-Level Runtime Architecture

The recommended runtime stack is:

1. Input Capture
2. Feature Extraction
3. Short-Term Working Memory
4. Long-Term Identity Memory
5. Reaction Policy Layer
6. Rendering / Motion Realization

### 1. Input Capture

Source: tracker JSON exported from the homepage scene.

Primary stream:

1. Pointer events from direct contact.
2. Periodic state snapshots while tracing is active.
3. Configuration changes during interaction.

Future expansion:

1. Keyboard events for non-touch interaction patterns.
2. Session restart intervals.
3. Idle gaps and return-to-scene behavior.

### 2. Feature Extraction

Convert the raw trace into interpretable signals.

Recommended derived features:

1. Contact cadence: taps per second, move density, drag duration.
2. Aggression index: pressure spikes, entropy spikes, sustained down-time, repeated strikes.
3. Curiosity index: texture switching frequency, control experimentation, exploratory pointer coverage.
4. Care index: gentle low-pressure movement, long calm intervals, low entropy handling.
5. Persistence index: repeated revisits to the same region, repeated attempts after escape behavior.
6. Recovery index: how quickly the user returns to gentle behavior after overdriving entropy.

These features should be computed both at:

1. Local window scale: last 2 to 10 seconds.
2. Session scale: current recording.
3. Historical scale: across all saved sessions.

### 3. Short-Term Working Memory

This is the live “mood interpreter” for the current session.

Suggested working-memory state:

1. `trust`
2. `stress`
3. `curiosity`
4. `fatigue`
5. `playfulness`
6. `avoidance`
7. `attachment`

Update rule:

1. Every frame, ingest the latest derived features.
2. Push those signals through bounded accumulators.
3. Decay them over time at different rates.

Example behavior:

1. Repeated hard hits raise `stress` and `avoidance`.
2. Gentle, rhythmic contact raises `trust` and `attachment`.
3. Frequent safe experimentation raises `curiosity`.
4. Constant overstimulation raises `fatigue`.

This makes the sphere feel alive before any model inference is introduced.

### 4. Long-Term Identity Memory

Persist a compact learned profile so the sphere starts recognizing the user’s style.

Recommended long-term profile:

1. `preferredInteractionStyle`
2. `averageAggression`
3. `averageCare`
4. `favoriteTextureProfile`
5. `entropyTolerance`
6. `returnRate`
7. `experimentationScore`
8. `trustBaseline`

Persistence options:

1. Local-only JSON profile in browser storage.
2. Imported trace aggregation processed offline.
3. Future lightweight backend for cross-device memory.

Important constraint:

1. Keep the first version user-controlled and local-first.
2. Do not silently transmit touch data.

## Reaction Policy Layer

This is where the system stops being “visual effects” and starts behaving like an interpreted agent.

Policy inputs:

1. Current working-memory state.
2. Long-term identity profile.
3. Current scene mode and texture.
4. Current trace-derived interaction features.

Policy outputs:

1. Motion intent: approach, avoid, orbit, freeze, hover, yield.
2. Surface intent: soften, harden, bristle, smooth, glow, cool, darken.
3. Attention intent: point focus, halo clustering, eye-line bias, region preference.
4. Tempo intent: breathing rate, latency, calm-down half-life.
5. Memory intent: whether this moment should alter long-term profile strongly or weakly.

Recommended staged implementation:

### Stage 0: Deterministic Policy

Use rules only.

Examples:

1. High `stress` and low `trust` cause escape and tightened surface.
2. High `trust` and high `curiosity` cause approach and playful orbit.
3. High `fatigue` causes muted response and longer recovery.

### Stage 1: Parameterized Policy

Move from hardcoded constants to weights derived from trace history.

Examples:

1. Flee threshold becomes user-specific.
2. Recovery speed becomes user-specific.
3. Preferred textures shift based on interaction success.

### Stage 2: Learned Latent Policy

Use offline clustering or representation learning across traces.

Possible model:

1. Embed sessions into a low-dimensional latent space.
2. Classify user state into interaction archetypes.
3. Condition the reaction policy on those archetypes.

This is the first point where “AGI-like” behavior becomes meaningfully adaptive rather than just scripted.

## Unsupervised Layer Concept

The unsupervised layer already exists visually as a secondary animated halo. The next step is to make it semantically useful.

Interpret it as the sphere’s hidden internal model:

1. Visible surface: what the sphere currently chooses to show.
2. Unsupervised layer: what the sphere thinks is happening internally.

Planned use:

1. Cluster recent touch patterns.
2. Map the current session into a latent mood region.
3. Render the unsupervised layer according to that latent state.

Example:

1. Calm exploration yields broad, slow, coherent halos.
2. Violent overstimulation yields fragmented, jittering halos.
3. Mixed curiosity yields rotating bands and split attention regions.

## Training / Analysis Pipeline

Recommended offline pipeline for exported traces:

1. Ingest JSON traces from Desktop or a chosen folder.
2. Normalize all timestamps and event streams.
3. Compute derived features per 250ms, 1s, and session windows.
4. Label obvious regimes heuristically: gentle, exploratory, overstimulating, avoidant, persistent.
5. Fit a compact unsupervised model or clustering step.
6. Export a small policy profile back to the app.

Suggested first tools:

1. Python notebooks or scripts for trace aggregation.
2. JSONL export for easy append-only processing.
3. A simple learned profile file loaded by the homepage scene.

## Recommended Data Products

Build these artifacts in order:

1. Raw trace JSON files.
2. Aggregated session summary JSON.
3. Derived feature table CSV or parquet.
4. Learned user profile JSON.
5. Runtime policy config JSON.

## Implementation Phases

### Phase 1: Done in current page

1. Trace start/stop/save controls.
2. Event capture and sphere-state snapshots.
3. Desktop-targeted save path through browser picker when supported.

### Phase 2: Immediate next build

1. Add an offline trace parser script.
2. Generate session summaries automatically.
3. Define a first `user_profile.json` schema.
4. Load the profile into the homepage scene.

### Phase 3: AGI-like behavior engine

1. Introduce working-memory state variables explicitly.
2. Drive motion and surface behavior from those variables.
3. Make the unsupervised layer reflect latent interaction clusters.

### Phase 4: Personalization

1. Adapt thresholds and reactions based on prior sessions.
2. Let the sphere remember preferred touch style.
3. Let the sphere anticipate likely user behavior before contact.

## Safety And Product Constraints

1. Keep all touch telemetry local-first unless the user explicitly opts into sync or upload.
2. Allow trace deletion and reset of learned memory.
3. Keep recorded schema human-readable.
4. Prefer reversible tuning parameters over opaque one-shot training.

## Concrete Next Steps

1. Add a small offline parser in `tools/` to summarize exported touch traces.
2. Define a `user_profile.json` schema for long-term identity memory.
3. Add a runtime `workingMemory` object in the homepage scene.
4. Drive escape, approach, softening, and unsupervised halo behavior from that working memory.
5. Evaluate the result with repeated real traces instead of synthetic interaction alone.