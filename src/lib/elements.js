// Element data and chemistry helpers. Pure JavaScript: used by Astro pages at build time and by the browser.
// Row: [Z, symbol, name, mass(u), electronegativity(Pauling), melt(K), boil(K), density(g/cm3), radius(pm), year(0=ancient), crystal, summary]
// 0 means unknown / not applicable. Crystal codes: sc bcc fcc hcp dia gra rho tet ort mon hex cub unk
const RAW = [
[1,"H","Hydrogen",1.008,2.20,14.01,20.28,0.00008988,25,1766,"hcp","Lightest and most abundant element; fuels stars and drives most of the universe's chemistry."],
[2,"He","Helium",4.0026,0,0.95,4.22,0.0001785,31,1868,"hcp","Inert noble gas, second most abundant in the universe; used for cryogenics and balloons."],
[3,"Li","Lithium",6.94,0.98,453.65,1603,0.534,145,1817,"bcc","Lightest metal, soft enough to cut with a knife; powers rechargeable batteries."],
[4,"Be","Beryllium",9.0122,1.57,1560,2742,1.85,105,1798,"hcp","Light, stiff and toxic metal used in aerospace parts and X-ray windows."],
[5,"B","Boron",10.81,2.04,2349,4200,2.34,85,1808,"rho","Hard metalloid found in borosilicate glass, detergents and strong ceramics."],
[6,"C","Carbon",12.011,2.55,3823,4098,2.267,70,0,"gra","Backbone of organic life; forms graphite, diamond and graphene."],
[7,"N","Nitrogen",14.007,3.04,63.15,77.36,0.0012506,65,1772,"hcp","Makes up 78% of Earth's air; essential for proteins, DNA and fertilizers."],
[8,"O","Oxygen",15.999,3.44,54.36,90.20,0.001429,60,1774,"mon","Supports respiration and combustion; most abundant element in Earth's crust."],
[9,"F","Fluorine",18.998,3.98,53.53,85.03,0.001696,50,1886,"mon","Most electronegative and most reactive element; found in toothpaste and Teflon."],
[10,"Ne","Neon",20.180,0,24.56,27.07,0.0008999,38,1898,"fcc","Inert gas that glows red-orange in discharge tubes."],
[11,"Na","Sodium",22.990,0.93,370.87,1156,0.971,180,1807,"bcc","Soft, highly reactive metal; sodium chloride is table salt."],
[12,"Mg","Magnesium",24.305,1.31,923,1363,1.738,150,1755,"hcp","Light structural metal that burns with a brilliant white flame; centre of chlorophyll."],
[13,"Al","Aluminium",26.982,1.61,933.47,2792,2.698,125,1825,"fcc","Light, corrosion-resistant metal; the most abundant metal in Earth's crust."],
[14,"Si","Silicon",28.085,1.90,1687,3538,2.3296,110,1824,"dia","Semiconductor behind modern electronics, also the main element in sand and glass."],
[15,"P","Phosphorus",30.974,2.19,317.3,553.6,1.82,100,1669,"ort","Essential in DNA, ATP and bones; used in fertilizers and matches."],
[16,"S","Sulfur",32.06,2.58,388.36,717.8,2.067,100,0,"ort","Yellow nonmetal used for sulfuric acid, vulcanized rubber and gunpowder."],
[17,"Cl","Chlorine",35.45,3.16,171.6,239.11,0.003214,100,1774,"ort","Toxic green gas used to disinfect water and to make plastics such as PVC."],
[18,"Ar","Argon",39.948,0,83.8,87.3,0.0017837,71,1894,"fcc","Inert gas used as a welding shield and to fill light bulbs."],
[19,"K","Potassium",39.098,0.82,336.53,1032,0.862,220,1807,"bcc","Reactive alkali metal; vital for nerve signalling and plant growth."],
[20,"Ca","Calcium",40.078,1.00,1115,1757,1.54,180,1808,"fcc","Builds bones, teeth and shells; used in cement and plaster."],
[21,"Sc","Scandium",44.956,1.36,1814,3109,2.989,160,1879,"hcp","Light transition metal used in aerospace alloys and stadium lighting."],
[22,"Ti","Titanium",47.867,1.54,1941,3560,4.54,140,1791,"hcp","Strong, light, corrosion-proof metal for implants, aircraft and spacecraft."],
[23,"V","Vanadium",50.942,1.63,2183,3680,6.11,135,1801,"bcc","Hardens steel alloys; used in vanadium flow batteries."],
[24,"Cr","Chromium",51.996,1.66,2180,2944,7.15,140,1797,"bcc","Hard, shiny metal behind stainless steel and chrome plating."],
[25,"Mn","Manganese",54.938,1.55,1519,2334,7.44,140,1774,"cub","Essential steel additive; also used in dry-cell batteries."],
[26,"Fe","Iron",55.845,1.83,1811,3134,7.874,140,0,"bcc","Most-used metal; the core of steel and of Earth, and carries oxygen in hemoglobin."],
[27,"Co","Cobalt",58.933,1.88,1768,3200,8.86,135,1735,"hcp","Magnetic metal used in superalloys, batteries and blue pigments."],
[28,"Ni","Nickel",58.693,1.91,1728,3186,8.912,135,1751,"fcc","Corrosion-resistant metal used in stainless steel, coins and batteries."],
[29,"Cu","Copper",63.546,1.90,1357.77,2835,8.96,135,0,"fcc","Excellent electrical and thermal conductor used in wiring and plumbing."],
[30,"Zn","Zinc",65.38,1.65,692.68,1180,7.134,135,1746,"hcp","Galvanizes steel, forms brass and is vital for many enzymes."],
[31,"Ga","Gallium",69.723,1.81,302.91,2477,5.907,130,1875,"ort","Melts in your hand; used in LEDs and semiconductor chips."],
[32,"Ge","Germanium",72.630,2.01,1211.4,3106,5.323,125,1886,"dia","Semiconductor used in fiber optics and infrared lenses."],
[33,"As","Arsenic",74.922,2.18,1090,887,5.776,115,1250,"rho","Notorious poison; also used in semiconductors such as gallium arsenide."],
[34,"Se","Selenium",78.971,2.55,494,958,4.809,115,1817,"hex","Photoconductive element; a trace nutrient used in glass and solar cells."],
[35,"Br","Bromine",79.904,2.96,265.8,332,3.122,115,1826,"ort","Dense red-brown liquid used in flame retardants and photography."],
[36,"Kr","Krypton",83.798,3.00,115.79,119.93,0.003733,88,1898,"fcc","Inert gas used in high-performance lighting and lasers."],
[37,"Rb","Rubidium",85.468,0.82,312.46,961,1.532,235,1861,"bcc","Highly reactive soft metal used in atomic clocks and research."],
[38,"Sr","Strontium",87.62,0.95,1050,1655,2.64,200,1790,"fcc","Gives fireworks a crimson color; used in some magnets and glass."],
[39,"Y","Yttrium",88.906,1.22,1799,3609,4.469,180,1794,"hcp","Used in LED phosphors, lasers and superconducting ceramics."],
[40,"Zr","Zirconium",91.224,1.33,2128,4682,6.506,155,1789,"hcp","Corrosion-resistant metal used for nuclear reactor fuel cladding."],
[41,"Nb","Niobium",92.906,1.6,2750,5017,8.57,145,1801,"bcc","Superconducting alloy metal used in MRI magnets and jet engines."],
[42,"Mo","Molybdenum",95.95,2.16,2896,4912,10.22,145,1778,"bcc","High-melting metal that strengthens steels and is key to some enzymes."],
[43,"Tc","Technetium",98,1.9,2430,4538,11.5,135,1937,"hcp","Lightest element with no stable isotopes; widely used in medical imaging."],
[44,"Ru","Ruthenium",101.07,2.2,2607,4423,12.37,130,1844,"hcp","Hard platinum-group metal used in electrical contacts and catalysts."],
[45,"Rh","Rhodium",102.91,2.28,2237,3968,12.41,135,1803,"fcc","Rare, highly reflective metal used in catalytic converters."],
[46,"Pd","Palladium",106.42,2.20,1828.05,3236,12.02,140,1803,"fcc","Catalytic converter metal that can absorb large amounts of hydrogen."],
[47,"Ag","Silver",107.87,1.93,1234.93,2435,10.501,160,0,"fcc","Best electrical conductor of all metals; used in jewelry, mirrors and electronics."],
[48,"Cd","Cadmium",112.41,1.69,594.22,1040,8.69,155,1817,"hcp","Toxic metal used in rechargeable batteries and pigments."],
[49,"In","Indium",114.82,1.78,429.75,2345,7.31,155,1863,"tet","Soft metal used in touchscreen coatings and low-melting solders."],
[50,"Sn","Tin",118.71,1.96,505.08,2875,7.287,145,0,"tet","Used for solder and plating; bronze is a copper-tin alloy."],
[51,"Sb","Antimony",121.76,2.05,903.78,1860,6.685,145,0,"rho","Metalloid used in flame retardants and hardened lead alloys."],
[52,"Te","Tellurium",127.60,2.1,722.66,1261,6.232,140,1782,"hex","Metalloid used in solar panels and thermoelectric devices."],
[53,"I","Iodine",126.90,2.66,386.85,457.4,4.93,140,1811,"ort","Essential for thyroid hormones; used as an antiseptic."],
[54,"Xe","Xenon",131.29,2.6,161.4,165.03,0.005887,108,1898,"fcc","Heavy noble gas used in flash lamps and spacecraft ion thrusters."],
[55,"Cs","Caesium",132.91,0.79,301.59,944,1.873,260,1860,"bcc","Extremely reactive metal; its atoms define the length of the second."],
[56,"Ba","Barium",137.33,0.89,1000,2170,3.594,215,1808,"bcc","Heavy metal; barium sulfate is used in X-ray imaging of the gut."],
[57,"La","Lanthanum",138.91,1.10,1193,3737,6.145,195,1839,"hcp","First lanthanide; used in camera lenses and hybrid-car batteries."],
[58,"Ce","Cerium",140.12,1.12,1068,3716,6.77,185,1803,"fcc","Most abundant rare earth; used in catalytic converters and glass polishing."],
[59,"Pr","Praseodymium",140.91,1.13,1208,3793,6.773,185,1885,"hcp","Rare earth used in strong magnets and yellow-green glass."],
[60,"Nd","Neodymium",144.24,1.14,1297,3347,7.007,185,1885,"hcp","Powers the strongest permanent magnets in motors and headphones."],
[61,"Pm","Promethium",145,1.13,1315,3273,7.26,185,1945,"hcp","Radioactive rare earth with no stable isotopes; once used in luminous paint."],
[62,"Sm","Samarium",150.36,1.17,1345,2067,7.52,185,1879,"rho","Used in samarium-cobalt magnets that work at high temperature."],
[63,"Eu","Europium",151.96,1.2,1099,1802,5.243,185,1901,"bcc","Red and blue phosphor in screens; used in euro banknote security inks."],
[64,"Gd","Gadolinium",157.25,1.2,1585,3546,7.895,180,1880,"hcp","Used as an MRI contrast agent and as a neutron absorber."],
[65,"Tb","Terbium",158.93,1.1,1629,3503,8.229,175,1843,"hcp","Green phosphors and magnetostrictive alloys."],
[66,"Dy","Dysprosium",162.50,1.22,1680,2840,8.55,175,1886,"hcp","Improves the heat resistance of neodymium magnets."],
[67,"Ho","Holmium",164.93,1.23,1734,2993,8.795,175,1878,"hcp","Has the strongest magnetic moment of any element; used in lasers."],
[68,"Er","Erbium",167.26,1.24,1802,3141,9.066,175,1843,"hcp","Amplifies light signals in long-distance fiber-optic cables."],
[69,"Tm","Thulium",168.93,1.25,1818,2223,9.321,175,1879,"hcp","Rarest stable lanthanide; used in portable X-ray sources."],
[70,"Yb","Ytterbium",173.05,1.1,1097,1469,6.965,175,1878,"fcc","Used in extremely precise atomic clocks and infrared lasers."],
[71,"Lu","Lutetium",174.97,1.27,1925,3675,9.84,175,1907,"hcp","Densest lanthanide; used in PET scanner detectors."],
[72,"Hf","Hafnium",178.49,1.3,2506,4876,13.31,155,1923,"hcp","Used in nuclear control rods and in microchip insulators."],
[73,"Ta","Tantalum",180.95,1.5,3290,5731,16.654,145,1802,"bcc","Corrosion-proof metal used in capacitors for phones and laptops."],
[74,"W","Tungsten",183.84,2.36,3695,5828,19.25,135,1783,"bcc","Highest melting point of any metal; used in filaments and drill bits."],
[75,"Re","Rhenium",186.21,1.9,3459,5869,21.02,135,1925,"hcp","Very dense metal used in jet-engine superalloys."],
[76,"Os","Osmium",190.23,2.2,3306,5285,22.59,130,1803,"hcp","Densest naturally occurring element; used in pen tips and contacts."],
[77,"Ir","Iridium",192.22,2.20,2719,4701,22.56,135,1803,"fcc","Extremely corrosion-resistant; used in spark plugs and crucibles."],
[78,"Pt","Platinum",195.08,2.28,2041.4,4098,21.45,135,1735,"fcc","Precious catalyst metal for converters, laboratory ware and jewelry."],
[79,"Au","Gold",196.97,2.54,1337.33,3129,19.282,135,0,"fcc","Inert, malleable precious metal used in jewelry, coins and electronics."],
[80,"Hg","Mercury",200.59,2.00,234.32,629.88,13.534,150,0,"rho","Only metal that is liquid at room temperature; highly toxic."],
[81,"Tl","Thallium",204.38,1.62,577,1746,11.85,190,1861,"hcp","Toxic soft metal once used as rat poison; now used in infrared optics."],
[82,"Pb","Lead",207.2,2.33,600.61,2022,11.342,180,0,"fcc","Dense, soft metal used in batteries and radiation shielding; toxic."],
[83,"Bi","Bismuth",208.98,2.02,544.7,1837,9.807,160,0,"rho","Least toxic heavy metal; used in cosmetics, medicines and low-melting alloys."],
[84,"Po","Polonium",209,2.0,527,1235,9.32,190,1898,"sc","Intensely radioactive element discovered by Marie and Pierre Curie."],
[85,"At","Astatine",210,2.2,575,610,7,0,1940,"unk","Rarest naturally occurring element; extremely radioactive (values estimated)."],
[86,"Rn","Radon",222,2.2,202,211.3,0.00973,120,1900,"fcc","Radioactive noble gas that seeps out of rocks into basements."],
[87,"Fr","Francium",223,0.7,300,950,1.87,0,1939,"unk","Extremely rare and unstable alkali metal (values estimated)."],
[88,"Ra","Radium",226,0.9,973,2010,5.5,215,1898,"bcc","Radioactive metal once used in glow-in-the-dark paint."],
[89,"Ac","Actinium",227,1.1,1323,3471,10.07,195,1899,"fcc","Radioactive and glows blue in the dark; first of the actinides."],
[90,"Th","Thorium",232.04,1.3,2115,5061,11.72,180,1829,"fcc","Weakly radioactive metal studied as a nuclear fuel."],
[91,"Pa","Protactinium",231.04,1.5,1841,4300,15.37,180,1913,"tet","Rare, radioactive and highly toxic actinide."],
[92,"U","Uranium",238.03,1.38,1405.3,4404,19.1,175,1789,"ort","Heavy metal used as fuel in nuclear reactors."],
[93,"Np","Neptunium",237,1.36,917,4273,20.45,175,1940,"ort","First transuranic element; produced in nuclear reactors."],
[94,"Pu","Plutonium",244,1.28,912.5,3501,19.816,175,1940,"mon","Fissile metal used in nuclear weapons and to power spacecraft."],
[95,"Am","Americium",243,1.3,1449,2880,12,175,1944,"hcp","Used in household smoke detectors."],
[96,"Cm","Curium",247,1.3,1613,3383,13.51,0,1944,"hcp","Named for Marie and Pierre Curie; powers some space probes."],
[97,"Bk","Berkelium",247,1.3,1259,2900,14.78,0,1949,"hcp","Synthetic actinide made in nuclear reactors for research."],
[98,"Cf","Californium",251,1.3,1173,1743,15.1,0,1950,"hcp","Intense neutron source used to start reactors and detect metals."],
[99,"Es","Einsteinium",252,1.3,1133,1269,8.84,0,1952,"fcc","Discovered in the debris of the first hydrogen bomb test."],
[100,"Fm","Fermium",257,1.3,1800,0,9.7,0,1952,"unk","Also found in hydrogen bomb debris; only tiny amounts have been made."],
[101,"Md","Mendelevium",258,1.3,1100,0,10.3,0,1955,"unk","Named for Mendeleev; made one atom at a time."],
[102,"No","Nobelium",259,1.3,1100,0,9.9,0,1958,"unk","Named for Alfred Nobel; synthetic and short-lived."],
[103,"Lr","Lawrencium",266,1.3,1900,0,15.6,0,1961,"unk","Last of the actinides; synthetic with a very short half-life."],
[104,"Rf","Rutherfordium",267,0,0,0,17,0,1964,"unk","Synthetic superheavy element named for Ernest Rutherford."],
[105,"Db","Dubnium",268,0,0,0,21.6,0,1968,"unk","Synthetic superheavy element named for Dubna, Russia."],
[106,"Sg","Seaborgium",269,0,0,0,23.2,0,1974,"unk","Named for Glenn Seaborg; made a few atoms at a time."],
[107,"Bh","Bohrium",270,0,0,0,26.5,0,1981,"unk","Named for Niels Bohr; synthetic and short-lived."],
[108,"Hs","Hassium",277,0,0,0,28.6,0,1984,"unk","Named for the German state of Hesse; very short-lived."],
[109,"Mt","Meitnerium",278,0,0,0,27.5,0,1982,"unk","Named for Lise Meitner; only a few atoms ever observed."],
[110,"Ds","Darmstadtium",281,0,0,0,26,0,1994,"unk","Named for Darmstadt, Germany; synthetic and unstable."],
[111,"Rg","Roentgenium",282,0,0,0,22,0,1994,"unk","Named for Wilhelm Roentgen; synthetic and extremely short-lived."],
[112,"Cn","Copernicium",285,0,0,0,14,0,1996,"unk","Named for Nicolaus Copernicus; synthetic."],
[113,"Nh","Nihonium",286,0,0,0,16,0,2004,"unk","Named for Nihon (Japan); the first element discovered in Asia."],
[114,"Fl","Flerovium",289,0,0,0,9.9,0,1998,"unk","Named for the Flerov laboratory; predicted to be unusually volatile."],
[115,"Mc","Moscovium",290,0,0,0,13.5,0,2003,"unk","Named for Moscow; synthetic with a half-life under a second."],
[116,"Lv","Livermorium",293,0,0,0,12.9,0,2000,"unk","Named for the Lawrence Livermore laboratory; synthetic."],
[117,"Ts","Tennessine",294,0,0,0,7.2,0,2010,"unk","Named for Tennessee; second-heaviest known element."],
[118,"Og","Oganesson",294,0,0,0,4.9,0,2002,"unk","Heaviest known element; named for Yuri Oganessian."]
];

