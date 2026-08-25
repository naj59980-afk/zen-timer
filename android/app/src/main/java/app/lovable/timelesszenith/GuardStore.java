package app.lovable.timelesszenith;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

/**
 * Persisted guard state. Survives process death, force-stop-then-relaunch and
 * device reboots, so an override can expire (and the guard re-arm) without the
 * user ever opening the app again.
 */
public final class GuardStore {

    private static final String PREFS = "exit_guard";
    private static final String K_ON = "guard_on";
    private static final String K_BLOCKED = "blocked";
    private static final String K_REASON = "reason";
    private static final String K_UNTIL = "override_until";

    private GuardStore() {}

    private static SharedPreferences p(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static boolean guardOn(Context c) {
        return p(c).getBoolean(K_ON, true);
    }

    public static long overrideUntil(Context c) {
        return p(c).getLong(K_UNTIL, 0L);
    }

    public static boolean overrideActive(Context c) {
        return overrideUntil(c) > System.currentTimeMillis();
    }

    public static String reason(Context c) {
        return p(c).getString(K_REASON, "Stay in Flow — finish your quota or start leisure time.");
    }

    /** Blocked as far as the persisted state knows (override expiry included). */
    public static boolean blocked(Context c) {
        if (!guardOn(c)) return false;
        if (overrideActive(c)) return false;
        // once the override lapses we default to blocked, even if the web layer
        // never got a chance to push a fresh state (app killed / phone rebooted)
        if (overrideUntil(c) > 0L) return true;
        return p(c).getBoolean(K_BLOCKED, true);
    }

    public static void save(Context c, boolean guardOn, boolean blocked, String reason, long overrideUntil) {
        p(c).edit()
            .putBoolean(K_ON, guardOn)
            .putBoolean(K_BLOCKED, blocked)
            .putString(K_REASON, reason == null ? "" : reason)
            .putLong(K_UNTIL, overrideUntil)
            .apply();
    }

    /** Starts the always-on watchdog when the guard is armed. */
    public static void startWatch(Context c) {
        if (!guardOn(c)) return;
        Intent i = new Intent(c, ExitGuardService.class);
        i.setAction(ExitGuardService.ACTION_WATCH);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) c.startForegroundService(i);
            else c.startService(i);
        } catch (Exception ignored) {
        }
    }
}
