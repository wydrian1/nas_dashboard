package hu.wydrian.nas;

final class UpdatePolicy {
    static final long MAX_BYTES = 100L * 1024 * 1024;
    static boolean manifest(int installed, int available, String version, String hash, long size, String path) {
        return available > installed && version != null && version.matches("[0-9]+\\.[0-9]+\\.[0-9]+")
                && hash != null && hash.matches("[a-f0-9]{64}") && size > 0 && size <= MAX_BYTES
                && "/api/mobile/update?apk=1".equals(path);
    }
    static boolean archive(String name, long code, long expected, String signer, String installedSigner) {
        return "hu.wydrian.nas".equals(name) && code == expected && code > BuildConfig.VERSION_CODE
                && signer != null && signer.equals(installedSigner);
    }
}
