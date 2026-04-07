export const MARKET_DATA_REFRESH_EVENT = "tds:market-data-refresh";
export const MARKET_DATA_REFRESH_STORAGE_KEY = "tds-market-data-refresh-token";

export function getStoredMarketDataRefreshToken(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(MARKET_DATA_REFRESH_STORAGE_KEY);
  const token = Number(rawValue);
  return Number.isFinite(token) && token > 0 ? token : null;
}

export function formatMarketDataRefreshTime(token: number | null): string {
  if (!token) {
    return "Not manually refreshed this session";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(token);
}

export function broadcastMarketDataRefresh(reason = "manual"): number {
  const token = Date.now();

  if (typeof window !== "undefined") {
    window.localStorage.setItem(MARKET_DATA_REFRESH_STORAGE_KEY, String(token));
    window.dispatchEvent(new CustomEvent(MARKET_DATA_REFRESH_EVENT, { detail: { token, reason } }));
  }

  return token;
}

export function subscribeToMarketDataRefresh(onRefresh: (token: number) => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onCustomRefresh = (event: Event) => {
    const detail = (event as CustomEvent<{ token?: number }>).detail;
    onRefresh(typeof detail?.token === "number" ? detail.token : Date.now());
  };

  const onStorageRefresh = (event: StorageEvent) => {
    if (event.key !== MARKET_DATA_REFRESH_STORAGE_KEY) {
      return;
    }

    const token = Number(event.newValue ?? Date.now());
    onRefresh(Number.isFinite(token) ? token : Date.now());
  };

  window.addEventListener(MARKET_DATA_REFRESH_EVENT, onCustomRefresh as EventListener);
  window.addEventListener("storage", onStorageRefresh);

  return () => {
    window.removeEventListener(MARKET_DATA_REFRESH_EVENT, onCustomRefresh as EventListener);
    window.removeEventListener("storage", onStorageRefresh);
  };
}