/* ---------- Chemistry helpers ---------- */
const ORDER = ["1s","2s","2p","3s","3p","4s","3d","4p","5s","4d","5p","6s","4f","5d","6p","7s","5f","6d","7p"];
const CAP = { s: 2, p: 6, d: 10, f: 14 };
const NOBLE = [2, 10, 18, 36, 54, 86];
const EXCEPT = {
  24:{"4s":1,"3d":5}, 29:{"4s":1,"3d":10}, 41:{"5s":1,"4d":4}, 42:{"5s":1,"4d":5},
  44:{"5s":1,"4d":7}, 45:{"5s":1,"4d":8}, 46:{"5s":0,"4d":10}, 47:{"5s":1,"4d":10},
  57:{"4f":0,"5d":1}, 58:{"4f":1,"5d":1}, 64:{"4f":7,"5d":1}, 78:{"6s":1,"5d":9}, 79:{"6s":1,"5d":10},
  89:{"5f":0,"6d":1}, 90:{"5f":0,"6d":2}, 91:{"5f":2,"6d":1}, 92:{"5f":3,"6d":1}, 93:{"5f":4,"6d":1},
  96:{"5f":7,"6d":1}, 103:{"5f":14,"6d":0,"7p":1}
};
const NEUTRONS = {12:12,17:18,18:22,19:20,20:20,22:26,24:28,28:30,29:34,30:34,31:38,32:42,34:46,35:44,36:48,
  38:50,40:50,48:66,50:70,52:78,54:78,56:82,60:82,64:94,68:94,70:104,76:114,78:117,80:122,82:126};

