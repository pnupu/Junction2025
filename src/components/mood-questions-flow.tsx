"use client";

import React, { useState } from "react";
import { api } from "@/trpc/react";
import { MoodQuestionCard } from "@/components/mood-question-card";
import type { MoodQuestion } from "@/server/agents/mood-check";

type MoodQuestionsFlowProps = {
  groupId: string;
  sessionId: string;
  participantName?: string;
  onComplete?: () => void;
};

// Hook version for easier use
export function useMoodQuestionsFlow({
  groupId,
  sessionId,
  participantName,
  onComplete,
}: MoodQuestionsFlowProps) {
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: moodData,
    isLoading,
    refetch,
  } = api.event.getMoodQuestions.useQuery(
    {
      groupId,
      sessionId,
      participantName,
      answeredSignals: undefined,
    },
    {
      enabled: !!groupId && !!sessionId && groupId !== "" && sessionId !== "",
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
    },
  );

  const saveMoodResponses = api.event.saveMoodResponses.useMutation({
    onSuccess: async () => {
      setAnswers({});
      setIsSubmitting(false);

      // Refetch and complete
      await refetch();

      // All questions answered
      if (onComplete) {
        onComplete();
      }
    },
    onError: (error) => {
      console.error("Failed to save mood responses:", error);
      setIsSubmitting(false);
    },
  });

  const handleAnswerChange = (
    questionId: string,
    signalKey: string,
    value: string | number,
  ) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = () => {
    const questions = moodData?.questions ?? [];
    if (questions.length === 0) return;

    // Check if all questions are answered
    const unanswered = questions.filter(
      (q) => answers[q.id] === undefined || answers[q.id] === "",
    );
    if (unanswered.length > 0) {
      return;
    }

    setIsSubmitting(true);

    // Map answers to signalKey format
    const responses: Record<string, string | number> = {};
    for (const question of questions) {
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

  const questions = moodData?.questions ?? [];
  const followUp = moodData?.followUp;
  const allAnswered =
    questions.length > 0 &&
    questions.every((q) => answers[q.id] !== undefined && answers[q.id] !== "");

  return {
    isLoading,
    hasQuestions: questions.length > 0,
    questions,
    followUp,
    answers,
    handleAnswerChange,
    handleSubmit,
    isSubmitting,
    allAnswered,
  };
}
