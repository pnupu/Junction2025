"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ProfileModal,
  getUserProfile,
  type UserProfile,
} from "@/components/profile-modal";

export default function Home() {
  const router = useRouter();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [eventCode, setEventCode] = useState("");

  useEffect(() => {
    const _profile = getUserProfile();
    setHasProfile(!!_profile);
  }, []);

  const handleProfileSave = (_profile: UserProfile) => {
    setHasProfile(true);
    setShowProfileForm(false);
    // Notify other components that profile was updated
    window.dispatchEvent(new Event("profileUpdated"));
  };

  const handleJoinEvent = () => {
    if (!eventCode.trim()) return;
    // Convert to uppercase for consistency with generated codes
    const code = eventCode.trim().toUpperCase();
    router.push(`/event/${code}`);
  };

  // Loading state
  if (hasProfile === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#029DE2]">
        <div className="text-white">Loading...</div>
      </main>
    );
  }

  const profilePic = (
    <div className="absolute bottom-0 left-1/2 h-[55vh] w-full max-w-[800px] -translate-x-1/2 md:h-[50vh] lg:h-[55vh]">
      <Image
        src="/happy-times.png"
        alt=""
        fill
        className="object-cover object-bottom"
        priority
      />
    </div>
  );

  // Render ProfileModal if shown
  if (showProfileForm) {
    return (
      <>
        {/* Background page for desktop */}
        <main className="relative hidden min-h-screen flex-col items-center justify-start bg-[#029DE2] px-6 py-12 md:flex">
          {profilePic}
        </main>

        <ProfileModal
          isOpen={showProfileForm}
          onClose={() => setShowProfileForm(false)}
          onSave={handleProfileSave}
          showAsModal={true}
        />
      </>
    );
  }

  // Join event form
  if (showJoinForm) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-start bg-[#029DE2] px-6 py-12">
        {profilePic}

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
                onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                placeholder="Event code"
                className="h-12 rounded-xl border-2 border-white/30 bg-white/10 text-center text-lg text-white uppercase placeholder:text-white/50"
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
      {profilePic}

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-16">
        <h1 className="mt-32 text-center text-5xl leading-none font-bold text-white">
          Wolt Events
        </h1>{" "}
        <div className="w-full space-y-4">
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
