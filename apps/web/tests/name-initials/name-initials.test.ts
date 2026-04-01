import { describe, expect, it } from "vitest";
import {
  getInitialsFromName,
  getOrganizationNameInitials,
  getPersonNameInitials,
} from "@/lib/name-initials";

describe("getOrganizationNameInitials", () => {
  it("returns fallback for empty", () => {
    expect(getOrganizationNameInitials("")).toBe("?");
    expect(getOrganizationNameInitials(null, "X")).toBe("X");
  });

  it("one word → first letter only", () => {
    expect(getOrganizationNameInitials("Organisation")).toBe("O");
    expect(getOrganizationNameInitials("acme")).toBe("A");
  });

  it("two words → two initials", () => {
    expect(getOrganizationNameInitials("Acme Corp")).toBe("AC");
  });

  it("three+ words → first two words only", () => {
    expect(getOrganizationNameInitials("Alpha Beta Gamma")).toBe("AB");
  });

  it("normalizes extra spaces", () => {
    expect(getOrganizationNameInitials("  Foo   Bar  ")).toBe("FB");
  });
});

describe("getPersonNameInitials", () => {
  it("returns fallback for empty", () => {
    expect(getPersonNameInitials("")).toBe("?");
  });

  it("one word → first letter only", () => {
    expect(getPersonNameInitials("Madonna")).toBe("M");
  });

  it("two words → two initials", () => {
    expect(getPersonNameInitials("John Doe")).toBe("JD");
  });

  it("three+ words → first and last", () => {
    expect(getPersonNameInitials("John Middle Doe")).toBe("JD");
  });
});

describe("getInitialsFromName", () => {
  it("matches person rules", () => {
    expect(getInitialsFromName("Jane")).toBe("J");
    expect(getInitialsFromName("Jane Q Public")).toBe("JP");
  });
});
