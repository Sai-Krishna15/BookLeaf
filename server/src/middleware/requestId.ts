import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { REQUEST_ID_HEADER } from '../config/constants';

const SAFE_ID = /^[A-Za-z0-9._-]{8,128}$/;

/** Assigns a correlation id (accepting a sane inbound one) and echoes it in the response. */
export const requestId: RequestHandler = (req, res, next) => {
  const inbound = req.header(REQUEST_ID_HEADER);
  const id = inbound && SAFE_ID.test(inbound) ? inbound : randomUUID();
  req.requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
};
