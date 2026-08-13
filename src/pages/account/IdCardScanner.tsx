import { useState } from "react";
import { createWorker } from "tesseract.js";

interface ExtractedIdData {
  idCardNumber: string;
  dateIssued: string;
  expirationDate: string;
}

interface IdCardScannerProps {
  onExtracted: (data: ExtractedIdData) => void;
}

function cleanDate(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/, ", ")
    .trim();
}

export default function IdCardScanner({ onExtracted }: IdCardScannerProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function preprocessImage(file: File): Promise<HTMLCanvasElement> {
    const image = new Image();

    const imageUrl = URL.createObjectURL(file);

    return new Promise((resolve, reject) => {
      image.onload = () => {
        URL.revokeObjectURL(imageUrl);

        const scale = 2;

        const canvas = document.createElement("canvas");

        canvas.width = image.width * scale;
        canvas.height = image.height * scale;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Unable to create canvas context."));
          return;
        }

        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const data = imageData.data;

        // Grayscale + contrast
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Grayscale
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;

          // Increase contrast
          const contrast = 1.5;

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

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setError(null);
    setProcessing(true);
    setProgress(0);

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    try {
      // Preprocess image before OCR
      const processedImage = await preprocessImage(file);

      const worker = await createWorker("eng", 1, {
        logger: (message) => {
          if (message.status === "recognizing text") {
            setProgress(Math.round(message.progress * 100));
          }
        },
      });

      const {
        data: { text },
      } = await worker.recognize(processedImage);

      console.log("OCR TEXT:", text);

      const extractedData = extractIdData(text);

      console.log("EXTRACTED DATA:", extractedData);

      onExtracted(extractedData);

      await worker.terminate();
    } catch (err) {
      console.error("OCR error:", err);
      setError("Unable to read the ID. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div>
        <label
          htmlFor="id-card-upload"
          className="inline-flex cursor-pointer items-center rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          {processing ? "Reading ID..." : "Upload ID Card"}
        </label>

        <input
          id="id-card-upload"
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          disabled={processing}
          className="hidden"
        />
      </div>

      {/* Progress */}
      {processing && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Reading ID...</span>
            <span>{progress}%</span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Preview */}
      {imagePreview && (
        <div className="overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
          <img
            src={imagePreview}
            alt="Uploaded ID"
            className="max-h-64 w-full object-contain"
          />
        </div>
      )}

      {/* Error */}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

/**
 * Extract the three values we need from OCR text.
 */
function extractIdData(text: string): ExtractedIdData {
  const normalizedText = text.replace(/\r/g, "").replace(/[|]/g, "I");

  console.log("NORMALIZED OCR TEXT:", normalizedText);

  return {
    idCardNumber: extractIdCardNumber(normalizedText),
    dateIssued: extractDateIssued(normalizedText),
    expirationDate: extractExpirationDate(normalizedText),
  };
}

function extractIdCardNumber(text: string): string {
  const patterns = [
    /ID[\s-]*CARD[\s-]*(?:NUMBER|NO\.?|#)\s*[:.]?\s*([A-Z0-9-]+)/i,
    /ID[\s-]*CARD[\s-]*NUMBER\s*[:.]?\s*([A-Z0-9-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function extractDateIssued(text: string): string {
  const patterns = [
    /DATE\s*ISSUED\s*[:.]?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i,

    /DATE\s*OF\s*ISSUE\s*[:.]?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i,

    /ISSUED\s*[:.]?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return cleanDate(match[1]);
    }
  }

  return "";
}

function extractExpirationDate(text: string): string {
  const patterns = [
    /EXPIRATION\s*DATE\s*[:.]?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i,

    /DATE\s*OF\s*EXPIRATION\s*[:.]?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i,

    /EXPIRY\s*[:.]?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i,

    /EXPIRES\s*[:.]?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return cleanDate(match[1]);
    }
  }

  return "";
}
