# Your Health Scanner

By Robert "Rob-One" Wägar.

A small Next.js PWA that lets a user scan a product barcode, search product data and show ingredients, nutrition, allergens and simple health flags.

## Run locally

```bash
npm install
npm run dev
```

Open:

```txt
http://localhost:3000
```

## Build

```bash
npm run build
npm run start
```

## Deploy to Vercel

Use the default Next.js preset.

Recommended Node version: **24.x**.

## API keys

No API key is needed for this first version.

The app uses a server-side Next.js API route:

```txt
/app/api/product/route.ts
```

That route searches public product data by barcode. The browser never calls the external product API directly.

## Libraries

Main dependencies:

```txt
next
react
react-dom
@zxing/browser
@zxing/library
typescript
eslint
eslint-config-next
```

## Notes

Camera access requires localhost during development or HTTPS in production. Vercel provides HTTPS automatically.

Product data can be incomplete. Always read the package label and use the app as guidance, not medical advice.
