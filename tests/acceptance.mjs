// Acceptance checks for CoLLiDr. Run: node tests/acceptance.mjs
// Extracts the PHYSICS and SIM modules from public/index.html and evaluates them in Node,
// so the numbers tested are exactly the numbers the page shows.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'public', 'index.html'), 'utf8');
const grab = (a, b) => html.slice(html.indexOf(a) + a.length, html.indexOf(b));
const src = grab('/* ===== PHYSICS-BEGIN ===== */', '/* ===== PHYSICS-END ===== */') +
            grab('/* ===== SIM-BEGIN ===== */', '/* ===== SIM-END ===== */');
const { Physics, Machine } = new Function(`${src}; return { Physics, Machine };`)();
const P = Physics;

let fails = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); if (!ok) fails++; };
const near = (x, target, tol) => Math.abs(x / target - 1) <= tol;
const sci = x => x.toExponential(3);

const NOM = { N: 1.15e11, nb: 2808, E: 7000, epsn: 3.75e-6, beta: 0.55, theta: 285e-6 };
const nom = P.luminosity(NOM);
check('Nominal luminosity ≈ 1e34', near(nom.L, 1e34, 0.05), `L = ${sci(nom.L)} cm^-2 s^-1, F = ${nom.F.toFixed(4)}, sigma* = ${(nom.sigmaStar * 1e6).toFixed(2)} um`);

const I = P.beamCurrent(NOM.N, NOM.nb), U0 = P.srLossPerTurn_keV(7000), Psr = P.srPower_W(7000, NOM.N, NOM.nb);
check('Synchrotron power ≈ 3.6 kW/beam (within 10%)', near(Psr, 3600, 0.10),
  `U0 = ${U0.toFixed(3)} keV/turn, I = ${I.toFixed(4)} A, P = ${(Psr / 1e3).toFixed(2)} kW`);
check('Required field at 7 TeV ≈ 8.33 T', near(P.requiredField(7000), 8.33, 0.005), `B = ${P.requiredField(7000).toFixed(4)} T`);
check('Required field at 450 GeV ≈ 0.54 T', near(P.requiredField(450), 0.54, 0.02), `B = ${P.requiredField(450).toFixed(4)} T`);
check('Stored energy ≈ 362 MJ', near(P.storedEnergy_J(7000, NOM.N, NOM.nb), 362e6, 0.01), `${(P.storedEnergy_J(7000, NOM.N, NOM.nb) / 1e6).toFixed(1)} MJ`);

const L2 = P.luminosity({ ...NOM, N: 2 * NOM.N }).L;
check('Intensity ×2 → luminosity ×4', near(L2 / nom.L, 4, 1e-9), `ratio ${(L2 / nom.L).toFixed(6)}`);
const Lb = P.luminosity({ ...NOM, beta: 1.10 }).L;
check('Raising β* lowers luminosity', Lb < nom.L, `β*=110 cm: ${sci(Lb)} (ratio ${(Lb / nom.L).toFixed(3)})`);
const L0 = P.luminosity({ ...NOM, theta: 0 }), L5 = P.luminosity({ ...NOM, theta: 500e-6 });
check('Raising crossing angle lowers luminosity via F', L5.L < nom.L && nom.L < L0.L && L0.F === 1,
  `F(0)=${L0.F.toFixed(3)}, F(285)=${nom.F.toFixed(3)}, F(500)=${L5.F.toFixed(3)}`);

const R = P.eventRate(nom.L, 14), mu = P.pileup(nom.L, 14, 2808);
check('Event rate = L·σ_inel (80 mb at 14 TeV)', near(R, nom.L * 80e-27, 1e-9), `R = ${sci(R)} /s, μ = ${mu.toFixed(1)}`);
check('√s = 2E', P.sqrtS_TeV(7000) === 14, `√s = ${P.sqrtS_TeV(7000)} TeV`);
check('Injection SR loss is tiny', P.srLossPerTurn_keV(450) < 0.01, `U0(450 GeV) = ${P.srLossPerTurn_keV(450).toExponential(2)} keV`);
const pat = P.fillingPattern(2808);
check('Filling scheme fits 3564 slots with abort gap', pat.length === 2808 && pat[2807] < 3564 - 119, `last filled slot ${pat[2807]}`);

