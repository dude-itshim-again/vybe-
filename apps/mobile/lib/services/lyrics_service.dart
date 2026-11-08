import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import '../models/lyric_line.dart';
import '../models/track.dart';
import 'music_service.dart';

class LyricsService {
  static final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(milliseconds: 5000),
    receiveTimeout: const Duration(milliseconds: 5000),
    headers: {
      'User-Agent': 'VybeMobile/1.0 (https://github.com/sahilrut/vybe)',
    },
  ));

  static final Map<String, LyricTrack> _memoryCache = {};
  static final Map<String, Future<LyricTrack?>> _pendingRequests = {};
  static Directory? _cacheDir;

  static Future<void> _initCacheDir() async {
    if (_cacheDir == null) {
      final appDir = await getApplicationDocumentsDirectory();
      _cacheDir = Directory('${appDir.path}/vybe_lyrics');
      if (!await _cacheDir!.exists()) {
        await _cacheDir!.create(recursive: true);
      }
    }
  }

  /// Single-flight, debounced, disk-cached synced lyrics fetcher
  static Future<LyricTrack?> getLyrics(Track track) async {
    final cacheKey = track.id.isNotEmpty
        ? track.id
        : '${MusicService.normalize(track.title)}__${MusicService.normalize(track.artist)}';

    // 1. In-memory cache hit
    if (_memoryCache.containsKey(cacheKey)) {
      return _memoryCache[cacheKey];
    }

    // 2. Disk cache hit
    await _initCacheDir();
    final file = File('${_cacheDir!.path}/$cacheKey.json');
    if (await file.exists()) {
      try {
        final content = await file.readAsString();
        final json = jsonDecode(content);
        final lines = (json['lines'] as List)
            .map((l) => LyricLine.fromJson(l as Map<String, dynamic>))
            .toList();
        final lyricTrack = LyricTrack(
          trackId: track.id,
          title: track.title,
          artist: track.artist,
          lines: lines,
          offsetSeconds: (json['offsetSeconds'] as num?)?.toDouble() ?? 0.0,
        );
        _memoryCache[cacheKey] = lyricTrack;
        return lyricTrack;
      } catch (_) {}
    }

    // 3. Single-flight pending request deduplication
    if (_pendingRequests.containsKey(cacheKey)) {
      return _pendingRequests[cacheKey];
    }

    final future = _fetchFromLRCLIB(track, cacheKey);
    _pendingRequests[cacheKey] = future;

    try {
      final result = await future;
      return result;
    } finally {
      _pendingRequests.remove(cacheKey);
    }
  }

  static Future<LyricTrack?> _fetchFromLRCLIB(Track track, String cacheKey) async {
    try {
      final cleanTitle = MusicService.cleanText(track.title);
      final primaryArtist = MusicService.extractPrimaryArtist(track.artist);

      // Stage 1: Exact search with track_name and artist_name
      final url =
          'https://lrclib.net/api/get?track_name=${Uri.encodeComponent(cleanTitle)}&artist_name=${Uri.encodeComponent(primaryArtist)}&duration=${track.duration}';
      
      Response response;
      try {
        response = await _dio.get(url);
      } catch (e) {
        // Fallback Stage 2: Keyword search
        final searchUrl =
            'https://lrclib.net/api/search?q=${Uri.encodeComponent("$primaryArtist $cleanTitle")}';
        response = await _dio.get(searchUrl);
      }

      String? syncedLyrics;
      String? plainLyrics;

      if (response.statusCode == 200 && response.data != null) {
        if (response.data is Map) {
          syncedLyrics = response.data['syncedLyrics'] as String?;
          plainLyrics = response.data['plainLyrics'] as String?;
        } else if (response.data is List && (response.data as List).isNotEmpty) {
          final first = (response.data as List).first;
          if (first is Map) {
            syncedLyrics = first['syncedLyrics'] as String?;
            plainLyrics = first['plainLyrics'] as String?;
          }
        }
      }

      List<LyricLine> lines = [];

      if (syncedLyrics != null && syncedLyrics.isNotEmpty) {
        lines = parseSyncedLyrics(syncedLyrics);
      } else if (plainLyrics != null && plainLyrics.isNotEmpty) {
        lines = parsePlainLyrics(plainLyrics, track.duration);
      }

      if (lines.isNotEmpty) {
        final lyricTrack = LyricTrack(
          trackId: track.id,
          title: track.title,
          artist: track.artist,
          lines: lines,
        );

        // Store in memory cache
        _memoryCache[cacheKey] = lyricTrack;

        // Persist to disk cache
        try {
          await _initCacheDir();
          final saveFile = File('${_cacheDir!.path}/$cacheKey.json');
          final jsonToSave = {
            'trackId': track.id,
            'title': track.title,
            'artist': track.artist,
            'offsetSeconds': 0.0,
            'lines': lines.map((l) => l.toJson()).toList(),
          };
          await saveFile.writeAsString(jsonEncode(jsonToSave));
        } catch (_) {}

        return lyricTrack;
      }
    } catch (_) {}

    return null;
  }

  /// Parses synced LRC lyrics with regex timestamp stripping
  /// Preserves parenthetical notes, e.g. "(Chorus)" or "(Yeah)"
  static List<LyricLine> parseSyncedLyrics(String lrcText) {
    final List<LyricLine> lines = [];
    final rawLines = lrcText.split('\n');

    // Matches [mm:ss.xx] or [mm:ss.xxx]
    final timestampRegex = RegExp(r'^\s*\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$');

    for (final line in rawLines) {
      final match = timestampRegex.firstMatch(line);
      if (match != null) {
        final minutes = int.tryParse(match.group(1) ?? '0') ?? 0;
        final seconds = int.tryParse(match.group(2) ?? '0') ?? 0;
        final msStr = match.group(3) ?? '0';
        final ms = int.tryParse(msStr.padRight(3, '0').substring(0, 3)) ?? 0;

        final startTime = (minutes * 60) + seconds + (ms / 1000.0);
        final text = match.group(4)?.trim() ?? '';

        if (text.isNotEmpty) {
          lines.add(LyricLine(
            startTime: startTime,
            endTime: startTime + 3.0, // Initial estimate, updated below
            text: text,
          ));
        }
      }
    }

    // Sort chronologically and calibrate end times
    lines.sort((a, b) => a.startTime.compareTo(b.startTime));
    for (int i = 0; i < lines.length; i++) {
      if (i < lines.length - 1) {
        final nextStart = lines[i + 1].startTime;
        final duration = nextStart - lines[i].startTime;
        lines[i] = LyricLine(
          startTime: lines[i].startTime,
          endTime: lines[i].startTime + (duration > 0 ? duration : 3.0),
          text: lines[i].text,
        );
      }
    }

    return lines;
  }

  /// Fallback: Synthesize evenly spaced lines from plain lyrics
  static List<LyricLine> parsePlainLyrics(String plainText, int totalDurationSec) {
    final rawLines = plainText
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();

    if (rawLines.isEmpty) return [];

    final duration = totalDurationSec > 0 ? totalDurationSec : 180;
    final interval = duration / rawLines.length;

    final List<LyricLine> lines = [];
    for (int i = 0; i < rawLines.length; i++) {
      final start = i * interval;
      lines.add(LyricLine(
        startTime: start,
        endTime: start + interval,
        text: rawLines[i],
      ));
    }
    return lines;
  }
}

