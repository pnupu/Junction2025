"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getUserProfile,
  ProfileModal,
  type UserProfile,
} from "./profile-modal";

export function TopBar() {
  const [userName, setUserName] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    const profile = getUserProfile();
    setUserName(profile?.name ?? null);

    // Listen for profile updates
    const handleProfileUpdate = () => {
      const updatedProfile = getUserProfile();
      setUserName(updatedProfile?.name ?? null);
    };

    window.addEventListener("profileUpdated", handleProfileUpdate);
    return () => {
      window.removeEventListener("profileUpdated", handleProfileUpdate);
    };
  }, []);

  const handleProfileSave = (profile: UserProfile) => {
    setUserName(profile.name);
    setShowProfileModal(false);
    // Notify other components that profile was updated
    window.dispatchEvent(new Event("profileUpdated"));
  };

  return (
    <>
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onSave={handleProfileSave}
        showAsModal={true}
      />
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-end px-4 sm:px-8">
          {userName && (
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2 rounded-full bg-[#029DE2]/10 px-4 py-2 transition-all hover:scale-105 hover:bg-[#029DE2]/20"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#029DE2] text-white">
                MM
              </div>
              <span className="text-sm font-medium text-[#0F172B]">
                {userName}
              </span>
            </button>
          )}
        </div>
      </header>
    </>
  );
}
