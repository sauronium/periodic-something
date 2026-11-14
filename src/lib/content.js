// Builds the written content for each element page from the data, at build time.
// Every sentence is driven by that element's own values (ranks, neighbours, isotopes, discovery order),
// so the 118 pages read differently rather than swapping a name into one paragraph.
import {
  ELEMENTS, CAT_NAME, CRYSTAL_NAME, STABLE, LONG_LIVED, SPECTRA, FLAME, HAZ, EXCEPT, stateAt, fmt
} from "./elements.js";
import { SITE } from "../config/site.js";

const SUPS = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻" };
const sup = t => String(t).split("").map(c => SUPS[c] || c).join("");
export const prettyConfig = c => c.replace(/(\d[spdf]) (\d+)/g, (m, a, b) => a + sup(b));
const ord = n => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const an = w => (/^[aeiou]/i.test(w) ? "an " : "a ") + w;
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
const listText = a => a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
const degC = k => fmt(k - 273.15, 4) + " °C";
const crustText = v => v >= 10000 ? fmt(v / 10000, 3) + " %" : v >= 1 ? fmt(v, 3) + " mg/kg" : fmt(v, 2) + " mg/kg";

// rank of an element by a numeric property (1 = largest), among elements that have a value
function rankOf(el, get) {
  const list = ELEMENTS.filter(e => get(e) > 0).sort((a, b) => get(b) - get(a));
  return { rank: list.indexOf(el) + 1, n: list.length };
}
const discoveryOrder = (() => {
  const ancient = ELEMENTS.filter(e => !e.year).length;
  const later = ELEMENTS.filter(e => e.year).sort((a, b) => a.year - b.year || a.Z - b.Z);
  const map = {}; later.forEach((e, i) => { map[e.Z] = ancient + i + 1; });
  return { ancient, map };
})();
const LATIN = { 11: "natrium", 19: "kalium", 26: "ferrum", 29: "cuprum", 47: "argentum", 50: "stannum", 51: "stibium", 74: "wolfram (the German name)", 79: "aurum", 80: "hydrargyrum, meaning \"liquid silver\"", 82: "plumbum" };
const sci = (v, unit) => { const e = Math.floor(Math.log10(v)), m = v / Math.pow(10, e); return fmt(m, 3) + " × 10" + sup(String(e).replace("-", "-")) + " " + unit; };
const HOT = [[310.15, "your hand (body temperature)"], [373.15, "boiling water"], [523, "a hot kitchen oven"], [1273, "a candle flame (about 1000 °C)"], [1811, "molten iron (1538 °C)"], [3300, "a welding arc"], [5800, "the surface of the Sun"]];
const COLD = [[273.15, "the freezing point of water"], [194.65, "dry ice (−78 °C)"], [77.35, "liquid nitrogen (−196 °C)"], [20.3, "liquid hydrogen (−253 °C)"]];
// How the synthetic elements were first made: [where, how, longest-lived isotope and its approximate half-life]
const MADE = {
  93: ["at Berkeley, California", "hitting uranium-238 with neutrons", "Np-237, about 2.1 million years"],
  94: ["at Berkeley", "bombarding uranium-238 with deuterons", "Pu-244, about 80 million years"],
  95: ["at the wartime Metallurgical Laboratory in Chicago", "having plutonium capture neutrons in a reactor", "Am-243, about 7,400 years"],
  96: ["at Berkeley", "striking plutonium-239 with alpha particles", "Cm-247, about 15.6 million years"],
  97: ["at Berkeley", "striking americium-241 with alpha particles", "Bk-247, about 1,400 years"],
  98: ["at Berkeley", "striking curium-242 with alpha particles", "Cf-251, about 900 years"],
  99: ["in the fallout of the 1952 'Ivy Mike' thermonuclear test", "uranium soaking up many neutrons in a split second", "Es-252, about 470 days"],
  100: ["in the same 1952 test debris as einsteinium", "uranium soaking up many neutrons in a split second", "Fm-257, about 100 days"],
  101: ["at Berkeley", "hitting a tiny sample of einsteinium-253 with alpha particles, one atom at a time", "Md-258, about 51 days"],
  102: ["at Berkeley and at Dubna, Russia, after a long priority dispute", "fusing curium with carbon nuclei", "No-259, about 58 minutes"],
  103: ["at Berkeley", "fusing californium with boron nuclei", "Lr-266, about 11 hours"],
  104: ["at Dubna and at Berkeley, which both claimed it", "fusing plutonium with neon, or californium with carbon", "Rf-267, about 1.3 hours"],
  105: ["at Dubna and at Berkeley", "fusing americium with neon, or californium with nitrogen", "Db-268, roughly a day"],
  106: ["at Berkeley", "fusing californium-249 with oxygen-18", "Sg-269, about 14 minutes"],
  107: ["at the GSI laboratory in Darmstadt, Germany", "fusing bismuth-209 with chromium-54", "Bh-270, about a minute"],
  108: ["at GSI Darmstadt", "fusing lead-208 with iron-58", "Hs-269, around 10 seconds"],
  109: ["at GSI Darmstadt", "fusing bismuth-209 with iron-58", "Mt-278, about 4.5 seconds"],
  110: ["at GSI Darmstadt", "fusing lead-208 with nickel-62", "Ds-281, about 13 seconds"],
  111: ["at GSI Darmstadt", "fusing bismuth-209 with nickel-64", "Rg-282, about 100 seconds"],
  112: ["at GSI Darmstadt", "fusing lead-208 with zinc-70", "Cn-285, about 30 seconds"],
  113: ["at RIKEN in Japan, after nine years of experiments that produced only three atoms", "fusing bismuth-209 with zinc-70", "Nh-286, about 10 seconds"],
  114: ["at Dubna, with Lawrence Livermore", "fusing plutonium-244 with calcium-48", "Fl-289, about 2 seconds"],
  115: ["at Dubna, with Lawrence Livermore", "fusing americium-243 with calcium-48", "Mc-290, under a second"],
  116: ["at Dubna, with Lawrence Livermore", "fusing curium-248 with calcium-48", "Lv-293, about 60 milliseconds"],
  117: ["at Dubna, with Oak Ridge and Vanderbilt in Tennessee, which supplied the berkelium target", "fusing berkelium-249 with calcium-48", "Ts-294, about 50 milliseconds"],
  118: ["at Dubna, with Lawrence Livermore", "fusing californium-249 with calcium-48", "Og-294, under a millisecond"]
};
const byPos = {}; ELEMENTS.forEach(e => { byPos[e.row + "," + e.col] = e; });

