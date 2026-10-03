package hu.wydrian.nas;

final class RefreshPolicy {
    static boolean allowed(String url, boolean ready, boolean busy, boolean canScrollUp, int scrollY) {
        return ready && !busy && UrlPolicy.internal(url) && !UrlPolicy.openCode(url) && !canScrollUp && scrollY <= 0;
    }
}
