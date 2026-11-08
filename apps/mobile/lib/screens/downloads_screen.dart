import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants.dart';
import '../services/library_service.dart';
import '../services/player_controller.dart';
import '../widgets/song_tile.dart';

class DownloadsScreen extends StatelessWidget {
  const DownloadsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final library = LibraryService.instance;

    return Scaffold(
      backgroundColor: AppConstants.bgDark,
      body: SafeArea(
        child: ListenableBuilder(
          listenable: library,
          builder: (context, _) {
            final downloads = library.downloads;
            final storageMb = library.totalDownloadSizeMb;

            return CustomScrollView(
              physics: const BouncingScrollPhysics(),
              slivers: [
                // 1. EDITORIAL HEADER
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Offline Vault',
                          style: GoogleFonts.newsreader(
                            color: Colors.white,
                            fontSize: 26,
                            fontWeight: FontWeight.w400,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                        const SizedBox(height: 3),
                        const Text(
                          'Direct hardware playback with zero network latency',
                          style: TextStyle(
                            color: AppConstants.textSecondary,
                            fontSize: 12.5,
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Storage Usage Banner
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppConstants.surfaceDark,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.08),
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.3),
                                blurRadius: 15,
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: AppConstants.successGreen.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(
                                  CupertinoIcons.folder_badge_minus,
                                  color: AppConstants.successGreen,
                                  size: 22,
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'LOCAL DISK STORAGE',
                                      style: GoogleFonts.spaceGrotesk(
                                        color: Colors.white.withValues(alpha: 0.45),
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: 1.0,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '${storageMb.toStringAsFixed(1)} MB (${downloads.length} tracks)',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 15,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (downloads.isNotEmpty)
                                GestureDetector(
                                  onTap: () {
                                    PlayerController.instance.playTrack(
                                      downloads.first,
                                      newQueue: downloads,
                                    );
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 14, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(999),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.white.withValues(alpha: 0.25),
                                          blurRadius: 10,
                                        ),
                                      ],
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(CupertinoIcons.play_fill,
                                            color: Colors.black, size: 12),
                                        SizedBox(width: 6),
                                        Text(
                                          'Play All',
                                          style: TextStyle(
                                            color: Colors.black,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // 2. DOWNLOADS LIST
                if (downloads.isEmpty)
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              color: AppConstants.surfaceDark,
                              shape: BoxShape.circle,
                              border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.08)),
                            ),
                            child: const Icon(CupertinoIcons.arrow_down_circle,
                                size: 28, color: AppConstants.primaryNeon),
                          ),
                          const SizedBox(height: 14),
                          const Text(
                            'No downloaded songs yet',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Tap the download arrow on any song to save it for offline playback',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: AppConstants.textMuted,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, i) {
                        final track = downloads[i];
                        return Dismissible(
                          key: Key('download_${track.id}'),
                          direction: DismissDirection.endToStart,
                          background: Container(
                            alignment: Alignment.centerRight,
                            padding: const EdgeInsets.only(right: 20),
                            color: Colors.redAccent.withValues(alpha: 0.3),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                Icon(CupertinoIcons.trash, color: Colors.redAccent),
                                SizedBox(width: 8),
                                Text(
                                  'Delete',
                                  style: TextStyle(
                                    color: Colors.redAccent,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          onDismissed: (_) {
                            library.removeDownload(track);
                          },
                          child: SongTile(
                            track: track,
                            queue: downloads,
                          ),
                        );
                      },
                      childCount: downloads.length,
                    ),
                  ),

                const SliverToBoxAdapter(child: SizedBox(height: 120)),
              ],
            );
          },
        ),
      ),
    );
  }
}
