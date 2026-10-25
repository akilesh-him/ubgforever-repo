export function motionReduced() {
  return (
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.body.classList.contains("effects-reduced") ||
    document.documentElement.classList.contains("reduce-motion")
  );
}

export function mountEffectsSetting(toggle) {
  let reduced = false;
  try {
    reduced = localStorage.getItem("slipstream-reduce-effects") === "true";
  } catch {}
  document.body.classList.toggle("effects-reduced", reduced);
  toggle.checked = reduced;
  toggle.onchange = () => {
    document.body.classList.toggle("effects-reduced", toggle.checked);
    try {
      localStorage.setItem("slipstream-reduce-effects", String(toggle.checked));
    } catch {
      window.UBGUI.toast("This setting could not be saved on this device.");
    }
  };
}
