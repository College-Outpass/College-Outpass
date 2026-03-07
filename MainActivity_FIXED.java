package com.srichaitanya.outpass;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebStorage;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MainActivity";
    private static final int CAMERA_PERMISSION_REQUEST = 100;

    private WebView webView;
    private ValueCallback<Uri[]> fileUploadCallback;
    private ActivityResultLauncher<Intent> fileChooserLauncher;
    private boolean isDesktopMode = false;

    // CAMERA FIX: Added variables for camera support
    private String cameraPhotoPath;
    private Uri cameraPhotoUri;
    
    // FIX: Store FileChooserParams to reopen after permission grant
    private WebChromeClient.FileChooserParams pendingFileChooserParams;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Show action bar for menu
        if (getSupportActionBar() != null) {
            getSupportActionBar().setTitle("SCTS Outpass");
        }

        // Clear only WebStorage
        WebStorage.getInstance().deleteAllData();

        // Initialize WebView
        webView = findViewById(R.id.webview);

        // Configure WebView
        setupWebView();

        // Download Listener
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            Log.d(TAG, "Download started - URL: " + url);
            if (url.startsWith("blob:")) {
                handleBlobDownload(url, mimetype);
            } else {
                downloadFile(url, contentDisposition, mimetype);
            }
        });

        // JavaScript Interface
        webView.addJavascriptInterface(new Object() {
            @SuppressWarnings("unused")
            @android.webkit.JavascriptInterface
            public void processBlob(String base64Data, String fileType) {
                runOnUiThread(() -> {
                    try {
                        String base64 = base64Data.substring(base64Data.indexOf(",") + 1);
                        byte[] fileData = Base64.decode(base64, Base64.DEFAULT);
                        String fileName;
                        switch (fileType) {
                            case "pdf":
                                fileName = "Outpass_" + System.currentTimeMillis() + ".pdf";
                                break;
                            case "excel":
                                fileName = "Report_" + System.currentTimeMillis() + ".xlsx";
                                break;
                            case "csv":
                                fileName = "Data_" + System.currentTimeMillis() + ".csv";
                                break;
                            default:
                                fileName = "Download_" + System.currentTimeMillis() + ".file";
                                break;
                        }
                        saveFile(fileData, fileName, fileType);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "Download failed", Toast.LENGTH_SHORT).show();
                    }
                });
            }
        }, "AndroidInterface");

        // CAMERA FIX: Updated File Chooser to support camera
        fileChooserLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    Uri[] results = null;
                    if (result.getResultCode() == RESULT_OK) {
                        Intent data = result.getData();
                        if (data != null && data.getData() != null) {
                            // Gallery selection
                            Uri uri = data.getData();
                            if (uri != null) results = new Uri[]{uri};
                        } else if (cameraPhotoUri != null) {
                            // Camera photo taken
                            File file = new File(cameraPhotoPath);
                            if (file.exists()) {
                                results = new Uri[]{cameraPhotoUri};
                                Log.d(TAG, "Camera photo: " + cameraPhotoUri);
                            }
                        }
                    }
                    if (fileUploadCallback != null) {
                        fileUploadCallback.onReceiveValue(results);
                        fileUploadCallback = null;
                    }
                    // Clean up
                    cameraPhotoPath = null;
                    cameraPhotoUri = null;
                    pendingFileChooserParams = null;
                }
        );

        // WebViewClient
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("https://wa.me/") || url.startsWith("whatsapp://")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        intent.setPackage("com.whatsapp");
                        startActivity(intent);
                    } catch (Exception e) {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    }
                    return true;
                }
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    if (!url.contains("college-out-pass-system-62552.web.app")) {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                        return true;
                    }
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Force desktop layout if desktop mode is enabled
                if (isDesktopMode) {
                    String javascript =
                            "(function() {" +
                                    "  var viewport = document.querySelector('meta[name=viewport]');" +
                                    "  if (viewport) {" +
                                    "    viewport.setAttribute('content', 'width=1024');" +
                                    "  } else {" +
                                    "    var meta = document.createElement('meta');" +
                                    "    meta.name = 'viewport';" +
                                    "    meta.content = 'width=1024';" +
                                    "    document.head.appendChild(meta);" +
                                    "  }" +
                                    "  document.body.style.minWidth = '1024px';" +
                                    "})()";
                    view.evaluateJavascript(javascript, null);
                    Log.d(TAG, "Desktop layout forced with viewport width=1024");
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    Log.e(TAG, "Error: " + error.getDescription());
                }
            }
        });

        // CAMERA FIX: Updated WebChromeClient with improved camera support
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                
                // FIX: Store callback and params even if permission is needed
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = filePathCallback;
                pendingFileChooserParams = fileChooserParams;

                // Check if camera is needed based on the file chooser params
                boolean isCaptureEnabled = fileChooserParams.isCaptureEnabled();
                String[] acceptTypes = fileChooserParams.getAcceptTypes();
                boolean acceptImage = acceptTypes.length > 0 &&
                        "image/*".equals(acceptTypes[0]);

                try {
                    // Create camera intent only if needed
                    Intent takePictureIntent = null;
                    if (isCaptureEnabled || acceptImage) {
                        // Check camera permission
                        if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                                != PackageManager.PERMISSION_GRANTED) {
                            
                            // FIX: Request permission and keep callback alive
                            Log.d(TAG, "Requesting camera permission...");
                            ActivityCompat.requestPermissions(MainActivity.this,
                                    new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
                            
                            // Return true to keep the callback alive
                            // The file chooser will be opened in onRequestPermissionsResult
                            return true;
                        }

                        // Permission already granted, proceed with camera
                        takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                        if (takePictureIntent.resolveActivity(getPackageManager()) != null) {
                            File photoFile = createImageFile();
                            if (photoFile != null) {
                                cameraPhotoPath = photoFile.getAbsolutePath();
                                cameraPhotoUri = FileProvider.getUriForFile(MainActivity.this,
                                        getApplicationContext().getPackageName() + ".fileprovider",
                                        photoFile);
                                takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri);
                                takePictureIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                takePictureIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                            }
                        }
                    }

                    // Create gallery intent
                    Intent contentSelectionIntent = new Intent(Intent.ACTION_GET_CONTENT);
                    contentSelectionIntent.addCategory(Intent.CATEGORY_OPENABLE);
                    contentSelectionIntent.setType("image/*");

                    // Create chooser
                    Intent chooserIntent = new Intent(Intent.ACTION_CHOOSER);
                    chooserIntent.putExtra(Intent.EXTRA_INTENT, contentSelectionIntent);
                    chooserIntent.putExtra(Intent.EXTRA_TITLE, "Select Image");
                    if (takePictureIntent != null) {
                        chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{takePictureIntent});
                    }

                    fileChooserLauncher.launch(chooserIntent);
                    return true;

                } catch (Exception e) {
                    Log.e(TAG, "File chooser error", e);
                    if (filePathCallback != null) {
                        filePathCallback.onReceiveValue(null);
                    }
                    fileUploadCallback = null;
                    pendingFileChooserParams = null;
                    return false;
                }
            }

            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                super.onProgressChanged(view, newProgress);
            }
        });

        // Back Button
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });

        // Load URL
        webView.loadUrl("https://college-out-pass-system-62552.web.app/");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        
        if (requestCode == CAMERA_PERMISSION_REQUEST) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                // FIX: Permission granted - automatically reopen file chooser
                Log.d(TAG, "Camera permission granted, reopening file chooser...");
                
                // Use a post to ensure the permission dialog is fully dismissed
                webView.post(() -> {
                    // Reopen file chooser with stored params
                    if (pendingFileChooserParams != null && fileUploadCallback != null) {
                        // Trigger file chooser again by calling onShowFileChooser
                        onShowFileChooser(webView, fileUploadCallback, pendingFileChooserParams);
                    } else {
                        // Fallback: trigger a click on file input via JavaScript
                        webView.evaluateJavascript(
                            "(function() {" +
                            "  var inputs = document.querySelectorAll('input[type=file]');" +
                            "  if (inputs.length > 0) {" +
                            "    inputs[inputs.length - 1].click();" +
                            "  }" +
                            "})();",
                            null
                        );
                    }
                });
            } else {
                // Permission denied - show message and cancel callback
                Toast.makeText(this, "Camera permission denied. You can still choose from gallery.", Toast.LENGTH_SHORT).show();
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                    fileUploadCallback = null;
                }
                pendingFileChooserParams = null;
            }
        }
    }
    
    // FIX: Helper method to reopen file chooser after permission grant
    private boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                     WebChromeClient.FileChooserParams fileChooserParams) {
        // This is the same logic as in WebChromeClient.onShowFileChooser
        // but we can call it directly after permission is granted
        if (fileUploadCallback != null) {
            fileUploadCallback.onReceiveValue(null);
        }
        fileUploadCallback = filePathCallback;

        boolean isCaptureEnabled = fileChooserParams.isCaptureEnabled();
        String[] acceptTypes = fileChooserParams.getAcceptTypes();
        boolean acceptImage = acceptTypes.length > 0 && "image/*".equals(acceptTypes[0]);

        try {
            Intent takePictureIntent = null;
            if (isCaptureEnabled || acceptImage) {
                // Permission is now granted, create camera intent
                takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                if (takePictureIntent.resolveActivity(getPackageManager()) != null) {
                    File photoFile = createImageFile();
                    if (photoFile != null) {
                        cameraPhotoPath = photoFile.getAbsolutePath();
                        cameraPhotoUri = FileProvider.getUriForFile(MainActivity.this,
                                getApplicationContext().getPackageName() + ".fileprovider",
                                photoFile);
                        takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri);
                        takePictureIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        takePictureIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    }
                }
            }

            Intent contentSelectionIntent = new Intent(Intent.ACTION_GET_CONTENT);
            contentSelectionIntent.addCategory(Intent.CATEGORY_OPENABLE);
            contentSelectionIntent.setType("image/*");

            Intent chooserIntent = new Intent(Intent.ACTION_CHOOSER);
            chooserIntent.putExtra(Intent.EXTRA_INTENT, contentSelectionIntent);
            chooserIntent.putExtra(Intent.EXTRA_TITLE, "Select Image");
            if (takePictureIntent != null) {
                chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{takePictureIntent});
            }

            fileChooserLauncher.launch(chooserIntent);
            return true;

        } catch (Exception e) {
            Log.e(TAG, "File chooser error after permission", e);
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(null);
            }
            fileUploadCallback = null;
            return false;
        }
    }

    // CAMERA FIX: Added method to create image file
    private File createImageFile() throws IOException {
        String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
        String imageFileName = "JPEG_" + timeStamp + "_";
        File storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        if (storageDir == null || !storageDir.exists()) {
            storageDir = getFilesDir();
        }
        return File.createTempFile(imageFileName, ".jpg", storageDir);
    }

    private void setupWebView() {
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        if (isDesktopMode) {
            webSettings.setUseWideViewPort(true);
            webSettings.setLoadWithOverviewMode(true);
            webSettings.setBuiltInZoomControls(true);
            webSettings.setDisplayZoomControls(false);
            webSettings.setSupportZoom(true);
            String desktopUA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
            webSettings.setUserAgentString(desktopUA);
        } else {
            webSettings.setUseWideViewPort(false);
            webSettings.setLoadWithOverviewMode(false);
            webSettings.setBuiltInZoomControls(false);
            webSettings.setSupportZoom(false);
            webSettings.setUserAgentString(null);
        }
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
        webSettings.setLoadsImagesAutomatically(true);
        webSettings.setBlockNetworkImage(false);
        webSettings.setJavaScriptCanOpenWindowsAutomatically(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        }
        webSettings.setMediaPlaybackRequiresUserGesture(false);
        webSettings.setDatabaseEnabled(true);
    }

    // Create Chrome-style menu
    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.browser_menu, menu);
        // Update desktop site checkbox
        MenuItem desktopItem = menu.findItem(R.id.action_desktop_site);
        if (desktopItem != null) {
            desktopItem.setChecked(isDesktopMode);
        }
        return true;
    }

    // Handle menu clicks
    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        int id = item.getItemId();
        if (id == R.id.action_refresh) {
            webView.reload();
            Toast.makeText(this, "Refreshing...", Toast.LENGTH_SHORT).show();
            return true;
        }
        else if (id == R.id.action_forward) {
            if (webView.canGoForward()) {
                webView.goForward();
            } else {
                Toast.makeText(this, "Can't go forward", Toast.LENGTH_SHORT).show();
            }
            return true;
        }
        else if (id == R.id.action_desktop_site) {
            isDesktopMode = !isDesktopMode;
            item.setChecked(isDesktopMode);
            setupWebView();
            webView.reload();
            String mode = isDesktopMode ? "Desktop" : "Mobile";
            Toast.makeText(this, mode + " site enabled", Toast.LENGTH_SHORT).show();
            return true;
        }
        else if (id == R.id.action_share) {
            shareCurrentPage();
            return true;
        }
        else if (id == R.id.action_clear_data) {
            clearBrowserData();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    // Share current page
    private void shareCurrentPage() {
        String url = webView.getUrl();
        if (url != null) {
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("text/plain");
            shareIntent.putExtra(Intent.EXTRA_TEXT, url);
            startActivity(Intent.createChooser(shareIntent, "Share via"));
        }
    }

    // Clear browser data
    private void clearBrowserData() {
        webView.clearCache(true);
        webView.clearHistory();
        webView.clearFormData();
        CookieManager.getInstance().removeAllCookies(null);
        WebStorage.getInstance().deleteAllData();
        Toast.makeText(this, "Browser data cleared", Toast.LENGTH_SHORT).show();
        webView.reload();
    }

    private String getFileTypeFromMimeType(String mimetype) {
        if (mimetype != null) {
            if (mimetype.contains("pdf")) return "pdf";
            if (mimetype.contains("excel") || mimetype.contains("xlsx")) return "excel";
            if (mimetype.contains("csv")) return "csv";
        }
        return "file";
    }

    private void handleBlobDownload(String url, String mimetype) {
        String fileType = getFileTypeFromMimeType(mimetype);
        webView.evaluateJavascript(
                "(function() {" +
                        "  var xhr = new XMLHttpRequest();" +
                        "  xhr.open('GET', '" + url + "', true);" +
                        "  xhr.responseType = 'blob';" +
                        "  xhr.onload = function() {" +
                        "    var reader = new FileReader();" +
                        "    reader.readAsDataURL(xhr.response);" +
                        "    reader.onloadend = function() {" +
                        "      AndroidInterface.processBlob(reader.result, '" + fileType + "');" +
                        "    };" +
                        "  };" +
                        "  xhr.send();" +
                        "})();",
                null
        );
    }

    private void downloadFile(String url, String contentDisposition, String mimetype) {
        try {
            String fileName = URLUtil.guessFileName(url, contentDisposition, mimetype);
            if (mimetype != null) {
                if ((mimetype.contains("excel") || mimetype.contains("xlsx")) && !fileName.endsWith(".xlsx")) {
                    fileName += ".xlsx";
                } else if (mimetype.contains("csv") && !fileName.endsWith(".csv")) {
                    fileName += ".csv";
                } else if (mimetype.contains("pdf") && !fileName.endsWith(".pdf")) {
                    fileName += ".pdf";
                }
            }
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setMimeType(mimetype);
            request.setTitle(fileName);
            request.setDescription("Downloading...");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null) request.addRequestHeader("Cookie", cookies);
            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            if (dm != null) {
                dm.enqueue(request);
                Toast.makeText(this, "Downloading: " + fileName, Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            Toast.makeText(this, "Download failed", Toast.LENGTH_SHORT).show();
        }
    }

    private void saveFile(byte[] fileData, String fileName, String fileType) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                        new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, 200);
                return;
            }
        }
        try {
            File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!downloadsDir.exists()) downloadsDir.mkdirs();
            File file = new File(downloadsDir, fileName);
            FileOutputStream fos = new FileOutputStream(file);
            fos.write(fileData);
            fos.close();
            Toast.makeText(this, "✅ Saved: " + fileName, Toast.LENGTH_LONG).show();
            Intent intent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
            intent.setData(Uri.fromFile(file));
            sendBroadcast(intent);
        } catch (Exception e) {
            Toast.makeText(this, "❌ Save failed", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (webView != null) {
            webView.clearCache(true);
            webView.clearHistory();
        }
    }
}


