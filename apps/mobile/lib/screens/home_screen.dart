import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants.dart';
import '../models/track.dart';
import '../services/library_service.dart';
import '../services/music_service.dart';
import '../services/player_controller.dart';
import '../widgets/song_tile.dart';

class HeroSlideData {
  final String id;
  final String eyebrow;
  final String title;
  final String subtitle;
  final String meta;
  final String visualUrl;
  final String query;

  const HeroSlideData({
    required this.id,
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    required this.meta,
    required this.visualUrl,
    required this.query,
  });
}

class FrequencyCardData {
  final String id;
  final String genre;
  final String title;
  final String artists;
  final String imageUrl;
  final String query;

  const FrequencyCardData({
    required this.id,
    required this.genre,
    required this.title,
    required this.artists,
    required this.imageUrl,
    required this.query,
  });
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const List<HeroSlideData> _heroSlides = [
    HeroSlideData(
      id: 'hero-0',
      eyebrow: 'THE ART OF SLOWING DOWN',
      title: 'Somewhere, out of time.',
      subtitle:
          'A softer pace. A deeper listen. Drift through ambient textures, warm electronics, and everything in between.',
      meta: '32 tracks · 2 hr 18 min',
      visualUrl:
          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      query: 'Tycho Bonobo Ambient Chill',
    ),
    HeroSlideData(
      id: 'hero-1',
      eyebrow: 'AFTER HOURS FREQUENCY',
      title: 'Neon silhouettes.',
      subtitle:
          'Minimal synthwave, nocturnal reverberations, and 80s analog pulse under midnight city lights.',
      meta: '28 tracks · 1 hr 54 min',
      visualUrl:
          'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
      query: 'The Weeknd After Hours Synthwave',
    ),
    HeroSlideData(
      id: 'hero-2',
      eyebrow: 'ANALOG WARMTH',
      title: 'Velvet & vinyl.',
      subtitle:
          'Dusted tape saturation, organic neo-soul grooves, and breezy vintage guitar riffs.',
      meta: '35 tracks · 2 hr 10 min',
      visualUrl:
          'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1200&q=80',
      query: 'FKJ Masego Tom Misch Khruangbin',
    ),
  ];

  static const List<FrequencyCardData> _frequencyCards = [
    FrequencyCardData(
      id: 'freq-electronic',
      genre: 'ELECTRONIC',
      title: 'Blue reverie',
      artists: 'Floating Points, Bonobo, Kiasmos',
      imageUrl:
          'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=500&q=80',
      query: 'Floating Points Bonobo Kiasmos',
    ),
    FrequencyCardData(
      id: 'freq-indie',
      genre: 'INDIE & ALTERNATIVE',
      title: 'Soft focus',
      artists: 'Men I Trust, Crumb, BADBADNOTGOOD',
      imageUrl:
          'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=500&q=80',
      query: 'Men I Trust Crumb BADBADNOTGOOD',
    ),
    FrequencyCardData(
      id: 'freq-leftfield',
      genre: 'LEFTFIELD',
      title: 'Future forms',
      artists: 'Jon Hopkins, Rival Consoles, Bicep',
      imageUrl:
          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=500&q=80',
      query: 'Jon Hopkins Bicep Four Tet',
    ),
    FrequencyCardData(
      id: 'freq-jazz',
      genre: 'JAZZ & SOUL',
      title: 'The listening room',
      artists: 'Bill Evans, Yussef Dayes, Alfa Mist',
      imageUrl:
          'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=500&q=80',
      query: 'Bill Evans Alfa Mist Yussef Dayes',
    ),
    FrequencyCardData(
      id: 'freq-soulful',
      genre: 'SOULFUL SELECTS',
      title: 'Golden hour',
      artists: 'Khruangbin, SAULT, Jordan Rakei',
      imageUrl:
          'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=500&q=80',
      query: 'Khruangbin Jordan Rakei SAULT',
    ),
  ];

