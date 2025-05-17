import express from "express";
import {
  handlePrompt,
  getEntriesByDate,
  generateDiaryEntry,
  getDiaryByDate,
  getEntriesWithTaskTag ,
} from "../controllers/chatController.js";
import jwsMiddeware from "../middleware/jwsMiddelware.js";

const router = express.Router();

router.post("/",jwsMiddeware, handlePrompt);
router.get("/by-date",jwsMiddeware, getEntriesByDate);
router.post("/diary",jwsMiddeware, generateDiaryEntry);
router.get("/diary-by-date",jwsMiddeware, getDiaryByDate);
router.get("/",jwsMiddeware, getEntriesWithTaskTag);


export default router;
