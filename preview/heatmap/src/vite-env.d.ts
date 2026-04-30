/// <reference types="vite/client" />

declare module '@deck.gl/core' {
  export class Deck {
    constructor(props: any);
    setProps(props: any): void;
    finalize(): void;
  }
  export class Layer {}
  export class CompositeLayer extends Layer {}
}

declare module '@deck.gl/aggregation-layers' {
  export class HexagonLayer {
    constructor(props: any);
  }
  export class HeatmapLayer {
    constructor(props: any);
  }
}

declare module '@deck.gl/mapbox' {
  export class MapboxLayer {
    constructor(props: any);
  }
}

declare module 'deck.gl' {
  export * from '@deck.gl/core';
  export * from '@deck.gl/aggregation-layers';
}
