export function parseMapUrl(
  url: string
): { lat: number; lng: number; zoom?: number } | null {
  try {
    const urlObj = new URL(url);

    // Google Maps
    if (
      urlObj.hostname.includes("google.com") &&
      urlObj.pathname.startsWith("/maps")
    ) {
      const atPart = urlObj.pathname.split("/@")[1];
      if (atPart) {
        const parts = atPart.split(",");
        if (parts.length >= 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);
          let zoom: number | undefined;
          if (parts.length >= 3 && parts[2].endsWith("z")) {
            zoom = parseFloat(parts[2].slice(0, -1));
          }
          if (!isNaN(lat) && !isNaN(lng)) return { lat, lng, zoom };
        }
      }
      // Fallback?
    }

    // Apple Maps
    // Note: Apple Maps URLs often don't have zoom level
    if (urlObj.hostname.includes("apple.com")) {
      const center = urlObj.searchParams.get("center");
      if (center) {
        const parts = center.split(",");
        if (parts.length >= 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
        }
      }
      const coordinate = urlObj.searchParams.get("coordinate");
      if (coordinate) {
        const parts = coordinate.split(",");
        if (parts.length >= 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
        }
      }
    }

    // OpenStreetMap
    if (urlObj.hostname.includes("openstreetmap.org")) {
      const hash = urlObj.hash;
      if (hash.startsWith("#map=")) {
        const parts = hash.split("/");
        if (parts.length >= 3) {
          // parts[0] is #map=14
          const zoomPart = parts[0].split("=")[1];
          const zoom = parseFloat(zoomPart);
          const lat = parseFloat(parts[1]);
          const lng = parseFloat(parts[2]);
          if (!isNaN(lat) && !isNaN(lng)) return { lat, lng, zoom };
        }
      }
    }

    // Bing Maps
    if (urlObj.hostname.includes("bing.com")) {
      const cp = urlObj.searchParams.get("cp");
      if (cp) {
        const parts = cp.split("~");
        if (parts.length >= 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);
          let zoom: number | undefined;
          const lvl = urlObj.searchParams.get("lvl");
          if (lvl) {
            zoom = parseFloat(lvl);
          }
          if (!isNaN(lat) && !isNaN(lng)) return { lat, lng, zoom };
        }
      }
    }
  } catch (e) {
    // Invalid URL or parsing error
    return null;
  }
  return null;
}
