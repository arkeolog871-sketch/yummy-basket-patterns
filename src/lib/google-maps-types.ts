export interface GoogleMap {
  setCenter(center: { lat: number; lng: number }): void;
  fitBounds(bounds: GoogleLatLngBounds): void;
  addListener(event: string, handler: () => void): void;
}

export interface GoogleMarker {
  setMap(map: GoogleMap | null): void;
  setPosition(position: { lat: number; lng: number }): void;
  addListener(event: string, handler: () => void): void;
}

export interface GoogleInfoWindow {
  open(options: { map: GoogleMap; anchor?: GoogleMarker }): void;
  close(): void;
  setContent(content: string | HTMLElement): void;
}

export interface GoogleLatLngBounds {
  extend(point: { lat: number; lng: number }): void;
}

export interface GoogleMapsLibrary {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => GoogleMap;
  Marker: new (options: Record<string, unknown>) => GoogleMarker;
  InfoWindow: new (options: Record<string, unknown>) => GoogleInfoWindow;
  LatLngBounds: new () => GoogleLatLngBounds;
  importLibrary?: (name: string) => Promise<unknown>;
}

export interface GoogleMapsWindow {
  google?: {
    maps?: GoogleMapsLibrary;
  };
}
