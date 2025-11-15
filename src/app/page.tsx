"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type UserProfile = {
  name: string;
  activityPreference: "chill" | "celebratory" | "active";
  foodPreference: "no-limit" | "veg" | "gluten";
};

const activityOptions = [
  { id: "chill", label: "Chill", emoji: "😌" },
  { id: "celebratory", label: "Celebratory", emoji: "🎉" },
  { id: "active", label: "Active", emoji: "⚡" },
] as const;

const foodOptions = [
  { id: "no-limit", label: "No limit", emoji: "✨" },
  { id: "veg", label: "Vegetarian", emoji: "🥗" },
  { id: "gluten", label: "Gluten-free", emoji: "🌾" },
] as const;

export default function Home() {
  const router = useRouter();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [eventCode, setEventCode] = useState("");
  
  // Profile form state
  const [name, setName] = useState("");
  const [activityPreference, setActivityPreference] = useState<UserProfile["activityPreference"] | null>(null);
  const [foodPreference, setFoodPreference] = useState<UserProfile["foodPreference"] | null>(null);

  useEffect(() => {
    const profile = sessionStorage.getItem("userProfile");
    setHasProfile(!!profile);
  }, []);

  const handleCreateProfile = () => {
    if (!name || !activityPreference || !foodPreference) return;
    
    const profile: UserProfile = {
      name,
      activityPreference,
      foodPreference,
    };
    
    sessionStorage.setItem("userProfile", JSON.stringify(profile));
    setHasProfile(true);
    setShowProfileForm(false);
  };

  const handleJoinEvent = () => {
    if (!eventCode.trim()) return;
    router.push(`/event/${eventCode.trim()}`);
  };

  // Loading state
  if (hasProfile === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#029DE2]">
        <div className="text-white">Loading...</div>
      </main>
    );
  }

  // Profile creation form
  if (showProfileForm) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-start bg-[#029DE2] px-6 py-12">
        {/* Background image */}
        <div className="fixed bottom-0 left-1/2 h-[50vh] w-full max-w-[595px] -translate-x-1/2">
          <img
            src="/happy-times.png"
            alt=""
            className="h-full w-full object-cover object-top"
          />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-md">
          <h1 className="mb-12 text-center text-4xl font-bold text-white">
            Create Your Profile
          </h1>

          <div className="space-y-6">
            {/* Name Input */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white">
                What&apos;s your name?
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="h-12 rounded-xl border-2 border-white/30 bg-white/10 text-white placeholder:text-white/50"
              />
            </div>

            {/* Activity Preference */}
            <div>
              <label className="mb-3 block text-sm font-medium text-white">
                Activity preference
              </label>
              <div className="grid grid-cols-3 gap-3">
                {activityOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setActivityPreference(option.id)}
                    className={`
                      flex flex-col items-center justify-center rounded-xl border-2 p-4 transition-all
                      ${
                        activityPreference === option.id
                          ? "scale-105 border-white bg-white/20"
                          : "border-white/30 bg-white/5 hover:border-white/50"
                      }
                    `}
                  >
                    <span className="mb-1 text-2xl">{option.emoji}</span>
                    <span className="text-xs font-medium text-white">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Food Preference */}
            <div>
              <label className="mb-3 block text-sm font-medium text-white">
                Food preference
              </label>
              <div className="grid grid-cols-3 gap-3">
                {foodOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setFoodPreference(option.id)}
                    className={`
                      flex flex-col items-center justify-center rounded-xl border-2 p-4 transition-all
                      ${
                        foodPreference === option.id
                          ? "scale-105 border-white bg-white/20"
                          : "border-white/30 bg-white/5 hover:border-white/50"
                      }
                    `}
                  >
                    <span className="mb-1 text-2xl">{option.emoji}</span>
                    <span className="text-xs font-medium text-white">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleCreateProfile}
              disabled={!name || !activityPreference || !foodPreference}
              className="h-12 w-full rounded-xl bg-white text-base font-semibold text-[#029DE2] hover:bg-white/90 disabled:opacity-50"
            >
              Save Profile
            </Button>

            <button
              onClick={() => setShowProfileForm(false)}
              className="w-full text-center text-sm text-white/80 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Join event form
  if (showJoinForm) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-start bg-[#029DE2] px-6 py-12">
        {/* Background image */}
        <div className="absolute bottom-0 left-1/2 h-[55vh] w-full -translate-x-1/2 md:h-[50vh] lg:h-[55vh]">
          <img
            src="/happy-times.png"
            alt=""
            className="h-full w-full object-cover object-bottom"
          />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-md">
          <h1 className="mb-12 text-center text-4xl font-bold text-white">
            Join Event
          </h1>

          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-white">
                Enter event code
              </label>
              <Input
                type="text"
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value)}
                placeholder="Event code"
                className="h-12 rounded-xl border-2 border-white/30 bg-white/10 text-center text-lg uppercase text-white placeholder:text-white/50"
              />
            </div>

            <Button
              onClick={handleJoinEvent}
              disabled={!eventCode.trim()}
              className="h-12 w-full rounded-xl bg-white text-base font-semibold text-[#029DE2] hover:bg-white/90 disabled:opacity-50"
            >
              Join Event
            </Button>

            <button
              onClick={() => setShowJoinForm(false)}
              className="w-full text-center text-sm text-white/80 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Main landing page
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start bg-[#029DE2] px-6 py-12">
      {/* Background image */}
      <div className="absolute bottom-0 left-1/2 h-[55vh] w-full max-w-[800px] -translate-x-1/2 md:h-[50vh] lg:h-[55vh]">
        <img
          src="/happy-times.png"
          alt=""
          className="h-full w-full object-cover object-bottom overflow-visible"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-16">
        <h1 className="mt-32 text-center text-5xl font-bold leading-none text-white">
          Wolt Events
        </h1>        <div className="w-full space-y-4">
          {!hasProfile ? (
            <Button
              onClick={() => setShowProfileForm(true)}
              className="h-12 w-full rounded-xl bg-white text-base font-semibold text-[#029DE2] hover:bg-white/90"
            >
              Create quick profile
            </Button>
          ) : (
            <>
              <Link href="/create" className="block">
                <Button className="h-12 w-full rounded-xl bg-white text-base font-semibold text-[#029DE2] hover:bg-white/90">
                  Create Event
                </Button>
              </Link>
              <Button
                onClick={() => setShowJoinForm(true)}
                variant="outline"
                className="h-12 w-full rounded-xl border-2 border-white bg-transparent text-base font-semibold text-white hover:bg-white/10"
              >
                Join Event
              </Button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
