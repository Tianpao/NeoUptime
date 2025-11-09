import { Request, Response, NextFunction } from "express";
const test_arr = [
  {
    id: 1,
    application: "PCL",
    UA_StartWith: "PCL",
    secret: "EasyTier$PCL$dbc23ede-9745-4c16-ab8c-1e694c092022",
  },
];
export class NodesMiddleware {
  static getNodes(req: Request, res: Response, next: NextFunction) {
    next();
  }

  static getNodeAddr(req: Request, res: Response, next: NextFunction) {
    const { secret } = req.params;
    const { ids } = req.body;
    const UA = req.headers["user-agent"];
    if (!secret || !ids) {
      res.status(400).send();
      return;
    }
    next();
  }
}
