"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import type { MoodQuestion } from "@/server/agents/mood-check";

type MoodQuestionCardProps = {
  question: MoodQuestion;
  value: string | number | undefined;
  onChange: (value: string | number) => void;
};

export function MoodQuestionCard({
  question,
  value,
  onChange,
}: MoodQuestionCardProps) {
  const { prompt, type, options } = question;

  return (
    <div className="mb-6 w-full">
      {/* Question Text */}
      <label className="mb-3 block text-sm font-medium text-[#0F172B]">
        {prompt}
      </label>

      {/* Answer Options */}
      <div>
        {type === "scale" && renderScaleOptions()}
        {type === "choice" && options && renderChoiceOptions()}
      </div>
    </div>
  );

  function renderScaleOptions() {
    // Handle numeric scale (1-5, 1-10, etc.) when no options provided
    if (!options || options.length === 0) {
      // Try to extract scale range from prompt
      const scaleRegex = /(\d+)\s*(?:to|-)\s*(\d+)/i;
      const scaleMatch = scaleRegex.exec(prompt);
      const min = scaleMatch ? parseInt(scaleMatch[1] ?? "1") : 1;
      const max = scaleMatch ? parseInt(scaleMatch[2] ?? "5") : 5;
      const scaleNumbers = Array.from(
        { length: max - min + 1 },
        (_, i) => min + i,
      );

      // For larger scales (7+), use a more compact layout
      const isLargeScale = scaleNumbers.length > 6;

      return (
        <div className="flex gap-2">
          {scaleNumbers.map((num) => {
            const isSelected = value === num || value === String(num);
            return (
              <button
                key={num}
                type="button"
                onClick={() => onChange(num)}
                className={`rounded-xl text-sm font-semibold transition-all ${
                  isLargeScale ? "min-w-0 flex-1 px-2 py-3" : "flex-1 px-4 py-3"
                } ${
                  isSelected
                    ? "bg-[#029DE2] text-white shadow-md"
                    : "border-2 border-[#029DE2] bg-[#EDF7FF] text-[#029DE2] hover:bg-[#029DE2] hover:text-white"
                }`}
              >
                {num}
              </button>
            );
          })}
        </div>
      );
    }

    // Handle scale with options (e.g., ["Chill", "Balanced", "Hype"])
    return (
      <div className="flex gap-2">
        {options.map((option, idx) => {
          const isSelected = value === option;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onChange(option)}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                isSelected
                  ? "bg-[#029DE2] text-white shadow-md"
                  : "border-2 border-[#029DE2] bg-[#EDF7FF] text-[#029DE2] hover:bg-[#029DE2] hover:text-white"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    );
  }

  function renderChoiceOptions() {
    if (!options) return null;

    return (
      <div className="space-y-3">
        {options.map((option, idx) => {
          const isSelected = value === option;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onChange(option)}
              className={`w-full rounded-xl px-4 py-4 text-left text-base font-medium transition-all ${
                isSelected
                  ? "bg-[#029DE2] text-white shadow-md"
                  : "border-2 border-[#029DE2] bg-[#EDF7FF] text-[#029DE2] hover:bg-[#029DE2] hover:text-white"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    );
  }
}
