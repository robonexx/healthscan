# Your Health Scanner

By Robert "Rob-One" Wägar

A Next.js PWA for scanning product barcodes, QR codes and other common code formats.

Product barcodes are searched as product data and can show ingredients, nutrition, allergens, simple health flags and diet/preference notes. Non-product codes, such as QR links or text codes, are shown as raw scanned content.

## What is included

- Camera scanner with `html5-qrcode`
- Scan from uploaded image/file
- QR/raw code display for non-product codes
- Product lookup through the server route
- USDA FoodData Central fallback through `USDA_API_KEY`
- 30 day localStorage cache for found products
- Recent scans saved locally on the device
- Remove image button for file scans
- Simple diet/preference notes, such as keto/low-carb, low sugar, gluten, dairy/lactose, vegan and lower salt signals
- Ingredient watch list for things some users may watch, such as added sugar, sweeteners, palm oil, hydrogenated oils and preservatives

## Scanner library

This version uses `html5-qrcode` instead of ZXing directly.

It supports camera scanning, image/file scanning, QR codes and common 1D barcodes such as EAN/UPC.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Build

```bash
npm run lint
npm run type-check
npm run build
```

## Deploy on Vercel

Use Node.js 24.x in Vercel project settings.

Add your USDA key under Project Settings → Environment Variables:

```env
USDA_API_KEY=your_key_here
```

## Local env

Create `.env.local` in the project root:

```env
USDA_API_KEY=your_key_here
```

Do not expose this key in client components.

## Camera notes

This version improves camera scanning with:

- `html5-qrcode` scanner engine
- QR code support
- raw code content display for non-product codes
- image upload scanning
- rear/environment camera preference
- 1920x1080 ideal camera constraints
- barcode and QR format support
- continuous autofocus request where supported
- tap preview to refocus where supported
- zoom slider where supported
- torch/light button where supported

Browser support differs. Chrome on Android usually supports more camera controls than iOS Safari. If a device/browser does not expose focus, zoom or torch, the app falls back to normal autofocus and manual barcode input.

## Product cache and scan history

Found products are saved in browser `localStorage` for 30 days. If the same barcode is scanned again on the same device, the app loads it from saved scan instead of calling the API again.

The app also saves recent scans locally on the device so users can reopen a product quickly without an account.

## Health and diet notes

The health notes are simple signals, not medical advice. They are based on available product data, such as nutrition per 100g, allergens, labels and ingredient text.

Examples:

- High sugar / low sugar goals
- Keto or low-carb fit
- Gluten-sensitive warning
- Dairy/lactose warning
- Vegan label or possible non-vegan ingredients
- Ultra-processed signal from NOVA
- Lower salt goals

Always read the package and check with a healthcare professional for allergies, illness or strict dietary needs.
