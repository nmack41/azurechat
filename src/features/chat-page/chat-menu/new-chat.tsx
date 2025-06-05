"use client";

import { Button } from "@/ui/button";
import { LoadingIndicator } from "@/ui/loading";
import { Plus } from "lucide-react";
import { useFormStatus } from "react-dom";

export const NewChat = () => {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-disabled={pending}
      size={"default"}
      className="flex gap-2"
      variant={"outline"}
    >
      {pending ? <LoadingIndicator isLoading={pending} /> : <Plus size={18} />}
      New Chat
    </Button>
  );
};