// ---- Operation sequence through the real state machine ----
const S = { E: 7, B: 8.33, N: 1.15, nb: 2808, eps: 3.75, beta: 55, theta: 285, speed: 600 };
const run = (sec, dt = 1 / 60) => { for (let t = 0; t < sec; t += dt) Machine.step(dt, S); };
check('Cannot collide before ramp + squeeze', !Machine.can('collide', S).ok, Machine.can('collide', S).why);
check('Cannot ramp before inject', !Machine.can('ramp', S).ok, Machine.can('ramp', S).why);
Machine.act('inject', S); run(3);
check('Inject completes', Machine.st.mode === 'INJECTED', `mode ${Machine.st.mode}`);
check('Still cannot collide after inject', !Machine.can('collide', S).ok, Machine.can('collide', S).why);
Machine.act('ramp', S); run(4);
check('Ramp reaches flat top at 7 TeV', Machine.st.mode === 'FLATTOP' && near(Machine.st.E, 7000, 1e-6), `mode ${Machine.st.mode}, E ${Machine.st.E.toFixed(1)} GeV, B ${Machine.st.B.toFixed(3)} T`);
check('Still cannot collide without squeeze', !Machine.can('collide', S).ok, Machine.can('collide', S).why);
Machine.act('squeeze', S); run(3);
check('Squeeze reaches β* setpoint', Machine.st.mode === 'ADJUST' && near(Machine.st.beta, 0.55, 1e-9), `mode ${Machine.st.mode}, β* ${Machine.st.beta}`);
Machine.act('collide', S); run(0.5);
const d0 = Machine.derive(S);
check('Stable beams: live luminosity ≈ 1e34', d0.colliding && near(d0.L, 1e34, 0.05), `L = ${sci(d0.L)}`);
const s0 = Machine.st.survival, int0 = Machine.st.intLumiFill;
run(10);
const d1 = Machine.derive(S);
check('Beam current decays during stable beams', Machine.st.survival < s0 && d1.I < d0.I, `survival ${s0.toFixed(4)} → ${Machine.st.survival.toFixed(4)}, I ${d0.I.toFixed(4)} → ${d1.I.toFixed(4)} A`);
check('Integrated luminosity keeps increasing', Machine.st.intLumiFill > int0, `${(int0 / 1e39).toFixed(5)} → ${(Machine.st.intLumiFill / 1e39).toFixed(5)} fb^-1`);
check('Lifetime combines burn-off and 100 h gas', d1.tau < d1.tauBurn && d1.tau < 100 * 3600, `τ = ${(d1.tau / 3600).toFixed(1)} h, burn-off ${(d1.tauBurn / 3600).toFixed(1)} h`);
S.beta = 30; run(0.1);
const d2 = Machine.derive(S);
check('Squeezing β* mid-fill raises luminosity immediately', d2.L > d1.L * 1.3, `${sci(d1.L)} → ${sci(d2.L)}`);
S.beta = 55;
S.B = 8.0; run(0.1);
check('Field below requirement loses beam', !Machine.hasBeam() && ['RAMPDOWN', 'NOBEAM'].includes(Machine.st.mode), `mode ${Machine.st.mode}`);
S.B = 8.33; run(5);
check('Magnets return to injection, re-inject possible', Machine.can('inject', S).ok, `mode ${Machine.st.mode}`);

// Ramp past the field limit fails
S.B = 6.0; Machine.act('inject', S); run(3); Machine.act('ramp', S); run(4);
check('Ramping past the field limit loses the beam', !Machine.hasBeam(), `mode ${Machine.st.mode}`);
S.B = 8.33; run(5);

// Quench at 9 T dumps automatically
Machine.act('inject', S); run(3); Machine.act('ramp', S); run(4);
S.B = 9.0; run(4);
check('9 T quenches and auto-dumps', Machine.st.mode === 'QUENCH' && !Machine.hasBeam(), `mode ${Machine.st.mode}, cooldown ${Machine.st.quenchTimer.toFixed(1)} s`);
check('Cannot inject during quench recovery', !Machine.can('inject', S).ok, Machine.can('inject', S).why);
S.B = 8.33; run(22);
check('Quench recovery returns to injection', Machine.st.mode === 'NOBEAM', `mode ${Machine.st.mode}`);

console.log(fails ? `\n${fails} check(s) failed` : '\nAll acceptance checks passed');
process.exit(fails ? 1 : 0);
