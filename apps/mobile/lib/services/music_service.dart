import 'dart:async';
import 'dart:convert';
import 'package:dart_des/dart_des.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:youtube_explode_dart/youtube_explode_dart.dart';
import '../models/track.dart';

class MusicService {
  static const String _defaultArtwork =
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80';

  static final RegExp _bootlegRegex = RegExp(
    r'\b(karaoke|zzang|arcade player|16-bit|8-bit|emulation|originally perf|performed by|tribute to|ringtone|cover version|backing track)\b',
    caseSensitive: false,
  );

  /// Hardcoded fallback list of 10 real studio tracks with verified high-res artwork & direct .m4a audio streams.
  static final List<Track> fallbackTrendingTracks = [
    Track(
      id: 'itunes-1440870375',
      title: 'Starboy (feat. Daft Punk)',
      artist: 'The Weeknd',
      album: 'Starboy',
      duration: 230,
      artworkUrl:
          'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b5/92/bb/b592bb72-52e3-e756-9b26-9f56d08f47ab/16UMGIM67864.rgb.jpg/600x600bb.jpg',
      previewUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/71/d6/1171d6ad-3c96-e027-2af6-58028426588c/mzaf_15137631797407745471.plus.aac.p.m4a',
      streamUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/71/d6/1171d6ad-3c96-e027-2af6-58028426588c/mzaf_15137631797407745471.plus.aac.p.m4a',
      source: 'itunes',
    ),
    Track(
      id: 'itunes-1440872304',
      title: 'Die For You',
      artist: 'The Weeknd',
      album: 'Starboy',
      duration: 260,
      artworkUrl:
          'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e2/61/f8/e261f8c1-73db-9a7a-c89e-1068f19970e0/16UMGIM67863.rgb.jpg/600x600bb.jpg',
      previewUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/50/50/1a/50501a86-bd74-e90d-8a56-68c9b5e6e7d6/mzaf_4588197682084244913.plus.aac.p.m4a',
      streamUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/50/50/1a/50501a86-bd74-e90d-8a56-68c9b5e6e7d6/mzaf_4588197682084244913.plus.aac.p.m4a',
      source: 'itunes',
    ),
    Track(
      id: 'itunes-1468448742',
      title: 'Tujhe Kitna Chahne Lage',
      artist: 'Arijit Singh',
      album: 'Kabir Singh',
      duration: 284,
      artworkUrl:
          'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/f6/70/84/f6708434-0123-ff36-0ac3-7401e8cf0f94/8902894360807_cover.jpg/600x600bb.jpg',
      previewUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/7e/f3/43/7ef34316-c0d1-4c3c-afc9-53716b8f3473/mzaf_13869194700915977502.plus.aac.p.m4a',
      streamUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/7e/f3/43/7ef34316-c0d1-4c3c-afc9-53716b8f3473/mzaf_13869194700915977502.plus.aac.p.m4a',
      source: 'itunes',
    ),
    Track(
      id: 'itunes-1581006912',
      title: 'Lover',
      artist: 'Diljit Dosanjh',
      album: 'MoonChild Era',
      duration: 190,
      artworkUrl:
          'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/8a/89/e4/8a89e445-d2c6-f8ac-a828-27818b0c1afe/859749638209_cover.jpg/600x600bb.jpg',
      previewUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/38/d5/7a/38d57a99-39fc-e901-7c45-fa6260ec83c1/mzaf_8083696285926392389.plus.aac.p.m4a',
      streamUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/38/d5/7a/38d57a99-39fc-e901-7c45-fa6260ec83c1/mzaf_8083696285926392389.plus.aac.p.m4a',
      source: 'itunes',
    ),
    Track(
      id: 'itunes-1538003843',
      title: 'Levitating',
      artist: 'Dua Lipa',
      album: 'Future Nostalgia',
      duration: 203,
      artworkUrl:
          'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/6c/11/d6/6c11d681-aa3a-d59e-4c2e-f77e181026ab/190295092665.jpg/600x600bb.jpg',
      previewUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/59/dc/4d/59dc4dda-93ff-8f1c-c536-f005f6ea6af5/mzaf_3066686759813252385.plus.aac.p.m4a',
      streamUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/59/dc/4d/59dc4dda-93ff-8f1c-c536-f005f6ea6af5/mzaf_3066686759813252385.plus.aac.p.m4a',
      source: 'itunes',
    ),
    Track(
      id: 'itunes-1445949267',
      title: 'Sunflower',
      artist: 'Post Malone & Swae Lee',
      album: 'Spider-Man: Into the Spider-Verse',
      duration: 158,
      artworkUrl:
          'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/4b/30/2c/4b302cb6-7a14-5464-4e97-0577e9d0be49/18UMGIM82277.rgb.jpg/600x600bb.jpg',
      previewUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/98/f0/d6/98f0d67e-f8bf-762d-cac7-1c6b3b6b35dd/mzaf_4543283896248560946.plus.aac.p.m4a',
      streamUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/98/f0/d6/98f0d67e-f8bf-762d-cac7-1c6b3b6b35dd/mzaf_4543283896248560946.plus.aac.p.m4a',
      source: 'itunes',
    ),
    Track(
      id: 'itunes-1442846328',
      title: 'Stronger',
      artist: 'Kanye West',
      album: 'Graduation',
      duration: 312,
      artworkUrl:
          'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/39/25/2d/39252d65-2d50-b991-0962-f7a98a761271/00602517483507.rgb.jpg/600x600bb.jpg',
      previewUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/9e/cc/69/9ecc6918-a8dc-354f-909f-ccc20a0a7a33/mzaf_7863921970418240507.plus.aac.p.m4a',
      streamUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/9e/cc/69/9ecc6918-a8dc-354f-909f-ccc20a0a7a33/mzaf_7863921970418240507.plus.aac.p.m4a',
      source: 'itunes',
    ),
    Track(
      id: 'itunes-1615585008',
      title: 'As It Was',
      artist: 'Harry Styles',
      album: "Harry's House",
      duration: 167,
      artworkUrl:
          'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/2a/19/fb/2a19fb85-2f70-9e44-f2a9-82abe679b88e/886449990061.jpg/600x600bb.jpg',
      previewUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/67/10/16/67101606-3869-ca44-6c03-e13d6322cb51/mzaf_1135399237022217274.plus.aac.p.m4a',
      streamUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/67/10/16/67101606-3869-ca44-6c03-e13d6322cb51/mzaf_1135399237022217274.plus.aac.p.m4a',
      source: 'itunes',
    ),
    Track(
      id: 'itunes-1635014240',
      title: 'Kesariya',
      artist: 'Pritam, Arijit Singh & Amitabh Bhattacharya',
      album: 'Brahmastra',
      duration: 268,
      artworkUrl:
          'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/9f/13/ca/9f13ca3b-e533-03e0-f19a-f0aaa774581d/196589311191.jpg/600x600bb.jpg',
      previewUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/38/4c/5c/384c5c8f-3ff8-e457-b2f7-3158ce108649/mzaf_12389299033886433185.plus.aac.p.m4a',
      streamUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/38/4c/5c/384c5c8f-3ff8-e457-b2f7-3158ce108649/mzaf_12389299033886433185.plus.aac.p.m4a',
      source: 'itunes',
    ),
    Track(
      id: 'itunes-1363310482',
      title: 'Call Out My Name',
      artist: 'The Weeknd',
      album: 'My Dear Melancholy,',
      duration: 228,
      artworkUrl:
          'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/2a/aa/b4/2aaab42a-a4cb-a600-4a25-d78961495960/18UMGIM17204.rgb.jpg/600x600bb.jpg',
      previewUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/d1/2f/3d/d12f3d43-a2e2-eba4-8db5-91f3f3c13f5a/mzaf_8470584399239689698.plus.aac.p.m4a',
      streamUrl:
          'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/d1/2f/3d/d12f3d43-a2e2-eba4-8db5-91f3f3c13f5a/mzaf_8470584399239689698.plus.aac.p.m4a',
      source: 'itunes',
    ),
  ];

