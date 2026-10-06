package hu.wydrian.nas;

import java.net.URI;

final class UrlPolicy {
    static final String ORIGIN = "https://nas.wydrian.hu";
    static final String OPENCODE_ORIGIN = "https://opencode.nas.wydrian.hu";
    static boolean internal(String input) {
        try {
            URI uri = URI.create(input);
            return "https".equals(uri.getScheme()) && ("nas.wydrian.hu".equals(uri.getHost()) || "opencode.nas.wydrian.hu".equals(uri.getHost()))
                    && uri.getRawUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443);
        } catch (Exception ignored) { return false; }
    }
    static boolean openCode(String input) {
        try { URI uri=URI.create(input); return internal(input) && ("opencode.nas.wydrian.hu".equals(uri.getHost()) || "/opencode".equals(uri.getPath()) || uri.getPath().startsWith("/opencode/")); }
        catch(Exception ignored) { return false; }
    }
    static String notificationPath(String value) {
        return value != null && (value.matches("/pokemon(?:#shop-[a-z0-9]+)?") || value.matches("/notes#task-[1-9][0-9]*") || value.equals("/")) ? value : "/pokemon";
    }
    static boolean external(String input) {
        try { URI uri = URI.create(input); return "https".equals(uri.getScheme()) && uri.getHost() != null && uri.getRawUserInfo() == null; }
        catch (Exception ignored) { return false; }
    }
}
