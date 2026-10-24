"""Run once after `flutter create`: adds camera/internet permissions and fixes minSdk for the plugins.
Usage:  python patch_platforms.py <path to the flutter project>"""
import pathlib
import sys

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")

# --- Android ---
man = root / "android/app/src/main/AndroidManifest.xml"
s = man.read_text()
if "android.permission.CAMERA" not in s:
    s = s.replace("<application", '<uses-permission android:name="android.permission.CAMERA"/>\n    <uses-permission android:name="android.permission.INTERNET"/>\n    <application', 1)
if "usesCleartextTraffic" not in s:  # lets the app talk to http://192.168.x.x during development; remove once the server has HTTPS
    s = s.replace("<application", '<application android:usesCleartextTraffic="true"', 1)
s = s.replace('android:label="cantrack_app"', 'android:label="CanTrack"')
man.write_text(s)

for name in ("build.gradle.kts", "build.gradle"):
    g = root / "android/app" / name
    if g.exists():
        t = g.read_text()
        g.write_text(t.replace("flutter.minSdkVersion", "23"))  # flutter_secure_storage needs Android 6+

# --- iOS ---
plist = root / "ios/Runner/Info.plist"
if plist.exists():
    p = plist.read_text()
    if "NSCameraUsageDescription" not in p:
        add = ("\t<key>NSCameraUsageDescription</key>\n\t<string>CanTrack uses the camera to scan position and plant QR codes.</string>\n"
               "\t<key>NSAppTransportSecurity</key>\n\t<dict><key>NSAllowsLocalNetworking</key><true/></dict>\n")
        p = p.replace("</dict>\n</plist>", add + "</dict>\n</plist>")
        plist.write_text(p)
print("Platform files patched.")
