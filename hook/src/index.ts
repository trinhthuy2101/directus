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

const onCreateItems = (context: HookExtensionContext): ActionHandler => async (input, { database, schema }) => {
  if (!["cico_photos", "students"].includes(input.collection)) return input;

  if (!input.payload.student || !input.payload.date) {
    return input
  }

  const student = await database({ s: 'students', p: 'directus_users' })
    .select({
      id: 's.id',
      current_class: "s.current_class",
      last_name: "s.last_name",
      first_name: "s.first_name",
      expo_push_token: "p.expo_push_token",
      email_notifications: "p.email_notifications",
      parent_email: "p.email"
    })
    .where("s.id", input.payload.student)
    .whereRaw('?? = ??', ['s.parent_account', 'p.id']).first()

  if (!student) {
    console.log("failed to get student from db")
    return input
  }

  console.log("student get from db: ", student)
  const studentFullName = student.last_name + " " + student.first_name;

  if (student.email_notifications == true || !student.expo_push_token) {
    console.log("info - preparing sending email to ", student.parent_email)
    const frameURL = await getFrameURL(student.current_class, database)
    let mailPayload

    if (input.payload.checkin) {
      console.log("info - preparing checkin payload for sending mail:")
      const checkinURL = `${ASSET_URL}/${input.payload.checkin}`;
      const checkinBuffer: Buffer = await handleDownloadAvatarWithFrame(checkinURL, frameURL);

      mailPayload = {
        from: "Kinder Checkin <19120390@student.hcmus.edu.vn>",
        to: student.parent_email,
        subject: new Date(input.payload.date).toDateString() + ": Xác nhận điểm danh vào lớp bé " + studentFullName,
        html: `<h1>${studentFullName}</h1></br><img width="300" heigh="auto" src="cid:student_checkin_id"/>`,
        attachments: [
          {
            filename: "image.png",
            content: checkinBuffer,
            cid: "student_checkin_id",
          },
        ],
      }


      console.log("info- checkin mail sending with payload: ", mailPayload)
    }
    else if (input.payload.checkout) {
      console.log("info - preparing checkout payload for sending mail:")
      const checkoutURL = `${ASSET_URL}/${input.payload.checkout}`;
      const checkoutBuffer: Buffer = await handleDownloadAvatarWithFrame(checkoutURL, frameURL);

      mailPayload = {
        from: "Kinder Checkin <19120390@student.hcmus.edu.vn>",
        to: student.parent_email,
        subject: new Date(input.payload.date).toDateString() + ": Xác nhận điểm danh ra về bé " + studentFullName,
        html: `<h1>${studentFullName}</h1></br><img width="300" heigh="auto" src="cid:student_checkout_id"/>`,
        attachments: [
          {
            filename: "image.png",
            content: checkoutBuffer,
            cid: "student_checkout_id",
          },
        ],
      }

      console.log("info- checkout mail sending with payload: ", mailPayload)
    } else if (input.payload.picker) {
      console.log("info - preparing picker payload for sending mail:")
      let registeredPickerResult = await database.table("cico_photos")
        .select("registered_picker")
        .where("student", input.payload.student)
        .where("date", input.payload.date).first()

      console.log("info - registered picker get from db ", registeredPickerResult)

      if (registeredPickerResult == 'null') {
        console.log("info - no registered picker found")
        return input
      }

      console.log("info - preparing images for comparing face")

      const img1 = ((await axios({ url: `${ASSET_URL}/${registeredPickerResult.registered_picker}`, responseType: "arraybuffer" })).data as Buffer)
      const img2 = ((await axios({ url: `${ASSET_URL}/${input.payload.picker}`, responseType: "arraybuffer" })).data as Buffer)

      let result = await twoFacesMatched(img1.toString('base64'), img2.toString('base64'))
      mailPayload = {
        from: "Kinder Checkin <19120390@student.hcmus.edu.vn>",
        to: student.parent_email,
        subject: new Date(input.payload.date).toDateString() + "Người đón bé " + studentFullName,
        html: `<h1>Người được đăng ký</h1></br><img width="300" heigh="auto" src="cid:img1"/> 
        <h1>Người đón</h1></br><img width="300" heigh="auto" src="cid:img2"/>`,

        text: `Khớp: ${result}%`,
        attachments: [
          {
            filename: "image1.png",
            content: img1,
            cid: "img1",
          }, {
            filename: "image2.png",
            content: img2,
            cid: "img2",
          },
        ],
      }
    }
    else {
      console.log("info - no need to send mail: ")
      return input
    }

    const mailService = new context.services.MailService({ schema, knex: database });
    const mailer: Transporter = mailService.mailer;
    await mailer.sendMail(mailPayload);

    console.log("Info - mail sent for student id: ", student.id);
  } else {
    console.log("info - sending noti to: ", student.expo_push_token)
    var message

    if (input.payload.checkin) {
      message = {
        'to': student.expo_push_token,
        'sound': 'default',
        'title': 'Xác nhận điểm danh vào lớp',
        'body': input.payload.date + ": Xác nhận điểm danh vào lớp bé " + studentFullName,
        'data': {
          "checkin": input.payload.checkin,
          "student_id": input.payload.student,
          "datetime": new Date().toString(),
          "date": input.payload.date,
          "type": "cico",
          "message": input.payload.date + ": Xác nhận điểm danh vào lớp bé " + studentFullName,
        },
      };
    }

    if (input.payload.checkout) {
      message = {
        'to': student.expo_push_token,
        'sound': 'default',
        'title': 'Xác nhận điêm danh ra về',
        'body': input.payload.date + ": Xác nhận điểm danh ra về bé " + studentFullName,
        'data': {
          "checkout": input.payload.checkout,
          "student_id": input.payload.student,
          "datetime": new Date().toString(),
          "date": input.payload.date,
          "type": "cico",
          "message": input.payload.date + ": Xác nhận điểm danh ra về bé " + studentFullName
        },
      };
    }

    if (input.payload.picker) {
      let registeredPickerResult = await database.table("cico_photos")
        .select("registered_picker")
        .where("student", input.payload.student)
        .where("date", input.payload.date).first()

      if (registeredPickerResult == 'null') {
        console.log("info - no registered picker found")
        return input
      }

      console.log("info - preparing images for comparing face")

      const img1 = ((await axios({ url: `${ASSET_URL}/${registeredPickerResult.registered_picker}`, responseType: "arraybuffer" })).data as Buffer)
      const img2 = ((await axios({ url: `${ASSET_URL}/${input.payload.picker}`, responseType: "arraybuffer" })).data as Buffer)

      let result = await twoFacesMatched(img1.toString('base64'), img2.toString('base64'))
      message = {
        'to': student.expo_push_token,
        'sound': 'default',
        'title': 'Yêu cầu xác nhận người đón bé',
        'body': 'Yêu cầu xác nhận người đón bé: '+`${student.last_name} ${student.first_name}`,
        'data': {
          "registered_picker": registeredPickerResult.registered_picker,
          "picker": input.payload.picker,
          "isSimilar": result,
          "class_id": student.current_class,
          "student": input.payload.student,
          "date": input.payload.date,
          "student_name": `${student.last_name} ${student.first_name}`,
          "type": "picker_request",
        },
      };
    }

    if (input.payload.picking_confirmed_by_parent == 1) {
      message = {
        'to': student.expo_push_token,
        'sound': 'default',
        'title': 'Phụ huynh đã xác nhận người đón bé',
        'body': `Phụ huynh bé ${student.last_name} ${student.first_name} đã xác nhận người đón bé`,
        'data': {
          "class_id": student.current_class,
          "student": input.payload.student,
          "date": input.payload.date,
          "student_name": `${student.last_name} ${student.first_name}`,
          "type": "picker_response",
        },
      };
    }

    if (input.payload.picking_confirmed_by_parent == 0) {
      message = {
        'to': student.expo_push_token,
        'sound': 'default',
        'title': 'Phụ huynh KHÔNG xác nhận người đón bé',
        'body': `Phụ huynh bé ${student.last_name} ${student.first_name} KHÔNG xác nhận người đón bé. Yêu cầu không cho bé ra về`,
        'data': {
          "class_id": student.current_class,
          "student": input.payload.student,
          "date": input.payload.date,
          "student_name": `${student.last_name} ${student.first_name}`,
          "type": "picker_response",
        },
      };
    }

    if (input.payload.register_picker||!message) {
      console.log("info - end of hook without sending noti:")
      return input
    }

    console.log("info - noti message: ", message)

    await axios.post('https://exp.host/--/api/v2/push/send', JSON.stringify(message), {
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      }
    })

    console.log("info - notification sent for student id: ", student.id)
  }

  console.log("info - end of hook")

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
    (start.getTime() <= (new Date()).getTime()) && (end.getTime() >= (new Date()).getTime())
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

  console.log("info - attach image with frame: ", frame)

  if (!frame) {
    console.log("info - no frame applied")
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
  console.log("info - image prepared with frame applied")
  return image;
};

async function compositeImage(inputUrl: string): Promise<Buffer> {
  return (await axios({ url: inputUrl, responseType: "arraybuffer" })).data as Buffer;
}

async function twoFacesMatched(img1: string, img2: string) {
  console.log("info - start comparing face: ")

  const result = await axios.post("https://faceapi.mxface.ai/api/v3/face/verify", {
    encoded_image1: img1,
    encoded_image2: img2
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Subscriptionkey': 'f1ypNI8U8xUBpazFks-d1ge7OUZfO1726'
    }
  });

  console.log("info - faces comparation results: ", result.data.matchedFaces[0].matchResult)

  return result.data.matchedFaces[0].matchResult == 1
}
