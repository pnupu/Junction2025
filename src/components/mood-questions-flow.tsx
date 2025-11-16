"use client";

import React, { useState } from "react";
import { api, type RouterOutputs } from "@/trpc/react";
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

  const utils = api.useUtils();

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
    onMutate: async (variables) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await utils.event.get.cancel();

      // Snapshot the previous value - try both id and inviteCode
      const isLikelyInviteCode =
        groupId.length <= 10 && /^[A-Z0-9]+$/i.test(groupId);
      const queryKey = isLikelyInviteCode
        ? { inviteCode: groupId.toUpperCase() }
        : { id: groupId };

      const previousEventData = utils.event.get.getData(queryKey);

      // Optimistically update the event data to include mood responses
      if (previousEventData) {
        utils.event.get.setData(queryKey, (old) => {
          if (!old) return old;
          const updatedPreferences = old.preferences?.map((pref) => {
            if (pref.sessionId === sessionId) {
              return {
                ...pref,
                moodResponses: {
                  ...((pref as { moodResponses?: Record<string, unknown> })
                    .moodResponses ?? {}),
                  ...variables.responses,
                },
              };
            }
            return pref;
          });
          return {
            ...old,
            preferences: updatedPreferences,
          };
        });
      }

      // Return context with the snapshotted value and query key
      return { previousEventData, queryKey };
    },
    onError: (error, _variables, context) => {
      console.error("Failed to save mood responses:", error);
      setIsSubmitting(false);
      
      // Rollback optimistic update on error
      if (context?.previousEventData && context?.queryKey) {
        utils.event.get.setData(context.queryKey, context.previousEventData);
      }
    },
    onSuccess: (_data, _variables, context) => {
      setAnswers({});
      setIsSubmitting(false);

      // Invalidate to refetch fresh data (will handle both id and inviteCode)
      void utils.event.get.invalidate();
      
      // All questions answered
      if (onComplete) {
        onComplete();
      }
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
