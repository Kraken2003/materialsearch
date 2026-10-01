const symbols = ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr ' +
  'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu ' +
  'Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' ');
const names = [
 'Hydrogen Helium Lithium Beryllium Boron Carbon Nitrogen Oxygen Fluorine Neon',
 'Sodium Magnesium Aluminium Silicon Phosphorus Sulfur Chlorine Argon',
 'Potassium Calcium Scandium Titanium Vanadium Chromium Manganese Iron Cobalt Nickel Copper Zinc Gallium Germanium Arsenic Selenium Bromine Krypton',
 'Rubidium Strontium Yttrium Zirconium Niobium Molybdenum Technetium Ruthenium Rhodium Palladium Silver Cadmium Indium Tin Antimony Tellurium Iodine Xenon',
 'Caesium Barium Lanthanum Cerium Praseodymium Neodymium Promethium Samarium Europium Gadolinium Terbium Dysprosium Holmium Erbium Thulium Ytterbium Lutetium',
 'Hafnium Tantalum Tungsten Rhenium Osmium Iridium Platinum Gold Mercury Thallium Lead Bismuth Polonium Astatine Radon',
 'Francium Radium Actinium Thorium Protactinium Uranium',
 'Neptunium Plutonium Americium Curium Berkelium Californium Einsteinium Fermium Mendelevium Nobelium Lawrencium',
 'Rutherfordium Dubnium Seaborgium Bohrium Hassium Meitnerium Darmstadtium Roentgenium Copernicium Nihonium Flerovium Moscovium Livermorium Tennessine Oganesson',
].join(' ').split(' ');
const rows = [
 'H . . . . . . . . . . . . . . . . He',
 'Li Be . . . . . . . . . . B C N O F Ne',
 'Na Mg . . . . . . . . . . Al Si P S Cl Ar',
 'K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr',
 'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe',
 'Cs Ba * Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn',
 'Fr Ra ** Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og',
 '. . . La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu',
 '. . . Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr',
];
function category(symbol: string, number: number) {
 if (number >= 57 && number <= 71) return 'lanthanide';
 if (number >= 89 && number <= 103) return 'actinide';
 if ('He Ne Ar Kr Xe Rn Og'.split(' ').includes(symbol)) return 'noble';
 if ('F Cl Br I At Ts'.split(' ').includes(symbol)) return 'halogen';
 if ('Li Na K Rb Cs Fr'.split(' ').includes(symbol)) return 'alkali';
 if ('Be Mg Ca Sr Ba Ra'.split(' ').includes(symbol)) return 'alkaline';
 if ('H C N O P S Se'.split(' ').includes(symbol)) return 'nonmetal';
 if ('B Si Ge As Sb Te'.split(' ').includes(symbol)) return 'metalloid';
 if ('Al Ga In Sn Tl Pb Bi Po Nh Fl Mc Lv'.split(' ').includes(symbol)) return 'postmetal';
 return 'transition';
}
export const ELEMENTS = symbols.map((symbol, i) => {
 const row = rows.findIndex(row => row.split(' ').includes(symbol));
 return { symbol, number: i+1, name: names[i], row: row+1, column: rows[row].split(' ').indexOf(symbol)+1, category: category(symbol, i+1) };
});
export const ELEMENT_MAP = new Map(ELEMENTS.map(e => [e.symbol, e]));
