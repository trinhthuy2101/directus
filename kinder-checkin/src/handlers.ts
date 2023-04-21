import { EndpointExtensionContext } from "@directus/shared/types";
import axios from "axios";
import { Response } from "express";
import sharp from "sharp";

export const handleUpsertSetting = (ctx: EndpointExtensionContext) => async (req: any, res: Response) => {
  const { ForbiddenException } = ctx.exceptions;

  const body = req.body;

  const user = await ctx.database
    .table("directus_users")
    .where("id", req.accountability.user)
    .first(["class_id"])
    .catch(() => false);
  if (!user) {
    res.status(403).send(new ForbiddenException());
    return;
  }

  const data = await ctx.database
    .table("settings")
    .insert({
      key: body.key,
      value: body.value,
      class: user.class_id || 0,
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

export const handleDownloadAvatarWithFrame = (_ctx: EndpointExtensionContext) => async (_req: any, res: Response) => {
  const frameBuffer = await compositeImage("http://3.0.100.91:8055/assets/30757ffb-bb10-4750-abcc-480104670e87");
  const desBuffer = await compositeImage("https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRROt7YUKa7excpJt4CR59ZwHzhWDfV1mr0eQ&usqp=CAU")

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
