import { motionReduced } from "./ui-preferences.mjs";
export class HomeRow {
  constructor(element, { right, choose, tile, paused }) {
    this.element = element;
    this.track = element.querySelector(".collage-track");
    this.right = right;
    this.choose = choose;
    this.tile = tile;
    this.paused = paused;
    this.travel = null;
    this.entering = null;
    this.flips = new Map();
    this.disposed = false;
  }

  start() {
    if (
      this.disposed ||
      this.travel ||
      this.paused() ||
      !this.track.firstElementChild
    )
      return;
    const game = this.choose();
    if (!game) return;
    const distance =
      this.track.firstElementChild.offsetWidth +
      (parseFloat(getComputedStyle(this.track).gap) || 0);
    this.entering = this.tile(game);
    if (this.right) this.track.prepend(this.entering);
    else this.track.append(this.entering);
    const animation = this.track.animate(
      [
        { transform: `translateX(${this.right ? -distance : 0}px)` },
        { transform: `translateX(${this.right ? 0 : -distance}px)` },
      ],
      {
        duration: Math.max(2500, (distance / 36) * 1000),
        easing: "linear",
        fill: "forwards",
      },
    );
    this.travel = animation;
    animation.finished.then(
      () => {
        if (this.travel !== animation || this.disposed) return;
        const departing = this.right
          ? this.track.lastElementChild
          : this.track.firstElementChild;
        this.cancelFlip(departing);
        departing.remove();
        this.entering = null;
        this.travel = null;
        animation.cancel();
        this.start();
      },
      () => {},
    );
  }

  sync() {
    if (this.disposed) return;
    if (!this.travel) return this.start();
    if (this.paused()) this.travel.pause();
    else if (this.travel.playState === "paused") this.travel.play();
  }

  flip(target) {
    if (this.disposed || this.paused() || this.flips.has(target)) return;
    const game = this.choose(target.dataset.gameId);
    if (!game) return;
    const replacement = this.tile(game);
    const front = document.createElement("span");
    const back = document.createElement("span");
    front.className = "flip-face";
    back.className = "flip-face flip-back";
    front.append(
      target.querySelector(".cover"),
      target.querySelector(".tile-name"),
    );
    back.append(
      replacement.querySelector(".cover"),
      replacement.querySelector(".tile-name"),
    );
    target.append(front, back);
    target.classList.add("turning");
    const timing = {
      duration: 1100,
      easing: "cubic-bezier(.22,.7,.2,1)",
      fill: "forwards",
    };
    const outgoing = front.animate(
      [{ transform: "rotateX(0deg)" }, { transform: "rotateX(180deg)" }],
      timing,
    );
    const incoming = back.animate(
      [{ transform: "rotateX(-180deg)" }, { transform: "rotateX(0deg)" }],
      timing,
    );
    this.flips.set(target, { front, outgoing, incoming });
    incoming.finished.then(
      () => {
        if (!this.flips.has(target)) return;
        replacement.replaceChildren(...back.childNodes);
        if (target.isConnected) target.replaceWith(replacement);
        this.flips.delete(target);
        outgoing.cancel();
        incoming.cancel();
      },
      () => {},
    );
  }

  cancelFlip(target) {
    const flip = this.flips.get(target);
    if (!flip) return;
    this.flips.delete(target);
    target.replaceChildren(...flip.front.childNodes);
    target.classList.remove("turning");
    flip.outgoing.cancel();
    flip.incoming.cancel();
  }

  reset() {
    const animation = this.travel;
    this.travel = null;
    if (animation) animation.cancel();
    for (const target of this.flips.keys()) this.cancelFlip(target);
    this.entering?.remove();
    this.entering = null;
  }

  dispose() {
    this.disposed = true;
    this.reset();
  }
}

export function mountHomeMotion(hero) {
  let visible = true;
  const rows = new Map();
  const paused = () =>
    document.body.classList.contains("landing") ||
    !visible ||
    document.hidden ||
    hero.closest("[hidden]") ||
    document.querySelector(".player:not([hidden])") ||
    motionReduced();
  function choose(exclude) {
    const ids = new Set(
      Array.from(
        hero.querySelectorAll(".collage .tile"),
        (tile) => tile.dataset.gameId,
      ),
    );
    return window.UBGGames.pick(80).find(
      (game) =>
        window.SlipstreamGameArt[game.id] &&
        game.id !== exclude &&
        !ids.has(game.id),
    );
  }
  function tile(game) {
    const holder = document.createElement("div");
    holder.innerHTML = window.UBGGames.tileHtml(game, { noFav: true });
    return holder.firstElementChild;
  }
  function reconcile() {
    for (const [element, row] of rows) {
      if (!element.isConnected) {
        row.dispose();
        rows.delete(element);
      }
    }
    hero.querySelectorAll(".collage-row").forEach((element, index) => {
      if (!rows.has(element))
        rows.set(
          element,
          new HomeRow(element, { right: index === 1, choose, tile, paused }),
        );
      rows.get(element).sync();
    });
  }
  const visibility = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    reconcile();
  });
  visibility.observe(hero);
  const resize = new ResizeObserver(() => {
    for (const row of rows.values()) row.reset();
    reconcile();
  });
  resize.observe(hero.querySelector(".collage"));
  const changes = new MutationObserver(reconcile);
  changes.observe(hero.querySelector(".collage"), { childList: true });
  const stateTimer = setInterval(reconcile, 200);
  const flipTimer = setInterval(() => {
    if (paused() || !window.UBGGames) return;
    const candidates = [];
    for (const row of rows.values())
      for (const target of row.track.children)
        if (!row.flips.has(target)) candidates.push({ row, target });
    for (let i = candidates.length - 1; i > 0; i--) {
      const other = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[other]] = [candidates[other], candidates[i]];
    }
    candidates
      .slice(0, 3 + Math.floor(Math.random() * 3))
      .forEach(({ row, target }) => row.flip(target));
  }, 2400);
  return {
    dispose() {
      clearInterval(stateTimer);
      clearInterval(flipTimer);
      changes.disconnect();
      visibility.disconnect();
      resize.disconnect();
      for (const row of rows.values()) row.dispose();
      rows.clear();
    },
  };
}
