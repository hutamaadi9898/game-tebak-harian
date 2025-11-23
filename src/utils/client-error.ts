export function reportClientError(error: unknown, context: Record<string, unknown> = {}) {
  try {
    const body = JSON.stringify({
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Error',
      stack: error instanceof Error ? error.stack : undefined,
      context
    });

    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      navigator.sendBeacon('/api/error', body);
      return;
    }

    void fetch('/api/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
  } catch (e) {
    console.error('reportClientError failed', e);
  }
}
