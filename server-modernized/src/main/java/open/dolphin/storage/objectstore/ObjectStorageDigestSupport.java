package open.dolphin.storage.objectstore;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

public final class ObjectStorageDigestSupport {

    private ObjectStorageDigestSupport() {
    }

    public static MessageDigest newSha256Digest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 digest is unavailable", ex);
        }
    }

    public static String sha256Hex(byte[] bytes) {
        if (bytes == null) {
            return null;
        }
        return HexFormat.of().formatHex(newSha256Digest().digest(bytes));
    }

    public static String sha256Hex(MessageDigest digest) {
        if (digest == null) {
            return null;
        }
        return HexFormat.of().formatHex(digest.digest());
    }
}
