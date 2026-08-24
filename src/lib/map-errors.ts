/** Leaflet/Google Maps teardown often throws after the pane is gone. */

let mapRuntimeCount = 0;
let guardInstalled = false;

export function beginMapRuntime(): () => void {
  mapRuntimeCount += 1;
  installMapErrorGuard();
  return () => {
    mapRuntimeCount = Math.max(0, mapRuntimeCount - 1);
  };
}

export function isBenignMapRuntimeError(message: string, stack = ""): boolean {
  const text = `${message}\n${stack}`;
  if (/_leaflet_pos/.test(text)) return true;
  if (/Cannot read properties of undefined \(reading '_leaflet/.test(text)) return true;
  if (mapRuntimeCount > 0 && (message === "Script error." || message === "Script error"))
    return true;
  return false;
}

function installMapErrorGuard() {
  if (guardInstalled || typeof window === "undefined") return;
  guardInstalled = true;

  window.addEventListener(
    "error",
    (event) => {
      const stack = event.error instanceof Error ? (event.error.stack ?? "") : "";
      if (!isBenignMapRuntimeError(event.message, stack)) return;
      event.preventDefault();
    },
    true,
  );

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason ?? "");
    const stack = reason instanceof Error ? (reason.stack ?? "") : "";
    if (!isBenignMapRuntimeError(message, stack)) return;
    event.preventDefault();
  });
}

export function swallowMapTeardown(run: () => void) {
  try {
    run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    const stack = error instanceof Error ? (error.stack ?? "") : "";
    if (!isBenignMapRuntimeError(message, stack)) throw error;
  }
}
