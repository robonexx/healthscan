export type ParsedGs1Field = {
  ai: string;
  label: string;
  value: string;
  displayValue: string;
};

export type ParsedScannedCode = {
  raw: string;
  format: string;
  kind: "product-barcode" | "gs1-digital-link" | "gs1-ai" | "url" | "raw";
  isProductCode: boolean;
  isUrl: boolean;
  gtin?: string;
  productCode?: string;
  searchCode?: string;
  url?: string;
  gs1Fields: ParsedGs1Field[];
};

const GS1_AI_DEFINITIONS: Record<
  string,
  { label: string; fixedLength?: number; variable?: boolean; formatter?: (value: string, ai?: string) => string }
> = {
  "00": { label: "SSCC", fixedLength: 18 },
  "01": { label: "GTIN / product code", fixedLength: 14 },
  "10": { label: "Batch / lot number", variable: true },
  "11": { label: "Production date", fixedLength: 6, formatter: formatGs1Date },
  "15": { label: "Best before date", fixedLength: 6, formatter: formatGs1Date },
  "17": { label: "Expiry date", fixedLength: 6, formatter: formatGs1Date },
  "21": { label: "Serial number", variable: true },
  "240": { label: "Additional product ID", variable: true },
  "241": { label: "Customer part number", variable: true },
  "250": { label: "Secondary serial number", variable: true },
  "251": { label: "Reference to source entity", variable: true },
  "30": { label: "Variable count", variable: true },
  "37": { label: "Count", variable: true },
  "390": { label: "Amount payable", variable: true },
  "392": { label: "Price", variable: true },
};

export function parseScannedCode(rawValue: string, format: string): ParsedScannedCode {
  const raw = rawValue.trim();
  const numeric = raw.replace(/\s/g, "");

  if (isProductBarcode(numeric)) {
    return {
      raw,
      format,
      kind: "product-barcode",
      isProductCode: true,
      isUrl: false,
      gtin: numeric,
      productCode: numeric,
      searchCode: normalizeGtinForSearch(numeric),
      gs1Fields: [],
    };
  }

  const digitalLink = parseGs1DigitalLink(raw, format);
  if (digitalLink) return digitalLink;

  const gs1Ai = parseGs1ApplicationIdentifiers(raw, format);
  if (gs1Ai) return gs1Ai;

  if (isHttpUrl(raw)) {
    return {
      raw,
      format,
      kind: "url",
      isProductCode: false,
      isUrl: true,
      url: raw,
      gs1Fields: [],
    };
  }

  return {
    raw,
    format,
    kind: "raw",
    isProductCode: false,
    isUrl: false,
    gs1Fields: [],
  };
}

export function isProductBarcode(value: string) {
  return /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(value.trim());
}

export function normalizeGtinForSearch(gtin: string) {
  const clean = gtin.replace(/\D/g, "");
  if (clean.length === 14 && clean.startsWith("0")) return clean.slice(1);
  return clean;
}

function parseGs1DigitalLink(raw: string, format: string): ParsedScannedCode | null {
  if (!isHttpUrl(raw)) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const pathSegments = url.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));

  const pairs: Array<[string, string]> = [];

  for (let index = 0; index < pathSegments.length - 1; index += 2) {
    const ai = pathSegments[index];
    const value = pathSegments[index + 1];
    if (isKnownAi(ai) && value) pairs.push([ai, value]);
  }

  url.searchParams.forEach((value, key) => {
    if (isKnownAi(key) && value) pairs.push([key, value]);
  });

  const fields = pairsToGs1Fields(pairs);
  const gtin = valueForAi(fields, "01");

  if (!gtin && fields.length === 0) return null;

  return {
    raw,
    format,
    kind: "gs1-digital-link",
    isProductCode: Boolean(gtin),
    isUrl: true,
    url: raw,
    gtin,
    productCode: gtin,
    searchCode: gtin ? normalizeGtinForSearch(gtin) : undefined,
    gs1Fields: fields,
  };
}

function parseGs1ApplicationIdentifiers(raw: string, format: string): ParsedScannedCode | null {
  const bracketPairs = parseBracketedGs1(raw);
  const compactPairs = bracketPairs.length > 0 ? [] : parseCompactGs1(raw);
  const pairs = bracketPairs.length > 0 ? bracketPairs : compactPairs;

  if (pairs.length === 0) return null;

  const fields = pairsToGs1Fields(pairs);
  const gtin = valueForAi(fields, "01");

  if (!gtin && fields.length === 0) return null;

  return {
    raw,
    format,
    kind: "gs1-ai",
    isProductCode: Boolean(gtin),
    isUrl: false,
    gtin,
    productCode: gtin,
    searchCode: gtin ? normalizeGtinForSearch(gtin) : undefined,
    gs1Fields: fields,
  };
}

