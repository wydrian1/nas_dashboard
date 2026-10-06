package hu.wydrian.nas;

import org.junit.Test;
import static org.junit.Assert.*;

public class UrlPolicyTest {
    @Test public void onlyExactHttpsOriginInsideWebView() {
        assertTrue(UrlPolicy.internal("https://nas.wydrian.hu/pokemon"));
        assertTrue(UrlPolicy.internal("https://nas.wydrian.hu:443/"));
        assertTrue(UrlPolicy.internal("https://opencode.nas.wydrian.hu/"));
        assertTrue(UrlPolicy.internal("https://opencode.nas.wydrian.hu:443/api/info"));
        for(String url:new String[]{"http://opencode.nas.wydrian.hu/","https://opencode.nas.wydrian.hu.evil.example/","https://u:p@opencode.nas.wydrian.hu/","https://opencode.nas.wydrian.hu:49374/"})assertFalse(url,UrlPolicy.internal(url));
        for (String url : new String[]{"http://nas.wydrian.hu/", "https://nas.wydrian.hu.evil.example/", "https://u:p@nas.wydrian.hu/", "javascript:alert(1)", "file:///secret", "https://nas.wydrian.hu:3000/"}) assertFalse(url, UrlPolicy.internal(url));
    }
    @Test public void pushCanOnlyOpenApprovedPagesAndKnownShapeOfAnchor() {
        assertEquals("/pokemon#shop-cardverse", UrlPolicy.notificationPath("/pokemon#shop-cardverse"));
        assertEquals("/pokemon#shop-metagames", UrlPolicy.notificationPath("/pokemon#shop-metagames"));
        assertEquals("/notes#task-14", UrlPolicy.notificationPath("/notes#task-14"));
        assertEquals("/", UrlPolicy.notificationPath("/"));
        for (String path : new String[]{"https://evil.example", "//evil.example", "/api/auth/signout", "/pokemon?redirect=https://evil", "/pokemon#shop-<script>"}) assertEquals("/pokemon", UrlPolicy.notificationPath(path));
        for (String path : new String[]{"/notes#task-0", "/notes#task-1?redirect=https://evil", "/notes#task-<script>", "/notes", "/config", "/../notes#task-1"}) assertEquals("/pokemon", UrlPolicy.notificationPath(path));
    }
    @Test public void externalNeverOpensIntentOrScriptSchemes() {
        assertTrue(UrlPolicy.external("https://gamerunner.hu/product"));
        assertFalse(UrlPolicy.external("intent://secret")); assertFalse(UrlPolicy.external("javascript:alert(1)"));
    }
}
