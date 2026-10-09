package hu.wydrian.nas;

import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import javax.net.ssl.HttpsURLConnection;
import java.io.File;
import java.io.FileOutputStream;

final class NasApi {
    static Result shops(String secret) throws Exception {
        if (secret == null) throw new IllegalStateException("Device required");
        var connection = (HttpsURLConnection) new URL(UrlPolicy.ORIGIN + "/api/mobile/shops").openConnection();
        connection.setConnectTimeout(15000); connection.setReadTimeout(20000); connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Authorization", "Bearer " + secret);
        try {
            int status = connection.getResponseCode();
            if (status != 200) return new Result(status, new JSONObject(), null);
            if (connection.getContentType() == null || !connection.getContentType().startsWith("application/json")) throw new IllegalStateException("Policy MIME");
            try (var input = connection.getInputStream()) {
                ByteArrayOutputStream bytes = new ByteArrayOutputStream(); byte[] buffer = new byte[4096]; int n;
                while ((n = input.read(buffer)) != -1) { bytes.write(buffer, 0, n); if (bytes.size() > 32768) throw new IllegalStateException("Policy size"); }
                return new Result(status, new JSONObject(bytes.toString(StandardCharsets.UTF_8.name())), null);
            }
        } finally { connection.disconnect(); }
    }
    static Result update(String secret) throws Exception {
        HttpsURLConnection connection = updateConnection(secret, false);
        try { int status = connection.getResponseCode(); if (status != 200) return new Result(status, new JSONObject(), null);
            try (var input = connection.getInputStream()) { ByteArrayOutputStream data = new ByteArrayOutputStream(); byte[] buffer = new byte[4096]; int n; while ((n=input.read(buffer))!=-1) { data.write(buffer,0,n); if(data.size()>65536)throw new IllegalStateException("Manifest too large"); } return new Result(status,new JSONObject(data.toString(StandardCharsets.UTF_8.name())),null); }
        } finally { connection.disconnect(); }
    }
    private static HttpsURLConnection updateConnection(String secret, boolean apk) throws Exception {
        if (secret == null) throw new IllegalStateException("Device required");
        var connection=(HttpsURLConnection)new URL(UrlPolicy.ORIGIN + "/api/mobile/update" + (apk ? "?apk=1" : "")).openConnection();
        connection.setConnectTimeout(15000);connection.setReadTimeout(30000);connection.setInstanceFollowRedirects(false);connection.setRequestProperty("Authorization","Bearer "+secret);return connection;
    }
    static void downloadUpdate(String secret, File file, long expected) throws Exception {
        if(expected<=0||expected>UpdatePolicy.MAX_BYTES)throw new IllegalStateException("Size rejected");
        var connection=updateConnection(secret,true);
        try { if(connection.getResponseCode()!=200||!"application/vnd.android.package-archive".equals(connection.getContentType())||connection.getContentLengthLong()!=expected)throw new IllegalStateException("APK response rejected");
            try(var input=connection.getInputStream();var output=new FileOutputStream(file)){byte[] buffer=new byte[8192];int n;long size=0;while((n=input.read(buffer))!=-1){size+=n;if(size>expected)throw new IllegalStateException("APK too large");output.write(buffer,0,n);}if(size!=expected)throw new IllegalStateException("Incomplete APK");output.getFD().sync();}
        } finally {connection.disconnect();}
    }
    static final class Result {
        final int status; final JSONObject data; final String cookie;
        Result(int status, JSONObject data, String cookie) { this.status = status; this.data = data; this.cookie = cookie; }
    }
    static Result post(String path, JSONObject body, String secret) throws Exception {
        if (!path.equals("/api/mobile/pair") && !path.equals("/api/mobile/device")) throw new IllegalArgumentException("API path");
        HttpsURLConnection connection = (HttpsURLConnection) new URL(UrlPolicy.ORIGIN + path).openConnection();
        connection.setConnectTimeout(15000); connection.setReadTimeout(20000); connection.setInstanceFollowRedirects(false);
        connection.setRequestMethod("POST"); connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json");
        if (secret != null) connection.setRequestProperty("Authorization", "Bearer " + secret);
        byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8); connection.setFixedLengthStreamingMode(bytes.length);
        try {
            try (var output = connection.getOutputStream()) { output.write(bytes); }
            int status = connection.getResponseCode();
            if (status >= 300 && status < 400) throw new IllegalStateException("Nem engedett API-átirányítás.");
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (stream == null) throw new IllegalStateException("Üres szerverválasz.");
            ByteArrayOutputStream content = new ByteArrayOutputStream();
            try (stream) {
                byte[] buffer = new byte[4096]; int read;
                while ((read = stream.read(buffer)) != -1) { content.write(buffer, 0, read); if (content.size() > 65536) throw new IllegalStateException("Túl nagy válasz."); }
            }
            return new Result(status, new JSONObject(content.toString(StandardCharsets.UTF_8.name())), connection.getHeaderField("Set-Cookie"));
        } finally { connection.disconnect(); }
    }
}
