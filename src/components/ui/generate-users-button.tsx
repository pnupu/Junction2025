"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";

interface GenerateUsersButtonProps {
  onGenerateUsers?: (count: number) => void;
}

export function GenerateUsersButton({ onGenerateUsers }: GenerateUsersButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock: Generate 3-5 demo users
    const userCount = Math.floor(Math.random() * 3) + 3;
    
    if (onGenerateUsers) {
      onGenerateUsers(userCount);
    }
    
    setIsGenerating(false);
  };

  return (
    <div className="relative w-full rounded-2xl border border-[#dab2ff] bg-[#F3E8FF] px-6 py-4">
      <div className="flex flex-col items-center gap-2.5">
        <p className="text-sm font-medium text-[#9810FA]">
          No friends?
        </p>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="h-auto w-full rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-[#9810FA] hover:bg-white/90 disabled:opacity-50"
        >
          {isGenerating ? "Generating..." : "Populate with demo users"}
        </Button>
      </div>
    </div>
  );
}
