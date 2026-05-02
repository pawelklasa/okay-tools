import type { OKLCH } from "./oklch";

export interface SharedRampState {
  anchor: OKLCH;
  name: string;
  curve: "linear" | "ease";
}

export function encodeRamp(state: SharedRampState): string {
  const payload = `${state.name}|${state.anchor.l.toFixed(4)}|${state.anchor.c.toFixed(4)}|${state.anchor.h.toFixed(2)}|${state.curve}`;
  return btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeRamp(hash: string): SharedRampState | null {
  try {
    const normalised = hash.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalised + "===".slice((normalised.length + 3) % 4);
    const raw = atob(padded);
    const [name, l, c, h, curve] = raw.split("|");
    if (!name || !l || !c || !h) return null;
    return {
      name,
      anchor: { l: parseFloat(l), c: parseFloat(c), h: parseFloat(h) },
      curve: curve === "ease" ? "ease" : "linear",
    };
  } catch {
    return null;
  }
}
