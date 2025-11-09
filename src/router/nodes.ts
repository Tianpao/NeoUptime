import { Router } from "express";
import { NodesMiddleware } from "../middleware/nodes.js";
const router = Router();
const cache = new Map<string,string>();

router.get("/api/nodes", NodesMiddleware.getNodes, (req, res) => {

});

router.get("/api/nodes/:id", NodesMiddleware.getNodeAddr, (req, res) => {
    const {id} = req.params;
    
});

export default router;