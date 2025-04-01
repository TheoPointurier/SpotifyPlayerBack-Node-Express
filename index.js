import dotenv from 'dotenv';
dotenv.config();

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import authRouter from './src/routes/authRoutes.js';
import spotifyRouter from './src/routes/spotifyRoutes.js';
import sqlite3 from 'sqlite3';
import connectSqlite3 from 'connect-sqlite3';

const app = express();

const result = dotenv.config();
console.log('dotenv result:', result);
const secretOk = process.env.SESSION_SECRET || 'secret';
console.log('secretOk', secretOk);

const SQLiteStore = connectSqlite3(session);

const db = new sqlite3.Database('./session.db', (err) => {
  if (err) {
    console.error('Erreur lors de la connexion à la base de données', err);
  } else {
    console.log('Connexion à la base de données réussie');
  }
});

const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173','http://localhost:4173','http://127.0.0.1:4173', 'https://theopointurier.com'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(cookieParser());


app.use(
  session({
    store: new SQLiteStore({
      db: 'session.db',
      dir: './',
      concurrentDB: true,
      clearInterval : 3600,
      // table: 'sessions',
      // ttl: 60 * 60 * 24 * 7, // 1 semaine
    }),
    secret: secretOk,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);
console.log('session:', session);

app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  res.status(500).send('Erreur serveur');
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/login', (req, res) => {
  req.session.userId = '123'; // Simule une connexion
  req.session.test = 'Session fonctionne !';
  res.send('Session créée');
});

app.get('/check', (req, res) => {
  if (req.session.userId) {
    res.send(`Utilisateur connecté : ${req.session.userId}, Test : ${req.session.test}`);
  } else {
    res.send('Pas de session');
  }
});

// Routes
app.use('/auth', authRouter);
app.use('/api', spotifyRouter);

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`)
});
