import 'dart:async';

import 'package:flutter/material.dart';

import 'api.dart';
import 'plant_page.dart';
import 'theme.dart';
import 'widgets.dart';

final _posRe = RegExp(r'^([A-Z0-9]+)-P(\d+)-C(\d+)-R(\d+)$');

class MapPage extends StatefulWidget {
  final String? focus;
  const MapPage({super.key, this.focus});
  @override
  State<MapPage> createState() => _MapPageState();
}

class _MapPageState extends State<MapPage> {
  List<Map<String, dynamic>> _houses = [];
  int _hi = 0;
  int _plat = 1;
  Set<String> _occ = {};
  Set<String> _bad = {};
  String? _sel;
  String? _err;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _init() async {
    try {
      final f = await Api.instance.facility();
      if (!mounted) return;
      final m = widget.focus == null ? null : _posRe.firstMatch(widget.focus!);
      var hi = 0;
      var plat = 1;
      if (m != null) {
        final idx = f.indexWhere((h) => h['code'] == m.group(1));
        if (idx >= 0) {
          hi = idx;
          plat = int.parse(m.group(2)!);
        }
      }
      setState(() {
        _houses = f;
        _hi = hi;
        _plat = plat;
        _sel = widget.focus;
        _err = null;
      });
      await _loadCells();
      _timer = Timer.periodic(const Duration(seconds: 5), (_) => _loadCells());
      if (widget.focus != null && m != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _open(widget.focus!);
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _err = e.message);
    }
  }

  Future<void> _loadCells() async {
    if (_houses.isEmpty) return;
    final hi = _hi, plat = _plat;
    try {
      final d = await Api.instance.glassMap(_houses[hi]['code'] as String, plat);
      if (!mounted || hi != _hi || plat != _plat) return;
      setState(() {
        _occ = (d['cells'] as List<dynamic>).map((c) => (c as Map<String, dynamic>)['position_id'] as String).toSet();
        _bad = (d['conflicts'] as List<dynamic>).map((e) => e as String).toSet();
      });
    } on ApiException catch (_) {
      // keep showing the last known map
    }
  }

  void _pick(int hi, int plat) {
    setState(() {
      _hi = hi;
      _plat = plat;
      _sel = null;
      _occ = {};
      _bad = {};
    });
    _loadCells();
  }

  void _focusOn(String position) {
    final m = _posRe.firstMatch(position);
    if (m == null) return;
    final idx = _houses.indexWhere((h) => h['code'] == m.group(1));
    if (idx < 0) return;
    setState(() {
      _hi = idx;
      _plat = int.parse(m.group(2)!);
      _sel = position;
    });
    _loadCells().then((_) {
      if (mounted) _open(position);
    });
  }

