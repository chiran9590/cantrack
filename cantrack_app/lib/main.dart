import 'package:flutter/material.dart';

import 'api.dart';
import 'login_page.dart';
import 'scan_page.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Api.instance.load();
  runApp(const CanTrackApp());
}

class CanTrackApp extends StatefulWidget {
  const CanTrackApp({super.key});
  @override
  State<CanTrackApp> createState() => _CanTrackAppState();
}

class _CanTrackAppState extends State<CanTrackApp> {
  User? _user;
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
        _user = await Api.instance.me();
      } catch (_) {
        await Api.instance.logout();
      }
    }
    if (mounted) setState(() => _ready = true);
  }

  Future<void> _logout() async {
    await Api.instance.logout();
    if (mounted) setState(() => _user = null);
  }

  @override
  Widget build(BuildContext context) {
    Widget home;
    if (!_ready) {
      home = const Scaffold(body: Center(child: CircularProgressIndicator(color: kGreen)));
    } else if (_user == null) {
      home = LoginPage(onLogin: (u) => setState(() => _user = u));
    } else {
      home = ScanPage(user: _user!, onLogout: _logout);
    }
    return MaterialApp(title: 'CanTrack', debugShowCheckedModeBanner: false, theme: buildTheme(), home: home);
  }
}
