import { LogIn } from "@/features/auth-page/login";

export default function Home() {
  return (
    <main className="container max-w-lg flex items-center">
      <LogIn
        isDevMode={process.env.NODE_ENV === "development"}
        entraIdEnabled={!!process.env.AZURE_AD_CLIENT_ID}
      />
    </main>
  );
}
