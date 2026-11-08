import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../constants.dart';
import '../models/track.dart';
import '../services/library_service.dart';
import '../services/player_controller.dart';
import '../widgets/song_tile.dart';

class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key});

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _showCreatePlaylistDialog() {
    final nameCtrl = TextEditingController();
    final descCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppConstants.surfaceDark,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: BorderSide(color: Colors.white.withValues(alpha: 0.12)),
        ),
        title: Text(
          'Create Studio Playlist',
          style: GoogleFonts.newsreader(
            color: Colors.white,
            fontSize: 22,
            fontStyle: FontStyle.italic,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              autofocus: true,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              cursorColor: AppConstants.primaryNeon,
              decoration: InputDecoration(
                hintText: 'Playlist Name',
                hintStyle: const TextStyle(color: AppConstants.textMuted),
                filled: true,
                fillColor: AppConstants.surfaceCard,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: AppConstants.primaryNeon),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: descCtrl,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              cursorColor: AppConstants.primaryNeon,
              decoration: InputDecoration(
                hintText: 'Description (optional)',
                hintStyle: const TextStyle(color: AppConstants.textMuted),
                filled: true,
                fillColor: AppConstants.surfaceCard,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: AppConstants.primaryNeon),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppConstants.textSecondary)),
          ),
          GestureDetector(
            onTap: () {
              if (nameCtrl.text.trim().isNotEmpty) {
                LibraryService.instance.createPlaylist(nameCtrl.text, descCtrl.text);
                Navigator.pop(ctx);
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
              decoration: BoxDecoration(
                color: AppConstants.primaryNeon,
                borderRadius: BorderRadius.circular(999),
              ),
              child: const Text(
                'Create',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openPlaylistDetails(Playlist playlist) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => Scaffold(
          backgroundColor: AppConstants.bgDark,
          appBar: AppBar(
            backgroundColor: AppConstants.surfaceDark,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(CupertinoIcons.chevron_back, color: Colors.white),
              onPressed: () => Navigator.pop(context),
            ),
            title: Text(
              playlist.name,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            actions: [
              IconButton(
                icon: const Icon(CupertinoIcons.trash, color: Colors.redAccent, size: 20),
                onPressed: () async {
                  await LibraryService.instance.deletePlaylist(playlist.id);
                  if (mounted) Navigator.pop(context);
                },
              ),
            ],
          ),
          body: ListenableBuilder(
            listenable: LibraryService.instance,
            builder: (context, _) {
              final currentPl = LibraryService.instance.playlists.firstWhere(
                (p) => p.id == playlist.id,
                orElse: () => playlist,
              );

              if (currentPl.tracks.isEmpty) {
                return const Center(
                  child: Text(
                    'No tracks in this playlist yet.',
                    style: TextStyle(color: AppConstants.textSecondary),
                  ),
                );
              }

              return Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: GestureDetector(
                      onTap: () {
                        PlayerController.instance.playTrack(
                          currentPl.tracks.first,
                          newQueue: currentPl.tracks,
                        );
                      },
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(999),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.white.withValues(alpha: 0.2),
                              blurRadius: 12,
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(CupertinoIcons.play_fill,
                                color: Colors.black, size: 16),
                            const SizedBox(width: 8),
                            Text(
                              'Play All (${currentPl.tracks.length} songs)',
                              style: const TextStyle(
                                color: Colors.black,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: ListView.builder(
                      itemCount: currentPl.tracks.length,
                      padding: const EdgeInsets.only(bottom: 120),
                      itemBuilder: (context, i) {
                        final track = currentPl.tracks[i];
                        return Dismissible(
                          key: Key('${playlist.id}_${track.id}'),
                          direction: DismissDirection.endToStart,
                          background: Container(
                            alignment: Alignment.centerRight,
                            padding: const EdgeInsets.only(right: 20),
                            color: Colors.redAccent.withValues(alpha: 0.3),
                            child: const Icon(CupertinoIcons.trash, color: Colors.redAccent),
                          ),
                          onDismissed: (_) {
                            LibraryService.instance
                                .removeTrackFromPlaylist(playlist.id, track.id);
                          },
                          child: SongTile(
                            track: track,
                            queue: currentPl.tracks,
                          ),
                        );
                      },
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final library = LibraryService.instance;
    User? user;
    try {
      user = Supabase.instance.client.auth.currentUser;
    } catch (_) {}

    return Scaffold(
      backgroundColor: AppConstants.bgDark,
      body: SafeArea(
        child: Column(
          children: [
            // 1. EDITORIAL LIBRARY TOP BAR
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Your Library',
                        style: GoogleFonts.newsreader(
                          color: Colors.white,
                          fontSize: 26,
                          fontWeight: FontWeight.w400,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Synced collections & favorites',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.45),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      if (user != null)
                        IconButton(
                          icon: const Icon(CupertinoIcons.cloud_upload,
                              color: AppConstants.primaryNeon, size: 22),
                          tooltip: 'Sync with Cloud',
                          onPressed: () async {
                            final messenger = ScaffoldMessenger.of(context);
                            await library.syncToSupabase();
                            if (!mounted) return;
                            messenger.showSnackBar(
                              const SnackBar(
                                content: Text('Library synced with Supabase cloud!'),
                                backgroundColor: AppConstants.primaryNeon,
                                duration: Duration(seconds: 2),
                              ),
                            );
                          },
                        ),
                      GestureDetector(
                        onTap: _showCreatePlaylistDialog,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 7),
                          decoration: BoxDecoration(
                            color: AppConstants.surfaceDark,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                                color: Colors.white.withValues(alpha: 0.1)),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(CupertinoIcons.add,
                                  color: AppConstants.primaryNeon, size: 14),
                              SizedBox(width: 6),
                              Text(
                                'New Playlist',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // 2. FROSTED PILL TAB BAR
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
              child: Container(
                height: 42,
                decoration: BoxDecoration(
                  color: AppConstants.surfaceDark,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                ),
                child: TabBar(
                  controller: _tabController,
                  indicatorSize: TabBarIndicatorSize.tab,
                  indicator: BoxDecoration(
                    color: AppConstants.primaryNeon,
                    borderRadius: BorderRadius.circular(999),
                    boxShadow: [
                      BoxShadow(
                        color: AppConstants.primaryNeon.withValues(alpha: 0.35),
                        blurRadius: 10,
                      ),
                    ],
                  ),
                  labelColor: Colors.white,
                  unselectedLabelColor: AppConstants.textMuted,
                  labelStyle: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.bold,
                  ),
                  dividerColor: Colors.transparent,
                  tabs: [
                    Tab(text: 'Favorites (${library.favorites.length})'),
                    Tab(text: 'Playlists (${library.playlists.length})'),
                  ],
                ),
              ),
            ),

            // 3. TAB VIEWS CONTENT
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  // Tab 1: Favorites List
                  ListenableBuilder(
                    listenable: library,
                    builder: (context, _) {
                      if (library.favorites.isEmpty) {
                        return Center(
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
                                child: const Icon(CupertinoIcons.heart,
                                    size: 28, color: AppConstants.primaryNeon),
                              ),
                              const SizedBox(height: 14),
                              const Text(
                                'No favorite tracks yet',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                'Tap the heart on any song to save it here',
                                style: TextStyle(
                                    color: AppConstants.textMuted, fontSize: 13),
                              ),
                            ],
                          ),
                        );
                      }
                      return ListView.builder(
                        itemCount: library.favorites.length,
                        padding: const EdgeInsets.only(bottom: 120, top: 10),
                        itemBuilder: (context, i) {
                          final track = library.favorites[i];
                          return SongTile(
                            track: track,
                            queue: library.favorites,
                          );
                        },
                      );
                    },
                  ),

                  // Tab 2: Playlists List
                  ListenableBuilder(
                    listenable: library,
                    builder: (context, _) {
                      if (library.playlists.isEmpty) {
                        return Center(
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
                                child: const Icon(CupertinoIcons.music_albums,
                                    size: 28, color: AppConstants.primaryNeon),
                              ),
                              const SizedBox(height: 14),
                              const Text(
                                'No custom playlists yet',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 12),
                              GestureDetector(
                                onTap: _showCreatePlaylistDialog,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 18, vertical: 9),
                                  decoration: BoxDecoration(
                                    color: AppConstants.primaryNeon,
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: const Text(
                                    'Create First Playlist',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      }
                      return ListView.builder(
                        itemCount: library.playlists.length,
                        padding: const EdgeInsets.only(bottom: 120, top: 10),
                        itemBuilder: (context, i) {
                          final pl = library.playlists[i];
                          return Container(
                            margin: const EdgeInsets.symmetric(
                                horizontal: 20, vertical: 5),
                            decoration: BoxDecoration(
                              color: AppConstants.surfaceDark,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.07)),
                            ),
                            child: ListTile(
                              contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 4),
                              leading: Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: AppConstants.surfaceCard,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                      color: Colors.white.withValues(alpha: 0.08)),
                                ),
                                child: const Icon(CupertinoIcons.music_albums,
                                    color: AppConstants.primaryNeon, size: 20),
                              ),
                              title: Text(
                                pl.name,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14.5,
                                ),
                              ),
                              subtitle: Text(
                                '${pl.tracks.length} songs',
                                style: GoogleFonts.spaceGrotesk(
                                  color: AppConstants.textSecondary,
                                  fontSize: 11.5,
                                ),
                              ),
                              trailing: const Icon(CupertinoIcons.chevron_right,
                                  color: AppConstants.textMuted, size: 16),
                              onTap: () => _openPlaylistDetails(pl),
                            ),
                          );
                        },
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
