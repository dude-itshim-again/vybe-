import 'dart:convert';
import 'package:dart_des/dart_des.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/track.dart';
import 'package:mobile/services/music_service.dart';

void main() {
  test('Track model serialization test', () {
    final track = Track(
      id: 'test-1',
      title: 'Starboy',
      artist: 'The Weeknd',
      duration: 230,
      artworkUrl: 'https://example.com/art.jpg',
      streamUrl: 'https://example.com/song.mp3',
      previewUrl: 'https://example.com/song.m4a',
    );

    final json = track.toJson();
    final restored = Track.fromJson(json);

    expect(restored.id, 'test-1');
    expect(restored.title, 'Starboy');
    expect(restored.artist, 'The Weeknd');
    expect(restored.duration, 230);
    expect(restored.previewUrl, 'https://example.com/song.m4a');
  });

  test('Fallback trending tracks are 10 real studio tracks with valid artwork & stream', () {
    final fallbacks = MusicService.fallbackTrendingTracks;
    expect(fallbacks.length, 10);

    for (final track in fallbacks) {
      expect(track.id.isNotEmpty, true);
      expect(track.title.isNotEmpty, true);
      expect(track.artist.isNotEmpty, true);
      expect(track.duration > 0, true);
      expect(track.artworkUrl.startsWith('https://'), true);
      expect(track.previewUrl != null && track.previewUrl!.startsWith('https://'), true);
    }
  });

  test('DES decryption for JioSaavn encrypted_media_url', () {
    final key = utf8.encode('38346591');
    final bytes = base64.decode('ID2ieOjCrwfgWvL5sXl4B1ImC5QfbsDyryhkSYK5IH2E7FCO52VR6yhNbcEbes5iCcja4+W8xhE0SwtCJToN4Bw7tS9a8Gtq');
    final des = DES(key: key, mode: DESMode.ECB, paddingType: DESPaddingType.PKCS7);
    final decrypted = des.decrypt(bytes);
    final url = utf8.decode(decrypted).trim();
    expect(url.contains('saavncdn.com'), true);
  });

  test('Strict matching logic correctly accepts exact matches and rejects bootlegs/covers', () {
    // 1. Exact match should be accepted
    expect(
      MusicService.isStrictMatch('Kesariya', 'Pritam', 'Kesariya', 'Pritam, Arijit Singh'),
      true,
    );

    // 2. Artist mismatch should be rejected
    expect(
      MusicService.isStrictMatch('Starboy', 'The Weeknd', 'Starboy', 'vaarairuthi'),
      false,
    );

    // 3. Unwanted slowed/reverb/remix bootlegs should be rejected
    expect(
      MusicService.isStrictMatch('Kesariya', 'Pritam', 'Kesariya (Slowed + Reverb)', 'Pritam'),
      false,
    );

    // 4. Karaoke should be rejected
    expect(
      MusicService.isStrictMatch('Die For You', 'The Weeknd', 'Die For You (Karaoke)', 'The Weeknd'),
      false,
    );

    // 5. Completely different title should be rejected
    expect(
      MusicService.isStrictMatch('Starboy', 'The Weeknd', 'Subtle Starboy', 'The Weeknd'),
      false,
    );
  });

  test('resolveStreamUrl returns direct stream for tracks that already have saavncdn URLs', () async {
    final track = Track(
      id: 'saavn-123',
      title: 'Kesariya',
      artist: 'Arijit Singh',
      streamUrl: 'https://aac.saavncdn.com/871/c2febd353f3a076a406fa37510f31f9f_320.mp4',
      previewUrl: 'https://aac.saavncdn.com/871/c2febd353f3a076a406fa37510f31f9f_320.mp4',
      source: 'saavn',
    );

    final url = await MusicService.resolveStreamUrl(track);
    expect(url, 'https://aac.saavncdn.com/871/c2febd353f3a076a406fa37510f31f9f_320.mp4');
  });

  test('resolveStreamUrl falls back to track.previewUrl if JioSaavn match fails', () async {
    final track = Track(
      id: 'itunes-999',
      title: 'Completely Unique Title 999999',
      artist: 'Nonexistent Artist 999999',
      duration: 180,
      streamUrl: 'https://audio-ssl.itunes.apple.com/test-preview.m4a',
      previewUrl: 'https://audio-ssl.itunes.apple.com/test-preview.m4a',
      source: 'itunes',
    );

    final url = await MusicService.resolveStreamUrl(track);
    expect(url, 'https://audio-ssl.itunes.apple.com/test-preview.m4a');
  });

  test('Live search attaches valid streamUrls directly', () async {
    final results = await MusicService.searchSongs('Kesariya', limit: 5);
    expect(results.isNotEmpty, true);
    final first = results.first;
    expect(first.title.isNotEmpty, true);
    expect(first.streamUrl.isNotEmpty, true);
    expect(first.streamUrl.startsWith('https://'), true);
    expect(first.artworkUrl.startsWith('https://'), true);
  });
}
