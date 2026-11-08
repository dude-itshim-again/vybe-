import 'dart:ui';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import '../constants.dart';
import '../models/lyric_line.dart';
import '../services/library_service.dart';
import '../services/lyrics_service.dart';
import '../services/player_controller.dart';

enum LyricsViewMode { auto, kinetic, cascade }
enum LyricsBgMode { album, black }

class LyricsStageScreen extends StatefulWidget {
  const LyricsStageScreen({super.key});

  @override
  State<LyricsStageScreen> createState() => _LyricsStageScreenState();
}

class _LyricsStageScreenState extends State<LyricsStageScreen> {
  final ScrollController _scrollController = ScrollController();
  LyricTrack? _lyricTrack;
  bool _isLoadingLyrics = true;
  String? _loadedForTrackId;
  double _userOffsetNudge = 0.0;
  int _lastActiveIndex = -1;

  LyricsViewMode _viewMode = LyricsViewMode.kinetic;
  LyricsBgMode _bgMode = LyricsBgMode.album;

  @override
  void initState() {
    super.initState();
    _fetchLyricsForCurrentTrack();
    PlayerController.instance.addListener(_onPlayerTick);
  }

  @override
  void dispose() {
    PlayerController.instance.removeListener(_onPlayerTick);
    _scrollController.dispose();
    super.dispose();
  }

  void _onPlayerTick() {
    final player = PlayerController.instance;
    final track = player.currentTrack;

    if (track != null && track.id != _loadedForTrackId) {
      _fetchLyricsForCurrentTrack();
      return;
    }

    if (_lyricTrack != null && _lyricTrack!.lines.isNotEmpty) {
      final currentSec = player.position.inMilliseconds / 1000.0 + _userOffsetNudge;
      final activeIndex = _lyricTrack!.lines.indexWhere(
        (l) => l.startTime <= currentSec && l.endTime > currentSec,
      );

      if (activeIndex != -1 && activeIndex != _lastActiveIndex) {
        _lastActiveIndex = activeIndex;
        _scrollToActiveLine(activeIndex);
      }
    }
  }

  void _scrollToActiveLine(int index) {
    if (!_scrollController.hasClients) return;
    const itemHeight = 65.0;
    final targetOffset = (index * itemHeight) - 160.0;
    _scrollController.animateTo(
      targetOffset.clamp(0.0, _scrollController.position.maxScrollExtent),
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOutCubic,
    );
  }

  Future<void> _fetchLyricsForCurrentTrack() async {
    final track = PlayerController.instance.currentTrack;
    if (track == null) return;

    setState(() {
      _isLoadingLyrics = true;
      _loadedForTrackId = track.id;
      _lastActiveIndex = -1;
    });

    final lyrics = await LyricsService.getLyrics(track);
    if (mounted) {
      setState(() {
        _lyricTrack = lyrics;
        _isLoadingLyrics = false;
        _userOffsetNudge = lyrics?.offsetSeconds ?? 0.0;
      });
    }
  }

