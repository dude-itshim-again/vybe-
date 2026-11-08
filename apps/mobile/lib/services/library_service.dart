import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/track.dart';
import 'music_service.dart';

class LibraryService extends ChangeNotifier {
  static final LibraryService instance = LibraryService._internal();
  LibraryService._internal();

  bool isHydrated = false;

  List<Track> _favorites = [];
  List<Playlist> _playlists = [];
  List<Track> _downloads = [];
  List<Track> _recentlyPlayed = [];
  Track? _lastPlayedTrack;

  List<Track> get favorites => List.unmodifiable(_favorites);
  List<Playlist> get playlists => List.unmodifiable(_playlists);
  List<Track> get downloads => List.unmodifiable(_downloads);
  List<Track> get recentlyPlayed => List.unmodifiable(_recentlyPlayed);
  Track? get lastPlayedTrack => _lastPlayedTrack;

  File? _libraryFile;
  Directory? _downloadsDir;

  Future<void> init() async {
    if (isHydrated) return;

    try {
      final appDir = await getApplicationDocumentsDirectory();
      _libraryFile = File('${appDir.path}/vybe_mobile_library.json');
      _downloadsDir = Directory('${appDir.path}/VybeDownloads');

      if (!await _downloadsDir!.exists()) {
        await _downloadsDir!.create(recursive: true);
      }

      // 1. Load from local JSON disk file
      if (await _libraryFile!.exists()) {
        final content = await _libraryFile!.readAsString();
        if (content.isNotEmpty) {
          final data = jsonDecode(content);
          _parseLibraryData(data);
        }
      }

      // 2. Fallback to SharedPreferences if disk file was empty
      if (_favorites.isEmpty && _playlists.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        final rawPrefs = prefs.getString('vybe_library_backup');
        if (rawPrefs != null && rawPrefs.isNotEmpty) {
          _parseLibraryData(jsonDecode(rawPrefs));
        }
      }

      // 3. Verify downloads exist on disk
      await _validateDownloadsOnDisk();

      // 4. Mark hydration complete immediately so UI has local data
      isHydrated = true;
      notifyListeners();

      // 5. Background Supabase sync (non-blocking, never stalls startup)
      syncFromSupabase();
    } catch (e) {
      isHydrated = true;
      notifyListeners();
    }
  }

  void _parseLibraryData(Map<String, dynamic> data) {
    if (data['favorites'] is List) {
      _favorites = (data['favorites'] as List)
          .map((i) => Track.fromJson(i as Map<String, dynamic>))
          .toList();
    }

    if (data['playlists'] is List) {
      _playlists = (data['playlists'] as List)
          .map((i) => Playlist.fromJson(i as Map<String, dynamic>))
          .toList();
    }

    if (data['downloads'] is List) {
      _downloads = (data['downloads'] as List)
          .map((i) => Track.fromJson(i as Map<String, dynamic>))
          .toList();
    }

    if (data['recentlyPlayed'] is List) {
      _recentlyPlayed = (data['recentlyPlayed'] as List)
          .map((i) => Track.fromJson(i as Map<String, dynamic>))
          .toList();
    }

    if (data['lastPlayedTrack'] is Map<String, dynamic>) {
      _lastPlayedTrack = Track.fromJson(data['lastPlayedTrack']);
    }
  }

  Future<void> _validateDownloadsOnDisk() async {
    final List<Track> valid = [];
    for (final track in _downloads) {
      if (track.localFilePath != null) {
        final file = File(track.localFilePath!);
        if (await file.exists()) {
          final length = await file.length();
          valid.add(track.copyWith(isDownloaded: true, fileSize: length));
        }
      }
    }
    _downloads = valid;
  }

