import { aiPolicy } from "./ai-policy.mjs";

export function createAttachmentQueue({
  read = readAttachment,
  onChange = () => {},
  onError = () => {},
} = {}) {
  let files = [];
  let pending = Promise.resolve();
  let generation = 0;

  return {
    enqueue(selected) {
      const expected = generation;
      pending = pending.then(async () => {
        for (const file of selected) {
          if (expected !== generation) return;
          if (files.length >= aiPolicy.maxFiles) {
            onError("You can attach up to four files.");
            break;
          }
          try {
            if (file.size > aiPolicy.maxFileBytes)
              throw new Error(file.name + " exceeds 512 KB.");
            const attachment = await read(file);
            if (expected !== generation) return;
            files.push(attachment);
            onChange(files.slice());
          } catch (error) {
            if (expected === generation) onError(error.message);
          }
        }
      });
      return pending;
    },
    async ready() {
      let current;
      do {
        current = pending;
        await current;
      } while (current !== pending);
      return files.slice();
    },
    remove(index) {
      files.splice(index, 1);
      onChange(files.slice());
    },
    reset(restored = []) {
      generation++;
      files = restored.slice();
      onChange(files.slice());
    },
  };
}

export async function readAttachment(file) {
  const imageTypes = {
    "image/png": "png",
    "image/jpeg": "jpeg",
    "image/webp": "webp",
  };
  const extension = /\.(png|jpe?g|webp)$/i
    .exec(file.name)?.[1]
    .toLowerCase()
    .replace("jpg", "jpeg");
  const type = imageTypes[file.type] || extension;
  if (type) {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () =>
        reject(new Error("Could not read " + file.name + "."));
      reader.readAsDataURL(file);
    });
    const url = "data:image/" + type + ";base64," + data.split(",")[1];
    const preview = new Image();
    preview.src = url;
    try {
      await preview.decode();
    } catch {
      throw new Error("Could not decode " + file.name + " as an image.");
    }
    return { name: file.name, image: url };
  }
  if (!/\.(txt|md|csv|json|js|ts|html|css|py|xml|log)$/i.test(file.name)) {
    throw new Error(
      "Unsupported file type. Choose PNG, JPEG, WebP, text or code files.",
    );
  }
  const content = await file.text();
  if (content.includes("\0") || content.includes("\ufffd"))
    throw new Error("Could not read " + file.name + " as UTF-8 text.");
  return { name: file.name, content };
}

export function messagePayload(text, attachments) {
  const content =
    text +
    attachments
      .filter((file) => !file.image)
      .map((file) => "\n\nAttached file: " + file.name + "\n" + file.content)
      .join("");
  if (content.length > aiPolicy.maxTextCharacters)
    throw new Error(
      "Message and files exceed the text limit. Remove a file or shorten the message.",
    );
  const images = attachments.filter((file) => file.image);
  return images.length
    ? [
        { type: "text", text: content },
        ...images.map((file) => ({
          type: "image_url",
          image_url: { url: file.image },
        })),
      ]
    : content;
}
