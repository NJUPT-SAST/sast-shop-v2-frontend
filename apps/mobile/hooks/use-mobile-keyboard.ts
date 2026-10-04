"use client";

import { useEffect, useState } from "react";

const TEXT_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "tel",
  "url",
  "password",
  "number",
]);

function isEditable(element: EventTarget | null): boolean {
  if (!(element instanceof HTMLElement)) return false;

  const contentEditable = element.closest<HTMLElement>("[contenteditable]");
  if (contentEditable) {
    return (
      contentEditable.getAttribute("contenteditable")?.toLowerCase() !== "false"
    );
  }

  if (element instanceof HTMLTextAreaElement) {
    return !element.disabled && !element.readOnly;
  }

  return (
    element instanceof HTMLInputElement &&
    !element.disabled &&
    !element.readOnly &&
    TEXT_INPUT_TYPES.has(element.type)
  );
}

function readViewport() {
  const viewport = window.visualViewport;
  return {
    visualWidth: viewport?.width ?? null,
    visualHeight: viewport?.height ?? null,
    layoutWidth: window.innerWidth,
    layoutHeight: window.innerHeight,
    scale: viewport?.scale ?? 1,
  };
}

function hasSwappedAxes(
  oldWidth: number | null,
  oldHeight: number | null,
  newWidth: number | null,
) {
  if (oldWidth === null || oldHeight === null || newWidth === null) {
    return false;
  }

  return (
    Math.abs(newWidth - oldWidth) > Math.max(100, oldWidth * 0.25) &&
    Math.abs(newWidth - oldHeight) <= Math.max(48, oldHeight * 0.2)
  );
}

export function useMobileKeyboard(): boolean {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches;
    if (!hasCoarsePointer && !(navigator.maxTouchPoints > 0)) return;

    const viewport = window.visualViewport;
    let baseline = readViewport();
    let editableWasFocused = isEditable(document.activeElement);
    let keyboardOpen = false;

    function setKeyboardOpen(next: boolean) {
      if (keyboardOpen === next) return;
      keyboardOpen = next;
      setIsOpen(next);
    }

    function updateViewport() {
      const current = readViewport();
      if (current.scale !== 1) {
        setKeyboardOpen(false);
        return;
      }

      const layoutWidthChanged =
        Math.abs(current.layoutWidth - baseline.layoutWidth) >
        Math.max(16, baseline.layoutWidth * 0.08);
      const visualWidthChanged =
        current.visualWidth !== null &&
        baseline.visualWidth !== null &&
        Math.abs(current.visualWidth - baseline.visualWidth) >
          Math.max(16, baseline.visualWidth * 0.08);
      if (layoutWidthChanged || visualWidthChanged) {
        // 旋转后的高度可能仍被键盘压缩，用原宽度保留未压缩的高度基线。
        baseline = {
          visualWidth: current.visualWidth,
          visualHeight: visualWidthChanged
            ? hasSwappedAxes(
                baseline.visualWidth,
                baseline.visualHeight,
                current.visualWidth,
              )
              ? baseline.visualWidth
              : current.visualHeight
            : baseline.visualHeight,
          layoutWidth: current.layoutWidth,
          layoutHeight: layoutWidthChanged
            ? hasSwappedAxes(
                baseline.layoutWidth,
                baseline.layoutHeight,
                current.layoutWidth,
              )
              ? baseline.layoutWidth
              : current.layoutHeight
            : baseline.layoutHeight,
          scale: current.scale,
        };
      }

      if (!editableWasFocused) {
        baseline = current;
        return;
      }

      const visualShrunk =
        baseline.visualHeight !== null &&
        current.visualHeight !== null &&
        baseline.visualHeight - current.visualHeight >=
          Math.max(120, baseline.visualHeight * 0.18);
      const layoutShrunk =
        baseline.layoutHeight - current.layoutHeight >=
        Math.max(120, baseline.layoutHeight * 0.18);
      if (visualShrunk || layoutShrunk) {
        setKeyboardOpen(true);
        return;
      }

      setKeyboardOpen(false);
      if (!isEditable(document.activeElement)) editableWasFocused = false;
      baseline = {
        ...baseline,
        visualHeight:
          current.visualHeight === null
            ? null
            : Math.max(
                baseline.visualHeight ?? current.visualHeight,
                current.visualHeight,
              ),
        layoutHeight: Math.max(baseline.layoutHeight, current.layoutHeight),
      };
    }

    function handleFocusIn(event: FocusEvent) {
      if (!isEditable(event.target)) return;
      editableWasFocused = true;
      updateViewport();
    }

    function handleFocusOut() {
      if (keyboardOpen) return;
      editableWasFocused = false;
      baseline = readViewport();
    }

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
    };
  }, []);

  return isOpen;
}