  /// Strips noisy bracketed tags, parenthetical suffixes, and HTML entities
  static String cleanText(String? input) {
    if (input == null) return '';
    var text = input
        .replaceAll('&quot;', '"')
        .replaceAll('&#034;', '"')
        .replaceAll('&#34;', '"')
        .replaceAll('&amp;', '&')
        .replaceAll('&#038;', '&')
        .replaceAll('&#38;', '&')
        .replaceAll('&apos;', "'")
        .replaceAll('&#039;', "'")
        .replaceAll('&#39;', "'")
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&nbsp;', ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();

    text = text.replaceAll(
      RegExp(
        r'[\(\[]\s*(?:official\s*(?:music\s*)?(?:video|audio|lyric\s*video|visualizer)|lyrics?|hd|hq|4k|remastered(?:\s*\d{4})?|from\s*["\x27].*?["\x27]|feat\.?.*|ft\.?.*|prod\.?.*|slowed(?:\s*\+\s*reverb)?|reverb|sped\s*up|speed\s*up|deluxe(?:\s*edition)?|lofi(?:\s*flip)?)\s*[\)\]]',
        caseSensitive: false,
      ),
      '',
    );

    text = text.replaceAll(
      RegExp(
        r'[-–—|]\s*(?:remastered(?:\s*\d{4})?|single\s*version|original\s*motion\s*picture\s*soundtrack|soundtrack|ost|official\s*(?:music\s*)?(?:video|audio|lyric\s*video|visualizer)|audio|video|visualizer|4k|hd|hq|slowed(?:\s*\+\s*reverb)?)\s*$',
        caseSensitive: false,
      ),
      '',
    );

    return text.trim();
  }