function fill(Z, useExceptions) {
  const occ = {};
  let left = Z;
  for (const sub of ORDER) {
    if (left <= 0) break;
    const n = Math.min(left, CAP[sub[1]]);
    occ[sub] = n; left -= n;
  }
  if (useExceptions && EXCEPT[Z]) Object.assign(occ, EXCEPT[Z]);
  return occ;
}
function subOrder(a, b) { return (+a[0] - +b[0]) || ("spdf".indexOf(a[1]) - "spdf".indexOf(b[1])); }

function categoryOf(Z, group) {
  if ([3,11,19,37,55,87].includes(Z)) return "alkali";
  if ([4,12,20,38,56,88].includes(Z)) return "alkaline";
  if (Z >= 57 && Z <= 71) return "lanthanide";
  if (Z >= 89 && Z <= 103) return "actinide";
  if ([2,10,18,36,54,86,118].includes(Z)) return "noble";
  if ([9,17,35,53,85,117].includes(Z)) return "halogen";
  if ([5,14,32,33,51,52].includes(Z)) return "metalloid";
  if ([1,6,7,8,15,16,34].includes(Z)) return "nonmetal";
  if ([13,31,49,50,81,82,83,84,113,114,115,116].includes(Z)) return "post";
  return "transition";
}
function positionOf(Z) {
  // returns [period, group, gridRow, gridCol]; f-block rows are 9 (lanthanides) and 10 (actinides)
  const mk = (p, g) => [p, g, p, g];
  if (Z === 1) return mk(1, 1);
  if (Z === 2) return mk(1, 18);
  if (Z <= 4) return mk(2, Z - 2);
  if (Z <= 10) return mk(2, Z + 8);
  if (Z <= 12) return mk(3, Z - 10);
  if (Z <= 18) return mk(3, Z);
  if (Z <= 36) return mk(4, Z - 18);
  if (Z <= 54) return mk(5, Z - 36);
  if (Z <= 56) return mk(6, Z - 54);
  if (Z <= 71) return [6, 3, 9, Z - 57 + 3];
  if (Z <= 86) return mk(6, Z - 68);
  if (Z <= 88) return mk(7, Z - 86);
  if (Z <= 103) return [7, 3, 10, Z - 89 + 3];
  return mk(7, Z - 100);
}
function blockOf(el) {
  if (el.cat === "lanthanide" || el.cat === "actinide") return "f";
  if (el.Z === 2 || el.group <= 2) return "s";
  if (el.group >= 13) return "p";
  return "d";
}
const SHELL_NAMES = ["K","L","M","N","O","P","Q"];

