import { cloudEnabled, tencentEnabled } from "./cloud/config";
import { supabase, authorizedFetch } from "./cloud/client";
import { uid } from "./model";
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("shiyu-photos", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("images");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("无法打开图片存储，请检查浏览器是否允许本地数据。"));
  });
}
export async function readPhoto(
  user: string,
  id: string,
): Promise<string | undefined> {
  if (tencentEnabled) {
    const r = await authorizedFetch(
      "/api/tencent/photos?id=" + encodeURIComponent(id),
    );
    const body = await r.json();
    if (!r.ok) throw new Error(body.message);
    return body.url;
  }
  if (cloudEnabled) {
    const { data, error } = await supabase()
      .storage.from("diary-images")
      .createSignedUrl(`${user}/${id}.jpg`, 600);
    if (error) throw new Error("云端图片读取失败，请检查网络后重试。");
    return data.signedUrl;
  }
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const req = db
        .transaction("images")
        .objectStore("images")
        .get(`${user}:${id}`);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error("图片读取失败"));
    });
  } finally {
    db.close();
  }
}
export async function storePhoto(user: string, file: File): Promise<string> {
  if (
    file.size > 10 * 1024 * 1024 ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  )
    throw new Error("请选择 10MB 以内的 PNG、JPEG 或 WebP 图片。");
  const url = URL.createObjectURL(file);
  let data: string;
  try {
    data = await new Promise<string>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => {
        if (image.width * image.height > 50_000_000) {
          reject(new Error("图片尺寸过大，请压缩后再上传。"));
          return;
        }
        const ratio = Math.min(1, 1600 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("浏览器无法处理图片"));
          return;
        }
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.onerror = () => reject(new Error("图片损坏或格式不支持"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
  const id = uid();
  if (tencentEnabled) {
    const r = await authorizedFetch("/api/tencent/photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: data }),
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body.message);
    return body.id;
  }
  if (cloudEnabled) {
    const blob = await (await fetch(data)).blob();
    const { error } = await supabase()
      .storage.from("diary-images")
      .upload(`${user}/${id}.jpg`, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (error)
      throw new Error("图片上传失败，请检查网络和账号存储额度后重试。");
    return id;
  }
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("images", "readwrite");
      tx.objectStore("images").put(data, `${user}:${id}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(new Error("图片保存失败，可能已超出浏览器存储额度。"));
      tx.onabort = () => reject(new Error("图片保存被中断，请重试。"));
    });
  } finally {
    db.close();
  }
  return id;
}
