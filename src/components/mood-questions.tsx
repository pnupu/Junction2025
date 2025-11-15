"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import type { MoodQuestion } from "@/server/agents/mood-check";

type MoodQuestionsProps = {
  groupId: string;
  sessionId: string;
  participantName?: string;
  onComplete?: () => void;
};

export function MoodQuestions({
  groupId,
  sessionId,
  participantName,
  onComplete,
}: MoodQuestionsProps) {
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingDots, setLoadingDots] = useState(".");

  // Use query instead of mutation - enables better polling/refetching
  const {
    data: moodData,
    isLoading,
    refetch,
  } = api.event.getMoodQuestions.useQuery(
    {
      groupId,
      sessionId,
      participantName,
      answeredSignals: undefined, // Always read from DB
    },
    {
      // Only fetch when we have the required data
      enabled: !!groupId && !!sessionId,
      // Refetch when answers are saved (via refetch call)
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
    },
  );

  const currentQuestions = moodData?.questions ?? [];
  const followUp = moodData?.followUp;

  const saveMoodResponses = api.event.saveMoodResponses.useMutation({
    onSuccess: async () => {
      // Clear current answers
      setAnswers({});
      setIsSubmitting(false);
      
      // Refetch questions after saving (backend will read updated responses from DB)
      await refetch();
      
      // Optionally complete if callback provided
      if (onComplete) {
        onComplete();
      }
    },
    onError: (error) => {
      console.error("Failed to save mood responses:", error);
      setIsSubmitting(false);
    },
  });

  // Animate loading dots
  useEffect(() => {
    if (isLoading || isSubmitting) {
      const interval = setInterval(() => {
        setLoadingDots((prev) => {
          if (prev === ".") return "..";
          if (prev === "..") return "...";
          return ".";
        });
      }, 500);
      return () => clearInterval(interval);
    } else {
      // Reset to single dot when not loading
      setLoadingDots(".");
    }
  }, [isLoading, isSubmitting]);

  const handleAnswerChange = (questionId: string, value: string | number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = () => {
    if (currentQuestions.length === 0) return;

    // Check if all questions are answered
    const unanswered = currentQuestions.filter(
      (q) => answers[q.id] === undefined || answers[q.id] === "",
    );
    if (unanswered.length > 0) {
      // Highlight unanswered questions
      return;
    }

    setIsSubmitting(true);

    // Map answers to signalKey format
    const responses: Record<string, string | number> = {};
    for (const question of currentQuestions) {
      const answer = answers[question.id];
      if (answer !== undefined && answer !== "") {
        responses[question.signalKey] = answer;
      }
    }

    saveMoodResponses.mutate({
      groupId,
      sessionId,
      responses,
    });
  };

  const allAnswered = currentQuestions.every(
    (q) => answers[q.id] !== undefined && answers[q.id] !== "",
  );

  if (isLoading && currentQuestions.length === 0) {
    return (
      <div className="rounded-2xl bg-white/10 p-6 backdrop-blur">
        <div className="text-center">
          <div className="mb-2 text-lg font-semibold text-white">
            Quick mood check 🎯
          </div>
          <div className="text-sm text-white/70">
            Generating personalized questions{loadingDots}
          </div>
        </div>
      </div>
    );
  }

  if (currentQuestions.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-2xl bg-white/10 p-6 backdrop-blur">
      <h2 className="mb-4 text-lg font-semibold text-white">
        Quick mood check 🎯
      </h2>
      {followUp && (
        <p className="mb-4 text-sm text-white/80">{followUp}</p>
      )}
      <div className="space-y-6">
        {currentQuestions.map((question) => (
          <QuestionInput
            key={question.id}
            question={question}
            value={answers[question.id]}
            onChange={(value) => handleAnswerChange(question.id, value)}
          />
        ))}
      </div>
      <div className="mt-6 flex gap-3">
        <Button
          onClick={handleSubmit}
          disabled={!allAnswered || isSubmitting}
          className="flex-1 rounded-xl bg-white text-base font-semibold text-[#029DE2] hover:bg-white/90 disabled:opacity-50"
        >
          {isSubmitting ? `Saving${loadingDots}` : "Continue"}
        </Button>
      </div>
    </div>
  );
}

type QuestionInputProps = {
  question: MoodQuestion;
  value: string | number | undefined;
  onChange: (value: string | number) => void;
};

function QuestionInput({ question, value, onChange }: QuestionInputProps) {
  const { prompt, type, options } = question;

  if (type === "scale") {
    // Handle numeric scale (1-5, 1-10, etc.) when no options provided
    if (!options || options.length === 0) {
      // Try to extract scale range from prompt (e.g., "1 to 5", "1-10")
      const scaleRegex = /(\d+)\s*(?:to|-)\s*(\d+)/i;
      const scaleMatch = scaleRegex.exec(prompt);
      const min = scaleMatch ? parseInt(scaleMatch[1] ?? "1") : 1;
      const max = scaleMatch ? parseInt(scaleMatch[2] ?? "5") : 5;
      const scaleNumbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);

      // For larger scales (7+), use a more compact layout
      const isLargeScale = scaleNumbers.length > 6;
      
      return (
        <div>
          <label className="mb-3 block text-sm font-medium text-white">
            {prompt}
          </label>
          <div className="flex gap-1.5">
            {scaleNumbers.map((num) => {
              const isSelected = value === num || value === String(num);
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => onChange(num)}
                  className={`rounded-lg text-sm font-medium transition-all ${
                    isLargeScale
                      ? "flex-1 min-w-0 px-1.5 py-2"
                      : "flex-1 px-3 py-2.5"
                  } ${
                    isSelected
                      ? "bg-white text-[#029DE2] shadow-md"
                      : "bg-white/20 text-white hover:bg-white/30"
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // Handle scale with options (e.g., ["Chill", "Balanced", "Hype"])
    return (
      <div>
        <label className="mb-3 block text-sm font-medium text-white">
          {prompt}
        </label>
        <div className="flex gap-2">
          {options.map((option, idx) => {
            const isSelected = value === option;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onChange(option)}
                className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                  isSelected
                    ? "bg-white text-[#029DE2] shadow-md"
                    : "bg-white/20 text-white hover:bg-white/30"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === "choice" && options) {
    return (
      <div>
        <label className="mb-3 block text-sm font-medium text-white">
          {prompt}
        </label>
        <div className="space-y-2">
          {options.map((option, idx) => {
            const isSelected = value === option;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onChange(option)}
                className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-all ${
                  isSelected
                    ? "bg-white text-[#029DE2] shadow-md"
                    : "bg-white/20 text-white hover:bg-white/30"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    );
  }


  return null;
}

