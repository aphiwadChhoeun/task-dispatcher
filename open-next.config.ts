import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default OpenNext Cloudflare setup. Add an incremental cache / tag cache
// (for example R2 + D1) here when the app starts using ISR at scale.
export default defineCloudflareConfig({});
