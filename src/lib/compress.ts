export async function compressPhoto(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)
  )
    throw Error(
      "Выберите JPG, PNG, WebP или AVIF. Фото HEIC сначала экспортируйте в JPG.",
    );
  if (file.size > 25 * 1024 * 1024) throw Error("Выберите фото меньше 25 МБ.");
  const bitmap = await createImageBitmap(file);
  let width = Math.min(bitmap.width, 1280);
  let result: Blob | null = null;
  try {
    for (let pass = 0; pass < 8; pass++) {
      const ratio = width / bitmap.width;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width);
      canvas.height = Math.round(bitmap.height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error("Браузер не поддерживает обработку фото.");
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      result = await new Promise<Blob | null>((r) =>
        canvas.toBlob(r, "image/webp", Math.max(0.52, 0.82 - pass * 0.045)),
      );
      if (result && result.size <= 160 * 1024) break;
      width = Math.round(width * 0.88);
    }
    if (!result || result.type !== "image/webp" || result.size > 160 * 1024)
      throw Error("Не удалось сжать фото до 160 КБ. Попробуйте меньший файл.");
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(result!);
    });
    return { data, bytes: result.size, original: file.size, name: file.name };
  } finally {
    bitmap.close();
  }
}
