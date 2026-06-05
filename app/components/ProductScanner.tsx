"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CameraDevice,
  Html5Qrcode,
  Html5QrcodeResult,
} from "html5-qrcode";
import { findAdditivesInText, getAdditiveInfo } from "../data/additives";
import { parseScannedCode, type ParsedScannedCode } from "../lib/codeParser";

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

type ScannedContent = ParsedScannedCode;

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
const SCAN_HISTORY_KEY = "your-health-scanner:scan-history";
const MAX_SCAN_HISTORY_ITEMS = 12;

type ScanHistoryItem = {
  code: string;
  title: string;
  subtitle: string;
  type: "product" | "raw";
  source?: string;
  savedAt: number;
};

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

function readScanHistory() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(SCAN_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScanHistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveScanHistory(items: ScanHistoryItem[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(items));
  } catch {
    // localStorage can be full or blocked. The app still works without history.
  }
}

function buildProductHistoryItem(code: string, data: ProductResult): ScanHistoryItem | null {
  if (!data.found || !data.product) return null;

  return {
    code,
    title: data.product.name || code,
    subtitle: data.product.brand || "Saved product scan",
    type: "product",
    source: data.source,
    savedAt: Date.now(),
  };
}

function upsertScanHistoryItem(items: ScanHistoryItem[], item: ScanHistoryItem) {
  const withoutDuplicate = items.filter((historyItem) => historyItem.code !== item.code);
  return [item, ...withoutDuplicate].slice(0, MAX_SCAN_HISTORY_ITEMS);
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

function getFormatName(result?: Html5QrcodeResult) {
  return result?.result?.format?.formatName || "Unknown format";
}

export default function ProductScanner() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isHandlingScanRef = useRef(false);

  const [isScanning, setIsScanning] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
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
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>(() => readScanHistory());

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
    setScanLocked(false);
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

  const rememberProduct = useCallback((code: string, data: ProductResult) => {
    const item = buildProductHistoryItem(code, data);
    if (!item) return;

    setScanHistory((currentItems) => {
      const nextItems = upsertScanHistoryItem(currentItems, item);
      saveScanHistory(nextItems);
      return nextItems;
    });
  }, []);

  const fetchProduct = useCallback(async (code: string) => {
    const cleanCode = code.trim();

    if (!cleanCode) return;

    setError("");
    setProductResult(null);

    const cachedProduct = readCachedProduct(cleanCode);

    if (cachedProduct) {
      setProductResult(cachedProduct);
      rememberProduct(cleanCode, cachedProduct);
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
        rememberProduct(cleanCode, data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not search product.");
    } finally {
      setLoadingProduct(false);
    }
  }, [rememberProduct]);

  const handleDecodedValue = useCallback(
    async (value: string, result?: Html5QrcodeResult) => {
      const cleanValue = value.trim();
      if (!cleanValue || isHandlingScanRef.current) return;

      isHandlingScanRef.current = true;
      setScanLocked(true);
      const format = getFormatName(result);
      const parsedCode = parseScannedCode(cleanValue, format);
      const displayCode = parsedCode.searchCode || parsedCode.productCode || cleanValue;

      setScannedContent(parsedCode);
      setBarcode(displayCode);
      setScanStatus(`${format} captured. Hold still...`);

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(80);
      }

      await wait(700);
      await stopScanner();

      if (parsedCode.searchCode) {
        const label = parsedCode.kind === "gs1-digital-link" || parsedCode.kind === "gs1-ai"
          ? `GTIN found: ${parsedCode.searchCode}`
          : `Barcode found: ${parsedCode.searchCode}`;
        setScanStatus(`${label}. Searching...`);
        await fetchProduct(parsedCode.searchCode);
        return;
      }

      setProductResult(null);
      setScanStatus("Code scanned. Details are shown below.");
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
    setScanLocked(false);
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
    const parsedCode = parseScannedCode(cleanCode, "Typed code");
    const displayCode = parsedCode.searchCode || parsedCode.productCode || cleanCode;
    setBarcode(displayCode);
    setScannedContent(parsedCode);

    await stopScanner();

    if (parsedCode.searchCode) {
      setScanStatus(`Searching product code ${parsedCode.searchCode}...`);
      await fetchProduct(parsedCode.searchCode);
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

  const handleHistorySearch = async (item: ScanHistoryItem) => {
    setManualBarcode(item.code);
    setBarcode(item.code);
    const parsedCode = parseScannedCode(
      item.code,
      item.type === "product" ? "Saved barcode" : "Saved code",
    );
    setScannedContent(parsedCode);

    if (parsedCode.searchCode) {
      setScanStatus(`Searching saved product code ${parsedCode.searchCode}...`);
      await fetchProduct(parsedCode.searchCode);
      return;
    }

    setProductResult(null);
    setScanStatus("Saved content is shown below.");
  };

  const clearScanHistory = () => {
    setScanHistory([]);
    saveScanHistory([]);
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
          <div
            className="video-wrap video-button"
            onClick={() => {
              if (isScanning && !scanLocked) {
                void tryRefocus();
              }
            }}
            role="button"
            tabIndex={isScanning && !scanLocked ? 0 : -1}
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
                <div className="tap-focus-hint">
                  {scanLocked ? "Code captured" : "Tap preview to refocus"}
                </div>
                {scanLocked && (
                  <div className="scan-captured-overlay" aria-live="polite">
                    Code captured
                  </div>
                )}
              </>
            )}
          </div>

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

          {scannedContent && (
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

          {scanHistory.length > 0 && (
            <ScanHistoryPanel
              items={scanHistory}
              onSearch={(item) => void handleHistorySearch(item)}
              onClear={clearScanHistory}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function ScannedContentCard({ content }: { content: ScannedContent }) {
  const hasGs1Details = content.gs1Fields.length > 0;

  return (
    <article className="result-card content-card">
      <p className="eyebrow">Code found</p>
      <h2>{getScannedContentTitle(content)}</h2>

      {content.searchCode && (
        <div className="parsed-code-highlight">
          <span>Product code used for search</span>
          <strong>{content.searchCode}</strong>
        </div>
      )}

      {hasGs1Details && (
        <section className="gs1-details">
          <h3>2D / GS1 details</h3>
          <div className="gs1-field-grid">
            {content.gs1Fields.map((field) => (
              <div className="gs1-field" key={`${field.ai}-${field.value}`}>
                <span>AI {field.ai}</span>
                <strong>{field.label}</strong>
                <p>{field.displayValue}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="raw-code-box">{content.raw}</div>
      <p className="brand">Format: {content.format}</p>

      <div className="content-actions">
        <button
          type="button"
          className="secondary small-button"
          onClick={() => void copyText(content.raw)}
        >
          Copy raw code
        </button>

        {content.searchCode && (
          <button
            type="button"
            className="secondary small-button"
            onClick={() => void copyText(content.searchCode || "")}
          >
            Copy product code
          </button>
        )}

        {content.isUrl && content.url && (
          <a href={content.url} target="_blank" rel="noreferrer" className="safe-link">
            Open link
          </a>
        )}
      </div>
    </article>
  );
}

function getScannedContentTitle(content: ScannedContent) {
  if (content.kind === "gs1-digital-link") return "GS1 Digital Link";
  if (content.kind === "gs1-ai") return "GS1 2D code";
  if (content.kind === "product-barcode") return "Product barcode";
  if (content.kind === "url") return "Scanned link";
  return "Scanned content";
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard can be blocked in some browsers. The raw value is still visible.
  }
}

function ScanHistoryPanel({
  items,
  onSearch,
  onClear,
}: {
  items: ScanHistoryItem[];
  onSearch: (item: ScanHistoryItem) => void;
  onClear: () => void;
}) {
  return (
    <section className="history-card">
      <div className="section-header-row">
        <div>
          <p className="eyebrow">Saved on this device</p>
          <h2>Recent scans</h2>
        </div>
        <button type="button" className="secondary small-button" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="history-list">
        {items.map((item) => (
          <button
            type="button"
            className="history-item"
            key={`${item.code}-${item.savedAt}`}
            onClick={() => onSearch(item)}
          >
            <span>
              <strong>{item.title}</strong>
              <small>{item.subtitle}</small>
            </span>
            <code>{item.code}</code>
          </button>
        ))}
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
  const dietNotes = useMemo(() => getDietAndPreferenceNotes(product), [product]);
  const ingredientNotes = useMemo(() => getIngredientWatchList(product), [product]);
  const additiveDetails = useMemo(() => getAdditiveDetails(product), [product]);

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
          value={formatNutrient(product.nutriments.sugars, "g")}
        />
        <ScoreItem
          label="Carbs / 100g"
          value={formatNutrient(product.nutriments.carbs, "g")}
        />
        <ScoreItem
          label="Salt / 100g"
          value={formatNutrient(product.nutriments.salt, "g")}
        />
        <ScoreItem
          label="Protein / 100g"
          value={formatNutrient(product.nutriments.protein, "g")}
        />
      </div>

      {dietNotes.length > 0 && (
        <section className="preference-notes">
          <div className="section-title-block">
            <p className="eyebrow">Personal food notes</p>
            <h3>May matter for your diet</h3>
            <p>
              These notes are simple signals based on the listed nutrition,
              allergens and ingredients. Always check the package if you have a
              medical allergy or strict diet.
            </p>
          </div>
          <div className="note-grid">
            {dietNotes.map((note) => (
              <article className={`note-card ${note.tone}`} key={note.title}>
                <strong>{note.title}</strong>
                <p>{note.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {ingredientNotes.length > 0 && (
        <section className="ingredient-watch">
          <h3>Ingredients some people watch</h3>
          <div className="watch-list">
            {ingredientNotes.map((note) => (
              <span key={note}>{note}</span>
            ))}
          </div>
        </section>
      )}

      {healthFlags.length > 0 && (
        <div className="health-flags">
          <h3>Simple health flags</h3>
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
      <AdditivesBlock additives={product.additives} additiveDetails={additiveDetails} />

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

function AdditivesBlock({
  additives,
  additiveDetails,
}: {
  additives: string[];
  additiveDetails: ReturnType<typeof getAdditiveDetails>;
}) {
  return (
    <section className="info-section additives-section">
      <h3>Additives</h3>
      {additiveDetails.length > 0 ? (
        <div className="additive-grid">
          {additiveDetails.map((item) => (
            <article className={`additive-card ${item.info.level}`} key={item.info.code}>
              <div className="additive-card-top">
                <span className="additive-code">{item.info.code}</span>
                <span className={`additive-level ${item.info.level}`}>{item.info.level}</span>
              </div>
              <h4>{item.info.name}</h4>
              <p className="additive-category">{item.info.category}</p>
              <p>{item.info.description}</p>
              {item.info.note && <p className="additive-note">{item.info.note}</p>}
              {item.detectedFrom === "ingredients" && (
                <small>Detected from the ingredient text.</small>
              )}
            </article>
          ))}
        </div>
      ) : additives.length > 0 ? (
        <ul>
          {additives.map((tag) => (
            <li key={tag}>{cleanTag(tag)}</li>
          ))}
        </ul>
      ) : (
        <p>No additives listed.</p>
      )}
      <p className="mini-disclaimer">
        Additive notes are simple explanations, not a safety judgement. Approved food additives can still matter for personal preferences, sensitivities or strict diets.
      </p>
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

type HealthNote = {
  title: string;
  body: string;
  tone: "good" | "watch" | "alert";
};

function includesAnyText(text: string, words: string[]) {
  const lowerText = text.toLowerCase();
  return words.some((word) => lowerText.includes(word.toLowerCase()));
}

function hasTaggedValue(tags: string[], words: string[]) {
  const cleanTags = tags.map((tag) => cleanTag(tag).toLowerCase());
  return words.some((word) =>
    cleanTags.some((tag) => tag.includes(word.toLowerCase())),
  );
}

function getAdditiveDetails(product: NonNullable<ProductResult["product"]>) {
  const byCode = new Map<
    string,
    { info: NonNullable<ReturnType<typeof getAdditiveInfo>>; detectedFrom: "product-data" | "ingredients" }
  >();

  for (const tag of product.additives || []) {
    const info = getAdditiveInfo(tag);
    if (info) {
      byCode.set(info.code, { info, detectedFrom: "product-data" });
    }
  }

  for (const info of findAdditivesInText(product.ingredients || "")) {
    if (!byCode.has(info.code)) {
      byCode.set(info.code, { info, detectedFrom: "ingredients" });
    }
  }

  return Array.from(byCode.values()).sort((a, b) =>
    a.info.code.localeCompare(b.info.code, undefined, { numeric: true }),
  );
}

function getDietAndPreferenceNotes(
  product: NonNullable<ProductResult["product"]>,
): HealthNote[] {
  const notes: HealthNote[] = [];
  const ingredients = product.ingredients || "";
  const allergens = product.allergens || [];
  const labels = product.labels || [];
  const carbs = product.nutriments.carbs;
  const sugars = product.nutriments.sugars;
  const salt = product.nutriments.salt;

  if (typeof carbs === "number") {
    if (carbs >= 10) {
      notes.push({
        title: "Keto / low-carb",
        body: `This has ${carbs}g carbs per 100g, so it may not fit a strict keto or low-carb diet.`,
        tone: "alert",
      });
    } else if (carbs <= 5) {
      notes.push({
        title: "Keto / low-carb",
        body: `This is relatively low in carbs at ${carbs}g per 100g. Check the serving size and ingredients too.`,
        tone: "good",
      });
    }
  }

  if (typeof sugars === "number") {
    if (sugars >= 15) {
      notes.push({
        title: "Low sugar / no sugar goals",
        body: `This is high in sugar at ${sugars}g per 100g. It may not suit you if you avoid sugar or manage blood sugar.`,
        tone: "alert",
      });
    } else if (sugars >= 5) {
      notes.push({
        title: "Low sugar / no sugar goals",
        body: `This has ${sugars}g sugar per 100g. It may be worth checking the portion size.`,
        tone: "watch",
      });
    } else {
      notes.push({
        title: "Low sugar / no sugar goals",
        body: `This is low in sugar at ${sugars}g per 100g. Still check if sweeteners or syrups are listed.`,
        tone: "good",
      });
    }
  }

  const glutenWords = ["gluten", "wheat", "barley", "rye", "malt", "spelt"];
  const glutenFound =
    hasTaggedValue(allergens, glutenWords) || includesAnyText(ingredients, glutenWords);

  if (glutenFound) {
    notes.push({
      title: "Gluten sensitive / celiac",
      body: "This appears to contain gluten-related ingredients or allergen tags. Avoid if you need gluten-free products unless the package clearly says otherwise.",
      tone: "alert",
    });
  }

  const dairyWords = ["milk", "lactose", "whey", "casein", "cream", "butter", "cheese", "yoghurt", "yogurt"];
  const dairyFound =
    hasTaggedValue(allergens, dairyWords) || includesAnyText(ingredients, dairyWords);

  if (dairyFound) {
    notes.push({
      title: "Dairy / lactose",
      body: "This appears to contain milk or dairy-related ingredients. Check carefully if you avoid lactose or dairy.",
      tone: "alert",
    });
  }

  if (hasTaggedValue(labels, ["vegan"])) {
    notes.push({
      title: "Vegan",
      body: "This product is labelled vegan in the available data.",
      tone: "good",
    });
  } else if (
    includesAnyText(ingredients, ["milk", "egg", "honey", "gelatin", "whey", "casein"])
  ) {
    notes.push({
      title: "Vegan",
      body: "This may not be vegan based on the listed ingredients. Check the package if this matters to you.",
      tone: "watch",
    });
  }

  if (product.novaGroup === 4) {
    notes.push({
      title: "Whole-food focus",
      body: "NOVA 4 suggests this may be ultra-processed. If you prefer whole/minimally processed foods, compare with a simpler alternative.",
      tone: "watch",
    });
  }

  if (typeof salt === "number" && salt >= 1.5) {
    notes.push({
      title: "Lower salt goals",
      body: `This is high in salt at ${salt}g per 100g. It may not suit a lower-sodium diet.`,
      tone: "watch",
    });
  }

  return notes;
}

function getIngredientWatchList(product: NonNullable<ProductResult["product"]>) {
  const ingredients = product.ingredients || "";
  const watchItems: string[] = [];

  const checks: Array<[string, string[]]> = [
    ["Added sugar / syrup", ["sugar", "syrup", "glucose", "fructose", "dextrose", "maltodextrin"]],
    ["Artificial sweeteners", ["aspartame", "sucralose", "acesulfame", "saccharin"]],
    ["Palm oil", ["palm oil", "palm fat"]],
    ["Hydrogenated oils", ["hydrogenated", "partially hydrogenated"]],
    ["Preservatives", ["preservative", "sorbate", "benzoate", "nitrite", "nitrate"]],
    ["Artificial colours", ["colour", "color", "tartrazine", "carmoisine", "sunset yellow"]],
  ];

  for (const [label, words] of checks) {
    if (includesAnyText(ingredients, words)) {
      watchItems.push(label);
    }
  }

  return watchItems;
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

function formatNutrient(value: number | null, unit: string) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";

  if (Math.abs(value) >= 100) {
    return `${Math.round(value)}${unit}`;
  }

  if (Math.abs(value) >= 10) {
    return `${Number(value.toFixed(1))}${unit}`;
  }

  return `${Number(value.toFixed(2))}${unit}`;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function cleanTag(tag: string) {
  return tag.replace(/^en:/, "").replaceAll("-", " ");
}
