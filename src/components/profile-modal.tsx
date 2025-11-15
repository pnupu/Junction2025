"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type UserProfile = {
  name: string;
  dietaryRestrictions: "none" | "vegan-vege" | "gluten-free";
  eatOutFrequency: "rarely" | "monthly" | "weekly";
  healthConsciousness: "little" | "moderate" | "very";
  // Legacy fields for backward compatibility
  activityPreference?: "chill" | "celebratory" | "active";
  foodPreference?: "no-limit" | "veg" | "gluten";
  latitude?: number;
  longitude?: number;
};

const dietaryRestrictionsOptions = [
  { id: "none" as const, label: "None", emoji: "😊", icon: "🍴" },
  { id: "vegan-vege" as const, label: "Vegan/vege", emoji: "✌️", icon: "🌿" },
  { id: "gluten-free" as const, label: "Gluten free", emoji: "❌", icon: "🍞" },
];

const eatOutFrequencyOptions = [
  { id: "rarely" as const, label: "Rarely", emoji: "🧦" },
  { id: "monthly" as const, label: "Monthly", emoji: "👞" },
  { id: "weekly" as const, label: "Weekly", emoji: "👟" },
];

const healthConsciousnessOptions = [
  { id: "little" as const, label: "Little", emoji: "👍" },
  { id: "moderate" as const, label: "Moderate", emoji: "🏃" },
  { id: "very" as const, label: "Very", emoji: "💪" },
];

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (profile: UserProfile) => void;
  showAsModal?: boolean; // If false, shows full screen on mobile
  animate?: boolean; // Whether to show drop-in animation
}

