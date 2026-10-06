/** Largest data URL accepted from the tablet (~300 KB of JPEG). */
export const MAX_PHOTO_DATA_URL = 400_000;

/** A JPEG data URL from the tablet camera → bytes, or null if absent/invalid. */
export function decodePhoto(value: unknown): Buffer | null {
  if (typeof value !== "string" || value.length > MAX_PHOTO_DATA_URL) return null;
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!m) return null;
  const buf = Buffer.from(m[1], "base64");
  // JPEG files start with FF D8 FF.
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff ? buf : null;
}
