(function () {
  "use strict";

  var key = "slipstream-leaderboard-device";
  var identity;
  var syncing;
  var timer;
  var esc = window.UBGUI.escapeHtml;

  function device() {
    if (identity) return identity;
    try {
      identity = JSON.parse(localStorage.getItem(key) || "null");
    } catch (error) {
      identity = null;
    }
    return identity;
  }

  function saveIdentity(value) {
    localStorage.setItem(key, JSON.stringify(value));
    identity = value;
  }

  function status(text) {
    var element = document.getElementById("leaderboard-status");
    if (element) element.textContent = text;
  }

  function rows(players) {
    return Array.from({ length: 10 }, function (_, index) {
      var player = players[index];
      if (!player) {
        return (
          '<li class="leaderboard-row leaderboard-vacant"><span class="leaderboard-rank">' +
          (index + 1) +
          "</span><span></span><span>—</span><span>—</span></li>"
        );
      }
      var avatar = /^https:\/\//i.test(player.avatar_url || "")
        ? '<img class="leaderboard-avatar" src="' +
          esc(player.avatar_url) +
          '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'leaderboard-avatar\',textContent:\'—\'}))">'
        : '<span class="leaderboard-avatar">' +
          esc(player.name.slice(0, 2).toUpperCase()) +
          "</span>";
      return (
        '<li class="leaderboard-row"><span class="leaderboard-rank">' +
        (index + 1) +
        "</span>" +
        avatar +
        "<span>" +
        esc(player.name) +
        '</span><b class="leaderboard-xp">' +
        Number(player.xp).toLocaleString() +
        " XP</b></li>"
      );
    }).join("");
  }

  async function refresh() {
    var list = document.getElementById("leaderboard-list");
    if (!list) return;
    var client = window.UBG_SUPABASE;
    if (!client) {
      status("Leaderboard could not connect.");
      return;
    }
    status("Loading leaderboard…");
    try {
      var result = await client.rpc("get_slipstream_leaderboard");
      if (result.error) throw result.error;
      if (!list.isConnected) return;
      list.innerHTML = rows(result.data || []);
      status(result.data?.length ? "" : "No players have joined yet.");
    } catch (error) {
      status("Leaderboard is not available yet.");
    }
  }

  async function publish() {
    var saved = device();
    if (!saved?.joined) return;
    var client = window.UBG_SUPABASE;
    if (!client) throw new Error("Leaderboard could not connect.");
    var profile = window.UBGStore.get().profile;
    var result = await client.rpc("publish_slipstream_profile", {
      p_player_id: saved.id,
      p_secret: saved.secret,
      p_name: String(profile.name || "Player").slice(0, 40),
      p_xp: Math.min(
        1000000000,
        Math.max(0, Math.floor(Number(profile.xp) || 0)),
      ),
      p_avatar_url: /^https:\/\//i.test(profile.avatarUrl || "")
        ? profile.avatarUrl
        : null,
    });
    if (result.error) throw new Error("Leaderboard is not available yet.");
  }

  function panel() {
    var joined = device()?.joined;
    return (
      '<div class="p-card wide leaderboard-card"><div class="leaderboard-head"><h3>Leaderboard</h3>' +
      '<button class="p-btn" id="leaderboard-refresh" type="button">Refresh</button></div>' +
      '<ol class="leaderboard-list" id="leaderboard-list" aria-label="Top ten players">' +
      rows([]) +
      "</ol>" +
      '<p class="leaderboard-status" id="leaderboard-status" role="status"></p>' +
      '<div class="p-actions"><button class="p-btn" id="leaderboard-join" type="button">' +
      (joined ? "Leave leaderboard" : "Join leaderboard") +
      "</button></div>" +
      '<p class="leaderboard-status">' +
      (joined
        ? "Your profile name, XP and picture are shared."
        : "Joining shares your profile name, XP and picture.") +
      "</p></div>"
    );
  }

  function mount() {
    var refreshButton = document.getElementById("leaderboard-refresh");
    if (!refreshButton) return;
    refreshButton.onclick = refresh;
    document.getElementById("leaderboard-join").onclick = async function () {
      var button = this;
      button.disabled = true;
      try {
        var saved = device();
        if (saved?.joined) {
          var response = await window.UBG_SUPABASE.rpc(
            "leave_slipstream_leaderboard",
            {
              p_player_id: saved.id,
              p_secret: saved.secret,
            },
          );
          if (response.error)
            throw new Error("Could not leave the leaderboard. Please retry.");
          saveIdentity(Object.assign({}, saved, { joined: false }));
        } else {
          if (!saved)
            saved = { id: crypto.randomUUID(), secret: crypto.randomUUID() };
          saveIdentity(Object.assign({}, saved, { joined: true }));
          try {
            await publish();
          } catch (error) {
            saveIdentity(Object.assign({}, saved, { joined: false }));
            throw error;
          }
        }
        window.UBGProfile.render();
      } catch (error) {
        status(error.message);
        button.disabled = false;
      }
    };
    refresh();
  }

  window.addEventListener("ubgstatechange", function () {
    if (!device()?.joined) return;
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (syncing) return;
      syncing = publish()
        .then(refresh)
        .catch(function (error) {
          status(error.message);
        })
        .finally(function () {
          syncing = null;
        });
    }, 700);
  });

  window.SlipstreamLeaderboard = { panel: panel, mount: mount, rows: rows };
})();
