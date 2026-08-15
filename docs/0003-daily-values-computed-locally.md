# 3. Percent Daily Values are computed locally, never by the model

- Status: Accepted
- Date: 2026-08-15

## Context

The FDA label in `references/nfl-howtounderstand-labeled.png` has a %DV column. The model could be asked to fill it in — it already has the amounts.

LLMs are unreliable at arithmetic and inconsistent about which reference diet they use. A label that says "Sodium 850mg — 41%" is worse than no percentage: it looks authoritative and is wrong.

## Decision

The model returns **amounts only**, explicitly instructed not to include percent daily values. `lib/domain/nutrition.ts` holds the FDA 2,000-calorie reference values (21 CFR 101.9) and computes every percentage:

- `percentDV(macroKey, amount)` → whole percent, or `null` where no DV exists.
- `percentDVMicro(name, amount, unit)` → looks the nutrient up by lowercase name, converts g/mg/mcg to a common unit, then divides. Returns `null` for unknown nutrients and for non-mass units such as IU.

Trans fat, unsaturated fat and total sugars render a blank %DV cell, as the real label does.

## Consequences

- Percentages are deterministic and auditable, and the test suite pins them against the reference label (sodium 850 mg → 37%, saturated fat 4.5 g → 23%).
- Adding a nutrient means adding one line to `MICRO_DV`, not re-prompting.
- The label footnote states that percentages are computed locally, so a user comparing against the model's prose sees why they may differ.
- Not supported: per-serving DV against anything other than the 2,000-calorie reference. If personalised targets are ever wanted, `DV_REFERENCE` becomes a parameter rather than a constant.
