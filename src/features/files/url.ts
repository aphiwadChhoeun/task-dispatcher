export function fileUrl(key: string): string {
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}
