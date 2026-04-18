export interface TimestampedResult<T> {
  data: T;
  /** ISO 8601 timestamp of when the data was last fetched from the upstream site */
  lastUpdated: string;
}

export interface PanierSummary {
  id: number;
  name: string;
  price: number;
  url: string;
  imageUrl: string;
}

export interface CompositionItem {
  name: string;
  origin: string;
}

export interface PanierDetail {
  id: number;
  name: string;
  price: number;
  description: string;
  weight: string;
  servings: string;
  imageUrl: string;
  composition: CompositionItem[];
}

export interface Movie {
  id: string;
  title: string;
  genres: string;
  production: string;
  casting: string[];
  direction: string[];
  poster: string;
  /** ISO 8601 release date */
  releaseDate: string;
  /** Runtime in seconds */
  runtime: number;
  synopsis: string;
  url: string;
}
