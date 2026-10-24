import 'dart:async';

import 'package:flutter/material.dart';

import 'account_page.dart';
import 'api.dart';
import 'dashboard_page.dart';
import 'map_page.dart';
import 'offline.dart';
import 'scan_page.dart';
import 'search_page.dart';
import 'theme.dart';
import 'widgets.dart';

class Shell extends StatefulWidget {
  final Future<void> Function() onLogout;
  const Shell({super.key, required this.onLogout});
  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int _index = 0;
  String? _focus;
  int _focusN = 0;
  Timer? _sync;

  User get _user => Api.instance.user!;

  List<String> get _ids => ['home', 'map', if (_user.canScan) 'scan', 'search', 'account'];

  @override
  void initState() {
    super.initState();
    _trySync();
    _sync = Timer.periodic(const Duration(seconds: 30), (_) => _trySync());
  }

  @override
  void dispose() {
    _sync?.cancel();
    super.dispose();
  }

  Future<void> _trySync() async {
    final rejected = await OfflineQueue.sync();
    if (rejected.isNotEmpty && mounted) {
      toast(context, '${rejected.length} saved scan(s) were rejected: ${rejected.first}');
    }
  }

  void _openMap(String position) {
    setState(() {
      _focus = position;
      _focusN++;
      _index = _ids.indexOf('map');
    });
  }

  Widget _page(String id) {
    switch (id) {
      case 'home':
        return const DashboardPage();
      case 'map':
        return MapPage(key: ValueKey('map$_focusN'), focus: _focus);
      case 'scan':
        return const ScanPage();
      case 'search':
        return SearchPage(onLocate: _openMap);
      default:
        return AccountPage(onLogout: widget.onLogout);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ids = _ids;
    final id = ids[_index.clamp(0, ids.length - 1)];
    const icons = {
      'home': Icons.dashboard_outlined,
      'map': Icons.grid_view,
      'scan': Icons.qr_code_scanner,
      'search': Icons.search,
      'account': Icons.person_outline,
    };
    const names = {'home': 'Home', 'map': 'Map', 'scan': 'Scan', 'search': 'Search', 'account': 'Account'};
    return Scaffold(
      body: id == 'scan' ? _page(id) : SafeArea(bottom: false, child: _page(id)),
      bottomNavigationBar: NavigationBar(
        backgroundColor: kPanel,
        selectedIndex: _index.clamp(0, ids.length - 1),
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          for (final i in ids) NavigationDestination(icon: Icon(icons[i]), label: names[i] ?? i),
        ],
      ),
    );
  }
}
