# Design

## Context

See proposal.md - Why. `planOvertake` in `src/sim/overtaking.ts` walks the return slots `k = 0, 1, …` over the home-lane vehicles ahead, up to 12 vehicles or 3 km. For each slot it tries the candidate speeds from high to low. It returns the first slot that fits, or nothing when the passing-lane or oncoming check fails.

For the user's car, the candidates come in 5 km/h steps. A short slot therefore usually fits at some lower speed, so the first slot wins, and the car hops past one vehicle at a time.

`returnReady` starts the return as soon as the current home-lane follower and leader meet the gap conditions. It does not know which slot the plan chose.

The probe in proposal.md showed five hops past a five-vehicle queue on a clear road, each one ending exactly when planned. So the hops come from the slot choice, not from early returns. Early returns are still possible, for example while the car is still slow at the first gap of a full-queue plan.

## Goals / Non-Goals

**Goals:**

- On a clear road, the user's car passes the whole queue in one overtake.
- With oncoming traffic, it passes as many queue vehicles as the rules allow.
- Every car returns at its planned slot or later, never earlier.
- All existing guarantees stay.

**Non-Goals:**

- New slot choice for traffic cars.
- Passing vehicles beyond the end of the queue.

## Decisions

### Queue end

The new function `queueEnd(entries)` returns the index of the last vehicle of the queue.

- Entry `k + 1` belongs to the queue when it holds entry `k` back. It drives more than 1 km/h slower than entry `k`'s desired speed, and the gap from entry `k`'s front to entry `k + 1`'s rear is at most `followingTime_k · speed_k + 20 m`. This is the same test that starts an overtake (`isConstrained`), applied to the vehicle in front.
- The speed part matters. Without it, a faster car just ahead of a slow truck would count as queue. The user's car would then stay out to pass a car that is pulling away anyway. An existing test, "returns with 0.5 s gaps", caught this during implementation.
- The chain starts at entry 0, the vehicle that holds the user's car back. It stops at the first entry that does not follow its next vehicle closely, or at the end of the planning horizon.

Alternative: the queue as every vehicle within 3 km. That makes the car stay in the passing lane to reach a vehicle far ahead, as the "Vehicle beyond the queue" scenario shows.

### Slot order for the user's car

For the user's car, `planOvertake` tries the slots from the queue end down to 0: `k = K, K − 1, …, 0`. Within each slot, it tries speeds from high to low, as today.

- The first slot where all rules hold wins: the gaps, the braking room, the pull-out room, the free passing lane, and the oncoming gap.
- When the passing lane or the oncoming check fails for a slot, the planner tries the next nearer slot instead of giving up. A nearer slot ends sooner and leaves more oncoming room.
- No slot beyond `K` is tried.

Traffic cars keep today's order, `k = 0, 1, …`, and give up on the first oncoming failure. Their 3 s return following distance rarely fits inside a queue, so they already pass whole queues.

The early oncoming check stays as it is. It runs with the slowest candidate for the first slot, and slot 0 is the shortest possible overtake.

Cost: the user's car may evaluate every slot up to `K`. That is up to 12 slots with up to 20 speeds each, for one vehicle every 0.5 s of simulated time. It stays well below the cost of the traffic plans.

### No early return

`Maneuver` gets `lastPassedId`: the id of the last vehicle in `passedIds`. `returnReady` returns `false` while that vehicle is still ahead of the car's front, that is, while its forward distance from the car's front is less than half the loop.

The late-return safety net still overrides this rule. When the return is more than 0.5 s late, the car takes the first gap that meets the relaxed conditions. The long-run tests count every late return as a rule breach.

If the planned last vehicle has left the road because a count slider dropped, it counts as passed.

Alternative: plan a fixed return time and ignore actual gaps. That would drop the check against the real gaps that the current design relies on.

## Risks / Trade-offs

- [A whole-queue plan needs a long clear oncoming stretch, so on busy roads the car waits longer before it starts an overtake] → When the whole queue does not fit, the planner falls back to the most vehicles that do fit. The car therefore starts as early as before, and only the cut-in point moves.
- [The "fewest vehicles" behavior from the last change goes away] → The user asked for that behavior to cut in when the whole queue cannot be passed. The new rule keeps that case, and the changed "Cut in after one car of a queue" scenario tests it.
- [A planned last vehicle that changes lanes] → Trucks never overtake. A queued car that starts its own overtake behind the user's car can't, because the passing-lane check blocks it.

## Migration Plan

None. The default settings rarely allow cuts into a queue, so default driving mostly stays the same. With tight return gaps, a clear road now gives one long overtake instead of hops.
