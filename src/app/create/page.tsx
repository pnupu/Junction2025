"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/trpc/react";

export default function CreateEventPage() {
  const router = useRouter();

  const createEvent = api.event.create.useMutation({
    onSuccess: (data) => {
      // Use inviteCode if available, otherwise fall back to id
      router.push(`/event/${data.inviteCode ?? data.id}`);
    },
  });

  const { mutate, isPending, data } = createEvent;

  useEffect(() => {
    // Auto-create event when page loads
    if (!isPending && !data) {
      mutate();
    }
  }, [data, isPending, mutate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#029DE2]">
      <div className="text-center">
        <div className="mb-4 text-6xl">✨</div>
        <h1 className="mb-3 text-3xl font-semibold text-white">
          Creating Event...
        </h1>
        <p className="text-white/80">Setting up your event page</p>
      </div>
    </main>
  );
}
