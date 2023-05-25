import { EndpointExtensionContext } from "@directus/shared/types";
import axios from "axios";
import { Response } from "express";
import sharp from "sharp";

export const handleUpsertSetting = (ctx: EndpointExtensionContext) => async (req: any, res: Response) => {
  const { ForbiddenException } = ctx.exceptions;

  const body = req.body;

  const class1 = await ctx.database
    .table("classes")
    .where("teachers", req.accountability.user)
    .where("status", "active")
    .first(["id"])
    .catch(() => false);
  if (!class1) {
    res.status(403).send(new ForbiddenException());
    return;
  }

  const data = await ctx.database
    .table("settings")
    .insert({
      key: body.key,
      value: body.value,
      class: class1.id || 0,
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

export const handleDownloadAvatarWithFrame = (_ctx: EndpointExtensionContext, des:string, frame:string) => async (_req: any, res: Response) => {
  const frameBuffer = await compositeImage(frame);
  const desBuffer = await compositeImage(des)

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

  res.contentType("png");
  res.end(image);
};

async function compositeImage(inputUrl: string): Promise<Buffer> {
  return (await axios({ url: inputUrl, responseType: "arraybuffer" })).data as Buffer;
}

export const handleUpsertCico = (ctx: EndpointExtensionContext) => async (req: any, res: Response) => {
  const { ForbiddenException } = ctx.exceptions;

  const body = req.body;

  const data = await ctx.database
    .table("cico_photos")
    .insert({
      checkin: body.checkin,
      checkout: body.checkout,
      absence_reason: body.absence_reason,
      absence_forwarned: body.absence_forwarned,
      student:body.student,
      class_id:body.class_id,
      datetime:body.datetime,
    })
    .onConflict(["student", "datetime"])
    .merge(["checkin", "checkout", "absence_reason", "absence_forwarned"])
    .catch((err: Error) => err);

  if (data instanceof Error) {
    res.status(500).send(data);
    return;
  }

  res.send({ success: true });
};
