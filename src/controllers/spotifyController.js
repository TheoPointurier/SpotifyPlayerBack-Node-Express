export async function getCurrentTrack(req, res) {
  const accessToken = req.session?.accessToken || req.cookies.access_token;
  if (!accessToken) {
    res.status(401).json({ error: 'Non Authentifié' });
    return;
  }

  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch track');
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch track' });
  }
}

export async function proxySpotifyRequest(req, res) {
  let accessToken = req.session?.accessToken;
  const expiresAt = req.session?.expiresAt;
  const refreshToken = req.session?.refreshToken;

  const refreshAccessToken = async () => {
    if (!refreshToken) {
      console.error('Aucun refresh token disponible');
      throw new Error('Non Authentifié');
    }

    console.log('Rafraîchissement du token...');
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

    if (!response.ok) {
      const errorText = await response.text();
      // if(response.status === 404 &&)
      throw new Error(`Erreur lors du rafraîchissement du token: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (req.session) {
      req.session.accessToken = data.access_token;
      req.session.expiresIn = data.expires_in;
      req.session.expiresAt = Date.now() + data.expires_in * 1000;
    }

    return data.access_token;
  };

  // Vérifier si le token est valide
  if (!accessToken || !expiresAt || Date.now() > expiresAt) {
    try {
      accessToken = await refreshAccessToken();
    } catch (error) {
      console.error('Erreur lors du rafraîchissement initial du token:', error.message);
      res.status(401).json({ error: 'Non Authentifié', details: error.message });
      return;
    }
  }

  // Si accessToken est toujours undefined, renvoyer une erreur
  if (!accessToken) {
    console.error('Aucun access token disponible après vérification');
    res.status(401).json({ error: 'Non Authentifié' });
    return;
  }

  // Faire la requête à l'API Spotify
  try {
    const { method = 'GET', path, body } = req.body;
    console.log(`Requête Spotify: ${method} ${path}`, body ? JSON.stringify(body) : 'No body');
    const response = await fetch(`https://api.spotify.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    console.log('response spotify', response);
    if (!response.ok) {
      if (response.status === 401) {
        console.log('Token invalide, tentative de rafraîchissement...');
        try {
          accessToken = await refreshAccessToken();
          // Répéter la requête avec le nouveau token
          const retryResponse = await fetch(`https://api.spotify.com${path}`, {
            method,
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
          });

          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text();
            console.error(`Erreur après rafraîchissement: ${retryResponse.status} - ${retryErrorText}`);
            throw new Error(`Erreur après rafraîchissement: ${retryResponse.status} - ${retryErrorText}`);
          }

          // Gérer la réponse après le rafraîchissement
          if (retryResponse.status === 204) {
            console.log('Réponse 204 No Content reçue après rafraîchissement');
            res.status(204).send();
            return;
          }

          const retryData = await retryResponse.json();
          res.json(retryData);
          return;
        } catch (refreshError) {
          console.error('Échec du rafraîchissement du token:', refreshError.message);
          res.status(401).json({ error: 'Non Authentifié', details: refreshError.message });
          return;
        }
      }

      const errorText = await response.text();
      console.error(`Erreur Spotify: ${response.status} - ${errorText}`);
      throw new Error(`Erreur lors de la requête Spotify: ${response.status} - ${errorText}`);
    }

    // Gérer les réponses sans contenu (204 No Content) pour tous les endpoints
    if (response.status === 204) {
      console.log('Réponse 204 No Content reçue');
      res.status(204).send();
      return;
    }

    // Gérer les réponses spécifiques à certains endpoints
    if(response.status === 200 && response.url.includes('https://api.spotify.com/v1/me/player/shuffle')){
      console.log('shuffle ok');
      res.status(200).send();
      return;
    }
    if(response.status === 200 && response.url.includes('https://api.spotify.com/v1/me/player/seek')){
      console.log('seek ok');
      res.status(200).send();
      return;
    }
    if(response.status === 200 && response.url.includes('https://api.spotify.com/v1/me/player/repeat')){
      console.log('repeat ok');
      res.status(200).send();
      return;
    }

    // Parser la réponse en JSON uniquement si elle contient un corps
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erreur dans proxySpotifyRequest:', error .message);
    if(response.status == 403 && errorText.includes('the user may not be registered') ) {
      console.log('user not registered');
      res.status(403).send('the user may not be registered');
      return;
    }
    res.status(500).json({ error: 'Erreur lors de la requête Spotify', details: error.message });
    return;
  }
}

export function test(req, res) {
  res.json({ message: 'Backend fonctionne !' });
}