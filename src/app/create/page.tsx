"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/trpc/react";
import { Loader } from "@/components/ui/loader";

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
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-3xl font-semibold text-white">Creating Event...</h1>
      </div>
    </main>
  );
}
