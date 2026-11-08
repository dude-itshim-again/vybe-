import 'dart:ui';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import '../constants.dart';
import '../screens/lyrics_stage_screen.dart';
import '../services/library_service.dart';
import '../services/player_controller.dart';

class MiniPlayer extends StatelessWidget {
  const MiniPlayer({super.key});

  String _formatTime(Duration d) {
    final m = d.inMinutes;
    final s = d.inSeconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final player = PlayerController.instance;
    final library = LibraryService.instance;

    return ListenableBuilder(
      listenable: Listenable.merge([player, library]),
      builder: (context, _) {
        final track = player.currentTrack;
        if (track == null) return const SizedBox.shrink();

        final totalSec = player.duration.inSeconds > 0
            ? player.duration.inSeconds
            : (track.duration > 0 ? track.duration : 180);
        final currentSec = player.position.inSeconds;
        final progress = (totalSec > 0) ? (currentSec / totalSec).clamp(0.0, 1.0) : 0.0;
        final isLiked = library.isFavorite(track.id);

        return RepaintBoundary(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: GestureDetector(
              onTap: () {
                Navigator.of(context).push(
                  PageRouteBuilder(
                    pageBuilder: (context, anim, secAnim) => const LyricsStageScreen(),
                    transitionsBuilder: (context, anim, secAnim, child) {
                      const begin = Offset(0.0, 1.0);
                      const end = Offset.zero;
                      final curve = CurvedAnimation(parent: anim, curve: Curves.easeOutCubic);
                      return SlideTransition(position: Tween(begin: begin, end: end).animate(curve), child: child);
                    },
                  ),
                );
              },
              child: ClipRRect(
                borderRadius: BorderRadius.circular(999), // Sleek floating pill geometry
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                  child: Container(
                    height: 64,
                    decoration: BoxDecoration(
                      color: AppConstants.surfaceDark.withValues(alpha: 0.88),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.12), width: 1),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.65),
                          blurRadius: 24,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Stack(
                      children: [
                        // Top Thin Progress Indicator
                        Positioned(
                          top: 0,
                          left: 20,
                          right: 20,
                          height: 2.5,
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(2),
                            child: LinearProgressIndicator(
                              value: progress,
                              backgroundColor: Colors.white.withValues(alpha: 0.08),
                              valueColor: const AlwaysStoppedAnimation<Color>(AppConstants.primaryNeon),
                            ),
                          ),
                        ),

                        // Pill Content
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          child: Row(
                            children: [
                              // 44x44 Rounded Album Artwork
                              ClipRRect(
                                borderRadius: BorderRadius.circular(999),
                                child: CachedNetworkImage(
                                  imageUrl: track.artworkUrl.isNotEmpty
                                      ? track.artworkUrl
                                      : AppConstants.fallbackArtwork,
                                  width: 44,
                                  height: 44,
                                  fit: BoxFit.cover,
                                  memCacheWidth: 150,
                                  placeholder: (c, u) => Container(
                                    width: 44,
                                    height: 44,
                                    color: AppConstants.surfaceCard,
                                  ),
                                  errorWidget: (c, u, e) => Container(
                                    width: 44,
                                    height: 44,
                                    color: AppConstants.surfaceCard,
                                    child: const Icon(CupertinoIcons.music_note, color: Colors.white54, size: 20),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),

                              // Track Title & Artist
                              Expanded(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      track.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        color: AppConstants.textPrimary,
                                        fontSize: 13.5,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: -0.2,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Row(
                                      children: [
                                        if (player.playerStatus.contains('320kbps') || player.playerStatus.contains('Offline'))
                                          Container(
                                            margin: const EdgeInsets.only(right: 6),
                                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                            decoration: BoxDecoration(
                                              color: AppConstants.primaryNeon.withValues(alpha: 0.2),
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              player.playerStatus.contains('Offline') ? 'OFFLINE' : '320K',
                                              style: const TextStyle(
                                                color: AppConstants.primaryNeon,
                                                fontSize: 9,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                          ),
                                        Expanded(
                                          child: Text(
                                            player.isBuffering
                                                ? player.playerStatus
                                                : '${track.artist}  •  ${_formatTime(player.position)}',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              color: player.isBuffering
                                                  ? AppConstants.primaryNeon
                                                  : AppConstants.textSecondary,
                                              fontSize: 11.5,
                                              fontWeight: player.isBuffering ? FontWeight.w600 : FontWeight.normal,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),

                              // Heart Button
                              IconButton(
                                icon: Icon(
                                  isLiked ? CupertinoIcons.heart_fill : CupertinoIcons.heart,
                                  color: isLiked ? AppConstants.primaryNeon : Colors.white54,
                                  size: 18,
                                ),
                                onPressed: () => library.toggleFavorite(track),
                                visualDensity: VisualDensity.compact,
                              ),

                              // Glowing Circular Play/Pause (Matches laptop Vybe w-10 h-10)
                              GestureDetector(
                                onTap: player.togglePlayPause,
                                child: Container(
                                  width: 36,
                                  height: 36,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: Colors.white,
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.white.withValues(alpha: 0.35),
                                        blurRadius: 12,
                                      ),
                                    ],
                                  ),
                                  child: Center(
                                    child: player.isBuffering
                                        ? const SizedBox(
                                            width: 16,
                                            height: 16,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              valueColor: AlwaysStoppedAnimation(Colors.black),
                                            ),
                                          )
                                        : Icon(
                                            player.isPlaying
                                                ? CupertinoIcons.pause_fill
                                                : CupertinoIcons.play_fill,
                                            color: Colors.black,
                                            size: 18,
                                          ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 4),

                              // Next Button
                              IconButton(
                                icon: const Icon(
                                  CupertinoIcons.forward_fill,
                                  color: Colors.white70,
                                  size: 18,
                                ),
                                onPressed: player.nextTrack,
                                visualDensity: VisualDensity.compact,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
