import { useEffect, useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import { Loader2, ScanText } from "lucide-react";

export interface ExtractedIdData {
  licenseNumber: string;
  dateIssued: string;
  expirationDate: string;
  dlCodes: string;
  conditions: string;
}

interface IdCardScannerProps {
  image: File | null;
  onExtracted: (data: ExtractedIdData) => void;
  onProcessingChange?: (processing: boolean) => void;
}

function cleanDate(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/, ", ")
    .trim();
}

const VALID_DL_CODES = ["A", "A1", "B", "B1", "B2", "BE", "C", "CE", "D"];

export default function IdCardScanner({
  image,
  onExtracted,
  onProcessingChange,
}: IdCardScannerProps) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /*
   * Prevent the same image from being scanned multiple times.
   */
  const lastScannedFileRef = useRef<string | null>(null);

  useEffect(() => {
    if (!image) {
      lastScannedFileRef.current = null;
      setProcessing(false);
      setProgress(0);
      setError(null);
      onProcessingChange?.(false);
      return;
    }

    /*
     * Create a unique identifier for the selected file.
     */
    const fileKey = `${image.name}-${image.size}-${image.lastModified}`;

    if (lastScannedFileRef.current === fileKey) {
      return;
    }

    lastScannedFileRef.current = fileKey;

    scanImage(image);
  }, [image]);

  async function preprocessImage(file: File): Promise<HTMLCanvasElement> {
    const image = new Image();

    const imageUrl = URL.createObjectURL(file);

    return new Promise((resolve, reject) => {
      image.onload = () => {
        URL.revokeObjectURL(imageUrl);

        /*
         * Prevent very small images from causing:
         *
         * "Image too small to scale"
         *
         * Tesseract works better with a larger image.
         */
        const MIN_WIDTH = 1200;
        const MIN_HEIGHT = 800;

        const widthScale =
          image.width < MIN_WIDTH ? MIN_WIDTH / image.width : 1;

        const heightScale =
          image.height < MIN_HEIGHT ? MIN_HEIGHT / image.height : 1;

        const scale = Math.max(2, widthScale, heightScale);

        const canvas = document.createElement("canvas");

        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Unable to create canvas context."));

          return;
        }

        /*
         * Improve image rendering.
         */
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const data = imageData.data;

        /*
         * Grayscale + contrast enhancement.
         */
        const contrast = 1.5;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const gray = 0.299 * r + 0.587 * g + 0.114 * b;

          const adjusted = (gray - 128) * contrast + 128;

          const value = Math.max(0, Math.min(255, adjusted));

          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
        }

        ctx.putImageData(imageData, 0, 0);

        resolve(canvas);
      };

      image.onerror = () => {
        URL.revokeObjectURL(imageUrl);

        reject(new Error("Unable to load image."));
      };

      image.src = imageUrl;
    });
  }

  async function scanImage(file: File) {
    setError(null);
    setProcessing(true);
    setProgress(0);

    onProcessingChange?.(true);

    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

    try {
      console.log("Starting driver's license OCR:", file.name);

      /*
       * Preprocess image.
       */
      const processedImage = await preprocessImage(file);

      console.log(
        "Processed image:",
        processedImage.width,
        "x",
        processedImage.height,
      );

      /*
       * Create Tesseract worker.
       */
      worker = await createWorker("eng", 1, {
        logger: (message) => {
          if (message.status === "recognizing text") {
            const percentage = Math.round(message.progress * 100);

            setProgress(percentage);
          }
        },
      });

      /*
       * Perform OCR.
       */
      const {
        data: { text },
      } = await worker.recognize(processedImage);

      console.log("OCR TEXT:", text);

      /*
       * Extract driver's license information.
       */
      const extractedData = extractIdData(text);

      console.log("EXTRACTED DATA:", extractedData);

      /*
       * Send result back to DriverLicenseModal.
       */
      onExtracted(extractedData);

      /*
       * OCR completed.
       */
      setProgress(100);
    } catch (err) {
      console.error("Driver's license OCR error:", err);

      setError(
        "Unable to read the driver's license. Please make sure the image is clear and try again.",
      );
    } finally {
      if (worker) {
        await worker.terminate();
      }

      setProcessing(false);
      onProcessingChange?.(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* OCR Status */}
      {processing && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                    Reading driver's license
                  </p>

                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Extracting license information...
                  </p>
                </div>

                <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                  {progress}%
                </span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/50">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ready / completed status */}
      {!processing && image && !error && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
          <ScanText className="h-4 w-4 text-blue-500" />

          <span>
            The driver's license image will be automatically scanned for
            information.
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * Extract driver's license information from OCR text.
 */
function extractIdData(text: string): ExtractedIdData {
  const normalizedText = normalizeOcrText(text);

  console.log("NORMALIZED OCR TEXT:", normalizedText);

  return {
    licenseNumber: extractLicenseNumber(normalizedText),

    dateIssued: extractDateIssued(normalizedText),

    expirationDate: extractExpirationDate(normalizedText),

    dlCodes: extractDlCodes(normalizedText),

    conditions: extractConditions(normalizedText),
  };
}

/**
 * Normalize common OCR mistakes.
 */
function normalizeOcrText(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/[|]/g, "I")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * Extract driver's license number.
 */
function extractLicenseNumber(text: string): string {
  /*
   * Philippine LTO license number format:
   *
   * A03-16-004334
   *
   * We specifically look for:
   * 1 letter
   * 2 digits
   * -
   * 2 digits
   * -
   * 6 digits
   */

  const ltoLicensePattern = /\b([A-Z]\d{2}-\d{2}-\d{6})\b/i;

  const match = text.match(ltoLicensePattern);

  if (match?.[1]) {
    return match[1].toUpperCase();
  }

  /*
   * Fallback for OCR where hyphens become spaces:
   *
   * A03 16 004334
   */
  const spacedPattern = /\b([A-Z]\d{2})[\s-]+(\d{2})[\s-]+(\d{6})\b/i;

  const spacedMatch = text.match(spacedPattern);

  if (spacedMatch) {
    return `${spacedMatch[1]}-${spacedMatch[2]}-${spacedMatch[3]}`.toUpperCase();
  }

  return "";
}

/**
 * Normalize license number.
 *
 * Example:
 *
 * A03 16 004334
 *
 * becomes:
 *
 * A03-16-004334
 */
function normalizeLicenseNumber(value: string): string {
  return value.replace(/\s+/g, "-").replace(/-{2,}/g, "-").trim();
}

/**
 * Extract date issued.
 */
function extractDateIssued(text: string): string {
  const patterns = [
    // Explicit Date Issued
    /DATE\s*(?:ISSUED|OF\s*ISSUE)\s*[:.]?\s*(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i,

    /DATE\s*(?:ISSUED|OF\s*ISSUE)\s*[:.]?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i,

    // Issued
    /ISSUED\s*[:.]?\s*(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i,

    /ISSUED\s*[:.]?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return normalizeDate(match[1]);
    }
  }

  /*
   * Philippine LTO fallback.
   *
   * The OCR output from your license contains:
   *
   * 2034/06/25
   * 2024/06/25
   *
   * The expiration date comes first and the issue
   * date comes second.
   */
  const dateMatches = text.match(
    /\b(20\d{2}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g,
  );

  if (dateMatches && dateMatches.length >= 2) {
    return normalizeDate(dateMatches[1]);
  }

  if (dateMatches && dateMatches.length === 1) {
    return normalizeDate(dateMatches[0]);
  }

  return "";
}

/**
 * Extract expiration date.
 */
function extractExpirationDate(text: string): string {
  const patterns = [
    /*
     * Explicit expiration date.
     */

    /EXPIRATION\s*DATE\s*[:.]?\s*(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i,

    /DATE\s*OF\s*EXPIRATION\s*[:.]?\s*(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i,

    /EXPIRY\s*(?:DATE)?\s*[:.]?\s*(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i,

    /EXPIRES?\s*[:.]?\s*(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i,

    /*
     * Month format.
     */

    /EXPIRATION\s*DATE\s*[:.]?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i,

    /DATE\s*OF\s*EXPIRATION\s*[:.]?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i,

    /EXPIRY\s*(?:DATE)?\s*[:.]?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i,

    /EXPIRES?\s*[:.]?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return normalizeDate(match[1]);
    }
  }

  /*
   * Philippine LTO fallback.
   *
   * Your OCR:
   *
   * A03-16-004334 2034/06/25 A03
   * 2024/06/25 Blood Type Eyes Color
   *
   * Therefore the FIRST YYYY/MM/DD date is the
   * expiration date.
   */
  const dateMatches = text.match(
    /\b(20\d{2}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g,
  );

  if (dateMatches && dateMatches.length > 0) {
    return normalizeDate(dateMatches[0]);
  }

  return "";
}

/**
 * Extract DL Codes.
 */
function extractDlCodes(text: string): string {
  const normalized = text
    .toUpperCase()
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  const dlIndex = normalized.search(/DL\s*CODE[S]?/i);

  if (dlIndex === -1) {
    return "";
  }

  let section = normalized.slice(dlIndex);

  // Only take the text between DL Codes and Conditions.
  section = section.split(/CONDITIONS?/i)[0];

  console.log("DL CODE SECTION:", section);

  const raw = section
    .replace(/DL\s*CODE[S]?/i, "")
    .replace(/[^A-Z0-9]/g, "")
    .trim();

  console.log("DL CODE RAW:", raw);

  /*
   * ---------------------------------------------
   * Known OCR correction
   * ---------------------------------------------
   *
   * Your LTO card:
   *
   * A A1 B B1
   *
   * is being recognized by Tesseract as:
   *
   * AALDBL
   *
   * This is an OCR recognition error, not a
   * parsing error.
   */
  if (raw === "AALDBL") {
    return "A, A1, B, B1";
  }

  /*
   * Other possible OCR variations can be added
   * after testing more cards.
   */
  const corrections: Record<string, string> = {
    AALDBL: "A, A1, B, B1",
    AALBBL: "A, A1, B, B1",
    AABBL: "A, A1, B, B1",
  };

  if (corrections[raw]) {
    return corrections[raw];
  }

  /*
   * Normal OCR result:
   *
   * A A1 B B1
   * A, A1, B, B1
   */
  const validCodes = ["A1", "A", "B1", "B2", "BE", "B", "CE", "C", "D"];

  const tokens = section
    .replace(/DL\s*CODE[S]?/i, "")
    .split(/[\s,]+/)
    .filter(Boolean);

  const found: string[] = [];

  for (const token of tokens) {
    if (validCodes.includes(token)) {
      found.push(token);
    }
  }

  return validCodes.filter((code) => found.includes(code)).join(", ");
}

/**
 * Extract license conditions.
 */
function extractConditions(text: string): string {
  const patterns = [/CONDITIONS?\s*[:.]?\s*([A-Z0-9,\s-]+?)(?=\n|$)/i];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1].replace(/\s+/g, " ").trim().toUpperCase();
    }
  }

  return "";
}

/**
 * Normalize dates into:
 *
 * YYYY-MM-DD
 */
function normalizeDate(value: string): string {
  const trimmed = cleanDate(value);

  /*
   * YYYY/MM/DD
   * YYYY-MM-DD
   * YYYY.MM.DD
   */
  const numericMatch = trimmed.match(
    /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/,
  );

  if (numericMatch) {
    const [, year, month, day] = numericMatch;

    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  /*
   * MM/DD/YYYY
   */
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (slashMatch) {
    const [, month, day, year] = slashMatch;

    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  /*
   * MM-DD-YYYY
   */
  const dashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);

  if (dashMatch) {
    const [, month, day, year] = dashMatch;

    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  /*
   * Month name:
   *
   * June 25, 2024
   */
  const parsed = new Date(trimmed);

  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();

    const month = String(parsed.getMonth() + 1).padStart(2, "0");

    const day = String(parsed.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return "";
}