const ELEMENTS = RAW.map(r => {
  const [Z, sym, name, mass, en, melt, boil, dens, rad, year, crystal, sum] = r;
  const [period, group, row, col] = positionOf(Z);
  const occ = fill(Z, true);
  const subs = Object.keys(occ).filter(k => occ[k] > 0).sort(subOrder);
  const shells = [];
  subs.forEach(k => { shells[+k[0] - 1] = (shells[+k[0] - 1] || 0) + occ[k]; });
  for (let i = 0; i < shells.length; i++) shells[i] = shells[i] || 0;
  // condensed configuration with noble-gas core
  let core = 0; for (const n of NOBLE) if (n < Z) core = n;
  const coreOcc = core ? fill(core, false) : {};
  const rest = subs.map(k => [k, occ[k] - (coreOcc[k] || 0)]).filter(x => x[1] > 0);
  const coreSym = core ? "[" + RAW.find(x => x[0] === core)[1] + "] " : "";
  const config = coreSym + rest.map(x => x[0] + " " + x[1]).join(" ");
  const cat = categoryOf(Z);
  const el = { Z, sym, name, mass, en, melt, boil, dens, rad, year, crystal, sum,
    period, group, row, col, cat, occ, subs, shells, config,
    neutrons: NEUTRONS[Z] !== undefined ? NEUTRONS[Z] : Math.max(0, Math.round(mass) - Z),
    predicted: Z >= 104 };
  el.block = blockOf(el);
  return el;
});

