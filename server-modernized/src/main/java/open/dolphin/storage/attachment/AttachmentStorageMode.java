package open.dolphin.storage.attachment;

/**
 * 添付ファイル保存モード。
 */
public enum AttachmentStorageMode {

    S3,
    DISABLED;

    public static AttachmentStorageMode from(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            throw new IllegalArgumentException("attachment.storage.mode is required");
        }
        String normalized = rawValue.trim();
        if ("s3".equalsIgnoreCase(normalized)) {
            return S3;
        }
        if ("disabled".equalsIgnoreCase(normalized)) {
            return DISABLED;
        }
        throw new IllegalArgumentException("Unsupported attachment.storage.mode: " + normalized);
    }

    public boolean isS3() {
        return this == S3;
    }

    public boolean isDisabled() {
        return this == DISABLED;
    }
}
