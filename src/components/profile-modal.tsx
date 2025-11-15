"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type UserProfile = {
  name: string;
  activityPreference: "chill" | "celebratory" | "active";
  foodPreference: "no-limit" | "veg" | "gluten";
  latitude?: number;
  longitude?: number;
};

const activityOptions = [
  { id: "chill" as const, label: "Chill", emoji: "😌" },
  { id: "celebratory" as const, label: "Celebratory", emoji: "🎉" },
  { id: "active" as const, label: "Active", emoji: "⚡" },
];

const foodOptions = [
  { id: "no-limit" as const, label: "No limit", emoji: "✨" },
  { id: "veg" as const, label: "Vegetarian", emoji: "🥗" },
  { id: "gluten" as const, label: "Gluten-free", emoji: "🌾" },
];

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (profile: UserProfile) => void;
  showAsModal?: boolean; // If false, shows full screen on mobile
}

export function ProfileModal({
  isOpen,
  onClose,
  onSave,
  showAsModal = true,
}: ProfileModalProps) {
  const [name, setName] = useState("");
  const [activityPreference, setActivityPreference] = useState<
    UserProfile["activityPreference"] | null
  >(null);
  const [foodPreference, setFoodPreference] = useState<
    UserProfile["foodPreference"] | null
  >(null);

  // Load existing profile if available
  useEffect(() => {
    if (isOpen) {
      const existingProfile = sessionStorage.getItem("userProfile");
      if (existingProfile) {
        try {
          const profile = JSON.parse(existingProfile) as UserProfile;
          setName(profile.name);
          setActivityPreference(profile.activityPreference);
          setFoodPreference(profile.foodPreference);
        } catch (_e) {
          // Invalid profile, ignore
        }
      }
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!name || !activityPreference || !foodPreference) return;

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
        const existingProfile = sessionStorage.getItem("userProfile");
        if (existingProfile) {
          try {
            const oldProfile = JSON.parse(existingProfile) as UserProfile;
            latitude = oldProfile.latitude;
            longitude = oldProfile.longitude;
          } catch (_e) {
            // Ignore
          }
        }
      }
    }

    const profile: UserProfile = {
      name,
      activityPreference,
      foodPreference,
      latitude,
      longitude,
    };

    sessionStorage.setItem("userProfile", JSON.stringify(profile));
    onSave(profile);
  };

  if (!isOpen) return null;

  const formContent = (
    <div className="flex flex-col gap-8">
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

      {/* Activity Preference */}
      <div className="flex flex-col gap-1.5">
        <label className="text-base font-medium text-[#0F172B]">
          Activity preference
        </label>
        <div className="flex gap-3">
          {activityOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setActivityPreference(option.id)}
              className={`flex grow basis-0 items-center justify-center rounded-xl border-[1.5px] px-4 py-8 transition-all ${
                activityPreference === option.id
                  ? "border-2 border-[#029DE2] bg-[#EDF7FF]"
                  : "border-[#CAD5E2] bg-white hover:border-[#029DE2]/50"
              } `}
            >
              <span className="text-xl font-semibold">{option.emoji}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Food Preference */}
      <div className="flex flex-col gap-1.5">
        <label className="text-base font-medium text-[#0F172B]">
          Food preference
        </label>
        <div className="flex gap-3">
          {foodOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setFoodPreference(option.id)}
              className={`flex grow basis-0 items-center justify-center rounded-xl border-[1.5px] px-4 py-8 transition-all ${
                foodPreference === option.id
                  ? "border-2 border-[#029DE2] bg-[#EDF7FF]"
                  : "border-[#CAD5E2] bg-white hover:border-[#029DE2]/50"
              } `}
            >
              <span className="text-xl font-semibold">{option.emoji}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex flex-col gap-2.5">
        <Button
          onClick={handleSave}
          disabled={!name || !activityPreference || !foodPreference}
          className="h-12 w-full rounded-xl bg-[#029DE2] text-base font-semibold text-white hover:bg-[#029DE2]/90 disabled:opacity-50"
        >
          Continue
        </Button>
      </div>
    </div>
  );

  if (showAsModal) {
    // Desktop: Modal overlay
    return (
      <>
        {/* Desktop modal */}
        <div className="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-4 md:flex">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white px-5 py-6 shadow-xl">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-[#62748E] hover:text-[#0F172B]"
            >
              ✕
            </button>
            {formContent}
          </div>
        </div>

        {/* Mobile: Full screen */}
        <div className="fixed inset-0 z-50 flex min-h-screen flex-col bg-white px-5 py-6 md:hidden">
          <div className="flex flex-col gap-8">
            {/* Top spacing */}
            <div className="h-6" />
            {formContent}
          </div>
        </div>
      </>
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

  const profileStr = sessionStorage.getItem("userProfile");
  if (!profileStr) return null;

  try {
    return JSON.parse(profileStr) as UserProfile;
  } catch (_e) {
    return null;
  }
}