  static final List<Track> _defaultRotationTracks = [
    Track(
      id: 'curated-a-walk',
      title: 'A Walk',
      artist: 'Tycho',
      album: 'Dive',
      artworkUrl:
          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=300&q=80',
      duration: 316,
      source: 'saavn',
    ),
    Track(
      id: 'curated-kerala',
      title: 'Kerala',
      artist: 'Bonobo',
      album: 'Migration',
      artworkUrl:
          'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=300&q=80',
      duration: 237,
      source: 'saavn',
    ),
    Track(
      id: 'curated-tadow',
      title: 'Tadow',
      artist: 'Masego, FKJ',
      album: 'Lady Lady',
      artworkUrl:
          'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=300&q=80',
      duration: 302,
      source: 'saavn',
    ),
  ];

  final PageController _heroPageController = PageController();
  int _activeHeroIndex = 0;
  bool _isHeroLoading = false;
  String? _activeHeroQuery;

  String? _loadingFrequencyId;
  String? _activeFrequencyId;

  bool _isBlendLoading = false;
  List<Track> _trendingTracks = List.from(MusicService.fallbackTrendingTracks);
  bool _isLoadingTrending = false;

  @override
  void initState() {
    super.initState();
    _loadTrending();
  }

  @override
  void dispose() {
    _heroPageController.dispose();
    super.dispose();
  }

  Future<void> _loadTrending() async {
    final tracks = await MusicService.getTrendingTracks();
    if (mounted && tracks.isNotEmpty) {
      setState(() {
        _trendingTracks = tracks;
        _isLoadingTrending = false;
      });
    }
  }

  Future<void> _handlePlayHero(HeroSlideData slide) async {
    final player = PlayerController.instance;
    if (_activeHeroQuery == slide.query && player.isPlaying) {
      player.pause();
      return;
    }
    if (_activeHeroQuery == slide.query && !player.isPlaying && player.currentTrack != null) {
      player.resume();
      return;
    }

    setState(() => _isHeroLoading = true);
    try {
      final results = await MusicService.searchTracks(slide.query, limit: 20);
      if (results.isNotEmpty && mounted) {
        setState(() => _activeHeroQuery = slide.query);
        await player.playTrack(results.first, newQueue: results);
      }
    } catch (e) {
      debugPrint('[HomeScreen] Play hero error: $e');
    } finally {
      if (mounted) setState(() => _isHeroLoading = false);
    }
  }

  Future<void> _handlePlayFrequency(FrequencyCardData card) async {
    final player = PlayerController.instance;
    if (_activeFrequencyId == card.id && player.isPlaying) {
      player.pause();
      return;
    }
    if (_activeFrequencyId == card.id && !player.isPlaying && player.currentTrack != null) {
      player.resume();
      return;
    }

    setState(() => _loadingFrequencyId = card.id);
    try {
      final results = await MusicService.searchTracks(card.query, limit: 20);
      if (results.isNotEmpty && mounted) {
        setState(() => _activeFrequencyId = card.id);
        await player.playTrack(results.first, newQueue: results);
      }
    } catch (e) {
      debugPrint('[HomeScreen] Play frequency error: $e');
    } finally {
      if (mounted) setState(() => _loadingFrequencyId = null);
    }
  }

