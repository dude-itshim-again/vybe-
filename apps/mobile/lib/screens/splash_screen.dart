import 'dart:async';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:video_player/video_player.dart';
import '../constants.dart';
import 'auth_screen.dart';
import 'main_shell.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  VideoPlayerController? _controller;
  bool _isNavigating = false;
  Timer? _fallbackTimer;

  @override
  void initState() {
    super.initState();

    // Strict 3.5-second fallback timer: NEVER let the splash screen hang
    _fallbackTimer = Timer(const Duration(milliseconds: 3500), () {
      if (!_isNavigating && mounted) {
        _navigateNext();
      }
    });

    _initVideo();
  }

  Future<void> _initVideo() async {
    try {
      final controller = VideoPlayerController.asset('assets/vybe-intro.mp4');
      _controller = controller;

      // Timeout video initialization in 2.5 seconds to avoid freezing
      await controller.initialize().timeout(const Duration(milliseconds: 2500));
      if (!mounted) {
        controller.dispose();
        return;
      }

      controller.setLooping(false);
      controller.play();
      setState(() {});

      controller.addListener(() {
        if (controller.value.position >= controller.value.duration && !_isNavigating) {
          _navigateNext();
        }
      });
    } catch (e) {
      debugPrint('Video splash init error: $e');
      // If video playback fails, automatically navigate after brief branding display
      if (!_isNavigating && mounted) {
        Future.delayed(const Duration(milliseconds: 1200), _navigateNext);
      }
    }
  }

  void _navigateNext() {
    if (_isNavigating || !mounted) return;
    _isNavigating = true;
    _fallbackTimer?.cancel();

    bool hasSession = false;
    try {
      hasSession = Supabase.instance.client.auth.currentSession != null;
    } catch (e) {
      debugPrint('Supabase session check error (falling back to AuthScreen): $e');
    }

    final targetScreen = hasSession ? const MainShell() : const AuthScreen();

    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 600),
        pageBuilder: (context, anim, secAnim) => targetScreen,
        transitionsBuilder: (context, anim, secAnim, child) {
          return FadeTransition(opacity: anim, child: child);
        },
      ),
    );
  }

  @override
  void dispose() {
    _fallbackTimer?.cancel();
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isVideoReady = _controller != null && _controller!.value.isInitialized;

    return Scaffold(
      backgroundColor: AppConstants.bgDark,
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (isVideoReady)
            FittedBox(
              fit: BoxFit.cover,
              child: SizedBox(
                width: _controller!.value.size.width,
                height: _controller!.value.size.height,
                child: VideoPlayer(_controller!),
              ),
            )
          else
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Image.asset(
                    'assets/logo.png',
                    width: 110,
                    height: 110,
                    errorBuilder: (context, error, stackTrace) => Container(
                      width: 90,
                      height: 90,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppConstants.surfaceDark,
                      ),
                      child: const Icon(
                        Icons.music_note_rounded,
                        color: AppConstants.primaryNeon,
                        size: 48,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'VYBE',
                    style: TextStyle(
                      color: AppConstants.textPrimary,
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 4,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Pure Sound • Zero Ads',
                    style: TextStyle(
                      color: AppConstants.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),

          // Skip Button
          SafeArea(
            child: Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: TextButton(
                  onPressed: _navigateNext,
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.white70,
                    backgroundColor: Colors.black38,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                  ),
                  child: const Text('Skip'),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
