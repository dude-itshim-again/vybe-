class LyricLine {
  final double startTime; // in seconds
  final double endTime; // in seconds
  final String text;

  LyricLine({
    required this.startTime,
    required this.endTime,
    required this.text,
  });

  Map<String, dynamic> toJson() => {
        'startTime': startTime,
        'endTime': endTime,
        'text': text,
      };

  factory LyricLine.fromJson(Map<String, dynamic> json) => LyricLine(
        startTime: (json['startTime'] as num).toDouble(),
        endTime: (json['endTime'] as num).toDouble(),
        text: json['text'] as String? ?? '',
      );
}

class LyricTrack {
  final String trackId;
  final String title;
  final String artist;
  final List<LyricLine> lines;
  final double offsetSeconds; // live nudge offset

  LyricTrack({
    required this.trackId,
    required this.title,
    required this.artist,
    required this.lines,
    this.offsetSeconds = 0.0,
  });

  LyricTrack copyWithOffset(double newOffset) {
    return LyricTrack(
      trackId: trackId,
      title: title,
      artist: artist,
      lines: lines,
      offsetSeconds: newOffset,
    );
  }
}

