"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CameraDevice,
  Html5Qrcode,
  Html5QrcodeResult,
} from "html5-qrcode";

type ProductResult = {
  found: boolean;
  barcode: string;
  source?: string;
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

type ScannedContent = {
  value: string;
  format: string;
  isProductCode: boolean;
  isUrl: boolean;
};

type ExtendedCameraCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  zoom?: {
    min?: number;
    max?: number;
    step?: number;
  };
  focusMode?: string[];
};

type ExtendedVideoConstraints = MediaTrackConstraints & {
  advanced?: Array<Record<string, unknown>>;
};

const SCANNER_REGION_ID = "health-scanner-camera-region";
const PRODUCT_CACHE_PREFIX = "your-health-scanner:product:";
const PRODUCT_CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

type CachedProductResult = {
  savedAt: number;
  data: ProductResult;
};

function getProductCacheKey(code: string) {
  return `${PRODUCT_CACHE_PREFIX}${code.trim()}`;
}

function readCachedProduct(code: string) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getProductCacheKey(code));
    if (!raw) return null;

    const cached = JSON.parse(raw) as CachedProductResult;
    const isFresh = Date.now() - cached.savedAt < PRODUCT_CACHE_MAX_AGE;

    if (!isFresh) {
      window.localStorage.removeItem(getProductCacheKey(code));
      return null;
    }

    return cached.data;
  } catch {
    return null;
  }
}

function writeCachedProduct(code: string, data: ProductResult) {
  if (typeof window === "undefined" || !data.found) return;

  try {
    const cacheItem: CachedProductResult = {
      savedAt: Date.now(),
      data,
    };

    window.localStorage.setItem(
      getProductCacheKey(code),
      JSON.stringify(cacheItem),
    );
  } catch {
    // localStorage can be full or blocked. The app still works without cache.
  }
}

function getCameraErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (/NotAllowed|Permission|denied/i.test(message)) {
    return "Camera access was denied. Allow camera access in your browser settings and try again.";
  }

  if (/NotFound|DevicesNotFound/i.test(message)) {
    return "No camera was found on this device.";
  }

  if (/NotReadable|TrackStart/i.test(message)) {
    return "The camera could not be started. Close other apps using the camera and try again.";
  }

  if (/Overconstrained|Constraint/i.test(message)) {
    return "The selected camera could not use the requested settings. Try another camera or lower the zoom.";
  }

  return message || "Could not start the camera. Allow camera access and try again.";
}

function isLikelyProductBarcode(value: string) {
  const clean = value.trim();
  return /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(clean);
}

function isLikelyUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getFormatName(result?: Html5QrcodeResult) {
  return result?.result?.format?.formatName || "Unknown format";
}

