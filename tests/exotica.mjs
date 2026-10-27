// What-if checks for CoLLiDr's TeV-gravity black holes and the wormhole easter egg.
// Run: node tests/exotica.mjs  (extracts the PHYSICS and EXOTICA modules from public/index.html)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'public', 'index.html'), 'utf8');
const grab = (a, b) => html.slice(html.indexOf(a) + a.length, html.indexOf(b));
const src = grab('/* ===== PHYSICS-BEGIN ===== */', '/* ===== PHYSICS-END ===== */') +
            grab('/* ===== EXOTICA-BEGIN ===== */', '/* ===== EXOTICA-END ===== */');
const { Physics: P, Exotica: X } = new Function(`${src}; return { Physics, Exotica };`)();

let fails = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); if (!ok) fails++; };
const sci = (x, d = 2) => x.toExponential(d);

const s = [5, 5.5, 7, 10, 14].map(P.bhSigma_pb);
check('No black holes at or below the 5 TeV threshold', s[0] === 0 && P.bhSigma_pb(4) === 0, `σ(5 TeV) = ${s[0]} pb`);
check('σ_BH rises steeply with √s', s[1] > 0 && s[1] < s[2] && s[2] < s[3] && s[3] < s[4] && s[4] / s[2] > 1e3,
  `5.5: ${sci(s[1])}, 7: ${sci(s[2])}, 10: ${sci(s[3])}, 14: ${sci(s[4])} pb`);
check('σ_BH(14 TeV) is tens to hundreds of pb for M_D = 1 TeV, n = 6', s[4] > 10 && s[4] < 1000, `${s[4].toFixed(1)} pb`);
const M = 6000, rs = P.bhRadius_invGeV(M) * P.K.HBARC_GEV_M, TH = P.bhHawkingT_GeV(M);
check('Horizon radius ~1e-19 m', rs > 1e-20 && rs < 1e-18, `r_s(6 TeV) = ${sci(rs)} m`);
check('Hawking temperature ~0.5 TeV and falls with mass', TH > 300 && TH < 800 && P.bhHawkingT_GeV(9000) < TH, `T_H(6 TeV) = ${TH.toFixed(0)} GeV`);
check('Lifetime ~1e-27 s', P.bhLifetime_s(M) > 1e-28 && P.bhLifetime_s(M) < 1e-26, `τ = ${sci(P.bhLifetime_s(M))} s`);
check('A few primary Hawking quanta', P.bhMultiplicity(M) > 3 && P.bhMultiplicity(M) < 10, `⟨N⟩ = ${P.bhMultiplicity(M).toFixed(1)}`);
const ms = Array.from({ length: 400 }, (_, i) => P.bhSampleMass_GeV(14, (i + 0.5) / 400)).sort((a, b) => a - b);
check('Sampled masses lie between threshold and √s, piled near threshold', ms[0] >= 5000 && ms[399] <= 14000 && ms[200] < 7500,
  `min ${ms[0].toFixed(0)}, median ${ms[200].toFixed(0)}, max ${ms[399].toFixed(0)} GeV`);

const D = (o = {}) => Object.assign({ colliding: true, sqrtS: 14, L: 1e34, simTime: 0 }, o);
const run = (seconds, d0, step = 1 / 60, speed = 300) => {
  const ev = []; let t = 0;
  for (let i = 0; i < seconds / step; i++) { t += step * speed; ev.push(...X.update(step, D(Object.assign({ simTime: t }, d0)), () => 0.5)); }
  return ev;
};
X.setOn(false); X.update(0, D());
let ev = run(5, {});
check('Mode off: nothing forms', X.st.formed === 0 && !ev.length, `formed ${X.st.formed}`);
X.setOn(true); X.st.lastSim = null; X.update(0, D({ sqrtS: 4.9 }));
ev = run(5, { sqrtS: 4.9 });
check('Mode on below threshold: nothing forms', X.st.formed === 0, `formed ${X.st.formed}`);
X.st.lastSim = null; X.update(0, D());
ev = run(12, {});
const want = P.bhSigma_pb(14) * 1e-36 * 1e34 * 12 * 300;
check('Expected count = σ_BH · ∫L dt', Math.abs(X.st.expected / want - 1) < 1e-6 && X.st.formed === Math.floor(X.st.expected),
  `expected ${X.st.expected.toFixed(1)} (σ∫L ${want.toFixed(1)}), formed ${X.st.formed}`);
const types = ev.map(e => e.type);
check('Formation shows a black hole that evaporates, then clears', types.includes('bhShow') && types.includes('bhEvaporate') && types.includes('bhGone')
  && types.indexOf('bhShow') < types.indexOf('bhEvaporate') && types.indexOf('bhEvaporate') < types.indexOf('bhGone'), types.filter(t => t !== 'bhFormed').slice(0, 3).join(' → '));
X.setOn(false); X.st.visual = null;
const opened = X.openWormhole(), again = X.openWormhole();
ev = run(X.WH_VIS_S + 0.5, { colliding: false });
check('Wormhole easter egg opens once and closes on its own', opened && !again && ev.some(e => e.type === 'whClosed') && !X.visual(), `closed after ${X.WH_VIS_S} s`);

console.log(fails ? `\n${fails} what-if check(s) failed` : '\nAll what-if checks passed');
process.exit(fails ? 1 : 0);
