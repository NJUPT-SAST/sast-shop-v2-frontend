import type { PocketFaceMatch, PocketMemberSelection } from "@sast-shop/api";

/** Keep the owner's choices after re-recognition while discarding superseded face evidence. */
export function reconcilePocketSelections(
  selections: PocketMemberSelection[],
  ownerId: string,
  matches: PocketFaceMatch[],
): PocketMemberSelection[] {
  return selections.map((selection) => {
    if (selection.userId === ownerId)
      return { userId: ownerId, selectionSource: "owner" };
    const currentFace =
      selection.selectionSource === "face"
        ? matches.find(
            (match) =>
              match.resolution !== "ignored" &&
              (match.confirmedUserId === selection.userId ||
                match.suggestedUserId === selection.userId),
          )
        : undefined;
    return currentFace
      ? {
          userId: selection.userId,
          selectionSource: "face",
          faceMatchId: currentFace.id,
        }
      : { userId: selection.userId, selectionSource: "search" };
  });
}
