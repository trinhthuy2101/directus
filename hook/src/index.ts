import type { ActionHandler, HookExtensionContext } from "@directus/types";
import { defineHook } from "@directus/extensions-sdk";
import type { Transporter } from "nodemailer";
import sharp from "sharp";
import axios from "axios";

const ASSET_URL = "http://3.0.100.91:8055/assets";

const onCreateItems =
  (context: HookExtensionContext): ActionHandler =>
  async (input, { database, schema }) => {
    if (!["cico_photos", "students"].includes(input.collection)) return input;

    const student = await database.table("students").where("id", input.payload.student).first();

    const mailService = new context.services.MailService({ schema, knex: database });
    const mailer: Transporter = mailService.mailer;
    let mailReceiver = "19120390@student.hcmus.edu.vn";
    if (student.parents_email) {
      mailReceiver = student.parents_email;
    }

    const studentFullName = student.last_name + " " + student.first_name;

    const frameSettings = await database
      .table("settings")
      .where("class", student.current_class)
      .where("key", "frame")
      .first();

    let frameURL = "";
    let start = new Date(frameSettings.start_time);
    let end = new Date(frameSettings.end_time);
    if (
      frameSettings &&
      Number(frameSettings.value) > 0 &&
      frameSettings.status === "active" &&
      (!(start.getTime() === start.getTime()) || start <= new Date()) &&
      (!(end.getTime() === end.getTime()) || end >= new Date())
    ) {
      const frame = await database.table("frames").where("id", frameSettings.value).first();
      if (frame && frame.frame != "") {
        frameURL = `${ASSET_URL}/${frame.frame}`;
      }
    }

    switch (input.collection) {
      case "cico_photos":
        let buffer: Buffer;

        if (input.payload.checkin) {
          const checkinURL = `${ASSET_URL}/${input.payload.checkin}`;

          if (frameURL != "") {
            buffer = await handleDownloadAvatarWithFrame(checkinURL, frameURL);
          } else {
            buffer = await compositeImage(checkinURL);
          }

          await mailer.sendMail({
            from: "Kinder Checkin <19120390@student.hcmus.edu.vn>",
            to: mailReceiver,
            subject: "CHECKED IN: " + studentFullName + " - " + new Date(input.payload.datetime).toDateString(),
            html: `<h1>${studentFullName}</h1></br><img width="300" heigh="auto" src="cid:student_checkin_id"/>`,
            attachments: [
              {
                filename: "image.png",
                content: buffer,
                cid: "student_checkin_id",
              },
            ],
          });
          console.log("Email sent");
        }

        if (input.payload.checkout) {
          const checkoutURL = `${ASSET_URL}/${input.payload.checkout}`;
          if (frameURL != "") {
            buffer = await handleDownloadAvatarWithFrame(checkoutURL, frameURL);
          } else {
            buffer = await compositeImage(checkoutURL);
          }

          await mailer.sendMail({
            from: "Kinder Checkin <19120390@student.hcmus.edu.vn>",
            to: mailReceiver,
            subject: "CHECKED OUT: " + studentFullName + " - " + new Date(input.payload.datetime).toDateString(),
            html: `<h1>${studentFullName}</h1></br><img width="300" heigh="auto" src="cid:student_checkout_id"/>`,
            attachments: [
              {
                filename: "image.png",
                content: buffer,
                cid: "student_checkout_id",
              },
            ],
          });
          console.log("Email sent");
        }

        break;
    }

    return input;
  };

export default defineHook(({ action }, context) => {
  action("items.create", onCreateItems(context));
  context.emitter.onAction("items.create", onCreateItems(context))
});

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
