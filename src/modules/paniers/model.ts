import type { TSchema } from "@sinclair/typebox";
import { Elysia, t } from "elysia";

export const CompositionItem = t.Object(
  {
    name: t.String({ description: "Name of the product", example: "Pommes" }),
    origin: t.String({
      description: "Geographic origin of the product",
      example: "France, Pyrénées-Atlantiques",
    }),
  },
  { description: "A product included in the basket with its origin" },
);
export type CompositionItem = typeof CompositionItem.static;

export const PanierSummary = t.Object(
  {
    id: t.Number({ description: "Unique product ID on panierdeladour.com", example: 42 }),
    name: t.String({ description: "Display name of the basket", example: "Le Panier Classique" }),
    price: t.Number({ description: "Price in euros", example: 24.9 }),
    url: t.String({
      description: "Full URL to the product page on panierdeladour.com",
      example: "https://www.panierdeladour.com/paniers-de-saison/42-le-panier-classique.html",
    }),
    imageUrl: t.String({
      description: "URL of the product image",
      example: "https://www.panierdeladour.com/img/p/42-100-large_default.jpg",
    }),
  },
  { description: "Summary of a seasonal basket" },
);
export type PanierSummary = typeof PanierSummary.static;

export const PanierDetail = t.Object(
  {
    id: t.Number({ description: "Unique product ID on panierdeladour.com", example: 42 }),
    name: t.String({ description: "Display name of the basket", example: "Le Panier Classique" }),
    price: t.Number({ description: "Price in euros", example: 24.9 }),
    description: t.String({
      description: "Short marketing description of the basket",
      example: "Un assortiment de légumes de saison",
    }),
    weight: t.String({
      description: "Approximate weight of the basket",
      example: "environ 5 kg",
    }),
    servings: t.String({
      description: "Suggested serving size",
      example: "pour 4 à 5 personnes",
    }),
    imageUrl: t.String({
      description: "URL of the product image",
      example: "https://www.panierdeladour.com/img/p/42-100-large_default.jpg",
    }),
    composition: t.Array(CompositionItem, {
      description: "List of products included in the basket with their origins",
    }),
  },
  { description: "Full details of a seasonal basket, including composition" },
);
export type PanierDetail = typeof PanierDetail.static;

export const TimestampedResponse = <T extends TSchema>(dataSchema: T) =>
  t.Object({
    data: dataSchema,
    lastUpdated: t.String({
      format: "date-time",
      description: "ISO 8601 timestamp of when the data was last fetched from the upstream site",
      example: "2026-03-28T10:30:00.000Z",
    }),
  });

export type TimestampedResult<T> = { data: T; lastUpdated: string };

export const panierModels = new Elysia({ name: "paniers.models" }).model({
  "panier.summary": PanierSummary,
  "panier.detail": TimestampedResponse(PanierDetail),
  "panier.list": TimestampedResponse(t.Array(PanierSummary)),
});
