import { describe, expect, it } from "vitest";
import { decodePhoto, MAX_PHOTO_DATA_URL } from "./photo";

// A real 1×1 JPEG.
const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/9oACAEBAAA/ANLPIP/Z";

describe("decodePhoto", () => {
  it("accepts a JPEG data URL", () => {
    const buf = decodePhoto(JPEG);
    expect(buf).not.toBeNull();
    expect(buf![0]).toBe(0xff);
    expect(buf![1]).toBe(0xd8);
  });
  it("rejects missing, non-JPEG, disguised and oversized input", () => {
    expect(decodePhoto(null)).toBeNull();
    expect(decodePhoto("hello")).toBeNull();
    expect(decodePhoto("data:image/png;base64,iVBORw0KGgo=")).toBeNull();
    // Claims to be JPEG but the bytes aren't.
    expect(decodePhoto("data:image/jpeg;base64," + Buffer.from("<script>alert(1)</script>").toString("base64"))).toBeNull();
    expect(decodePhoto(JPEG + "A".repeat(MAX_PHOTO_DATA_URL))).toBeNull();
  });
});
