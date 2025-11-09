import express from 'express';
import nodes from './router/nodes.js';
import sql from './utils/database.js';
const app = express();

app.use(express.json());
app.set("X-Powered-By", "OpenEasyTier")

app.use(nodes); // Nodes

app.listen(3000,()=>{
    console.log("Server running on port 3000");
})