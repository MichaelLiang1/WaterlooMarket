import { PHOTO_MAX_DIMENSION } from "./constants";

const ALREADY_SMALL = 1024 * 1024;

/**
 * Browser-only: resize a photo to fit PHOTO_MAX_DIMENSION and re-encode it as
 * JPEG, so a 5 MB phone photo uploads as ~0.5 MB. The server re-encodes again
 * (and strips metadata), so this is purely about upload size and speed.
 * Returns the original file if it's already small or can't be decoded here.
 */
export async function shrinkImage(file: File): Promise<File> {
  try {
    // Applies EXIF orientation by default, so portrait photos stay upright.
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= ALREADY_SMALL) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
