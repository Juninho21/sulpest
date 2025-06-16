# Regras do ProGuard para o SafePrag

# Manter a classe WebView e suas interfaces JavaScript
-keepclassmembers class com.safeprag.app.MainActivity {
    public *;
}
-keepattributes JavascriptInterface

# Otimizações gerais
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-dontpreverify
-verbose

# Manter informações de linha para stack traces em produção
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Remover logs e debugging
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
    public static *** w(...);
    public static *** e(...);
}
