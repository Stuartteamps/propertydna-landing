/// <reference types="vite/client" />

declare module '@deck.gl/core' {
  export class Deck { constructor(props: any); setProps(props: any): void; finalize(): void; }
  export class Layer {}
}
declare module '@deck.gl/aggregation-layers' {
  export class HexagonLayer { constructor(props: any); }
  export class HeatmapLayer { constructor(props: any); }
}
declare module '@deck.gl/layers' {
  export class ScatterplotLayer { constructor(props: any); }
  export class GeoJsonLayer { constructor(props: any); }
}
declare module '@deck.gl/mapbox' {
  export class MapboxLayer { constructor(props: any); }
}
