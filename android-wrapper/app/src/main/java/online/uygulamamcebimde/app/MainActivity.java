package online.uygulamamcebimde.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.SslErrorHandler;
import android.net.http.SslError;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://yummy-basket-patterns.lovable.app/";
    private static final String APP_HOST = "yummy-basket-patterns.lovable.app";
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private WebView webView;
    private ValueCallback<Uri[]> fileChooserCallback;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                    new String[] {
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    },
                    1
            );
        }

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
        // Android galerisi/dosya seçici `content://` URI döndürür; WebView'ın seçilen medyayı
        // okuyabilmesi için content erişimi açık kalmalı. Yerel `file://` erişimi kapalıdır.
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        WebView.setWebContentsDebuggingEnabled(false);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return openAllowedUrlOrExternal(url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                return openAllowedUrlOrExternal(request.getUrl().toString());
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(
                    String origin,
                    GeolocationPermissions.Callback callback
            ) {
                Uri uri = Uri.parse(origin);
                boolean allowed = "https".equals(uri.getScheme()) && APP_HOST.equals(uri.getHost());
                callback.invoke(origin, allowed, false);
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

                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);

                String[] acceptTypes = normalizeAcceptTypes(params.getAcceptTypes());
                if (acceptTypes.length == 1) {
                    intent.setType(acceptTypes[0]);
                } else if (acceptTypes.length > 1) {
                    intent.setType("*/*");
                    intent.putExtra(Intent.EXTRA_MIME_TYPES, acceptTypes);
                } else {
                    intent.setType("*/*");
                    intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "image/*", "video/*" });
                }
                intent.putExtra(
                        Intent.EXTRA_ALLOW_MULTIPLE,
                        params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE
                );

                try {
                    startActivityForResult(
                            Intent.createChooser(intent, "Dosya seç"),
                            FILE_CHOOSER_REQUEST
                    );
                } catch (Exception ignored) {
                    fileChooserCallback = null;
                    return false;
                }
                return true;
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != FILE_CHOOSER_REQUEST) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        if (fileChooserCallback == null) {
            return;
        }
        Uri[] results = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                results = new Uri[count];
                for (int i = 0; i < count; i++) {
                    results[i] = data.getClipData().getItemAt(i).getUri();
                    persistReadPermission(results[i]);
                }
            } else if (data.getData() != null) {
                Uri uri = data.getData();
                persistReadPermission(uri);
                results = new Uri[] { uri };
            }
        }
        fileChooserCallback.onReceiveValue(results);
        fileChooserCallback = null;
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

    private boolean openAllowedUrlOrExternal(String rawUrl) {
        Uri uri = Uri.parse(rawUrl);
        String scheme = uri.getScheme();
        if ("about".equals(scheme)) {
            return false;
        }
        if ("https".equals(scheme) && APP_HOST.equals(uri.getHost())) {
            return false;
        }

        // Google Maps ve benzeri uygulamalar intent:// bağlantısı üretir; WebView bunu açamaz.
        if ("intent".equals(scheme)) {
            String fallbackUrl = null;
            try {
                Intent intent = Intent.parseUri(rawUrl, Intent.URI_INTENT_SCHEME);
                fallbackUrl = intent.getStringExtra("browser_fallback_url");
                intent.addCategory(Intent.CATEGORY_BROWSABLE);
                intent.setComponent(null);
                intent.setSelector(null);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
                return true;
            } catch (Exception ignored) {
                // Uygulama kurulu değilse web adresine düşülür.
            }
            if (fallbackUrl != null) {
                try {
                    Intent web = new Intent(Intent.ACTION_VIEW, Uri.parse(fallbackUrl));
                    web.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(web);
                } catch (Exception alsoIgnored) {
                    // Tarayıcı da yoksa sessizce vazgeç.
                }
            }
            return true;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception ignored) {
            // Do not load unknown schemes or hosts inside the WebView.
        }
        return true;
    }

    private String[] normalizeAcceptTypes(String[] rawTypes) {
        java.util.ArrayList<String> types = new java.util.ArrayList<>();
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
            // Bazı galeri sağlayıcıları kalıcı izin vermez; anlık izin WebView için yeterlidir.
        }
    }
}