function stateAt(el, T) {
  if (!el.melt) return "unknown";
  if (T < el.melt) return "solid";
  if (!el.boil) return "unknown";
  return T < el.boil ? "liquid" : "gas";
}
function fmt(v, d) {
  if (v === 0 || v === undefined || v === null) return "n/a";
  const s = Number(v).toPrecision(d || 4);
  return String(parseFloat(s));
}
const CATEGORIES = [
  ["alkali","Alkali metal",8], ["alkaline","Alkaline earth",32], ["transition","Transition metal",52],
  ["post","Post-transition metal",150], ["metalloid","Metalloid",175], ["nonmetal","Reactive nonmetal",200],
  ["halogen","Halogen",225], ["noble","Noble gas",265], ["lanthanide","Lanthanide",300], ["actinide","Actinide",335]
];
const CAT_NAME = Object.fromEntries(CATEGORIES.map(c => [c[0], c[1]]));
const CAT_HUE = Object.fromEntries(CATEGORIES.map(c => [c[0], c[2]]));
const CRYSTAL_NAME = {
  sc:"Simple cubic", bcc:"Body-centred cubic (BCC)", fcc:"Face-centred cubic (FCC)", hcp:"Hexagonal close-packed (HCP)",
  dia:"Diamond cubic", gra:"Layered hexagonal (graphite)", rho:"Rhombohedral", tet:"Tetragonal", ort:"Orthorhombic",
  mon:"Monoclinic", hex:"Hexagonal (chains)", cub:"Complex cubic", unk:"Not determined"
};

