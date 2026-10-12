package com.Praveen.Arrivo;

import android.content.Context;
import android.content.Intent;
import android.content.IntentSender;
import android.location.LocationManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.common.api.ResolvableApiException;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.LocationSettingsRequest;
import com.google.android.gms.location.LocationSettingsResponse;
import com.google.android.gms.location.Priority;
import com.google.android.gms.location.SettingsClient;
import com.google.android.gms.tasks.Task;

@CapacitorPlugin(name = "LocationEnabler")
public class LocationEnablerPlugin extends Plugin {

    @PluginMethod
    public void isLocationEnabled(PluginCall call) {
        boolean enabled = checkIsLocationEnabled();
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void enableLocation(PluginCall call) {
        try {
            LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000)
                    .setMinUpdateIntervalMillis(500)
                    .build();

            LocationSettingsRequest.Builder builder = new LocationSettingsRequest.Builder()
                    .addLocationRequest(locationRequest)
                    .setAlwaysShow(true);

            SettingsClient client = LocationServices.getSettingsClient(getActivity());
            Task<LocationSettingsResponse> task = client.checkLocationSettings(builder.build());

            task.addOnSuccessListener(getActivity(), locationSettingsResponse -> {
                JSObject ret = new JSObject();
                ret.put("enabled", true);
                call.resolve(ret);
            });

            task.addOnFailureListener(getActivity(), e -> {
                if (e instanceof ResolvableApiException) {
                    try {
                        ResolvableApiException resolvable = (ResolvableApiException) e;
                        MainActivity activity = (MainActivity) getActivity();
                        if (activity != null) {
                            activity.setPendingLocationCall(call);
                            resolvable.startResolutionForResult(activity, MainActivity.REQUEST_CHECK_SETTINGS);
                            return;
                        }
                    } catch (IntentSender.SendIntentException sendEx) {
                        openLocationSettings(call);
                        return;
                    }
                }
                openLocationSettings(call);
            });
        } catch (Exception ex) {
            openLocationSettings(call);
        }
    }

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("opened", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not open location settings: " + e.getMessage());
        }
    }

    private boolean checkIsLocationEnabled() {
        try {
            LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            if (lm == null) return false;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                return lm.isLocationEnabled();
            } else {
                return lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                       lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
            }
        } catch (Exception e) {
            return false;
        }
    }
}
