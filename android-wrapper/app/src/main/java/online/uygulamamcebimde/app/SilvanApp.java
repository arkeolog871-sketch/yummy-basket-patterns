package online.uygulamamcebimde.app;

import android.app.Application;

public class SilvanApp extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        SilvanFcm.start(this);
    }
}
