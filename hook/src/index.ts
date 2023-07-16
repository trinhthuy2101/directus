import type { ActionHandler, HookExtensionContext } from "@directus/types";
import { defineHook } from "@directus/extensions-sdk";
import type { Transporter } from "nodemailer";
import sharp from "sharp";
import axios from "axios";

const ASSET_URL = "http://3.0.100.91:8055/assets";


export default defineHook(({ action }, context) => {
  action("items.create", onCreateItems(context));
  context.emitter.onAction("items.create", onCreateItems(context))
});

const onCreateItems =
  (context: HookExtensionContext): ActionHandler =>
    async (input, { database, schema }) => {
      if (!["cico_photos", "students"].includes(input.collection)) return input;

      const student = await database({ s: 'students', p: 'directus_users' })
        .select({
          id: 's.id',
          current_class: "s.current_class",
          last_name: "s.last_name",
          first_name: "s.first_name",
          expo_push_token: "p.expo_push_token",
          parent_email: "p.email"
        })
        .whereRaw('?? = ??', ['s.parent_account', 'p.id']).first()

      if (!student) {
        console.log("failed to get student from db")
        return input
      }
      
      console.log("student: ", student)
      const studentFullName = student.last_name + " " + student.first_name;

      if (student.expo_push_token) {
        var message

        if (input.payload.checkin) {
          message = {
            to: student.expo_push_token,
            sound: 'default',
            title: 'Original Title',
            body: {
              "student_id": input.payload.student,
              "date": input.payload.date,
              "type": "checkin",
              "message": input.payload.date + ": Xác nhận điểm danh vào lớp bé " + studentFullName,
            },
            data: { someData: 'goes here' },
          };
        }
        else if (input.payload.checkout) {
          message = {
            to: student.expo_push_token,
            sound: 'default',
            title: 'Original Title',
            body: {
              "student_id": input.payload.student,
              "date": input.payload.date,
              "type": "checkout",
              "message": input.payload.date + ": Xác nhận điểm danh ra về bé " + studentFullName
            },
            data: { someData: 'goes here' },
          };
        }

        await axios.post('https://exp.host/--/api/v2/push/send', JSON.stringify(message), {
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          }
        })

        console.log("notification sent for student id: ", student.id)
      }
      else if (student.parent_email) {
        const frameURL = await getFrameURL(student.current_class, database)
        let mailPayload

        if (input.payload.checkin) {
          const checkinURL = `${ASSET_URL}/${input.payload.checkin}`;
          const checkinBuffer: Buffer = await handleDownloadAvatarWithFrame(checkinURL, frameURL);

          mailPayload = {
            from: "Kinder Checkin <19120390@student.hcmus.edu.vn>",
            to: student.parent_email,
            subject: new Date(input.payload.date).toDateString()+ ": Xác nhận điểm danh vào lớp bé" + studentFullName,
            html: `<h1>${studentFullName}</h1></br><img width="300" heigh="auto" src="cid:student_checkin_id"/>`,
            attachments: [
              {
                filename: "image.png",
                content: checkinBuffer,
                cid: "student_checkin_id",
              },
            ],
          }
        }
        else if (input.payload.checkout) {
          const checkinURL = `${ASSET_URL}/${input.payload.checkin}`;
          const checkoutBuffer: Buffer = await handleDownloadAvatarWithFrame(checkinURL, frameURL);

          mailPayload = {
            from: "Kinder Checkin <19120390@student.hcmus.edu.vn>",
            to: student.parent_email,
            subject: new Date(input.payload.date).toDateString()+ ": Xác nhận điểm danh ra về bé" + studentFullName,
            html: `<h1>${studentFullName}</h1></br><img width="300" heigh="auto" src="cid:student_checkout_id"/>`,
            attachments: [
              {
                filename: "image.png",
                content: checkoutBuffer,
                cid: "student_checkout_id",
              },
            ],
          }
        }
        else {
          return input
        }

        const mailService = new context.services.MailService({ schema, knex: database });
        const mailer: Transporter = mailService.mailer;
        await mailer.sendMail(mailPayload);
        console.log("Mail sent for student id: ", student.id);
      }

      return input;
    };

async function getFrameURL(class_id: number, database: any) {
  const frameSettings = await database
    .table("settings")
    .where("class", class_id)
    .where("key", "frame")
    .first();

  let frameURL = "";
  let start = new Date(frameSettings.start_time);
  let end = new Date(frameSettings.end_time);

  if (
    frameSettings &&
    Number(frameSettings.value) > 1 &&
    frameSettings.status === "active" &&
    (!(start.getTime() === start.getTime()) || start <= new Date()) &&
    (!(end.getTime() === end.getTime()) || end >= new Date())
  ) {
    const frame = await database.table("frames").where("id", frameSettings.value).first();
    if (frame && frame.frame != "") {
      frameURL = `${ASSET_URL}/${frame.frame}`;
    }
  }

  return frameURL
};

const handleDownloadAvatarWithFrame = async (des: string, frame: string): Promise<Buffer> => {
  const desBuffer = await compositeImage(des);

  if (frame != "") {
    return desBuffer
  }

  const frameBuffer = await compositeImage(frame);

  const image = await sharp(desBuffer)
    .resize({
      width: 400,
      height: 400,
    })
    .composite([
      {
        input: frameBuffer,
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return image;
};

async function compositeImage(inputUrl: string): Promise<Buffer> {
  return (await axios({ url: inputUrl, responseType: "arraybuffer" })).data as Buffer;
}