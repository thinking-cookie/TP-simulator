# TP Circuit Trainer

**Practise the Singapore Traffic Police (TP) driving test circuit in your browser — free, no install.**

▶ **[Try it live](https://thinking-cookie.github.io/TP-simulator/)**

![Top-down view of the practice circuit with live demerit scoring](screenshots/top-view.png)

---

## The problem

Learner drivers in Singapore get limited circuit time. Lessons are paid by the hour, and the circuit is only open during booked slots. Between lessons there is no way to rehearse the course order, the signalling, or the blind-spot checks that cost the most demerit points.

Most learners end up memorising the circuit from YouTube videos — watching, not doing.

## The solution

A browser-based trainer that lets learners **drive** the circuit, not just watch it. It scores them the way an examiner would, so they know which habits to fix before their next lesson.

| What learners practise | How the trainer helps |
|---|---|
| Course order and route | Yellow guide arrow, route brief, minimap |
| Crank course, S-course, slope, directional change, parallel and vertical parking | Each course is a checkpoint that can be replayed on its own |
| Signalling and blind-spot checks | Blue zones before every turn; points added if either is missed |
| Staying within the demerit limit | Live demerit sheet, fail at more than 18 points |
| Automatic or manual | Manual mode has a clutch, biting point and stalling |

## Features

- **3 camera views** — car-up, north-up, and driver's seat with mirrors and a 360° dash camera
- **Day and night mode**
- **Realistic car sounds** — engine, indicator, horn
- **2 maps** — a practice circuit and a circuit modelled on the CDC Ubi layout
- **Checkpoint retry** — jump back to any course and practise it on repeat
- **Works on desktop and mobile**, single HTML file, no sign-up

| Driver's seat | Night mode |
|---|---|
| ![Driver's seat view](screenshots/driver-view.png) | ![Night mode](screenshots/night.png) |

## Demerit rules used

| Fault | Points |
|---|---|
| Striking a kerb | +4 |
| Turning without checking blind spot | +4 |
| Turning without signalling | +4 |
| Rolling back more than 0.5 m on the slope | +6 |
| Mounting a kerb (above 10 km/h) | Immediate fail |
| More than 18 points | Fail |

This is a simplified practice tool. Real TP test marking covers more items.

## Product decisions

- **Single HTML file.** No backend, no accounts. Zero friction for a learner who just wants to practise tonight.
- **Scoring over realism.** The physics are simple on purpose. The value is in building the right habits — signal, check, turn — not in a driving simulator.
- **Checkpoint retry.** Learners can replay one weak course without restarting the whole circuit.
- **Automatic and manual.** Covers both Class 3A (auto) and Class 3 (manual) learners.

## What's next

- [ ] More circuit layouts (other driving centres)
- [ ] Progress tracking across sessions
- [ ] Theory test (FTT/BTT) quiz mode

## Run it locally

Download `index.html` and open it in any modern browser. That's it.

## Credits

- Built by Alvinelyn — Product Manager, Singapore
- Sounds: [Kenney](https://kenney.nl) (CC0)
- Fonts: Barlow Condensed and Atkinson Hyperlegible via Google Fonts

Not affiliated with the Singapore Traffic Police or any driving centre.

## License

[MIT](LICENSE)
