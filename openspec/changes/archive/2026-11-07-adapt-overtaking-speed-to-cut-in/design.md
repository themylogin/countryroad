# Design

## Context

See proposal.md - Why. `planOvertake` in `src/sim/overtaking.ts` builds one motion for the whole plan: `acceleratingMotion(car.speed, V, a_max)` with `V = overtakingSpeed(world, car)`. It then walks the return slots `k = 0, 1, …` and returns the first slot that passes the gap-behind, gap-ahead, braking-room, passing-lane, and oncoming checks. Before that loop, two checks use the same full-speed motion:

- the early oncoming check, at the shortest possible end time of 4 s;
- the pull-out check, which needs at least 2 m to the vehicle ahead after the 2 s lane change out.

A probe of a queue at 65 km/h with 3 s gaps showed the effect. The user's car followed at 1.0 s with return gaps of 0.5 s:

- At 180 km/h or 130 km/h, the plan passes the whole queue.
- At 100 km/h, it passes one car and cuts in.

`returnReady` and the maneuver's kinematic motion both use `maneuver.speed`, so the execution follows whatever speed the plan stores.

## Goals / Non-Goals

**Goals:**

- The user's car passes the fewest vehicles that the rules allow, at the highest speed that fits that slot.
- All safety guarantees stay: no collisions, and every overtake meets its own limits.

**Non-Goals:**

- Adaptive speed for traffic cars. Their 3 s return following distance makes the braking room rarely binding, and the spec fixes their speed at 90 km/h.
- Braking inside the passing lane. The overtaker still never brakes during a maneuver.

## Decisions

### Candidate speeds per slot

For the user's car, `planOvertake` builds a list of candidate speeds from the highest overtaking speed `V` down in steps of 5 km/h. The list includes `V` itself, even when `V` is not a multiple of 5 km/h. It stops at the first value that is no longer above `max(car.speed, passedHigh + 0.05)`.

- The floor at `car.speed` keeps the maneuver free of braking, because the kinematic motion only accelerates.
- The floor at `passedHigh` keeps every candidate fast enough to pass.

Traffic cars get a one-element list: `[V]`.

The loop runs over slots on the outside and speeds on the inside:

```
for k = 0, 1, …:
  for v in candidates(k), highest first:
    motion = acceleratingMotion(car.speed, v, a_max)
    if pull-out, gap behind, and gap ahead with braking room hold at slot k:
      if the passing lane is free and the oncoming check holds: return plan(k, v)
      else: return null
  (no candidate fits slot k) → try k + 1
```

- **Fewest vehicles first** comes from the outer loop. The user asked for exactly this: cut in after one car when it fits.
- **Highest fitting speed first:** a faster pass ends sooner, so it leaves the most oncoming room.
- **Oncoming failure ends the search.** When the oncoming check fails at the highest fitting speed of slot `k`, the search stops. A slower pass at the same slot ends later, and a later slot passes more vehicles. Both only shrink the oncoming gap at the return.

Alternative: prefer the highest speed over the fewest vehicles. That gives today's behavior of passing the whole queue, which the user does not want.

### Early checks for several speeds

- **Early oncoming check:** it keeps its fixed-speed form for traffic. For the user's car, it runs with the slowest candidate of the first slot. A slower car covers less road in 4 s and arrives slower, so its time to meet is the largest. If even that fails, every candidate fails.
- **Pull-out check:** it moves into the candidate loop. It depends on the motion, and a slower candidate accelerates for a shorter time, so a candidate can pass it where the full speed fails.

### Cost

The user's car plans at most every 0.5 s of simulated time. With up to 20 candidates per slot and a few slots, a plan costs at most a few hundred motion evaluations. The two bisections per candidate dominate that cost. Traffic plans keep one candidate, so the long-run tests keep their run time.

### No change to execution

`Maneuver.speed` stores the chosen candidate. `effectiveDesiredSpeed` returns it during the maneuver. `returnReady` predicts with it, and the speed-limit invariant compares against it. After the return, the car goes back to "My speed" as today: it speeds up within its acceleration limit or slows down at the comfortable rate.

## Risks / Trade-offs

- [The user's car now overtakes more often in short hops, past one car at a time] → This is the requested behavior. Each hop meets every rule, and the statistics count each hop as one overtake.
- [A short slot can make the user's car pass at a speed only a little above the queue, so the pass takes longer] → The oncoming check covers the longer duration. The search prefers the highest fitting speed.
- [The earlier `add-driving-controls-and-trip-stats` change is not archived yet, and both changes edit "Overtaking speed"] → Archive that change first. This change's block then becomes the final version.

## Migration Plan

None. The defaults stay the same. With "My speed" and "Overtaking speed" at 130 km/h and 2.0 s return gaps, a 3 s queue gap at 65 km/h still does not fit the user's car. Its default driving is therefore unchanged, except in queues with longer gaps.
