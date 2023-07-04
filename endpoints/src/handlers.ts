import { EndpointExtensionContext } from "@directus/shared/types";
import e, { Response } from "express";
import axios from "axios";
const ASSET_URL = "http://3.0.100.91:8055/assets";

export const handleUpsertSetting =
  (ctx: EndpointExtensionContext) => async (req: any, res: Response) => {
    const { ForbiddenException } = ctx.exceptions;

    const body = req.body;

    const data = await ctx.database
      .table("settings")
      .insert({
        key: body.key,
        value: body.value,
        class: body.class || 0,
      })
      .onConflict(["key", "class"])
      .merge(["value"])
      .catch((err: Error) => err);

    if (data instanceof Error) {
      res.status(500).send(data);
      return;
    }

    res.send({ success: true });
  };

export const handleUpsertCico =
  (ctx: EndpointExtensionContext) => async (req: any, res: Response) => {
    const body = req.body;

    let m = new Date(body.date);
    let month = String(m.getMonth() + 1).padStart(2, "0");
    let day = String(m.getDate()).padStart(2, "0");
    let dateString = "" + m.getUTCFullYear() + month + day;
    body.unique_date_student_id = `${body.student}_${dateString}`;
    let date = new Date(m.getUTCFullYear() + "-" + month + "-" + day);
    body.date = date.getTime();

    let mergeFields = [
      "checkin",
      "checkout",
      "absence_reason",
      "absence",
      "register_picker",
      "picker_name",
      "picker",
      "picking_confirmed_by_parent"
    ].reduce((prev, value) => {
      prev.set(value, true);
      return prev;
    }, new Map<string, boolean>());

    for (const key of mergeFields.keys()) {
      if (!body[key]) {
        mergeFields.delete(key);
      }
    }

    const data = await ctx.database
      .table("cico_photos")
      .insert(body)
      .onConflict(["unique_date_student_id"])
      .merge([...mergeFields.keys()])
      .catch((err: Error) => err);

    if (data instanceof Error) {
      console.log("failed to upsert cico_photos", data);
      res.status(500).send(data);
      return;
    }

    ctx.emitter.emitAction(
      "items.create",
      {
        collection: "cico_photos",
        payload: body,
      },
      ctx
    );

    res.send({ success: true });
  };

