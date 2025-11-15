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
      <>
        {/* Desktop: Show background with modal overlay */}
        <main className="relative hidden min-h-screen flex-col items-center justify-start bg-[#029DE2] px-6 py-12 md:flex">
          {/* Background image */}
          <div className="absolute bottom-0 left-1/2 h-[55vh] w-full max-w-[800px] -translate-x-1/2 md:h-[50vh] lg:h-[55vh]">
            <img
              src="/happy-times.png"
              alt=""
              className="h-full w-full object-cover object-bottom"
            />
          </div>

          {/* Modal overlay */}
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white px-5 py-6 shadow-xl">
              {/* Close button */}
              <button
                onClick={() => setShowProfileForm(false)}
                className="absolute right-4 top-4 text-[#62748E] hover:text-[#0F172B]"
              >
                ✕
              </button>

              <div className="flex flex-col gap-8">
                <h1 className="text-4xl font-semibold text-[#0F172B]">
                  Profile
                </h1>

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
                        className={`
                          flex grow basis-0 items-center justify-center rounded-xl border-[1.5px] px-4 py-8 transition-all
                          ${
                            activityPreference === option.id
                              ? "border-2 border-[#029DE2] bg-[#EDF7FF]"
                              : "border-[#CAD5E2] bg-white hover:border-[#029DE2]/50"
                          }
                        `}
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
                        className={`
                          flex grow basis-0 items-center justify-center rounded-xl border-[1.5px] px-4 py-8 transition-all
                          ${
                            foodPreference === option.id
                              ? "border-2 border-[#029DE2] bg-[#EDF7FF]"
                              : "border-[#CAD5E2] bg-white hover:border-[#029DE2]/50"
                          }
                        `}
                      >
                        <span className="text-xl font-semibold">{option.emoji}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex flex-col gap-2.5">
                  <Button
                    onClick={handleCreateProfile}
                    disabled={!name || !activityPreference || !foodPreference}
                    className="h-12 w-full rounded-xl bg-[#029DE2] text-base font-semibold text-white hover:bg-[#029DE2]/90 disabled:opacity-50"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Mobile: Full screen white background */}
        <main className="flex min-h-screen flex-col bg-white px-5 py-6 md:hidden">
          <div className="flex flex-col gap-8">
            {/* Top spacing */}
            <div className="h-6" />
            
            <h1 className="text-4xl font-semibold text-[#0F172B]">
              Profile
            </h1>

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
                    className={`
                      flex grow basis-0 items-center justify-center rounded-xl border-[1.5px] px-4 py-8 transition-all
                      ${
                        activityPreference === option.id
                          ? "border-2 border-[#029DE2] bg-[#EDF7FF]"
                          : "border-[#CAD5E2] bg-white hover:border-[#029DE2]/50"
                      }
                    `}
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
                    className={`
                      flex grow basis-0 items-center justify-center rounded-xl border-[1.5px] px-4 py-8 transition-all
                      ${
                        foodPreference === option.id
                          ? "border-2 border-[#029DE2] bg-[#EDF7FF]"
                          : "border-[#CAD5E2] bg-white hover:border-[#029DE2]/50"
                      }
                    `}
                  >
                    <span className="text-xl font-semibold">{option.emoji}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom spacer and button */}
            <div className="flex grow flex-col justify-end gap-2.5">
              <Button
                onClick={handleCreateProfile}
                disabled={!name || !activityPreference || !foodPreference}
                className="h-12 w-full rounded-xl bg-[#029DE2] text-base font-semibold text-white hover:bg-[#029DE2]/90 disabled:opacity-50"
              >
                Continue
              </Button>
            </div>
          </div>
        </main>
      </>
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
