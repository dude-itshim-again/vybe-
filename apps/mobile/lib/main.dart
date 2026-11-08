import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'constants.dart';
import 'screens/splash_screen.dart';
import 'services/library_service.dart';
import 'services/player_controller.dart';

// Hardcoded Supabase fallback credentials directly from apps/web/.env
const String kFallbackSupabaseUrl = 'https://gjuluhdjfemmheuqossk.supabase.co';
const String kFallbackSupabaseAnonKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqdWx1aGRqZmVtbWhldXFvc3NrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMDMwMjgsImV4cCI6MjEwODY3OTAyOH0.R5cSZRhPSHmbRplwAezdYo6qTUs-A4pmR-jhtTB3hG4';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Enforce system UI overlay style
  try {
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        systemNavigationBarColor: AppConstants.surfaceDark,
        systemNavigationBarIconBrightness: Brightness.light,
      ),
    );
  } catch (_) {}

  // 1. Initialize Supabase Client (safe timeout, never crashes)
  try {
    await Supabase.initialize(
      url: AppConstants.supabaseUrl.isNotEmpty ? AppConstants.supabaseUrl : kFallbackSupabaseUrl,
      publishableKey: AppConstants.supabaseAnonKey.isNotEmpty
          ? AppConstants.supabaseAnonKey
          : kFallbackSupabaseAnonKey,
    ).timeout(const Duration(seconds: 2));
  } catch (e) {
    debugPrint('Supabase init skipped (offline/timeout): $e');
  }

  // 2. Initialize Library Service (Loads local disk cache immediately)
  try {
    await LibraryService.instance.init().timeout(const Duration(seconds: 1));
  } catch (e) {
    debugPrint('LibraryService init skipped: $e');
  }

  // 3. Initialize Player Controller (Native ExoPlayer channel)
  try {
    await PlayerController.instance.init().timeout(const Duration(seconds: 1));
  } catch (e) {
    debugPrint('PlayerController init skipped: $e');
  }

  // ALWAYS RUN APP - NEVER BLOCKED
  runApp(const VybeApp());
}

class VybeApp extends StatelessWidget {
  const VybeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      scaffoldMessengerKey: rootScaffoldMessengerKey,
      title: 'Vybe Music',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: AppConstants.bgDark,
        primaryColor: AppConstants.primaryNeon,
        colorScheme: const ColorScheme.dark(
          primary: AppConstants.primaryNeon,
          secondary: AppConstants.accentNeon,
          surface: AppConstants.surfaceDark,
        ),
        textTheme: GoogleFonts.interTextTheme(
          ThemeData.dark().textTheme,
        ),
        useMaterial3: true,
      ),
      home: const SplashScreen(),
    );
  }
}
