export type AdditiveLevel = "common" | "watch" | "sensitive";

export type AdditiveInfo = {
  code: string;
  name: string;
  category: string;
  description: string;
  note?: string;
  level: AdditiveLevel;
  aliases?: string[];
};

export const ADDITIVES: Record<string, AdditiveInfo> = {
  e100: {
    code: "E100",
    name: "Curcumin",
    category: "Colour",
    description: "Yellow colour from turmeric, used to add colour to foods.",
    level: "common",
    aliases: ["curcumin", "turmeric"],
  },
  e101: {
    code: "E101",
    name: "Riboflavins",
    category: "Colour / vitamin",
    description: "Yellow-orange colour related to vitamin B2.",
    level: "common",
    aliases: ["riboflavin", "vitamin b2"],
  },
  e120: {
    code: "E120",
    name: "Cochineal / carmine",
    category: "Colour",
    description: "Red colour made from insects. Some people avoid it for vegan, vegetarian or allergy reasons.",
    note: "Not vegan. Can matter for people avoiding animal-derived colours.",
    level: "sensitive",
    aliases: ["carmine", "cochineal", "carminic acid"],
  },
  e150a: {
    code: "E150a",
    name: "Plain caramel",
    category: "Colour",
    description: "Brown caramel colour used in drinks, sauces and processed foods.",
    level: "common",
    aliases: ["plain caramel", "caramel colour", "caramel color"],
  },
  e150c: {
    code: "E150c",
    name: "Ammonia caramel",
    category: "Colour",
    description: "Brown caramel colour used in some drinks and processed foods.",
    level: "watch",
    aliases: ["ammonia caramel"],
  },
  e150d: {
    code: "E150d",
    name: "Sulphite ammonia caramel",
    category: "Colour",
    description: "Dark caramel colour often used in soft drinks and sauces.",
    level: "watch",
    aliases: ["sulphite ammonia caramel", "sulfite ammonia caramel"],
  },
  e160a: {
    code: "E160a",
    name: "Carotenes / beta-carotene",
    category: "Colour",
    description: "Orange-yellow colour, often derived from plant pigments.",
    level: "common",
    aliases: ["beta-carotene", "carotenes"],
  },
  e162: {
    code: "E162",
    name: "Beetroot red",
    category: "Colour",
    description: "Red/purple colour from beetroot.",
    level: "common",
    aliases: ["beetroot red", "betanin"],
  },
  e200: {
    code: "E200",
    name: "Sorbic acid",
    category: "Preservative",
    description: "Preservative used to slow growth of mould and yeast.",
    level: "common",
    aliases: ["sorbic acid"],
  },
  e202: {
    code: "E202",
    name: "Potassium sorbate",
    category: "Preservative",
    description: "Common preservative used to slow mould and yeast growth.",
    level: "watch",
    aliases: ["potassium sorbate"],
  },
  e211: {
    code: "E211",
    name: "Sodium benzoate",
    category: "Preservative",
    description: "Preservative often used in acidic drinks and sauces.",
    note: "Some people choose to watch benzoates, especially in soft drinks and highly processed foods.",
    level: "watch",
    aliases: ["sodium benzoate"],
  },
  e220: {
    code: "E220",
    name: "Sulphur dioxide",
    category: "Preservative / antioxidant",
    description: "Used to preserve colour and freshness, especially in dried fruit and drinks.",
    note: "Sulphites can be relevant for sensitive people and asthmatics.",
    level: "sensitive",
    aliases: ["sulphur dioxide", "sulfur dioxide", "sulphites", "sulfites"],
  },
  e223: {
    code: "E223",
    name: "Sodium metabisulphite",
    category: "Preservative / antioxidant",
    description: "Sulphite preservative used to prevent browning and spoilage.",
    note: "Sulphites can be relevant for sensitive people and asthmatics.",
    level: "sensitive",
    aliases: ["sodium metabisulphite", "sodium metabisulfite"],
  },
  e250: {
    code: "E250",
    name: "Sodium nitrite",
    category: "Preservative",
    description: "Preservative used mainly in cured meats to protect colour and inhibit bacteria.",
    note: "Often watched by people reducing processed meats or nitrite intake.",
    level: "watch",
    aliases: ["sodium nitrite", "nitrite"],
  },
  e251: {
    code: "E251",
    name: "Sodium nitrate",
    category: "Preservative",
    description: "Preservative used in some cured foods.",
    level: "watch",
    aliases: ["sodium nitrate", "nitrate"],
  },
  e260: {
    code: "E260",
    name: "Acetic acid",
    category: "Acidity regulator",
    description: "Main acid in vinegar, used for acidity and preservation.",
    level: "common",
    aliases: ["acetic acid"],
  },
  e270: {
    code: "E270",
    name: "Lactic acid",
    category: "Acidity regulator",
    description: "Acid used for flavour and acidity. Can be produced by fermentation.",
    level: "common",
    aliases: ["lactic acid"],
  },
  e300: {
    code: "E300",
    name: "Ascorbic acid",
    category: "Antioxidant",
    description: "Vitamin C, used to protect food from oxidation and browning.",
    level: "common",
    aliases: ["ascorbic acid", "vitamin c"],
  },
  e301: {
    code: "E301",
    name: "Sodium ascorbate",
    category: "Antioxidant",
    description: "Salt of vitamin C used as an antioxidant.",
    level: "common",
    aliases: ["sodium ascorbate"],
  },
  e322: {
    code: "E322",
    name: "Lecithins",
    category: "Emulsifier",
    description: "Helps fat and water mix. Often from soy, sunflower or egg.",
    note: "Check source if you avoid soy, egg or animal-derived ingredients.",
    level: "common",
    aliases: ["lecithin", "lecithins", "soy lecithin", "sunflower lecithin"],
  },
  e330: {
    code: "E330",
    name: "Citric acid",
    category: "Acidity regulator",
    description: "Common acidity regulator used to add sour taste and help preserve freshness.",
    level: "common",
    aliases: ["citric acid"],
  },
  e331: {
    code: "E331",
    name: "Sodium citrates",
    category: "Acidity regulator",
    description: "Citrate salts used to control acidity and improve texture.",
    level: "common",
    aliases: ["sodium citrate", "sodium citrates"],
  },
  e407: {
    code: "E407",
    name: "Carrageenan",
    category: "Thickener / stabiliser",
    description: "Seaweed-derived thickener used in dairy alternatives, desserts and processed foods.",
    note: "Some people with sensitive digestion choose to avoid carrageenan.",
    level: "watch",
    aliases: ["carrageenan"],
  },
  e410: {
    code: "E410",
    name: "Locust bean gum",
    category: "Thickener / stabiliser",
    description: "Plant gum used to thicken and stabilise foods.",
    level: "common",
    aliases: ["locust bean gum", "carob gum"],
  },
  e412: {
    code: "E412",
    name: "Guar gum",
    category: "Thickener / stabiliser",
    description: "Plant gum used to thicken and improve texture.",
    level: "common",
    aliases: ["guar gum"],
  },
  e415: {
    code: "E415",
    name: "Xanthan gum",
    category: "Thickener / stabiliser",
    description: "Fermentation-derived gum used to thicken and stabilise foods.",
    level: "common",
    aliases: ["xanthan gum"],
  },
  e440: {
    code: "E440",
    name: "Pectins",
    category: "Gelling agent",
    description: "Plant fibre used to gel jams and improve texture.",
    level: "common",
    aliases: ["pectin", "pectins"],
  },
  e450: {
    code: "E450",
    name: "Diphosphates",
    category: "Raising agent / stabiliser",
    description: "Phosphate additive used in baked goods and processed foods for texture or raising.",
    level: "watch",
    aliases: ["diphosphate", "diphosphates"],
  },
  e471: {
    code: "E471",
    name: "Mono- and diglycerides of fatty acids",
    category: "Emulsifier",
    description: "Emulsifier used to improve texture and help ingredients mix.",
    note: "Can be plant- or animal-derived; check vegan status if this matters.",
    level: "watch",
    aliases: ["mono- and diglycerides", "mono and diglycerides", "monoglycerides", "diglycerides"],
  },
  e472e: {
    code: "E472e",
    name: "DATEM",
    category: "Emulsifier",
    description: "Emulsifier often used in bread and baked goods to improve dough texture.",
    level: "watch",
    aliases: ["datem", "diacetyltartaric"],
  },
  e500: {
    code: "E500",
    name: "Sodium carbonates",
    category: "Raising agent / acidity regulator",
    description: "Includes baking soda and related compounds used for raising and pH control.",
    level: "common",
    aliases: ["sodium carbonate", "sodium bicarbonate", "baking soda"],
  },
  e621: {
    code: "E621",
    name: "Monosodium glutamate",
    category: "Flavour enhancer",
    description: "Flavour enhancer that adds savoury umami taste.",
    note: "Some people choose to watch flavour enhancers like MSG.",
    level: "watch",
    aliases: ["monosodium glutamate", "msg"],
  },
  e950: {
    code: "E950",
    name: "Acesulfame K",
    category: "Sweetener",
    description: "Artificial sweetener used in low-sugar drinks and foods.",
    level: "watch",
    aliases: ["acesulfame k", "acesulfame potassium"],
  },
  e951: {
    code: "E951",
    name: "Aspartame",
    category: "Sweetener",
    description: "Artificial sweetener used in many sugar-free products.",
    note: "Not suitable for people with PKU. Many people also watch artificial sweeteners by preference.",
    level: "sensitive",
    aliases: ["aspartame"],
  },
  e955: {
    code: "E955",
    name: "Sucralose",
    category: "Sweetener",
    description: "Artificial sweetener used in low-sugar foods and drinks.",
    level: "watch",
    aliases: ["sucralose"],
  },
  e960: {
    code: "E960",
    name: "Steviol glycosides",
    category: "Sweetener",
    description: "Sweetener from stevia leaves, used in reduced-sugar products.",
    level: "common",
    aliases: ["steviol glycosides", "stevia"],
  },
};

export function normalizeAdditiveKey(value: string) {
  return value
    .toLowerCase()
    .replace(/^en:/, "")
    .replace(/\s+/g, "")
    .replace(/-/g, "");
}

export function getAdditiveInfo(value: string) {
  return ADDITIVES[normalizeAdditiveKey(value)] || null;
}

export function findAdditivesInText(text: string) {
  const found = new Set<string>();
  const lowerText = text.toLowerCase();

  const eNumberMatches = lowerText.match(/\be\s*-?\s*\d{3}[a-z]?\b/g) || [];
  for (const match of eNumberMatches) {
    const key = normalizeAdditiveKey(match);
    if (ADDITIVES[key]) found.add(key);
  }

  for (const [key, info] of Object.entries(ADDITIVES)) {
    for (const alias of info.aliases || []) {
      if (lowerText.includes(alias.toLowerCase())) {
        found.add(key);
      }
    }
  }

  return Array.from(found).map((key) => ADDITIVES[key]);
}
