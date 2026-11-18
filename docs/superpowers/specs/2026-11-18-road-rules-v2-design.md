# Road rules v2: public-road map and new scenarios

Branch: `feature/road-rules-v2` (cut from `main`; no universal wheel controller code, `test/` untouched).
Status: DRAFT, waiting for approval.

## Intent
Give learners practice on real public-road driving, not just the circuit. Learners should meet the things the road test checks that a circuit hides: arrow lights, give way junctions, lane discipline, other traffic that changes each run, and amber-light decisions at a junction.

## Goals
- New map "Ubi / Paya Lebar roads" built from real OpenStreetMap data (area around Ubi and Paya Lebar), with its own routes between "courses".
- On the new map only: arrow signals at some signalised junctions, give way signs at junctions where OSM has `highway=give_way`, a random number of NPC cars on each reload.
- Lane warning on the new map: a reminder when you drive across or along the wrong lane. Warning only, no points (my call).
- Amber turn rule, on the new map and the CDC map: reach a junction without positioning to turn, then turn on amber = +8.
- Amber practice scenario: while the player is travelling from one course/route leg to the next, a junction light is randomly forced to change to amber as they approach, so the amber decision and turn rule get practised.

## Non-goals
- CDC map NPC count stays as it is (3 cars, fixed). CDC gets no arrow lights or give way signs.
- No change to the Practice circuit.
- No wheel controller work, no name gate or feedback popup changes.
- Not a full road-test marking sheet.

## Anti-goals
- Looks real but teaches wrong rules (e.g. wrong give way side). Rules must stay Singapore, keep left.
- Randomness that makes a run unfair: injected amber must leave a legal, safe choice (stop or go) and never an unavoidable fault.

## Constraints
- Single `index.html`, no backend, no accounts. Map data is baked in as static JSON, not fetched at play time.
- Must still work on mobile and in all 3 camera views.
- OSM data is ODbL: add attribution in README and on the map credit line.

## Approaches considered
1. **New public-road map from baked OSM data (chosen by Elyn).** Realistic, matches the earlier OpenStreetMap idea. Cost: needs a data pull and a road-to-game converter.
2. Add junctions and traffic to the Practice circuit. Smaller, but it has no route legs, so the amber scenario would only run on CDC. Rejected.

## Design
- **Data:** one Overpass pull for the bounding box, saved as a trimmed JSON (roads with lanes/oneway/name, plus `traffic_signals`, `give_way`, `stop` nodes). A small build script turns it into map coordinates in the game's metre space. Kept in `tools/`.
- **Map:** `MAPS.ubi` beside `circuit` and `cdc`, with `ROAD`-style features (signals, give way, stops, loops) generated from the data and hand-checked.
- **Arrow lights:** a subset of signalised junctions get a turn-arrow phase (green arrow while the main light is red or amber for that approach). Shown in top view, driver view and the road card.
- **Give way:** sign drawn at the junction, dashed line on the road. Fault if you enter a junction when a car with right of way is close (reuses the existing "made a car brake" check, +8).
- **Random NPCs:** on each load, pick a count in a range (proposed 2 to 6) and spread them over the loops. Seed is not saved.
- **Lane warning:** a flash message when the car centre is outside the keep-left lane for more than about 2 s. Does not touch the score.
- **Amber turn rule:** on the approach to a turn at a signalised junction, track whether the player moved into the turning lane and signalled. If they turn while the light is amber without that, +8 "Not positioned to turn".
- **Amber scenario:** the leg-to-leg route already passes the signalised junction. Between legs, with a random chance, the next junction light is set to flip to amber when the player is at a fixed time-to-line. It happens at most once per transition. Both a stop and a go stay legal outcomes (go is correct if too close to stop, as today).
- **Scoring table additions:** Not positioned to turn on amber +8. Others unchanged.

## Left to the builder
- Exact bounding box and which junctions get arrows (pick the busiest signalised ones).
- NPC count range and spread.
- Amber trigger chance and timing, tuned by play.
- Colours and sign art.

## Open items
- OSM data could not be fetched from the build machine (outbound network to Overpass is blocked there). Needs Elyn's approval to fetch, or a file exported by hand.
- Confirm +8 also applies when the player never signalled (stacked with the +4 signal fault) or replaces it. Proposed: both apply.
