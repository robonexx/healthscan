# Product Scanner PWA

A small Next.js PWA MVP for scanning food product barcodes and fetching product data from Open Food Facts.

## Stack

- Next.js 16.2.7 App Router
- React 19.2.7
- TypeScript 5.9.3
- ESLint 9.39.1
- `@zxing/browser` 0.2.0 for barcode scanning
- Open Food Facts API
- PWA manifest + service worker
- No login
- No database
- No API key needed

## Node version

This project is set to Node 24 because the latest ZXing dependency expects Node 24+ during install.

Vercel supports Node 24 and uses it by default for new projects. If needed, set it manually in Vercel:

```txt
Project Settings → Build and Deployment → Node.js Version → 24.x
```

## Run locally

```bash
npm install
npm run dev
```

Open:

```txt
http://localhost:3000
```

Camera access should work on `localhost`. On mobile or production it must run on HTTPS, so Vercel is good for testing.

## Build

```bash
npm run build
npm run start
```

## Lint and type-check

Next.js 16 removed `next lint`, so this project uses the ESLint CLI directly.

```bash
npm run lint
npm run type-check
```

This zip was checked with:

```bash
npm run lint
npm run type-check
npm run build
```

## Test without camera

Use the manual barcode field with:

```txt
3017620422003
```

## API key

No API key is needed for the current Open Food Facts API call.

Before a real launch, update the `User-Agent` in:

```txt
app/api/product/route.ts
```

Example:

```ts
"User-Agent": "YourAppName/0.1 (your@email.com)"
```

## Fixed in this version

- Fixed Vercel/TypeScript manifest error by replacing `purpose: "any maskable"` with separate `any` and `maskable` icon entries.
- Fixed camera device list keys.
- Fixed ESLint rule issue caused by setting state from the initial effect.
- Added clearer camera permission error messages.
- Updated package versions and included `package-lock.json`.

## Notes

Product data can be incomplete or wrong because Open Food Facts is an open/crowdsourced database. Always show a disclaimer and do not present the result as medical advice.
