import express from "express";
import cors from "cors";
import { config } from "dotenv";

import engineRoutes from "./routes/engineRoutes";

config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/engine", engineRoutes);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
