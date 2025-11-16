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
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {scaleNumbers.map((num) => {
            const isSelected = value === num || value === String(num);
            return (
              <button
                key={num}
                type="button"
                onClick={() => onChange(num)}
                className={`w-full rounded-xl text-xs sm:text-sm font-semibold transition-all sm:flex-1 ${
                  isLargeScale ? "px-1 py-2 sm:px-2 sm:py-3" : "px-2 py-2 sm:px-4 sm:py-3"
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
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {options.map((option, idx) => {
          const isSelected = value === option;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onChange(option)}
              className={`w-full rounded-xl px-3 py-3 text-xs sm:text-sm font-semibold transition-all sm:flex-1 ${
                isSelected
                  ? "bg-[#029DE2] text-white shadow-md"
                  : "border-2 border-[#029DE2] bg-[#EDF7FF] text-[#029DE2] hover:bg-[#029DE2] hover:text-white"
              }`}
            >
              <span className="break-words">{option}</span>
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
              className={`w-full rounded-xl px-3 py-3 text-left text-sm sm:text-base font-medium transition-all ${
                isSelected
                  ? "bg-[#029DE2] text-white shadow-md"
                  : "border-2 border-[#029DE2] bg-[#EDF7FF] text-[#029DE2] hover:bg-[#029DE2] hover:text-white"
              }`}
            >
              <span className="break-words">{option}</span>
            </button>
          );
        })}
      </div>
    );
  }
}
