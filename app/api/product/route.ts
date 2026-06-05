import { NextRequest, NextResponse } from "next/server";

type NormalizedProduct = {
  code: string;
  name: string;
  brand: string;
  image: string;
  ingredients: string;
  allergens: string[];
  additives: string[];
  nutriscore: string | null;
  novaGroup: number | null;
  ecoscore: string | null;
  labels: string[];
  categories: string[];
  nutriments: {
    calories: number | null;
    fat: number | null;
    saturatedFat: number | null;
    carbs: number | null;
    sugars: number | null;
    protein: number | null;
    salt: number | null;
    fiber: number | null;
  };
};

type OpenFoodFactsResponse = {
  status: number;
  status_verbose?: string;
  product?: {
    code?: string;
    product_name?: string;
    product_name_en?: string;
    brands?: string;
    image_front_url?: string;
    image_url?: string;
    ingredients_text?: string;
    ingredients_text_en?: string;
    allergens_tags?: string[];
    additives_tags?: string[];
    nutriscore_grade?: string;
    nova_group?: number;
    ecoscore_grade?: string;
    labels_tags?: string[];
    categories_tags?: string[];
    nutriments?: {
      energy_kcal_100g?: number;
      fat_100g?: number;
      saturated_fat_100g?: number;
      carbohydrates_100g?: number;
      sugars_100g?: number;
      proteins_100g?: number;
      salt_100g?: number;
      fiber_100g?: number;
    };
  };
};

type UsdaFood = {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  ingredients?: string;
  foodNutrients?: Array<{
    nutrientName?: string;
    nutrientNumber?: string;
    unitName?: string;
    value?: number;
  }>;
};

type UsdaSearchResponse = {
  foods?: UsdaFood[];
};

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function stripLeadingZeros(value: string) {
  return normalizeDigits(value).replace(/^0+/, "");
}

function numbersMatch(a: string, b: string) {
  const cleanA = normalizeDigits(a);
  const cleanB = normalizeDigits(b);

  if (!cleanA || !cleanB) return false;
  if (cleanA === cleanB) return true;

  return stripLeadingZeros(cleanA) === stripLeadingZeros(cleanB);
}

function getNutrient(food: UsdaFood, names: string[], numbers: string[] = []) {
  const nutrient = food.foodNutrients?.find((item) => {
    const name = item.nutrientName?.toLowerCase() || "";
    const number = item.nutrientNumber || "";

    return (
      names.some((target) => name.includes(target.toLowerCase())) ||
      numbers.includes(number)
    );
  });

  return typeof nutrient?.value === "number" ? nutrient.value : null;
}

function mapOpenFoodFactsProduct(
  barcode: string,
  product: NonNullable<OpenFoodFactsResponse["product"]>,
): NormalizedProduct {
  return {
    code: product.code || barcode,
    name: product.product_name || product.product_name_en || "Unknown product",
    brand: product.brands || "",
    image: product.image_front_url || product.image_url || "",
    ingredients: product.ingredients_text || product.ingredients_text_en || "",
    allergens: product.allergens_tags || [],
    additives: product.additives_tags || [],
    nutriscore: product.nutriscore_grade || null,
    novaGroup: product.nova_group || null,
    ecoscore: product.ecoscore_grade || null,
    labels: product.labels_tags || [],
    categories: product.categories_tags || [],
    nutriments: {
      calories: product.nutriments?.energy_kcal_100g ?? null,
      fat: product.nutriments?.fat_100g ?? null,
      saturatedFat: product.nutriments?.saturated_fat_100g ?? null,
      carbs: product.nutriments?.carbohydrates_100g ?? null,
      sugars: product.nutriments?.sugars_100g ?? null,
      protein: product.nutriments?.proteins_100g ?? null,
      salt: product.nutriments?.salt_100g ?? null,
      fiber: product.nutriments?.fiber_100g ?? null,
    },
  };
}

function mapUsdaProduct(barcode: string, food: UsdaFood): NormalizedProduct {
  const sodiumMg = getNutrient(food, ["sodium"], ["1093"]);
  const salt = typeof sodiumMg === "number" ? Number(((sodiumMg * 2.5) / 1000).toFixed(3)) : null;

  return {
    code: food.gtinUpc || barcode,
    name: food.description || "Unknown product",
    brand: food.brandName || food.brandOwner || "",
    image: "",
    ingredients: food.ingredients || "",
    allergens: [],
    additives: [],
    nutriscore: null,
    novaGroup: null,
    ecoscore: null,
    labels: ["usda-branded-food"],
    categories: [],
    nutriments: {
      calories: getNutrient(food, ["energy"], ["1008"]),
      fat: getNutrient(food, ["total lipid", "total fat"], ["1004"]),
      saturatedFat: getNutrient(food, ["saturated"], ["1258"]),
      carbs: getNutrient(food, ["carbohydrate"], ["1005"]),
      sugars: getNutrient(food, ["sugars"], ["2000"]),
      protein: getNutrient(food, ["protein"], ["1003"]),
      salt,
      fiber: getNutrient(food, ["fiber"], ["1079"]),
    },
  };
}

async function searchOpenFoodFacts(barcode: string) {
  const fields = [
    "code",
    "product_name",
    "product_name_en",
    "brands",
    "image_front_url",
    "image_url",
    "ingredients_text",
    "ingredients_text_en",
    "allergens_tags",
    "additives_tags",
    "nutriscore_grade",
    "nova_group",
    "ecoscore_grade",
    "labels_tags",
    "categories_tags",
    "nutriments",
  ].join(",");

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
    barcode,
  )}.json?fields=${fields}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "YourHealthScanner/0.7 (robertwagar@gmail.com)",
    },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as OpenFoodFactsResponse;

  if (data.status !== 1 || !data.product) return null;

  return mapOpenFoodFactsProduct(barcode, data.product);
}

async function searchUsda(barcode: string) {
  const apiKey = process.env.USDA_API_KEY;

  if (!apiKey) return null;

  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", barcode);
  url.searchParams.set("dataType", "Branded");
  url.searchParams.set("pageSize", "10");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "YourHealthScanner/0.7 (robertwagar@gmail.com)",
    },
    next: { revalidate: 60 * 60 * 24 * 7 },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as UsdaSearchResponse;
  const foods = data.foods || [];

  const exactMatch = foods.find((food) =>
    food.gtinUpc ? numbersMatch(food.gtinUpc, barcode) : false,
  );

  const bestCandidate = exactMatch || foods.find((food) => food.gtinUpc) || null;

  if (!bestCandidate) return null;

  return mapUsdaProduct(barcode, bestCandidate);
}

export async function GET(request: NextRequest) {
  const barcode = request.nextUrl.searchParams.get("barcode")?.trim();

  if (!barcode) {
    return NextResponse.json({ message: "Barcode is required." }, { status: 400 });
  }

  try {
    const openFoodFactsProduct = await searchOpenFoodFacts(barcode);

    if (openFoodFactsProduct) {
      return NextResponse.json({
        found: true,
        barcode,
        source: "open-food-facts",
        product: openFoodFactsProduct,
      });
    }

    const usdaProduct = await searchUsda(barcode);

    if (usdaProduct) {
      return NextResponse.json({
        found: true,
        barcode,
        source: "usda",
        product: usdaProduct,
      });
    }

    return NextResponse.json(
      {
        found: false,
        barcode,
        source: "none",
        message: "Product not found.",
      },
      { status: 404 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        found: false,
        barcode,
        source: "error",
        message: "Something went wrong.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
