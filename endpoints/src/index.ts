import { defineEndpoint } from "@directus/extensions-sdk";
import { handleUpsertSetting, handleDownloadAvatarWithFrame } from "./handlers";

export default defineEndpoint({
  id: "exts",
  handler(router, ctx) {
    router.post("/settings", handleUpsertSetting(ctx));
    // router.get("/downloads/avatar-with-frame", handleDownloadAvatarWithFrame(ctx));
    router.post("/cico_photos", handleUpsertCico(ctx));
  },
});