  String _formatTime(Duration d) {
    final m = d.inMinutes;
    final s = d.inSeconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  Widget _buildToolbarPill(String label, bool isSelected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 6),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white.withValues(alpha: 0.16) : Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: isSelected ? AppConstants.primaryNeon.withValues(alpha: 0.6) : Colors.white.withValues(alpha: 0.1),
            width: 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : AppConstants.textMuted,
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final player = PlayerController.instance;
    final library = LibraryService.instance;
    final track = player.currentTrack;

    if (track == null) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(child: Text('No song playing', style: TextStyle(color: Colors.white))),
      );
    }

    final isFav = library.isFavorite(track.id);
    final isDownloaded = track.isDownloaded || library.downloads.any((d) => d.id == track.id);
    final isPureBlack = _bgMode == LyricsBgMode.black;

    return Scaffold(
      backgroundColor: isPureBlack ? Colors.black : AppConstants.bgDark,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Background Layer 1: Atmospheric Album Artwork or Pure Black
          if (!isPureBlack) ...[
            CachedNetworkImage(
              imageUrl: track.artworkUrl.isNotEmpty ? track.artworkUrl : AppConstants.fallbackArtwork,
              fit: BoxFit.cover,
              memCacheWidth: 400,
            ),
            BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 55, sigmaY: 55),
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.black.withValues(alpha: 0.75),
                      AppConstants.bgDark.withValues(alpha: 0.88),
                    ],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
              ),
            ),
          ],

          // Foreground Content
          SafeArea(
            child: Column(
              children: [
                // Top App Bar (Constrained with Expanded to prevent 124px overflow on narrow screens)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      IconButton(
                        icon: const Icon(CupertinoIcons.chevron_down, color: Colors.white, size: 26),
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                      Expanded(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              player.playerStatus.isNotEmpty
                                  ? player.playerStatus.toUpperCase()
                                  : 'VYBE STUDIO STAGE',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppConstants.primaryNeon,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.5,
                              ),
                            ),
                            const SizedBox(height: 1),
                            Text(
                              track.album.isNotEmpty ? track.album : 'Studio Audio',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: Icon(
                          isPureBlack ? CupertinoIcons.moon_fill : CupertinoIcons.moon,
                          color: isPureBlack ? AppConstants.primaryNeon : Colors.white70,
                          size: 20,
                        ),
                        tooltip: 'Pure Black OLED',
                        onPressed: () {
                          setState(() {
                            _bgMode = isPureBlack ? LyricsBgMode.album : LyricsBgMode.black;
                          });
                        },
                      ),
                    ],
                  ),
                ),

                // Top Pill Toolbar (Matching Laptop Vybe vks-top)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildToolbarPill('⚡ Auto', _viewMode == LyricsViewMode.auto, () {
                          setState(() => _viewMode = LyricsViewMode.auto);
                        }),
                        _buildToolbarPill('Kinetic Word', _viewMode == LyricsViewMode.kinetic, () {
                          setState(() => _viewMode = LyricsViewMode.kinetic);
                        }),
                        _buildToolbarPill('Split Cascade', _viewMode == LyricsViewMode.cascade, () {
                          setState(() => _viewMode = LyricsViewMode.cascade);
                        }),
                        const SizedBox(width: 8),
                        _buildToolbarPill('🖼 Album Cover', _bgMode == LyricsBgMode.album, () {
                          setState(() => _bgMode = LyricsBgMode.album);
                        }),
                        _buildToolbarPill('⚫ Pure Black', _bgMode == LyricsBgMode.black, () {
                          setState(() => _bgMode = LyricsBgMode.black);
                        }),
                        const SizedBox(width: 8),
                        // Nudge Offset
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.06),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              GestureDetector(
                                onTap: () => setState(() => _userOffsetNudge -= 0.5),
                                child: const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 4),
                                  child: Text('-0.5s', style: TextStyle(color: AppConstants.primaryNeon, fontSize: 11, fontWeight: FontWeight.bold)),
                                ),
                              ),
                              Text(
                                '${_userOffsetNudge >= 0 ? "+" : ""}${_userOffsetNudge.toStringAsFixed(1)}s',
                                style: const TextStyle(color: Colors.white70, fontSize: 11),
                              ),
                              GestureDetector(
                                onTap: () => setState(() => _userOffsetNudge += 0.5),
                                child: const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 4),
                                  child: Text('+0.5s', style: TextStyle(color: AppConstants.primaryNeon, fontSize: 11, fontWeight: FontWeight.bold)),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Center Stage Area
                Expanded(
                  child: _isLoadingLyrics
                      ? const Center(
                          child: CircularProgressIndicator(
                            valueColor: AlwaysStoppedAnimation(AppConstants.primaryNeon),
                          ),
                        )
                      : (_lyricTrack == null || _lyricTrack!.lines.isEmpty)
                          ? Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(20),
                                    child: CachedNetworkImage(
                                      imageUrl: track.artworkUrl.isNotEmpty
                                          ? track.artworkUrl
                                          : AppConstants.fallbackArtwork,
                                      width: 200,
                                      height: 200,
                                      fit: BoxFit.cover,
                                    ),
                                  ),
                                  const SizedBox(height: 20),
                                  const Text(
                                    'Instrumental / Studio Track',
                                    style: TextStyle(color: Colors.white70, fontSize: 16, fontWeight: FontWeight.w600),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    track.title,
                                    style: const TextStyle(color: AppConstants.textSecondary, fontSize: 13),
                                  ),
                                ],
                              ),
                            )
                          : _viewMode == LyricsViewMode.cascade
                              ? _buildSplitCascadeView(track, player)
                              : _buildKineticWordView(player),
                ),

                // Bottom Controls Dock (Exact clone of Laptop Vybe EditorialPlayerDock)
                Container(
                  margin: const EdgeInsets.fromLTRB(14, 0, 14, 12),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppConstants.surfaceDark.withValues(alpha: 0.92),
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.12), width: 1),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.7),
                        blurRadius: 30,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Song Meta & Heart
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  track.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${track.artist}${track.album.isNotEmpty ? " — ${track.album}" : ""}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: AppConstants.textSecondary,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: Icon(
                              isFav ? CupertinoIcons.heart_fill : CupertinoIcons.heart,
                              color: isFav ? AppConstants.primaryNeon : Colors.white60,
                              size: 22,
                            ),
                            onPressed: () => library.toggleFavorite(track),
                          ),
                          IconButton(
                            icon: Icon(
                              isDownloaded
                                  ? CupertinoIcons.checkmark_alt_circle_fill
                                  : CupertinoIcons.arrow_down_circle,
                              color: isDownloaded ? AppConstants.successGreen : Colors.white60,
                              size: 22,
                            ),
                            onPressed: isDownloaded ? null : () => library.downloadTrack(track),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),

                      // Interactive Scrubber Slider
                      RepaintBoundary(
                        child: Column(
                          children: [
                            SliderTheme(
                              data: SliderTheme.of(context).copyWith(
                                trackHeight: 3,
                                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                                overlayShape: const RoundSliderOverlayShape(overlayRadius: 12),
                                activeTrackColor: Colors.white,
                                inactiveTrackColor: Colors.white.withValues(alpha: 0.18),
                                thumbColor: Colors.white,
                              ),
                              child: Slider(
                                value: player.position.inSeconds
                                    .clamp(0, player.duration.inSeconds > 0 ? player.duration.inSeconds : 180)
                                    .toDouble(),
                                min: 0.0,
                                max: (player.duration.inSeconds > 0 ? player.duration.inSeconds : 180).toDouble(),
                                onChanged: (val) {
                                  player.seek(Duration(seconds: val.round()));
                                },
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 6),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    _formatTime(player.position),
                                    style: const TextStyle(color: Colors.white54, fontSize: 11, fontFamily: 'monospace'),
                                  ),
                                  Text(
                                    _formatTime(player.duration),
                                    style: const TextStyle(color: Colors.white54, fontSize: 11, fontFamily: 'monospace'),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 6),

                      // Playback Transport Bar
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          IconButton(
                            icon: Icon(
                              CupertinoIcons.shuffle,
                              color: player.isShuffle ? AppConstants.primaryNeon : Colors.white54,
                              size: 20,
                            ),
                            onPressed: player.toggleShuffle,
                          ),
                          IconButton(
                            icon: const Icon(CupertinoIcons.backward_fill, color: Colors.white, size: 24),
                            onPressed: player.previousTrack,
                          ),
                          // Glowing Circular Play/Pause (Matches laptop Vybe)
                          GestureDetector(
                            onTap: player.togglePlayPause,
                            child: Container(
                              width: 52,
                              height: 52,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: Colors.white,
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.white.withValues(alpha: 0.35),
                                    blurRadius: 16,
                                  ),
                                ],
                              ),
                              child: Center(
                                child: player.isBuffering
                                    ? const SizedBox(
                                        width: 22,
                                        height: 22,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          valueColor: AlwaysStoppedAnimation(Colors.black),
                                        ),
                                      )
                                    : Icon(
                                        player.isPlaying ? CupertinoIcons.pause_fill : CupertinoIcons.play_fill,
                                        color: Colors.black,
                                        size: 24,
                                      ),
                              ),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(CupertinoIcons.forward_fill, color: Colors.white, size: 24),
                            onPressed: player.nextTrack,
                          ),
                          IconButton(
                            icon: Icon(
                              player.repeatMode == AudioRepeatMode.one
                                  ? CupertinoIcons.repeat_1
                                  : CupertinoIcons.repeat,
                              color: player.repeatMode != AudioRepeatMode.off
                                  ? AppConstants.primaryNeon
                                  : Colors.white54,
                              size: 20,
                            ),
                            onPressed: player.toggleRepeat,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Kinetic Word / Conveyor Mode
  Widget _buildKineticWordView(PlayerController player) {
    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 70),
      itemCount: _lyricTrack!.lines.length,
      itemBuilder: (context, index) {
        final line = _lyricTrack!.lines[index];
        final currentSec = player.position.inMilliseconds / 1000.0 + _userOffsetNudge;
        final isActive = line.startTime <= currentSec && line.endTime > currentSec;
        final isPast = line.endTime <= currentSec;

        return GestureDetector(
          onTap: () {
            player.seek(Duration(milliseconds: (line.startTime * 1000).round()));
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text(
              line.text,
              style: TextStyle(
                color: isActive
                    ? Colors.white
                    : isPast
                        ? Colors.white.withValues(alpha: 0.32)
                        : Colors.white.withValues(alpha: 0.22),
                fontSize: isActive ? 24 : 18,
                fontWeight: isActive ? FontWeight.w800 : FontWeight.w600,
                letterSpacing: -0.3,
                height: 1.35,
              ),
            ),
          ),
        );
      },
    );
  }

  /// Split Cascade Mode: Left album thumbnail, Right scrolling lyrics
  Widget _buildSplitCascadeView(dynamic track, PlayerController player) {
    return Row(
      children: [
        // Left Column (36%): Album Artwork Thumbnail
        Container(
          width: 120,
          padding: const EdgeInsets.only(left: 20, top: 40),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: CachedNetworkImage(
                  imageUrl: track.artworkUrl.isNotEmpty ? track.artworkUrl : AppConstants.fallbackArtwork,
                  width: 100,
                  height: 100,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                track.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 2),
              Text(
                track.artist,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: AppConstants.textSecondary, fontSize: 11),
              ),
            ],
          ),
        ),

        // Right Column: Lyrics
        Expanded(
          child: ListView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 60),
            itemCount: _lyricTrack!.lines.length,
            itemBuilder: (context, index) {
              final line = _lyricTrack!.lines[index];
              final currentSec = player.position.inMilliseconds / 1000.0 + _userOffsetNudge;
              final isActive = line.startTime <= currentSec && line.endTime > currentSec;

              return GestureDetector(
                onTap: () {
                  player.seek(Duration(milliseconds: (line.startTime * 1000).round()));
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Text(
                    line.text,
                    style: TextStyle(
                      color: isActive ? Colors.white : Colors.white.withValues(alpha: 0.32),
                      fontSize: isActive ? 20 : 15,
                      fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                      height: 1.3,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
