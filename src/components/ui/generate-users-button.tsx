"use client";

import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { useState } from "react";

export type DemoUser = {
  name: string;
  userIcon: string;
  moneyPreference: "budget" | "moderate" | "premium";
  activityLevel: number;
  latitude?: number;
  longitude?: number;
  dietaryRestrictions?: string;
  healthConsciousness?: string;
};

interface GenerateUsersButtonProps {
  onGenerateUsers?: (count: number) => void;
  onAddUsers: (users: DemoUser[]) => Promise<void>;
}

export function GenerateUsersButton({
  onGenerateUsers,
  onAddUsers,
}: GenerateUsersButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      // Load demo users from JSON file
      const response = await fetch("/data/demo-users.json");
      if (!response.ok) {
        throw new Error("Failed to load demo users");
      }

      const demoUsers: DemoUser[] = (await response.json()) as DemoUser[];

      // Add all demo users to the event in parallel
      await onAddUsers(demoUsers);

      if (onGenerateUsers) {
        onGenerateUsers(demoUsers.length);
      }
    } catch (error) {
      console.error("Error generating demo users:", error);
      alert("Failed to add demo users. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isGenerating) return "Generating... ";

  return (
    <div
      className="relative w-full rounded-2xl border border-[#dab2ff] px-6 py-4"
      style={{
        background:
          "linear-gradient(30deg, #f3e8ff 0%, #e9d5ff 50%, #d8b4fe 100%)",
      }}
    >
      <div className="flex flex-col items-center gap-2.5">
        <p className="text-sm font-medium text-[#9810FA]">No friends?</p>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="h-auto w-full rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-[#9810FA] hover:bg-white/90 disabled:opacity-50"
        >
          {isGenerating ? "Adding users..." : "Populate with demo users"}
        </Button>
      </div>
    </div>
  );
}
