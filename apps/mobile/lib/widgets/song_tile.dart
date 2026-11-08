import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import '../constants.dart';
import '../models/track.dart';
import '../services/library_service.dart';
import '../services/player_controller.dart';

class SongTile extends StatefulWidget {
  final Track track;
  final List<Track>? queue;
  final VoidCallback? onTap;

  const SongTile({
    super.key,
    required this.track,
    this.queue,
    this.onTap,
  });

  @override
  State<SongTile> createState() => _SongTileState();
}

class _SongTileState extends State<SongTile> {
  double _downloadProgress = -1.0;
  bool _isDownloading = false;

  String _formatDuration(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  void _startDownload() async {
    if (_isDownloading) return;
    setState(() {
      _isDownloading = true;
      _downloadProgress = 0.05;
    });

    final success = await LibraryService.instance.downloadTrack(
      widget.track,
      onProgress: (p) {
        if (mounted) setState(() => _downloadProgress = p);
      },
    );

    if (mounted) {
      setState(() {
        _isDownloading = false;
        _downloadProgress = -1.0;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            success ? 'Downloaded "${widget.track.title}" for offline playback' : 'Download failed',
          ),
          duration: const Duration(seconds: 2),
          backgroundColor: success ? AppConstants.primaryNeon : Colors.redAccent,
        ),
      );
    }
  }

  void _showPlaylistSelector() {
    final library = LibraryService.instance;
    showModalBottomSheet(
      context: context,
      backgroundColor: AppConstants.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Text(
                    'Add to Playlist',
                    style: TextStyle(
                      color: AppConstants.textPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                if (library.playlists.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(20),
                    child: Text(
                      'No custom playlists yet. Create one in Library.',
                      style: TextStyle(color: AppConstants.textSecondary),
                    ),
                  )
                else
                  Flexible(
                    child: ListView.builder(
                      shrinkWrap: true,
                      itemCount: library.playlists.length,
                      itemBuilder: (context, i) {
                        final pl = library.playlists[i];
                        return ListTile(
                          leading: const Icon(CupertinoIcons.music_albums, color: AppConstants.primaryNeon),
                          title: Text(pl.name, style: const TextStyle(color: Colors.white)),
                          subtitle: Text('${pl.tracks.length} songs', style: const TextStyle(color: Colors.grey)),
                          onTap: () {
                            library.addTrackToPlaylist(pl.id, widget.track);
                            Navigator.pop(ctx);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Added to "${pl.name}"'),
                                duration: const Duration(seconds: 2),
                                backgroundColor: AppConstants.primaryNeon,
                              ),
                            );
                          },
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final player = PlayerController.instance;
    final library = LibraryService.instance;

    return ListenableBuilder(
      listenable: Listenable.merge([player, library]),
      builder: (context, _) {
        final isCurrent = player.currentTrack?.id == widget.track.id;
        final isFav = library.isFavorite(widget.track.id);
        final isDownloaded = widget.track.isDownloaded ||
            library.downloads.any((d) => d.id == widget.track.id);

        return InkWell(
          onTap: () {
            if (widget.onTap != null) {
              widget.onTap!();
            } else {
              player.playTrack(widget.track, newQueue: widget.queue);
            }
          },
          splashColor: AppConstants.primaryNeon.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(16),
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 3),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: isCurrent
                  ? AppConstants.primaryNeon.withValues(alpha: 0.10)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(16),
              border: isCurrent
                  ? Border.all(color: AppConstants.primaryNeon.withValues(alpha: 0.25), width: 1)
                  : null,
            ),
            child: Row(
              children: [
                // Clean Studio Square Album Artwork (50x50 with rounded 12px corners)
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: CachedNetworkImage(
                    imageUrl: widget.track.artworkUrl.isNotEmpty
                        ? widget.track.artworkUrl
                        : AppConstants.fallbackArtwork,
                    width: 50,
                    height: 50,
                    fit: BoxFit.cover,
                    memCacheWidth: 200,
                    placeholder: (context, url) => Container(
                      width: 50,
                      height: 50,
                      color: AppConstants.surfaceCard,
                      child: const Icon(CupertinoIcons.music_note, color: AppConstants.textMuted, size: 20),
                    ),
                    errorWidget: (context, url, error) => Container(
                      width: 50,
                      height: 50,
                      color: AppConstants.surfaceCard,
                      child: const Icon(CupertinoIcons.music_note, color: AppConstants.textMuted, size: 20),
                    ),
                  ),
                ),
                const SizedBox(width: 14),

                // Studio Track Title, Artist, & Album
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.track.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: isCurrent ? AppConstants.primaryNeon : AppConstants.textPrimary,
                          fontSize: 14.5,
                          fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w600,
                          letterSpacing: -0.2,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          if (isDownloaded) ...[
                            const Icon(
                              CupertinoIcons.arrow_down_circle_fill,
                              color: AppConstants.successGreen,
                              size: 13,
                            ),
                            const SizedBox(width: 4),
                          ],
                          Expanded(
                            child: Text(
                              '${widget.track.artist}${widget.track.album.isNotEmpty ? " — ${widget.track.album}" : ""}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppConstants.textSecondary,
                                fontSize: 12.5,
                              ),
                            ),
                          ),
                          Text(
                            _formatDuration(widget.track.duration),
                            style: const TextStyle(
                              color: AppConstants.textMuted,
                              fontSize: 11.5,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: 6),

                // Like / Heart Button
                IconButton(
                  icon: Icon(
                    isFav ? CupertinoIcons.heart_fill : CupertinoIcons.heart,
                    color: isFav ? AppConstants.primaryNeon : AppConstants.textMuted,
                    size: 19,
                  ),
                  onPressed: () => library.toggleFavorite(widget.track),
                  visualDensity: VisualDensity.compact,
                ),

                // Download Button or Progress
                if (_isDownloading)
                  SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      value: _downloadProgress > 0 ? _downloadProgress : null,
                      strokeWidth: 2,
                      valueColor: const AlwaysStoppedAnimation(AppConstants.primaryNeon),
                    ),
                  )
                else
                  IconButton(
                    icon: Icon(
                      isDownloaded
                          ? CupertinoIcons.checkmark_alt_circle_fill
                          : CupertinoIcons.arrow_down_circle,
                      color: isDownloaded ? AppConstants.successGreen : AppConstants.textMuted,
                      size: 19,
                    ),
                    onPressed: isDownloaded ? null : _startDownload,
                    visualDensity: VisualDensity.compact,
                  ),

                // 3-dot Menu
                IconButton(
                  icon: const Icon(CupertinoIcons.ellipsis, color: AppConstants.textMuted, size: 16),
                  onPressed: _showPlaylistSelector,
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
