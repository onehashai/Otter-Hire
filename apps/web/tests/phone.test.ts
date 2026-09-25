import { describe, expect, it } from "vitest";

import { formatPhoneForDisplay, parseStoredPhone } from "../src/lib/phone";

describe("phone display and editing", () => {
  it("formats explicit international numbers without changing their country code", () => {
    expect(formatPhoneForDisplay("+919876543210")).toBe("+91 98765 43210");
    expect(parseStoredPhone("+1 415 555 0193")).toBe("+14155550193");
  });

  it("does not assign the US country code to an unprefixed local number", () => {
    expect(formatPhoneForDisplay("9876543210")).toBe("9876543210");
    expect(parseStoredPhone("9876543210")).toBeUndefined();
  });
});