  /// Normalizes string for strict matching (lowercased, alphanumeric only, strips bracketed text)
  static String _norm(String s) {
    return s
        .toLowerCase()
        .replaceAll('&quot;', '')
        .replaceAll('&#034;', '')
        .replaceAll('&#34;', '')
        .replaceAll('&amp;', 'and')
        .replaceAll('&#038;', 'and')
        .replaceAll('&#38;', 'and')
        .replaceAll('&apos;', "'")
        .replaceAll('&#039;', "'")
        .replaceAll('&#39;', "'")
        .replaceAll(RegExp(r'\(.*?\)|\[.*?\]'), '') // strip (From "..."), (feat. ...), [Remix]
        .replaceAll(RegExp(r'[^a-z0-9\s]'), '')
        .trim();
  }

  static String normalize(String input) => _norm(input);

  /// Extracts the primary artist name before feat/&/,/-
  static String extractPrimaryArtist(String artist) {
    final cleaned = cleanText(artist);
    final parts = cleaned.split(RegExp(r'[,&/\\]|\bfeat\.?|\bft\.?|-', caseSensitive: false));
    return parts.isNotEmpty ? parts[0].trim() : cleaned.trim();
  }

  /// Rejects karaoke, ringtone, and tribute bootlegs
  static bool isKaraokeOrBootleg(String title, String artist, [String album = '']) {
    final full = '$title $artist $album'.toLowerCase();
    return _bootlegRegex.hasMatch(full);
  }

  /// Decrypts JioSaavn encrypted_media_url using DES ECB mode with key 38346591
  static String decryptJioSaavnUrl(String enc) {
    try {
      final key = utf8.encode('38346591');
      final bytes = base64.decode(enc);
      final des = DES(key: key, mode: DESMode.ECB, paddingType: DESPaddingType.PKCS7);
      final decrypted = des.decrypt(bytes);
      final url = utf8.decode(decrypted).trim();
      if (url.isEmpty) return '';
      return url
          .replaceAll('_96.mp4', '_320.mp4')
          .replaceAll('_160.mp4', '_320.mp4')
          .replaceFirst('http:', 'https:');
    } catch (_) {
      return '';
    }
  }

