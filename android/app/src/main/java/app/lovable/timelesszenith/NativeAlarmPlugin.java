package app.lovable.timelesszenith;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plays a real alarm-stream ringtone with a wake lock, so alerts fire even when
 * the screen is off and the WebView's audio is throttled.
 */
@CapacitorPlugin(name = "NativeAlarm")
public class NativeAlarmPlugin extends Plugin {

    private MediaPlayer player;
    private PowerManager.WakeLock wakeLock;

    @PluginMethod
    public void ring(PluginCall call) {
        int seconds = call.getInt("seconds", 6);
        boolean strong = Boolean.TRUE.equals(call.getBoolean("strong", false));
        try {
            acquireWake(seconds + 5);
            vibrate(strong);
            stopPlayer();

            Uri uri = RingtoneManager.getDefaultUri(strong ? RingtoneManager.TYPE_ALARM : RingtoneManager.TYPE_NOTIFICATION);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

            player = new MediaPlayer();
            player.setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            );
            player.setDataSource(getContext(), uri);
            player.setLooping(true);
            player.prepare();
            player.start();

            final int ms = Math.max(1, seconds) * 1000;
            new android.os.Handler(getContext().getMainLooper()).postDelayed(this::stopPlayer, ms);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not play the alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopPlayer();
        call.resolve();
    }

    private void vibrate(boolean strong) {
        try {
            Vibrator v = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null) return;
            long[] pattern = strong
                ? new long[] { 0, 600, 200, 600, 200, 900 }
                : new long[] { 0, 300, 150, 300, 150, 500 };
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createWaveform(pattern, -1));
            } else {
                v.vibrate(pattern, -1);
            }
        } catch (Exception ignored) {
        }
    }

    private void acquireWake(int seconds) {
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (pm == null) return;
            if (wakeLock == null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "flowtracker:alarm");
                wakeLock.setReferenceCounted(false);
            }
            wakeLock.acquire(seconds * 1000L);
        } catch (Exception ignored) {
        }
    }

    private void stopPlayer() {
        try {
            if (player != null) {
                if (player.isPlaying()) player.stop();
                player.release();
            }
        } catch (Exception ignored) {
        } finally {
            player = null;
            try {
                if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
            } catch (Exception ignored) {
            }
        }
    }

    @SuppressWarnings("unused")
    private AudioManager unusedAudioManager() {
        return (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }
}
