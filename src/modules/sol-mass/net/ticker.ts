/**
 * Calls `tick` about every `ms` — including while the tab is hidden, where requestAnimationFrame
 * stops altogether and the page's own timers drop to one a second. The host of an online arena
 * needs it: the arena lives on the host's device, and must not freeze for everybody when the host
 * looks at another tab. The beat comes from a worker, whose timers are not slowed down; where a
 * worker cannot be started, a page timer is the (slow in the background) fallback.
 *
 * Returns the function that stops it.
 */
export function startTicker(ms: number, tick: () => void): () => void {
  let stop: () => void = () => {};
  const usePageTimer = (): void => {
    const timer = setInterval(tick, ms);
    stop = () => clearInterval(timer);
  };

  try {
    const url = URL.createObjectURL(
      new Blob([`setInterval(() => postMessage(0), ${ms});`], {
        type: "text/javascript",
      }),
    );
    const worker = new Worker(url);
    const end = (): void => {
      worker.terminate();
      URL.revokeObjectURL(url);
    };
    worker.onmessage = tick;
    // A page that forbids blob workers reports it here, not as an exception.
    worker.onerror = () => {
      end();
      usePageTimer();
    };
    stop = end;
  } catch {
    usePageTimer();
  }
  return () => stop();
}