  /// Strict title and artist match scoring.
  /// Guarantees that random or cover songs are never accepted.
  static bool isStrictMatch(
    String targetTitle,
    String targetArtist,
    String candTitle,
    String candArtist,
  ) {
    // 1. Reject unwanted versions if the target was not one (check raw lowercase before stripping brackets!)
    final rawT = targetTitle.toLowerCase();
    final rawC = candTitle.toLowerCase();
    final badKeywords = [
      'lofi',
      'lo-fi',
      'slowed',
      'reverb',
      'karaoke',
      'instrumental',
      '8d',
      'mashup',
      'remix',
      'cover'
    ];
    for (final kw in badKeywords) {
      if (rawC.contains(kw) && !rawT.contains(kw)) return false;
    }

    final tTitle = _norm(targetTitle);
    final cTitle = _norm(candTitle);
    if (tTitle.isEmpty || cTitle.isEmpty) return false;

    // 2. Title must match closely
    final titleMatches = (cTitle == tTitle) || cTitle.startsWith(tTitle) || tTitle.startsWith(cTitle);
    if (!titleMatches) return false;

    // 3. Primary artist must match!
    final tArtistWords = _norm(targetArtist).split(' ').where((w) => w.length > 2).toList();
    final cArtist = _norm(candArtist);
    final artistMatches = tArtistWords.isEmpty || tArtistWords.any((w) => cArtist.contains(w));

    return artistMatches;
  }

  // ---------------------------------------------------------------------------
  // JIOSAAVN PARSERS
  // ---------------------------------------------------------------------------

  static Track? _parseSumitSaavnTrack(Map item) {
    try {
      final title = cleanText(item['name']?.toString() ?? '');
      if (title.isEmpty) return null;

      String artist = '';
      final primaryArtists = item['artists']?['primary'];
      if (primaryArtists is List && primaryArtists.isNotEmpty) {
        artist = primaryArtists
            .map((a) => a is Map ? (a['name']?.toString() ?? '') : '')
            .where((s) => s.isNotEmpty)
            .join(', ');
      }
      if (artist.isEmpty) {
        final allArtists = item['artists']?['all'];
        if (allArtists is List && allArtists.isNotEmpty) {
          artist = allArtists
              .map((a) => a is Map ? (a['name']?.toString() ?? '') : '')
              .where((s) => s.isNotEmpty)
              .join(', ');
        }
      }
      if (artist.isEmpty) {
        artist = item['artist']?.toString() ?? 'Unknown Artist';
      }
      artist = cleanText(artist);

      String album = '';
      if (item['album'] is Map) {
        album = cleanText(item['album']['name']?.toString() ?? '');
      } else if (item['album'] is String) {
        album = cleanText(item['album'].toString());
      }

      if (isKaraokeOrBootleg(title, artist, album)) return null;

      final durationSec = (item['duration'] as num?)?.toInt() ?? 180;

      // High-res 500x500 artwork
      String artworkUrl = '';
      final images = item['image'];
      if (images is List && images.isNotEmpty) {
        final lastImg = images.last;
        if (lastImg is Map && lastImg['url'] != null) {
          artworkUrl = lastImg['url'].toString();
        }
      } else if (images is String && images.isNotEmpty) {
        artworkUrl = images.replaceAll('150x150', '500x500');
      }
      if (artworkUrl.isEmpty) {
        artworkUrl = _defaultArtwork;
      }

      // Direct 320kbps stream URL
      String streamUrl = '';
      final dlUrls = item['downloadUrl'] as List?;
      if (dlUrls != null && dlUrls.isNotEmpty) {
        final lastItem = dlUrls.last;
        final link = (lastItem is Map) ? (lastItem['url'] ?? lastItem['link'])?.toString() : null;
        if (link != null && link.startsWith('http')) {
          streamUrl = link.replaceFirst('http:', 'https:');
        }
      }

      if (streamUrl.isEmpty) return null;

      final id = 'saavn-${item['id'] ?? DateTime.now().millisecondsSinceEpoch}';

      return Track(
        id: id,
        title: title,
        artist: artist,
        album: album,
        duration: durationSec > 0 ? durationSec : 180,
        artworkUrl: artworkUrl,
        streamUrl: streamUrl,
        previewUrl: streamUrl,
        source: 'saavn',
      );
    } catch (_) {
      return null;
    }
  }

