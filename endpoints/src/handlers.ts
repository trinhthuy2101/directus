import { EndpointExtensionContext } from "@directus/shared/types";
import { Response } from "express";
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

    let m = new Date(body.datetime);
    let month = String(m.getMonth() + 1).padStart(2, "0");
    let day = String(m.getDate()).padStart(2, "0");
    let dateString = "" + m.getUTCFullYear() + month + day;
    body.unique_date_student_id = `${body.student}_${dateString}`;
    let date = new Date(m.getUTCFullYear() + "-" + month + "-" + day);
    body.date = date.getTime();
    body.datetime = m.getTime();

    let mergeFields = [
      "checkin",
      "checkout",
      "absence_reason",
      "absence",
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

export const updateClassFaceId =
  (ctx: EndpointExtensionContext) => async (req: any, res: Response) => {
    const { database } = ctx;
    const body = req.body;

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

    let list = [];
    let failed_list = [];

  if (body.update_mode=="1") {
    let count=0;
    for (let s of students) {
      if (s.frontal_face && s.left_side_face && s.right_side_face) {
        const frontal=(await compositeImage(`${ASSET_URL}/${s.frontal_face}`)).toString('base64');
        const left=(await compositeImage(`${ASSET_URL}/${s.left_side_face}`)).toString('base64');
        const right=(await compositeImage(`${ASSET_URL}/${s.right_side_face}`)).toString('base64');

        if (s.face_id) {
          const newFaceResult=await registerNewFace(s.face_id,frontal,left,right)

          console.log(newFaceResult.data)

          if (newFaceResult.data.code!='1000'&&newFaceResult.data.code!='709') {
            failed_list.push(++count+'. '+s.last_name+" "+s.first_name+" : "+newFaceResult.data.status)
          }
        }
        else{
          const newPersonResult = await registerNewPerson(s.last_name+" "+s.first_name)
          console.log(newPersonResult.data)
          const newFaceResult= await registerNewFace(newPersonResult.data.person_id,frontal,left,right)
          console.log(newFaceResult.data)

          if (newFaceResult.data.code=='1000'||newFaceResult.data.code=='709') {
            list.push({"id":s.id,"face_id":newFaceResult.data.person_id})
          }else{
            failed_list.push(++count+'. '+s.last_name+" "+s.first_name+": "+newFaceResult.data.status)
          }
        }
      }
      else{
        failed_list.push(++count+'. '+s.last_name+" "+s.first_name+" : Student has not provided face's images")
      }
    }
  } else{
    let count=0;
    for (let s of students) {
      if(s.face_id==null){
        if (s.frontal_face&&s.left_side_face&&s.right_side_face){
          const frontal=(await compositeImage(`${ASSET_URL}/${s.frontal_face}`)).toString('base64');
          const left=(await compositeImage(`${ASSET_URL}/${s.left_side_face}`)).toString('base64');
          const right=(await compositeImage(`${ASSET_URL}/${s.right_side_face}`)).toString('base64');

          const newPersonResult = await registerNewPerson(s.last_name+" "+s.first_name)
          console.log(newPersonResult.data)
          const newFaceResult=await registerNewFace(newPersonResult.data.person_id,frontal,left,right)
          console.log(newFaceResult.data)

          if (newFaceResult.data.code=='1000'||newFaceResult.data.code=='709') {
            list.push({"id":s.id,"face_id":newFaceResult.data.person_id})
          }else{
            failed_list.push(++count+'. '+s.last_name+" "+s.first_name+": "+newFaceResult.data.status)
          }
        } else{
          failed_list.push(++count+'. '+s.last_name+" "+s.first_name+" : Student has not provided face's images")
        }
      }
    }
  }
  
  console.log(list)
  console.log(failed_list)
  
  if (list.length>0) {
    performBatchUpdate(ctx,list);
  }

  if (failed_list.length>0) {
    res.status(500).send({ success: true, failed_list: failed_list.join('\n\n') });
  }
  else{
    res.send({ success: true});
  }
}

export const updateStudentsFaceId =
  (ctx: EndpointExtensionContext) => async (req: any, res: Response) => {
  const { database } = ctx;
  const studentIds = req.body.students;
  const studentIds1=studentIds.replace(/\[/g, "").replace(/\]/g, "").split(',');

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

  let list = [];
  let failed_list = [];
  let count=0;

  for (let s of students) {
    if (s.frontal_face && s.left_side_face && s.right_side_face) {
      const frontal=(await compositeImage(`${ASSET_URL}/${s.frontal_face}`)).toString('base64');
      const left=(await compositeImage(`${ASSET_URL}/${s.left_side_face}`)).toString('base64');
      const right=(await compositeImage(`${ASSET_URL}/${s.right_side_face}`)).toString('base64');

      if (s.face_id) {
        const newFaceResult=await registerNewFace(s.face_id,frontal,left,right)
        console.log(newFaceResult.data)

        if (newFaceResult.data.code!='1000'&&newFaceResult.data.code!='709') {
          failed_list.push(++count+'. '+s.last_name+" "+s.first_name+" : "+newFaceResult.data.status)
        }
      }
      else{
        const newPersonResult = await registerNewPerson(s.last_name+" "+s.first_name)
        console.log(newPersonResult.data)
        const newFaceResult= await registerNewFace(newPersonResult.data.person_id,frontal,left,right)
        console.log(newFaceResult.data)

        if (newFaceResult.data.code=='1000'||newFaceResult.data.code=='709') {
          list.push({"id":s.id,"face_id":newFaceResult.data.person_id})
        } else{
          failed_list.push(++count+'. '+s.last_name+" "+s.first_name+": "+newFaceResult.data.status)
        }
      }
    }
    else{
      failed_list.push(++count+'. '+s.last_name+" "+s.first_name+" : Student has not provided face's images")
    }
  }
  
  console.log(list)
  console.log(failed_list)

  if (list.length>0) {
    performBatchUpdate(ctx,list);
  }

  if (failed_list.length>0) {
    res.status(500).send({ success: true, failed_list: failed_list.join('\n\n') });
  }
  else{
    res.send({ success: true});
  }
}

async function compositeImage(inputUrl: string): Promise<Buffer> {
  return (await axios({ url: inputUrl, responseType: "arraybuffer" })).data as Buffer;
};

function performBatchUpdate(ctx:EndpointExtensionContext,students) {
  const { database } = ctx;
  return database.transaction(trx => {
    const queries =[];
    students.forEach(s => {
        const query = database('students')
            .where('id', s.id)
            .update({
                face_id: s.face_id
            })
            .transacting(trx); // This makes every update be in the same transaction
        queries.push(query);
    });

    Promise.all(queries) // Once every query is written
        .then(trx.commit) // We try to execute all of them
        .catch(trx.rollback); // And rollback in case any of them goes wrong
  }); 
}

async function registerNewFace(face_id : Number, frontal:string, left:string, right:string){
  return await axios.post('http://27.74.253.109:19692/checkin_api/register',{
    merchant_id: '8',
    group_id: '8',
    person_id: face_id,
    force:'0',
    image_base64s: 
    {
      'frontal': frontal,
      'left': left,
      'right': right
    }
  })
}

async function registerNewPerson(fullName:string){
  return await axios.post("http://27.74.253.109:19692/web_api/person", {
    merchant_id: 8,
    group_id: 8,
    person_fullname: fullName,
    });
}

export const handleUpdateStudentClass = (ctx: EndpointExtensionContext) => async (req: any, res: Response) => {
  const { database } = ctx;
  const body = req.body;
  console.log("thuyyy_body: ",body)

  const studentIds = body.students.replace(/\[/g, "").replace(/\]/g, "").split(',');;
  const classId=body.class;

  console.log("thuyyy_studentIds: ",studentIds)
  console.log("thuyyy_classId: ",classId)

  database.transaction(trx => {
    const queries =[];
    for (let i in studentIds) {
      const query = database('students_classes')
      .insert({
        class: classId,
        student: studentIds[i],
      })
      .onConflict(["student", "class"])
      .ignore()
      .transacting(trx); 

      queries.push(query);
    }

    Promise.all(queries)
        .then(trx.commit)
        .catch(trx.rollback); 
  }); 

  res.send({ success: true});
}
