import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pipedRouter from "./piped";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pipedRouter);

export default router;
