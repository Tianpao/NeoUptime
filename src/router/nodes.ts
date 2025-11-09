import { Router } from "express";
import { NodesMiddleware } from "../middleware/nodes.js";
const router = Router();

router.get("/api/nodes", NodesMiddleware.getNodes, (req, res) => {

});

router.get("/api/nodes/:id", NodesMiddleware.getNodeAddr, (req, res) => {

});

export default router;