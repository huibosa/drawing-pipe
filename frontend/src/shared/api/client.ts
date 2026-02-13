import type { AnalyzeResponse, Profile } from "../types/domain"

function resolveApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "")
  }

  return ""
}

const API_BASE = resolveApiBase()

export async function fetchTemplates(): Promise<Record<string, Profile["pipes"]>> {
  const response = await fetch(`${API_BASE}/api/templates`)
  if (!response.ok) {
    throw new Error("Failed to fetch templates")
  }
  const data = (await response.json()) as {
    templates: Record<string, Profile["pipes"]>
  }
  return data.templates
}

export async function analyzeProfile(profile: Profile): Promise<AnalyzeResponse> {
  const response = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || "Failed to analyze profile")
  }
  return (await response.json()) as AnalyzeResponse
}
