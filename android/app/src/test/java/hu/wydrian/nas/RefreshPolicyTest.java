package hu.wydrian.nas;

import org.junit.Test;
import static org.junit.Assert.*;

public class RefreshPolicyTest {
    private static final String PAGE = "https://nas.wydrian.hu/notes";

    @Test public void topOfAnyInternalPageCanRefresh() {
        for (String path : new String[]{"/", "/news", "/notes", "/config", "/pokemon#shop-gamerunner"}) {
            assertTrue(RefreshPolicy.allowed(UrlPolicy.ORIGIN + path, true, false, false, 0));
        }
    }
    @Test public void ordinaryScrollingNeverRefreshes() {
        assertFalse(RefreshPolicy.allowed(PAGE, true, false, true, 0));
        assertFalse(RefreshPolicy.allowed(PAGE, true, false, false, 100));
        assertFalse(RefreshPolicy.allowed(PAGE, true, false, true, 100));
    }
    @Test public void loginAndBusyStatesCannotRefresh() {
        assertFalse(RefreshPolicy.allowed(PAGE, false, false, false, 0));
        assertFalse(RefreshPolicy.allowed(PAGE, true, true, false, 0));
    }
    @Test public void blankExternalOrInvalidPagesCannotRefresh() {
        for (String url : new String[]{null, "about:blank", "https://example.com", "https://nas.wydrian.hu.evil.com", "http://nas.wydrian.hu", "javascript:alert(1)"}) {
            assertFalse(RefreshPolicy.allowed(url, true, false, false, 0));
        }
    }
}