function groupMates(el) {
  if (el.cat === "lanthanide" || el.cat === "actinide") {
    const other = ELEMENTS.find(e => e.row === (el.row === 9 ? 10 : 9) && e.col === el.col);
    return { above: el.row === 10 ? other : null, below: el.row === 9 ? other : null };
  }
  const rows = [1, 2, 3, 4, 5, 6, 7], i = rows.indexOf(el.row);
  let above = null, below = null;
  for (let r = i - 1; r >= 0 && !above; r--) above = byPos[rows[r] + "," + el.col] || null;
  for (let r = i + 1; r < rows.length && !below; r++) below = byPos[rows[r] + "," + el.col] || null;
  return { above, below };
}

export function relatedElements(el) {
  const out = [], add = (e, why) => { if (e && e !== el && !out.some(x => x.el === e)) out.push({ el: e, why }); };
  const { above, below } = groupMates(el);
  add(ELEMENTS[el.Z - 2], "previous element");
  add(ELEMENTS[el.Z], "next element");
  add(above, el.cat === "lanthanide" || el.cat === "actinide" ? "matching lanthanide" : "above in group " + el.group);
  add(below, el.cat === "lanthanide" || el.cat === "actinide" ? "matching actinide" : "below in group " + el.group);
  const same = ELEMENTS.filter(e => e.cat === el.cat && e !== el);
  if (same.length) { add(same[(el.Z * 7) % same.length], "also " + an(CAT_NAME[el.cat].toLowerCase())); add(same[(el.Z * 13 + 3) % same.length], "also " + an(CAT_NAME[el.cat].toLowerCase())); }
  return out.slice(0, 6);
}

function ionsFromOxi(el) {
  return (el.oxi.match(/[+−-]\d+/g) || []).map(t => parseInt(t.replace("−", "-"), 10)).filter(q => q !== 0)
    .map(q => el.sym + sup((Math.abs(q) === 1 ? "" : Math.abs(q)) + (q > 0 ? "+" : "-")));
}

