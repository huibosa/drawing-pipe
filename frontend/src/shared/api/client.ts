import type { AnalyzeResponse, Profile } from "../types/domain"

const API_BASE = "http://127.0.0.1:8000"

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
