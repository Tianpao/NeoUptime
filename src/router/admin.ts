import { Router } from "express";
import { AdminMiddleware } from "../middleware/admin.js";
import { Jwter } from "../utils/jwt.js";
const router = Router();

router.use(AdminMiddleware.Verify)

router.get("/api/login",(req,res)=>{
    Jwter.sign({})
})