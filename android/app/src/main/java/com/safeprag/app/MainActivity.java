package com.safeprag.app;

import android.Manifest;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.view.View;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import android.widget.Toast;
import java.io.File;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private WebView webView;
    private static final int PERMISSION_REQUEST_CODE = 1001;
    private static final String[] REQUIRED_PERMISSIONS = {
        Manifest.permission.READ_EXTERNAL_STORAGE,
        Manifest.permission.WRITE_EXTERNAL_STORAGE
    };
    private static final String[] REQUIRED_PERMISSIONS_API_33 = {
        Manifest.permission.READ_MEDIA_IMAGES,
        Manifest.permission.READ_MEDIA_VIDEO,
        Manifest.permission.READ_MEDIA_AUDIO
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Verificar e solicitar permissões
        checkAndRequestPermissions();
        
        // Manter a tela ligada enquanto o app estiver em uso
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        
        // Inicializar o WebView
        webView = findViewById(R.id.webview);
        
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);  // Habilitar JavaScript
        webSettings.setDomStorageEnabled(true);  // Habilitar DOM Storage
        webSettings.setDatabaseEnabled(true);    // Habilitar Database
        webSettings.setAllowFileAccess(true);    // Permitir acesso a arquivos
        webSettings.setAllowContentAccess(true); // Permitir acesso a conteúdo
        webSettings.setAllowFileAccessFromFileURLs(true); // Permitir acesso a arquivos de URLs de arquivo
        webSettings.setAllowUniversalAccessFromFileURLs(true); // Permitir acesso universal de URLs de arquivo
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT); // Usar cache quando possível
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW); // Permitir conteúdo misto
        webSettings.setLoadWithOverviewMode(true); // Carregar com visão geral
        webSettings.setUseWideViewPort(true); // Usar viewport amplo
        webSettings.setBuiltInZoomControls(true); // Habilitar controles de zoom
        webSettings.setDisplayZoomControls(false); // Ocultar controles de zoom na tela
        webSettings.setSupportZoom(true); // Suportar zoom
        // O método setAppCacheEnabled foi removido pois está obsoleto nas versões recentes do Android
        // O cache é gerenciado automaticamente pelo WebView moderno
        webSettings.setMediaPlaybackRequiresUserGesture(false); // Permitir reprodução de mídia automática
        
        // Configurar o WebViewClient para tratar navegação dentro do WebView
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                android.util.Log.d("SafePrag", "URL interceptada: " + url);
                
                // Verificar se é uma URL blob
                if (url.startsWith("blob:")) {
                    android.util.Log.d("SafePrag", "URL blob detectada: " + url);
                    Toast.makeText(MainActivity.this, "Detectado download blob - processando...", Toast.LENGTH_SHORT).show();
                    
                    // Injetar JavaScript para converter blob em download
                    String javascript = 
                        "(function() {" +
                        "  try {" +
                        "    fetch('" + url + "')" +
                        "      .then(response => response.blob())" +
                        "      .then(blob => {" +
                        "        const reader = new FileReader();" +
                        "        reader.onload = function() {" +
                        "          const base64 = reader.result.split(',')[1];" +
                        "          Android.downloadBase64('data:application/pdf;base64,' + base64, 'relatorio_safeprag_' + Date.now() + '.pdf');" +
                        "        };" +
                        "        reader.readAsDataURL(blob);" +
                        "      })" +
                        "      .catch(err => {" +
                        "        console.error('Erro ao processar blob:', err);" +
                        "        Android.showToast('Erro ao processar download: ' + err.message);" +
                        "      });" +
                        "  } catch(e) {" +
                        "    console.error('Erro no JavaScript:', e);" +
                        "    Android.showToast('Erro no processamento: ' + e.message);" +
                        "  }" +
                        "})();";
                    
                    view.evaluateJavascript(javascript, null);
                    return true; // Interceptar a URL blob
                }
                
                // Verificar se é um arquivo para download
                if (url.endsWith(".pdf") || 
                    url.contains("download") || 
                    url.contains(".pdf?") ||
                    url.contains("application/pdf") ||
                    url.contains("Content-Type: application/pdf")) {
                    
                    android.util.Log.d("SafePrag", "URL de download detectada: " + url);
                    
                    // Iniciar download manualmente
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    request.setMimeType("application/pdf");
                    request.setDescription("Download de relatório SafePrag");
                    request.setTitle("relatorio_safeprag_" + System.currentTimeMillis() + ".pdf");
                    request.allowScanningByMediaScanner();
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "relatorio_safeprag_" + System.currentTimeMillis() + ".pdf");
                    
                    DownloadManager downloadManager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    if (downloadManager != null) {
                        downloadManager.enqueue(request);
                        Toast.makeText(MainActivity.this, "Download iniciado - Verifique a pasta Downloads", Toast.LENGTH_LONG).show();
                    }
                    
                    return true; // Interceptar a URL
                }
                
                // Para outras URLs, carregar normalmente
                return false;
            }
            
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                android.util.Log.d("SafePrag", "Página iniciada: " + url);
            }
            
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                android.util.Log.d("SafePrag", "Página carregada: " + url);
                
                // Injetar JavaScript para interceptar downloads de blob
                String interceptScript = 
                    "(function() {" +
                    "  // Interceptar cliques em links" +
                    "  document.addEventListener('click', function(e) {" +
                    "    const target = e.target.closest('a, button');" +
                    "    if (target) {" +
                    "      const href = target.href || target.getAttribute('data-href');" +
                    "      if (href && href.startsWith('blob:')) {" +
                    "        e.preventDefault();" +
                    "        console.log('Interceptando blob URL:', href);" +
                    "        Android.showToast('Processando download...');" +
                    "        " +
                    "        fetch(href)" +
                    "          .then(response => response.blob())" +
                    "          .then(blob => {" +
                    "            const reader = new FileReader();" +
                    "            reader.onload = function() {" +
                    "              const base64 = reader.result.split(',')[1];" +
                    "              const fileName = 'relatorio_safeprag_' + Date.now() + '.pdf';" +
                    "              Android.downloadBase64('data:application/pdf;base64,' + base64, fileName);" +
                    "            };" +
                    "            reader.readAsDataURL(blob);" +
                    "          })" +
                    "          .catch(err => {" +
                    "            console.error('Erro ao processar blob:', err);" +
                    "            Android.showToast('Erro ao processar download: ' + err.message);" +
                    "          });" +
                    "      }" +
                    "    }" +
                    "  }, true);" +
                    "  " +
                    "  // Interceptar mudanças no window.location" +
                    "  const originalAssign = window.location.assign;" +
                    "  window.location.assign = function(url) {" +
                    "    if (url.startsWith('blob:')) {" +
                    "      console.log('Interceptando location.assign blob:', url);" +
                    "      Android.showToast('Processando download via location...');" +
                    "      " +
                    "      fetch(url)" +
                    "        .then(response => response.blob())" +
                    "        .then(blob => {" +
                    "          const reader = new FileReader();" +
                    "          reader.onload = function() {" +
                    "            const base64 = reader.result.split(',')[1];" +
                    "            const fileName = 'relatorio_safeprag_' + Date.now() + '.pdf';" +
                    "            Android.downloadBase64('data:application/pdf;base64,' + base64, fileName);" +
                    "          };" +
                    "          reader.readAsDataURL(blob);" +
                    "        })" +
                    "        .catch(err => {" +
                    "          console.error('Erro ao processar blob via location:', err);" +
                    "          Android.showToast('Erro ao processar download: ' + err.message);" +
                    "        });" +
                    "    } else {" +
                    "      originalAssign.call(window.location, url);" +
                    "    }" +
                    "  };" +
                    "  " +
                    "  console.log('SafePrag: Script de interceptação de blob carregado');" +
                    "})();";
                
                view.evaluateJavascript(interceptScript, null);
            }
        });
        
        // Configurar o WebChromeClient para recursos avançados
        webView.setWebChromeClient(new WebChromeClient());
        
        // Configurar o DownloadListener
           webView.setDownloadListener(new DownloadListener() {
               @Override
               public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                   android.util.Log.d("SafePrag", "DownloadListener ativado - URL: " + url + ", MimeType: " + mimeType);
                   
                   // Verificar se é uma URL blob
                   if (url.startsWith("blob:")) {
                       android.util.Log.d("SafePrag", "DownloadListener detectou blob URL: " + url);
                       Toast.makeText(MainActivity.this, "Processando download blob via DownloadListener...", Toast.LENGTH_SHORT).show();
                       
                       // Usar JavaScript para converter blob em base64
                       String javascript = 
                           "(function() {" +
                           "  try {" +
                           "    fetch('" + url + "')" +
                           "      .then(response => response.blob())" +
                           "      .then(blob => {" +
                           "        const reader = new FileReader();" +
                           "        reader.onload = function() {" +
                           "          const base64 = reader.result.split(',')[1];" +
                           "          const fileName = 'relatorio_safeprag_' + Date.now() + '.pdf';" +
                           "          Android.downloadBase64('data:application/pdf;base64,' + base64, fileName);" +
                           "        };" +
                           "        reader.readAsDataURL(blob);" +
                           "      })" +
                           "      .catch(err => {" +
                           "        console.error('Erro no DownloadListener blob:', err);" +
                           "        Android.showToast('Erro no DownloadListener: ' + err.message);" +
                           "      });" +
                           "  } catch(e) {" +
                           "    console.error('Erro no JavaScript DownloadListener:', e);" +
                           "    Android.showToast('Erro no processamento DownloadListener: ' + e.message);" +
                           "  }" +
                           "})();";
                       
                       webView.evaluateJavascript(javascript, null);
                   } else {
                       // Para URLs normais, usar o método tradicional
                       downloadFile(url, userAgent, contentDisposition, mimeType);
                   }
               }
           });
          
          // Adicionar interface JavaScript para downloads
          webView.addJavascriptInterface(new WebAppInterface(), "Android");
        
        // Otimizar renderização
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        
        // Carregar a URL do site
        webView.loadUrl("https://safeprag-final.vercel.app/");
    }
    
    @Override
    public void onBackPressed() {
        // Permitir navegação para trás no WebView se possível
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
    
    private void checkAndRequestPermissions() {
        String[] permissionsToRequest;
        
        // Verificar a versão do Android para usar as permissões corretas
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ (API 33+) - usar permissões granulares de mídia
            permissionsToRequest = REQUIRED_PERMISSIONS_API_33;
        } else {
            // Android 12 e anteriores - usar permissões de armazenamento externo
            permissionsToRequest = REQUIRED_PERMISSIONS;
        }
        
        // Verificar quais permissões ainda não foram concedidas
        java.util.List<String> permissionsNeeded = new java.util.ArrayList<>();
        for (String permission : permissionsToRequest) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(permission);
            }
        }
        
        // Solicitar permissões se necessário
        if (!permissionsNeeded.isEmpty()) {
            ActivityCompat.requestPermissions(this, 
                permissionsNeeded.toArray(new String[0]), 
                PERMISSION_REQUEST_CODE);
        }
    }
    
    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        
        if (requestCode == PERMISSION_REQUEST_CODE) {
            boolean allPermissionsGranted = true;
            for (int result : grantResults) {
                if (result != PackageManager.PERMISSION_GRANTED) {
                    allPermissionsGranted = false;
                    break;
                }
            }
            
            if (allPermissionsGranted) {
                Toast.makeText(this, "Permissões concedidas! Agora você pode baixar e compartilhar arquivos.", 
                    Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "Algumas permissões foram negadas. O download e compartilhamento de arquivos podem não funcionar corretamente.", 
                    Toast.LENGTH_LONG).show();
            }
         }
     }
     
     private void downloadFile(String url, String userAgent, String contentDisposition, String mimeType) {
          try {
              // Verificar se as permissões foram concedidas para versões anteriores ao Android 10
              if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                  if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                      Toast.makeText(this, "Permissão de armazenamento necessária para download", Toast.LENGTH_LONG).show();
                      checkAndRequestPermissions();
                      return;
                  }
              }
              
              // Obter o nome do arquivo
              String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
              
              // Se não conseguir obter o nome do arquivo, usar um nome padrão
              if (fileName == null || fileName.isEmpty()) {
                  if (mimeType != null && mimeType.contains("pdf")) {
                      fileName = "relatorio_safeprag_" + System.currentTimeMillis() + ".pdf";
                  } else {
                      fileName = "arquivo_" + System.currentTimeMillis();
                  }
              }
              
              // Garantir que arquivos PDF tenham a extensão correta
              if ((mimeType != null && mimeType.contains("pdf")) && !fileName.toLowerCase().endsWith(".pdf")) {
                  fileName += ".pdf";
              }
              
              // Configurar o DownloadManager
              DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
              
              // Definir o tipo MIME
              if (mimeType != null && !mimeType.isEmpty()) {
                  request.setMimeType(mimeType);
              } else {
                  request.setMimeType("application/pdf"); // Padrão para PDF
              }
              
              // Adicionar cabeçalhos
              if (userAgent != null && !userAgent.isEmpty()) {
                  request.addRequestHeader("User-Agent", userAgent);
              }
              request.addRequestHeader("Accept", "application/pdf,*/*");
              
              // Configurações do download
              request.setDescription("Download de relatório SafePrag");
              request.setTitle(fileName);
              request.allowScanningByMediaScanner();
              request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
              
              // Definir o destino do download
              request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
              
              // Iniciar o download
              DownloadManager downloadManager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
              if (downloadManager != null) {
                  long downloadId = downloadManager.enqueue(request);
                  Toast.makeText(this, "Download iniciado: " + fileName + "\nVerifique a pasta Downloads", Toast.LENGTH_LONG).show();
                  
                  // Log para debug
                  android.util.Log.d("SafePrag", "Download iniciado - URL: " + url + ", Arquivo: " + fileName);
              } else {
                  Toast.makeText(this, "Erro: DownloadManager não disponível", Toast.LENGTH_LONG).show();
              }
              
          } catch (Exception e) {
              Toast.makeText(this, "Erro ao iniciar download: " + e.getMessage(), Toast.LENGTH_LONG).show();
              android.util.Log.e("SafePrag", "Erro no download", e);
          }
      }
     
     // Método para abrir arquivo PDF após download (opcional)
     private void openPdfFile(String fileName) {
         try {
             File file = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), fileName);
             if (file.exists()) {
                 Uri fileUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", file);
                 Intent intent = new Intent(Intent.ACTION_VIEW);
                 intent.setDataAndType(fileUri, "application/pdf");
                 intent.setFlags(Intent.FLAG_ACTIVITY_NO_HISTORY);
                 intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                 
                 if (intent.resolveActivity(getPackageManager()) != null) {
                     startActivity(intent);
                 } else {
                     Toast.makeText(this, "Nenhum aplicativo encontrado para abrir PDF", Toast.LENGTH_SHORT).show();
                 }
             }
         } catch (Exception e) {
             Toast.makeText(this, "Erro ao abrir arquivo: " + e.getMessage(), Toast.LENGTH_SHORT).show();
         }
     }
     
     // Interface JavaScript para comunicação com a página web
      public class WebAppInterface {
          @android.webkit.JavascriptInterface
          public void downloadFile(String url) {
              android.util.Log.d("SafePrag", "Download solicitado via JavaScript: " + url);
              
              runOnUiThread(new Runnable() {
                  @Override
                  public void run() {
                      try {
                          DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                          request.setMimeType("application/pdf");
                          request.setDescription("Download de relatório SafePrag");
                          request.setTitle("relatorio_safeprag_" + System.currentTimeMillis() + ".pdf");
                          request.allowScanningByMediaScanner();
                          request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                          request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "relatorio_safeprag_" + System.currentTimeMillis() + ".pdf");
                          
                          DownloadManager downloadManager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                          if (downloadManager != null) {
                              downloadManager.enqueue(request);
                              Toast.makeText(MainActivity.this, "Download iniciado via JavaScript - Verifique a pasta Downloads", Toast.LENGTH_LONG).show();
                          }
                      } catch (Exception e) {
                          Toast.makeText(MainActivity.this, "Erro no download via JavaScript: " + e.getMessage(), Toast.LENGTH_LONG).show();
                          android.util.Log.e("SafePrag", "Erro no download via JavaScript", e);
                      }
                  }
              });
          }
          
          @android.webkit.JavascriptInterface
          public void downloadBase64(String base64Data, String fileName) {
              android.util.Log.d("SafePrag", "Download base64 solicitado: " + fileName);
              
              runOnUiThread(new Runnable() {
                  @Override
                  public void run() {
                      try {
                          // Verificar se as permissões foram concedidas para versões anteriores ao Android 10
                          if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                              if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                                  Toast.makeText(MainActivity.this, "Permissão de armazenamento necessária para download", Toast.LENGTH_LONG).show();
                                  checkAndRequestPermissions();
                                  return;
                              }
                          }
                          
                          // Decodificar base64
                          String base64String = base64Data;
                          if (base64String.startsWith("data:")) {
                              base64String = base64String.substring(base64String.indexOf(",") + 1);
                          }
                          
                          byte[] decodedBytes = android.util.Base64.decode(base64String, android.util.Base64.DEFAULT);
                          
                          // Criar arquivo na pasta Downloads
                          File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                          File file = new File(downloadsDir, fileName);
                          
                          // Escrever dados no arquivo
                          java.io.FileOutputStream fos = new java.io.FileOutputStream(file);
                          fos.write(decodedBytes);
                          fos.close();
                          
                          // Notificar o sistema sobre o novo arquivo
                          Intent intent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                          intent.setData(Uri.fromFile(file));
                          sendBroadcast(intent);
                          
                          Toast.makeText(MainActivity.this, "Download concluído: " + fileName + "\nSalvo em Downloads", Toast.LENGTH_LONG).show();
                          android.util.Log.d("SafePrag", "Arquivo salvo: " + file.getAbsolutePath());
                          
                      } catch (Exception e) {
                          Toast.makeText(MainActivity.this, "Erro ao salvar arquivo: " + e.getMessage(), Toast.LENGTH_LONG).show();
                          android.util.Log.e("SafePrag", "Erro ao salvar arquivo base64", e);
                      }
                  }
              });
          }
          
          @android.webkit.JavascriptInterface
          public void showToast(String message) {
              runOnUiThread(new Runnable() {
                  @Override
                  public void run() {
                      Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show();
                  }
              });
          }
      }
}
