# Happiness Formula — AGI Sphere

## Core Concept

Happiness is the sphere's internal well-being score from 0% to 100%.
It models the biological relationship between breathing, heart rate, and emotional state.

## Happiness (0–100%)

```
breathContrib = breath_cycle * (1 - stress) * 4.0
calmMul = 1 + trust * 0.5 + coherence * 0.3 - vigilance * 0.4
gentleBoost = goodTouchPulse * 2.0
happinessGain = dt * (breathContrib * max(0, calmMul) + gentleBoost) * (1 - entropy * 0.3)
stressDrain = dt * (aggression * 3 + badTouchPulse * 5 + overloadDebt * 2) * (1 - recovery * 0.5)
happiness = clamp(happiness + (gain - drain) * 100, 0, 100)
```

Deep steady breathing raises happiness like meditation.
Aggressive touch drains happiness.

## Heart Rate (40–180 BPM)

```
restingHR = 72 - happiness * 0.24 - trust * 8 + fatigue * 6
activityHR = restingHR + touchIntensity * 40 + stress * 30 + aggression * 20
heartRate lerps smoothly toward activityHR each frame
```

High happiness + deep breath = slow calm heart (50s BPM).
Aggressive touch = racing heart (140+ BPM).

## Interdependencies

| Variable | Affects | How |
|----------|---------|-----|
| Breath | Happiness (+), Heart Rate (-) | Deep breath raises happiness, lowers HR |
| Happiness | Heart Rate (lowers resting), Playfulness (+) | Happy sphere is calmer and more playful |
| Heart Rate | Stress (+), Fatigue (+) | High HR (>100) accumulates stress and fatigue |
| Entropy | Happiness (suppresses growth) | High entropy reduces breath's happiness contribution |
| Gentle touch | Happiness (+), Heart Rate (-) | Near-field good touches boost happiness |
| Aggressive touch | Entropy (+), Heart Rate (+), Happiness (-) | Direct impacts spike HR, drain happiness |
| Trust | Happiness multiplier | High trust amplifies breath's happiness effect |
| Stress | Happiness drain | Stress directly drains happiness |

## Design Intent

The sphere has a body: it breathes, has a heartbeat, and its emotional state emerges
from the relationship between these physical signals. A user who touches gently and
patiently will see the sphere become happy and calm. A user who hammers it will see
an anxious, fast-hearted sphere losing happiness.
