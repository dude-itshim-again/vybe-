import { TrackMetadata } from './types';

/**
 * Bulletproof Metadata Extractor
 * 1. Zero-dependency Binary ID3v2/v1 Tag Parser (reads first 128KB of audio file).
 * 2. Aggressive Filename Sanitizer stripping track numbers, YouTube/downloader tags, and bitrates.
 */

function decodeID3Text(buffer: Uint8Array, encoding: number): string {
  try {
    if (encoding === 0) {
      return new TextDecoder('iso-8859-1').decode(buffer).replace(/\0+$/, '').trim();
    } else if (encoding === 1) {
      return new TextDecoder('utf-16').decode(buffer).replace(/\0+$/, '').trim();
    } else if (encoding === 2) {
      return new TextDecoder('utf-16be').decode(buffer).replace(/\0+$/, '').trim();
    } else if (encoding === 3) {
      return new TextDecoder('utf-8').decode(buffer).replace(/\0+$/, '').trim();
    }
  } catch {
    // Fallback if TextDecoder errors
  }
  return new TextDecoder('utf-8').decode(buffer).replace(/\0+$/, '').trim();
}

function readSyncSafeInteger(view: DataView, offset: number): number {
  return (
    ((view.getUint8(offset) & 0x7f) << 21) |
    ((view.getUint8(offset + 1) & 0x7f) << 14) |
    ((view.getUint8(offset + 2) & 0x7f) << 7) |
    (view.getUint8(offset + 3) & 0x7f)
  );
}

interface ParsedID3 {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  artworkUrl?: string;
}

function parseID3v2(view: DataView, buffer: Uint8Array): ParsedID3 {
  const result: ParsedID3 = {};

  if (buffer.length < 10) return result;
  if (buffer[0] !== 0x49 || buffer[1] !== 0x44 || buffer[2] !== 0x33) {
    return result; // Not ID3v2
  }

  const majorVersion = buffer[3];
  const tagSize = readSyncSafeInteger(view, 6);
  const endOffset = Math.min(10 + tagSize, buffer.length);
  let offset = 10;

  const flags = buffer[5];
  if ((flags & 0x40) !== 0 && offset + 4 <= endOffset) {
    const extHeaderSize = readSyncSafeInteger(view, offset);
    offset += extHeaderSize + 4;
  }

  while (offset + 10 <= endOffset) {
    const frameIdBytes = buffer.subarray(offset, offset + 4);
    const frameId = String.fromCharCode(...frameIdBytes);

    if (frameIdBytes[0] === 0) break; // Padding reached

    const frameSize =
      majorVersion === 4
        ? readSyncSafeInteger(view, offset + 4)
        : view.getUint32(offset + 4, false);

    const frameHeaderLength = 10;
    const bodyStart = offset + frameHeaderLength;
    const bodyEnd = Math.min(bodyStart + frameSize, buffer.length);

    if (bodyStart >= buffer.length || frameSize <= 0) break;

    const frameBody = buffer.subarray(bodyStart, bodyEnd);
    const encoding = frameBody[0] ?? 0;
    const textBytes = frameBody.subarray(1);

    if (frameId === 'TIT2') {
      result.title = decodeID3Text(textBytes, encoding);
    } else if (frameId === 'TPE1') {
      result.artist = decodeID3Text(textBytes, encoding);
    } else if (frameId === 'TALB') {
      result.album = decodeID3Text(textBytes, encoding);
    } else if (frameId === 'TYER' || frameId === 'TDRC') {
      result.year = decodeID3Text(textBytes, encoding);
    } else if (frameId === 'TCON') {
      result.genre = decodeID3Text(textBytes, encoding);
    } else if (frameId === 'APIC' && !result.artworkUrl) {
      try {
        let p = 1;
        let mime = '';
        while (p < frameBody.length && frameBody[p] !== 0) {
          mime += String.fromCharCode(frameBody[p]);
          p++;
        }
        p++; // Skip null terminator of MIME

        if (!mime) mime = 'image/jpeg';
        if (p < frameBody.length) {
          p++; // Skip picture type (0x03 for front cover)
        }

        // Skip description string
        if (encoding === 1 || encoding === 2) {
          while (p + 1 < frameBody.length && !(frameBody[p] === 0 && frameBody[p + 1] === 0)) {
            p += 2;
          }
          p += 2;
        } else {
          while (p < frameBody.length && frameBody[p] !== 0) {
            p++;
          }
          p++;
        }

        if (p < frameBody.length) {
          const imgBytes = frameBody.subarray(p);
          const arrayBuf = imgBytes.buffer.slice(
            imgBytes.byteOffset,
            imgBytes.byteOffset + imgBytes.byteLength
          ) as ArrayBuffer;
          const blob = new Blob([arrayBuf], { type: mime });
          result.artworkUrl = URL.createObjectURL(blob);
        }
      } catch (e) {
        console.warn('Could not parse APIC artwork frame:', e);
      }
    }

    offset += frameHeaderLength + frameSize;
  }

  return result;
}

