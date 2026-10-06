package hu.wydrian.nas;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import org.json.JSONObject;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;

final class AppUpdater {
    static File file(Context context) { return new File(context.getCacheDir(), "updates/release.apk"); }
    static File metadata(Context context) { return new File(context.getCacheDir(), "updates/release.json"); }
    static String hex(byte[] bytes) { StringBuilder value = new StringBuilder(); for (byte b : bytes) value.append(String.format(java.util.Locale.ROOT, "%02x", b & 255)); return value.toString(); }
    static String signer(PackageInfo info) throws Exception {
        Signature[] signatures = Build.VERSION.SDK_INT >= 28 ? info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners() : info.signatures;
        if (signatures == null || signatures.length != 1) throw new IllegalStateException("Signer rejected");
        return hex(MessageDigest.getInstance("SHA-256").digest(signatures[0].toByteArray()));
    }
    static void verify(Context context, File apk, JSONObject release) throws Exception {
        if (apk.length() != release.getLong("size") || apk.length() > UpdatePolicy.MAX_BYTES) throw new IllegalStateException("Size rejected");
        MessageDigest sha = MessageDigest.getInstance("SHA-256"); try (var input = Files.newInputStream(apk.toPath())) { byte[] buffer = new byte[8192]; int n; while ((n = input.read(buffer)) != -1) sha.update(buffer, 0, n); }
        if (!hex(sha.digest()).equals(release.getString("sha256"))) throw new IllegalStateException("Hash rejected");
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo candidate = context.getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        PackageInfo installed = context.getPackageManager().getPackageInfo(context.getPackageName(), flags);
        if (candidate == null || !release.getString("versionName").equals(candidate.versionName) || !UpdatePolicy.archive(candidate.packageName, Build.VERSION.SDK_INT >= 28 ? candidate.getLongVersionCode() : candidate.versionCode, release.getInt("versionCode"), signer(candidate), signer(installed))) throw new IllegalStateException("Archive rejected");
    }
    static synchronized boolean check(Context context) throws Exception {
        SecureStore store = new SecureStore(context); String secret = store.get("secret"); if (secret == null) return false;
        NasApi.Result result = NasApi.update(secret); if (result.status != 200) throw new IllegalStateException("Update unavailable");
        JSONObject release = result.data;
        if (release.getInt("versionCode") <= BuildConfig.VERSION_CODE) { clear(context); return false; }
        if (!UpdatePolicy.manifest(BuildConfig.VERSION_CODE, release.getInt("versionCode"), release.getString("versionName"), release.getString("sha256"), release.getLong("size"), release.getString("path"))) throw new IllegalStateException("Manifest rejected");
        File apk = file(context); if (apk.exists() && metadata(context).exists()) { try { verify(context, apk, release); Files.write(metadata(context).toPath(),release.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)); return true; } catch (Exception ignored) { clear(context); } }
        File parent = apk.getParentFile(); if (!parent.isDirectory() && !parent.mkdirs()) throw new IllegalStateException("Private cache unavailable");
        File part = new File(parent, "release.part");
        try {
            NasApi.downloadUpdate(secret, part, release.getLong("size")); verify(context, part, release);
            if (!secret.equals(store.get("secret"))) throw new IllegalStateException("Device changed during download");
            Files.move(part.toPath(), apk.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            Files.write(metadata(context).toPath(), release.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)); return true;
        } finally { if (part.exists()) part.delete(); }
    }
    static synchronized JSONObject ready(Context context) throws Exception {
        if (new SecureStore(context).get("secret") == null || !metadata(context).isFile()) return null;
        JSONObject release = new JSONObject(new String(Files.readAllBytes(metadata(context).toPath()),java.nio.charset.StandardCharsets.UTF_8));
        verify(context, file(context), release); return release;
    }
    static synchronized void clear(Context context) { for (File path : new File[]{file(context), metadata(context), new File(context.getCacheDir(), "updates/release.part")}) if (path.exists()) path.delete(); }
}
