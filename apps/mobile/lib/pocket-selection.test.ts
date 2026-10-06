import { describe, expect, it } from "vitest";
import type { PocketFaceMatch } from "@sast-shop/api";
import { reconcilePocketSelections } from "./pocket-selection";
const match: PocketFaceMatch = {
  id: "new",
  photoId: "photo",
  recognitionJobId: "job",
  faceIndex: 0,
  bbox: { x: 0, y: 0, width: 10, height: 10 },
  suggestedUserId: "2",
  confirmedUserId: null,
  candidates: [],
  matchStatus: "suggested",
  resolution: "pending",
};
describe("preserving selections when recognition evidence changes", () => {
  it("replaces an old face ID with current evidence for the same selected person", () => {
    expect(
      reconcilePocketSelections(
        [{ userId: "2", selectionSource: "face", faceMatchId: "old" }],
        "1",
        [match],
      ),
    ).toEqual([{ userId: "2", selectionSource: "face", faceMatchId: "new" }]);
  });
  it("keeps explicit selections as manual entries when recognition is unavailable, expired or ignored", () => {
    for (const matches of [[], [{ ...match, resolution: "ignored" }]])
      expect(
        reconcilePocketSelections(
          [{ userId: "2", selectionSource: "face", faceMatchId: "old" }],
          "1",
          matches,
        ),
      ).toEqual([{ userId: "2", selectionSource: "search" }]);
  });
  it("does not add candidates or override the owner's manual exclusion", () => {
    expect(
      reconcilePocketSelections(
        [{ userId: "3", selectionSource: "search" }],
        "1",
        [match],
      ),
    ).toEqual([{ userId: "3", selectionSource: "search" }]);
    expect(reconcilePocketSelections([], "1", [match])).toEqual([]);
  });
});