// log001
export const updateClassFaceId =
  (ctx: EndpointExtensionContext) => async (req: any, res: Response) => {
    const { database } = ctx;
    const body = req.body;

    console.log("log001_request_body: ", body);

    const students = await database
      .select(
        "id",
        "last_name",
        "first_name",
        "face_id",
        "frontal_face",
        "left_side_face",
        "right_side_face"
      )
      .table("students")
      .where("current_class", body.id);

    console.log("log001_db_query: ", students);

    let list = [];
    let failed_list = [];

    if (body.update_mode == "1") {
      let count = 0;
      for (let s of students) {
        if (s.frontal_face) {
          const frontal = (
            await compositeImage(`${ASSET_URL}/${s.frontal_face}`)
          ).toString("base64");
          let left = frontal;
          if (s.left_side_face) {
            left = (
              await compositeImage(`${ASSET_URL}/${s.left_side_face}`)
            ).toString("base64");
          }
          let right = frontal;
          if (s.right_side_face) {
            right = (
              await compositeImage(`${ASSET_URL}/${s.right_side_face}`)
            ).toString("base64");
          }

          if (s.face_id) {
            const newFaceResult = await registerNewFace(
              s.face_id,
              frontal,
              left,
              right
            );

            console.log(
              "log001_new_face_result_",
              s.id,
              " :",
              newFaceResult.data
            );

            if (
              newFaceResult.data.code != "1000" &&
              newFaceResult.data.code != "709"
            ) {
              let status = newFaceResult.data.status;
              if (newFaceResult.data.code == "1001") {
                status = "Poor image quality";
              }
              failed_list.push(
                ++count +
                  ". " +
                  s.last_name +
                  " " +
                  s.first_name +
                  " : " +
                  status
              );
            }
          } else {
            const newPersonResult = await registerNewPerson(
              s.last_name + " " + s.first_name
            );
            console.log(
              "log001_new_person_result_",
              s.id,
              " :",
              newPersonResult.data
            );

            const newFaceResult = await registerNewFace(
              newPersonResult.data.person_id,
              frontal,
              left,
              right
            );
            console.log(
              "log001_new_face_result_",
              s.id,
              " :",
              newFaceResult.data
            );

            if (
              newFaceResult.data.code == "1000" ||
              newFaceResult.data.code == "709"
            ) {
              list.push({ id: s.id, face_id: newFaceResult.data.person_id });
            } else {
              let status = newFaceResult.data.status;
              if (newFaceResult.data.code == "1001") {
                status = "Poor image quality";
              }
              failed_list.push(
                ++count +
                  ". " +
                  s.last_name +
                  " " +
                  s.first_name +
                  ": " +
                  status
              );
            }
          }
        } else {
          failed_list.push(
            ++count +
              ". " +
              s.last_name +
              " " +
              s.first_name +
              " : Student has not provided face's images"
          );
        }
      }
    } else {
      let count = 0;
      for (let s of students) {
        if (s.face_id == null) {
          if (s.frontal_face) {
            const frontal = (
              await compositeImage(`${ASSET_URL}/${s.frontal_face}`)
            ).toString("base64");
            let left = frontal;
            if (s.left_side_face) {
              left = (
                await compositeImage(`${ASSET_URL}/${s.left_side_face}`)
              ).toString("base64");
            }
            let right = frontal;
            if (s.right_side_face) {
              right = (
                await compositeImage(`${ASSET_URL}/${s.right_side_face}`)
              ).toString("base64");
            }

            const newPersonResult = await registerNewPerson(
              s.last_name + " " + s.first_name
            );
            console.log(
              "log001_new_person_result_",
              s.id,
              " :",
              newPersonResult.data
            );
            const newFaceResult = await registerNewFace(
              newPersonResult.data.person_id,
              frontal,
              left,
              right
            );
            console.log(
              "log001_new_face_result_",
              s.id,
              " :",
              newFaceResult.data
            );

            if (
              newFaceResult.data.code == "1000" ||
              newFaceResult.data.code == "709"
            ) {
              list.push({ id: s.id, face_id: newFaceResult.data.person_id });
            } else {
              let status = newFaceResult.data.status;
              if (newFaceResult.data.code == "1001") {
                status = "Poor image quality";
              }
              failed_list.push(
                ++count +
                  ". " +
                  s.last_name +
                  " " +
                  s.first_name +
                  ": " +
                  status
              );
            }
          } else {
            failed_list.push(
              ++count +
                ". " +
                s.last_name +
                " " +
                s.first_name +
                " : Student has not provided face's images"
            );
          }
        }
      }
    }

    console.log("log001_list :", list);
    console.log("log001_failed_list :", failed_list);

    if (list.length > 0) {
      const result = await performBatchUpdate(ctx, list);
      if (
        result &&
        Array.isArray(result.failedItems) &&
        result.failedItems.length > 0
      ) {
        console.log(
          "Faces are registered for other student: ",
          result.failedItems
        );
        // failed_list = [...failed_list, ...result.failedItems];
      }
    }

    if (failed_list.length > 0) {
      res
        .status(500)
        .send({ success: true, failed_list: failed_list.join("\n\n") });
    } else {
      res.send({ success: true });
    }
  };

// log002
export const updateStudentsFaceId =
  (ctx: EndpointExtensionContext) => async (req: any, res: Response) => {
    const { database } = ctx;

    console.log("log002_request_body: ", req.body);

    const studentIds = req.body.students;
    const studentIds1 = studentIds
      .replace(/\[/g, "")
      .replace(/\]/g, "")
      .split(",");

    const students = await database
      .select(
        "id",
        "last_name",
        "first_name",
        "face_id",
        "frontal_face",
        "left_side_face",
        "right_side_face"
      )
      .from("students")
      .whereIn("id", studentIds1);

    console.log("log002_db_query: ", students);

    let list = [];
    let failed_list = [];
    let count = 0;

    for (let s of students) {
      if (s.frontal_face) {
        const frontal = (
          await compositeImage(`${ASSET_URL}/${s.frontal_face}`)
        ).toString("base64");
        let left = frontal;
        if (s.left_side_face) {
          left = (
            await compositeImage(`${ASSET_URL}/${s.left_side_face}`)
          ).toString("base64");
        }
        let right = frontal;
        if (s.right_side_face) {
          right = (
            await compositeImage(`${ASSET_URL}/${s.right_side_face}`)
          ).toString("base64");
        }

        if (s.face_id) {
          const newFaceResult = await registerNewFace(
            s.face_id,
            frontal,
            left,
            right
          );
          console.log("log002_new_face_", s.id, " :", newFaceResult.data);

          if (
            newFaceResult.data.code != "1000" &&
            newFaceResult.data.code != "709"
          ) {
            let status = newFaceResult.data.status;
            if (newFaceResult.data.code == "1001") {
              status = "Poor image quality";
            }
            failed_list.push(
              ++count + ". " + s.last_name + " " + s.first_name + " : " + status
            );
          }
        } else {
          const newPersonResult = await registerNewPerson(
            s.last_name + " " + s.first_name
          );
          console.log("log002_new_person_", s.id, " :", newPersonResult.data);
          const newFaceResult = await registerNewFace(
            newPersonResult.data.person_id,
            frontal,
            left,
            right
          );
          console.log("log002_new_face_", s.id, " :", newFaceResult.data);

          if (
            newFaceResult.data.code == "1000" ||
            newFaceResult.data.code == "709"
          ) {
            list.push({ id: s.id, face_id: newFaceResult.data.person_id });
          } else {
            let status = newFaceResult.data.status;
            if (newFaceResult.data.code == "1001") {
              status = "Poor image quality";
            }
            failed_list.push(
              ++count + ". " + s.last_name + " " + s.first_name + ": " + status
            );
          }
        }
      } else {
        failed_list.push(
          ++count +
            ". " +
            s.last_name +
            " " +
            s.first_name +
            " : Student has not provided face's images"
        );
      }
    }

    console.log("log002_list: ", list);
    console.log("log002_failed_list: ", failed_list);

    if (list.length > 0) {
      let result = await performBatchUpdate(ctx, list);
      if (
        result &&
        Array.isArray(result.failedItems) &&
        result.failedItems.length > 0
      ) {
        console.log(
          "Faces are registered for other student: ",
          result.failedItems
        );
        // failed_list = [...failed_list, ...result.failedItems];
      }
    }

    if (failed_list.length > 0) {
      res
        .status(500)
        .send({ success: true, failed_list: failed_list.join("\n\n") });
    } else {
      res.send({ success: true });
    }
  };

