export function login(req, res) {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  if (req.session?.accessToken) {
    return res.redirect(FRONTEND_URL);
  }

  const scope = ['streaming user-read-private', 'user-read-email', 'user-read-playback-state', 'user-modify-playback-state'].join(' ');
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${process.env.SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${process.env.SPOTIFY_REDIRECT_URI}&scope=${encodeURIComponent(scope)}`;
  res.redirect(authUrl);
};

export async function callback(req, res) {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  const code = req.query.code;
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Erreur lors de la récupération du token: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Réponse de Spotify (callback):', data);

    if (!data.refresh_token) {
      console.error('Aucun refresh_token renvoyé par Spotify');
      res.status(500).json({ error: 'Aucun refresh_token renvoyé par Spotify' });
      return;
    }

    if (req.session) {
      req.session.accessToken = data.access_token;
      req.session.refreshToken = data.refresh_token;
      req.session.expiresIn = data.expires_in;
      req.session.expiresAt = Date.now() + data.expires_in * 1000;
    }

    // res.cookie('access_token', data.access_token, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === 'production',
    //   sameSite: 'strict',
    //   maxAge: data.expires_in * 1000,
    // });

    res.redirect(FRONTEND_URL);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de l’authentification' });
  }
};

export async function getToken(req, res) {
  console.log('getToken');
  let accessToken = req.session?.accessToken;
  const expiresAt = req.session?.expiresAt;

  // Vérifier si le token est expiré
  if (!accessToken || !expiresAt || Date.now() > expiresAt) {
    const refreshToken = req.session?.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ error: 'Non Authentifié' });
      return;
    }

    // Rafraîchir le token
    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }).toString(),
      });

      if (!response.ok) throw new Error('Erreur lors du rafraîchissement du token');
      const data = await response.json();

      if (req.session) {
        req.session.accessToken = data.access_token;
        req.session.expiresIn = data.expires_in;
        req.session.expiresAt = Date.now() + data.expires_in * 1000;
      }

      accessToken = data.access_token;
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du rafraîchissement du token' });
      return;
    }
  }

  res.json({ access_token: accessToken || '' });
};

export async function refresh(req, res) {
  const refreshToken = req.session?.refreshToken || req.body.refresh_token;
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token manquant' });
    return;
  }
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) throw new Error('Erreur lors du rafraîchissement du token');
    const data = await response.json();

    if (req.session) {
      req.session.accessToken = data.access_token;
      req.session.expiresIn = data.expires_in;
    }

    res.cookie('access_token', data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: data.expires_in * 1000,
    });

    res.json({ access_token: data.access_token, expires_in: data.expires_in });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors du rafraîchissement' });
  }
};

export function logout(req, res) {
  res.cookie('access_token', '', { expires: new Date(0) });
  req.session?.destroy((err) => {
    if (err) {
      console.error('Erreur lors de la destruction de la session', err);
      res.status(500).json({ error: 'Erreur lors de la déconnexion' });
      return;
    }
    res.json({ message: 'Déconnecté' });
  });
};

export async function getClientCredentialsToken() {
  // Construction du header d’autorisation “Basic <base64(client_id:client_secret)>”
  const authHeader = Buffer
    .from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`)
    .toString('base64');

  // Appel à l’endpoint OAuth “Client Credentials”
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authHeader}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
    })
  });

  if (!response.ok) {
    const errMsg = await response.text();
    throw new Error(`Impossible d'obtenir le token (status ${response.status}) : ${errMsg}`);
  }

  const data = await response.json();  // { access_token, token_type, expires_in, ... }
  return data.access_token;            // on ne récupère que access_token
}

export async function getTheOnePlaylist(req, res) {
  try {
    const { playlistId } = req.params;
    const accessToken = await getClientCredentialsToken();
    if (!accessToken) {
      res.status(401).json({ error: 'problème lors de la récupération du token pub' });
      return;
    }

    const spotifyResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (!spotifyResponse.ok) {
      const errText = await spotifyResponse.text();
      return res.status(spotifyResponse.status).json({
        error: 'Erreur lors de la récupération de la playlist Spotify',
        details: errText,
      });
    }

    const playlistData = await spotifyResponse.json();
    return res.json(playlistData);
  } catch (error) {
    console.error('erreur public playlist', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
}