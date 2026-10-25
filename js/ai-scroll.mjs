import { motionReduced } from "./ui-preferences.mjs";
export function createBottomFollow({
  isActive,
  isAtBottom,
  scrollToBottom,
  showButton,
  schedule = requestAnimationFrame,
}) {
  let following = true;
  let scheduled = false;
  const update = () => showButton(isActive() && !isAtBottom());
  return {
    contentChanged() {
      if (scheduled) return;
      scheduled = true;
      schedule(() => {
        scheduled = false;
        if (isActive() && following) scrollToBottom(false);
        update();
      });
    },
    userScrolled() {
      if (isActive()) following = isAtBottom();
      update();
    },
    jump() {
      following = true;
      scrollToBottom(true);
    },
    reset() {
      following = true;
      showButton(false);
    },
    update,
  };
}

export function mountChatScroll(log, hasMessages) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ai-jump-latest";
  button.setAttribute("aria-label", "Jump to latest message");
  button.innerHTML =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v16m-6-6 6 6 6-6"/></svg>';
  button.hidden = true;
  document.body.appendChild(button);
  const follower = createBottomFollow({
    isActive: () =>
      !document.getElementById("v-ai").hidden &&
      !document.body.classList.contains("landing"),
    isAtBottom: () =>
      document.documentElement.scrollHeight - innerHeight - scrollY <= 90,
    showButton: (visible) => {
      button.hidden = !visible || !hasMessages();
    },
    scrollToBottom: (smooth) => {
      const reduced = motionReduced();
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: smooth && !reduced ? "smooth" : "instant",
      });
    },
  });
  button.onclick = follower.jump;
  window.addEventListener("scroll", follower.userScrolled, { passive: true });
  window.addEventListener("slipstreamnavigate", () =>
    requestAnimationFrame(follower.update),
  );
  document.addEventListener("visibilitychange", follower.update);
  new MutationObserver(follower.contentChanged).observe(log, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  new ResizeObserver(follower.contentChanged).observe(log.parentElement);
  return follower;
}
