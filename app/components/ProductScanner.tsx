"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
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

type CameraCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  zoom?: {
    min?: number;
    max?: number;
    step?: number;
  };
  focusMode?: string[];
  focusDistance?: {
    min?: number;
    max?: number;
    step?: number;
  };
};

type CameraConstraintPatch = MediaTrackConstraints & {
  advanced?: Array<Record<string, unknown>>;
};

function getCameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (
      error.name === "NotAllowedError" ||
      error.name === "PermissionDeniedError"
    ) {
      return "Camera access was denied. Allow camera access in your browser settings and try again.";
    }

    if (
      error.name === "NotFoundError" ||
      error.name === "DevicesNotFoundError"
    ) {
      return "No camera was found on this device.";
    }

    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "The camera could not be started. Close other apps using the camera and try again.";
    }

    if (
      error.name === "OverconstrainedError" ||
      error.name === "ConstraintNotSatisfiedError"
    ) {
      return "The selected camera could not use the requested settings. Try another camera.";
    }
  }

  return error instanceof Error
    ? error.message
    : "Could not start the camera. Allow camera access and try again.";
}

function getVideoTrack(video: HTMLVideoElement | null) {
  const stream = video?.srcObject;

  if (!(stream instanceof MediaStream)) {
    return null;
  }

  return stream.getVideoTracks()[0] ?? null;
}

async function safeApplyConstraints(
  track: MediaStreamTrack | null,
  constraints: CameraConstraintPatch,
) {
  if (!track) return false;

  try {
    await track.applyConstraints(constraints);
    return true;
  } catch {
    return false;
  }
}

