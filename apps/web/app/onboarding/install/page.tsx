"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPage() {
  const router = useRouter();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) {
      router.push("/onboarding/account");
      return;
    }
    setInstalling(true);
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstalling(false);
    if (outcome === "accepted") {
      router.push("/onboarding/account");
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-120px)] flex-col items-center justify-center gap-8 py-12">
      <div className="flex flex-col items-center gap-6 text-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-3xl text-4xl"
          style={{
            backgroundColor: "#ffffff",
            boxShadow: "0 4px 20px rgba(45,80,22,0.15)",
          }}
        >
          📱
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold" style={{ color: "#1a2e0a" }}>
            Emporte ton plan avec toi
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "#6b7c5a" }}>
            Installe l&apos;app pour accéder à ton plan sans connexion, même en pleine montagne
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3">
        <div
          className="rounded-2xl p-4"
          style={{
            backgroundColor: "#ffffff",
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
          }}
        >
          <div className="flex flex-col gap-3">
            {[
              { emoji: "📴", text: "Accès hors-ligne" },
              { emoji: "⚡", text: "Chargement instantané" },
              { emoji: "🔔", text: "Rappels de ravitaillement" },
            ].map(({ emoji, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="text-xl">{emoji}</span>
                <span className="text-sm font-medium" style={{ color: "#1a2e0a" }}>
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 px-5 pb-8 pt-4"
        style={{ backgroundColor: "#FAF7F2" }}
      >
        <div className="flex flex-col gap-3">
          <button
            onClick={handleInstall}
            disabled={installing}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-60"
            style={{ backgroundColor: "#2D5016" }}
          >
            <span>📲</span>
            {installing ? "Installation..." : "Installer l'application"}
          </button>
          <button
            onClick={() => router.push("/onboarding/account")}
            className="text-center text-sm font-medium underline underline-offset-2"
            style={{ color: "#2D5016" }}
          >
            Continuer sur le web
          </button>
        </div>
      </div>
    </div>
  );
}