/* ---------- Extra reference data (index = atomic number; 0 = unknown) ---------- */
// First ionization energy, kJ/mol (104+ predicted)
const IE1 = [0,1312,2372,520,900,801,1086,1402,1314,1681,2081,496,738,578,787,1012,1000,1251,1521,419,590,633,659,651,653,717,763,760,737,746,906,
  579,762,947,941,1140,1351,403,550,600,640,652,684,702,710,720,804,731,868,558,709,834,869,1008,1170,376,503,538,534,527,533,540,545,547,593,566,573,
  581,589,597,603,524,659,761,770,760,840,880,870,890,1007,589,716,703,812,899,1037,393,509,499,587,568,598,605,585,578,581,601,608,619,627,635,642,479,
  580,665,757,740,730,800,960,1020,1155,707,832,538,664,742,860];
// Electron affinity, kJ/mol (energy released; 0 = not bound or not measured)
const EA = [0,73,0,60,0,27,122,0,141,328,0,53,0,42,134,72,200,349,0,48,2,18,8,51,65,0,15,64,112,119,0,41,119,79,195,325,0,47,5,30,41,86,72,53,101,110,
  54,126,0,37,107,101,190,295,0,46,14,54,55,0,0,0,0,0,0,0,0,0,0,99,0,33,17,31,79,6,104,151,205,223,0,31,35,91,136,233,0,47,10,34,113];
// Common oxidation states
const OXI = ["","+1, −1","0","+1","+2","+3","+4, +2, −4","−3, +3, +5","−2","−1","0","+1","+2","+3","+4, −4","+5, +3, −3","−2, +4, +6","−1, +1, +5, +7","0","+1","+2",
  "+3","+4, +3","+5, +4, +3","+3, +6, +2","+2, +4, +7","+2, +3","+2, +3","+2","+2, +1","+2","+3","+4, +2","+3, +5, −3","−2, +4, +6","−1, +1, +5","0, +2","+1","+2",
  "+3","+4","+5, +3","+6, +4","+7, +4","+3, +4","+3","+2, +4","+1","+2","+3","+4, +2","+3, +5, −3","−2, +4, +6","−1, +1, +5, +7","0, +2, +4, +6","+1","+2",
  "+3","+3, +4","+3","+3","+3","+3, +2","+3, +2","+3","+3, +4","+3","+3","+3","+3","+3, +2","+3","+4","+5","+6, +4","+7, +4","+4, +8","+3, +4","+2, +4","+3, +1",
  "+2, +1","+1, +3","+2, +4","+3","+4, +2","−1, +1","0, +2","+1","+2","+3","+4","+5","+6, +4","+5","+4","+3","+3","+3","+3","+3","+3","+3","+2","+3",
  "+4 (pred.)","+5 (pred.)","+6 (pred.)","+7 (pred.)","+8 (pred.)","","","","","","","","",""];
// Abundance in Earth's crust, mg/kg
const CRUST = [0,1400,0.008,20,2.8,10,200,19,461000,585,0.005,23600,23300,82300,282000,1050,350,145,3.5,20900,41500,22,5650,120,102,950,56300,25,84,60,70,
  19,1.5,1.8,0.05,2.4,0.0001,90,370,33,165,20,1.2,0,0.001,0.001,0.015,0.075,0.15,0.25,2.3,0.2,0.001,0.45,0.00003,3,425,39,66.5,9.2,41.5,0,7.05,2,6.2,1.2,5.2,
  1.3,3.5,0.52,3.2,0.8,3,2,1.25,0.0007,0.0015,0.001,0.005,0.004,0.085,0.85,14,0.0085,2e-10,0,4e-13,0,9e-7,5.5e-10,9.6,1.4e-6,2.7];
// Share of the human body by mass, %
const BODY = {8:65,6:18.5,1:9.5,7:3.2,20:1.5,15:1.0,19:0.4,16:0.3,11:0.2,17:0.2,12:0.1,26:0.006,9:0.0037,30:0.0032,14:0.002,37:0.00046,38:0.00046,35:0.00029,
  82:0.00017,29:0.0001,13:0.00009,48:0.00007,56:0.00003,50:0.00002,53:0.00002,25:0.00002,34:0.00002,42:0.00001,24:0.000003,27:0.000002};
