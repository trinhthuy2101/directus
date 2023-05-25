import { defineHook } from "@directus/extensions-sdk";
import type { Transporter } from "nodemailer";
import {handleDownloadAvatarWithFrame} from "../../endpoints/src/handlers";

export default defineHook(({ action }, context) => {
  const { MailService } = context.services;

  action("items.create", async (input, { database, schema }) => {
    if (!["cico_photos", "students"].includes(input.collection)) return input;
    const mailService = new MailService({ schema, knex: database });

    const student = await database.table("students").where("id", input.payload.student).first();

    const mailer: Transporter = mailService.mailer;

		const studentFullName = student.last_name + " " + student.first_name

    const frameSettings = await database.table("settings").where("class", input.payload.class_id).where("key","frame").first();
    let frame
    if (frameSettings.status=="active" && frameSettings.start_time<=new Date() && frameSettings.end_date>=new Date()) {
      frame = await database.table("frames").where("id", frameSettings.value).first();
    }

    switch (input.collection) {
      case "cico_photos":
        if (input.payload.checkin!="") {
          if (frame!=null){
          input.payload.checkin=handleDownloadAvatarWithFrame(context,frame.frame, input.payload.checkin);
          }

          await mailer.sendMail({
            from: "Kinder Checkin <19120390@student.hcmus.edu.vn>",
            to: "19120390@student.hcmus.edu.vn",
            subject:"CHECKED IN: "+studentFullName +" - "+ new Date().toDateString(),
            html: `<h1>${studentFullName}</h1></br><img width="300" heigh="auto" src="http://3.0.100.91:8055/assets/${input.payload.checkin}"/>`,
          });
          console.log("Email sent");
        }

        if (input.payload.checkout!="") {
          if (frame!=null){
            input.payload.checkout=handleDownloadAvatarWithFrame(context,frame.frame, input.payload.checkout);
          }

          await mailer.sendMail({
            from: "Kinder Checkin <19120390@student.hcmus.edu.vn>",
            to: "19120390@student.hcmus.edu.vn",
            subject:"CHECKED OUT: "+studentFullName +" - "+ new Date().toDateString(),
            html: `<h1>${studentFullName}</h1></br><img width="300" heigh="auto" src="http://3.0.100.91:8055/assets/${input.payload.checkin}"/>`,
          });
          console.log("Email sent");
        }

        break;
    }

    return input;
  });
});
