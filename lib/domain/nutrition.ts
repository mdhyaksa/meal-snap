/**
 * Domain core. Pure: no fetch, no React, no vendor types.
 * %DV is computed here, never taken from the model — models are unreliable at arithmetic.
 */

export type Confidence = "high" | "medium" | "low";

export type FoodItem = {
  name: string;
  quantity: number;
  unit: string;
  sourceQuery: string;
};

export type Micronutrient = {
  name: string;
  amount: number;
  unit: string;
};

/** Macro keys that carry an FDA Daily Value. */
export type MacroKey =
  | "totalFat_g"
  | "saturatedFat_g"
  | "transFat_g"
  | "unsaturatedFat_g"
  | "cholesterol_mg"
  | "sodium_mg"
  | "totalCarbs_g"
  | "fiber_g"
  | "totalSugars_g"
  | "addedSugars_g"
  | "protein_g";

export type NutritionFacts = {
  servings: number;
  servingLabel: string;
  items: FoodItem[];
  calories: number;
  totalFat_g: number;
  saturatedFat_g: number;
  transFat_g: number;
  unsaturatedFat_g: number;
  cholesterol_mg: number;
  sodium_mg: number;
  totalCarbs_g: number;
  fiber_g: number;
  totalSugars_g: number;
  addedSugars_g: number;
  protein_g: number;
  micronutrients: Micronutrient[];
  confidence: Confidence;
  notes: string;
};

/**
 * FDA Daily Values, 2,000 calorie reference diet (21 CFR 101.9(c)(8)(iv)).
 * Trans fat, unsaturated fat and total sugars have no established DV.
 */
export const DV_REFERENCE: Partial<Record<MacroKey, number>> = {
  totalFat_g: 78,
  saturatedFat_g: 20,
  cholesterol_mg: 300,
  sodium_mg: 2300,
  totalCarbs_g: 275,
  fiber_g: 28,
  addedSugars_g: 50,
  protein_g: 50,
};

/** Vitamin/mineral Daily Values, keyed by lowercase name. */
export const MICRO_DV: Record<string, { amount: number; unit: "mg" | "mcg" }> = {
  "vitamin a": { amount: 900, unit: "mcg" },
  "vitamin c": { amount: 90, unit: "mg" },
  "vitamin d": { amount: 20, unit: "mcg" },
  "vitamin e": { amount: 15, unit: "mg" },
  "vitamin k": { amount: 120, unit: "mcg" },
  thiamin: { amount: 1.2, unit: "mg" },
  riboflavin: { amount: 1.3, unit: "mg" },
  niacin: { amount: 16, unit: "mg" },
  "vitamin b6": { amount: 1.7, unit: "mg" },
  folate: { amount: 400, unit: "mcg" },
  "vitamin b12": { amount: 2.4, unit: "mcg" },
  biotin: { amount: 30, unit: "mcg" },
  "pantothenic acid": { amount: 5, unit: "mg" },
  choline: { amount: 550, unit: "mg" },
  calcium: { amount: 1300, unit: "mg" },
  iron: { amount: 18, unit: "mg" },
  phosphorus: { amount: 1250, unit: "mg" },
  iodine: { amount: 150, unit: "mcg" },
  magnesium: { amount: 420, unit: "mg" },
  zinc: { amount: 11, unit: "mg" },
  selenium: { amount: 55, unit: "mcg" },
  copper: { amount: 0.9, unit: "mg" },
  manganese: { amount: 2.3, unit: "mg" },
  chromium: { amount: 35, unit: "mcg" },
  molybdenum: { amount: 45, unit: "mcg" },
  chloride: { amount: 2300, unit: "mg" },
  potassium: { amount: 4700, unit: "mg" },
};

const MASS_IN_MG: Record<string, number> = { g: 1000, mg: 1, mcg: 0.001, µg: 0.001, ug: 0.001 };

/** %DV for a macro. null when the nutrient has no established Daily Value. */
export function percentDV(key: MacroKey, amount: number): number | null {
  const dv = DV_REFERENCE[key];
  if (!dv || !Number.isFinite(amount)) return null;
  return Math.round((amount / dv) * 100);
}

/** %DV for a vitamin/mineral. null when unknown nutrient or non-mass unit (e.g. IU). */
export function percentDVMicro(name: string, amount: number, unit: string): number | null {
  const dv = MICRO_DV[name.trim().toLowerCase()];
  if (!dv || !Number.isFinite(amount)) return null;
  const from = MASS_IN_MG[unit.trim().toLowerCase()];
  if (!from) return null;
  const amountMg = amount * from;
  const dvMg = dv.amount * MASS_IN_MG[dv.unit];
  return Math.round((amountMg / dvMg) * 100);
}

function num(value: unknown): number {
  const n = typeof value === "string" ? parseFloat(value.replace(/[^0-9.\-]/g, "")) : Number(value);
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/**
 * Coerce whatever the model produced into a NutritionFacts the label can render.
 * A sloppy payload must degrade, never crash the page.
 */
export function normalizeFacts(raw: unknown): NutritionFacts {
  const r = (raw ?? {}) as Record<string, unknown>;
  const confidence = str(r.confidence, "medium").toLowerCase();

  return {
    servings: Math.max(1, Math.round(num(r.servings) || 1)),
    servingLabel: str(r.servingLabel, "whole plate"),
    items: Array.isArray(r.items)
      ? r.items.map((i) => {
          const item = (i ?? {}) as Record<string, unknown>;
          return {
            name: str(item.name, "unidentified item"),
            quantity: num(item.quantity) || 1,
            unit: str(item.unit, "serving"),
            sourceQuery: str(item.sourceQuery),
          };
        })
      : [],
    calories: num(r.calories),
    totalFat_g: num(r.totalFat_g),
    saturatedFat_g: num(r.saturatedFat_g),
    transFat_g: num(r.transFat_g),
    unsaturatedFat_g: num(r.unsaturatedFat_g),
    cholesterol_mg: num(r.cholesterol_mg),
    sodium_mg: num(r.sodium_mg),
    totalCarbs_g: num(r.totalCarbs_g),
    fiber_g: num(r.fiber_g),
    totalSugars_g: num(r.totalSugars_g),
    addedSugars_g: num(r.addedSugars_g),
    protein_g: num(r.protein_g),
    micronutrients: Array.isArray(r.micronutrients)
      ? r.micronutrients
          .map((m) => {
            const micro = (m ?? {}) as Record<string, unknown>;
            return {
              name: str(micro.name),
              amount: num(micro.amount),
              unit: str(micro.unit, "mg"),
            };
          })
          .filter((m) => m.name)
      : [],
    confidence: (["high", "medium", "low"].includes(confidence) ? confidence : "medium") as Confidence,
    notes: str(r.notes),
  };
}

/** Display helper: 1285 -> "1,285", 0.75 -> "0.8". */
export function fmt(amount: number): string {
  const rounded = amount >= 10 ? Math.round(amount) : Math.round(amount * 10) / 10;
  return rounded.toLocaleString("en-US");
}
