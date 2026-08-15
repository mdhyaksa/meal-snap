import { fmt, percentDV, percentDVMicro, type MacroKey, type NutritionFacts } from "@/lib/domain/nutrition";
import type { Citation } from "@/lib/ports/food-analyzer";

function Row({
  label,
  amount,
  unit,
  nutrient,
  bold,
  indent,
}: {
  label: string;
  amount: number;
  unit: string;
  nutrient?: MacroKey;
  bold?: boolean;
  indent?: 1 | 2;
}) {
  const dv = nutrient ? percentDV(nutrient, amount) : null;
  return (
    <div className={`row${bold ? " b" : ""}${indent === 1 ? " i" : indent === 2 ? " ii" : ""}`}>
      <span>
        {label} {fmt(amount)}
        {unit}
      </span>
      <span>{dv === null ? "" : `${dv}%`}</span>
    </div>
  );
}

export default function NutritionLabel({
  facts,
  citations,
}: {
  facts: NutritionFacts;
  citations: Citation[];
}) {
  return (
    <div>
      <div className="label">
        <div className="r-med" />
        <h2>Nutrition Facts</h2>
        <div className="r-thin" style={{ paddingTop: 4 }}>
          {facts.servings} serving{facts.servings === 1 ? "" : "s"} per plate
        </div>
        <div className="serv">
          <span>Serving size</span>
          <span>{facts.servingLabel}</span>
        </div>

        <div className="r-thick" />
        <div className="cal-block">
          <div className="cal-label">
            <small>Amount per serving</small>
            Calories
          </div>
          <div className="cal-value">{fmt(facts.calories)}</div>
        </div>

        <div className="dvhead">% Daily Value*</div>
        <Row label="Total Fat" amount={facts.totalFat_g} unit="g" nutrient="totalFat_g" bold />
        <Row label="Saturated Fat" amount={facts.saturatedFat_g} unit="g" nutrient="saturatedFat_g" indent={1} />
        <div className="row i">
          <span>
            <i>Trans</i> Fat {fmt(facts.transFat_g)}g
          </span>
          <span />
        </div>
        {facts.unsaturatedFat_g > 0 && (
          <Row label="Unsaturated Fat" amount={facts.unsaturatedFat_g} unit="g" indent={1} />
        )}
        <Row label="Cholesterol" amount={facts.cholesterol_mg} unit="mg" nutrient="cholesterol_mg" bold />
        <Row label="Sodium" amount={facts.sodium_mg} unit="mg" nutrient="sodium_mg" bold />
        <Row label="Total Carbohydrate" amount={facts.totalCarbs_g} unit="g" nutrient="totalCarbs_g" bold />
        <Row label="Dietary Fiber" amount={facts.fiber_g} unit="g" nutrient="fiber_g" indent={1} />
        <Row label="Total Sugars" amount={facts.totalSugars_g} unit="g" indent={1} />
        <Row
          label="Includes Added Sugars"
          amount={facts.addedSugars_g}
          unit="g"
          nutrient="addedSugars_g"
          indent={2}
        />
        <Row label="Protein" amount={facts.protein_g} unit="g" nutrient="protein_g" bold />

        <div className="r-thick" />
        {facts.micronutrients.map((m) => {
          const dv = percentDVMicro(m.name, m.amount, m.unit);
          return (
            <div className="row plain" key={`${m.name}-${m.unit}`} style={{ borderTop: 0 }}>
              <span>
                {m.name} {fmt(m.amount)}
                {m.unit}
              </span>
              <span>{dv === null ? "" : `${dv}%`}</span>
            </div>
          );
        })}

        <div className="r-med" />
        <p className="foot">
          * The % Daily Value tells you how much a nutrient contributes to a daily diet. 2,000 calories a day is
          used for general nutrition advice. Percentages are computed locally from FDA reference values — trans
          and unsaturated fat have no established Daily Value.
        </p>
      </div>

      {citations.length > 0 && (
        <p className="src">
          Sources:{" "}
          {citations.map((c, i) => (
            <span key={c.url}>
              {i > 0 && " · "}
              <a href={c.url} target="_blank" rel="noopener noreferrer" title={c.title}>
                {/* Google grounding returns redirect URLs, so the title carries the real source. */}
                {c.title || new URL(c.url).hostname.replace(/^www\./, "")}
              </a>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
