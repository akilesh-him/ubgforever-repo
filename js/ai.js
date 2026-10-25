import { mountChatScroll } from "./ai-scroll.mjs";
import { createAttachmentQueue, messagePayload } from "./ai-attachments.mjs";
import { aiPolicy } from "./ai-policy.mjs";
(function () {
  "use strict";

  var history = [];
  var busy = false;
  var generation = 0;
  var request;

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("ai-form");
    var input = document.getElementById("ai-input");
    var log = document.getElementById("ai-messages");
    var send = document.getElementById("ai-send");
    var welcome = log.innerHTML;
    var scrollFollower = mountChatScroll(log, function () {
      return history.length > 0;
    });

    var picker = document.getElementById("ai-file-input");
    var files = document.getElementById("ai-files");
    function resize() {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 180) + "px";
    }
    input.addEventListener("input", resize);
    function showFiles(attachments) {
      files.replaceChildren();
      attachments.forEach(function (file, index) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "ai-file";
        if (file.image) {
          var thumbnail = document.createElement("img");
          thumbnail.src = file.image;
          thumbnail.alt = "";
          button.appendChild(thumbnail);
        }
        button.appendChild(document.createTextNode(file.name + " ×"));
        button.setAttribute("aria-label", "Remove " + file.name);
        button.onclick = function () {
          attachmentQueue.remove(index);
        };
        files.appendChild(button);
      });
    }
    var attachButton = document.getElementById("ai-attach");
    attachButton.onclick = function () {
      if (!busy) picker.click();
    };
    function setBusy(value) {
      busy = value;
      send.disabled = value;
      attachButton.disabled = value;
    }
    var attachmentQueue = createAttachmentQueue({
      onChange: showFiles,
      onError: function (message) {
        window.alert(message);
      },
    });
    function queueAttachments(selected) {
      if (!busy) attachmentQueue.enqueue(selected);
    }
    picker.onchange = function () {
      queueAttachments(Array.from(picker.files));
      picker.value = "";
    };
    input.addEventListener("paste", function (event) {
      var images = Array.from(event.clipboardData?.items || [])
        .filter(function (item) {
          return item.kind === "file" && /^image\//i.test(item.type);
        })
        .map(function (item) {
          return item.getAsFile();
        })
        .filter(Boolean);
      if (!images.length) return;
      event.preventDefault();
      queueAttachments(
        images.map(function (file, index) {
          var extension = {
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/webp": "webp",
          }[file.type];
          return extension
            ? new File(
                [file],
                "Pasted image " + (index + 1) + "." + extension,
                { type: file.type },
              )
            : file;
        }),
      );
      var text = event.clipboardData.getData("text/plain");
      if (text) {
        input.setRangeText(
          text,
          input.selectionStart,
          input.selectionEnd,
          "end",
        );
        resize();
      }
    });

    function message(role, text) {
      var element = document.createElement("div");
      element.className = "ai-message " + role;
      var label = document.createElement("small");
      label.textContent = role === "user" ? "YOU" : "SLIPSTREAM AI";
      var body = document.createElement("div");
      body.className = "ai-message-body";
      body.textContent = String(text || "").trim();
      element.append(label, body);
      log.appendChild(element);
      return element;
    }

    form.onsubmit = async function (event) {
      event.preventDefault();
      var text = input.value.trim();
      if (!text || busy) return;
      var current = generation;
      setBusy(true);
      var sentFiles = await attachmentQueue.ready();
      if (current !== generation) return;
      var payload;
      try {
        payload = messagePayload(text, sentFiles);
      } catch (error) {
        window.alert(error.message);
        setBusy(false);
        return;
      }
      attachmentQueue.reset();
      log.querySelector(".ai-welcome")?.remove();
      input.value = "";
      resize();
      message(
        "user",
        text +
          (sentFiles.length
            ? "\n\n" +
              sentFiles
                .map(function (f) {
                  return f.name;
                })
                .join(", ")
            : ""),
      );
      history.push({ role: "user", content: payload });
      var pending = message("assistant", "");
      var thinking = document.createElement("span");
      thinking.className = "ai-thinking";
      thinking.setAttribute("role", "status");
      thinking.setAttribute("aria-label", "Thinking");
      Array.from("Thinking…").forEach(function (letter, index) {
        var character = document.createElement("span");
        character.textContent = letter;
        character.setAttribute("aria-hidden", "true");
        character.style.setProperty("--letter-delay", index * 85 + "ms");
        thinking.appendChild(character);
      });
      pending.appendChild(thinking);
      request = new AbortController();
      try {
        var response = await fetch("/api/ai", {
          method: "POST",
          signal: request.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.slice(-aiPolicy.maxMessages),
          }),
        });
        var data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Could not connect. Please retry.");
        if (current !== generation) return;
        pending.remove();
        var answer = message("assistant", data.content);
        history.push({ role: "assistant", content: data.content });
        if (data.sources?.length) {
          var sources = document.createElement("div");
          sources.className = "ai-sources";
          data.sources.forEach(function (source) {
            if (!/^https?:\/\//i.test(source.url)) return;
            var link = document.createElement("a");
            link.textContent = source.title;
            link.href = source.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            sources.appendChild(link);
          });
          answer.appendChild(sources);
        }
      } catch (error) {
        if (current !== generation) return;
        pending.remove();
        message("assistant", error.message);
        history.pop();
        input.value = text;
        attachmentQueue.reset(sentFiles);
        resize();
      } finally {
        if (current === generation) {
          setBusy(false);
        }
      }
    };

    input.onkeydown = function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    };

    document.getElementById("ai-clear").onclick = function () {
      scrollFollower.reset();
      generation++;
      request?.abort();
      history = [];
      setBusy(false);
      log.innerHTML = welcome;
      input.value = "";
      attachmentQueue.reset();
      resize();
      input.focus();
    };
  });
})();
