# CanTrack mobile app (Flutter: Android + iOS)

## One-time setup (needs the Flutter SDK: https://docs.flutter.dev/get-started/install)
```
flutter create --org com.cantrack --project-name cantrack_app cantrack_app
cd cantrack_app
flutter pub add http flutter_secure_storage mobile_scanner
```
Copy this folder's `lib/` over `cantrack_app/lib/` (replace everything), delete `test/widget_test.dart`, then:
```
python path/to/mobile/tools/patch_platforms.py .
flutter doctor        # fix anything it flags (Android SDK / licenses)
```

## Run on a phone (USB debugging on)
```
flutter run
```
Server address on the login screen: `http://<your computer's LAN IP>:4000` (backend started with `--host 0.0.0.0`).

## Build the APK
```
flutter build apk --release
```
Result: `build/app/outputs/flutter-apk/app-release.apk`. Copy it to the phone and install it.

## iOS (later, needs a Mac with Xcode and an Apple developer account)
```
flutter build ios --release
```