  Future<void> _handlePlayDailyBlend() async {
    final player = PlayerController.instance;
    final library = LibraryService.instance;

    setState(() => _isBlendLoading = true);
    try {
      final liked = library.favorites;
      final artists = <String>{};
      for (final t in library.recentlyPlayed) {
        if (t.artist.isNotEmpty) artists.add(t.artist);
      }
      for (final t in liked) {
        if (t.artist.isNotEmpty) artists.add(t.artist);
      }

      final query = artists.isNotEmpty
          ? artists.take(3).join(' ')
          : 'Tycho Maribou State Rufus Du Sol';

      final results = await MusicService.searchTracks(query, limit: 20);
      if (results.isNotEmpty && mounted) {
        await player.playTrack(results.first, newQueue: results);
      }
    } catch (e) {
      debugPrint('[HomeScreen] Play blend error: $e');
    } finally {
      if (mounted) setState(() => _isBlendLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final player = PlayerController.instance;
    final library = LibraryService.instance;

    // Combine recently played with default curated rotation
    final seen = <String>{};
    final rotationList = <Track>[];
    for (final t in library.recentlyPlayed) {
      if (!seen.contains(t.title.toLowerCase())) {
        seen.add(t.title.toLowerCase());
        rotationList.add(t);
      }
    }
    for (final t in _defaultRotationTracks) {
      if (!seen.contains(t.title.toLowerCase())) {
        seen.add(t.title.toLowerCase());
        rotationList.add(t);
      }
    }

    return Scaffold(
      backgroundColor: AppConstants.bgDark,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            await _loadTrending();
          },
          color: AppConstants.primaryNeon,
          backgroundColor: AppConstants.surfaceDark,
          child: CustomScrollView(
            physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
            slivers: [
              // 1. EDITORIAL APP BAR / TOP HEADER
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 14),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Image.asset(
                                'assets/logo.png',
                                width: 28,
                                height: 28,
                                errorBuilder: (_, __, ___) => const Icon(
                                  CupertinoIcons.music_note_2,
                                  color: AppConstants.primaryNeon,
                                  size: 24,
                                ),
                              ),
                              const SizedBox(width: 8),
                              const Text(
                                'VYBE',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 20,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 2.0,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'A little more discovery.',
                            style: GoogleFonts.newsreader(
                              color: Colors.white,
                              fontSize: 24,
                              fontWeight: FontWeight.w400,
                              fontStyle: FontStyle.italic,
                              letterSpacing: -0.3,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: AppConstants.surfaceDark,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                        ),
                        child: Text(
                          'DAILY SELECTS',
                          style: GoogleFonts.spaceGrotesk(
                            color: Colors.white.withValues(alpha: 0.45),
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.2,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // 2. CURATED SPLIT HERO CAROUSEL
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: SizedBox(
                    height: 270,
                    child: PageView.builder(
                      controller: _heroPageController,
                      itemCount: _heroSlides.length,
                      onPageChanged: (idx) => setState(() => _activeHeroIndex = idx),
                      itemBuilder: (context, idx) {
                        final slide = _heroSlides[idx];
                        final isHeroPlaying =
                            _activeHeroQuery == slide.query && player.isPlaying;

                        return Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.12),
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.5),
                                blurRadius: 30,
                                offset: const Offset(0, 14),
                              ),
                            ],
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(24),
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                // Background High-Res Image
                                CachedNetworkImage(
                                  imageUrl: slide.visualUrl,
                                  fit: BoxFit.cover,
                                  memCacheWidth: 800,
                                ),

                                // Smoked Glass Atmospheric Refraction Gradient
                                Container(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      begin: Alignment.topCenter,
                                      end: Alignment.bottomCenter,
                                      colors: [
                                        Colors.black.withValues(alpha: 0.35),
                                        Colors.black.withValues(alpha: 0.75),
                                        Colors.black.withValues(alpha: 0.94),
                                      ],
                                      stops: const [0.0, 0.45, 1.0],
                                    ),
                                  ),
                                ),

                                // Content Layer
                                Padding(
                                  padding: const EdgeInsets.all(20),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      // Top Eyebrow
                                      Row(
                                        children: [
                                          Container(
                                            width: 7,
                                            height: 7,
                                            decoration: const BoxDecoration(
                                              shape: BoxShape.circle,
                                              color: AppConstants.primaryNeon,
                                              boxShadow: [
                                                BoxShadow(
                                                  color: AppConstants.primaryNeon,
                                                  blurRadius: 8,
                                                  spreadRadius: 1,
                                                ),
                                              ],
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            slide.eyebrow,
                                            style: GoogleFonts.spaceGrotesk(
                                              color: Colors.white.withValues(alpha: 0.8),
                                              fontSize: 10,
                                              fontWeight: FontWeight.w700,
                                              letterSpacing: 1.4,
                                            ),
                                          ),
                                        ],
                                      ),

                                      // Middle Titles
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            slide.title,
                                            style: GoogleFonts.newsreader(
                                              color: Colors.white,
                                              fontSize: 32,
                                              fontWeight: FontWeight.w400,
                                              fontStyle: FontStyle.italic,
                                              height: 1.1,
                                            ),
                                          ),
                                          const SizedBox(height: 6),
                                          Text(
                                            slide.subtitle,
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              color: AppConstants.textSecondary,
                                              fontSize: 12.5,
                                              height: 1.35,
                                            ),
                                          ),
                                        ],
                                      ),

                                      // Bottom Action Row
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          // Listen Now Pill
                                          GestureDetector(
                                            onTap: () => _handlePlayHero(slide),
                                            child: Container(
                                              padding: const EdgeInsets.symmetric(
                                                  horizontal: 16, vertical: 9),
                                              decoration: BoxDecoration(
                                                color: Colors.white,
                                                borderRadius: BorderRadius.circular(999),
                                                boxShadow: [
                                                  BoxShadow(
                                                    color: Colors.white.withValues(alpha: 0.25),
                                                    blurRadius: 12,
                                                  ),
                                                ],
                                              ),
                                              child: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  if (_isHeroLoading &&
                                                      _activeHeroIndex == idx) ...[
                                                    const SizedBox(
                                                      width: 14,
                                                      height: 14,
                                                      child: CircularProgressIndicator(
                                                        strokeWidth: 2,
                                                        valueColor:
                                                            AlwaysStoppedAnimation(Colors.black),
                                                      ),
                                                    ),
                                                    const SizedBox(width: 8),
                                                    const Text(
                                                      'Loading...',
                                                      style: TextStyle(
                                                        color: Colors.black,
                                                        fontSize: 12,
                                                        fontWeight: FontWeight.bold,
                                                      ),
                                                    ),
                                                  ] else if (isHeroPlaying) ...[
                                                    const Icon(
                                                      CupertinoIcons.pause_fill,
                                                      color: Colors.black,
                                                      size: 14,
                                                    ),
                                                    const SizedBox(width: 6),
                                                    const Text(
                                                      'Pause',
                                                      style: TextStyle(
                                                        color: Colors.black,
                                                        fontSize: 12,
                                                        fontWeight: FontWeight.bold,
                                                      ),
                                                    ),
                                                  ] else ...[
                                                    const Icon(
                                                      CupertinoIcons.play_fill,
                                                      color: Colors.black,
                                                      size: 14,
                                                    ),
                                                    const SizedBox(width: 6),
                                                    const Text(
                                                      'Listen now',
                                                      style: TextStyle(
                                                        color: Colors.black,
                                                        fontSize: 12,
                                                        fontWeight: FontWeight.bold,
                                                      ),
                                                    ),
                                                  ],
                                                ],
                                              ),
                                            ),
                                          ),

