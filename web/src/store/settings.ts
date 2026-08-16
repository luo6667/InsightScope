import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

interface SettingsState extends AiConfig {
  update: (partial: Partial<AiConfig>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "",
      model: "gpt-4o-mini",
      temperature: 0.2,
      update: (partial) => set(partial),
    }),
    { name: "insight-ai-settings" }
  )
);
