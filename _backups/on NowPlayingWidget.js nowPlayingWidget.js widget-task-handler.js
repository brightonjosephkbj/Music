[1mdiff --git a/app.json b/app.json[m
[1mindex cd38bf0..42576f7 100644[m
[1m--- a/app.json[m
[1m+++ b/app.json[m
[36m@@ -2,7 +2,7 @@[m
   "expo": {[m
     "name": "B24music",[m
     "slug": "b24sound",[m
[31m-    "version": "1.0.1",[m
[32m+[m[32m    "version": "1.1.0",[m
     "orientation": "portrait",[m
     "icon": "./assets/icon.png",[m
     "userInterfaceStyle": "light",[m
[36m@@ -80,15 +80,21 @@[m
             {[m
               "name": "NowPlaying",[m
               "label": "B24music Now Playing",[m
[31m-              "minWidth": "250dp",[m
[31m-              "minHeight": "80dp",[m
[32m+[m[32m              "minWidth": "110dp",[m
[32m+[m[32m              "minHeight": "40dp",[m
               "targetCellWidth": 4,[m
               "targetCellHeight": 1,[m
[31m-              "updatePeriodMillis": 1800000[m
[32m+[m[32m              "updatePeriodMillis": 1800000,[m
[32m+[m[32m              "resizeMode": "horizontal|vertical",[m
[32m+[m[32m              "minResizeWidth": "40dp",[m
[32m+[m[32m              "minResizeHeight": "40dp",[m
[32m+[m[32m              "maxResizeWidth": "600dp",[m
[32m+[m[32m              "maxResizeHeight": "400dp"[m
             }[m
           ][m
         }[m
[31m-      ][m
[32m+[m[32m      ],[m
[32m+[m[32m      "react-native-image-colors"[m
     ],[m
     "runtimeVersion": {[m
       "policy": "appVersion"[m
