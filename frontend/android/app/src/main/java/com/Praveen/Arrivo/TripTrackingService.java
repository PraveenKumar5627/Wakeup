package com.Praveen.Arrivo;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

public class TripTrackingService extends Service {
    public static final String CHANNEL_ID = "arraivo_trip_channel";
    public static final int NOTIFICATION_ID = 2026;
    public static final String ACTION_START = "ACTION_START";
    public static final String ACTION_STOP = "ACTION_STOP";
    public static final String EXTRA_TITLE = "EXTRA_TITLE";
    public static final String EXTRA_TEXT = "EXTRA_TEXT";

    private PowerManager.WakeLock wakeLock = null;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_STOP.equals(action)) {
                stopForegroundService();
                return START_NOT_STICKY;
            }

            String title = intent.getStringExtra(EXTRA_TITLE);
            String text = intent.getStringExtra(EXTRA_TEXT);
            if (title == null || title.isEmpty()) title = "Arraivo Trip Active";
            if (text == null || text.isEmpty()) text = "Tracking your location to wake you up on time...";

            Notification notification = buildNotification(title, text);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }

            acquireWakeLock();
        }
        return START_STICKY;
    }

    private void acquireWakeLock() {
        if (wakeLock == null) {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Arraivo::TripTrackingWakeLock");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire(4 * 60 * 60 * 1000L); // 4 hours maximum
            }
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {}
            wakeLock = null;
        }
    }

    private void stopForegroundService() {
        releaseWakeLock();
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        releaseWakeLock();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Arraivo Travel Tracking",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows active trip navigation and wake-up alarm tracking status");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification(String title, String text) {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }
}
