import { defineEndpoint } from "@directus/extensions-sdk";
import { handleUpsertSetting, handleUpsertCico, updateClassFaceId, updateStudentsFaceId} from "./handlers";

export default defineEndpoint({
  id: "exts",
  handler(router, ctx) {
    router.post("/settings", handleUpsertSetting(ctx));
    // router.get("/downloads/avatar-with-frame", handleDownloadAvatarWithFrame(ctx));
    router.post("/cico_photos", handleUpsertCico(ctx));
    router.post("/update_class_face_id", updateClassFaceId(ctx));
    router.post("/update_students_face_id", updateStudentsFaceId(ctx));
  },
});
