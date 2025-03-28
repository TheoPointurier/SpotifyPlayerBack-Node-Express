// src/routes/authRoutes.ts
import { Router } from 'express';
import { login, callback, getToken, refresh, logout } from '../controllers/authController.js';

const authRouter = Router();

authRouter.get('/login', login);
authRouter.get('/callback', callback);
authRouter.get('/get-token', getToken);
authRouter.post('/refresh', refresh);
authRouter.get('/logout', logout);

export default authRouter;