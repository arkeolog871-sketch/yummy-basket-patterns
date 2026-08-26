import { escapeHtml } from "@/lib/escape-html";

export type MapPopupMarker = {
  title: string;
  href?: string;
  address?: string | null;
};

/** Pin popup: işletme adı, varsa kendi uygulama sayfasına giden bağlantıdır. */
export function businessPinPopupHtml(marker: MapPopupMarker) {
  const address = marker.address
    ? `<p style="margin:4px 0 0;font-size:12px;opacity:.75">${escapeHtml(marker.address)}</p>`
    : "";
  const title = marker.href
    ? `<a href="${escapeHtml(marker.href)}" style="font-weight:600;color:#c8341f">${escapeHtml(marker.title)}</a>`
    : `<strong>${escapeHtml(marker.title)}</strong>`;
  return `<div style="min-width:160px">${title}${address}</div>`;
}
