import { Router } from 'express';

import { taxHandler } from '../controllers/tax.calculator.controller.js';
import { verifyExtensionAuth } from '../middlewares/extension-auth.middleware.js';

const taxCalculatorRouter = Router();

taxCalculatorRouter.get('/version', (req, res) => {
  res.json({ version: 'v1.0.7-url-test' });
});

taxCalculatorRouter.post('/taxCalculator', verifyExtensionAuth, taxHandler);

export default taxCalculatorRouter;
