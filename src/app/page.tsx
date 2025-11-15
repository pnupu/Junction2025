"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ProfileModal,
  getUserProfile,
  type UserProfile,
} from "@/components/profile-modal";
import { Loader } from "@/components/ui/loader";
import { TopBar } from "@/components/top-bar";

export default function Home() {
  const router = useRouter();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [eventCode, setEventCode] = useState("");
  const [isJumping, setIsJumping] = useState(false);

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

  const artPic = (
    <div
      className={`absolute bottom-0 left-1/2 h-[55vh] w-full max-w-[700px] -translate-x-1/2 md:h-[50vh] md:max-w-[800px] lg:h-[55vh] ${
        isJumping ? "animate-jump" : ""
      }`}
    >
      <Image
        src="/happy-times.png"
        alt=""
        fill
        className="object-cover object-bottom md:object-contain"
        priority
      />
    </div>
  );

  // Render ProfileModal if shown
  if (showProfileForm) {
    return (
      <ProfileModal
        isOpen={showProfileForm}
        onClose={() => setShowProfileForm(false)}
        onSave={handleProfileSave}
        showAsModal={true}
        animate={true}
      />
    );
  }

  // Main landing page
  return (
    <>
      <TopBar />
      <main
        className={`relative flex min-h-screen flex-col items-center justify-start px-6 py-12 ${hasProfile ? "bg-white" : "bg-[#029DE2]"}`}
      >
        {/* Background image */}
        {artPic}

        {/* Content */}
        <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-16">
          {hasProfile ? (
            <h1
              className={`mt-32 text-center text-5xl leading-none font-bold ${hasProfile ? "text-[#029DE2]" : "text-white"}`}
            >
              Let&apos;s do something together
            </h1>
          ) : (
            <Image
              src="/wolt_meet.svg"
              alt="Wolt Meet"
              width={300}
              height={51}
              className={"mt-16"}
              priority
            />
          )}{" "}
          <div className="w-full space-y-6">
            {!hasProfile ? (
              <Button
                onClick={() => {
                  setIsJumping(true);
                  setTimeout(() => {
                    setShowProfileForm(true);
                    setIsJumping(false);
                  }, 200);
                }}
                className="h-12 w-full rounded-xl bg-white text-base font-semibold text-[#029DE2] hover:bg-white/90"
              >
                Create DEMO profile
              </Button>
            ) : (
              <>
                <Link href="/create" className="block">
                  <Button className="h-12 w-full rounded-xl bg-[#029DE2] text-base font-semibold text-white hover:bg-[#0287C3]">
                    Create Event
                  </Button>
                </Link>

                {/* OR Divider */}
                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-slate-300"></div>
                  <span className="text-sm font-medium text-slate-500">OR</span>
                  <div className="h-px flex-1 bg-slate-300"></div>
                </div>

                {/* Join with code */}
                <div className="space-y-3">
                  <Input
                    type="text"
                    value={eventCode}
                    onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                    placeholder="Enter event code"
                    className="h-12 rounded-xl border-0 bg-slate-100 text-center text-base text-slate-900 uppercase shadow-inner placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <Button
                    onClick={handleJoinEvent}
                    disabled={!eventCode.trim()}
                    variant="outline"
                    className="h-12 w-full rounded-xl border-2 border-[#029DE2] bg-white text-base font-semibold text-[#029DE2] transition-colors hover:bg-[#029DE2] hover:text-white focus-visible:ring-0 focus-visible:ring-offset-0 disabled:border-slate-300 disabled:text-slate-400 disabled:opacity-100 disabled:hover:bg-white disabled:hover:text-slate-400"
                  >
                    Join with Code
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
