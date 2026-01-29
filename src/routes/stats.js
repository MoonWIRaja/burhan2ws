import express from 'express';
import { getOverview } from '../controllers/statsController.js';

const router = express.Router();

// Get overview statistics
router.get('/overview', getOverview);

export default router;
