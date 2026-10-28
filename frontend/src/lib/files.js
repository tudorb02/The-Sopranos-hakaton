import { getDocumentAsync } from "expo-document-picker";

export async function pickDocument(receipt = false) {
  const result = await getDocumentAsync({ type: receipt ? ["image/*", "application/pdf"] : ["application/pdf", "text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], copyToCacheDirectory: true });
  return result.canceled ? null : result.assets[0];
}

export async function documentPayload(file) {
  if (file.size > 10 * 1024 * 1024) throw new Error("Fișierul depășește limita de 10 MiB.");
  const blob = await (await fetch(file.uri)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Nu pot citi fișierul. Încearcă din nou."));
    reader.onload = () => resolve({ name: file.name, mime: file.mimeType || "application/octet-stream", content_base64: String(reader.result).split(",")[1] });
    reader.readAsDataURL(blob);
  });
}
