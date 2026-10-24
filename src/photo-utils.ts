export const photoTypes = ["image/jpeg", "image/png", "image/webp"];
export async function preparePhoto(file: File): Promise<Blob> {
  if (!photoTypes.includes(file.type))
    throw Error("请选择 JPG、PNG 或 WebP 图片");
  if (file.size > 15 * 1024 * 1024) throw Error("单张照片不能超过 15MB");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (img.naturalWidth * img.naturalHeight > 50000000)
      throw Error("图片尺寸过大，请缩小后重试");
    const ratio = Math.min(
        1,
        1600 / Math.max(img.naturalWidth, img.naturalHeight),
      ),
      canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("当前浏览器无法处理照片");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(Error("照片处理失败"))),
        "image/jpeg",
        0.85,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