export default function ProductScanner() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isHandlingScanRef = useRef(false);

  const [isScanning, setIsScanning] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");
  const [productResult, setProductResult] = useState<ProductResult | null>(
    null,
  );
  const [scannedContent, setScannedContent] = useState<ScannedContent | null>(
    null,
  );
  const [error, setError] = useState("");
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(
    undefined,
  );
  const [scanStatus, setScanStatus] = useState("Ready to scan.");
  const [focusStatus, setFocusStatus] = useState("");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomMin, setZoomMin] = useState(1);
  const [zoomMax, setZoomMax] = useState(1);
  const [zoomStep, setZoomStep] = useState(0.1);
  const [selectedFileName, setSelectedFileName] = useState("");

  const resetCameraControls = useCallback(() => {
    setTorchSupported(false);
    setTorchOn(false);
    setZoomSupported(false);
    setZoom(1);
    setZoomMin(1);
    setZoomMax(1);
    setZoomStep(0.1);
    setFocusStatus("");
  }, []);

  const getOrCreateScanner = useCallback(async () => {
    if (scannerRef.current) {
      return scannerRef.current;
    }

    const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
      "html5-qrcode"
    );

    const scanner = new Html5Qrcode(SCANNER_REGION_ID, {
      verbose: false,
      useBarCodeDetectorIfSupported: true,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
        Html5QrcodeSupportedFormats.PDF_417,
      ],
    });

    scannerRef.current = scanner;
    return scanner;
  }, []);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;

    if (scanner?.isScanning) {
      try {
        await scanner.stop();
      } catch {
        // Scanner may already be stopped by the browser or by a previous event.
      }
    }

    try {
      scanner?.clear();
    } catch {
      // Clear can fail if scanner is still transitioning. Safe to ignore.
    }

    isHandlingScanRef.current = false;
    setIsScanning(false);
    setScanStatus("Scanner stopped.");
    resetCameraControls();
  }, [resetCameraControls]);

  const fetchDevices = useCallback(async () => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const videoInputDevices = (await Html5Qrcode.getCameras()) as CameraDevice[];
      const mappedDevices = videoInputDevices.map((device, index) => ({
        key: `${device.id || device.label || "camera"}-${index}`,
        deviceId: device.id,
        label: device.label || `Camera ${index + 1}`,
      }));

      setDevices(mappedDevices);

      const backCamera = mappedDevices.find((device) =>
        /back|rear|environment|bak|baksida/i.test(device.label),
      );
      const preferredDeviceId =
        backCamera?.deviceId || mappedDevices[0]?.deviceId;

      if (!selectedDeviceId && preferredDeviceId) {
        setSelectedDeviceId(preferredDeviceId);
      }

      return preferredDeviceId;
    } catch {
      return undefined;
    }
  }, [selectedDeviceId]);

  const fetchProduct = useCallback(async (code: string) => {
    const cleanCode = code.trim();

    if (!cleanCode) return;

    setError("");
    setProductResult(null);

    const cachedProduct = readCachedProduct(cleanCode);

    if (cachedProduct) {
      setProductResult(cachedProduct);
      setScanStatus("Product loaded from saved scan.");
      return;
    }

    setLoadingProduct(true);

    try {
      const response = await fetch(
        `/api/product?barcode=${encodeURIComponent(cleanCode)}`,
      );
      const data = (await response.json()) as ProductResult;
      setProductResult(data);

      if (data.found) {
        writeCachedProduct(cleanCode, data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not search product.");
    } finally {
      setLoadingProduct(false);
    }
  }, []);

  const handleDecodedValue = useCallback(
    async (value: string, result?: Html5QrcodeResult) => {
      const cleanValue = value.trim();
      if (!cleanValue || isHandlingScanRef.current) return;

      isHandlingScanRef.current = true;
      const productCode = isLikelyProductBarcode(cleanValue);
      const url = isLikelyUrl(cleanValue);
      const format = getFormatName(result);

      setScannedContent({
        value: cleanValue,
        format,
        isProductCode: productCode,
        isUrl: url,
      });
      setBarcode(cleanValue);
      setScanStatus(`${format} found.`);

      await stopScanner();

      if (productCode) {
        setScanStatus(`Barcode found: ${cleanValue}. Searching...`);
        await fetchProduct(cleanValue);
        return;
      }

      setProductResult(null);
      setScanStatus("Code scanned. Raw content is shown below.");
    },
    [fetchProduct, stopScanner],
  );

  const readCameraCapabilities = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner?.isScanning) return;

    try {
      const capabilities =
        scanner.getRunningTrackCapabilities() as ExtendedCameraCapabilities;
      const settings = scanner.getRunningTrackSettings() as MediaTrackSettings & {
        zoom?: number;
      };

      if (capabilities.torch) {
        setTorchSupported(true);
      }

      if (capabilities.zoom?.min && capabilities.zoom?.max) {
        const min = capabilities.zoom.min;
        const max = capabilities.zoom.max;
        const step = capabilities.zoom.step || 0.1;
        const currentZoom = settings.zoom || Math.min(Math.max(1.4, min), max);

        setZoomSupported(max > min);
        setZoomMin(min);
        setZoomMax(max);
        setZoomStep(step);
        setZoom(currentZoom);

        if (max > min && currentZoom !== settings.zoom) {
          await scanner.applyVideoConstraints({
            advanced: [{ zoom: currentZoom }],
          } as ExtendedVideoConstraints);
        }
      }

      if (capabilities.focusMode?.includes("continuous")) {
        await scanner.applyVideoConstraints({
          advanced: [{ focusMode: "continuous" }],
        } as ExtendedVideoConstraints);
        setFocusStatus("Autofocus is active. Tap the camera preview to refocus.");
        return;
      }

      if (capabilities.focusMode?.includes("single-shot")) {
        setFocusStatus("Tap the camera preview to refocus.");
        return;
      }

      setFocusStatus(
        "Tip: move slowly closer or farther away until the barcode becomes sharp.",
      );
    } catch {
      setFocusStatus(
        "Tip: use strong light and move slowly until the barcode becomes sharp.",
      );
    }
  }, []);

  const tryRefocus = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!isScanning || !scanner?.isScanning) return;

    try {
      const capabilities =
        scanner.getRunningTrackCapabilities() as ExtendedCameraCapabilities;
      setFocusStatus("Refocusing...");

      if (capabilities.focusMode?.includes("single-shot")) {
        await scanner.applyVideoConstraints({
          advanced: [{ focusMode: "single-shot" }],
        } as ExtendedVideoConstraints);
        setFocusStatus("Refocus requested. Hold the code still.");
        return;
      }

      if (capabilities.focusMode?.includes("continuous")) {
        await scanner.applyVideoConstraints({
          advanced: [{ focusMode: "continuous" }],
        } as ExtendedVideoConstraints);
        setFocusStatus("Autofocus refreshed. Hold the code inside the frame.");
        return;
      }
    } catch {
      // Fall through to friendly message below.
    }

    setFocusStatus(
      "This browser does not expose manual focus. Try better light or move a little farther away.",
    );
  }, [isScanning]);

  const applyZoom = useCallback(async (nextZoom: number) => {
    const scanner = scannerRef.current;
    const cleanZoom = Number(nextZoom.toFixed(2));

    setZoom(cleanZoom);

    if (!scanner?.isScanning) return;

    try {
      await scanner.applyVideoConstraints({
        advanced: [{ zoom: cleanZoom }],
      } as ExtendedVideoConstraints);
    } catch {
      setFocusStatus("Zoom could not be changed on this camera.");
    }
  }, []);

  const toggleTorch = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner?.isScanning) return;

    const nextTorch = !torchOn;

    try {
      await scanner.applyVideoConstraints({
        advanced: [{ torch: nextTorch }],
      } as ExtendedVideoConstraints);
      setTorchOn(nextTorch);
    } catch {
      setFocusStatus("Light could not be changed on this camera.");
    }
  }, [torchOn]);

  const startScanner = useCallback(async () => {
    setError("");
    setProductResult(null);
    setScannedContent(null);
    resetCameraControls();
    isHandlingScanRef.current = false;

    try {
      const scanner = await getOrCreateScanner();
      if (scanner.isScanning) {
        await scanner.stop();
      }

      const preferredDeviceId = await fetchDevices();
      const deviceIdToUse = selectedDeviceId || preferredDeviceId;

      const videoConstraints: ExtendedVideoConstraints = deviceIdToUse
        ? {
            deviceId: { exact: deviceIdToUse },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
            advanced: [
              { focusMode: "continuous" },
              { exposureMode: "continuous" },
              { whiteBalanceMode: "continuous" },
            ],
          }
        : {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
            advanced: [
              { focusMode: "continuous" },
              { exposureMode: "continuous" },
              { whiteBalanceMode: "continuous" },
            ],
          };

      setIsScanning(true);
      setScanStatus("Point the camera at a barcode or QR code.");
      setFocusStatus("Starting camera focus...");

      await scanner.start(
        deviceIdToUse || { facingMode: "environment" },
        {
          fps: 12,
          aspectRatio: 1.7777778,
          disableFlip: false,
          videoConstraints,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const width = Math.floor(Math.min(viewfinderWidth * 0.82, 420));
            const height = Math.floor(Math.min(viewfinderHeight * 0.46, 230));
            return { width, height };
          },
        },
        (decodedText, result) => {
          void handleDecodedValue(decodedText, result);
        },
        () => {
          // Scanning libraries call this many times while searching. Keep UI quiet.
        },
      );

      window.setTimeout(() => {
        void readCameraCapabilities();
      }, 500);

      void fetchDevices();
    } catch (err) {
      setIsScanning(false);
      setScanStatus("Scanner could not start.");
      setError(getCameraErrorMessage(err));
      resetCameraControls();
    }
  }, [
    fetchDevices,
    getOrCreateScanner,
    handleDecodedValue,
    readCameraCapabilities,
    resetCameraControls,
    selectedDeviceId,
  ]);

  const handleManualSearch = async () => {
    const cleanCode = manualBarcode.trim();

    if (!cleanCode) {
      setError("Enter a barcode or code content first.");
      return;
    }

    setError("");
    setBarcode(cleanCode);
    setScannedContent({
      value: cleanCode,
      format: "Typed code",
      isProductCode: isLikelyProductBarcode(cleanCode),
      isUrl: isLikelyUrl(cleanCode),
    });

    await stopScanner();

    if (isLikelyProductBarcode(cleanCode)) {
      setScanStatus(`Searching barcode ${cleanCode}...`);
      await fetchProduct(cleanCode);
      return;
    }

    setProductResult(null);
    setScanStatus("Typed content is shown below.");
  };

  const clearSelectedFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setSelectedFileName("");

    if (!isScanning) {
      setScanStatus("Ready to scan.");
    }
  };

  const handleFileScan = async (file: File | undefined) => {
    if (!file) return;

    setSelectedFileName(file.name);
    setError("");
    setProductResult(null);
    setScannedContent(null);
    isHandlingScanRef.current = false;

    try {
      await stopScanner();
      const scanner = await getOrCreateScanner();
      setScanStatus("Scanning image...");
      const result = await scanner.scanFileV2(file, false);
      await handleDecodedValue(result.decodedText, result);
    } catch (err) {
      setScanStatus("Could not read code from image.");
      setError(getCameraErrorMessage(err));
    }
  };

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  return (
    <section className="scanner-card">
      <header className="scanner-header">
        <p className="eyebrow">By Robert &quot;Rob-One&quot; Wägar</p>
        <h1>Your Health Scanner</h1>
        <p>
          Scan a barcode, search product data and facts and show ingredients,
          nutrition, allergens and simple health flags.
        </p>
      </header>

      <div className="scanner-layout">
        <div>
          <button
            type="button"
            className="video-wrap video-button"
            onClick={tryRefocus}
            disabled={!isScanning}
            aria-label="Tap to refocus camera"
          >
            <div id={SCANNER_REGION_ID} className="html5-scanner-region" />
            {!isScanning && (
              <div className="video-placeholder">
                <span>Open camera</span>
              </div>
            )}
            {isScanning && (
              <>
                <div className="scan-frame" aria-hidden="true" />
                <div className="tap-focus-hint">Tap preview to refocus</div>
              </>
            )}
          </button>

          <p className="scan-status">{scanStatus}</p>
          {focusStatus && <p className="focus-status">{focusStatus}</p>}

          {(zoomSupported || torchSupported) && isScanning && (
            <div className="camera-tools">
              {zoomSupported && (
                <label className="zoom-control" htmlFor="cameraZoom">
                  <span>Zoom</span>
                  <input
                    id="cameraZoom"
                    type="range"
                    min={zoomMin}
                    max={zoomMax}
                    step={zoomStep}
                    value={zoom}
                    onChange={(event) => void applyZoom(Number(event.target.value))}
                  />
                  <strong>{zoom.toFixed(1)}x</strong>
                </label>
              )}

              {torchSupported && (
                <button type="button" className="secondary" onClick={toggleTorch}>
                  {torchOn ? "Turn light off" : "Turn light on"}
                </button>
              )}
            </div>
          )}

          {devices.length > 0 && (
            <div className="camera-select">
              <label htmlFor="camera">Camera</label>
              <select
                id="camera"
                value={selectedDeviceId || ""}
                onChange={(event) =>
                  setSelectedDeviceId(event.target.value || undefined)
                }
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
              <button type="button" onClick={() => void stopScanner()} className="secondary">
                Stop scanner
              </button>
            )}
          </div>

          <div className="manual-search">
            <label htmlFor="manualBarcode">Search with barcode or code content</label>
            <div>
              <input
                id="manualBarcode"
                value={manualBarcode}
                onChange={(event) => setManualBarcode(event.target.value)}
                placeholder="Enter barcode, QR text or URL"
                inputMode="text"
              />
              <button type="button" onClick={handleManualSearch}>
                Search
              </button>
            </div>
          </div>

          <div className="file-scan">
            <label htmlFor="codeImage">Scan from image</label>
            <input
              ref={fileInputRef}
              id="codeImage"
              type="file"
              accept="image/*"
              onChange={(event) => void handleFileScan(event.target.files?.[0])}
            />
            {selectedFileName && (
              <div className="selected-file-row">
                <span>{selectedFileName}</span>
                <button type="button" className="secondary small-button" onClick={clearSelectedFile}>
                  Remove image
                </button>
              </div>
            )}
          </div>

          {barcode && (
            <p className="barcode">
              Last code: <strong>{barcode}</strong>
            </p>
          )}

          {loadingProduct && <p className="status">Searching product...</p>}
          {error && <p className="error">{error}</p>}
        </div>

        <div className="result-area">
          {!productResult && !loadingProduct && !scannedContent && (
            <div className="empty-state">
              <h2>Ready when you are</h2>
              <p>
                Use your camera, upload an image or enter a code manually. Product
                barcodes can show ingredients, nutrition and health flags. Other
                codes show their raw content.
              </p>
            </div>
          )}

          {scannedContent && !scannedContent.isProductCode && (
            <ScannedContentCard content={scannedContent} />
          )}

          {productResult && !productResult.found && (
            <div className="result-card warning">
              <h2>Product not found</h2>
              <p>{productResult.message}</p>
              <p>Barcode: {productResult.barcode}</p>
              <p>
                The barcode was read, but no matching product data was found.
                Try another product or check that the full barcode is correct.
              </p>
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

function ScannedContentCard({ content }: { content: ScannedContent }) {
  return (
    <article className="result-card content-card">
      <p className="eyebrow">Code found</p>
      <h2>Scanned content</h2>
      <div className="raw-code-box">{content.value}</div>
      <p className="brand">Format: {content.format}</p>
      {content.isUrl && (
        <a href={content.value} target="_blank" rel="noreferrer" className="safe-link">
          Open link
        </a>
      )}
    </article>
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
        <ScoreItem
          label="Nutri-Score"
          value={product.nutriscore?.toUpperCase() || "N/A"}
        />
        <ScoreItem
          label="NOVA"
          value={product.novaGroup?.toString() || "N/A"}
        />
        <ScoreItem
          label="Sugar / 100g"
          value={valueOrNA(product.nutriments.sugars, "g")}
        />
        <ScoreItem
          label="Salt / 100g"
          value={valueOrNA(product.nutriments.salt, "g")}
        />
        <ScoreItem
          label="Calories / 100g"
          value={valueOrNA(product.nutriments.calories, " kcal")}
        />
        <ScoreItem
          label="Protein / 100g"
          value={valueOrNA(product.nutriments.protein, "g")}
        />
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

      <TagBlock
        title="Allergens"
        tags={product.allergens}
        emptyText="No allergens listed."
      />
      <TagBlock
        title="Additives"
        tags={product.additives}
        emptyText="No additives listed."
      />

      <p className="disclaimer">
        This is not medical advice. Product data can be incomplete or wrong.
        Always read the package and check with a healthcare professional if you
        have allergies, illness or special dietary needs.
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

  if (
    product.nutriscore &&
    ["d", "e"].includes(product.nutriscore.toLowerCase())
  ) {
    flags.push(
      `Nutri-Score ${product.nutriscore.toUpperCase()}: lower nutrition rating.`,
    );
  }

  if (
    typeof product.nutriments.sugars === "number" &&
    product.nutriments.sugars >= 15
  ) {
    flags.push("High sugar level per 100g.");
  }

  if (
    typeof product.nutriments.salt === "number" &&
    product.nutriments.salt >= 1.5
  ) {
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
