import { defineEndpoint } from "@directus/extensions-sdk";
import * as h from "./handlers";

export default defineEndpoint({
  id: "exts",
  handler(router, ctx) {
    router.post("/settings", h.handleUpsertFrameSettings(ctx));
    router.post("/cico_photos", h.handleUpsertCicoPhotos(ctx));
    router.post("/update_class_face_id", h.UpdateFaceIdForAClass(ctx));
    router.post("/update_students_face_id", h.updateFaceIdForChosenStudents(ctx));
    router.post("/handle_update_student_class", h.handleUpdateClassForStudents(ctx));
    router.post("/gen_class_daily_report",h.genClassDailyReport(ctx))
    router.post("/gen_school_daily_report",h.genSchoolDailyReport(ctx))
    router.post("/gen_cico_records_automatically",h.generateCicoRecords(ctx))
    router.post("/generate_class_reports",h.generateClassReports(ctx))
    router.post("/handle_convert_face_id_to_student_id",h.convertFaceIdToId(ctx))
  },
});
