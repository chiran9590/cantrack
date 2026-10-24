import 'dart:async';

import 'package:flutter/material.dart';

import 'api.dart';
import 'plant_page.dart';
import 'theme.dart';
import 'widgets.dart';

class SearchPage extends StatefulWidget {
  final void Function(String) onLocate;
  const SearchPage({super.key, required this.onLocate});
  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final _ctl = TextEditingController();
  Timer? _debounce;
  List<Map<String, dynamic>> _hits = [];
  String _q = '';
  String? _err;
  bool _busy = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _ctl.dispose();
    super.dispose();
  }

  void _changed(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () => _run(v.trim()));
  }

  Future<void> _run(String q) async {
    if (q.isEmpty) {
      setState(() {
        _q = '';
        _hits = [];
        _err = null;
      });
      return;
    }
    setState(() => _busy = true);
    try {
      final r = await Api.instance.search(q);
      if (!mounted || _ctl.text.trim() != q) return;
      setState(() {
        _q = q;
        _hits = r;
        _err = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _err = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final gid = _hits.cast<Map<String, dynamic>?>().firstWhere(
          (h) => (h!['gid'] as String).toLowerCase() == _q.toLowerCase(),
          orElse: () => null,
        );
    final total = _hits.isEmpty ? 0 : _hits.first['total'] as int;
    return ListView(padding: const EdgeInsets.all(16), children: [
      const Text('Search', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
      const SizedBox(height: 12),
      TextField(
        controller: _ctl,
        onChanged: _changed,
        autocorrect: false,
        decoration: inputDeco('GID, plant UUID, position or glasshouse').copyWith(
          prefixIcon: const Icon(Icons.search),
          suffixIcon: _busy ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))) : null,
        ),
      ),
      const SizedBox(height: 12),
      if (_err != null) Text(_err!, style: const TextStyle(color: kRed)),
      if (gid != null)
        AppCard(
          onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => GenotypePage(gid: gid['gid'] as String, onLocate: widget.onLocate))),
          child: Row(children: [
            const Text('🧬', style: TextStyle(fontSize: 24)),
            const SizedBox(width: 12),
            Expanded(child: Text('Genotype ${gid['gid']}: see every plant and its parentage', style: const TextStyle(fontWeight: FontWeight.w600))),
            const Icon(Icons.chevron_right),
          ]),
        ),
      if (_q.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text('$total plant(s) found${total > 50 ? ' — showing first 50' : ''}', style: const TextStyle(color: Colors.white54))),
      for (final p in _hits)
        AppCard(
          onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => PlantPage(uuid: p['uuid'] as String, onLocate: widget.onLocate))),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${p['gid']}  ·  ${p['position'] ?? 'removed'}',
                    style: TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w700, color: p['position'] == null ? kRed : kLime)),
                const SizedBox(height: 2),
                Text('${p['uuid']}', style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: Colors.white54)),
              ]),
            ),
            const Icon(Icons.chevron_right),
          ]),
        ),
    ]);
  }
}
