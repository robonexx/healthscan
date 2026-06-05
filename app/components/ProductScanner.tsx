"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";

type ProductResult = {
  found: boolean;
  barcode: string;
  message?: string;
  product?: {
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
};

type DeviceOption = {
  key: string;
  deviceId: string;
  label: string;
};

function getCameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      return "Camera permission was denied. Allow camera access in the browser settings and try again.";
    }

    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "No camera was found on this device.";
    }

    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "The camera could not be started. Close Zoom/Teams/OBS or other apps using the camera and try again.";
    }

    if (error.name === "OverconstrainedError" || error.name === "ConstraintNotSatisfiedError") {
      return "The selected camera did not match the requested settings. Try another camera.";
    }
  }

  return error instanceof Error
    ? error.message
    : "Could not start camera scanner. Test on localhost or HTTPS and allow camera permission.";
}

export default function ProductScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [manualBarcode, setManualBarcode] = useState("3017620422003");
  const [productResult, setProductResult] = useState<ProductResult | null>(null);
  const [error, setError] = useState("");
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setIsScanning(false);
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
      const mappedDevices = videoInputDevices.map((device, index) => ({
        key: `${device.deviceId || device.label || "camera"}-${index}`,
        deviceId: device.deviceId,
        label: device.label || `Camera ${index + 1}`,
      }));

      setDevices(mappedDevices);

      const backCamera = mappedDevices.find((device) =>
        /back|rear|environment/i.test(device.label)
      );
      const preferredDeviceId = backCamera?.deviceId || mappedDevices[0]?.deviceId;

      if (!selectedDeviceId && preferredDeviceId) {
        setSelectedDeviceId(preferredDeviceId);
      }

      return preferredDeviceId;
    } catch {
      // Device labels often require camera permission first. Scanner can still start.
      return undefined;
    }
  }, [selectedDeviceId]);

  const fetchProduct = useCallback(async (code: string) => {
    if (!code) return;

    setError("");
    setLoadingProduct(true);
    setProductResult(null);

    try {
      const response = await fetch(`/api/product?barcode=${encodeURIComponent(code)}`);
      const data = (await response.json()) as ProductResult;
      setProductResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch product.");
    } finally {
      setLoadingProduct(false);
    }
  }, []);

  const startScanner = useCallback(async () => {
    setError("");
    setProductResult(null);

    if (!videoRef.current) {
      setError("Video element not ready.");
      return;
    }

    try {
      const preferredDeviceId = await fetchDevices();
      const deviceIdToUse = selectedDeviceId || preferredDeviceId || undefined;

      const codeReader = new BrowserMultiFormatReader();
      setIsScanning(true);

      const controls = await codeReader.decodeFromVideoDevice(
        deviceIdToUse,
        videoRef.current,
        async (result) => {
          if (!result) return;

          const scannedCode = result.getText();
          setBarcode(scannedCode);
          stopScanner();
          await fetchProduct(scannedCode);
        }
      );

      controlsRef.current = controls;
    } catch (err) {
      setIsScanning(false);
      setError(getCameraErrorMessage(err));
    }
  }, [fetchDevices, fetchProduct, selectedDeviceId, stopScanner]);

  const handleManualSearch = async () => {
    const cleanCode = manualBarcode.trim();

    if (!cleanCode) {
      setError("Write a barcode first.");
      return;
    }

    setBarcode(cleanCode);
    stopScanner();
    await fetchProduct(cleanCode);
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  return (
    <section className="scanner-card">
      <header className="scanner-header">
        <p className="eyebrow">Next.js PWA MVP</p>
        <h1>Product Scanner</h1>
        <p>
          Scan a barcode, fetch product data from Open Food Facts and show ingredients,
          nutrition, allergens and simple health flags.
        </p>
      </header>

      <div className="scanner-layout">
        <div>
          <div className="video-wrap">
            <video ref={videoRef} className="scanner-video" muted playsInline />
            {!isScanning && (
              <div className="video-placeholder">
                <span>Camera preview</span>
              </div>
            )}
            {isScanning && <div className="scan-frame" aria-hidden="true" />}
          </div>

          {devices.length > 0 && (
            <div className="camera-select">
              <label htmlFor="camera">Camera</label>
              <select
                id="camera"
                value={selectedDeviceId || ""}
                onChange={(event) => setSelectedDeviceId(event.target.value || undefined)}
                disabled={isScanning}
              >
                {devices.map((device) => (
                  <option key={device.key} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="actions">
            {!isScanning ? (
              <button type="button" onClick={startScanner}>
                Start scanner
              </button>
            ) : (
              <button type="button" onClick={stopScanner} className="secondary">
                Stop scanner
              </button>
            )}
          </div>

          <div className="manual-search">
            <label htmlFor="manualBarcode">Or test with barcode</label>
            <div>
              <input
                id="manualBarcode"
                value={manualBarcode}
                onChange={(event) => setManualBarcode(event.target.value)}
                placeholder="Example: 3017620422003"
                inputMode="numeric"
              />
              <button type="button" onClick={handleManualSearch}>
                Search
              </button>
            </div>
          </div>

          {barcode && (
            <p className="barcode">
              Last barcode: <strong>{barcode}</strong>
            </p>
          )}

          {loadingProduct && <p className="status">Loading product...</p>}
          {error && <p className="error">{error}</p>}
        </div>

        <div className="result-area">
          {!productResult && !loadingProduct && (
            <div className="empty-state">
              <h2>Ready to scan</h2>
              <p>
                Use your phone camera or search manually. Camera access needs localhost
                in dev or HTTPS in production.
              </p>
            </div>
          )}

          {productResult && !productResult.found && (
            <div className="result-card warning">
              <h2>Product not found</h2>
              <p>{productResult.message}</p>
              <p>Barcode: {productResult.barcode}</p>
            </div>
          )}

          {productResult?.found && productResult.product && (
            <ProductInfo product={productResult.product} />
          )}
        </div>
      </div>
    </section>
  );
}

function ProductInfo({
  product,
}: {
  product: NonNullable<ProductResult["product"]>;
}) {
  const healthFlags = useMemo(() => getSimpleHealthFlags(product), [product]);

  return (
    <article className="result-card">
      <div className="product-top">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image} alt={product.name} />
        ) : (
          <div className="image-fallback">No image</div>
        )}

        <div>
          <p className="eyebrow">Product found</p>
          <h2>{product.name}</h2>
          {product.brand && <p className="brand">{product.brand}</p>}
        </div>
      </div>

      <div className="score-grid">
        <ScoreItem label="Nutri-Score" value={product.nutriscore?.toUpperCase() || "N/A"} />
        <ScoreItem label="NOVA" value={product.novaGroup?.toString() || "N/A"} />
        <ScoreItem label="Sugar / 100g" value={valueOrNA(product.nutriments.sugars, "g")} />
        <ScoreItem label="Salt / 100g" value={valueOrNA(product.nutriments.salt, "g")} />
        <ScoreItem label="Calories / 100g" value={valueOrNA(product.nutriments.calories, " kcal")} />
        <ScoreItem label="Protein / 100g" value={valueOrNA(product.nutriments.protein, "g")} />
      </div>

      {healthFlags.length > 0 && (
        <div className="health-flags">
          <h3>Things to notice</h3>
          <ul>
            {healthFlags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </div>
      )}

      <InfoBlock title="Ingredients" emptyText="No ingredients found.">
        {product.ingredients}
      </InfoBlock>

      <TagBlock title="Allergens" tags={product.allergens} emptyText="No allergens listed." />
      <TagBlock title="Additives" tags={product.additives} emptyText="No additives listed." />

      <p className="disclaimer">
        This is not medical advice. Product data can be incomplete or wrong. Always
        read the package and check with a healthcare professional if you have allergies,
        illness or special dietary needs.
      </p>
    </article>
  );
}

function ScoreItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoBlock({
  title,
  children,
  emptyText,
}: {
  title: string;
  children: string;
  emptyText: string;
}) {
  return (
    <section className="info-section">
      <h3>{title}</h3>
      <p>{children || emptyText}</p>
    </section>
  );
}

function TagBlock({
  title,
  tags,
  emptyText,
}: {
  title: string;
  tags: string[];
  emptyText: string;
}) {
  return (
    <section className="info-section">
      <h3>{title}</h3>
      {tags.length > 0 ? (
        <ul>
          {tags.map((tag) => (
            <li key={tag}>{cleanTag(tag)}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </section>
  );
}

function getSimpleHealthFlags(product: NonNullable<ProductResult["product"]>) {
  const flags: string[] = [];

  if (product.novaGroup === 4) {
    flags.push("NOVA 4: This product may be ultra-processed.");
  }

  if (product.nutriscore && ["d", "e"].includes(product.nutriscore.toLowerCase())) {
    flags.push(`Nutri-Score ${product.nutriscore.toUpperCase()}: lower nutrition rating.`);
  }

  if (typeof product.nutriments.sugars === "number" && product.nutriments.sugars >= 15) {
    flags.push("High sugar level per 100g.");
  }

  if (typeof product.nutriments.salt === "number" && product.nutriments.salt >= 1.5) {
    flags.push("High salt level per 100g.");
  }

  if (product.additives.length >= 5) {
    flags.push("Contains several listed additives.");
  }

  if (product.allergens.length > 0) {
    flags.push("Contains listed allergens. Check carefully if sensitive.");
  }

  return flags;
}

function valueOrNA(value: number | null, unit: string) {
  if (typeof value !== "number") return "N/A";
  return `${value}${unit}`;
}

function cleanTag(tag: string) {
  return tag.replace(/^en:/, "").replaceAll("-", " ");
}
