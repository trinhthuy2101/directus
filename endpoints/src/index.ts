import { defineEndpoint } from "@directus/extensions-sdk";
import { handleUpsertSetting, handleUpsertCico, updateClassFaceId, updateStudentsFaceId,handleUpdateStudentClass,genClassDailyReport} from "./handlers";

export default defineEndpoint({
  id: "exts",
  handler(router, ctx) {
    router.post("/settings", handleUpsertSetting(ctx));
    router.post("/cico_photos", handleUpsertCico(ctx));
    router.post("/update_class_face_id", updateClassFaceId(ctx));
    router.post("/update_students_face_id", updateStudentsFaceId(ctx));
    router.post("/handle_update_student_class", handleUpdateStudentClass(ctx));
    router.post("/gen_class_daily_report",genClassDailyReport(ctx))
  },
});
