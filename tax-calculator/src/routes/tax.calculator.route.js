import { Router } from 'express';

import { taxHandler } from '../controllers/tax.calculator.controller.js';
import { verifyExtensionAuth } from '../middlewares/extension-auth.middleware.js';

const taxCalculatorRouter = Router();

taxCalculatorRouter.post('/taxCalculator', verifyExtensionAuth, taxHandler);

export default taxCalculatorRouter;
