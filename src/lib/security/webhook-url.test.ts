import { describe, expect, it } from "vitest";
import {
  isPrivateOrReservedAddress,
  parsePublicWebhookUrl,
} from "./webhook-url";

describe("webhook URL security", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.2.3",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
  ])("blocks private or reserved address %s", (address) => {
    expect(isPrivateOrReservedAddress(address)).toBe(true);
  });

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])(
    "allows public address %s",
    (address) => {
      expect(isPrivateOrReservedAddress(address)).toBe(false);
    },
  );

  it.each([
    "http://example.com/hook",
    "https://localhost/hook",
    "https://service.internal/hook",
    "https://127.0.0.1/hook",
    "https://user:pass@example.com/hook",
  ])("rejects unsafe URL %s", (url) => {
    expect(() => parsePublicWebhookUrl(url)).toThrow();
  });

  it("accepts a public HTTPS URL", () => {
    expect(
      parsePublicWebhookUrl("https://hooks.example.com/zonning").href,
    ).toBe("https://hooks.example.com/zonning");
  });
});
