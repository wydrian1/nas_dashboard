package hu.wydrian.nas;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.graphics.Bitmap;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.TextView;
import android.widget.Toast;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import androidx.core.content.FileProvider;

public class MainActivity extends Activity {
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private SecureStore store;
    private WebView web;
    private SwipeRefreshLayout refresh;
    private TextView status;
    private Button login;
    private String nextPath = "/";
    private final NotificationNavigation notificationNavigation = new NotificationNavigation();
    private boolean pairingBusy, polling, restoring, destroyed;
    private boolean pageLoading, updateBusy;
    private boolean installPermissionPending, resumed;
    private final Runnable loadingTimeout = this::finishPageLoad;
    private volatile int generation;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state); store = new SecureStore(this);
        if (getIntent().hasExtra("path")) nextPath = UrlPolicy.notificationPath(getIntent().getStringExtra("path"));
        notificationNavigation.receive(getIntent());
        NasMessagingService.channel(this);
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(getColor(R.color.nas_background));
        getWindow().getDecorView().setSystemUiVisibility(getWindow().getDecorView().getSystemUiVisibility()
                & ~(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                var bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else { view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); }
            return insets;
        });
        LinearLayout toolbar = new LinearLayout(this); toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(16), 0, dp(16), 0); toolbar.setBackgroundColor(getColor(R.color.nas_background));
        android.widget.ImageView brand = new android.widget.ImageView(this); brand.setImageResource(R.drawable.ic_nas);
        brand.setContentDescription("Wydrian"); brand.setScaleType(android.widget.ImageView.ScaleType.FIT_CENTER);
        toolbar.addView(brand, new LinearLayout.LayoutParams(dp(38), dp(38)));
        LinearLayout heading = new LinearLayout(this); heading.setOrientation(LinearLayout.VERTICAL); heading.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = new TextView(this); title.setText("Wydrian"); title.setTextSize(17); title.setTextColor(getColor(R.color.nas_text));
        title.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL)); heading.addView(title);
        TextView subtitle = new TextView(this); subtitle.setText("NAS DASHBOARD · v" + BuildConfig.VERSION_NAME); subtitle.setTextSize(9); subtitle.setLetterSpacing(.12f);
        subtitle.setTextColor(getColor(R.color.nas_muted)); heading.addView(subtitle);
        LinearLayout.LayoutParams headingLayout = new LinearLayout.LayoutParams(0, -1, 1); headingLayout.setMargins(dp(12), 0, dp(12), 0);
        toolbar.addView(heading, headingLayout);
        ImageButton menu = new ImageButton(this); menu.setImageResource(R.drawable.ic_more); menu.setContentDescription("Beállítások");
        menu.setBackgroundResource(R.drawable.nas_menu_button); menu.setPadding(dp(12), dp(12), dp(12), dp(12));
        toolbar.addView(menu, new LinearLayout.LayoutParams(dp(48), dp(48)));
        menu.setOnClickListener(view -> menu(view)); root.addView(toolbar, new LinearLayout.LayoutParams(-1, dp(64)));
        View divider = new View(this); divider.setBackgroundColor(getColor(R.color.nas_border)); root.addView(divider, new LinearLayout.LayoutParams(-1, dp(1)));
        status = new TextView(this); status.setPadding(dp(16), dp(16), dp(16), dp(16)); status.setTextSize(15);
        status.setTextColor(getColor(R.color.nas_muted)); status.setBackgroundResource(R.drawable.nas_surface); status.setVisibility(View.GONE);
        LinearLayout.LayoutParams statusLayout = new LinearLayout.LayoutParams(-1, -2); statusLayout.setMargins(dp(16), dp(20), dp(16), dp(12)); root.addView(status, statusLayout);
        login = new Button(this); login.setText("Google-belépés böngészőben"); login.setAllCaps(false); login.setTextSize(14);
        login.setTextColor(getColor(R.color.nas_background)); login.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        login.setBackgroundResource(R.drawable.nas_login_button); login.setPadding(dp(16), dp(12), dp(16), dp(12)); login.setMinHeight(dp(48)); login.setVisibility(View.GONE);
        LinearLayout.LayoutParams loginLayout = new LinearLayout.LayoutParams(-1, -2); loginLayout.setMargins(dp(16), 0, dp(16), dp(20)); root.addView(login, loginLayout);
        login.setOnClickListener(view -> startPair());
        refresh = new SwipeRefreshLayout(this);
        refresh.setColorSchemeColors(getColor(R.color.nas_accent));
        refresh.setProgressBackgroundColorSchemeColor(getColor(R.color.nas_panel));
        web = new WebView(this); web.setBackgroundColor(getColor(R.color.nas_background));
        refresh.addView(web, new SwipeRefreshLayout.LayoutParams(-1, -1));
        root.addView(refresh, new LinearLayout.LayoutParams(-1, 0, 1)); setContentView(root);
        // WebView is not a nested-scrolling child: explicitly check the current page's scroll position.
        refresh.setOnChildScrollUpCallback((parent, child) -> !canPullRefresh());
        refresh.setOnRefreshListener(() -> {
            if (!canPullRefresh()) { refresh.setRefreshing(false); return; }
            status.setVisibility(View.GONE);
            beginPageLoad(); web.reload();
        });
        WebSettings settings = web.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false); settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false); settings.setSupportMultipleWindows(false);
        settings.setUserAgentString(settings.getUserAgentString() + " WydrianNAS/" + BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptCookie(true); CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView view, String url, Bitmap favicon) { beginPageLoad(); }
            @Override public void onPageFinished(WebView view, String url) { finishPageLoad(); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (UrlPolicy.internal(url)) {
                    if (request.getUrl().getPath().startsWith("/api/auth/")) { showStatus("A Google-belépést a felső menüből, böngészőben indítsd."); return true; }
                    return false;
                }
                if (request.isForMainFrame() && request.hasGesture()) openExternal(url);
                return true;
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel(); finishPageLoad(); showStatus("TLS-tanúsítványhiba. Biztonsági okból nem nyitjuk meg az oldalt.");
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) { finishPageLoad(); showStatus("Az oldal nem érhető el. A menüből vagy lehúzással újra próbálhatod."); }
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame()) finishPageLoad();
            }
        });
        if (Build.VERSION.SDK_INT >= 33 && !getPreferences(MODE_PRIVATE).getBoolean("permissionAsked", false)) {
            getPreferences(MODE_PRIVATE).edit().putBoolean("permissionAsked", true).apply();
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 100);
        }
        if (store.get("secret") == null) showLogin("Privát dashboard. Jelentkezz be a böngészőben, majd hagyd jóvá ezt a telefont. A Google-jelszó nem kerül az appba.");
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBackOrFinish);
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private boolean canPullRefresh() {
        return RefreshPolicy.allowed(web.getUrl(), web.getVisibility() == View.VISIBLE && store.get("secret") != null,
                pageLoading || restoring || destroyed, web.canScrollVertically(-1), web.getScrollY());
    }
    private void beginPageLoad() {
        if (destroyed) return;
        pageLoading = true; ui.removeCallbacks(loadingTimeout);
        // A failed/aborted navigation must never leave the refresh indicator spinning indefinitely.
        ui.postDelayed(loadingTimeout, 30_000);
    }
    private void finishPageLoad() {
        pageLoading = false; ui.removeCallbacks(loadingTimeout);
        if (refresh != null) refresh.setRefreshing(false);
    }
    @Override protected void onResume() {
        super.onResume();
        resumed=true;
        openNotificationProduct();
        if (store.get("secret") != null) { restoreSession(); enableMessaging(); boolean retryInstall=getIntent().getBooleanExtra("updateReady",false) || (installPermissionPending && getPackageManager().canRequestPackageInstalls()); getIntent().removeExtra("updateReady"); installPermissionPending=false; checkAppUpdate(retryInstall); AppUpdateWorker.schedule(this); }
        else if (store.get("pair") != null) { showPairCode(); pollPair(); }
    }
    @Override protected void onPause() { resumed=false; super.onPause(); }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent); setIntent(intent);
        notificationNavigation.receive(intent);
        if (intent.hasExtra("path")) { nextPath = UrlPolicy.notificationPath(intent.getStringExtra("path")); restoreSession(); }
        if (resumed) openNotificationProduct();
        if (intent.getBooleanExtra("updateReady",false)) checkAppUpdate(true);
    }
    private void showStatus(String message) { if (destroyed) return; status.setText(message); status.setVisibility(View.VISIBLE); }
    private void openNotificationProduct() {
        if (!notificationNavigation.openProduct(this)) toast("Nem található használható böngésző. A készletoldalt az appban nyitjuk meg.");
    }
    private void showLogin(String message) { finishPageLoad(); showStatus(message); login.setVisibility(View.VISIBLE); web.setVisibility(View.GONE); refresh.setVisibility(View.GONE); }
    private void toast(String message) { if (!destroyed) Toast.makeText(this, message, Toast.LENGTH_LONG).show(); }
    private void openExternal(String url) {
        if (!UrlPolicy.external(url)) { toast("Csak HTTPS-link nyitható meg."); return; }
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (Exception ignored) { toast("Nem található böngésző."); }
    }
    private void startPair() {
        if (pairingBusy || store.get("secret") != null) return;
        String existing = store.get("pair");
        if (existing != null) { showPairCode(); openExternal(UrlPolicy.ORIGIN + "/mobile/connect?id=" + existing); pollPair(); return; }
        pairingBusy = true; login.setEnabled(false); showStatus("Párosítás előkészítése…");
        int current = generation;
        network.execute(() -> {
            try {
                byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
                String verifier = android.util.Base64.encodeToString(bytes, android.util.Base64.URL_SAFE | android.util.Base64.NO_PADDING | android.util.Base64.NO_WRAP);
                String challenge = android.util.Base64.encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.UTF_8)), android.util.Base64.URL_SAFE | android.util.Base64.NO_PADDING | android.util.Base64.NO_WRAP);
                String label = (Build.MANUFACTURER + " " + Build.MODEL).replaceAll("[\\p{Cntrl}]", " "); if (label.length() > 80) label = label.substring(0, 80);
                NasApi.Result response = NasApi.post("/api/mobile/pair", new JSONObject().put("action", "start").put("challenge", challenge).put("label", label), null);
                if (response.status != 201) throw new IllegalStateException(response.data.optString("error", "Párosítás sikertelen."));
                synchronized (store) {
                    if (current != generation || destroyed) return;
                    store.put("verifier", verifier); store.put("pair", response.data.getString("id")); store.put("code", response.data.getString("code"));
                    store.put("pairExpires", String.valueOf(response.data.getLong("expiresAt")));
                }
                ui.post(() -> { if (current != generation || destroyed) return; pairingBusy = false; login.setEnabled(true); showPairCode(); openExternal(response.data.optString("url")); pollPair(); });
            } catch (Exception ignored) { ui.post(() -> { pairingBusy = false; login.setEnabled(true); showLogin("Nem sikerült elindítani a párosítást. Ellenőrizd a kapcsolatot, majd próbáld újra."); }); }
        });
    }
    private void showPairCode() {
        showLogin("Ellenőrző kód: " + store.get("code") + "\nCsak akkor hagyd jóvá a böngészőben, ha ott ugyanez a kód látható. A jóváhagyás után térj vissza ide.");
        login.setText("Párosítás megnyitása böngészőben");
    }
    private void clearPair() throws Exception { for (String field : new String[]{"pair", "verifier", "code", "pairExpires"}) store.put(field, null); }
    private void pollPair() {
        if (polling || destroyed || store.get("pair") == null) return;
        polling = true; int current = generation;
        network.execute(() -> {
            try {
                String id = store.get("pair"), verifier = store.get("verifier");
                if (Long.parseLong(store.get("pairExpires")) < System.currentTimeMillis()) { clearPair(); ui.post(() -> { polling = false; showLogin("A párosítás lejárt. Indítsd el újra."); login.setText("Google-belépés böngészőben"); }); return; }
                NasApi.Result response = NasApi.post("/api/mobile/pair", new JSONObject().put("action", "exchange").put("id", id).put("verifier", verifier), null);
                if (response.status == 200) {
                    if (response.cookie == null || !response.cookie.startsWith("__Secure-authjs.session-token=")) throw new IllegalStateException("Missing session");
                    synchronized (store) {
                        if (current != generation || destroyed) return;
                        store.put("secret", response.data.getString("secret")); clearPair();
                    }
                    ui.post(() -> { polling = false; if (current == generation) { installSession(response.cookie); enableMessaging(); checkAppUpdate(false); AppUpdateWorker.schedule(this); } }); return;
                }
                if (response.status != 202) { clearPair(); ui.post(() -> { polling = false; showLogin(response.data.optString("error", "Új párosítás szükséges.")); login.setText("Google-belépés böngészőben"); }); return; }
            } catch (Exception ignored) { /* Temporary network failures do not discard the verifier. */ }
            ui.postDelayed(() -> { polling = false; if (current == generation) pollPair(); }, 3000);
        });
    }
    private void restoreSession() {
        String secret = store.get("secret"); if (secret == null || restoring || destroyed) return;
        restoring = true; int current = generation;
        network.execute(() -> {
            try {
                NasApi.Result result = NasApi.post("/api/mobile/device", new JSONObject().put("action", "session"), secret);
                ui.post(() -> {
                    restoring = false; if (current != generation || destroyed) return;
                    if (result.status == 401) { clearLocal(); showLogin("A hozzáférés lejárt vagy visszavont. Párosítsd újra a telefont."); }
                    else if (result.status == 200 && result.cookie != null && result.cookie.startsWith("__Secure-authjs.session-token=")) installSession(result.cookie);
                    else showStatus("A szerverkapcsolat nem sikerült. Próbáld újra a menüből.");
                });
            } catch (Exception ignored) { ui.post(() -> { restoring = false; if (current == generation) showStatus("Nem érhető el a szerver. Az utolsó megnyitott oldal látható; a menüből újra próbálhatod."); }); }
        });
    }
    private void installSession(String cookie) {
        if (destroyed) return;
        CookieManager.getInstance().setCookie(UrlPolicy.ORIGIN, cookie, accepted -> {
            if (destroyed) return;
            if (!accepted) { showStatus("Nem sikerült a biztonságos munkamenet mentése."); return; }
            CookieManager.getInstance().flush(); status.setVisibility(View.GONE); login.setVisibility(View.GONE); web.setVisibility(View.VISIBLE); refresh.setVisibility(View.VISIBLE);
            String path = nextPath; nextPath = "/";
            if (!"/".equals(path) || web.getUrl() == null || !UrlPolicy.internal(web.getUrl())) web.loadUrl(UrlPolicy.ORIGIN + path);
            TokenSyncWorker.schedule(this);
        });
    }
    private void enableMessaging() {
        if (store.get("secret") == null) return;
        if (!TokenSyncWorker.allowed(this)) { TokenSyncWorker.schedule(this); return; }
        FirebaseMessaging messaging = FirebaseMessaging.getInstance(); messaging.setAutoInitEnabled(true);
        messaging.getToken().addOnSuccessListener(token -> {
            try { store.put("fcmToken", token); TokenSyncWorker.schedule(this); }
            catch (Exception ignored) { toast("A push-regisztráció mentése nem sikerült."); }
        }).addOnFailureListener(error -> toast("Firebase-regisztráció még nem sikerült; a következő indításkor újrapróbáljuk."));
    }
    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) { super.onRequestPermissionsResult(requestCode, permissions, results); if (requestCode == 100) enableMessaging(); }
    private void menu(View anchor) {
        PopupMenu popup = new PopupMenu(this, anchor);
        popup.getMenu().add("Frissítés"); popup.getMenu().add("Értesítések be/ki"); popup.getMenu().add("Android értesítési beállítások");
        popup.getMenu().add("Teszt push"); popup.getMenu().add("Párosítás megszakítása"); popup.getMenu().add("Telefon leválasztása");
        popup.getMenu().add("Appfrissítés keresése");popup.getMenu().add("Appverzió: " + BuildConfig.VERSION_NAME).setEnabled(false);
        popup.setOnMenuItemClickListener(item -> {
            switch (item.getTitle().toString()) {
                case "Frissítés": restoreSession(); if (web.getVisibility() == View.VISIBLE) web.reload(); break;
                case "Appfrissítés keresése": checkAppUpdate(true); break;
                case "Értesítések be/ki":
                    boolean wanted = !getSharedPreferences("settings", MODE_PRIVATE).getBoolean("pushWanted", true);
                    getSharedPreferences("settings", MODE_PRIVATE).edit().putBoolean("pushWanted", wanted).apply();
                    FirebaseMessaging.getInstance().setAutoInitEnabled(wanted && TokenSyncWorker.allowed(this));
                    if (wanted && !TokenSyncWorker.allowed(this)) toast("Az Android-beállításokban is engedélyezd az értesítéseket.");
                    else toast(wanted ? "Értesítések bekapcsolva." : "Értesítések kikapcsolva.");
                    enableMessaging(); TokenSyncWorker.schedule(this); break;
                case "Android értesítési beállítások": startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())); break;
                case "Teszt push": testPush(); break;
                case "Párosítás megszakítása": if (store.get("secret") == null) { synchronized (store) { generation++; try { clearPair(); } catch (Exception ignored) {} } pairingBusy = false; polling = false; login.setEnabled(true); login.setText("Google-belépés böngészőben"); showLogin("Indíts új párosítást, ha kapcsolódni szeretnél."); } break;
                case "Telefon leválasztása": disconnect(); break;
            }
            return true;
        }); popup.show();
    }
    private void testPush() {
        String secret = store.get("secret"); if (secret == null) { toast("Előbb párosítsd a telefont."); return; }
        network.execute(() -> { try {
            NasApi.Result result = NasApi.post("/api/mobile/device", new JSONObject().put("action", "test"), secret);
            ui.post(() -> toast(result.status == 202 ? "Tesztértesítés sorba állítva." : result.data.optString("error", "Teszt sikertelen.")));
        } catch (Exception ignored) { ui.post(() -> toast("Nem érhető el a szerver.")); } });
    }
    private void disconnect() {
        String secret = store.get("secret"); if (secret == null) return;
        new AlertDialog.Builder(this).setTitle("Telefon leválasztása?").setMessage("A dashboard-hozzáférést és a szerveroldali push-regisztrációt is visszavonjuk.")
                .setNegativeButton("Mégse", null).setPositiveButton("Leválasztás", (dialog, which) -> network.execute(() -> {
                    try {
                        NasApi.Result result = NasApi.post("/api/mobile/device", new JSONObject().put("action", "revoke"), secret);
                        if (result.status != 200 && result.status != 401) throw new IllegalStateException();
                        ui.post(() -> { clearLocal(); showLogin("Telefon leválasztva. Új belépéssel ismét kapcsolódhatsz."); });
                    } catch (Exception ignored) { ui.post(() -> toast("Nem érhető el a szerver; a leválasztás nem történt meg. A webes Telefonok oldalon is visszavonható.")); }
                })).show();
    }
    private void clearLocal() {
        androidx.work.WorkManager.getInstance(this).cancelUniqueWork("app-update-check");
        synchronized (store) { generation++; store.clear(); } FirebaseMessaging.getInstance().setAutoInitEnabled(false);
        CookieManager.getInstance().removeAllCookies(null); CookieManager.getInstance().flush(); web.loadUrl("about:blank"); web.clearHistory(); web.clearCache(true);
        android.webkit.WebStorage.getInstance().deleteAllData(); login.setText("Google-belépés böngészőben");
    }
    private void checkAppUpdate(boolean manual) {
        if (updateBusy || destroyed || store.get("secret") == null) return;
        updateBusy=true;int current=generation;
        network.execute(()->{try{boolean ready=AppUpdater.check(this);JSONObject release=ready?AppUpdater.ready(this):null;ui.post(()->{updateBusy=false;if(destroyed||!resumed||current!=generation)return;if(release!=null)installUpdate(release,manual);else if(manual)toast("A legfrissebb appverziót használod: "+BuildConfig.VERSION_NAME);});}catch(Exception ignored){ui.post(()->{updateBusy=false;if(manual)toast("A frissítés nem érhető el vagy nem ment át a biztonsági ellenőrzésen.");});}});
    }
    private void installUpdate(JSONObject release, boolean manual) {
        int version=release.optInt("versionCode");if(!manual&&getPreferences(MODE_PRIVATE).getInt("installerShownVersion",0)==version)return;
        if(!getPackageManager().canRequestPackageInstalls()) { showStatus("Új appverzió letöltve: "+release.optString("versionName")+". Engedélyezd ennek az appnak a frissítések telepítését; az Android megerősítést kérhet.");if(manual||getPreferences(MODE_PRIVATE).getInt("installPermissionVersion",0)!=version){getPreferences(MODE_PRIVATE).edit().putInt("installPermissionVersion",version).apply();installPermissionPending=true;startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+getPackageName())));}return; }
        try { var uri=FileProvider.getUriForFile(this,getPackageName()+".updates",AppUpdater.file(this));startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));getPreferences(MODE_PRIVATE).edit().putInt("installerShownVersion",version).apply(); }
        catch(Exception ignored){toast("Nem indítható az Android telepítője. A menüből újra próbálhatod.");}
    }
    private void goBackOrFinish() { if (web.getVisibility() == View.VISIBLE && web.canGoBack()) web.goBack(); else finish(); }
    @Override public void onBackPressed() { goBackOrFinish(); }
    @Override protected void onDestroy() { destroyed = true; generation++; finishPageLoad(); ui.removeCallbacksAndMessages(null); web.destroy(); network.shutdown(); super.onDestroy(); }
}
