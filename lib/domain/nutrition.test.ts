import { describe, expect, it } from "vitest";
import { fmt, normalizeFacts, percentDV, percentDVMicro } from "./nutrition";

describe("percentDV", () => {
  it("matches the FDA reference label", () => {
    expect(percentDV("sodium_mg", 850)).toBe(37); // 850 / 2300
    expect(percentDV("saturatedFat_g", 4.5)).toBe(23);
    expect(percentDV("totalCarbs_g", 34)).toBe(12);
    expect(percentDV("protein_g", 15)).toBe(30);
  });

  it("returns null for nutrients with no established DV", () => {
    expect(percentDV("transFat_g", 3)).toBeNull();
    expect(percentDV("unsaturatedFat_g", 28)).toBeNull();
    expect(percentDV("totalSugars_g", 6)).toBeNull();
  });
});

describe("percentDVMicro", () => {
  it("converts units before dividing", () => {
    expect(percentDVMicro("Calcium", 320, "mg")).toBe(25);
    expect(percentDVMicro("Vitamin D", 10, "mcg")).toBe(50);
    expect(percentDVMicro("Potassium", 4.7, "g")).toBe(100);
  });

  it("returns null for unknown nutrients and non-mass units", () => {
    expect(percentDVMicro("unobtainium", 5, "mg")).toBeNull();
    expect(percentDVMicro("Vitamin A", 500, "IU")).toBeNull();
  });
});

describe("normalizeFacts", () => {
  it("coerces strings, clamps negatives, and survives a missing payload", () => {
    const facts = normalizeFacts({
      calories: "1,285",
      totalFat_g: "63g",
      sodium_mg: -5,
      confidence: "LOW",
      items: [{ name: "cheese naan", quantity: "3" }],
    });

    expect(facts.calories).toBe(1285);
    expect(facts.totalFat_g).toBe(63);
    expect(facts.sodium_mg).toBe(0);
    expect(facts.protein_g).toBe(0);
    expect(facts.confidence).toBe("low");
    expect(facts.items[0]).toEqual({
      name: "cheese naan",
      quantity: 3,
      unit: "serving",
      sourceQuery: "",
    });
    expect(facts.micronutrients).toEqual([]);
    expect(() => normalizeFacts(null)).not.toThrow();
    expect(normalizeFacts(undefined).servings).toBe(1);
  });
});

describe("fmt", () => {
  it("groups thousands and keeps one decimal for small amounts", () => {
    expect(fmt(1285)).toBe("1,285");
    expect(fmt(0.75)).toBe("0.8");
    expect(fmt(63.4)).toBe("63");
  });
});
