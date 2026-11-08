import 'package:flutter/material.dart';

import 'api.dart';
import 'offline.dart';
import 'theme.dart';
import 'widgets.dart';

class AccountPage extends StatelessWidget {
  final Future<void> Function() onLogout;
  const AccountPage({super.key, required this.onLogout});

  Future<void> _changePassword(BuildContext context) async {
    final v = await promptDialog(context, 'Change password', ['Current password', 'New password (8+ characters)']);
    if (v == null || v[0].isEmpty || v[1].length < 8) return;
    try {
      await Api.instance.changePassword(v[0], v[1]);
      if (context.mounted) toast(context, 'Password changed');
    } on ApiException catch (e) {
      if (context.mounted) toast(context, e.message);
    }
  }

  Future<void> _signOut(BuildContext context) async {
    final n = OfflineQueue.pending.value;
    if (n > 0) {
      final ok = await confirmDialog(context, 'Sign out?', '$n saved scan(s) have not been sent yet and will be lost. Sync first if you can.');
      if (!ok) return;
    }
    await OfflineQueue.clear();
    await onLogout();
  }

  @override
  Widget build(BuildContext context) {
    final u = Api.instance.user!;
    return ListView(padding: const EdgeInsets.all(16), children: [
      const Text('Account', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
      const SizedBox(height: 12),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(u.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(u.email, style: const TextStyle(color: Colors.white60)),
          const SizedBox(height: 8),
          Chip(label: Text(u.role)),
          if (u.role == 'member')
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text('View-only access. Ask an administrator for scanning rights.', style: TextStyle(color: kAmber, fontSize: 12)),
            ),
        ]),
      ),
      AppCard(child: label('Server', Api.instance.baseUrl)),
      ValueListenableBuilder<int>(
        valueListenable: OfflineQueue.pending,
        builder: (_, n, __) => AppCard(
          child: Row(children: [
            Expanded(child: Text(n == 0 ? 'All scans are synced.' : '$n scan(s) saved on this phone, waiting to sync.', style: TextStyle(color: n == 0 ? Colors.white70 : kAmber))),
            if (n > 0)
              TextButton(
                onPressed: () async {
                  final r = await OfflineQueue.sync();
                  if (context.mounted) toast(context, r.isEmpty ? 'Sync finished' : '${r.length} scan(s) rejected: ${r.first}');
                },
                child: const Text('Sync now'),
              ),
          ]),
        ),
      ),
      OutlinedButton(onPressed: () => _changePassword(context), child: const Text('Change password')),
      const SizedBox(height: 12),
      FilledButton(
        onPressed: () => _signOut(context),
        style: FilledButton.styleFrom(backgroundColor: const Color(0x33F87171), foregroundColor: kRed),
        child: const Text('Sign out'),
      ),
    ]);
  }
}
