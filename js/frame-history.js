(function () {
  "use strict";

  class FrameHistory {
    constructor() {
      this.entries = [];
      this.position = -1;
    }

    visit(url) {
      if (!url || this.entries[this.position] === url) return;
      this.entries = this.entries.slice(0, this.position + 1);
      this.entries.push(url);
      this.position = this.entries.length - 1;
    }

    move(direction) {
      const next = this.position + direction;
      if (next < 0 || next >= this.entries.length) return null;
      this.position = next;
      return this.entries[next];
    }

    get canBack() {
      return this.position > 0;
    }
    get canForward() {
      return this.position < this.entries.length - 1;
    }
  }

  window.SlipstreamFrameHistory = FrameHistory;
})();
