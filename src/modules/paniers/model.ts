import type { TSchema } from "@sinclair/typebox";
import { Elysia, t } from "elysia";

export const CompositionItem = t.Object({
  name: t.String(),
  origin: t.String(),
});
export type CompositionItem = typeof CompositionItem.static;

export const PanierSummary = t.Object({
  id: t.Number(),
  name: t.String(),
  price: t.Number(),
  url: t.String(),
  imageUrl: t.String(),
});
export type PanierSummary = typeof PanierSummary.static;

export const PanierDetail = t.Object({
  id: t.Number(),
  name: t.String(),
  price: t.Number(),
  description: t.String(),
  weight: t.String(),
  servings: t.String(),
  imageUrl: t.String(),
  composition: t.Array(CompositionItem),
});
export type PanierDetail = typeof PanierDetail.static;

export const TimestampedResponse = <T extends TSchema>(dataSchema: T) =>
  t.Object({
    data: dataSchema,
    lastUpdated: t.String({ format: "date-time" }),
  });

export type TimestampedResult<T> = { data: T; lastUpdated: string };

export const panierModels = new Elysia({ name: "paniers.models" }).model({
  "panier.summary": PanierSummary,
  "panier.detail": TimestampedResponse(PanierDetail),
  "panier.list": TimestampedResponse(t.Array(PanierSummary)),
});
