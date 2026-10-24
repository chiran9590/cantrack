import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'api.dart';
import 'offline.dart';
import 'theme.dart';
import 'widgets.dart';

final _posRe = RegExp(r'^[A-Z0-9]{1,4}-P\d+-C\d+-R\d+$');
final _uuidRe = RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');

class ScanResult {
  final bool ok;
  final bool queued;
  final String message;
  final DateTime at = DateTime.now();
  ScanResult(this.ok, this.message, {this.queued = false});
}

class ScanPage extends StatefulWidget {
  const ScanPage({super.key});
  @override
  State<ScanPage> createState() => _ScanPageState();
}

class _ScanPageState extends State<ScanPage> {
  final MobileScannerController _cam = MobileScannerController(formats: const [BarcodeFormat.qrCode]);
  String? _pos;
  String? _uuid;
  ScanResult? _flash;
  final List<ScanResult> _log = [];
  bool _locked = false;
  bool _torch = false;
  String _lastRaw = '';
  DateTime _lastAt = DateTime.fromMillisecondsSinceEpoch(0);
  late String _session = _newSession();

  static String _newSession() {
    final d = DateTime.now();
    final rnd = Random().nextInt(0xFFF).toRadixString(16).toUpperCase().padLeft(3, '0');
    return 'S-${d.year}${pad2(d.month)}${pad2(d.day)}-$rnd';
  }

  @override
  void dispose() {
    _cam.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    for (final b in capture.barcodes) {
      final raw = b.rawValue;
      if (raw != null && raw.trim().isNotEmpty) {
        _handle(raw);
        break;
      }
    }
  }

  // Either QR can be scanned first: a position ID and a plant UUID look different,
  // so the app tells them apart. As soon as both are known the scan is saved.
  Future<void> _handle(String raw) async {
    if (_locked) return;
    final v = raw.trim();
    final now = DateTime.now();
    if (v == _lastRaw && now.difference(_lastAt) < const Duration(milliseconds: 1500)) return;
    _lastRaw = v;
    _lastAt = now;
    if (_posRe.hasMatch(v.toUpperCase())) {
      HapticFeedback.selectionClick();
      setState(() => _pos = v.toUpperCase());
    } else if (_uuidRe.hasMatch(v)) {
      HapticFeedback.selectionClick();
      setState(() => _uuid = v.toLowerCase());
    } else {
      _show(ScanResult(false, 'Not a CanTrack QR code'));
      return;
    }
    final p = _pos, u = _uuid;
    if (p == null || u == null) return;
    _locked = true;
    try {
      _show(ScanResult(true, await Api.instance.scan(p, u, _session)));
    } on ApiException catch (e) {
      if (e.status == null) {
        // No connection: keep the scan on the phone and send it later.
        await OfflineQueue.add(QueuedScan(p, u, _session));
        _show(ScanResult(true, 'Saved offline\n$p', queued: true));
      } else {
        _show(ScanResult(false, e.message));
      }
    }
  }

  void _show(ScanResult r) {
    _locked = true;
    r.ok ? HapticFeedback.mediumImpact() : HapticFeedback.heavyImpact();
    if (!mounted) return;
    setState(() {
      _flash = r;
      _log.insert(0, r);
      _pos = null;
      _uuid = null;
    });
    Future.delayed(Duration(milliseconds: r.ok ? 900 : 2200), () {
      _locked = false;
      if (mounted) setState(() => _flash = null);
    });
  }

  Future<void> _manual() async {
    final v = await promptDialog(context, 'Type instead of scanning', ['Position ID', 'Plant UUID']);
    if (v == null) return;
    if (v[0].isNotEmpty) {
      _lastRaw = '';
      await _handle(v[0]);
    }
    if (v[1].isNotEmpty) {
      _lastRaw = '';
      await _handle(v[1]);
    }
  }

