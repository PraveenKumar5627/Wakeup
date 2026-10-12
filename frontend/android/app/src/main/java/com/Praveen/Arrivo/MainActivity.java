package com.Praveen.Arrivo;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;

public class MainActivity extends BridgeActivity {
    public static final int REQUEST_CHECK_SETTINGS = 1001;
    private PluginCall pendingLocationCall = null;

    public void setPendingLocationCall(PluginCall call) {
        this.pendingLocationCall = call;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocationEnablerPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_CHECK_SETTINGS) {
            if (pendingLocationCall != null) {
                JSObject ret = new JSObject();
                if (resultCode == RESULT_OK) {
                    ret.put("enabled", true);
                } else {
                    ret.put("enabled", false);
                }
                pendingLocationCall.resolve(ret);
                pendingLocationCall = null;
            }
        }
    }
}