function parseID3v1(buffer: Uint8Array): ParsedID3 {
  const result: ParsedID3 = {};
  if (buffer.length < 128) return result;

  const tail = buffer.subarray(buffer.length - 128);
  const tag = String.fromCharCode(tail[0], tail[1], tail[2]);
  if (tag === 'TAG') {
    const decoder = new TextDecoder('iso-8859-1');
    result.title = decoder.decode(tail.subarray(3, 33)).replace(/\0+$/, '').trim();
    result.artist = decoder.decode(tail.subarray(33, 63)).replace(/\0+$/, '').trim();
    result.album = decoder.decode(tail.subarray(63, 93)).replace(/\0+$/, '').trim();
    result.year = decoder.decode(tail.subarray(93, 97)).replace(/\0+$/, '').trim();
  }
  return result;
}

/**
 * Aggressive Filename Sanitizer:
 * Strips downloader junk, track numbers, bracketed tags, and extracts clean artist/title.
 */
export function sanitizeFilename(rawFilename: string): {
  artist: string;
  title: string;
  searchQuery: string;
} {
  // 1. Strip file extension (.mp3, .wav, .flac, .m4a, etc.)
  let clean = rawFilename.replace(/\.(mp3|wav|flac|m4a|aac|ogg|opus|webm|mp4)$/i, '').trim();

  // 2. Replace underscores with spaces
  clean = clean.replace(/_/g, ' ');

  // 3. Strip leading track numbers (e.g., "01 -", "01.", "01 ", "1 -", "1. ")
  clean = clean.replace(/^[0-9A-Z]{1,3}[\.\-_\s]+\s*/i, '');

  // 4. Strip downloader / URL domains and bitrate tags
  clean = clean
    .replace(/\[?(?:y2mate(?:\.com)?|ytmp3(?:\.[a-z]+)?|spotifydown[a-z\.]*|savemp3|mp3clan|convert2mp3|tubidy|djmaza)\]?/gi, '')
    .replace(/(?:https?:\/\/)?(?:www\.)?[a-z0-9\-]+\.[a-z]{2,}(?:\/[^\s]*)?/gi, '')
    .replace(/\s*[-–—_]?\s*(?:64|128|192|256|320)\s*k(?:bps)?/gi, '')
    .replace(/\s*[-–—_]?\s*(?:flac|lossless|cdrip|webrip|hd|4k|hq)/gi, '');

  // 5. Strip brackets/parentheses containing target terms:
  // official, video, audio, lyrics, lyric, visualizer, 4k, hd, hq, remastered, 320kbps, 128kbps, ytmp3, y2mate, spotify, prod., feat., ft.
  const bracketNoisePattern =
    /(?:\[|\()[\s\w\.\-_]*(?:official|video|audio|lyrics?|visualizer|4k|hd|hq|remastered|320\s*kbps|128\s*kbps|ytmp3|y2mate|spotify|prod\.?|feat\.?|ft\.?)[\s\w\.\-_]*(?:\]|\))/gi;
  clean = clean.replace(bracketNoisePattern, '');

  // Also strip standalone trailing noise terms
  clean = clean.replace(/\b(?:official\s*(?:video|audio|lyrics?)?|visualizer|remastered|lyric\s*video)\b/gi, '');

  // 6. Strip empty brackets or trailing hyphens/spaces
  clean = clean.replace(/[\(\[\{]\s*[\)\]\}]/g, '').trim();
  clean = clean.replace(/[-–—]\s*$/, '').trim();
  clean = clean.replace(/^[–—-]\s*/, '').trim();
  clean = clean.replace(/\s{2,}/g, ' ').trim();

  // 7. Split on - into artist and title if present
  const parts = clean.split(/\s*[-–—]\s*/);
  if (parts.length >= 2) {
    let artist = parts[0].trim();
    let title = parts.slice(1).join(' - ').trim();

    // Clean any residual "feat." or "prod."
    artist = artist.replace(/\b(?:feat\.?|ft\.?|prod\.?).*$/i, '').trim();
    title = title.replace(/\b(?:feat\.?|ft\.?|prod\.?).*$/i, '').trim();

    if (artist && title) {
      return {
        artist,
        title,
        searchQuery: `${artist} ${title}`.trim(),
      };
    }
  }

  // Single string fallback
  const fallbackTitle = clean || rawFilename;
  return {
    artist: '',
    title: fallbackTitle,
    searchQuery: fallbackTitle,
  };
}

