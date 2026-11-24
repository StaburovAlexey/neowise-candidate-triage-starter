import { createServer } from "node:http";
import { handleRequest } from "./app.mjs";

createServer(handleRequest).listen(Number(process.env.PORT || 3000), "127.0.0.1");
