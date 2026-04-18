# CUBE — Closed Mechanical System: An Engineerable Reconstruction

## 1. Conclusion

Strictly speaking, the film only defines **local motion encoding**: the three-digit label `abc` on each axis gives both the starting coordinate `a+b+c` and a three-step displacement cycle `(a-b, b-c, c-a)`. The film never specifies any global constraint — how all rooms avoid collisions, prevent target overlaps, or yield space. Wikipedia summarises this point explicitly: room labels encode starting coordinates, subsequent positions are obtained by "cyclically subtracting the digits", the core contains `26^3 = 17,576` rooms, and some rooms must be removed to allow movement.

Therefore:

- **Without any global constraint**: the model is **not closed** — it only defines how a single room moves, not how all rooms move simultaneously while maintaining a global bijection.
- **With a valid codebook and a service-layer scheduler**: the model **can be closed**, and can be mechanically realised.

## 2. Key to Mathematical Closure

For a single-axis three-digit label `abc`:

- Starting coordinate: `S = a + b + c`
- Phase 1 position: `p1 = 2a + c`
- Phase 2 position: `p2 = 2a + b`
- Three-step return: `S -> p1 -> p2 -> S`

For the entire maze to be closed, we require that each axis at every phase forms a **permutation** — that is:

- All `p1` values for `S=1..26` cover `1..26` exactly once;
- All `p2` values for `S=1..26` cover `1..26` exactly once.

I have constructed a **26-axis exact codebook** satisfying this condition, exported as:
[`cube_axis_codebook_26.csv`](cube_axis_codebook_26.csv)

This means we can define three-dimensional phases:

- Phase 0: `(x, y, z)`
- Phase 1: `(f1(x), f1(y), f1(z))`
- Phase 2: `(f2(x), f2(y), f2(z))`

Where `f1` and `f2` are both permutations on `1..26`, so the entire `26×26×26` core maintains full occupancy with no overlaps at every phase.

## 3. Mechanical System Design: Minimal Closed Architecture

### 3.1 Overall Structure

The proposed closed mechanical structure does not require 17,576 rooms to clip through each other in a fully packed cube. Instead:

1. **26×26×26 visible docking core**
   This is the "public room array" that occupants can actually enter.

2. **A coordinate-27 service skin layer**
   Buffer slots, linear rearrangement mechanisms, door locks, sensors, and actuators are arranged on the `x=27`, `y=27`, `z=27` outer skin.
   The film's setting does include a gap between core and outer shell, and one coordinate of the bridge room is indeed 27.

3. **One rearrangement mechanism per coordinate line**
   - For a fixed `(y,z)` x-line: 26 public slots + 1 service buffer slot;
   - For a fixed `(x,z)` y-line: likewise;
   - For a fixed `(x,y)` z-line: likewise.

4. **Three-stage serial rearrangement**
   Each global rearrangement does not let every room fly freely. Instead:
   - First, rearrange all x-lines;
   - Then, rearrange all y-lines;
   - Finally, rearrange all z-lines.

   Since the phase mapping is axis-separable, the end result is identical to the 3D target state.

### 3.2 Why This Structure Is Closed

The key insight: each stage only modifies one coordinate, so all lines are mutually independent.

For example, from Phase 0 to Phase 1:

- X stage: every x-line with fixed `(y,z)` executes permutation `P01 = f1`
- Y stage: every y-line with fixed `(x,z)` executes permutation `P01 = f1`
- Z stage: every z-line with fixed `(x,y)` executes permutation `P01 = f1`

From Phase 1 to Phase 2, the permutation applied is not `f1` but
`P12 = f2 ∘ f1^-1`.

From Phase 2 back to Phase 0, the permutation applied is
`P20 = f2^-1`.

For the full 26-axis codebook, the cycle decompositions of these three single-axis permutations are:

- `P01 = (1 2), (3), (4 5), (6), (7 9 10 8), (11), (12), (13), (14 15), (16 18 19 17), (20), (21), (22 23), (24), (25 26)`
- `P12 = (1), (2), (3), (4), (5), (6), (7 10 8 11 9), (12), (13 15 14), (16 19 17 20 18), (21), (22), (23), (24), (25), (26)`
- `P20 = (1 2), (3), (4 5), (6), (7), (8 9 11 10), (12), (13 15), (14), (16), (17 18 20 19), (21), (22 23), (24), (25 26)`