/**
 * Primary entry point: Extracts metadata from a user-dropped File.
 * Reads binary ID3 tags first (128KB buffer via DataView), extracting TIT2 (Title) and TPE1 (Artist),
 * and blends with aggressive filename sanitization so searchQuery is always clean.
 */
export async function extractMetadataFromFile(file: File): Promise<TrackMetadata> {
  const streamUrl = URL.createObjectURL(file);
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const sanitized = sanitizeFilename(file.name);

  let id3Data: ParsedID3 = {};

  try {
    // Read first 128KB for ID3v2 header and tags
    const headSlice = file.slice(0, Math.min(file.size, 131072));
    const headBuffer = new Uint8Array(await headSlice.arrayBuffer());
    const headView = new DataView(headBuffer.buffer);
    id3Data = parseID3v2(headView, headBuffer);

    // If no ID3v2 title, attempt ID3v1 from last 128 bytes
    if (!id3Data.title && file.size > 128) {
      const tailSlice = file.slice(file.size - 128);
      const tailBuffer = new Uint8Array(await tailSlice.arrayBuffer());
      const v1Data = parseID3v1(tailBuffer);
      id3Data = { ...v1Data, ...id3Data };
    }
  } catch (err) {
    console.warn('Non-fatal error reading ID3 tags:', err);
  }

  // Combine binary ID3 metadata with sanitized filename
  const rawId3Title = id3Data.title?.trim();
  const rawId3Artist = id3Data.artist?.trim();

  // Check if ID3 title has file extension or downloader artifacts
  const isTitleClean =
    rawId3Title &&
    !rawId3Title.toLowerCase().endsWith('.mp3') &&
    !rawId3Title.includes('y2mate') &&
    !rawId3Title.includes('ytmp3');

  const finalTitle = isTitleClean ? rawId3Title : sanitized.title;

  const isArtistClean =
    rawId3Artist &&
    rawId3Artist !== 'Unknown Artist' &&
    rawId3Artist !== 'Unknown' &&
    !rawId3Artist.includes('http');

  const finalArtist = isArtistClean ? rawId3Artist : sanitized.artist;

  const searchQuery =
    finalArtist && finalArtist !== 'Unknown Artist' && finalTitle
      ? `${finalArtist} ${finalTitle}`.trim()
      : sanitized.searchQuery || finalTitle;

  return {
    id,
    title: finalTitle,
    artist: finalArtist,
    album: id3Data.album || '',
    artworkUrl: id3Data.artworkUrl,
    streamUrl,
    sourceType: 'local',
    year: id3Data.year,
    genre: id3Data.genre,
    format: file.name.split('.').pop()?.toUpperCase() || 'AUDIO',
    fileSize: file.size,
    rawFile: file,
    searchQuery,
  };
}