// Stable isotopes (mass numbers) and long-lived primordial radioactive ones
const STABLE_RAW = "1:1,2;2:3,4;3:6,7;4:9;5:10,11;6:12,13;7:14,15;8:16,17,18;9:19;10:20,21,22;11:23;12:24,25,26;13:27;14:28,29,30;15:31;16:32,33,34,36;17:35,37;" +
  "18:36,38,40;19:39,41;20:40,42,43,44,46,48;21:45;22:46,47,48,49,50;23:51;24:50,52,53,54;25:55;26:54,56,57,58;27:59;28:58,60,61,62,64;29:63,65;30:64,66,67,68,70;" +
  "31:69,71;32:70,72,73,74,76;33:75;34:74,76,77,78,80,82;35:79,81;36:78,80,82,83,84,86;37:85;38:84,86,87,88;39:89;40:90,91,92,94,96;41:93;42:92,94,95,96,97,98,100;" +
  "44:96,98,99,100,101,102,104;45:103;46:102,104,105,106,108,110;47:107,109;48:106,108,110,111,112,114,116;49:113;50:112,114,115,116,117,118,119,120,122,124;51:121,123;" +
  "52:120,122,123,124,125,126,128,130;53:127;54:124,126,128,129,130,131,132,134,136;55:133;56:130,132,134,135,136,137,138;57:139;58:136,138,140,142;59:141;" +
  "60:142,143,145,146,148,150;62:144,149,150,152,154;63:151,153;64:154,155,156,157,158,160;65:159;66:156,158,160,161,162,163,164;67:165;68:162,164,166,167,168,170;69:169;" +
  "70:168,170,171,172,173,174,176;71:175;72:176,177,178,179,180;73:181;74:182,183,184,186;75:185;76:184,187,188,189,190,192;77:191,193;78:192,194,195,196,198;79:197;" +
  "80:196,198,199,200,201,202,204;81:203,205;82:204,206,207,208";
const STABLE = {};
STABLE_RAW.split(";").forEach(s => { const [z, list] = s.split(":"); STABLE[+z] = list.split(",").map(Number); });
const LONG_LIVED = { 19: [40], 37: [87], 49: [115], 57: [138], 62: [147], 71: [176], 75: [187], 83: [209], 90: [232], 92: [235, 238] };
// Visible emission lines: [wavelength nm, relative intensity]
const SPECTRA = {
  1: [[656.3,1],[486.1,.6],[434.0,.35],[410.2,.25]],
  2: [[706.5,.4],[667.8,.6],[587.6,1],[501.6,.5],[492.2,.3],[471.3,.3],[447.1,.6],[402.6,.3]],
  3: [[670.8,1],[610.4,.4],[460.3,.2],[413.3,.12]],
  7: [[575.3,.5],[567.6,.7],[500.5,1],[463.1,.4],[410.0,.3],[648.2,.3]],
  8: [[777.2,1],[645.4,.3],[615.8,.4],[533.1,.2],[436.8,.2]],
  10: [[540.1,.3],[585.2,.6],[588.2,.4],[594.5,.5],[597.6,.2],[603.0,.3],[607.4,.4],[609.6,.5],[614.3,.6],[616.4,.3],[621.7,.3],[626.6,.5],[633.4,.6],[638.3,.6],[640.2,1],[650.7,.6],[659.9,.4],[692.9,.4],[703.2,.6]],
  11: [[589.0,1],[589.6,.9],[568.8,.15],[498.3,.08]],
  12: [[518.4,1],[517.3,.8],[516.7,.6],[470.3,.2],[457.1,.2]],
  19: [[766.5,1],[769.9,.9],[404.4,.3],[404.7,.3],[693.9,.15]],
  20: [[422.7,1],[445.5,.3],[558.9,.3],[616.2,.4],[643.9,.4],[646.3,.3],[649.4,.3]],
  26: [[404.6,.5],[430.8,.6],[438.4,.8],[440.5,.6],[495.8,.4],[527.0,1],[532.8,.6],[537.1,.5],[561.6,.3]],
  29: [[465.1,.2],[510.6,.6],[515.3,.7],[521.8,1],[578.2,.5]],
  30: [[468.0,.5],[472.2,.6],[481.1,1],[636.2,.8]],
  31: [[403.3,.6],[417.2,1]],
  36: [[427.4,.4],[431.9,.4],[446.4,.3],[557.0,.8],[587.1,1],[760.2,.6]],
  37: [[420.2,.5],[421.6,.4],[572.4,.2],[629.8,.2]],
  18: [[415.9,.3],[420.1,.3],[451.1,.3],[696.5,.7],[706.7,.5],[714.7,.3],[738.4,.6],[750.4,1]],
  38: [[407.8,.6],[421.6,.5],[460.7,1],[640.8,.6],[650.4,.4],[687.8,.4],[707.0,.5]],
  48: [[467.8,.6],[480.0,.8],[508.6,1],[643.8,1]],
  49: [[410.2,.6],[451.1,1]],
  54: [[462.4,.7],[467.1,1],[473.4,.5],[480.7,.5],[492.3,.4],[529.2,.3]],
  55: [[455.5,1],[459.3,.6],[672.3,.2],[697.3,.2]],
  56: [[455.4,.7],[493.4,.5],[553.5,1],[614.2,.4],[649.7,.4],[705.9,.3]],
  80: [[404.7,.5],[435.8,1],[491.6,.15],[546.1,1],[577.0,.5],[579.1,.5]],
  81: [[535.0,1],[377.6,.4]],
  82: [[405.8,1],[406.2,.3],[560.9,.2]]
};
// Flame test colours: [css colour, description]
const FLAME = { 3: ["#e0193a","crimson red"], 11: ["#ffb300","bright yellow-orange"], 19: ["#c39bd3","lilac"], 37: ["#c2366b","red-violet"],
  55: ["#8d82e0","blue-violet"], 20: ["#ff6a2b","orange-red"], 38: ["#ec1c2e","scarlet red"], 56: ["#9fe36b","pale apple green"],
  29: ["#22c3a0","blue-green"], 5: ["#46d84a","bright green"], 81: ["#3fd23f","pure green"], 49: ["#5a5ae0","indigo blue"],
  30: ["#a6dccb","pale blue-green"], 82: ["#b6c8ff","pale grey-blue"], 31: ["#7a6ae6","violet"], 15: ["#bfe8d2","pale blue-green"] };
