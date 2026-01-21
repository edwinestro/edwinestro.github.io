# Attract‑ion · Physics Notes (Toy Model)

Goal: make the game feel grounded while remaining lightweight and playable. This is a **toy model**, not a full quantum simulation.

## Thermal control (concept summary)
- The game now treats temperature as a **control proxy** for kinetic energy.
- Cooling and heating are applied using the mouse wheel to keep temperature inside a narrow band.
- This is a gameplay abstraction, not a full thermodynamic model.

## How this maps to the game
- **Temperature bias** is adjusted by wheel input (cooling/heating).
- **Effective temperature** is derived from kinetic energy plus bias and must remain in a target band.
- Orbit stability remains tied to radius and velocity constraints.

## Orbit model (simplified)
- Proton at the center; electron experiences a **Coulomb‑like attraction**.
- We use a damped 2D force model to keep the system stable for playability.
- “Stability band” is a ring around the target radius; staying within it increases stability.
- Temperature is treated as an **effective ensemble proxy**, not a strict quantum definition.

## What’s realistic vs simplified
**Grounded:**
- Inverse‑square attraction.
- Energy added in short bursts.
- Stability depends on orbital radius and speed.

**Simplified:**
- 2D motion only.
- No true quantum wavefunctions or probabilistic electron cloud.
- Units are scaled for feel, not SI accuracy.

## Next improvements (optional)
- Add probability density visualization for 1s orbital.
- Introduce radiative loss (energy slowly bleeds if not pulsed).
- Add light “spin” or precession to show angular momentum changes.
- Tie temperature readout to a visible spectrum shift (color temperature).
