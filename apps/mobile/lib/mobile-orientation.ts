export function installMobileOrientationPolicy() {
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="orientation"][lk-config]',
  );
  if (!meta) return;

  const update = () => {
    const { width, height } = window.screen;
    const orientation =
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      Math.min(width, height) >= 600
        ? "default"
        : "portrait";
    if (meta.content !== orientation) meta.content = orientation;
  };

  update();
  window.addEventListener("resize", update);
  window.addEventListener("pageshow", update);
  if (window.screen.orientation) {
    window.screen.orientation.addEventListener("change", update);
  }
}

export const mobileOrientationBeforeSdkScript = `(${installMobileOrientationPolicy.toString()})();`;
