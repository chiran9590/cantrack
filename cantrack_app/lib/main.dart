import 'package:flutter/material.dart';

import 'api.dart';
import 'auth_page.dart';
import 'offline.dart';
import 'shell.dart';
import 'theme.dart';
import 'widgets.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Api.instance.load();
  await OfflineQueue.load();
  runApp(const CanTrackApp());
}

class CanTrackApp extends StatefulWidget {
  const CanTrackApp({super.key});
  @override
  State<CanTrackApp> createState() => _CanTrackAppState();
}

class _CanTrackAppState extends State<CanTrackApp> {
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    Api.instance.onExpired = _logout;
    _restore();
  }

  Future<void> _restore() async {
    if (Api.instance.signedIn) {
      try {
        await Api.instance.me();
      } on ApiException catch (e) {
        // Offline at start-up: keep the saved login. Rejected token: sign out.
        if (e.status != null) await Api.instance.logout();
      }
    }
    if (mounted) setState(() => _ready = true);
  }

  Future<void> _logout() async {
    await Api.instance.logout();
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    Widget home;
    if (!_ready) {
      home = Scaffold(body: Loading());
    } else if (!Api.instance.signedIn || Api.instance.user == null) {
      home = AuthPage(onAuth: (_) => setState(() {}));
    } else {
      home = Shell(onLogout: _logout);
    }
    return MaterialApp(title: 'CanTrack', debugShowCheckedModeBanner: false, theme: buildTheme(), home: home);
  }
}