function parseBracketedGs1(raw: string) {
  const pairs: Array<[string, string]> = [];
  const regex = /\((\d{2,4})\)([^()]+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    const ai = match[1];
    const value = match[2].trim();
    if (isKnownAi(ai) && value) pairs.push([ai, value]);
  }

  return pairs;
}

function parseCompactGs1(raw: string) {
  const input = raw.replace(/[\s\u001d]/g, "");
  if (!/^\d{16,}/.test(input)) return [];

  const pairs: Array<[string, string]> = [];
  let index = 0;

  while (index < input.length) {
    const ai = readAiAt(input, index);
    if (!ai) break;

    const def = definitionForAi(ai);
    index += ai.length;

    if (def?.fixedLength) {
      const value = input.slice(index, index + def.fixedLength);
      if (value.length !== def.fixedLength) break;
      pairs.push([ai, value]);
      index += def.fixedLength;
      continue;
    }

    const nextAiIndex = findNextAiIndex(input, index);
    const value = input.slice(index, nextAiIndex === -1 ? undefined : nextAiIndex);
    if (!value) break;
    pairs.push([ai, value]);
    index = nextAiIndex === -1 ? input.length : nextAiIndex;
  }

  return pairs;
}

function readAiAt(input: string, index: number) {
  for (const length of [4, 3, 2]) {
    const candidate = input.slice(index, index + length);
    if (isKnownAi(candidate) || isPatternAi(candidate)) return candidate;
  }
  return null;
}

function findNextAiIndex(input: string, start: number) {
  for (let index = start + 1; index < input.length - 1; index += 1) {
    if (readAiAt(input, index)) return index;
  }
  return -1;
}

function isKnownAi(ai: string) {
  return Boolean(GS1_AI_DEFINITIONS[ai]) || isPatternAi(ai);
}

function isPatternAi(ai: string) {
  return /^310\d$/.test(ai) || /^392\d$/.test(ai) || /^393\d$/.test(ai);
}

function definitionForAi(ai: string) {
  if (/^310\d$/.test(ai)) {
    return {
      label: "Net weight in kg",
      fixedLength: 6,
      formatter: (value: string, currentAi?: string) => formatDecimalValue(value, Number(currentAi?.slice(-1) || 0), "kg"),
    };
  }

  if (/^392\d$/.test(ai)) {
    return {
      label: "Price",
      variable: true,
      formatter: (value: string, currentAi?: string) => formatDecimalValue(value, Number(currentAi?.slice(-1) || 0)),
    };
  }

  if (/^393\d$/.test(ai)) {
    return {
      label: "Price with currency",
      variable: true,
    };
  }

  return GS1_AI_DEFINITIONS[ai];
}

function pairsToGs1Fields(pairs: Array<[string, string]>): ParsedGs1Field[] {
  return pairs.map(([ai, value]) => {
    const def = definitionForAi(ai);
    const displayValue = def?.formatter ? def.formatter(value, ai) : value;

    return {
      ai,
      label: def?.label || `GS1 AI ${ai}`,
      value,
      displayValue,
    };
  });
}

function valueForAi(fields: ParsedGs1Field[], ai: string) {
  return fields.find((field) => field.ai === ai)?.value;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function formatGs1Date(value: string) {
  if (!/^\d{6}$/.test(value)) return value;

  const year = Number(value.slice(0, 2));
  const month = value.slice(2, 4);
  const day = value.slice(4, 6);
  const fullYear = year >= 80 ? 1900 + year : 2000 + year;

  if (month === "00" || day === "00") return `${fullYear}-${month}-${day}`;

  return `${fullYear}-${month}-${day}`;
}

function formatDecimalValue(value: string, decimals: number, suffix = "") {
  if (!/^\d+$/.test(value)) return value;
  const divisor = 10 ** decimals;
  const number = Number(value) / divisor;
  return `${number.toLocaleString(undefined, { maximumFractionDigits: decimals })}${suffix ? ` ${suffix}` : ""}`;
}
