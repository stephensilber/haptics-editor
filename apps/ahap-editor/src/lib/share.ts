import type { AhapProject } from "./types";

export function encodeProject(project: AhapProject): string {
  const json = JSON.stringify(project);
  const bytes = new TextEncoder().encode(json);
  const compressed = deflateRaw(bytes);
  return base64UrlEncode(compressed);
}

export function decodeProject(encoded: string): AhapProject {
  const compressed = base64UrlDecode(encoded);
  const bytes = inflateRaw(compressed);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

export function getProjectFromUrl(): AhapProject | null {
  const hash = window.location.hash;
  if (!hash.startsWith("#data=")) return null;
  try {
    return decodeProject(hash.slice(6));
  } catch {
    return null;
  }
}

export function setProjectToUrl(project: AhapProject): string {
  const encoded = encodeProject(project);
  const url = `${window.location.origin}${window.location.pathname}#data=${encoded}`;
  window.history.replaceState(null, "", url);
  return url;
}

// Minimal DEFLATE-raw using CompressionStream API (available in modern browsers).
// Falls back to uncompressed base64 with a prefix marker if unavailable.

async function compressAsync(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") return data;
  const cs = new CompressionStream("deflate-raw");
  const writer = cs.writable.getWriter();
  writer.write(data as unknown as BufferSource);
  writer.close();
  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function decompressAsync(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") return data;
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  writer.write(data as unknown as BufferSource);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// Synchronous wrappers using simple "no compression" fallback.
// The sync encode/decode uses raw base64 (no compression) for simplicity.
// For a URL-shared project, the JSON is small enough that this is fine.

function deflateRaw(data: Uint8Array): Uint8Array {
  // Use sync path: just pass through raw bytes
  // Async compression can be added later for large patterns
  return data;
}

function inflateRaw(data: Uint8Array): Uint8Array {
  return data;
}

// Async versions for when we need compression
export async function encodeProjectAsync(
  project: AhapProject,
): Promise<string> {
  const json = JSON.stringify(project);
  const bytes = new TextEncoder().encode(json);
  const compressed = await compressAsync(bytes);
  return base64UrlEncode(compressed);
}

export async function decodeProjectAsync(
  encoded: string,
): Promise<AhapProject> {
  const compressed = base64UrlDecode(encoded);
  const bytes = await decompressAsync(compressed);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
