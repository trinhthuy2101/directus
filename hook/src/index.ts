import { defineHook } from "@directus/extensions-sdk";
import type { Transporter } from "nodemailer";

export default defineHook(({ action }, context) => {
  const { MailService } = context.services;

  action("items.create", async (input, { database, schema }) => {
    if (!["cico_photos", "students"].includes(input.collection)) return input;
    const mailService = new MailService({ schema, knex: database });

    const student = await database.table("students").where("id", input.payload.student).first();

    const mailer: Transporter = mailService.mailer;

		const studentFullName = student.last_name + " " + student.first_name

    switch (input.collection) {
      case "cico_photos":
        await mailer.sendMail({
          from: "Kinder Checkin <trinhthuy210100@gmail.com>",
          to: "trinhthuy210100@gmail.com",
          subject: studentFullName + " - Just checked in - " + new Date().toDateString(),
          html: `<h1>${studentFullName}</h1></br><img width="300" heigh="auto" src="http://3.0.100.91:8055/assets/${input.payload.checkin}"/>`,
        });
        console.log("Email sent");
        break;
    }

    return input;
  });
});