The longest cycle length is only 5, meaning mechanical rearrangement of a single line does not require extremely long chain transfers.

## 4. How to Build the Linear Rearrangement Mechanism

A single line (e.g., an x-line with fixed `(y,z)`) can be implemented as follows:

- 26 public slots at `x=1..26`
- 1 buffer slot in the service skin at `x=27`
- A **fixed-rail shuttle / linear transfer carriage** operates in the service skin
- The carriage has a gripping mechanism that can lift any room module from a public slot into the service buffer, then deliver it to the target slot

This pattern of "fixed-rail shuttle + traffic management software + vertical/horizontal transfer" is already widely used in high-density AS/RS and automated parking systems in the real world.

- AutoStore: a high-density storage-retrieval system using cubic grids and top-mounted robots.
- Interlake Mecalux 3D shuttle: multi-directional shuttles, lifts, and fleet management software to avoid jams and collisions.
- ParkPlus rack-and-rail automated parking: fixed-rail shuttles, vertical conveyors, and traffic management software to transfer large payloads within an enclosed vault.

Scaling these established industrial concepts up to "room module" dimensions yields a version that is **extremely expensive in reality but closed in principle**.

## 5. Room Module Design

Each room is not rigidly butted against its neighbours but rather an **extractable sealed pod**:

- All six faces have door positions, but doors only unlock when both sides have completed docking and pressure/position/latch checks are all confirmed
- Before rearrangement:
  - All doors lock first
  - Telescoping seals of adjacent corridors retract
  - Module undocks from the docking frame
- During rearrangement:
  - Module is grabbed by the shuttle along the required axis, moved, and re-docked
- After rearrangement:
  - Alignment pins engage
  - Six-face position sensors confirm coplanarity
  - Seals re-extend
  - Only doors whose interlock conditions are met may open

This step closely resembles a hybrid of spacecraft docking / automated parking / ASRS pallet docking.
The advantage: **what is open to occupants is a fixed door frame and telescoping corridor, not two moving rooms rigidly pressed together**, making tolerance management and safety redundancy far more controllable.

## 6. How the Bridge Room Fits In

In community documentation, the bridge room's number is `770, 999, 770`, with starting position `(14, 27, 14)`; `999` corresponds to one axis fixed at 27.

The most natural engineering approach is:

- Treat the bridge room as a special bay on the service skin;
- One of its axes is permanently docked at the coordinate-27 service face;
- The other two axes move according to valid permutation cycles;
- Only at a certain phase does it simultaneously align with a core boundary slot and the outer shell exit.

This corresponds precisely to the film's narrative of "like a giant combination lock — when it returns to starting alignment, the lock opens."

## 7. Real-World Cost of This Scheme

It is **theoretically closed**, but the real-world cost is extremely high:

- Massive number of actuators;
- Heavy redundancy in door locks, seals, positioning, and collision avoidance;
- Comfort, fail-safety, fire protection, and structural vibration for human-occupied moving modules are extremely challenging;
- Maintenance demands would far exceed any existing warehousing or parking system.

Therefore, the engineering assessment is:

- **As a "proof of existence"**: yes;
- **As a practically constructible building**: almost uneconomical, and extremely difficult to meet modern human-factors engineering and fire codes;
- **As a rigorous mechanical reconstruction of the film's premise**: this is, in my view, the closest version to "closed".

## 8. Visualisation and Code

The following have been generated:

1. Complete 26-axis codebook:
   [`cube_axis_codebook_26.csv`](cube_axis_codebook_26.csv)

2. Code:
   [`cube_closed_system.py`](cube_closed_system.py)

3. Prototype animation (8×8×8 core + 1 service skin layer, showing only 27 tagged rooms to make rearrangement visible):
   [`cube_prototype_visualization.gif`](cube_prototype_visualization.gif)

The animation demonstrates:
- Phase 0
- 0→1 X/Y/Z three-stage rearrangement
- Phase 1
- 1→2 X/Y/Z three-stage rearrangement
- Phase 2
- 2→0 X/Y/Z three-stage rearrangement

It is not a "full occupancy diagram of all 512 rooms", but a trajectory diagram of "27 identity-tagged rooms", because in a truly full-occupancy state the cube appears filled at every phase and you cannot tell which rooms are moving.
