import { NextRequest, NextResponse } from "next/server";

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
    allergens?: string;
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

export async function GET(request: NextRequest) {
  const barcode = request.nextUrl.searchParams.get("barcode")?.trim();

  if (!barcode) {
    return NextResponse.json({ message: "Barcode is required." }, { status: 400 });
  }

  try {
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
      barcode
    )}.json?fields=${fields}`;

    const response = await fetch(url, {
      headers: {
        // Change this before real launch to your own app name/email.
        "User-Agent": "ProductScannerPWA/0.1 (test@example.com)",
      },
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { found: false, barcode, message: "Could not fetch product." },
        { status: response.status }
      );
    }

    const data = (await response.json()) as OpenFoodFactsResponse;

    if (data.status !== 1 || !data.product) {
      return NextResponse.json(
        { found: false, barcode, message: "Product not found in Open Food Facts." },
        { status: 404 }
      );
    }

    const product = data.product;

    return NextResponse.json({
      found: true,
      barcode,
      product: {
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
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        found: false,
        barcode,
        message: "Something went wrong.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
