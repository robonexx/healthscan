# Product Scanner PWA

A first MVP for scanning product barcodes with a Next.js PWA.

## What it does

- Uses the phone/browser camera to scan barcodes
- Uses `@zxing/browser` for barcode scanning
- Fetches product data from Open Food Facts
- Shows product image, name, ingredients, allergens, additives, Nutri-Score, NOVA and nutrition values
- Includes an installable PWA manifest and a small production service worker
- No login, no database and no API key required for this first version

## Setup

```bash
npm install
npm run dev
```

Open:

```txt
http://localhost:3000
```

Camera access works on `localhost` in development. In production, deploy to HTTPS, for example Vercel.

The service worker registers only in production mode, so test the PWA install/offline behavior with:

```bash
npm run build
npm run start
```

The service worker registers only in production mode, so test the PWA install/offline behavior with:

```bash
npm run build
npm run start
```

## Test without camera

Use this barcode in the manual input:

```txt
3017620422003
```

## API key

Open Food Facts does not require an API key for basic product reads, but they ask apps to send a clear custom `User-Agent`.

In `app/api/product/route.ts`, change this before a real launch:

```ts
"User-Agent": "ProductScannerPWA/0.1 (test@example.com)"
```

to something with your real app name and contact email.

## Main libraries

- Next.js
- React
- TypeScript
- @zxing/browser

## Next steps

- Add localStorage scan history
- Add Swedish UI texts
- Add better risk/ingredient scoring
- Add Open Beauty Facts support
- Add user avoid-list, for example gluten, milk, high sugar, additives
- Add login only when you want saved profiles or cloud history
