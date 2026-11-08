import 'dart:io';
import 'package:flutter/material.dart';
import 'package:audio_session/audio_session.dart';
import 'package:just_audio/just_audio.dart';
import '../constants.dart';
import '../models/track.dart';
import 'library_service.dart';
import 'music_service.dart';

enum AudioRepeatMode { off, all, one }

class PlayerController extends ChangeNotifier {
  static final PlayerController instance = PlayerController._internal();

  PlayerController._internal() {
    _initListeners();
  }

  final AudioPlayer _audioPlayer = AudioPlayer();
  AudioPlayer get audioPlayer => _audioPlayer;
  AudioPlayer get player => _audioPlayer;

  Track? currentTrack;
  bool isPlaying = false;
  bool isLoading = false;
  String? errorMessage;

  bool get isBuffering => isLoading;

  Duration _position = Duration.zero;
  Duration get position => _position;

  Duration _duration = Duration.zero;
  Duration get duration => _duration;

  String _playerStatus = 'Ready';
  String get playerStatus => _playerStatus;

  List<Track> _queue = [];
  List<Track> get queue => List.unmodifiable(_queue);

  int _currentIndex = -1;
  int get currentIndex => _currentIndex;

  bool _isShuffle = false;
  bool get isShuffle => _isShuffle;

  AudioRepeatMode _repeatMode = AudioRepeatMode.off;
  AudioRepeatMode get repeatMode => _repeatMode;

  final Set<String> _playedKeys = {};

  void _initListeners() {
    try {
      AudioSession.instance.then((session) {
        session.configure(const AudioSessionConfiguration.music());
      });
    } catch (_) {}

    // Listen to player state changes
    _audioPlayer.playerStateStream.listen((state) {
      isPlaying = state.playing;
      isLoading = state.processingState == ProcessingState.buffering ||
          state.processingState == ProcessingState.loading;

      if (state.processingState == ProcessingState.completed) {
        _handleTrackCompletion();
      }
      notifyListeners();
    });

    // Listen to position changes
    _audioPlayer.positionStream.listen((pos) {
      _position = pos;
      notifyListeners();
    });

    // Listen to duration changes
    _audioPlayer.durationStream.listen((dur) {
      if (dur != null) {
        _duration = dur;
        notifyListeners();
      }
    });
  }

  Future<void> init() async {
    // Listeners are initialized in the constructor
  }

