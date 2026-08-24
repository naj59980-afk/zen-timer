package app.lovable.timelesszenith;

import android.Manifest;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CallLog;
import android.app.role.RoleManager;
import android.os.Build;
import android.telecom.TelecomManager;
import android.telephony.SmsManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;

/**
 * In-app dialer / messaging bridge so the app can place calls, read the call log
 * and the SMS inbox, and send texts without ever leaving the pinned kiosk screen.
 */
@CapacitorPlugin(
    name = "Telephony",
    permissions = {
        @Permission(alias = "phone", strings = { Manifest.permission.CALL_PHONE, Manifest.permission.READ_PHONE_STATE }),
        @Permission(alias = "calllog", strings = { Manifest.permission.READ_CALL_LOG }),
        @Permission(alias = "sms", strings = { Manifest.permission.READ_SMS, Manifest.permission.SEND_SMS, Manifest.permission.RECEIVE_SMS }),
        @Permission(alias = "contacts", strings = { Manifest.permission.READ_CONTACTS })
    }
)
public class TelephonyPlugin extends Plugin {

    private static final String[] ALL_ALIASES = { "phone", "calllog", "sms", "contacts" };

    @PluginMethod
    public void requestAll(PluginCall call) {
        requestPermissionForAliases(ALL_ALIASES, call, "permsResult");
    }

    @PermissionCallback
    private void permsResult(PluginCall call) {
        call.resolve(statusObject());
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(statusObject());
    }

    private JSObject statusObject() {
        JSObject o = new JSObject();
        for (String alias : ALL_ALIASES) {
            o.put(alias, "granted".equals(getPermissionState(alias).toString()));
        }
        o.put("native", true);
        return o;
    }

    /** Place a call directly from inside the app (no dialer hand-off). */
    /** Ask Android to make this app the default phone/dialer app. */
    @PluginMethod
    public void requestDefaultDialer(PluginCall call) {
        JSObject res = new JSObject();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                RoleManager rm = (RoleManager) getContext().getSystemService(android.content.Context.ROLE_SERVICE);
                boolean held = rm != null && rm.isRoleHeld(RoleManager.ROLE_DIALER);
                res.put("isDefault", held);
                if (!held && rm != null && rm.isRoleAvailable(RoleManager.ROLE_DIALER)) {
                    Intent i = rm.createRequestRoleIntent(RoleManager.ROLE_DIALER);
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(i);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                TelecomManager tm = (TelecomManager) getContext().getSystemService(android.content.Context.TELECOM_SERVICE);
                boolean held = tm != null && getContext().getPackageName().equals(tm.getDefaultDialerPackage());
                res.put("isDefault", held);
                if (!held) {
                    Intent i = new Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER);
                    i.putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, getContext().getPackageName());
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(i);
                }
            } else {
                res.put("isDefault", false);
            }
        } catch (Exception e) {
            res.put("isDefault", false);
        }
        call.resolve(res);
    }

    @PluginMethod
    public void call(PluginCall call) {
        String number = call.getString("number", "");
        if (number == null || number.trim().isEmpty()) {
            call.reject("A phone number is required");
            return;
        }
        if (!"granted".equals(getPermissionState("phone").toString())) {
            requestPermissionForAlias("phone", call, "permsResult");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_CALL, Uri.parse("tel:" + Uri.encode(number.trim())));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not place the call: " + e.getMessage());
        }
    }

    @PluginMethod
    public void sendSms(PluginCall call) {
        String number = call.getString("number", "");
        String body = call.getString("text", "");
        if (number == null || number.trim().isEmpty() || body == null || body.trim().isEmpty()) {
            call.reject("Number and message text are required");
            return;
        }
        if (!"granted".equals(getPermissionState("sms").toString())) {
            requestPermissionForAlias("sms", call, "permsResult");
            return;
        }
        try {
            SmsManager sms = SmsManager.getDefault();
            for (String part : sms.divideMessage(body)) {
                sms.sendTextMessage(number.trim(), null, part, null, null);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not send the message: " + e.getMessage());
        }
    }

    @PluginMethod
    public void callLog(PluginCall call) {
        int limit = call.getInt("limit", 100);
        if (!"granted".equals(getPermissionState("calllog").toString())) {
            call.reject("permission-denied");
            return;
        }
        JSArray out = new JSArray();
        Cursor c = null;
        try {
            c = getContext().getContentResolver().query(
                CallLog.Calls.CONTENT_URI,
                new String[] { CallLog.Calls._ID, CallLog.Calls.NUMBER, CallLog.Calls.CACHED_NAME, CallLog.Calls.TYPE, CallLog.Calls.DATE, CallLog.Calls.DURATION },
                null, null, CallLog.Calls.DATE + " DESC"
            );
            int n = 0;
            while (c != null && c.moveToNext() && n < limit) {
                JSObject o = new JSObject();
                o.put("id", c.getString(0));
                o.put("number", c.getString(1));
                o.put("name", c.getString(2));
                o.put("type", c.getInt(3));
                o.put("date", c.getLong(4));
                o.put("duration", c.getLong(5));
                out.put(o);
                n++;
            }
            JSObject res = new JSObject();
            res.put("items", out);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Could not read the call log: " + e.getMessage());
        } finally {
            if (c != null) c.close();
        }
    }

    @PluginMethod
    public void inbox(PluginCall call) throws JSONException {
        int limit = call.getInt("limit", 100);
        String box = call.getString("box", "inbox");
        if (!"granted".equals(getPermissionState("sms").toString())) {
            call.reject("permission-denied");
            return;
        }
        Uri uri = Uri.parse("sent".equals(box) ? "content://sms/sent" : "content://sms/inbox");
        JSArray out = new JSArray();
        Cursor c = null;
        try {
            c = getContext().getContentResolver().query(
                uri,
                new String[] { "_id", "address", "body", "date", "read" },
                null, null, "date DESC"
            );
            int n = 0;
            while (c != null && c.moveToNext() && n < limit) {
                JSObject o = new JSObject();
                o.put("id", c.getString(0));
                o.put("address", c.getString(1));
                o.put("body", c.getString(2));
                o.put("date", c.getLong(3));
                o.put("read", c.getInt(4) == 1);
                o.put("box", box);
                out.put(o);
                n++;
            }
            JSObject res = new JSObject();
            res.put("items", out);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Could not read messages: " + e.getMessage());
        } finally {
            if (c != null) c.close();
        }
    }
}
