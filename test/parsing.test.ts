import { describe, expect, test } from "bun:test";

import { parseDetailHtml, parseListingHtml, parsePrice } from "../src/modules/paniers/service";

const listingHtml = await Bun.file("test/fixtures/listing.html").text();
const detailHtml = await Bun.file("test/fixtures/detail.html").text();
const detailNoCompHtml = await Bun.file("test/fixtures/detail-no-composition.html").text();

describe("parsePrice", () => {
  test.each([
    ["15,00 €", 15],
    ["20,00 €", 20],
    ["1 000,50 €", 1000.5],
    ["34,00\u00a0€", 34],
    ["0", 0],
  ])("parses %s to %d", (input, expected) => {
    expect(parsePrice(input)).toBe(expected);
  });
});

describe("parseListingHtml", () => {
  const paniers = parseListingHtml(listingHtml);

  test("extracts all unique products", () => {
    expect(paniers).toHaveLength(3);
  });

  test("deduplicates products from grid/list views", () => {
    const ids = paniers.map((p) => p.id);
    expect(ids).toEqual([3, 2, 4]);
  });

  test("parses product fields correctly", () => {
    const petit = paniers.find((p) => p.id === 3)!;
    expect(petit.name).toBe("LE PETIT PANIER");
    expect(petit.price).toBe(15);
    expect(petit.url).toBe(
      "https://www.panierdeladour.com/les-paniers-de-saison/3-le-panier-duo.html",
    );
    expect(petit.imageUrl).toBe(
      "https://www.panierdeladour.com/618-home_default/le-panier-duo.jpg",
    );
  });

  test("parses all prices correctly", () => {
    expect(paniers.map((p) => p.price)).toEqual([15, 20, 30]);
  });

  test("returns empty array for empty HTML", () => {
    expect(parseListingHtml("<html><body></body></html>")).toEqual([]);
  });
});

describe("parseDetailHtml", () => {
  const detail = parseDetailHtml(detailHtml, 1);

  test("extracts product name", () => {
    expect(detail.name).toBe("LE PANIER BIO");
  });

  test("extracts price from content attribute", () => {
    expect(detail.price).toBe(20);
  });

  test("extracts description from first paragraph", () => {
    expect(detail.description).toContain("Assortiment de fruits et légumes");
  });

  test("extracts weight", () => {
    expect(detail.weight).toBe("ENVIRON 4 KG");
  });

  test("extracts servings", () => {
    expect(detail.servings).toBe("pour 1 à 2 personnes");
  });

  test("extracts product image", () => {
    expect(detail.imageUrl).toBe(
      "https://www.panierdeladour.com/617-large_default/le-panier-bio.jpg",
    );
  });

  test("extracts composition items", () => {
    expect(detail.composition).toEqual([
      { name: "THYM", origin: "Landes 40" },
      { name: "BETTERAVE CRUE", origin: "Landes 40" },
      { name: "PANAIS", origin: "Sud-ouest" },
      { name: "POMELO", origin: "Espagne" },
    ]);
  });

  test("handles product page without composition table", () => {
    const noComp = parseDetailHtml(detailNoCompHtml, 360);
    expect(noComp.name).toBe("CORBEILLE DE FRUIT A OFFRIR");
    expect(noComp.price).toBe(34);
    expect(noComp.composition).toEqual([]);
  });

  test("handles missing description div gracefully", () => {
    const result = parseDetailHtml(detailHtml, 999);
    expect(result.description).toBe("");
    expect(result.weight).toBe("");
    expect(result.servings).toBe("");
    expect(result.composition).toEqual([]);
  });
});