  void _open(String id) {
    setState(() => _sel = id);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PositionSheet(id: id, onLocate: _focusOn),
    );
  }

  Color _color(String id) {
    if (id == _sel) return kAmber;
    if (_bad.contains(id)) return kRed;
    if (_occ.contains(id)) return const Color(0xFF22C55E);
    return const Color(0x26FFFFFF);
  }

  @override
  Widget build(BuildContext context) {
    if (_err != null) return ErrorView(message: _err!, onRetry: _init);
    if (_houses.isEmpty) return const Loading();
    final h = _houses[_hi];
    final code = h['code'] as String;
    final cols = h['columns'] as int;
    final rows = h['rows'] as int;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        child: Text('Glasshouse map', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
      ),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(children: [
          for (var i = 0; i < _houses.length; i++)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(label: Text(_houses[i]['code'] as String), selected: i == _hi, onSelected: (_) => _pick(i, 1)),
            ),
        ]),
      ),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(children: [
          for (var p = 1; p <= (h['platforms'] as int); p++)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(label: Text('Platform $p'), selected: p == _plat, onSelected: (_) => _pick(_hi, p)),
            ),
        ]),
      ),
      const Padding(
        padding: EdgeInsets.fromLTRB(16, 10, 16, 6),
        child: Text('🟩 occupied   ⬛ empty   🟨 selected   🟥 rejected scan (24 h)', style: TextStyle(color: Colors.white54, fontSize: 12)),
      ),
      Expanded(
        child: Container(
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          decoration: BoxDecoration(color: kCard, borderRadius: BorderRadius.circular(16), border: Border.all(color: kBorder)),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: InteractiveViewer(
              constrained: false,
              minScale: 0.5,
              maxScale: 4,
              boundaryMargin: const EdgeInsets.all(60),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  for (var c = 1; c <= cols; c++)
                    Row(mainAxisSize: MainAxisSize.min, children: [
                      for (var r = 1; r <= rows; r++)
                        GestureDetector(
                          onTap: () => _open(posId(code, _plat, c, r)),
                          child: Container(
                            width: 24,
                            height: 24,
                            margin: const EdgeInsets.all(2),
                            decoration: BoxDecoration(color: _color(posId(code, _plat, c, r)), borderRadius: BorderRadius.circular(5)),
                          ),
                        ),
                    ]),
                ]),
              ),
            ),
          ),
        ),
      ),
    ]);
  }
}

class _PositionSheet extends StatefulWidget {
  final String id;
  final void Function(String) onLocate;
  const _PositionSheet({required this.id, required this.onLocate});
  @override
  State<_PositionSheet> createState() => _PositionSheetState();
}

class _PositionSheetState extends State<_PositionSheet> {
  late final Future<Map<String, dynamic>> _f = Api.instance.position(widget.id);

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.75),
        child: FutureBuilder<Map<String, dynamic>>(
          future: _f,
          builder: (context, snap) {
            if (snap.hasError) return Padding(padding: const EdgeInsets.all(24), child: Text('${snap.error}', style: const TextStyle(color: kRed)));
            if (!snap.hasData) return const SizedBox(height: 160, child: Loading());
            final d = snap.data!;
            final plant = d['plant'] as Map<String, dynamic>?;
            final history = (d['history'] as List<dynamic>).cast<Map<String, dynamic>>();
            final rej = (d['rejections'] as List<dynamic>).cast<Map<String, dynamic>>();
            return ListView(padding: const EdgeInsets.all(20), shrinkWrap: true, children: [
              Text(widget.id, style: const TextStyle(fontFamily: 'monospace', fontSize: 20, color: kLime, fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              if (plant == null)
                const Text('Empty position.', style: TextStyle(color: Colors.white60))
              else ...[
                label('GID', '${plant['gid']}${plant['phenomeone_id'] != null ? '  ·  PhenomeOne ${plant['phenomeone_id']}' : ''}'),
                label('Plant', '${plant['uuid']}'),
                label('Sown', fmtDay(plant['sown_date'])),
                if (infoText(plant['info']).isNotEmpty) label('Genotype', infoText(plant['info'])),
                FilledButton.tonal(
                  onPressed: () {
                    Navigator.pop(context);
                    Navigator.of(context).push(MaterialPageRoute<void>(
                        builder: (_) => PlantPage(uuid: plant['uuid'] as String, onLocate: widget.onLocate)));
                  },
                  child: const Text('Open plant details'),
                ),
                heading('Movement history'),
                for (final m in history)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text('${fmtDay(m['moved_at'])}  ${m['position_id']}  (${m['by']})${m['kind'] == 'correction' ? '  ✏️ ${m['reason']}' : ''}',
                        style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: Colors.white70)),
                  ),
              ],
              if (rej.isNotEmpty) ...[
                heading('Recent rejected scans'),
                for (final r in rej) Text('${fmtDate(r['at'])} · ${r['by'] ?? '?'} · ${r['reason']}', style: const TextStyle(color: kRed, fontSize: 12)),
              ],
            ]);
          },
        ),
      ),
    );
  }
}
