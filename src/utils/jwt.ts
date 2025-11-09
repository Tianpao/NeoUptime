import jwt from "jsonwebtoken"
import config from "./config.js"
export class Jwter {
    static sign(data:object,expiresIn:number=60*60*3){
        jwt.sign(data,config.secret.jwt,{
            expiresIn,
            issuer:"OpenEasyTier"
        })
    }

    static verify(token:string){
        jwt.verify(token,config.secret.jwt,{
            issuer:"OpenEasyTier"
        })
    }
}