// Tracks in-flight image uploads so the form components can show progress and
// the listing form can wait for all images to finish before submitting.

import { create } from "zustand"

export type UploadEntry = {
  id: string
  filename: string
  status: "pending" | "uploading" | "done" | "error"
  // Local preview URL (object URL) for instant feedback before the public URL is ready.
  previewUrl: string
  // Set once the PUT to upload_url succeeds.
  publicUrl?: string
  error?: string
}

type UploadState = {
  entries: Record<string, UploadEntry>
  add: (entry: UploadEntry) => void
  update: (id: string, patch: Partial<UploadEntry>) => void
  remove: (id: string) => void
  clear: () => void
}

export const useUploadStore = create<UploadState>((set) => ({
  entries: {},
  add: (entry) => set((s) => ({ entries: { ...s.entries, [entry.id]: entry } })),
  update: (id, patch) =>
    set((s) => {
      const cur = s.entries[id]
      if (!cur) return s
      return { entries: { ...s.entries, [id]: { ...cur, ...patch } } }
    }),
  remove: (id) =>
    set((s) => {
      const next = { ...s.entries }
      delete next[id]
      return { entries: next }
    }),
  clear: () => set({ entries: {} }),
}))
