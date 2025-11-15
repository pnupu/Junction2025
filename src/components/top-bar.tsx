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
  }, []);

  const handleProfileSave = (profile: UserProfile) => {
    setUserName(profile.name);
    setShowProfileModal(false);
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
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 transition-transform hover:scale-105"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#029DE2] text-2xl font-bold text-white shadow-lg shadow-[#029DE2]/20">
              W
            </div>
            <span className="text-xl font-semibold text-slate-900">
              Wolt Events
            </span>
          </Link>

          {userName && (
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2 rounded-full bg-[#029DE2]/10 px-4 py-2 transition-all hover:scale-105 hover:bg-[#029DE2]/20"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#029DE2] text-white">
                {userName.charAt(0).toUpperCase()}
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