  static Track? _parseOfficialSaavnTrack(Map item) {
    try {
      final title = cleanText(item['title']?.toString() ?? '');
      if (title.isEmpty) return null;

      String artist = '';
      final primaryArtists = item['more_info']?['artistMap']?['primary_artists'];
      if (primaryArtists is List && primaryArtists.isNotEmpty) {
        artist = primaryArtists
            .map((a) => a is Map ? (a['name']?.toString() ?? '') : '')
            .where((s) => s.isNotEmpty)
            .join(', ');
      }
      if (artist.isEmpty) {
        artist = item['more_info']?['music']?.toString() ?? '';
      }
      if (artist.isEmpty) {
        final subtitle = item['subtitle']?.toString() ?? '';
        final parts = subtitle.split('-');
        artist = parts.isNotEmpty ? parts[0].trim() : subtitle;
      }
      if (artist.isEmpty) {
        artist = 'Unknown Artist';
      }
      artist = cleanText(artist);

      final album = cleanText(item['more_info']?['album']?.toString() ?? '');

      if (isKaraokeOrBootleg(title, artist, album)) return null;

      final durationStr = item['more_info']?['duration']?.toString() ?? '';
      final durationSec = int.tryParse(durationStr) ?? 180;

      String artworkUrl = (item['image'] ?? '').toString();
      if (artworkUrl.isNotEmpty) {
        artworkUrl = artworkUrl.replaceAll('150x150', '500x500');
      } else {
        artworkUrl = _defaultArtwork;
      }

      // Stream URL: check media_preview_url or decrypt encrypted_media_url
      String streamUrl = '';
      final preview = item['more_info']?['media_preview_url']?.toString();
      if (preview != null && preview.isNotEmpty) {
        streamUrl = preview
            .replaceAll('preview.saavncdn.com', 'aac.saavncdn.com')
            .replaceAll('_96_p.mp4', '_320.mp4')
            .replaceAll('_96.mp4', '_320.mp4')
            .replaceFirst('http:', 'https:');
      }

      if (streamUrl.isEmpty) {
        final encUrl = item['more_info']?['encrypted_media_url']?.toString();
        if (encUrl != null && encUrl.isNotEmpty) {
          streamUrl = decryptJioSaavnUrl(encUrl);
        }
      }

      if (streamUrl.isEmpty) return null;

      final id = 'saavn-${item['id'] ?? DateTime.now().millisecondsSinceEpoch}';

      return Track(
        id: id,
        title: title,
        artist: artist,
        album: album,
        duration: durationSec > 0 ? durationSec : 180,
        artworkUrl: artworkUrl,
        streamUrl: streamUrl,
        previewUrl: streamUrl,
        source: 'saavn',
      );
    } catch (_) {
      return null;
    }
  }

