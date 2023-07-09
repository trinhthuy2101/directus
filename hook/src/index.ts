import type { ActionHandler, HookExtensionContext } from "@directus/types";
import { defineHook } from "@directus/extensions-sdk";
import type { Transporter } from "nodemailer";
import sharp from "sharp";
import axios from "axios";

const ASSET_URL = "http://3.0.100.91:8055/assets";
const NOTI_MODE = "email" //"app_noti"

const onCreateItems =
  (context: HookExtensionContext): ActionHandler =>
    async (input, { database, schema }) => {
      if (!["cico_photos", "students"].includes(input.collection)) return input;

      const student = await database.table("students").where("id", input.payload.student).first();

      const frameURL = await getFrameURL(student.current_class,database)

      if (input.payload.checkin) {
        var checkinBuffer: Buffer;

        const checkinURL = `${ASSET_URL}/${input.payload.checkin}`;

        if (frameURL != "") {
          checkinBuffer = await handleDownloadAvatarWithFrame(checkinURL, frameURL);
        } else {
          checkinBuffer = await compositeImage(checkinURL);
        }
      }

      if (input.payload.checkout) {
        var checkoutBuffer: Buffer;

        const checkinURL = `${ASSET_URL}/${input.payload.checkin}`;

        if (frameURL != "") {
          checkoutBuffer = await handleDownloadAvatarWithFrame(checkinURL, frameURL);
        } else {
          checkoutBuffer = await compositeImage(checkinURL);
        }
      }

      const studentFullName = student.last_name + " " + student.first_name;

      if (NOTI_MODE == "email") {
        if (!student.parents_email) {
          return input
        }

        const mailService = new context.services.MailService({ schema, knex: database });
        const mailer: Transporter = mailService.mailer;

        if (input.payload.checkin) {
          await mailer.sendMail({
            from: "Kinder Checkin <19120390@student.hcmus.edu.vn>",
            to: student.parents_email,
            subject: "CHECKED IN: " + studentFullName + " - " + new Date(input.payload.date).toDateString(),
            html: `<h1>${studentFullName}</h1></br><img width="300" heigh="auto" src="cid:student_checkin_id"/>`,
            attachments: [
              {
                filename: "image.png",
                content: checkinBuffer,
                cid: "student_checkin_id",
              },
            ],
          });
          console.log("Email sent");
        }

        if (input.payload.checkout) {
          await mailer.sendMail({
            from: "Kinder Checkin <19120390@student.hcmus.edu.vn>",
            to: student.parents_email,
            subject: "CHECKED OUT: " + studentFullName + " - " + new Date(input.payload.datetime).toDateString(),
            html: `<h1>${studentFullName}</h1></br><img width="300" heigh="auto" src="cid:student_checkout_id"/>`,
            attachments: [
              {
                filename: "image.png",
                content: checkoutBuffer,
                cid: "student_checkout_id",
              },
            ],
          });
          console.log("Checkout");
        }

      } else if (NOTI_MODE == "app_noti") {

      }
      return input;
    };

export default defineHook(({ action }, context) => {
  action("items.create", onCreateItems(context));
  context.emitter.onAction("items.create", onCreateItems(context))
});

async function getFrameURL(class_id: number,database:any) {
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
  const frameBuffer = await compositeImage(frame);
  const desBuffer = await compositeImage(des);

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