"use client";
import { AI_NAME } from "@/features/theme/theme-config";
import { signIn, useSession } from "next-auth/react";
import { FC, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

interface LoginProps {
  isDevMode: boolean;
  entraIdEnabled: boolean;
}

export const LogIn: FC<LoginProps> = (props) => {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated" && session) {
      router.push("/chat");
    }
  }, [status, session, router]);

  if (status === "loading") {
    return (
      <Card className="flex gap-2 flex-col min-w-[300px]">
        <CardContent className="flex justify-center p-6">
          <div>Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (status === "authenticated") {
    return null;
  }

  return (
    <Card className="flex gap-2 flex-col min-w-[300px]">
      <CardHeader className="gap-2">
        <CardTitle className="text-2xl flex gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={"ai-icon.png"} />
          </Avatar>
          <span className="text-primary">{AI_NAME}</span>
        </CardTitle>
        {/* <CardDescription>Sign in</CardDescription> */}
      </CardHeader>
      <CardContent className="grid gap-4">
        {props.entraIdEnabled && (
          <Button onClick={() => signIn("azure-ad")}>Sign in</Button>
        )}
        {props.isDevMode && (
          <Button onClick={() => signIn("localdev")}>
            Basic Auth (DEV ONLY)
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
