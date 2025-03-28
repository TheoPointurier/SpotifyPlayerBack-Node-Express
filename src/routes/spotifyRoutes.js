// src/routes/spotifyRoutes.ts
import { Router } from 'express';
import { getCurrentTrack, proxySpotifyRequest, test } from '../controllers/spotifyController.js';

const spotifyRouter = Router();

spotifyRouter.get('/current-track', getCurrentTrack);
spotifyRouter.post('/spotify/proxy', proxySpotifyRequest);
spotifyRouter.get('/test', test);

export default spotifyRouter ;