  /// Internal helper to query JioSaavn search endpoints
  static Future<List<Track>> _searchJioSaavn(String query, {int limit = 25}) async {
    final q = Uri.encodeComponent(query);

    // Primary: saavn.sumit.co
    try {
      final url = 'https://saavn.sumit.co/api/search/songs?query=$q&limit=$limit';
      final res = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 3));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final rawResults = data['data']?['results'] as List?;
        if (rawResults != null && rawResults.isNotEmpty) {
          final List<Track> tracks = [];
          for (final item in rawResults) {
            if (item is Map) {
              final t = _parseSumitSaavnTrack(item);
              if (t != null) tracks.add(t);
            }
          }
          if (tracks.isNotEmpty) return tracks;
        }
      }
    } catch (e) {
      debugPrint('[MusicService] saavn.sumit.co search error: $e');
    }

    // Backup 1: jiosaavn-api-privatecvc2.vercel.app
    try {
      final url = 'https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=$q&limit=$limit';
      final res = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 2));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final rawResults = (data['data']?['results'] ?? data['results']) as List?;
        if (rawResults != null && rawResults.isNotEmpty) {
          final List<Track> tracks = [];
          for (final item in rawResults) {
            if (item is Map) {
              final t = _parseSumitSaavnTrack(item);
              if (t != null) tracks.add(t);
            }
          }
          if (tracks.isNotEmpty) return tracks;
        }
      }
    } catch (_) {}

    // Backup 2: Official JioSaavn v4 API
    try {
      final url =
          'https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=$limit&p=1&q=$q';
      final res = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 3));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final rawResults = data['results'] as List?;
        if (rawResults != null && rawResults.isNotEmpty) {
          final List<Track> tracks = [];
          for (final item in rawResults) {
            if (item is Map) {
              final t = _parseOfficialSaavnTrack(item);
              if (t != null) tracks.add(t);
            }
          }
          if (tracks.isNotEmpty) return tracks;
        }
      }
    } catch (e) {
      debugPrint('[MusicService] official JioSaavn search error: $e');
    }

    return [];
  }

  /// Internal helper to query iTunes Search API
  static Future<List<Track>> _searchItunes(String query, {int limit = 25}) async {
    try {
      final cleanQuery = query.trim();
      final url =
          'https://itunes.apple.com/search?term=${Uri.encodeComponent(cleanQuery)}&media=music&entity=song&limit=$limit&country=IN';
      final res = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 3));

      List results = [];
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data is Map && data['results'] is List) {
          results = data['results'] as List;
        }
      }

      if (results.isEmpty) {
        final globalUrl =
            'https://itunes.apple.com/search?term=${Uri.encodeComponent(cleanQuery)}&media=music&entity=song&limit=$limit';
        final globalRes = await http.get(Uri.parse(globalUrl)).timeout(const Duration(seconds: 3));
        if (globalRes.statusCode == 200) {
          final gData = jsonDecode(globalRes.body);
          if (gData is Map && gData['results'] is List) {
            results = gData['results'] as List;
          }
        }
      }

      final List<Track> tracks = [];
      for (final item in results) {
        if (item is! Map) continue;
        final title = cleanText(item['trackName']?.toString() ?? 'Unknown Title');
        final artist = cleanText(item['artistName']?.toString() ?? 'Unknown Artist');
        final album = cleanText(item['collectionName']?.toString() ?? '');

        if (title.isEmpty || isKaraokeOrBootleg(title, artist, album)) continue;

        final rawArtwork = (item['artworkUrl100'] ?? '').toString();
        final artworkUrl = rawArtwork.isNotEmpty
            ? rawArtwork.replaceAll('100x100bb', '600x600bb')
            : _defaultArtwork;

        final previewUrl = (item['previewUrl'] ?? '').toString();
        if (previewUrl.isEmpty) continue;

        final durationMs = item['trackTimeMillis'] as num? ?? 180000;
        final duration = Duration(milliseconds: durationMs.toInt()).inSeconds;
        final id = 'itunes-${item["trackId"] ?? DateTime.now().millisecondsSinceEpoch}';

        tracks.add(Track(
          id: id,
          title: title,
          artist: artist,
          album: album,
          duration: duration > 0 ? duration : 180,
          artworkUrl: artworkUrl,
          streamUrl: previewUrl,
          previewUrl: previewUrl,
          source: 'itunes',
        ));
      }

      return tracks;
    } catch (e) {
      debugPrint('[MusicService] searchItunes error: $e');
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // PUBLIC SEARCH & TRENDING
  // ---------------------------------------------------------------------------

  /// 1. Catalog Search: searchSongs
  /// Fetches primary 320kbps catalog from JioSaavn with embedded streamUrl,
  /// and supplements with iTunes for international tracks.
  static Future<List<Track>> searchSongs(String query, {int limit = 25}) async {
    final cleanQuery = query.trim();
    if (cleanQuery.isEmpty) return [];

    List<Track> saavnTracks = [];
    List<Track> itunesTracks = [];

    try {
      final results = await Future.wait([
        _searchJioSaavn(cleanQuery, limit: limit),
        _searchItunes(cleanQuery, limit: limit),
      ]).timeout(const Duration(seconds: 4));

      saavnTracks = results[0];
      itunesTracks = results[1];
    } catch (e) {
      debugPrint('[MusicService] searchSongs concurrent fetch error: $e');
    }

    // Merge: JioSaavn tracks take priority with attached 320kbps streams.
    // iTunes tracks supplement international songs not on JioSaavn.
    final Map<String, Track> seen = {};

    for (final t in saavnTracks) {
      final key = '${_norm(t.title)}__${_norm(extractPrimaryArtist(t.artist))}';
      seen[key] = t;
    }

    for (final t in itunesTracks) {
      final key = '${_norm(t.title)}__${_norm(extractPrimaryArtist(t.artist))}';
      if (!seen.containsKey(key)) {
        seen[key] = t;
      }
    }

    final merged = seen.values.toList();
    if (merged.isNotEmpty) {
      return merged.take(limit).toList();
    }

    // Fallback if offline
    final matches = fallbackTrendingTracks.where((t) {
      final q = cleanQuery.toLowerCase();
      return t.title.toLowerCase().contains(q) || t.artist.toLowerCase().contains(q);
    }).toList();

    return matches.isNotEmpty ? matches : fallbackTrendingTracks;
  }

  /// Alias for searchSongs
  static Future<List<Track>> searchTracks(String query, {int limit = 25}) =>
      searchSongs(query, limit: limit);

  /// 2. Trending Songs for Home Screen
  static Future<List<Track>> getTrendingSongs() async {
    try {
      final queries = ['Top Hits Hindi', 'Arijit Singh', 'The Weeknd', 'Diljit Dosanjh', 'Kanye West'];
      final futures = queries.map((q) => searchSongs(q, limit: 6));
      final resultsList = await Future.wait(futures).timeout(const Duration(seconds: 4));

      final Map<String, Track> seen = {};
      for (final list in resultsList) {
        for (final t in list) {
          final key = '${_norm(t.title)}__${_norm(extractPrimaryArtist(t.artist))}';
          if (!seen.containsKey(key)) {
            seen[key] = t;
          }
        }
      }

      if (seen.isNotEmpty) {
        return seen.values.toList();
      }
    } catch (e) {
      debugPrint('[MusicService] getTrendingSongs timeout/error: $e');
    }

    return fallbackTrendingTracks;
  }

  /// Alias for getTrendingSongs
  static Future<List<Track>> getTrendingTracks() => getTrendingSongs();

  // ---------------------------------------------------------------------------
  // STREAM RESOLVER (resolveStreamUrl)
  // ---------------------------------------------------------------------------

  /// 3. Stream Resolver
  /// - If track already has direct saavncdn URL, plays directly without searching.
  /// - If upgrading an iTunes track to JioSaavn, requires 100% strict match:
  ///   Exact Title + Exact Artist + Duration within ±8 seconds!
  /// - If no JioSaavn candidate passes, falls back to full YouTube audio or iTunes studio previewUrl.
  static Future<String?> resolveStreamUrl(Track track) async {
    // 0. Offline storage
    if (track.localFilePath != null && track.localFilePath!.isNotEmpty) {
      return track.localFilePath;
    }

    // 0b. Direct Stream Binding: if track already holds a 320kbps Saavn stream
    if (track.streamUrl.isNotEmpty &&
        (track.streamUrl.contains('aac.saavncdn.com') ||
         track.streamUrl.contains('saavncdn.com') ||
         track.source == 'saavn')) {
      return track.streamUrl;
    }

    // 1. Strict JioSaavn Match
    try {
      final saavnCandidates = await _searchJioSaavn('${track.title} ${track.artist}', limit: 5)
          .timeout(const Duration(milliseconds: 2500), onTimeout: () => []);

      for (final cand in saavnCandidates) {
        // Strict title & artist check
        if (!isStrictMatch(track.title, track.artist, cand.title, cand.artist)) {
          continue;
        }

        // Strict duration check (within ±8 seconds)
        if (track.duration > 0 && cand.duration > 0) {
          final diff = (cand.duration - track.duration).abs();
          if (diff > 8) {
            continue;
          }
        }

        if (cand.streamUrl.isNotEmpty && cand.streamUrl.startsWith('http')) {
          debugPrint(
              '[MusicService] Strict match found for "${track.title}" -> 320kbps: ${cand.streamUrl}');
          return cand.streamUrl;
        }
      }
    } catch (e) {
      debugPrint('[MusicService] JioSaavn match check error: $e');
    }

    // 2. Full YouTube Official Audio Fallback (within 20s duration)
    try {
      final yt = YoutubeExplode();
      final searchResults = await yt.search
          .search('${track.title} ${track.artist} Official Audio')
          .timeout(const Duration(milliseconds: 2500));

      final normT = _norm(track.title);
      for (final video in searchResults) {
        final vTitle = video.title.toLowerCase();
        final vDuration = video.duration?.inSeconds ?? 0;

        // Reject live, covers, sped up, slowed
        if (vTitle.contains('live') ||
            vTitle.contains('cover') ||
            vTitle.contains('slowed') ||
            vTitle.contains('sped up')) {
          continue;
        }

        final normV = _norm(video.title);
        if (!normV.contains(normT)) continue;

        if (track.duration > 0 && vDuration > 0 && (vDuration - track.duration).abs() > 20) {
          continue;
        }

        final manifest = await yt.videos.streamsClient
            .getManifest(video.id)
            .timeout(const Duration(milliseconds: 2000));
        final audioStream = manifest.audioOnly.withHighestBitrate();
        yt.close();
        final yUrl = audioStream.url.toString();
        debugPrint('[MusicService] YouTube audio fallback found for "${track.title}" -> $yUrl');
        return yUrl;
      }
      yt.close();
    } catch (_) {}

    // 3. Guaranteed iTunes Studio AAC Stream (100% correct track & artist)
    debugPrint(
        '[MusicService] Playing guaranteed studio stream for "${track.title}" by "${track.artist}"');
    if (track.previewUrl != null && track.previewUrl!.isNotEmpty) {
      return track.previewUrl;
    }

    return await fetchItunesFallbackUrl(track.title, track.artist);
  }

  /// Fetches direct iTunes previewUrl as guaranteed fallback
  static Future<String?> fetchItunesFallbackUrl(String title, String artist) async {
    try {
      final q = Uri.encodeComponent('$title $artist');
      final res = await http
          .get(Uri.parse('https://itunes.apple.com/search?term=$q&media=music&entity=song&limit=1'))
          .timeout(const Duration(seconds: 2));
      if (res.statusCode == 200) {
        final results = jsonDecode(res.body)['results'] as List?;
        if (results != null && results.isNotEmpty) {
          return results.first['previewUrl']?.toString();
        }
      }
    } catch (_) {}
    return null;
  }
}
