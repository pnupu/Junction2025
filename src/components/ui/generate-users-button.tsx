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
  onAddUsers 
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
      
      const demoUsers: DemoUser[] = await response.json() as DemoUser[];
      
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

  return (
    <div className="relative w-full rounded-2xl border border-[#dab2ff] px-6 py-4" style={{
      background: 'linear-gradient(30deg, #f3e8ff 0%, #e9d5ff 50%, #d8b4fe 100%)'
    }}>
      {isGenerating && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl">
          <div className="gradient-loader-container">
            <div className="gradient-loader-content text-white">
              Generating users...
            </div>
            <style jsx>{`
              .gradient-loader-container {
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 16px;
                overflow: hidden;
                background: linear-gradient(
                  180deg,
                  #d8b4fe 0%,
                  #e9d5ff 50%,
                  #f3e8ff 100%
                );
                background-size: 200% 200%;
                animation: gradientShift 4s ease-in-out infinite;
              }

              .gradient-loader-content {
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1;
              }

              .loader-glow-small {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 80px;
                height: 80px;
                border-radius: 50%;
                background: radial-gradient(
                  circle,
                  rgba(255, 255, 255, 1) 0%,
                  rgba(255, 255, 255, 0.8) 30%,
                  rgba(255, 255, 255, 0.4) 60%,
                  rgba(255, 255, 255, 0) 100%
                );
                animation: pulse 2s ease-in-out infinite;
              }

              @keyframes gradientShift {
                0% {
                  background-position: 0% 0%;
                }
                50% {
                  background-position: 0% 100%;
                }
                100% {
                  background-position: 0% 0%;
                }
              }

              @keyframes pulse {
                0%,
                100% {
                  transform: scale(1);
                  opacity: 0.8;
                }
                50% {
                  transform: scale(1.1);
                  opacity: 1;
                }
              }
            `}</style>
          </div>
        </div>
      )}
      <div className="flex flex-col items-center gap-2.5">
        <p className="text-sm font-medium text-[#9810FA]">
          No friends?
        </p>
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
