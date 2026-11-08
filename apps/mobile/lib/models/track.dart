class Track {
  final String id;
  final String title;
  final String artist;
  final String album;
  final int duration; // in seconds
  final String artworkUrl;
  final String streamUrl;
  final String? previewUrl; // Tier 3 instant guaranteed studio AAC stream
  final String? localFilePath;
  final bool isDownloaded;
  final int fileSize;
  final String source;
  final bool isLiked;

  Track({
    required this.id,
    required this.title,
    required this.artist,
    this.album = '',
    this.duration = 180,
    this.artworkUrl = '',
    this.streamUrl = '',
    this.previewUrl,
    this.localFilePath,
    this.isDownloaded = false,
    this.fileSize = 0,
    this.source = 'stream',
    this.isLiked = false,
  });

  Track copyWith({
    String? id,
    String? title,
    String? artist,
    String? album,
    int? duration,
    String? artworkUrl,
    String? streamUrl,
    String? previewUrl,
    String? localFilePath,
    bool? isDownloaded,
    int? fileSize,
    String? source,
    bool? isLiked,
  }) {
    return Track(
      id: id ?? this.id,
      title: title ?? this.title,
      artist: artist ?? this.artist,
      album: album ?? this.album,
      duration: duration ?? this.duration,
      artworkUrl: artworkUrl ?? this.artworkUrl,
      streamUrl: streamUrl ?? this.streamUrl,
      previewUrl: previewUrl ?? this.previewUrl,
      localFilePath: localFilePath ?? this.localFilePath,
      isDownloaded: isDownloaded ?? this.isDownloaded,
      fileSize: fileSize ?? this.fileSize,
      source: source ?? this.source,
      isLiked: isLiked ?? this.isLiked,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'artist': artist,
        'album': album,
        'duration': duration,
        'artworkUrl': artworkUrl,
        'streamUrl': streamUrl,
        'previewUrl': previewUrl,
        'localFilePath': localFilePath,
        'isDownloaded': isDownloaded,
        'fileSize': fileSize,
        'source': source,
        'isLiked': isLiked,
      };

  factory Track.fromJson(Map<String, dynamic> json) {
    return Track(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Unknown Title',
      artist: json['artist'] as String? ?? 'Unknown Artist',
      album: json['album'] as String? ?? '',
      duration: (json['duration'] as num?)?.toInt() ?? 180,
      artworkUrl: json['artworkUrl'] as String? ??
          json['artwork'] as String? ??
          json['coverUrl'] as String? ??
          json['image'] as String? ??
          '',
      streamUrl: json['streamUrl'] as String? ??
          json['audioUrl'] as String? ??
          json['url'] as String? ??
          '',
      previewUrl: json['previewUrl'] as String? ?? json['preview_url'] as String?,
      localFilePath: json['localFilePath'] as String?,
      isDownloaded: json['isDownloaded'] as bool? ?? false,
      fileSize: (json['fileSize'] as num?)?.toInt() ?? 0,
      source: json['source'] as String? ?? 'stream',
      isLiked: json['isLiked'] as bool? ?? false,
    );
  }
}

class Playlist {
  final String id;
  final String name;
  final String description;
  final List<Track> tracks;
  final String createdAt;

  Playlist({
    required this.id,
    required this.name,
    this.description = '',
    required this.tracks,
    String? createdAt,
  }) : createdAt = createdAt ?? DateTime.now().toIso8601String();

  Playlist copyWith({
    String? id,
    String? name,
    String? description,
    List<Track>? tracks,
  }) {
    return Playlist(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      tracks: tracks ?? this.tracks,
      createdAt: createdAt,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'description': description,
        'tracks': tracks.map((t) => t.toJson()).toList(),
        'createdAt': createdAt,
      };

  factory Playlist.fromJson(Map<String, dynamic> json) {
    final rawTracks = json['tracks'];
    List<Track> parsedTracks = [];
    if (rawTracks is List) {
      for (final item in rawTracks) {
        if (item is Map<String, dynamic>) {
          parsedTracks.add(Track.fromJson(item));
        }
      }
    }

    return Playlist(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Untitled Playlist',
      description: json['description'] as String? ?? '',
      tracks: parsedTracks,
      createdAt: json['createdAt'] as String? ?? DateTime.now().toIso8601String(),
    );
  }
}
