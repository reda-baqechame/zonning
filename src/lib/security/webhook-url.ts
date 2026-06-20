import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal"];

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null;
  }
  return parts;
}

export function isPrivateOrReservedAddress(rawAddress: string): boolean {
  const address = rawAddress.replace(/^\[|\]$/g, "").toLowerCase();
  const mappedIpv4 = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = parseIpv4(mappedIpv4 ?? address);

  if (ipv4) {
    const [a, b, c] = ipv4;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  if (isIP(address) === 6) {
    return (
      address === "::" ||
      address === "::1" ||
      address.startsWith("fc") ||
      address.startsWith("fd") ||
      /^fe[89ab]/.test(address) ||
      address.startsWith("2001:db8:")
    );
  }

  return true;
}

export function parsePublicWebhookUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Webhook URL is invalid");
  }

  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:") {
    throw new Error("Webhook URL must use HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("Webhook URL cannot contain credentials");
  }
  if (
    hostname === "localhost" ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix)) ||
    (isIP(hostname) > 0 && isPrivateOrReservedAddress(hostname))
  ) {
    throw new Error("Webhook URL must resolve to a public host");
  }
  return url;
}

export async function assertPublicWebhookUrl(input: string): Promise<URL> {
  const url = parsePublicWebhookUrl(input);
  if (isIP(url.hostname) > 0) return url;

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateOrReservedAddress(address))
  ) {
    throw new Error("Webhook URL must resolve only to public IP addresses");
  }
  return url;
}
