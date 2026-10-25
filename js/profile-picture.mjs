export function validateProfilePicture(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPG, PNG or WebP picture.");
  if (file.size > 8 * 1024 * 1024)
    throw new Error("Choose a picture under 8 MB.");
}

export async function prepareProfilePicture(file) {
  validateProfilePicture(file);
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const side = Math.min(image.width, image.height);
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Picture editing is unavailable in this browser.");
    context.drawImage(
      image,
      (image.width - side) / 2,
      (image.height - side) / 2,
      side,
      side,
      0,
      0,
      256,
      256,
    );
    return canvas.toDataURL("image/webp", 0.82);
  } finally {
    image.close();
  }
}
