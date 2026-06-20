import { describe, expect, it } from "vitest";
import { escapeHtml, safeEmailHref } from "./html";

describe("email HTML safety", () => {
  it("escapes imported and user-controlled HTML", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)"> O'Brien & Co.`)).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; O&#39;Brien &amp; Co.",
    );
  });

  it("allows only HTTP email links", () => {
    expect(safeEmailHref("https://example.ca/a?b=1&c=2")).toBe(
      "https://example.ca/a?b=1&amp;c=2",
    );
    expect(safeEmailHref("javascript:alert(1)")).toBe("#");
    expect(safeEmailHref("not a URL")).toBe("#");
  });
});
