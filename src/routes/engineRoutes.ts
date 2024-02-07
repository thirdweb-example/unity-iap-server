import express from "express";
import { validate } from "../controllers/engineController";

const router = express.Router();

router.post("/validate", validate);

export default router;