// Hazards (rough, for the element itself)
const HAZ_DEF = [
  ["rad", "☢", "Radioactive", 290, z => z === 43 || z === 61 || z >= 84],
  ["tox", "☠", "Toxic", 0, z => [4,9,15,17,33,34,35,48,51,56,76,80,81,82].includes(z)],
  ["fire", "🔥", "Flammable or reacts with water", 25, z => [1,3,11,12,15,16,19,20,37,38,55,56,87].includes(z)],
  ["ox", "◎", "Oxidiser", 50, z => [8,9,17].includes(z)],
  ["cor", "⚗", "Corrosive", 160, z => [9,17,35].includes(z)],
  ["gas", "◌", "Asphyxiant gas", 200, z => [2,7,10,18,36,54].includes(z)]
];
ELEMENTS.forEach(e => {
  e.ie = IE1[e.Z] || 0; e.ea = EA[e.Z] || 0; e.oxi = OXI[e.Z] || ""; e.crust = CRUST[e.Z] || 0; e.body = BODY[e.Z] || 0;
  e.haz = HAZ_DEF.filter(h => h[4](e.Z)).map(h => h[0]);
});
const HAZ = Object.fromEntries(HAZ_DEF.map(h => [h[0], h]));

// Stability estimate for a nucleus with Z protons and N neutrons.
function stabilityOf(Z, N) {
  const A = Z + N, st = STABLE[Z] || [];
  if (st.includes(A)) return { stable: true, text: "stable" };
  if ((LONG_LIVED[Z] || []).includes(A)) return { stable: false, long: true, mode: Z > 83 ? "alpha" : ([19, 37, 49, 57, 71, 75].includes(Z) ? "beta-" : "alpha"), text: "radioactive, but lasts billions of years" };
  if (Z === 1 && N === 0) return { stable: true, text: "stable" };
  let mode;
  if (st.length) {
    const lo = Math.min(...st), hi = Math.max(...st), mid = (lo + hi) / 2;
    mode = A > hi ? "beta-" : A < lo ? "beta+" : A > mid ? "beta-" : "beta+";
  } else {
    let best = 0, bd = 1e9;
    for (let a = Z; a < Z * 3.2 + 4; a++) { const zs = a / (1.98 + 0.0155 * Math.pow(a, 2 / 3)), d = Math.abs(zs - Z); if (d < bd) { bd = d; best = a; } }
    if (Z > 83) mode = N > Z + 51.5 ? "beta-" : "alpha";
    else mode = A >= best - 1 ? "beta-" : "beta+";
  }
  if (Z === 1 && N === 0) mode = null;
  if (mode === "beta+" && Z === 1) mode = "beta-";
  return { stable: false, mode, text: "unstable" };
}
// Visible wavelength (nm) to an sRGB colour string
function nmColor(nm, a) {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = -(nm - 440) / 60; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; } else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; } else if (nm < 645) { r = 1; g = -(nm - 645) / 65; } else r = 1;
  const f = nm < 420 ? 0.3 + 0.7 * (nm - 380) / 40 : nm > 700 ? 0.3 + 0.7 * (780 - nm) / 80 : 1;
  const c = v => Math.round(255 * Math.pow(Math.max(0, v * f), 0.8));
  return "rgba(" + c(r) + "," + c(g) + "," + c(b) + "," + (a === undefined ? 1 : a) + ")";
}

/* ---------- Extra derived data ---------- */
ELEMENTS.forEach(el => {
  let core = 0; for (const n of NOBLE) if (n < el.Z) core = n;
  const co = core ? fill(core, false) : {};
  el.core = core ? ELEMENTS[core - 1].sym : "";
  el.rest = el.subs.map(k => [k, el.occ[k] - (co[k] || 0)]).filter(x => x[1] > 0);
});
const BYSYM = Object.fromEntries(ELEMENTS.map(e => [e.sym, e]));


const SLUG_FIX = {};
ELEMENTS.forEach(e => { e.slug = SLUG_FIX[e.Z] || e.name.toLowerCase().replace(/[^a-z]+/g, "-"); });
const BYSLUG = Object.fromEntries(ELEMENTS.map(e => [e.slug, e]));

export {
  RAW, ORDER, CAP, NOBLE, EXCEPT, NEUTRONS, fill, subOrder, categoryOf, positionOf, blockOf, SHELL_NAMES,
  ELEMENTS, stateAt, fmt, CATEGORIES, CAT_NAME, CAT_HUE, CRYSTAL_NAME,
  IE1, EA, OXI, CRUST, BODY, STABLE, LONG_LIVED, SPECTRA, FLAME, HAZ_DEF, HAZ, stabilityOf, nmColor, BYSYM, BYSLUG
};
