package app.lovable.timelesszenith;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Immersive kiosk-style activity: the web app draws edge to edge, behind the
 * status bar and the navigation bar, and only leaves the punch-hole cutout
 * area free (handled in CSS via env(safe-area-inset-top)).
 */
public class MainActivity extends BridgeActivity {

    private static volatile boolean foreground = false;

    public static boolean isForeground() {
        return foreground;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TelephonyPlugin.class);
        registerPlugin(NativeAlarmPlugin.class);
        registerPlugin(ExitGuardPlugin.class);
        super.onCreate(savedInstanceState);
        ExitGuardPlugin.syncFromStore(this);
        GuardStore.startWatch(this);
        applyImmersive();
    }

    /** Fired when the user presses Home / Recents — the "trying to exit" moment. */
    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (ExitGuardPlugin.isBlocked()) ExitGuardPlugin.show(this);
    }

    @Override
    public void onBackPressed() {
        if (ExitGuardPlugin.isBlocked()) {
            ExitGuardPlugin.show(this);
            return;
        }
        super.onBackPressed();
    }

    @Override
    public void onPause() {
        super.onPause();
        foreground = false;
        ExitGuardPlugin.syncFromStore(this);
        if (ExitGuardPlugin.isBlocked()) ExitGuardPlugin.show(this);
    }

    @Override
    public void onResume() {
        super.onResume();
        foreground = true;
        ExitGuardPlugin.syncFromStore(this);
        GuardStore.startWatch(this);
        ExitGuardPlugin.hide(this);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            foreground = true;
            ExitGuardPlugin.hide(this);
            applyImmersive();
        } else if (ExitGuardPlugin.isBlocked()) {
            ExitGuardPlugin.show(this);
        }
    }

    private void applyImmersive() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams params = getWindow().getAttributes();
            params.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(params);
        }

        WindowInsetsControllerCompat controller =
            new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.navigationBars());
        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