  /// Persists current library state to disk JSON, SharedPreferences, and Supabase
  Future<void> _persist() async {
    if (!isHydrated) return; // Prevent overwriting during unhydrated boot

    final payload = {
      'favorites': _favorites.map((t) => t.toJson()).toList(),
      'playlists': _playlists.map((p) => p.toJson()).toList(),
      'downloads': _downloads.map((t) => t.toJson()).toList(),
      'recentlyPlayed': _recentlyPlayed.map((t) => t.toJson()).toList(),
      'lastPlayedTrack': _lastPlayedTrack?.toJson(),
      'updatedAt': DateTime.now().toIso8601String(),
    };

    final jsonStr = jsonEncode(payload);

    // Save to permanent disk JSON
    if (_libraryFile != null) {
      try {
        await _libraryFile!.writeAsString(jsonStr);
      } catch (_) {}
    }

    // Save to SharedPreferences backup
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('vybe_library_backup', jsonStr);
    } catch (_) {}

    // Push to Supabase if authenticated
    await syncToSupabase();

    notifyListeners();
  }

  /// Toggle Favorite Track
  Future<void> toggleFavorite(Track track) async {
    final index = _favorites.indexWhere((t) => t.id == track.id);
    if (index >= 0) {
      _favorites.removeAt(index);
    } else {
      _favorites.insert(0, track.copyWith(isLiked: true));
    }
    await _persist();
  }

  bool isFavorite(String trackId) {
    return _favorites.any((t) => t.id == trackId);
  }

  /// Add to recently played
  Future<void> recordRecentlyPlayed(Track track) async {
    _lastPlayedTrack = track;
    _recentlyPlayed.removeWhere((t) => t.id == track.id);
    _recentlyPlayed.insert(0, track);
    if (_recentlyPlayed.length > 50) {
      _recentlyPlayed = _recentlyPlayed.sublist(0, 50);
    }
    await _persist();
  }

  /// Playlist Management
  Future<Playlist> createPlaylist(String name, [String description = '']) async {
    final playlist = Playlist(
      id: 'pl-${DateTime.now().millisecondsSinceEpoch}',
      name: name.trim().isNotEmpty ? name.trim() : 'New Playlist',
      description: description.trim(),
      tracks: [],
    );
    _playlists.insert(0, playlist);
    await _persist();
    return playlist;
  }

  Future<void> addTrackToPlaylist(String playlistId, Track track) async {
    final index = _playlists.indexWhere((p) => p.id == playlistId);
    if (index >= 0) {
      final current = _playlists[index];
      if (!current.tracks.any((t) => t.id == track.id)) {
        final updatedTracks = List<Track>.from(current.tracks)..add(track);
        _playlists[index] = current.copyWith(tracks: updatedTracks);
        await _persist();
      }
    }
  }

  Future<void> removeTrackFromPlaylist(String playlistId, String trackId) async {
    final index = _playlists.indexWhere((p) => p.id == playlistId);
    if (index >= 0) {
      final current = _playlists[index];
      final updatedTracks = current.tracks.where((t) => t.id != trackId).toList();
      _playlists[index] = current.copyWith(tracks: updatedTracks);
      await _persist();
    }
  }

  Future<void> deletePlaylist(String playlistId) async {
    _playlists.removeWhere((p) => p.id == playlistId);
    await _persist();
  }

  /// Real Offline Song Downloader
  Future<bool> downloadTrack(Track track, {Function(double progress)? onProgress}) async {
    try {
      if (_downloadsDir == null) {
        final appDir = await getApplicationDocumentsDirectory();
        _downloadsDir = Directory('${appDir.path}/VybeDownloads');
        if (!await _downloadsDir!.exists()) {
          await _downloadsDir!.create(recursive: true);
        }
      }

      // Check if already downloaded
      final cleanId = track.id.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
      final targetPath = '${_downloadsDir!.path}/$cleanId.m4a';
      final file = File(targetPath);

      if (await file.exists() && await file.length() > 50000) {
        final length = await file.length();
        final downloadedTrack = track.copyWith(
          localFilePath: targetPath,
          isDownloaded: true,
          fileSize: length,
        );
        _downloads.removeWhere((t) => t.id == track.id);
        _downloads.insert(0, downloadedTrack);
        await _persist();
        return true;
      }

      // Resolve stream URL
      String? streamUrl = track.streamUrl;
      if (streamUrl.isEmpty || !streamUrl.startsWith('http')) {
        streamUrl = await MusicService.resolveStreamUrl(track);
      }

      if (streamUrl == null || !streamUrl.startsWith('http')) {
        return false;
      }

      final dio = Dio();
      await dio.download(
        streamUrl,
        targetPath,
        onReceiveProgress: (received, total) {
          if (total > 0 && onProgress != null) {
            onProgress(received / total);
          }
        },
      );

      final length = await file.length();
      final downloadedTrack = track.copyWith(
        localFilePath: targetPath,
        isDownloaded: true,
        fileSize: length,
      );

      _downloads.removeWhere((t) => t.id == track.id);
      _downloads.insert(0, downloadedTrack);
      await _persist();
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Remove Offline Download
  Future<void> removeDownload(Track track) async {
    if (track.localFilePath != null) {
      final file = File(track.localFilePath!);
      if (await file.exists()) {
        try {
          await file.delete();
        } catch (_) {}
      }
    }
    _downloads.removeWhere((t) => t.id == track.id);
    await _persist();
  }

  /// Total downloaded storage size in Megabytes
  double get totalDownloadSizeMb {
    int totalBytes = 0;
    for (final track in _downloads) {
      totalBytes += track.fileSize;
    }
    return totalBytes / (1024 * 1024);
  }

  /// Supabase Synchronization (Silently handles offline & AuthRetryableFetchException)
  Future<void> syncFromSupabase() async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      final response = await Supabase.instance.client
          .from('user_library')
          .select('liked_tracks, playlists, recently_played, last_played_track')
          .eq('user_id', user.id)
          .maybeSingle()
          .timeout(const Duration(seconds: 3));

      if (response != null) {
        // Merge liked tracks
        if (response['liked_tracks'] is List) {
          final remoteLiked = (response['liked_tracks'] as List)
              .map((i) => Track.fromJson(i as Map<String, dynamic>))
              .toList();
          for (final track in remoteLiked) {
            if (!_favorites.any((t) => t.id == track.id)) {
              _favorites.add(track.copyWith(isLiked: true));
            }
          }
        }

        // Merge playlists
        if (response['playlists'] is List) {
          final remotePlaylists = (response['playlists'] as List)
              .map((i) => Playlist.fromJson(i as Map<String, dynamic>))
              .toList();
          for (final pl in remotePlaylists) {
            if (!_playlists.any((p) => p.id == pl.id)) {
              _playlists.add(pl);
            }
          }
        }

        // Update recently played
        if (_recentlyPlayed.isEmpty && response['recently_played'] is List) {
          _recentlyPlayed = (response['recently_played'] as List)
              .map((i) => Track.fromJson(i as Map<String, dynamic>))
              .toList();
        }

        // Update last played
        if (_lastPlayedTrack == null && response['last_played_track'] is Map<String, dynamic>) {
          _lastPlayedTrack = Track.fromJson(response['last_played_track']);
        }

        await _persist();
      }
    } catch (_) {
      // Offline / network failure caught silently
    }
  }

  Future<void> syncToSupabase() async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      final payload = {
        'user_id': user.id,
        'email': user.email,
        'liked_tracks': _favorites.map((t) => t.toJson()).toList(),
        'playlists': _playlists.map((p) => p.toJson()).toList(),
        'recently_played': _recentlyPlayed.map((t) => t.toJson()).toList(),
        'last_played_track': _lastPlayedTrack?.toJson(),
        'updated_at': DateTime.now().toIso8601String(),
      };

      await Supabase.instance.client
          .from('user_library')
          .upsert(payload, onConflict: 'user_id')
          .timeout(const Duration(seconds: 3));
    } catch (_) {
      // Offline / network failure caught silently
    }
  }
}

