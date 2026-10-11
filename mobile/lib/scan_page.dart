import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'api.dart';
import 'theme.dart';

final _posRe = RegExp(r'^[A-Z0-9]{1,4}-P\d+-C\d+-R\d+$');
final _uuidRe = RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');

class ScanResult {
  final bool ok;
  final String message;
  final DateTime at = DateTime.now();
  ScanResult(this.ok, this.message);
}

class ScanPage extends StatefulWidget {
  final User user;
  final Future<void> Function() onLogout;
  const ScanPage({super.key, required this.user, required this.onLogout});
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
    String two(int n) => n.toString().padLeft(2, '0');
    final rnd = Random().nextInt(0xFFF).toRadixString(16).toUpperCase().padLeft(3, '0');
    return 'S-${d.year}${two(d.month)}${two(d.day)}-$rnd';
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

  // The gardener can scan either QR first. A position ID and a plant UUID look different,
  // so the app tells them apart; as soon as both are known the scan is saved.
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
      _show(false, 'Not a CanTrack QR code');
      return;
    }
    final p = _pos, u = _uuid;
    if (p == null || u == null) return;
    _locked = true;
    try {
      _show(true, await Api.instance.scan(p, u, _session));
    } on ApiException catch (e) {
      _show(false, e.message);
    }
  }

  void _show(bool ok, String msg) {
    _locked = true;
    ok ? HapticFeedback.mediumImpact() : HapticFeedback.heavyImpact();
    if (!mounted) return;
    final r = ScanResult(ok, msg);
    setState(() {
      _flash = r;
      _log.insert(0, r);
      _pos = null;
      _uuid = null;
    });
    Future.delayed(Duration(milliseconds: ok ? 900 : 2200), () {
      _locked = false;
      if (mounted) setState(() => _flash = null);
    });
  }

  Future<void> _manual() async {
    final p = TextEditingController();
    final u = TextEditingController();
    final go = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Type instead of scanning'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: p, textCapitalization: TextCapitalization.characters, decoration: inputDeco('Position ID')),
          const SizedBox(height: 12),
          TextField(controller: u, decoration: inputDeco('Plant UUID')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Record')),
        ],
      ),
    );
    final pt = p.text, ut = u.text;
    p.dispose();
    u.dispose();
    if (go != true) return;
    if (pt.trim().isNotEmpty) {
      _lastRaw = '';
      await _handle(pt);
    }
    if (ut.trim().isNotEmpty) {
      _lastRaw = '';
      await _handle(ut);
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
                          leading: Text(r.ok ? '✓' : '⚠', style: TextStyle(fontSize: 22, color: r.ok ? kGreen : kRed)),
                          title: Text(r.message),
                          subtitle: Text(TimeOfDay.fromDateTime(r.at).format(c)),
                        ))
                    .toList(),
              ),
      ),
    );
  }

  Widget _step(String label, String? value, String hint) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: kPanel,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: value != null ? kGreen : const Color(0x22FFFFFF), width: 2),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label.toUpperCase(), style: const TextStyle(color: Colors.white54, fontSize: 12, letterSpacing: 1)),
          const SizedBox(height: 2),
          Text(value ?? hint, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: value != null ? Colors.white : Colors.white38)),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final okCount = _log.where((r) => r.ok).length;
    final errCount = _log.length - okCount;
    return Scaffold(
      body: Stack(children: [
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
                Expanded(child: Text('${widget.user.name}  ·  ✓ $okCount   ⚠ $errCount', style: const TextStyle(fontWeight: FontWeight.w600))),
                IconButton(
                  icon: Icon(_torch ? Icons.flash_on : Icons.flash_off),
                  onPressed: () {
                    _cam.toggleTorch();
                    setState(() => _torch = !_torch);
                  },
                ),
                IconButton(icon: const Icon(Icons.history), onPressed: _showLog),
                PopupMenuButton<String>(
                  onSelected: (v) {
                    if (v == 'new') {
                      setState(() => _session = _newSession());
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('New session $_session')));
                    } else if (v == 'type') {
                      _manual();
                    } else {
                      widget.onLogout();
                    }
                  },
                  itemBuilder: (_) => const [
                    PopupMenuItem(value: 'new', child: Text('New session')),
                    PopupMenuItem(value: 'type', child: Text('Type instead of scanning')),
                    PopupMenuItem(value: 'out', child: Text('Sign out')),
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
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                _step('Position', _pos, 'scan position QR'),
                const SizedBox(height: 10),
                _step('Plant', _uuid == null ? null : '${_uuid!.substring(0, 13)}…', 'scan plant QR'),
                if (_pos != null || _uuid != null)
                  TextButton(onPressed: () => setState(() { _pos = null; _uuid = null; }), child: const Text('Clear')),
              ]),
            ),
          ),
        ),
        if (_flash != null)
          Positioned.fill(
            child: Container(
              color: _flash!.ok ? const Color(0xE616A34A) : const Color(0xE6DC2626),
              padding: const EdgeInsets.all(28),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text(_flash!.ok ? '✓' : '⚠', style: const TextStyle(fontSize: 96, fontWeight: FontWeight.w800, color: Colors.white)),
                const SizedBox(height: 12),
                Text(_flash!.message, textAlign: TextAlign.center, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Colors.white)),
              ]),
            ),
          ),
      ]),
    );
  }
}