export function ProfileModal({
  isOpen,
  onClose,
  onSave,
  showAsModal = true,
  animate = false,
}: ProfileModalProps) {
  const [name, setName] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState<
    UserProfile["dietaryRestrictions"] | null
  >(null);
  const [eatOutFrequency, setEatOutFrequency] = useState<
    UserProfile["eatOutFrequency"] | null
  >(null);
  const [healthConsciousness, setHealthConsciousness] = useState<
    UserProfile["healthConsciousness"] | null
  >(null);

  // Load existing profile if available
  useEffect(() => {
    if (isOpen) {
      const existingProfile = localStorage.getItem("userProfile");
      if (existingProfile) {
        try {
          const profile = JSON.parse(existingProfile) as UserProfile;
          setName(profile.name);
          // Support both new and legacy fields
          if (profile.dietaryRestrictions) {
            setDietaryRestrictions(profile.dietaryRestrictions);
          } else if (profile.foodPreference) {
            // Migrate legacy foodPreference to dietaryRestrictions
            const migrationMap: Record<string, UserProfile["dietaryRestrictions"]> = {
              "no-limit": "none",
              "veg": "vegan-vege",
              "gluten": "gluten-free",
            };
            setDietaryRestrictions(migrationMap[profile.foodPreference] || "none");
          }
          if (profile.eatOutFrequency) {
            setEatOutFrequency(profile.eatOutFrequency);
          }
          if (profile.healthConsciousness) {
            setHealthConsciousness(profile.healthConsciousness);
          } else if (profile.activityPreference) {
            // Migrate legacy activityPreference to healthConsciousness
            const migrationMap: Record<string, UserProfile["healthConsciousness"]> = {
              "chill": "little",
              "celebratory": "moderate",
              "active": "very",
            };
            setHealthConsciousness(migrationMap[profile.activityPreference] || "moderate");
          }
        } catch {
          // Invalid profile, ignore
        }
      }
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!name || !dietaryRestrictions || !eatOutFrequency || !healthConsciousness) return;

    // Always request fresh location permission
    let latitude: number | undefined;
    let longitude: number | undefined;

    if ("geolocation" in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              enableHighAccuracy: false,
            });
          },
        );
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch (error) {
        console.log("Location permission denied or unavailable", error);
        // Continue without location - try to preserve old location if it exists
        const existingProfile = localStorage.getItem("userProfile");
        if (existingProfile) {
          try {
            const oldProfile = JSON.parse(existingProfile) as UserProfile;
            latitude = oldProfile.latitude;
            longitude = oldProfile.longitude;
          } catch {
            // Ignore
          }
        }
      }
    }

    const profile: UserProfile = {
      name,
      dietaryRestrictions,
      eatOutFrequency,
      healthConsciousness,
      latitude,
      longitude,
    };

    localStorage.setItem("userProfile", JSON.stringify(profile));
    onSave(profile);
  };

  if (!isOpen) return null;

  const formContent = (
    <div className="flex flex-col gap-8">
      {/* Profile/Options Title */}
      <div className="text-sm font-medium text-[#62748E]">Profile/Options</div>
      
      <h1 className="text-4xl font-semibold text-[#0F172B]">Profile</h1>

      {/* Name Input */}
      <div>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="h-14 rounded-xl border-[1.5px] border-[#CAD5E2] bg-white px-6 py-4 text-base text-[#0F172B] placeholder:text-[#62748E]"
        />
      </div>

      {/* Dietary restrictions */}
      <div className="flex flex-col gap-1.5">
        <label className="text-base font-medium text-[#0F172B]">
          Dietary restrictions
        </label>
        <div className="flex gap-3">
          {dietaryRestrictionsOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setDietaryRestrictions(option.id)}
              className={`flex grow basis-0 flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] px-4 py-4 transition-all ${
                dietaryRestrictions === option.id
                  ? "border-2 border-[#029DE2] bg-[#EDF7FF]"
                  : "border-[#CAD5E2] bg-white hover:border-[#029DE2]/50"
              } `}
            >
              <div className="flex items-center gap-1">
                <span className="text-lg">{option.emoji}</span>
                <span className="text-lg">{option.icon}</span>
              </div>
              <span className="text-sm font-medium text-[#0F172B]">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Eat out / order in frequency */}
      <div className="flex flex-col gap-1.5">
        <label className="text-base font-medium text-[#0F172B]">
          Eat out / order in frequency
        </label>
        <div className="flex gap-3">
          {eatOutFrequencyOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setEatOutFrequency(option.id)}
              className={`flex grow basis-0 flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] px-4 py-4 transition-all ${
                eatOutFrequency === option.id
                  ? "border-2 border-[#029DE2] bg-[#EDF7FF]"
                  : "border-[#CAD5E2] bg-white hover:border-[#029DE2]/50"
              } `}
            >
              <span className="text-2xl">{option.emoji}</span>
              <span className="text-sm font-medium text-[#0F172B]">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Health consciousness */}
      <div className="flex flex-col gap-1.5">
        <label className="text-base font-medium text-[#0F172B]">
          Health consciousness
        </label>
        <div className="flex gap-3">
          {healthConsciousnessOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setHealthConsciousness(option.id)}
              className={`flex grow basis-0 flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] px-4 py-4 transition-all ${
                healthConsciousness === option.id
                  ? "border-2 border-[#029DE2] bg-[#EDF7FF]"
                  : "border-[#CAD5E2] bg-white hover:border-[#029DE2]/50"
              } `}
            >
              <span className="text-2xl">{option.emoji}</span>
              <span className="text-sm font-medium text-[#0F172B]">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex flex-col gap-2.5">
        <Button
          onClick={handleSave}
          disabled={!name || !dietaryRestrictions || !eatOutFrequency || !healthConsciousness}
          className="h-12 w-full rounded-xl bg-[#029DE2] text-base font-semibold text-white hover:bg-[#029DE2]/90 disabled:opacity-50"
        >
          Continue
        </Button>
      </div>
    </div>
  );

  if (showAsModal) {
    // Full screen with animation
    return (
      <div
        className={`fixed inset-0 z-50 flex min-h-screen flex-col items-center justify-center bg-white px-5 py-6 ${animate ? "animate-drop-in" : ""}`}
      >
        <div className="w-full max-w-lg">{formContent}</div>
      </div>
    );
  } else {
    // Full screen on all devices
    return (
      <div className="fixed inset-0 z-50 flex min-h-screen flex-col bg-white px-5 py-6">
        <div className="flex flex-col gap-8">
          {/* Top spacing */}
          <div className="h-6" />
          {formContent}
        </div>
      </div>
    );
  }
}

export function getUserProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;

  const profileStr = localStorage.getItem("userProfile");
  if (!profileStr) return null;

  try {
    return JSON.parse(profileStr) as UserProfile;
  } catch {
    return null;
  }
}
