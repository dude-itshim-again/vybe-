import 'dart:async';
import 'dart:ui';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants.dart';
import '../models/track.dart';
import '../services/music_service.dart';
import '../widgets/song_tile.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _searchController = TextEditingController();
  final _focusNode = FocusNode();
  Timer? _debounceTimer;
  List<Track> _allResults = [];
  bool _isSearching = false;
  String _selectedFilter = 'all'; // 'all', 'saavn', 'itunes'

  static const List<String> _trendingTags = [
    'Tycho',
    'The Weeknd',
    'Arijit Singh',
    'Khruangbin',
    'Dua Lipa',
    'Synthwave',
    'Lofi Beats',
    'Coldplay',
    'Billie Eilish',
    'AR Rahman',
    'Bonobo',
    'Taylor Swift',
  ];

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _searchController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    _debounceTimer?.cancel();
    final trimmed = query.trim();
    if (trimmed.isEmpty) {
      setState(() {
        _allResults = [];
        _isSearching = false;
      });
      return;
    }

    _debounceTimer = Timer(const Duration(milliseconds: 350), () async {
      setState(() => _isSearching = true);
      final results = await MusicService.searchTracks(trimmed, limit: 30);
      if (mounted) {
        setState(() {
          _allResults = results;
          _isSearching = false;
        });
      }
    });
  }

  void _applyTag(String tag) {
    _searchController.text = tag;
    _searchController.selection = TextSelection.fromPosition(
      TextPosition(offset: tag.length),
    );
    _onSearchChanged(tag);
  }

  List<Track> get _filteredResults {
    if (_selectedFilter == 'all') return _allResults;
    if (_selectedFilter == 'saavn') {
      return _allResults
          .where((t) => t.source == 'saavn' || t.streamUrl.contains('saavncdn.com'))
          .toList();
    }
    if (_selectedFilter == 'itunes') {
      return _allResults
          .where((t) => t.source == 'itunes' || (t.previewUrl != null && t.previewUrl!.isNotEmpty))
          .toList();
    }
    return _allResults;
  }

  Widget _buildFilterPill(String id, String label) {
    final isSelected = _selectedFilter == id;
    return GestureDetector(
      onTap: () => setState(() => _selectedFilter = id),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        margin: const EdgeInsets.only(right: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? AppConstants.primaryNeon
              : AppConstants.surfaceDark,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: isSelected
                ? AppConstants.primaryNeon
                : Colors.white.withValues(alpha: 0.1),
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: AppConstants.primaryNeon.withValues(alpha: 0.3),
                    blurRadius: 10,
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : AppConstants.textSecondary,
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredResults;
    final saavnCount = _allResults
        .where((t) => t.source == 'saavn' || t.streamUrl.contains('saavncdn.com'))
        .length;
    final itunesCount = _allResults
        .where((t) => t.source == 'itunes' || (t.previewUrl != null && t.previewUrl!.isNotEmpty))
        .length;

    return Scaffold(
      backgroundColor: AppConstants.bgDark,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. TOP HEADER & FROSTED GLASS SEARCH PILL
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Studio Search',
                        style: GoogleFonts.newsreader(
                          color: Colors.white,
                          fontSize: 26,
                          fontWeight: FontWeight.w400,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppConstants.surfaceDark,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                        ),
                        child: Text(
                          'LOSSLESS / 320K',
                          style: GoogleFonts.spaceGrotesk(
                            color: AppConstants.primaryNeon,
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.0,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Sleek Frosted Glass Search Pill
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                      child: Container(
                        height: 50,
                        decoration: BoxDecoration(
                          color: AppConstants.surfaceDark.withValues(alpha: 0.85),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.12),
                          ),
                        ),
                        child: Row(
                          children: [
                            const SizedBox(width: 16),
                            const Icon(
                              CupertinoIcons.search,
                              color: AppConstants.primaryNeon,
                              size: 19,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: TextField(
                                controller: _searchController,
                                focusNode: _focusNode,
                                onChanged: _onSearchChanged,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.w500,
                                ),
                                cursorColor: AppConstants.primaryNeon,
                                decoration: const InputDecoration(
                                  hintText: 'Search songs, artists, studio albums...',
                                  hintStyle: TextStyle(
                                    color: AppConstants.textMuted,
                                    fontSize: 14,
                                  ),
                                  border: InputBorder.none,
                                  isDense: true,
                                ),
                              ),
                            ),
                            if (_searchController.text.isNotEmpty)
                              GestureDetector(
                                onTap: () {
                                  _searchController.clear();
                                  _onSearchChanged('');
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 14),
                                  child: const Icon(
                                    CupertinoIcons.clear_circled_solid,
                                    color: AppConstants.textMuted,
                                    size: 18,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // 2. STUDIO SOURCE FILTER PILLS
            if (_allResults.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: SizedBox(
                  height: 34,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      _buildFilterPill('all', 'All Studio (${_allResults.length})'),
                      _buildFilterPill('saavn', 'JioSaavn 320k ($saavnCount)'),
                      _buildFilterPill('itunes', 'Apple Music ($itunesCount)'),
                    ],
                  ),
                ),
              ),

            // 3. SEARCH RESULTS OR EMPTY SUGGESTIONS STATE
            Expanded(
              child: _isSearching
                  ? const Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircularProgressIndicator(
                            strokeWidth: 2.5,
                            valueColor: AlwaysStoppedAnimation(AppConstants.primaryNeon),
                          ),
                          SizedBox(height: 14),
                          Text(
                            'Resolving 320kbps Studio Masters...',
                            style: TextStyle(
                              color: AppConstants.textSecondary,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    )
                  : _searchController.text.trim().isEmpty
                      ? SingleChildScrollView(
                          padding: const EdgeInsets.fromLTRB(20, 20, 20, 120),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Center Studio Illustration & Subtitle
                              Center(
                                child: Column(
                                  children: [
                                    Container(
                                      width: 64,
                                      height: 64,
                                      decoration: BoxDecoration(
                                        color: AppConstants.surfaceDark,
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: Colors.white.withValues(alpha: 0.08),
                                        ),
                                      ),
                                      child: const Icon(
                                        CupertinoIcons.music_note_list,
                                        color: AppConstants.primaryNeon,
                                        size: 28,
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    const Text(
                                      'Clean Studio Catalog',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 17,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    const Text(
                                      'Direct 320kbps JioSaavn CDNs & Apple Music AAC',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        color: AppConstants.textSecondary,
                                        fontSize: 12.5,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 32),

                              // Trending Tags / Quick Search
                              Text(
                                'EXPLORE BY ARTIST & MOOD',
                                style: GoogleFonts.spaceGrotesk(
                                  color: Colors.white.withValues(alpha: 0.45),
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1.2,
                                ),
                              ),
                              const SizedBox(height: 12),

                              Wrap(
                                spacing: 8,
                                runSpacing: 10,
                                children: _trendingTags.map((tag) {
                                  return GestureDetector(
                                    onTap: () => _applyTag(tag),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 14, vertical: 8),
                                      decoration: BoxDecoration(
                                        color: AppConstants.surfaceDark,
                                        borderRadius: BorderRadius.circular(999),
                                        border: Border.all(
                                          color: Colors.white.withValues(alpha: 0.09),
                                        ),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(
                                            CupertinoIcons.arrow_up_right,
                                            color: AppConstants.primaryNeon,
                                            size: 12,
                                          ),
                                          const SizedBox(width: 6),
                                          Text(
                                            tag,
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 12.5,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                }).toList(),
                              ),
                            ],
                          ),
                        )
                      : filtered.isEmpty
                          ? Center(
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 32),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(
                                      CupertinoIcons.search,
                                      color: AppConstants.textMuted,
                                      size: 40,
                                    ),
                                    const SizedBox(height: 12),
                                    Text(
                                      'No studio tracks found for "${_searchController.text}"',
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(
                                        color: AppConstants.textSecondary,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            )
                          : ListView.builder(
                              itemCount: filtered.length,
                              padding: const EdgeInsets.only(bottom: 120, top: 4),
                              itemBuilder: (context, index) {
                                final track = filtered[index];
                                return SongTile(
                                  track: track,
                                  queue: filtered,
                                );
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }
}