                                          // Meta text
                                          Text(
                                            slide.meta,
                                            style: GoogleFonts.spaceGrotesk(
                                              color: Colors.white.withValues(alpha: 0.5),
                                              fontSize: 11,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),

                                // Indicator Dots
                                Positioned(
                                  top: 20,
                                  right: 20,
                                  child: Row(
                                    children: List.generate(_heroSlides.length, (i) {
                                      final isCur = _activeHeroIndex == i;
                                      return AnimatedContainer(
                                        duration: const Duration(milliseconds: 250),
                                        margin: const EdgeInsets.only(left: 4),
                                        width: isCur ? 16 : 5,
                                        height: 5,
                                        decoration: BoxDecoration(
                                          color: isCur
                                              ? Colors.white
                                              : Colors.white.withValues(alpha: 0.3),
                                          borderRadius: BorderRadius.circular(999),
                                        ),
                                      );
                                    }),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
              ),

              // 3. FIND YOUR FREQUENCY HEADER
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 26, 20, 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Find your frequency',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 19,
                              fontWeight: FontWeight.bold,
                              letterSpacing: -0.3,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Selected by us. Discovered by you.',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.45),
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppConstants.primaryNeon.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          '320 KBPS',
                          style: TextStyle(
                            color: AppConstants.primaryNeon,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // FIND YOUR FREQUENCY HORIZONTAL CARDS
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 195,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    itemCount: _frequencyCards.length,
                    itemBuilder: (context, i) {
                      final card = _frequencyCards[i];
                      final isCardPlaying =
                          _activeFrequencyId == card.id && player.isPlaying;
                      final isCardLoading = _loadingFrequencyId == card.id;

                      return GestureDetector(
                        onTap: () => _handlePlayFrequency(card),
                        child: Container(
                          width: 140,
                          margin: const EdgeInsets.only(right: 14),
                          decoration: BoxDecoration(
                            color: AppConstants.surfaceDark,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                              color: isCardPlaying
                                  ? AppConstants.primaryNeon.withValues(alpha: 0.6)
                                  : Colors.white.withValues(alpha: 0.08),
                            ),
                            boxShadow: isCardPlaying
                                ? [
                                    BoxShadow(
                                      color: AppConstants.primaryNeon.withValues(alpha: 0.25),
                                      blurRadius: 18,
                                    ),
                                  ]
                                : null,
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(18),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Square Artwork with Active Pill
                                Stack(
                                  children: [
                                    CachedNetworkImage(
                                      imageUrl: card.imageUrl,
                                      width: 140,
                                      height: 110,
                                      fit: BoxFit.cover,
                                      memCacheWidth: 280,
                                    ),
                                    Container(
                                      width: 140,
                                      height: 110,
                                      color: Colors.black.withValues(alpha: 0.25),
                                    ),
                                    if (isCardPlaying)
                                      Positioned(
                                        top: 8,
                                        left: 8,
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 6, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: Colors.black.withValues(alpha: 0.8),
                                            borderRadius: BorderRadius.circular(999),
                                            border: Border.all(
                                                color: AppConstants.primaryNeon
                                                    .withValues(alpha: 0.5)),
                                          ),
                                          child: const Row(
                                            children: [
                                              Icon(CupertinoIcons.waveform,
                                                  color: AppConstants.primaryNeon, size: 10),
                                              SizedBox(width: 4),
                                              Text(
                                                'LIVE',
                                                style: TextStyle(
                                                  color: AppConstants.primaryNeon,
                                                  fontSize: 9,
                                                  fontWeight: FontWeight.w900,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    Positioned(
                                      right: 8,
                                      bottom: 8,
                                      child: Container(
                                        width: 28,
                                        height: 28,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          color: isCardPlaying
                                              ? AppConstants.primaryNeon
                                              : Colors.white,
                                          boxShadow: [
                                            BoxShadow(
                                              color: Colors.black.withValues(alpha: 0.4),
                                              blurRadius: 6,
                                            ),
                                          ],
                                        ),
                                        child: Center(
                                          child: isCardLoading
                                              ? const SizedBox(
                                                  width: 12,
                                                  height: 12,
                                                  child: CircularProgressIndicator(
                                                    strokeWidth: 1.5,
                                                    valueColor: AlwaysStoppedAnimation(
                                                        Colors.black),
                                                  ),
                                                )
                                              : Icon(
                                                  isCardPlaying
                                                      ? CupertinoIcons.pause_fill
                                                      : CupertinoIcons.play_fill,
                                                  color: isCardPlaying
                                                      ? Colors.white
                                                      : Colors.black,
                                                  size: 13,
                                                ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),

                                // Meta Details
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        card.genre,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: GoogleFonts.spaceGrotesk(
                                          color: Colors.white.withValues(alpha: 0.4),
                                          fontSize: 9,
                                          fontWeight: FontWeight.w700,
                                          letterSpacing: 1.0,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        card.title,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: isCardPlaying
                                              ? AppConstants.primaryNeon
                                              : Colors.white,
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      const SizedBox(height: 1),
                                      Text(
                                        card.artists,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: Colors.white.withValues(alpha: 0.5),
                                          fontSize: 10.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),

              // 4. DAILY BLEND CARD (MADE FOR YOUR SESSION)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 10),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppConstants.surfaceDark,
                      borderRadius: BorderRadius.circular(22),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.1),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.35),
                          blurRadius: 20,
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(16),
                          child: CachedNetworkImage(
                            imageUrl:
                                'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80',
                            width: 90,
                            height: 90,
                            fit: BoxFit.cover,
                            memCacheWidth: 200,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'YOUR DAILY BLEND',
                                style: GoogleFonts.spaceGrotesk(
                                  color: Colors.white.withValues(alpha: 0.45),
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1.2,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                'Familiar, but new.',
                                style: GoogleFonts.newsreader(
                                  color: Colors.white,
                                  fontSize: 20,
                                  fontWeight: FontWeight.w400,
                                  fontStyle: FontStyle.italic,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                'Tailored from your listening history, mixed seamlessly.',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.55),
                                  fontSize: 11,
                                ),
                              ),
                              const SizedBox(height: 10),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    '20 tracks · Studio Blend',
                                    style: GoogleFonts.spaceGrotesk(
                                      color: Colors.white.withValues(alpha: 0.4),
                                      fontSize: 10,
                                    ),
                                  ),
                                  GestureDetector(
                                    onTap: _handlePlayDailyBlend,
                                    child: Container(
                                      width: 32,
                                      height: 32,
                                      decoration: const BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: Colors.white,
                                      ),
                                      child: Center(
                                        child: _isBlendLoading
                                            ? const SizedBox(
                                                width: 14,
                                                height: 14,
                                                child: CircularProgressIndicator(
                                                  strokeWidth: 2,
                                                  valueColor: AlwaysStoppedAnimation(
                                                      Colors.black),
                                                ),
                                              )
                                            : const Icon(
                                                CupertinoIcons.play_fill,
                                                color: Colors.black,
                                                size: 14,
                                              ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // 5. IN YOUR ROTATION / RECENTLY PLAYED
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 10),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'In your rotation',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          letterSpacing: -0.2,
                        ),
                      ),
                      Text(
                        '${rotationList.length} Tracks',
                        style: GoogleFonts.spaceGrotesk(
                          color: Colors.white.withValues(alpha: 0.4),
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final track = rotationList[index];
                    return SongTile(
                      track: track,
                      queue: rotationList,
                    );
                  },
                  childCount: rotationList.length.clamp(0, 6),
                ),
              ),

              // 6. TRENDING HITS / STUDIO TOP CHARTS
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 28, 20, 10),
                  child: Row(
                    children: [
                      const Icon(CupertinoIcons.flame_fill,
                          color: AppConstants.primaryNeon, size: 18),
                      const SizedBox(width: 8),
                      const Text(
                        'Trending Studio Hits',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          letterSpacing: -0.2,
                        ),
                      ),
                      const Spacer(),
                      if (_isLoadingTrending)
                        const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor:
                                AlwaysStoppedAnimation(AppConstants.primaryNeon),
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              if (_isLoadingTrending && _trendingTracks.isEmpty)
                const SliverToBoxAdapter(
                  child: Center(
                    child: Padding(
                      padding: EdgeInsets.all(40),
                      child: CircularProgressIndicator(
                        valueColor:
                            AlwaysStoppedAnimation(AppConstants.primaryNeon),
                      ),
                    ),
                  ),
                )
              else
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final track = _trendingTracks[index];
                      return SongTile(
                        track: track,
                        queue: _trendingTracks,
                      );
                    },
                    childCount: _trendingTracks.length,
                  ),
                ),

              // Bottom Spacer to prevent overlap with floating pill dock
              const SliverToBoxAdapter(
                child: SizedBox(height: 120),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
