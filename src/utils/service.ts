import sql from "./database.js";

export class Service{
    static GetAddrVerify(secret:string|undefined,UA:string){
        if(!secret) return false;
        const [result] =  sql.prepare(`SELECT UA FROM applications WHERE secret = ?`).all(secret)
        if(!result) return false;
        return UA.includes(result.UA as string);
    }
}
