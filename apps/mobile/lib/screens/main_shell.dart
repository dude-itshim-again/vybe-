import 'dart:ui';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants.dart';
import '../services/player_controller.dart';
import '../widgets/mini_player.dart';
import '../widgets/welcome_modal.dart';
import 'downloads_screen.dart';
import 'home_screen.dart';
import 'library_screen.dart';
import 'search_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  final List<Widget> _pages = const [
    HomeScreen(),
    SearchScreen(),
    LibraryScreen(),
    DownloadsScreen(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      WelcomeModal.showIfFirstTime(context);
    });
  }

  Widget _buildNavItem({
    required int index,
    required IconData icon,
    required IconData activeIcon,
    required String label,
  }) {
    final isSelected = _currentIndex == index;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        if (_currentIndex != index) {
          setState(() => _currentIndex = index);
        }
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected
              ? Colors.white.withValues(alpha: 0.08)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isSelected ? activeIcon : icon,
              color: isSelected ? AppConstants.primaryNeon : AppConstants.textMuted,
              size: 20,
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: GoogleFonts.spaceGrotesk(
                color: isSelected ? Colors.white : AppConstants.textMuted,
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                letterSpacing: 0.4,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final player = PlayerController.instance;

    return Scaffold(
      backgroundColor: AppConstants.bgDark,
      body: Stack(
        children: [
          // 1. Current Active Screen
          IndexedStack(
            index: _currentIndex,
            children: _pages,
          ),

          // 2. Bottom Floating Dock (MiniPlayer + Frosted Glass Nav Bar)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Floating MiniPlayer Pill
                ListenableBuilder(
                  listenable: player,
                  builder: (context, _) {
                    if (player.currentTrack == null) {
                      return const SizedBox.shrink();
                    }
                    return const MiniPlayer();
                  },
                ),

                // Frosted Glass Bottom Navigation Bar
                ClipRRect(
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                    child: Container(
                      padding: EdgeInsets.only(
                        top: 8,
                        bottom: MediaQuery.of(context).padding.bottom > 0
                            ? MediaQuery.of(context).padding.bottom
                            : 10,
                      ),
                      decoration: BoxDecoration(
                        color: AppConstants.surfaceDark.withValues(alpha: 0.88),
                        border: Border(
                          top: BorderSide(
                            color: Colors.white.withValues(alpha: 0.08),
                            width: 0.8,
                          ),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildNavItem(
                            index: 0,
                            icon: CupertinoIcons.compass,
                            activeIcon: CupertinoIcons.compass_fill,
                            label: 'Discover',
                          ),
                          _buildNavItem(
                            index: 1,
                            icon: CupertinoIcons.search,
                            activeIcon: CupertinoIcons.search,
                            label: 'Search',
                          ),
                          _buildNavItem(
                            index: 2,
                            icon: CupertinoIcons.music_albums,
                            activeIcon: CupertinoIcons.music_albums_fill,
                            label: 'Library',
                          ),
                          _buildNavItem(
                            index: 3,
                            icon: CupertinoIcons.arrow_down_circle,
                            activeIcon: CupertinoIcons.arrow_down_circle_fill,
                            label: 'Offline',
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