export default function ProductScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const isHandlingScanRef = useRef(false);

  const [isScanning, setIsScanning] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");
  const [productResult, setProductResult] = useState<ProductResult | null>(
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

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    isHandlingScanRef.current = false;
    setIsScanning(false);
    setScanStatus("Scanner stopped.");
    resetCameraControls();
  }, [resetCameraControls]);

  const fetchDevices = useCallback(async () => {
    try {
      const videoInputDevices =
        await BrowserMultiFormatReader.listVideoInputDevices();
      const mappedDevices = videoInputDevices.map((device, index) => ({
        key: `${device.deviceId || device.label || "camera"}-${index}`,
        deviceId: device.deviceId,
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
    setLoadingProduct(true);
    setProductResult(null);

    try {
      const response = await fetch(
        `/api/product?barcode=${encodeURIComponent(cleanCode)}`,
      );
      const data = (await response.json()) as ProductResult;
      setProductResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not search product.");
    } finally {
      setLoadingProduct(false);
    }
  }, []);

  const readCameraCapabilities = useCallback(async () => {
    const track = getVideoTrack(videoRef.current);

    if (!track) return;

    const capabilities = track.getCapabilities() as CameraCapabilities;
    const settings = track.getSettings() as MediaTrackSettings & {
      zoom?: number;
    };

    if (capabilities.torch) {
      setTorchSupported(true);
    }

    if (capabilities.zoom?.min && capabilities.zoom?.max) {
      const min = capabilities.zoom.min;
      const max = capabilities.zoom.max;
      const step = capabilities.zoom.step || 0.1;
      const currentZoom = settings.zoom || Math.min(Math.max(1.6, min), max);

      setZoomSupported(max > min);
      setZoomMin(min);
      setZoomMax(max);
      setZoomStep(step);
      setZoom(currentZoom);

      if (max > min && currentZoom !== settings.zoom) {
        await safeApplyConstraints(track, {
          advanced: [{ zoom: currentZoom }],
        });
      }
    }

    if (capabilities.focusMode?.includes("continuous")) {
      await safeApplyConstraints(track, {
        advanced: [{ focusMode: "continuous" }],
      });
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
  }, []);

  const tryRefocus = useCallback(async () => {
    if (!isScanning) return;

    const track = getVideoTrack(videoRef.current);
    if (!track) return;

    const capabilities = track.getCapabilities() as CameraCapabilities;
    setFocusStatus("Refocusing...");

    if (capabilities.focusMode?.includes("single-shot")) {
      const didFocus = await safeApplyConstraints(track, {
        advanced: [{ focusMode: "single-shot" }],
      });

      if (didFocus) {
        setFocusStatus("Refocus requested. Hold the barcode still.");
        return;
      }
    }

    if (capabilities.focusMode?.includes("continuous")) {
      await safeApplyConstraints(track, {
        advanced: [{ focusMode: "manual" }],
      });

      await safeApplyConstraints(track, {
        advanced: [{ focusMode: "continuous" }],
      });

      setFocusStatus("Autofocus refreshed. Hold the barcode inside the frame.");
      return;
    }

    setFocusStatus(
      "This browser does not expose manual focus. Try better light or move a little farther away.",
    );
  }, [isScanning]);

  const applyZoom = useCallback(async (nextZoom: number) => {
    const track = getVideoTrack(videoRef.current);
    const cleanZoom = Number(nextZoom.toFixed(2));

    setZoom(cleanZoom);

    await safeApplyConstraints(track, {
      advanced: [{ zoom: cleanZoom }],
    });
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = getVideoTrack(videoRef.current);
    const nextTorch = !torchOn;

    const didApply = await safeApplyConstraints(track, {
      advanced: [{ torch: nextTorch }],
    });

    if (didApply) {
      setTorchOn(nextTorch);
    }
  }, [torchOn]);

  const startScanner = useCallback(async () => {
    setError("");
    setProductResult(null);
    resetCameraControls();
    isHandlingScanRef.current = false;

    if (!videoRef.current) {
      setError("Camera preview is not ready yet.");
      return;
    }

    try {
      const preferredDeviceId = await fetchDevices();
      const deviceIdToUse = selectedDeviceId || preferredDeviceId;

      const hints = new Map<DecodeHintType, unknown>();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const codeReader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 70,
        delayBetweenScanSuccess: 350,
      });

      const baseVideoConstraints: MediaTrackConstraints = deviceIdToUse
        ? {
            deviceId: { exact: deviceIdToUse },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 60 },
          }
        : {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 60 },
          };

      const videoConstraints = {
        ...baseVideoConstraints,
        advanced: [
          { focusMode: "continuous" },
          { exposureMode: "continuous" },
          { whiteBalanceMode: "continuous" },
        ],
      } as CameraConstraintPatch;

      setIsScanning(true);
      setScanStatus("Point the camera at the barcode.");
      setFocusStatus("Starting camera focus...");

      const onScan = async (result: { getText: () => string } | undefined) => {
        if (!result || isHandlingScanRef.current) return;

        const scannedCode = result.getText().trim();
        if (!scannedCode) return;

        isHandlingScanRef.current = true;
        setScanStatus(`Barcode found: ${scannedCode}. Searching...`);
        setBarcode(scannedCode);
        stopScanner();
        await fetchProduct(scannedCode);
      };

      const controls = await codeReader.decodeFromConstraints(
        {
          video: videoConstraints,
          audio: false,
        },
        videoRef.current,
        onScan,
      );

      controlsRef.current = controls;

      window.setTimeout(() => {
        void readCameraCapabilities();
      }, 450);

      void fetchDevices();
    } catch (err) {
      setIsScanning(false);
      setScanStatus("Scanner could not start.");
      setError(getCameraErrorMessage(err));
      resetCameraControls();
    }
  }, [
    fetchDevices,
    fetchProduct,
    readCameraCapabilities,
    resetCameraControls,
    selectedDeviceId,
    stopScanner,
  ]);

  const handleManualSearch = async () => {
    const cleanCode = manualBarcode.trim();

    if (!cleanCode) {
      setError("Enter a barcode first.");
      return;
    }

    setBarcode(cleanCode);
    stopScanner();
    setScanStatus(`Searching barcode ${cleanCode}...`);
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
            <video ref={videoRef} className="scanner-video" muted playsInline />
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
              <>
                <button
                  type="button"
                  onClick={stopScanner}
                  className="secondary"
                >
                  Stop scanner
                </button>
                <button type="button" onClick={handleManualSearch}>
                  Search typed code
                </button>
              </>
            )}
          </div>

          <div className="manual-search">
            <label htmlFor="manualBarcode">Search with barcode</label>
            <div>
              <input
                id="manualBarcode"
                value={manualBarcode}
                onChange={(event) => setManualBarcode(event.target.value)}
                placeholder="Enter barcode"
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

          {loadingProduct && <p className="status">Searching product...</p>}
          {error && <p className="error">{error}</p>}
        </div>

        <div className="result-area">
          {!productResult && !loadingProduct && (
            <div className="empty-state">
              <h2>Ready when you are</h2>
              <p>
                Use your camera or enter a barcode manually to see product
                ingredients, nutrition and health flags.
              </p>
            </div>
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
