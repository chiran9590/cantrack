import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api.dart';

class QueuedScan {
  final String position;
  final String uuid;
  final String session;
  QueuedScan(this.position, this.uuid, this.session);
  Map<String, String> toJson() => {'p': position, 'u': uuid, 's': session};
  factory QueuedScan.fromJson(Map<String, dynamic> j) => QueuedScan(j['p'] as String, j['u'] as String, j['s'] as String);
}

/// Scans made without a connection are kept on the phone and sent, in order, when the server is reachable again.
class OfflineQueue {
  static const _store = FlutterSecureStorage();
  static final List<QueuedScan> _items = [];
  static final ValueNotifier<int> pending = ValueNotifier<int>(0);
  static bool _syncing = false;

  static Future<void> load() async {
    _items.clear();
    final raw = await _store.read(key: 'queue');
    if (raw != null) {
      for (final e in jsonDecode(raw) as List<dynamic>) {
        _items.add(QueuedScan.fromJson(e as Map<String, dynamic>));
      }
    }
    pending.value = _items.length;
  }

  static Future<void> _save() async {
    await _store.write(key: 'queue', value: jsonEncode(_items.map((e) => e.toJson()).toList()));
    pending.value = _items.length;
  }

  static Future<void> add(QueuedScan s) async {
    _items.add(s);
    await _save();
  }

  static Future<void> clear() async {
    _items.clear();
    await _save();
  }

  /// Sends the queue. Returns one message per scan the server rejected (those are dropped).
  static Future<List<String>> sync() async {
    if (_syncing || _items.isEmpty) return [];
    _syncing = true;
    final rejected = <String>[];
    try {
      while (_items.isNotEmpty) {
        final s = _items.first;
        try {
          await Api.instance.scan(s.position, s.uuid, s.session);
          _items.removeAt(0);
        } on ApiException catch (e) {
          if (e.status == null || e.status == 401) break; // still offline, or signed out: keep the rest
          rejected.add('${s.position}: ${e.message}');
          _items.removeAt(0);
        }
      }
    } finally {
      _syncing = false;
      await _save();
    }
    return rejected;
  }
}
