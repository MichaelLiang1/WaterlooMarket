import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import sharp from "sharp";

let dir: string;
let uploads: typeof import("../src/lib/uploads");

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "wm-uploads-"));
  process.env.UPLOAD_DIR = dir;
  uploads = await import("../src/lib/uploads");
});

after(() => rm(dir, { recursive: true, force: true }));

test("strips GPS metadata, applies rotation, and caps size", async () => {
  // A 3000x1000 phone-style JPEG, stored rotated with EXIF orientation 6 and GPS tags.
  const original = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: "#c33" } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExif({
      IFD0: { Make: "Apple", Model: "iPhone 17" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "43/1 28/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "80/1 32/1 0/1" },
    })
    .toBuffer();
  const before = await sharp(original).metadata();
  assert.ok(before.exif && before.exif.includes(Buffer.from("iPhone")), "fixture should carry EXIF");
  assert.equal(before.orientation, 6);

  const key = await uploads.saveImage(new File([new Uint8Array(original)], "IMG_0001.jpg"));
  const saved = await readFile(path.join(dir, key));
  const meta = await sharp(saved).metadata();

  assert.equal(meta.exif, undefined, "EXIF (including GPS) must be removed");
  assert.equal(meta.xmp, undefined);
  // Orientation 6 = rotate 90°, so the stored image is portrait, and within 2000px.
  assert.equal(meta.width, 667);
  assert.equal(meta.height, 2000);
  assert.equal(meta.orientation, undefined);
});

test("rejects files that only pretend to be images", async () => {
  const fake = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 1, 2, 3, 4]);
  await assert.rejects(uploads.saveImage(new File([fake], "trick.jpg")), uploads.UploadError);
});
