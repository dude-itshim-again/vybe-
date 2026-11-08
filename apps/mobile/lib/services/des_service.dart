import 'dart:convert';
import 'package:dart_des/dart_des.dart';

class DesService {
  static const String defaultKey = '38346591';

  /// Decrypts a base64 encoded string using DES-ECB.
  /// Used for JioSaavn's encrypted_media_url strings with key 38346591.
  static String? decryptDesEcb(String base64Data, [String keyStr = defaultKey]) {
    try {
      if (base64Data.trim().isEmpty) return null;
      final cipherBytes = base64Decode(base64Data.trim());
      final keyBytes = utf8.encode(keyStr);

      // Attempt standard PKCS7 unpad
      try {
        final des = DES(
          key: keyBytes,
          mode: DESMode.ECB,
          paddingType: DESPaddingType.PKCS7,
        );
        final decryptedBytes = des.decrypt(cipherBytes);
        final result = utf8.decode(decryptedBytes, allowMalformed: true).trim();
        if (result.startsWith('http')) return result;
      } catch (_) {
        // Fallback to None padding and manual unpad
      }

      final desNone = DES(
        key: keyBytes,
        mode: DESMode.ECB,
        paddingType: DESPaddingType.None,
      );
      final rawDecrypted = desNone.decrypt(cipherBytes);

      // Manual PKCS7 strip
      if (rawDecrypted.isNotEmpty) {
        final padLen = rawDecrypted.last;
        if (padLen > 0 && padLen <= 8 && padLen <= rawDecrypted.length) {
          bool valid = true;
          for (int i = 0; i < padLen; i++) {
            if (rawDecrypted[rawDecrypted.length - 1 - i] != padLen) {
              valid = false;
              break;
            }
          }
          final unpadded = valid
              ? rawDecrypted.sublist(0, rawDecrypted.length - padLen)
              : rawDecrypted;
          return utf8.decode(unpadded, allowMalformed: true).trim();
        }
      }

      return utf8.decode(rawDecrypted, allowMalformed: true).trim();
    } catch (e) {
      // Decryption failed gracefully
      return null;
    }
  }
}

