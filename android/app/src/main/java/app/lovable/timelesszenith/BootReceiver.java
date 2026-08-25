package app.lovable.timelesszenith;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Re-arms the guard after a reboot, a shutdown, or an app update — rebooting
 * used to be a free escape hatch.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        GuardStore.startWatch(context);
    }
}
