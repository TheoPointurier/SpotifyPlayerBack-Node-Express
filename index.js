import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import authRouter from './src/routes/authRoutes.js';
import spotifyRouter from './src/routes/spotifyRoutes.js';

dotenv.config();

const result = dotenv.config();
console.log('dotenv result:', result);

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: ['http://localhost:5174', 'http://127.0.0.1:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(cookieParser());

const secretOk = process.env.SESSION_SECRET || 'secret';
console.log('secretOk', secretOk);

app.use(
  session({
    secret: secretOk,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', spotifyRouter);
app.use('/auth', authRouter);

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`)
});
