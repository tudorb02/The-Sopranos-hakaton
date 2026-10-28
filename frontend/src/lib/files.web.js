export function pickDocument(receipt = false) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = receipt ? ".pdf,.jpg,.jpeg,.png" : ".pdf,.csv,.xls,.xlsx";
    input.style.display = "none"; document.body.append(input);
    const finish = (value) => { input.remove(); resolve(value); };
    input.onchange = () => finish(input.files?.[0] ?? null);
    input.oncancel = () => finish(null);
    input.click();
  });
}

export function documentPayload(file) {
  if (file.size > 10 * 1024 * 1024) return Promise.reject(new Error("Fișierul depășește limita de 10 MiB."));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Nu pot citi fișierul. Încearcă din nou."));
    reader.onload = () => resolve({ name: file.name, mime: file.type || "application/octet-stream", content_base64: String(reader.result).split(",")[1] });
    reader.readAsDataURL(file);
  });
}
