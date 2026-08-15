"use client";

import { useState } from "react";
import Chat from "@/components/Chat";
import Dropzone from "@/components/Dropzone";
import NutritionLabel from "@/components/NutritionLabel";
import type { NutritionFacts } from "@/lib/domain/nutrition";
import type { AnalysisResult } from "@/lib/ports/food-analyzer";

type Status = "idle" | "analyzing" | "done";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze(imageDataUrl: string) {
    setImage(imageDataUrl);
    setResult(null);
    setError(null);
    setStatus("analyzing");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });
      const body = (await res.json()) as AnalysisResult & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Couldn't analyse that photo. Try again.");

      setResult({ facts: body.facts as NutritionFacts, citations: body.citations ?? [] });
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't analyse that photo. Try again.");
      setImage(null);
      setStatus("idle");
    }
  }

  function reset() {
    setStatus("idle");
    setImage(null);
    setResult(null);
    setError(null);
  }

  return (
    <main className="wrap">
      <header className="app-header">
        <div className="brand">
          <span className="brand-dot" aria-hidden />
          Meal Snap
        </div>
        {status === "idle" && (
          <>
            <h1>Know what&apos;s on your plate.</h1>
            <p>
              Drop a photo of your meal. We identify every item and its portion, look up real nutrition data, and
              give you a full label — then answer whatever you want to ask about it.
            </p>
          </>
        )}
      </header>

      {status === "idle" && <Dropzone onImage={analyze} error={error} />}

      {status === "analyzing" && image && (
        <div className="cols">
          <div className="card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="photo" src={image} alt="Your uploaded meal" />
            <ul className="steps">
              <li className="done">Identifying items and portions…</li>
              <li>Searching nutrition facts per item</li>
              <li>Scaling by quantity and totalling</li>
            </ul>
          </div>
          <div className="card">
            <div className="sk t" />
            <div className="sk" style={{ width: "90%" }} />
            <div className="sk" style={{ width: "75%" }} />
            <div className="sk" style={{ width: "85%" }} />
            <div className="sk" style={{ width: "60%" }} />
          </div>
        </div>
      )}

      {status === "done" && image && result && (
        <>
          <div className="cols">
            <div className="card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="photo" src={image} alt="Your uploaded meal" />
              <p className="kicker">
                Identified · {result.facts.items.length} item{result.facts.items.length === 1 ? "" : "s"}
              </p>
              <ul className="items">
                {result.facts.items.map((item) => (
                  <li key={`${item.name}-${item.unit}`}>
                    <span>{item.name}</span>
                    <span className="q">
                      {item.unit === "piece" || item.unit === "serving"
                        ? `× ${item.quantity}`
                        : `${item.quantity} ${item.unit}`}
                    </span>
                  </li>
                ))}
                {result.facts.items.length === 0 && <li>No food identified in this photo.</li>}
              </ul>
              <div className="annot">
                <span>
                  Estimated from the photo · confidence: {result.facts.confidence}
                  {result.facts.notes ? ` · ${result.facts.notes}` : ""}
                </span>
                <button type="button" className="btn ghost" onClick={reset}>
                  Replace photo
                </button>
              </div>
            </div>

            <NutritionLabel facts={result.facts} citations={result.citations} />
          </div>

          <Chat imageDataUrl={image} facts={result.facts} />
        </>
      )}
    </main>
  );
}
