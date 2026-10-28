package ro.greenstruct.agro.api;

/**
 * Checks the first bytes of an upload, not its name or declared content type: a text file renamed to .pdf
 * is rejected before it reaches the agents.
 */
final class UploadedFileType {

    private static final byte[] PDF = {'%', 'P', 'D', 'F', '-'};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};

    private UploadedFileType() {
    }

    /** Mapped to 422 UNSUPPORTED_FILE_TYPE. */
    static final class UnsupportedFileTypeException extends IllegalArgumentException {
        UnsupportedFileTypeException(String messageRo) {
            super(messageRo);
        }
    }

    static boolean isPdfOrImage(byte[] content) {
        return startsWith(content, PDF) || startsWith(content, JPEG) || startsWith(content, PNG);
    }

    private static boolean startsWith(byte[] content, byte[] signature) {
        if (content == null || content.length < signature.length) {
            return false;
        }
        for (int i = 0; i < signature.length; i++) {
            if (content[i] != signature[i]) {
                return false;
            }
        }
        return true;
    }
}
