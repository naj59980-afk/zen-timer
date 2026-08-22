package app.lovable.timelesszenith;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridge for the "display over other apps" exit guard.
 *
 * The web layer pushes the current gate state (blocked / reason). When the user
 * leaves the activity while blocked, MainActivity asks ExitGuardService to draw
 * a blocking overlay on top of whatever they switched to.
 */
@CapacitorPlugin(name = "ExitGuard")
public class ExitGuardPlugin extends Plugin {

    private static volatile boolean blocked = false;
    private static volatile String reason = "";

    public static boolean isBlocked() {
        return blocked;
    }

    public static String reason() {
        return reason;
    }

    public static boolean canDrawOverlays(Context ctx) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(ctx);
    }

    public static void show(Context ctx) {
        if (!canDrawOverlays(ctx)) return;
        Intent i = new Intent(ctx, ExitGuardService.class);
        i.setAction(ExitGuardService.ACTION_SHOW);
        i.putExtra(ExitGuardService.EXTRA_REASON, reason);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i);
        else ctx.startService(i);
    }

    public static void hide(Context ctx) {
        Intent i = new Intent(ctx, ExitGuardService.class);
        i.setAction(ExitGuardService.ACTION_HIDE);
        try {
            ctx.startService(i);
        } catch (Exception ignored) {
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject o = new JSObject();
        o.put("native", true);
        o.put("overlay", canDrawOverlays(getContext()));
        o.put("blocked", blocked);
        call.resolve(o);
    }

    @PluginMethod
    public void requestOverlay(PluginCall call) {
        if (canDrawOverlays(getContext())) {
            JSObject o = new JSObject();
            o.put("overlay", true);
            call.resolve(o);
            return;
        }
        Intent i = new Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        JSObject o = new JSObject();
        o.put("overlay", false);
        call.resolve(o);
    }

    /** Push the current gate state from the web layer. */
    @PluginMethod
    public void setGuard(PluginCall call) {
        blocked = Boolean.TRUE.equals(call.getBoolean("blocked", false));
        String r = call.getString("reason");
        reason = r == null ? "" : r;
        if (!blocked) hide(getContext());
        call.resolve();
    }

    /** Manually dismiss the overlay (used when the app regains focus). */
    @PluginMethod
    public void dismiss(PluginCall call) {
        hide(getContext());
        call.resolve();
    }
}
