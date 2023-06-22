import { EndpointExtensionContext } from "@directus/shared/types";
import { Response } from "express";
import { Knex } from 'knex';
import axios from "axios";

const knexConfig: Knex.Config = {
  client: 'mysql', // Replace with your preferred database client
  connection: {
    host: 'localhost',
    user: 'your_username',
    password: 'your_password',
    database: 'your_database_name',
  },
  // Other configuration options such as migrations, seeds, etc.
};

const knex: Knex = Knex(knexConfig);
const connection = knex;

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
      "absence_forewarned",
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

      const ASSET_URL = "http://3.0.100.91:8055/assets";

    let list = [];
    let failed_list = [];
    for (let s of students) {
      if (body.update_mode=="1") {
        if (s.frontal_face && s.left_side_face && s.right_side_face) {
          const frontal=(await compositeImage(`${ASSET_URL}/${s.frontal_face}`)).toString('base64');
          const left=(await compositeImage(`${ASSET_URL}/${s.left_side_face}`)).toString('base64');
          const right=(await compositeImage(`${ASSET_URL}/${s.right_side_face}`)).toString('base64');

          if (s.face_id) {
            const result01=await axios.post('http://27.74.253.109:19692/checkin_api/register',{
              merchant_id: '8',
              group_id: '8',
              person_id: s.face_id,
              force:'0',
              image_base64s: 
              {
                'frontal': frontal,
                'left': left,
                'right': right
              }
            })

            if (result01.data.code=='1000') {
              list.push({"id":s.id,"face_id":s.face_id})
            } else{
              failed_list.push({"id":s.id,"name":s.last_name+" "+s.first_name+'\n'})
            }

            console.log("thuyyy_result01: ",result01.data)
          }
          else{
            const new_face_id02 = await axios.post("http://27.74.253.109:19692/web_api/person", {
            merchant_id: 8,
            group_id: 8,
            person_fullname: s.last_name+" "+s.first_name,
            });

            console.log("thuyyy_new_face_id02: ",new_face_id02.data)
  
            const result02=await axios.post('http://27.74.253.109:19692/checkin_api/register',{
              merchant_id: '8',
              group_id: '8',
              person_id: new_face_id02.data.data.person_id,
              force:'0',
              image_base64s: 
              {
                'frontal': frontal,
                'left': left,
                'right': right
              }
            })

            if (result02.data.code=='1000') {
              list.push({"id":s.id,"face_id":s.new_face_id02.data.data.person_id})
            }else{
              failed_list.push({"id":s.id,"name":s.last_name+" "+s.first_name+'\n'})
            }

            console.log("thuyyy_result02: ",result02.data)
          }
        }
      }
      else{
        if(s.face_id==""&&s.frontal_face&&s.left_side_face&&s.right_side_face){
          const frontal=(await compositeImage(`${ASSET_URL}/${s.frontal_face}`)).toString('base64');
          const left=(await compositeImage(`${ASSET_URL}/${s.left_side_face}`)).toString('base64');
          const right=(await compositeImage(`${ASSET_URL}/${s.right_side_face}`)).toString('base64');

          const new_face_id03 = await axios.post("http://27.74.253.109:19692/web_api/person", {
            merchant_id: 8,
            group_id: 8,
            person_fullname: s.last_name+" "+s.first_name,
          });
  
          const result03=await axios.post('http://27.74.253.109:19692/checkin_api/register',{
            merchant_id: '8',
            group_id: '8',
            person_id: new_face_id03.data.data.person_id,
            force:'0',
            image_base64s: 
            {
              'frontal': frontal,
              'left': left,
              'right': right
            }
          })

          if (result03.data.code=='1000') {
            list.push({"id":s.id,"face_id":s.new_face_id02.data.data.person_id})
          }else{
            failed_list.push({"id":s.id,"name":s.last_name+" "+s.first_name+'\n'})
          }

          console.log("thuyyy_result03: ",result03.data)
      }
    }

    performBatchUpdate(list);
    
    console.log("thuyyy_list: ",list)
    console.log("thuyyy_failed_list: ",failed_list)

    res.send({ success: true, failed_list: failed_list });
    };
    
}

async function compositeImage(inputUrl: string): Promise<Buffer> {
  return (await axios({ url: inputUrl, responseType: "arraybuffer" })).data as Buffer;
};

function performBatchUpdate(students) {
  return connection.transaction(trx => {
    const queries =[];
    students.forEach(s => {
        const query = connection('users')
            .where('id', s.id)
            .update({
                lastActivity: s.lastActivity,
                points: s.points,
            })
            .transacting(trx); // This makes every update be in the same transaction
        queries.push(query);
    });

    Promise.all(queries) // Once every query is written
        .then(trx.commit) // We try to execute all of them
        .catch(trx.rollback); // And rollback in case any of them goes wrong
  }); 
}

export const updateStudentsFaceId =
  (ctx: EndpointExtensionContext) => async (req: any, res: Response) => {
    const { database } = ctx;
    const studentIds = req.body.students;

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
    .whereIn("id", studentIds);

    const ASSET_URL = "http://3.0.100.91:8055/assets";

    let list = [];
    let failed_list = [];
    for (let s of students) {
    if (s.frontal_face && s.left_side_face && s.right_side_face) {
      const frontal=(await compositeImage(`${ASSET_URL}/${s.frontal_face}`)).toString('base64');
      const left=(await compositeImage(`${ASSET_URL}/${s.left_side_face}`)).toString('base64');
      const right=(await compositeImage(`${ASSET_URL}/${s.right_side_face}`)).toString('base64');

      if (s.face_id) {
        const result01 = await axios.post('http://27.74.253.109:19692/checkin_api/register',{
          merchant_id: '8',
          group_id: '8',
          person_id: s.face_id,
          force:'0',
          image_base64s: 
          {
            'frontal': frontal,
            'left': left,
            'right': right
          }
        })

        if (result01.data.code=='1000') {
          list.push({"id":s.id,"face_id":s.face_id})
        } else{
          failed_list.push({"id":s.id,"name":s.last_name+" "+s.first_name+'\n'})
        }

        console.log("thuyyy_result01: ",result01.data)
      }
      else{
        const new_face_id02 = await axios.post("http://27.74.253.109:19692/web_api/person", {
        merchant_id: 8,
        group_id: 8,
        person_fullname: s.last_name+" "+s.first_name,
        });

        console.log("thuyyy_new_face_id02: ",new_face_id02.data)

        const result02=await axios.post('http://27.74.253.109:19692/checkin_api/register',{
          merchant_id: '8',
          group_id: '8',
          person_id: new_face_id02.data.data.person_id,
          force:'0',
          image_base64s: 
          {
            'frontal': frontal,
            'left': left,
            'right': right
          }
        })

        if (result02.data.code == '1000') {
          list.push({"id":s.id,"face_id":s.new_face_id02.data.data.person_id})
        }else{
          failed_list.push({"id":s.id,"name":s.last_name+" "+s.first_name+'\n'})
        }

        console.log("thuyyy_result02: ",result02.data)
      }
    }

    performBatchUpdate(list);
    
    console.log("thuyyy_list: ",list)
    console.log("thuyyy_failed_list: ",failed_list)

    res.send({ success: true, failed_list: failed_list });
    };
}