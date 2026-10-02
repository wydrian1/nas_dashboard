package hu.wydrian.nas;

import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import javax.net.ssl.HttpsURLConnection;

final class NasApi {
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
