package online.uygulamamcebimde.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.os.Parcelable;
import android.provider.MediaStore;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import java.io.File;
import java.util.ArrayList;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://yummy-basket-patterns.lovable.app/";
    private static final String APP_HOST = "yummy-basket-patterns.lovable.app";
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int STARTUP_PERMISSION_REQUEST = 1002;
    private static final int FILE_PERMISSION_REQUEST = 1003;
    private static final int LOCATION_PERMISSION_REQUEST = 1004;

    private WebView webView;
    private ValueCallback<Uri[]> fileChooserCallback;
    private WebChromeClient.FileChooserParams pendingChooserParams;
    private Uri imageCaptureUri;
    private Uri videoCaptureUri;
    private String geolocationOrigin;
    private GeolocationPermissions.Callback geolocationCallback;

    @Override
    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestStartupPermissions();

        webView = new WebView(this);
        setContentView(webView);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, false);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(false);
        // Galeri/kamera `content://` URI döndürür; WebView'ın medyayı okuması için content erişimi açık.
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        String ua = settings.getUserAgentString();
        if (ua == null) ua = "";
        if (!ua.contains("SilvanCebimde")) {
            settings.setUserAgentString(ua + " SilvanCebimde");
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        WebView.setWebContentsDebuggingEnabled(false);
        webView.addJavascriptInterface(new SilvanNativeBridge(), "SilvanNative");
        webView.setWebViewClient(new SilvanWebViewClient());
        webView.setWebChromeClient(new SilvanWebChromeClient());

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private final class SilvanWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return openExternalOrApp(url);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return openExternalOrApp(request.getUrl().toString());
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            if (shouldLeaveWebView(url)) {
                leaveWebView(view, url);
            }
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            handler.cancel();
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request == null || error == null || !request.isForMainFrame()) return;
            if (error.getErrorCode() != WebViewClient.ERROR_UNSUPPORTED_SCHEME) return;
            String failing = request.getUrl() != null ? request.getUrl().toString() : "";
            leaveWebView(view, failing);
        }

        @Override
        @SuppressWarnings("deprecation")
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            if (errorCode != WebViewClient.ERROR_UNSUPPORTED_SCHEME) return;
            leaveWebView(view, failingUrl);
        }
    }

    private final class SilvanWebChromeClient extends WebChromeClient {
        @Override
        public void onGeolocationPermissionsShowPrompt(
                String origin,
                GeolocationPermissions.Callback callback
        ) {
            Uri uri = Uri.parse(origin);
            boolean appHost = "https".equals(uri.getScheme()) && APP_HOST.equals(uri.getHost());
            if (!appHost) {
                callback.invoke(origin, false, false);
                return;
            }
            if (hasLocationPermission()) {
                callback.invoke(origin, true, false);
                return;
            }
            geolocationOrigin = origin;
            geolocationCallback = callback;
            ActivityCompat.requestPermissions(
                    MainActivity.this,
                    new String[] {
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    },
                    LOCATION_PERMISSION_REQUEST
            );
        }

        @Override
        public boolean onShowFileChooser(
                WebView view,
                ValueCallback<Uri[]> filePathCallback,
                FileChooserParams params
        ) {
            if (fileChooserCallback != null) {
                fileChooserCallback.onReceiveValue(null);
            }
            fileChooserCallback = filePathCallback;
            pendingChooserParams = params;
            ArrayList<String> needed = missingFilePermissions(params);
            if (!needed.isEmpty()) {
                ActivityCompat.requestPermissions(
                        MainActivity.this,
                        needed.toArray(new String[0]),
                        FILE_PERMISSION_REQUEST
                );
                return true;
            }
            if (!launchGalleryChooser(params)) {
                fileChooserCallback = null;
                pendingChooserParams = null;
                filePathCallback.onReceiveValue(null);
                return false;
            }
            return true;
        }

        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
            if (resultMsg == null || !(resultMsg.obj instanceof WebView.WebViewTransport)) {
                return false;
            }
            String hitUrl = view.getHitTestResult() != null ? view.getHitTestResult().getExtra() : null;
            if (hitUrl != null && !hitUrl.isEmpty()) {
                openExternalOrApp(hitUrl);
                return false;
            }
            WebView popup = new WebView(view.getContext());
            popup.setWebViewClient(new WebViewClient() {
                private void intercept(WebView v, String url) {
                    if (url == null || url.startsWith("about:")) return;
                    openExternalOrApp(url);
                    v.stopLoading();
                }

                @Override
                public void onPageStarted(WebView v, String url, Bitmap favicon) {
                    intercept(v, url);
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                    intercept(v, request.getUrl().toString());
                    return true;
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView v, String url) {
                    intercept(v, url);
                    return true;
                }
            });
            WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
            transport.setWebView(popup);
            resultMsg.sendToTarget();
            return true;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != FILE_CHOOSER_REQUEST) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        if (fileChooserCallback == null) {
            imageCaptureUri = null;
            videoCaptureUri = null;
            return;
        }
        Uri[] results = null;
        if (resultCode == RESULT_OK) {
            if (data != null && data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                results = new Uri[count];
                for (int i = 0; i < count; i++) {
                    results[i] = data.getClipData().getItemAt(i).getUri();
                    persistReadPermission(results[i]);
                }
            } else if (data != null && data.getData() != null) {
                Uri uri = data.getData();
                persistReadPermission(uri);
                results = new Uri[] { uri };
            } else {
                Uri captured = firstExistingCapture(imageCaptureUri, videoCaptureUri);
                if (captured != null) results = new Uri[] { captured };
            }
        }
        fileChooserCallback.onReceiveValue(results);
        fileChooserCallback = null;
        pendingChooserParams = null;
        imageCaptureUri = null;
        videoCaptureUri = null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_REQUEST && geolocationCallback != null) {
            boolean granted = hasLocationPermission();
            geolocationCallback.invoke(geolocationOrigin, granted, false);
            geolocationCallback = null;
            geolocationOrigin = null;
            return;
        }
        if (requestCode == FILE_PERMISSION_REQUEST && fileChooserCallback != null) {
            WebChromeClient.FileChooserParams params = pendingChooserParams;
            if (!launchGalleryChooser(params)) {
                fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = null;
                pendingChooserParams = null;
            }
        }
    }

    private void requestStartupPermissions() {
        ArrayList<String> needed = new ArrayList<>();
        addIfMissing(needed, Manifest.permission.ACCESS_FINE_LOCATION);
        addIfMissing(needed, Manifest.permission.ACCESS_COARSE_LOCATION);
        addIfMissing(needed, Manifest.permission.CAMERA);
        addIfMissing(needed, Manifest.permission.CALL_PHONE);
        if (Build.VERSION.SDK_INT >= 33) {
            addIfMissing(needed, Manifest.permission.READ_MEDIA_IMAGES);
            addIfMissing(needed, Manifest.permission.READ_MEDIA_VIDEO);
            addIfMissing(needed, Manifest.permission.READ_MEDIA_AUDIO);
            addIfMissing(needed, Manifest.permission.POST_NOTIFICATIONS);
        } else {
            addIfMissing(needed, Manifest.permission.READ_EXTERNAL_STORAGE);
            if (Build.VERSION.SDK_INT <= 28) {
                addIfMissing(needed, Manifest.permission.WRITE_EXTERNAL_STORAGE);
            }
        }
        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), STARTUP_PERMISSION_REQUEST);
        }
    }

    private ArrayList<String> missingFilePermissions(WebChromeClient.FileChooserParams params) {
        ArrayList<String> needed = new ArrayList<>();
        addIfMissing(needed, Manifest.permission.CAMERA);
        if (Build.VERSION.SDK_INT >= 33) {
            addIfMissing(needed, Manifest.permission.READ_MEDIA_IMAGES);
            if (params == null || acceptsVideo(normalizeAcceptTypes(params.getAcceptTypes()))) {
                addIfMissing(needed, Manifest.permission.READ_MEDIA_VIDEO);
            }
        } else {
            addIfMissing(needed, Manifest.permission.READ_EXTERNAL_STORAGE);
        }
        return needed;
    }

    private void addIfMissing(ArrayList<String> needed, String permission) {
        if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
            needed.add(permission);
        }
    }

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED
            || ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    private boolean launchGalleryChooser(WebChromeClient.FileChooserParams params) {
        String[] acceptTypes = params != null ? normalizeAcceptTypes(params.getAcceptTypes()) : new String[0];
        if (acceptTypes.length == 0) {
            acceptTypes = new String[] { "image/*", "video/*" };
        }
        boolean allowMultiple =
            params != null && params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE;
        boolean capture = params != null && params.isCaptureEnabled();
        boolean images = acceptsImage(acceptTypes);
        boolean videos = acceptsVideo(acceptTypes);

        Intent content = new Intent(Intent.ACTION_GET_CONTENT);
        content.addCategory(Intent.CATEGORY_OPENABLE);
        content.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        if (acceptTypes.length == 1) {
            content.setType(acceptTypes[0]);
        } else {
            content.setType("*/*");
            content.putExtra(Intent.EXTRA_MIME_TYPES, acceptTypes);
        }
        content.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, allowMultiple);

        ArrayList<Intent> extras = new ArrayList<>();
        Intent gallery = new Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI);
        gallery.setType(videos && !images ? "video/*" : "image/*");
        gallery.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        extras.add(gallery);

        if (images) {
            Intent camera = buildCaptureIntent(MediaStore.ACTION_IMAGE_CAPTURE, "jpg", true);
            if (camera != null) extras.add(camera);
        }
        if (videos || capture) {
            Intent camcorder = buildCaptureIntent(MediaStore.ACTION_VIDEO_CAPTURE, "mp4", false);
            if (camcorder != null) extras.add(camcorder);
        }

        try {
            Intent chooser = Intent.createChooser(content, "Galeriden seç veya çek");
            if (!extras.isEmpty()) {
                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, extras.toArray(new Parcelable[0]));
            }
            startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
            return true;
        } catch (Exception ignored) {
            try {
                Intent documents = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                documents.addCategory(Intent.CATEGORY_OPENABLE);
                documents.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                documents.setType("*/*");
                documents.putExtra(Intent.EXTRA_MIME_TYPES, acceptTypes);
                documents.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, allowMultiple);
                startActivityForResult(Intent.createChooser(documents, "Galeriden seç"), FILE_CHOOSER_REQUEST);
                return true;
            } catch (Exception alsoIgnored) {
                return false;
            }
        }
    }

    private Intent buildCaptureIntent(String action, String extension, boolean photo) {
        try {
            Uri uri = createCaptureUri(extension);
            if (uri == null) return null;
            if (photo) imageCaptureUri = uri;
            else videoCaptureUri = uri;
            Intent intent = new Intent(action);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, uri);
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            for (ResolveInfo info : getPackageManager().queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)) {
                grantUriPermission(
                        info.activityInfo.packageName,
                        uri,
                        Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION
                );
            }
            return intent;
        } catch (Exception ignored) {
            return null;
        }
    }

    private Uri firstExistingCapture(Uri... uris) {
        for (Uri uri : uris) {
            if (uri == null) continue;
            try (android.os.ParcelFileDescriptor fd = getContentResolver().openFileDescriptor(uri, "r")) {
                if (fd != null && fd.getStatSize() > 0) return uri;
            } catch (Exception ignored) {
                // Boş veya okunamayan yakalama dosyası.
            }
        }
        return null;
    }

    private Uri createCaptureUri(String extension) {
        File dir = new File(getCacheDir(), "capture");
        if (!dir.exists() && !dir.mkdirs()) return null;
        File file = new File(dir, "capture-" + System.currentTimeMillis() + "." + extension);
        try {
            if (!file.exists() && !file.createNewFile()) return null;
        } catch (Exception ignored) {
            return null;
        }
        return FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", file);
    }

    private boolean acceptsImage(String[] types) {
        for (String type : types) {
            if (type.startsWith("image/") || "*/*".equals(type)) return true;
        }
        return types.length == 0;
    }

    private boolean acceptsVideo(String[] types) {
        for (String type : types) {
            if (type.startsWith("video/") || "*/*".equals(type)) return true;
        }
        return false;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private final class SilvanNativeBridge {
        @JavascriptInterface
        public void openMaps(final String url) {
            if (!isExternalMapsUrl(url)) return;
            runOnUiThread(() -> openExternalOrApp(url));
        }
    }

    private boolean shouldLeaveWebView(String url) {
        if (url == null || url.isEmpty()) return false;
        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme();
        if ("about".equals(scheme)) return false;
        if ("https".equals(scheme) && APP_HOST.equals(uri.getHost())) return false;
        return true;
    }

    private void leaveWebView(WebView view, String url) {
        if (view == null) return;
        view.stopLoading();
        openExternalOrApp(url);
        view.post(() -> {
            if (view.canGoBack()) view.goBack();
        });
    }

    /** intent://, tel:, mailto:, whatsapp:, geo: ve diğer harici adresleri dış uygulamaya verir. */
    private boolean openExternalOrApp(String rawUrl) {
        try {
            if (rawUrl == null || rawUrl.isEmpty()) return true;
            Uri uri = Uri.parse(rawUrl);
            String scheme = uri.getScheme();
            if ("about".equals(scheme)) return false;
            if ("https".equals(scheme) && APP_HOST.equals(uri.getHost())) return false;

            if ("intent".equalsIgnoreCase(scheme)) {
                return openIntentUrl(rawUrl);
            }
            if (tryOpenGoogleMapsApp(rawUrl)) return true;

            Intent intent;
            if ("tel".equalsIgnoreCase(scheme)) {
                intent = new Intent(Intent.ACTION_DIAL, uri);
            } else if ("mailto".equalsIgnoreCase(scheme)) {
                intent = new Intent(Intent.ACTION_SENDTO, uri);
            } else if ("whatsapp".equalsIgnoreCase(scheme)) {
                intent = new Intent(Intent.ACTION_VIEW, uri);
                intent.setPackage("com.whatsapp");
            } else {
                intent = new Intent(Intent.ACTION_VIEW, uri);
                intent.addCategory(Intent.CATEGORY_BROWSABLE);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
            return true;
        } catch (Exception ignored) {
            try {
                if (rawUrl != null && rawUrl.toLowerCase(java.util.Locale.ROOT).startsWith("whatsapp:")) {
                    Intent store = new Intent(
                            Intent.ACTION_VIEW,
                            Uri.parse("https://play.google.com/store/apps/details?id=com.whatsapp")
                    );
                    store.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(store);
                }
            } catch (Exception alsoIgnored) {
                // Harici uygulama yoksa WebView içinde bilinmeyen şema yüklenmesin.
            }
            return true;
        }
    }

    private boolean tryOpenGoogleMapsApp(String rawUrl) {
        String geo = geoUriFromMapsUrl(rawUrl);
        if (geo == null) return false;
        try {
            Intent maps = new Intent(Intent.ACTION_VIEW, Uri.parse(geo));
            maps.setPackage("com.google.android.apps.maps");
            maps.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(maps);
            return true;
        } catch (Exception ignored) {
            try {
                Intent any = new Intent(Intent.ACTION_VIEW, Uri.parse(geo));
                any.addCategory(Intent.CATEGORY_BROWSABLE);
                any.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(any);
                return true;
            } catch (Exception alsoIgnored) {
                return false;
            }
        }
    }

    private String geoUriFromMapsUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isEmpty()) return null;
        String lower = rawUrl.trim().toLowerCase(java.util.Locale.ROOT);
        if (lower.startsWith("geo:")) return rawUrl.trim();
        try {
            String toParse = rawUrl;
            if (lower.startsWith("intent://")) {
                String https = httpsFromIntentUrl(rawUrl);
                if (https == null) return null;
                toParse = https;
            }
            Uri uri = Uri.parse(toParse);
            String dest = uri.getQueryParameter("destination");
            if (dest == null) dest = uri.getQueryParameter("query");
            if (dest == null) dest = uri.getQueryParameter("q");
            if (dest == null) return null;
            dest = dest.trim();
            if (!dest.matches("-?\\d+(\\.\\d+)?\\s*,\\s*-?\\d+(\\.\\d+)?")) return null;
            String compact = dest.replaceAll("\\s+", "");
            return "geo:" + compact + "?q=" + Uri.encode(compact);
        } catch (Exception ignored) {
            return null;
        }
    }

    private boolean isExternalMapsUrl(String url) {
        if (url == null) return false;
        String lower = url.trim().toLowerCase(java.util.Locale.ROOT);
        if (lower.startsWith("geo:") || lower.startsWith("google.navigation:") || lower.startsWith("intent:")) {
            return true;
        }
        if (!lower.startsWith("https://")) return false;
        try {
            String host = Uri.parse(url).getHost();
            if (host == null) return false;
            host = host.toLowerCase(java.util.Locale.ROOT);
            return "www.google.com".equals(host)
                || "maps.google.com".equals(host)
                || "maps.app.goo.gl".equals(host)
                || host.endsWith(".google.com")
                || host.endsWith(".google.com.tr");
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean openIntentUrl(String rawUrl) {
        String fallbackUrl = httpsFromIntentUrl(rawUrl);
        try {
            Intent intent = Intent.parseUri(rawUrl, Intent.URI_INTENT_SCHEME);
            if (intent.getStringExtra("browser_fallback_url") != null) {
                fallbackUrl = intent.getStringExtra("browser_fallback_url");
            }
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            intent.setComponent(null);
            intent.setSelector(null);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
            return true;
        } catch (ActivityNotFoundException ignored) {
            // Haritalar kurulu değilse https yedek.
        } catch (Exception ignored) {
            // Bozuk intent:// adresi.
        }
        if (fallbackUrl != null) {
            try {
                Intent web = new Intent(Intent.ACTION_VIEW, Uri.parse(fallbackUrl));
                web.addCategory(Intent.CATEGORY_BROWSABLE);
                web.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(web);
            } catch (Exception alsoIgnored) {
                // Tarayıcı da yoksa WebView içinde intent:// yüklenmesin.
            }
        }
        return true;
    }

    private String httpsFromIntentUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isEmpty()) return null;
        String markerKey = "S.browser_fallback_url=";
        int idx = rawUrl.indexOf(markerKey);
        if (idx >= 0) {
            int start = idx + markerKey.length();
            int end = rawUrl.indexOf(';', start);
            if (end < 0) end = rawUrl.length();
            try {
                String decoded = Uri.decode(rawUrl.substring(start, end));
                if (decoded.startsWith("https://") || decoded.startsWith("http://")) return decoded;
            } catch (Exception ignored) {
                // Bozuk yedek adres.
            }
        }
        if (!rawUrl.startsWith("intent://")) return null;
        int marker = rawUrl.indexOf("#Intent;");
        if (marker <= "intent://".length()) return null;
        return "https://" + rawUrl.substring("intent://".length(), marker);
    }

    private String[] normalizeAcceptTypes(String[] rawTypes) {
        ArrayList<String> types = new ArrayList<>();
        if (rawTypes != null) {
            for (String raw : rawTypes) {
                if (raw == null) continue;
                String[] parts = raw.split(",");
                for (String part : parts) {
                    String type = part.trim().toLowerCase(java.util.Locale.ROOT);
                    if (type.isEmpty() || "*".equals(type) || ".*".equals(type)) continue;
                    if (type.startsWith(".")) {
                        String extension = type.substring(1);
                        if ("jpg".equals(extension) || "jpeg".equals(extension)) type = "image/jpeg";
                        else if ("png".equals(extension)) type = "image/png";
                        else if ("webp".equals(extension)) type = "image/webp";
                        else if ("gif".equals(extension)) type = "image/gif";
                        else if ("mp4".equals(extension)) type = "video/mp4";
                        else if ("mov".equals(extension)) type = "video/quicktime";
                        else if ("webm".equals(extension)) type = "video/webm";
                        else continue;
                    }
                    if (!types.contains(type)) types.add(type);
                }
            }
        }
        return types.toArray(new String[0]);
    }

    private void persistReadPermission(Uri uri) {
        try {
            getContentResolver().takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
            );
        } catch (Exception ignored) {
            // Galeri sağlayıcıları kalıcı izin vermeyebilir; anlık grant yeterlidir.
        }
    }
}