  /// Exact playback pipeline:
  /// - NO stop() before setUrl() to prevent race conditions
  /// - NO custom headers in setUrl() to avoid CORS/CDN preflight failures
  /// - unawaited play() after state updates so execution is never blocked
  Future<void> playTrack(Track track, {List<Track>? newQueue}) async {
    currentTrack = track;
    isLoading = true;
    errorMessage = null;
    _position = Duration.zero;
    _duration = Duration(seconds: track.duration > 0 ? track.duration : 180);
    _playerStatus = 'Resolving stream...';
    notifyListeners();

    // Queue management
    if (newQueue != null && newQueue.isNotEmpty) {
      _queue = List.from(newQueue);
      _currentIndex = _queue.indexWhere((t) => t.id == track.id);
      if (_currentIndex == -1) {
        _queue.insert(0, track);
        _currentIndex = 0;
      }
    } else {
      if (_queue.isEmpty) {
        _queue = [track];
        _currentIndex = 0;
      } else {
        final existingIndex = _queue.indexWhere((t) => t.id == track.id);
        if (existingIndex != -1) {
          _currentIndex = existingIndex;
        } else {
          _queue.add(track);
          _currentIndex = _queue.length - 1;
        }
      }
    }

    final trackKey = '${track.title.toLowerCase()}__${track.artist.toLowerCase()}';
    _playedKeys.add(trackKey);
    LibraryService.instance.recordRecentlyPlayed(track);

    // 0. Offline Storage Playback if local file exists
    if (track.localFilePath != null &&
        track.localFilePath!.isNotEmpty &&
        File(track.localFilePath!).existsSync()) {
      try {
        await _audioPlayer.setFilePath(track.localFilePath!);
        isLoading = false;
        isPlaying = true;
        _playerStatus = 'Playing (Offline)';
        notifyListeners();
        _audioPlayer.play();
        return;
      } catch (e) {
        debugPrint('Local file playback error ($e), falling back to online stream...');
      }
    }

    try {
      String? finalUrl;

      // 1. Direct Stream Binding:
      // If track already has a direct 320kbps saavncdn stream, play it immediately!
      if (track.streamUrl.isNotEmpty && track.streamUrl.contains('saavncdn.com')) {
        finalUrl = track.streamUrl;
      } else if (track.previewUrl != null && track.previewUrl!.contains('saavncdn.com')) {
        finalUrl = track.previewUrl;
      } else {
        // Resolve best stream URL with strict timeout
        finalUrl = await MusicService.resolveStreamUrl(track)
            .timeout(const Duration(milliseconds: 3000), onTimeout: () => track.previewUrl);
      }

      if (finalUrl == null || finalUrl.isEmpty) {
        finalUrl = track.previewUrl;
      }

      if (finalUrl == null || finalUrl.isEmpty) {
        throw Exception('No playable stream URL found');
      }

      debugPrint('PLAYING TRACK: ${track.title} by ${track.artist} -> URL: $finalUrl');

      // 2. Load into just_audio WITHOUT stop() and WITHOUT custom headers
      try {
        await _audioPlayer.setUrl(finalUrl);
      } catch (firstErr) {
        debugPrint('Primary stream failed ($firstErr), falling back to iTunes AAC...');
        // Guaranteed fallback to iTunes m4a previewUrl if primary URL fails
        final fallbackUrl = (track.previewUrl != null && track.previewUrl!.isNotEmpty)
            ? track.previewUrl!
            : await MusicService.fetchItunesFallbackUrl(track.title, track.artist);
        if (fallbackUrl == null || fallbackUrl.isEmpty) rethrow;
        debugPrint('PLAYING FALLBACK: ${track.title} by ${track.artist} -> URL: $fallbackUrl');
        await _audioPlayer.setUrl(fallbackUrl);
        finalUrl = fallbackUrl;
      }

      isLoading = false;
      isPlaying = true;
      _playerStatus = finalUrl.contains('aac.saavncdn.com') ? 'Playing 320kbps' : 'Playing Studio AAC';
      notifyListeners();

      // 3. Fire play() without blocking UI updates
      _audioPlayer.play();
    } catch (e) {
      debugPrint('Playback error: $e');
      isLoading = false;
      isPlaying = false;
      errorMessage = e.toString();
      _playerStatus = 'Playback error';
      notifyListeners();

      rootScaffoldMessengerKey.currentState?.removeCurrentSnackBar();
      rootScaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text('Playback error: ${track.title}'),
          backgroundColor: AppConstants.primaryNeon,
          duration: const Duration(seconds: 3),
        ),
      );
    }
  }

  void togglePlayPause() {
    if (isPlaying) {
      _audioPlayer.pause();
    } else {
      _audioPlayer.play();
    }
  }

  void pause() {
    _audioPlayer.pause();
  }

  void resume() {
    _audioPlayer.play();
  }

  void seek(Duration pos) {
    _audioPlayer.seek(pos);
  }

  void nextTrack() {
    if (_queue.isEmpty) return;

    if (_repeatMode == AudioRepeatMode.one && currentTrack != null) {
      playTrack(currentTrack!);
      return;
    }

    int nextIndex = _currentIndex + 1;
    if (_isShuffle && _queue.length > 1) {
      final unplayed = <int>[];
      for (int i = 0; i < _queue.length; i++) {
        final key = '${_queue[i].title.toLowerCase()}__${_queue[i].artist.toLowerCase()}';
        if (!_playedKeys.contains(key)) unplayed.add(i);
      }
      if (unplayed.isNotEmpty) {
        nextIndex = (unplayed..shuffle()).first;
      } else {
        nextIndex = (_currentIndex + 1) % _queue.length;
      }
    } else if (nextIndex >= _queue.length) {
      if (_repeatMode == AudioRepeatMode.all) {
        nextIndex = 0;
      } else {
        return; // End of queue
      }
    }

    _currentIndex = nextIndex;
    playTrack(_queue[_currentIndex]);
  }

  void previousTrack() {
    if (_queue.isEmpty) return;

    if (_position.inSeconds > 3) {
      seek(Duration.zero);
      return;
    }

    int prevIndex = _currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = _queue.length - 1;
    }

    _currentIndex = prevIndex;
    playTrack(_queue[_currentIndex]);
  }

  void toggleShuffle() {
    _isShuffle = !_isShuffle;
    notifyListeners();
  }

  void toggleRepeat() {
    if (_repeatMode == AudioRepeatMode.off) {
      _repeatMode = AudioRepeatMode.all;
    } else if (_repeatMode == AudioRepeatMode.all) {
      _repeatMode = AudioRepeatMode.one;
    } else {
      _repeatMode = AudioRepeatMode.off;
    }
    notifyListeners();
  }

  void _handleTrackCompletion() {
    nextTrack();
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    super.dispose();
  }
}