  void _showLog() {
    showModalBottomSheet<void>(
      context: context,
      builder: (c) => SafeArea(
        child: _log.isEmpty
            ? const Padding(padding: EdgeInsets.all(32), child: Text('No scans yet in this session.'))
            : ListView(
                children: _log
                    .map((r) => ListTile(
                          leading: Text(r.queued ? '⏳' : r.ok ? '✓' : '⚠', style: TextStyle(fontSize: 22, color: r.ok ? kGreen : kRed)),
                          title: Text(r.message),
                          subtitle: Text(TimeOfDay.fromDateTime(r.at).format(c)),
                        ))
                    .toList(),
              ),
      ),
    );
  }

  Widget _step(String name, String? value, String hint) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: kPanel,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: value != null ? kGreen : const Color(0x22FFFFFF), width: 2),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(name.toUpperCase(), style: const TextStyle(color: Colors.white54, fontSize: 12, letterSpacing: 1)),
          const SizedBox(height: 2),
          Text(value ?? hint, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: value != null ? Colors.white : Colors.white38)),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final okCount = _log.where((r) => r.ok).length;
    final errCount = _log.length - okCount;
    final flash = _flash;
    return Stack(children: [
      Positioned.fill(child: MobileScanner(controller: _cam, onDetect: _onDetect)),
      Positioned(
        top: 0,
        left: 0,
        right: 0,
        child: SafeArea(
          child: Container(
            margin: const EdgeInsets.all(12),
            padding: const EdgeInsets.only(left: 14),
            decoration: BoxDecoration(color: kPanel, borderRadius: BorderRadius.circular(14)),
            child: Row(children: [
              Expanded(
                child: ValueListenableBuilder<int>(
                  valueListenable: OfflineQueue.pending,
                  builder: (_, n, __) => Text('✓ $okCount   ⚠ $errCount${n > 0 ? '   ⏳ $n waiting' : ''}', style: const TextStyle(fontWeight: FontWeight.w600)),
                ),
              ),
              IconButton(
                icon: Icon(_torch ? Icons.flash_on : Icons.flash_off),
                onPressed: () {
                  _cam.toggleTorch();
                  setState(() => _torch = !_torch);
                },
              ),
              IconButton(icon: const Icon(Icons.history), onPressed: _showLog),
              PopupMenuButton<String>(
                onSelected: (v) async {
                  if (v == 'new') {
                    setState(() => _session = _newSession());
                    toast(context, 'New session $_session');
                  } else if (v == 'sync') {
                    final r = await OfflineQueue.sync();
                    if (mounted) toast(context, r.isEmpty ? 'Sync finished' : '${r.length} scan(s) rejected: ${r.first}');
                  } else {
                    _manual();
                  }
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'new', child: Text('New session')),
                  PopupMenuItem(value: 'sync', child: Text('Sync saved scans')),
                  PopupMenuItem(value: 'type', child: Text('Type instead of scanning')),
                ],
              ),
            ]),
          ),
        ),
      ),
      IgnorePointer(
        child: Center(
          child: Container(
            width: 240,
            height: 240,
            decoration: BoxDecoration(border: Border.all(color: kLime, width: 3), borderRadius: BorderRadius.circular(24)),
          ),
        ),
      ),
      Positioned(
        left: 16,
        right: 16,
        bottom: 0,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            _step('Position', _pos, 'scan position QR'),
            const SizedBox(height: 10),
            _step('Plant', _uuid == null ? null : '${_uuid!.substring(0, 13)}…', 'scan plant QR'),
            if (_pos != null || _uuid != null)
              TextButton(
                onPressed: () => setState(() {
                  _pos = null;
                  _uuid = null;
                }),
                child: const Text('Clear'),
              ),
          ]),
        ),
      ),
      if (flash != null)
        Positioned.fill(
          child: Container(
            color: flash.queued
                ? const Color(0xE6D97706)
                : flash.ok
                    ? const Color(0xE616A34A)
                    : const Color(0xE6DC2626),
            padding: const EdgeInsets.all(28),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text(flash.queued ? '⏳' : flash.ok ? '✓' : '⚠', style: const TextStyle(fontSize: 96, fontWeight: FontWeight.w800, color: Colors.white)),
              const SizedBox(height: 12),
              Text(flash.message, textAlign: TextAlign.center, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Colors.white)),
            ]),
          ),
        ),
    ]);
  }
}
