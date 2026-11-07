import SpotifyWebApi from 'spotify-web-api-node';
import type { Track } from './types.js';

const playlistPattern = /open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/;

export class SpotifyPlaylistResolver {
  private readonly api: SpotifyWebApi;
  private tokenExpiresAt = 0;

  constructor(clientId: string, clientSecret: string) {
    this.api = new SpotifyWebApi({ clientId, clientSecret });
  }

  async resolvePlaylist(input: string): Promise<Track[]> {
    const match = input.match(playlistPattern);
    if (!match) {
      throw new Error('Please provide a Spotify playlist URL.');
    }

    await this.ensureToken();
    const tracks: Track[] = [];
    let offset = 0;
    let total = 1;
    while (offset < total) {
      const page = await this.api.getPlaylistTracks(match[1], { limit: 100, offset });
      total = page.body.total;
      for (const item of page.body.items) {
        const track = item.track;
        if (!track || track.type !== 'track') continue;
        tracks.push({
          title: track.name,
          artist: track.artists.map((artist) => artist.name).join(', '),
          durationMs: track.duration_ms,
          spotifyUrl: track.external_urls.spotify,
          searchQuery: `${track.name} ${track.artists[0]?.name ?? ''} audio`,
        });
      }
      offset += page.body.items.length;
      if (page.body.items.length === 0) break;
    }
    return tracks;
  }

  private async ensureToken(): Promise<void> {
    if (Date.now() < this.tokenExpiresAt) return;
    const response = await this.api.clientCredentialsGrant();
    this.api.setAccessToken(response.body.access_token);
    this.tokenExpiresAt = Date.now() + (response.body.expires_in - 60) * 1000;
  }
}
