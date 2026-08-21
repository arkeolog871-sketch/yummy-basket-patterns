declare global {
  interface Window {
    google?: {
      maps?: {
        Map: new (container: HTMLElement, options: Record<string, unknown>) => GoogleMap;
        Marker: new (options: Record<string, unknown>) => GoogleMarker;
        InfoWindow: new (options: Record<string, unknown>) => GoogleInfoWindow;
        LatLngBounds: new () => GoogleLatLngBounds;
      };
    };
  }

  interface GoogleMap {
    setCenter(center: { lat: number; lng: number }): void;
    fitBounds(bounds: GoogleLatLngBounds): void;
  }

  interface GoogleMarker {
    setMap(map: GoogleMap | null): void;
    addListener(event: string, handler: () => void): void;
  }

  interface GoogleInfoWindow {
    open(options: { map: GoogleMap; anchor?: GoogleMarker }): void;
    close(): void;
    setContent(content: string | HTMLElement): void;
  }

  interface GoogleLatLngBounds {
    extend(point: { lat: number; lng: number }): void;
  }
}

export {};
