# CoLLiDr

An interactive, LHC-scale hadron collider simulator in a single self-contained `index.html`
(inline CSS and JS, 2D canvas, no dependencies, no backend). Inject, ramp, squeeze and collide
two proton beams; every number on screen comes from a documented formula or constant.

## Project layout

```
collidr/
├── public/
│   └── index.html        ← the entire app (deployed)
├── tests/
│   └── acceptance.mjs    ← physics + state-machine checks, run with Node
├── netlify.toml          ← publish = "public", security headers, no build
├── package.json          ← npm test / npm start (no dependencies)
├── .gitignore
└── README.md
```

## Run locally

Open `public/index.html` directly in a browser, or serve it:

```bash
npm start                      # npx serve public
# or
python3 -m http.server 8080 -d public
```

## Verify the physics

```bash
npm test                       # node tests/acceptance.mjs
```

The test extracts the `PHYSICS` and `SIM` modules straight out of `index.html`, so it checks the
exact code the page runs: nominal luminosity, synchrotron power, required dipole fields,
N² / β* / crossing-angle scaling, the enforced Inject → Ramp → Squeeze → Collide sequence,
burn-off during stable beams, beam loss on insufficient field, and quench at 9 T.

## Git + Netlify

```bash
cd collidr
git init
git add .
git commit -m "CoLLiDr: hadron collider simulator"
git branch -M main
git remote add origin https://github.com/<you>/collidr.git
git push -u origin main
```

Then in Netlify: **Add new site → Import an existing project → GitHub → collidr**.
`netlify.toml` already sets the publish directory to `public` with no build command.

Alternatives: drag the `public/` folder onto app.netlify.com/drop, or use the CLI:

```bash
npx netlify-cli deploy --prod --dir=public
```

## Controls

| Control | Range | Notes |
|---|---|---|
| Beam energy | 0.45–7 TeV | Ramp target. Fixed once the optics are squeezed. |
| Dipole field | 0–9 T | Must cover `B = p/(0.3ρ)` for the beam energy or the beam is lost. Above 8.33 T: quench risk. 9 T: quench. |
| Bunch intensity | 0.1–2.2 ×10¹¹ | Live intensity = setpoint × surviving fraction, so L responds as N² mid-fill. |
| Bunches | 1–2808 | 25 ns filling scheme with trains of 72 and a 119-slot abort gap. |
| Emittance | 1–10 µm·rad | Normalized. |
| β* | 25–200 cm | Squeeze target; live once squeezed (β* levelling). |
| Crossing angle | 0–500 µrad | Reduces L through the geometric factor F. |
| Sim speed | 1–3600× | Machine time (injection, ramp, squeeze, burn-off). |

Keyboard: `I` inject, `R` ramp, `S` squeeze, `C` collide, `D` dump.

## Physics

Machine constants: C = 26.7 km, ρ = 2804 m, f_rev = 11.245 kHz, m_p = 0.938 GeV.

- Rigidity: `p[GeV/c] = 0.2998 · B · ρ` (the "0.3" uses the exact c/10⁹)
- Luminosity: `L = N² n_b f_rev γ / (4π ε_n β*) · F`, `F = 1/√(1 + (θ_c σ_z / 2σ*)²)`, `σ* = √(ε_n β*/γ)`, σ_z = 7.5 cm
- Events: `R = L σ_inel`, σ_inel = 80 mb × (1 + 0.12 ln(√s / 14 TeV)); pile-up `μ = R/(n_b f_rev)`
- Synchrotron radiation: `U₀[keV] = 88.5 E⁴/ρ/1836⁴`, `P = U₀ · I`, `I = N n_b e f_rev`
- Lifetime: `dN/dt = −2 L σ_tot − N/τ_gas`, σ_tot = 110 mb at 14 TeV, τ_gas = 100 h
- √s = 2E

### Acceptance results

| Check | Result |
|---|---|
| Nominal luminosity | 1.011 × 10³⁴ cm⁻² s⁻¹ (F = 0.841, σ* = 16.6 µm) |
| Dipole field at 7 TeV | 8.327 T |
| Dipole field at 450 GeV | 0.535 T |
| Synchrotron loss, power | 6.67 keV/turn × 0.582 A = **3.88 kW/beam** (see note) |
| Stored energy | 362 MJ/beam |
| Event rate, pile-up | 8.1 × 10⁸ s⁻¹, μ = 25.6 |
| Burn-off / combined lifetime | ≈ 43 h / ≈ 30 h at the start of a nominal fill |

Note on synchrotron power: the specified formula `P = U₀ · I` gives 3.88 kW at nominal values,
about 8% above the 3.6 kW figure in the brief. The formula is kept as specified rather than tuned to hit 3.6.

### Modelling choices worth knowing

- The dipole slider is the operating field. Field above what the energy needs is treated as
  headroom (a simplification); field below it loses the beam.
- Quench hazard above 8.33 T and the 20 s cryogenic recovery are compressed, stated constants
  measured in real seconds so they behave the same at any sim speed.
- Display-only scalings: bunch motion speed, IP flash rate, and the event-display sampling
  factor (R × 5 × 10⁻⁹, capped at 20/s). The event display is a toy generator in a CMS-like
  3.8 T geometry with a display-enriched mix (15% dijet, 3% multi-lepton); the panel prints the
  sampling factor so it always agrees with the event-rate readout.
- The empty centre of the ring shows a hologram of the same IP1 events as the event display,
  projected into the ring plane with a wider tracker scale so the curling soft tracks are visible.