export function elementArticle(el) {
  const cat = CAT_NAME[el.cat], catLow = cat.toLowerCase(), fblock = el.cat === "lanthanide" || el.cat === "actinide";
  const where = fblock ? `in the ${catLow} series (period ${el.period}, f-block)` : `in group ${el.group}, period ${el.period} of the ${el.block}-block`;
  const state = stateAt(el, 298), name = el.name, lname = name.toLowerCase();
  const valence = el.shells[el.shells.length - 1];
  const sections = [];

  // --- Atomic structure
  const s1 = [];
  s1.push(`A neutral ${lname} atom has ${plural(el.Z, "proton")} and ${plural(el.Z, "electron")}, and its most common isotope carries about ${plural(el.neutrons, "neutron")}.`);
  s1.push(`One atom weighs about ${sci(el.mass * 1.66054e-27, "kg")}, so a mole of ${lname} (6.022 × 10²³ atoms) weighs ${fmt(el.mass, 5)} g.`);
  if (el.Z > 1) { const r = el.neutrons / el.Z; s1.push(`That nucleus holds ${fmt(r, 3)} neutrons for every proton${r > 1.4 ? ", typical of heavy nuclei, which need extra neutrons to hold together against the protons' repulsion" : r <= 1.06 ? ", close to the one-to-one balance that light nuclei prefer" : ""}.`); }
  if (LATIN[el.Z]) s1.push(`Its symbol ${el.sym} comes from ${LATIN[el.Z]}.`);
  s1.push(`The electrons fill ${plural(el.shells.length, "shell")} (${el.shells.map((n, i) => "KLMNOPQ"[i] + " " + n).join(", ")}), which gives the configuration ${prettyConfig(el.config)}.`);
  if (el.block === "s" || el.block === "p") s1.push(el.Z === 2 || el.cat === "noble"
    ? `Its outer shell is full, which is why ${lname} hardly reacts with anything.`
    : `With ${plural(valence, "electron")} in its outer shell, it ${valence <= 3 ? "tends to lose electrons and form positive ions" : valence >= 5 ? "tends to gain or share electrons to complete its outer shell" : "usually shares electrons in covalent bonds"}.`);
  else s1.push(`As ${an(el.block + "-block")} element, both its outer s electrons and its inner ${el.block} electrons can take part in bonding, which is why it shows more than one oxidation state.`);
  if (EXCEPT[el.Z]) s1.push(`Its configuration breaks the simple filling order: one electron moves so that a subshell becomes half-full or full, which is more stable.`);
  const st = STABLE[el.Z] || [], ll = LONG_LIVED[el.Z] || [];
  if (st.length === 1) s1.push(`It has only one stable isotope, ${el.sym}-${st[0]}${ll.length ? `, plus the long-lived ${ll.map(a => el.sym + "-" + a).join(" and ")}` : ""}.`);
  else if (st.length) s1.push(`It has ${st.length} stable isotopes: ${listText(st.map(a => el.sym + "-" + a))}${ll.length ? `. ${listText(ll.map(a => el.sym + "-" + a))} ${ll.length > 1 ? "are" : "is"} radioactive but lasts billions of years` : ""}.`);
  else if (ll.length) s1.push(`None of its isotopes is truly stable, but ${listText(ll.map(a => el.sym + "-" + a))} decays so slowly that it is still found in nature.`);
  else if (el.Z >= 104) s1.push(`Every isotope is radioactive and short-lived; only a handful of atoms have ever been made, one at a time.`);
  else s1.push(`All of its isotopes are radioactive, so any ${lname} on Earth is either freshly made or part of a decay chain.`);
  if (st.length) {
    const A0 = el.Z + el.neutrons, bars = [];
    for (const [z, list] of Object.entries(STABLE)) if (+z !== el.Z && list.includes(A0)) bars.push(ELEMENTS[+z - 1].sym + "-" + A0);
    s1.push(bars.length
      ? `Its most common isotope, ${el.sym}-${A0}, has the same mass number as ${listText(bars)}: isobars, nuclei of different elements with ${A0} nucleons each.`
      : `No other element has a stable isotope with mass number ${A0}, so ${el.sym}-${A0} has no stable isobars; its neighbours on that line decay into it or away from it.`);
  }
  sections.push({ h: "Atomic structure", p: s1 });

  // --- Physical properties
  const s2 = [];
  if (el.melt) {
    s2.push(`At room temperature (25 °C) ${lname} is ${state === "gas" ? "a gas" : state === "liquid" ? "a liquid" : "a solid"}${el.predicted ? ", as far as anyone can predict" : ""}.`);
    if (el.boil) s2.push(`It melts at ${degC(el.melt)} and boils at ${degC(el.boil)}, so it stays liquid across a ${fmt(el.boil - el.melt, 4)}-degree range.`);
    else s2.push(`It melts at about ${degC(el.melt)}; its boiling point has not been measured.`);
    if (el.melt >= 273.15) {
      const i = HOT.findIndex(h => h[0] >= el.melt);
      s2.push(i === 0 ? `It would melt in ${HOT[0][1]}.` : i > 0 ? `It stays solid in ${HOT[i - 1][1]} but would melt in ${HOT[i][1]}.` : `It stays solid even at the surface of the Sun's temperature range used here, which few materials manage.`);
    } else if (el.boil) {
      const t = state === "gas" ? el.boil : el.melt, word = state === "gas" ? "turn liquid" : "freeze";
      const c = COLD.filter(x => x[0] > t).pop();
      s2.push(c ? `To ${word} it has to be cooled below ${degC(t)}, colder than ${c[1]}.` : `It will ${word} below ${degC(t)}.`);
    }
    const mr = rankOf(el, e => e.melt);
    if (mr.rank <= 12) s2.push(`That is the ${ord(mr.rank)} highest melting point of any element.`);
    else if (mr.rank > mr.n - 12) s2.push(`Only ${mr.n - mr.rank} element${mr.n - mr.rank === 1 ? " has" : "s have"} a lower melting point.`);
  } else s2.push(`So little ${lname} has ever existed at once that its melting point, boiling point and even its state at room temperature are unknown.`);
  if (el.dens) {
    if (el.dens < 0.01) { const gl = el.dens * 1000; s2.push(`As a gas it weighs ${fmt(gl, 3)} g per litre, ${gl > 1.2 ? fmt(gl / 1.204, 2) + " times heavier" : fmt(1.204 / gl, 2) + " times lighter"} than air.`); }
    else {
      const dr = rankOf(el, e => e.dens);
      s2.push(`Its density is ${fmt(el.dens, 4)} g/cm³${el.Z >= 100 ? " (predicted)" : ""}, ${el.dens > 1 ? fmt(el.dens, 3) + " times as dense as water" : "lighter than water"}${dr.rank <= 10 ? `, the ${ord(dr.rank)} densest element` : ""}.`);
    }
  }
  if (el.rad) {
    const prev = ELEMENTS[el.Z - 2], next = ELEMENTS[el.Z];
    const cmp = prev && prev.rad && prev.period === el.period ? ` (${prev.name} next door is ${prev.rad} pm)` : next && next.rad && next.period === el.period ? ` (${next.name} next door is ${next.rad} pm)` : "";
    s2.push(`Its atoms have a radius of about ${el.rad} pm${cmp}.`);
  }
  if (el.crystal && el.crystal !== "unk") s2.push(`In the solid, its atoms pack into ${an(CRYSTAL_NAME[el.crystal].replace(/ \(.+\)/, "").toLowerCase())} lattice.`);
  sections.push({ h: "Physical properties", p: s2 });

  // --- Chemistry
  const s3 = [];
  if (el.en) {
    const er = rankOf(el, e => e.en);
    s3.push(`Its electronegativity is ${fmt(el.en, 3)} on the Pauling scale${er.rank <= 5 ? `, the ${ord(er.rank)} highest of all elements, so it pulls hard on shared electrons` : el.en < 1 ? ", one of the lowest, so it gives up electrons very easily" : ""}.`);
  } else s3.push(`It has no measured electronegativity${el.cat === "noble" ? ", because it almost never forms bonds" : ""}.`);
  if (el.ie) {
    const { above } = groupMates(el);
    s3.push(`Pulling off its outermost electron takes ${fmt(el.ie, 4)} kJ/mol${el.predicted ? " (predicted)" : ""}${above && above.ie && !fblock ? `, ${el.ie < above.ie ? "less" : "more"} than ${above.name} above it (${fmt(above.ie, 4)} kJ/mol)` : ""}.`);
  }
  if (el.en && el.Z !== 17) {
    const d = Math.abs(el.en - 3.16), kind = d > 1.7 ? "mostly ionic" : d >= 0.4 ? "polar covalent" : "almost non-polar covalent";
    s3.push(`A bond between ${lname} and chlorine would be ${kind}, with an electronegativity difference of ${fmt(d, 2)}.`);
  } else if (el.Z === 17) s3.push(`Bonded to sodium, the electronegativity difference of 2.23 makes the bond in table salt mostly ionic.`);
  if (el.ea) s3.push(`It releases ${fmt(el.ea, 3)} kJ/mol when it gains an extra electron${el.ea > 300 ? ", one of the largest electron affinities known" : ""}.`);
  const ions = ionsFromOxi(el);
  if (el.oxi && !el.oxi.includes("pred")) s3.push(ions.length ? `Its common oxidation states are ${el.oxi.replace(/, /g, ", ")}, so in compounds you will usually meet it as ${listText(ions.slice(0, 3))}.` : `It usually keeps an oxidation state of 0.`);
  const mates = fblock ? ELEMENTS.filter(e => e.cat === el.cat && e !== el) : ELEMENTS.filter(e => e.group === el.group && e !== el && e.cat !== "lanthanide" && e.cat !== "actinide");
  if (mates.length) s3.push(fblock ? `It shares much of its chemistry with the other ${catLow}s, especially its neighbours ${listText(mates.filter(m => Math.abs(m.Z - el.Z) <= 2).map(m => m.name))}.`
    : `Group ${el.group} also holds ${listText(mates.map(m => m.name))}, which ${mates.length > 1 ? "share" : "shares"} its outer-shell pattern.`);
  if (el.block === "s" || el.block === "p") s3.push(`Its Lewis symbol is ${el.sym} surrounded by ${plural(el.cat === "noble" && el.Z !== 2 ? 8 : valence, "dot")}.`);
  if (el.haz.length) s3.push(`Handle with care: as a pure element it is ${listText(el.haz.map(h => HAZ[h][2].toLowerCase()))}.`);
  sections.push({ h: "Chemical behaviour", p: s3 });

  // --- Occurrence and discovery
  const s4 = [];
  if (el.crust) {
    const cr = rankOf(el, e => e.crust);
    s4.push(`It makes up ${crustText(el.crust)} of Earth's crust, the ${ord(cr.rank)} most abundant element there.`);
  } else if (el.Z > 92) s4.push(`It does not occur in nature in useful amounts; it is made in nuclear reactors or particle accelerators.`);
  else s4.push(`It is vanishingly rare in nature, existing only briefly as part of radioactive decay chains.`);
  if (el.body) s4.push(`In the human body it accounts for about ${fmt(el.body, 3)} % of body mass${el.body >= 1 ? ", making it one of the main building blocks of life" : ""}.`);
  if (MADE[el.Z]) { const m = MADE[el.Z]; s4.push(`It was first made ${m[0]} by ${m[1]}. Its longest-lived known isotope is ${m[2]}.`); }
  if (el.year) s4.push(`It was first identified in ${el.year}, making it the ${ord(discoveryOrder.map[el.Z])} element to be discovered (counting the ${discoveryOrder.ancient} known since antiquity together).`);
  else s4.push(`It has been known since ancient times, one of only ${discoveryOrder.ancient} elements people used before modern chemistry.`);
  const lines = SPECTRA[el.Z], flame = FLAME[el.Z];
  if (lines) s4.push(`When excited it glows at its own set of colours; its brightest visible lines are at ${listText(lines.slice().sort((a, b) => b[1] - a[1]).slice(0, 3).map(l => l[0].toFixed(1) + " nm"))}.`);
  if (flame) s4.push(`In a flame test its compounds colour the flame ${flame[1]}.`);
  sections.push({ h: "Where it comes from", p: s4 });

  const stateWord = el.melt ? state : "element of unknown state";
  const title = (() => {
    const t = `${name} (${el.sym}): ${cat}, Element ${el.Z} | ${SITE.name}`;
    return t.length <= 62 ? t : `${name} (${el.sym}): ${cat}, Element ${el.Z}`;
  })();
  let description = `${name} (${el.sym}) is element ${el.Z}, ${an(catLow)}${el.melt ? ` and a ${stateWord} at room temperature` : ""}. See its 3D atom, electron configuration ${el.config}, isotopes and key properties.`;
  if (description.length > 158) description = `${name} (${el.sym}), element ${el.Z}: ${an(catLow)}. Explore its 3D atom, electron configuration, isotopes and properties.`;
  const lede = `${name} (${el.sym}) is element ${el.Z}, ${an(catLow)} ${where}. ${el.sum}`;

  const facts = [
    ["Atomic number", String(el.Z)],
    ["Symbol", el.sym],
    ["Atomic mass", fmt(el.mass, 6) + " u"],
    ["Category", cat],
    [fblock ? "Period" : "Group / period", fblock ? String(el.period) : el.group + " / " + el.period],
    ["Electron configuration", prettyConfig(el.config)],
    ["State at 25 °C", el.melt ? state[0].toUpperCase() + state.slice(1) : "Unknown"],
    ["Melting point", el.melt ? degC(el.melt) : "n/a"],
    ["Boiling point", el.boil ? degC(el.boil) : "n/a"],
    ["Density", el.dens ? (el.dens < 0.01 ? fmt(el.dens * 1000, 3) + " g/L" : fmt(el.dens, 4) + " g/cm³") : "n/a"],
    ["Electronegativity", el.en ? fmt(el.en, 3) : "n/a"],
    ["1st ionization energy", el.ie ? fmt(el.ie, 4) + " kJ/mol" : "n/a"],
    ["Oxidation states", el.oxi || "n/a"],
    ["Discovered", el.year ? String(el.year) : "Antiquity"]
  ];
  return { title, description, lede, sections, facts, related: relatedElements(el) };
}
