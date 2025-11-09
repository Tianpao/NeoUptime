import { Request, Response, NextFunction } from "express";

export class AdminMiddleware {
    static Verify(req: Request, res: Response, next: NextFunction){
        if(req.path === "/api/login"){
            next()
        }else{
            const token = req.cookies.token
            if(!token){
                res.status(401).send()
                return;
            }
        }
    }
}