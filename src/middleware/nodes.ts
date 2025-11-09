import { Request, Response, NextFunction } from "express";
import { randomInt } from "node:crypto";
import { Service } from "../utils/service.js";
import config from "../utils/config.js";
export class NodesMiddleware {
  static getNodes(req: Request, res: Response, next: NextFunction) {
    next();
  }

  static getNodeAddr(req: Request, res: Response, next: NextFunction) {
    const { secret } = req.query;
    const UA = req.headers["user-agent"];
    if (!UA) {
      res.sendStatus(400);
      return;
    }
    const isValid = Service.GetAddrVerify(secret as string | undefined, UA);
    if (!isValid) {
      res.json({
        status: 200,
        result: config.blacklist[(Math.random() * config.blacklist.length) | 0],
      });
      return;
    }

    next();
  }
}
