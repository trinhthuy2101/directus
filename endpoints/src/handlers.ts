import { EndpointExtensionContext } from "@directus/shared/types";
import { Response } from "express";

export const handleUpsertSetting = (ctx: EndpointExtensionContext) => async (req: any, res: Response) => {
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

export const handleUpsertCico = (ctx: EndpointExtensionContext) => async (req: any, res: Response) => {
  const body = req.body;


  let m = new Date(body.datetime);
  let month=String(m.getMonth() + 1).padStart(2, '0')
  let day=String(m.getDate()).padStart(2, '0')
  let dateString = "" + m.getUTCFullYear() + month + day;
  body.unique_date_student_id = `${body.student}_${dateString}`;
  let date = new Date(m.getUTCFullYear() + "-" + month + "-" + day)
  body.date=date.getTime();
  body.datetime=m.getTime();

  let mergeFields = ["checkin", "checkout", "absence_reason", "absence_forewarned"].reduce((prev, value) => {
    prev.set(value, true)
    return prev
  }, new Map<string, boolean>());

  
  for (const key of mergeFields.keys()) {
    if (!body[key]) {
      mergeFields.delete(key)
    }
  }

  const data = await ctx.database
    .table("cico_photos")
    .insert(body)
    .onConflict(["unique_date_student_id"])
    .merge([...mergeFields.keys()])
    .catch((err: Error) => err);

  if (data instanceof Error) {
    console.log('failed to upsert cico_photos', data)
    res.status(500).send(data);
    return;
  }

  ctx.emitter.emitAction('items.create', {
    collection: 'cico_photos',
    payload: body,
  }, ctx);


  res.send({ success: true });
};
