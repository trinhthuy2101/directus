import { EndpointExtensionContext } from "@directus/shared/types";
import { Response } from "express";

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

export const handleUpsertCico = (ctx: EndpointExtensionContext) => async (req: any, res: Response) => {
  const body = req.body;


  let m = new Date(body.datetime);
  let dateString = "" + m.getUTCFullYear() + (m.getUTCMonth() + 1) + m.getUTCDate();
  body.unique_date_student_id = `${body.student}_${dateString}`;

  const data = await ctx.database
    .table("cico_photos")
    .insert(body)
    .onConflict(["unique_date_student_id"])
    .merge(["checkin", "checkout", "absence_reason", "absence_forewarned"])
    .catch((err: Error) => err);

  if (data instanceof Error) {
    res.status(500).send(data);
    return;
  }

  ctx.emitter.emitAction('items.create', {
    collection: 'cico_photos',
    payload: body,
  }, ctx);


  res.send({ success: true });
};
