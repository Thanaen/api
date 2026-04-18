import { parse } from "node-html-parser";

import { CacheRepository } from "../../db/cache-repository";
import { track } from "../../telemetry";
import { Cache, secondsUntilNextSaturday1am } from "./cache";
import type { CompositionItem, PanierDetail, PanierSummary, TimestampedResult } from "./model";

const BASE_URL = "https://www.panierdeladour.com";
const LISTING_PATH = "/5-les-paniers-de-saison";
const LISTING_CACHE_KEY = "paniers:list";
const FETCH_TIMEOUT = 10_000;
const SOURCE = "panierdeladour";

export function parsePrice(text: string): number {
  const cleaned = text.replace(/\s/g, "").replace("€", "").replace(",", ".");
  return parseFloat(cleaned);
}

async function fetchPage(url: string): Promise<string> {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    track("upstream_fetch", {
      source: SOURCE,
      url,
      status_code: response.status,
      ok: response.ok,
      duration_ms: Date.now() - startedAt,
    });
    if (!response.ok) {
      throw new Error(`Upstream responded with ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    track("upstream_fetch", {
      source: SOURCE,
      url,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - startedAt,
    });
    throw error;
  }
}

export function parseListingHtml(html: string): PanierSummary[] {
  const root = parse(html);
  const seen = new Set<number>();
  const paniers: PanierSummary[] = [];

  for (const el of root.querySelectorAll(".product-miniature.js-product-miniature")) {
    const id = Number(el.getAttribute("data-id-product"));
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const nameEl = el.querySelector(".product_name a");
    const name = nameEl?.text.trim() ?? "";
    const url = nameEl?.getAttribute("href") ?? "";
    const priceText = el.querySelector(".price")?.text ?? "0";
    const imageUrl = el.querySelector(".cover_image img")?.getAttribute("src") ?? "";

    paniers.push({
      id,
      name,
      price: parsePrice(priceText),
      url,
      imageUrl,
    });
  }

  return paniers;
}

export function parseDetailHtml(html: string, id: number): Omit<PanierDetail, "id"> {
  const root = parse(html);

  const name = root.querySelector('h1.h1[itemprop="name"]')?.text.trim() ?? "";
  const price = Number(root.querySelector('span[itemprop="price"]')?.getAttribute("content") ?? 0);

  const descDiv = root.querySelector(`#product-description-short-${id}[itemprop="description"]`);
  const fullText = descDiv?.text ?? "";

  const descriptionMatch = descDiv?.querySelector("p")?.text.trim() ?? "";
  const weightMatch = fullText.match(/environ\s+[\d,]+\s*kg/i);
  const servingsMatch = fullText.match(/pour\s+\d+\s+.*?\s+personnes/i);

  const composition: CompositionItem[] = [];
  if (descDiv) {
    for (const row of descDiv.querySelectorAll("table tr")) {
      const cells = row.querySelectorAll("td");
      if (cells.length >= 2) {
        const itemName = cells[0].text.trim();
        const origin = cells[1].text.trim();
        if (itemName) {
          composition.push({ name: itemName, origin });
        }
      }
    }
  }

  const imageUrl = root.querySelector(".js-qv-product-cover")?.getAttribute("src") ?? "";

  return {
    name,
    price,
    description: descriptionMatch,
    weight: weightMatch?.[0] ?? "",
    servings: servingsMatch?.[0] ?? "",
    imageUrl,
    composition,
  };
}

export abstract class PanierService {
  static async list(): Promise<TimestampedResult<PanierSummary[]>> {
    const cached = Cache.getWithMeta<PanierSummary[]>(LISTING_CACHE_KEY);
    if (cached) return cached;

    const dbCached = await CacheRepository.getWithMeta<PanierSummary[]>(LISTING_CACHE_KEY);
    if (dbCached) {
      Cache.set(LISTING_CACHE_KEY, dbCached.data, secondsUntilNextSaturday1am() * 1000);
      return dbCached;
    }

    const html = await fetchPage(BASE_URL + LISTING_PATH);
    const paniers = parseListingHtml(html);
    const lastUpdated = new Date().toISOString();

    Cache.set(LISTING_CACHE_KEY, paniers, secondsUntilNextSaturday1am() * 1000);
    await CacheRepository.set(LISTING_CACHE_KEY, paniers, secondsUntilNextSaturday1am() * 1000);

    return { data: paniers, lastUpdated };
  }

  static async detail(id: number): Promise<TimestampedResult<PanierDetail> | null> {
    const cacheKey = `paniers:detail:${id}`;

    const cached = Cache.getWithMeta<PanierDetail>(cacheKey);
    if (cached) return cached;

    const dbCached = await CacheRepository.getWithMeta<PanierDetail>(cacheKey);
    if (dbCached) {
      Cache.set(cacheKey, dbCached.data, secondsUntilNextSaturday1am() * 1000);
      return dbCached;
    }

    const { data: paniers } = await this.list();
    const panier = paniers.find((p) => p.id === id);
    if (!panier) return null;

    const html = await fetchPage(panier.url);
    const detail: PanierDetail = { id, ...parseDetailHtml(html, id) };
    const lastUpdated = new Date().toISOString();

    Cache.set(cacheKey, detail, secondsUntilNextSaturday1am() * 1000);
    await CacheRepository.set(cacheKey, detail, secondsUntilNextSaturday1am() * 1000);

    return { data: detail, lastUpdated };
  }
}
