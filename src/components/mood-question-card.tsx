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
        <div className="space-y-3">
          {scaleNumbers.map((num) => {
            const isSelected = value === num || value === String(num);
            return (
              <Button
                key={num}
                type="button"
                onClick={() => onChange(num)}
                variant={isSelected ? "selected" : "option"}
                className="w-full px-3 py-3 text-left text-sm sm:text-base h-auto justify-start"
              >
                {num}
              </Button>
            );
          })}
        </div>
      );
    }

    // Handle scale with options (e.g., ["Chill", "Balanced", "Hype"])
    return (
      <div className="space-y-3">
        {options.map((option, idx) => {
          const isSelected = value === option;
          return (
            <Button
              key={idx}
              type="button"
              onClick={() => onChange(option)}
              variant={isSelected ? "selected" : "option"}
              className="w-full px-3 py-3 text-left text-sm sm:text-base h-auto justify-start"
            >
              <span className="break-words">{option}</span>
            </Button>
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
            <Button
              key={idx}
              type="button"
              onClick={() => onChange(option)}
              variant={isSelected ? "selected" : "option"}
              className="w-full px-3 py-3 text-left text-sm sm:text-base h-auto justify-start"
            >
              <span className="break-words">{option}</span>
            </Button>
          );
        })}
      </div>
    );
  }
}