async function compositeImage(inputUrl: string): Promise<Buffer> {
  return (await axios({ url: inputUrl, responseType: "arraybuffer" }))
    .data as Buffer;
}

async function performBatchUpdate(ctx: EndpointExtensionContext, students) {
  const { database } = ctx;
  const existingFaceIds1 = await database("students")
    .whereIn(
      "face_id",
      students.map((s) => s.face_id)
    )
    .select("id", "face_id")
    .catch(() => []);
  const existingFaceIds = existingFaceIds1.map((i) => i.face_id);
  console.log("existingFaceIds: ", existingFaceIds);
  console.log("existingFaceIds1: ", existingFaceIds);

  const failedItems = [];
  const updatedItems = await database.transaction(
    (trx) => {
      const queries = [];
      for (const s of students) {
        let flag=0
        for (const e of existingFaceIds1) {
          if (e.face_id == s.face_id) {
            if (e.id != s.id) {
              failedItems.push(s);
            }
            flag=1
            break;
          }
        }
        if(flag==1) continue;

        queries.push(
          database("students")
            .where("id", s.id)
            .update({
              face_id: s.face_id,
            })
            .transacting(trx)
        );
      }

      console.log("batch_update_queries: ", queries);

      Promise.all(queries) // Once every query is written
        .then(trx.commit) // We try to execute all of them
        .catch(trx.rollback); // And rollback in case any of them goes wrong
    },
    { doNotRejectOnRollback: true }
  );
  return {
    failedItems,
    updatedItems,
  };
}

async function registerNewFace(
  face_id: Number,
  frontal: string,
  left: string,
  right: string
) {
  return await axios.post("http://27.74.253.109:19692/checkin_api/register", {
    merchant_id: "8",
    group_id: "8",
    person_id: face_id,
    force: "0",
    image_base64s: {
      frontal: frontal,
      left: left,
      right: right,
    },
  });
}

async function registerNewPerson(fullName: string) {
  return await axios.post("http://27.74.253.109:19692/web_api/person", {
    merchant_id: 8,
    group_id: 8,
    person_fullname: fullName,
  });
}

export const handleUpdateStudentClass =
  (ctx: EndpointExtensionContext) => async (req: any, res: Response) => {
    const { database } = ctx;
    const body = req.body;
    console.log("thuyyy_body: ", body);

    const studentIds = body.students
      .replace(/\[/g, "")
      .replace(/\]/g, "")
      .split(",");
    const classId = body.class;

    console.log("thuyyy_studentIds: ", studentIds);
    console.log("thuyyy_classId: ", classId);

    database.transaction((trx) => {
      const queries = [];
      for (let i in studentIds) {
        const query = database("students_classes")
          .insert({
            class: classId,
            student: studentIds[i],
          })
          .onConflict(["student", "class"])
          .ignore()
          .transacting(trx);

        queries.push(query);
      }

      Promise.all(queries).then(trx.commit).catch(trx.rollback);
    });

    res.send({ success: true });
  };
