import 'package:flutter/material.dart';

final GlobalKey<ScaffoldMessengerState> rootScaffoldMessengerKey =
    GlobalKey<ScaffoldMessengerState>();

class AppConstants {
  // Supabase Configuration (Synced with apps/web/.env)
  static const String supabaseUrl = 'https://gjuluhdjfemmheuqossk.supabase.co';
  static const String supabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqdWx1aGRqZmVtbWhldXFvc3NrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMDMwMjgsImV4cCI6MjEwODY3OTAyOH0.R5cSZRhPSHmbRplwAezdYo6qTUs-A4pmR-jhtTB3hG4';

  // Laptop Vybe Exact Palette (Deep Obsidian / Glassmorphism)
  static const Color bgDark = Color(0xFF050508);
  static const Color surfaceDark = Color(0xFF0C0E16);
  static const Color surfaceCard = Color(0xFF131622);
  static const Color surfaceGlass = Color(0x1AFFFFFF); // rgba(255, 255, 255, 0.10)
  static const Color primaryNeon = Color(0xFFE86538); // Laptop Vybe Flame / Coral
  static const Color accentNeon = Color(0xFFFF7A45); // Bright Coral Neon
  static const Color accentIndigo = Color(0xFF6366F1); // Indigo / Electric
  static const Color accentCyan = Color(0xFF22D3EE); // Studio Cyan
  static const Color successGreen = Color(0xFF10B981);
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFF94A3B8); // white/60
  static const Color textMuted = Color(0xFF64748B); // white/40

  // Fallback Studio Artwork
  static const String fallbackArtwork =
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80';
}
