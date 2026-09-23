import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { MAX_PHOTO_BYTES } from "./constants";

// Local-disk storage. On a host with an ephemeral filesystem, point UPLOAD_DIR
// at a mounted volume (or swap these three functions for S3/R2 calls).
const UPLOAD_DIR = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.UPLOAD_DIR ?? "uploads");

export const IMAGE_TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

type Ext = keyof typeof IMAGE_TYPES;

/** Identify the image by its magic bytes; never trust the client's MIME type. */
function sniff(bytes: Uint8Array): Ext | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

export class UploadError extends Error {}

/** Validates and stores an image, returning its storage key. */
export async function saveImage(file: File): Promise<string> {
  if (file.size > MAX_PHOTO_BYTES) {
    throw new UploadError(`"${file.name}" is larger than 5 MB.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniff(bytes);
  if (!ext) {
    throw new UploadError(`"${file.name}" isn't a JPEG, PNG, or WebP image.`);
  }
  const key = `${randomBytes(16).toString("hex")}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, key), await clean(bytes, ext, file.name));
  return key;
}

const MAX_DIMENSION = 2000;

/**
 * Re-encodes the image so EXIF/XMP metadata is dropped. Phone photos embed
 * the GPS location they were taken at, which would reveal a seller's home
 * address. Also applies the EXIF rotation first (so photos aren't sideways)
 * and caps the size.
 */
async function clean(bytes: Uint8Array, ext: Ext, name: string) {
  try {
    const image = sharp(bytes, { failOn: "error" })
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true });
    const encoded =
      ext === "jpg" ? image.jpeg({ quality: 85, mozjpeg: true })
      : ext === "png" ? image.png()
      : image.webp({ quality: 85 });
    return await encoded.toBuffer();
  } catch {
    throw new UploadError(`"${name}" couldn't be read as an image.`);
  }
}

const KEY_PATTERN = /^[a-f0-9]{32}\.(jpg|png|webp)$/;

export async function readImage(key: string) {
  if (!KEY_PATTERN.test(key)) return null;
  try {
    const data = await readFile(path.join(UPLOAD_DIR, key));
    const ext = key.split(".").pop() as Ext;
    return { data, contentType: IMAGE_TYPES[ext] };
  } catch {
    return null;
  }
}

export async function deleteImages(keys: string[]) {
  await Promise.all(
    keys
      .filter((k) => KEY_PATTERN.test(k))
      .map((k) => unlink(path.join(UPLOAD_DIR, k)).catch(() => {})),
  );
}
